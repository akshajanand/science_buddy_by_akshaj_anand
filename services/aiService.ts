
import { supabase } from "./supabaseClient";
import { QuizQuestion, PuzzleWord, ChatSession, MatchingPair, PodcastSegment, VideoSlide } from "../types";
import { showToast } from "../utils/notificationUtils";

// --- CORE GROQ CONFIGURATION ---

// Priority list of models to use. If one fails, the app automatically switches to the next.
const BACKUP_MODELS = [
    "llama-3.3-70b-versatile", // Primary: Highest Intelligence
    "llama-3.1-8b-instant",    // Secondary: Ultra Fast, good for basic chat
    "mixtral-8x7b-32768",      // Tertiary: Reliable Fallback
    "gemma2-9b-it"             // Final Resort
];

let cachedGroqKey: string | null = null;
let cachedPexelsKey: string | null = null;

const getGroqApiKey = async () => {
    if (cachedGroqKey) return cachedGroqKey;
    try {
        const { data, error } = await supabase.from('app_secrets').select('value').eq('name', 'GROQ_API_KEY').single();
        if (error || !data) return null;
        cachedGroqKey = data.value;
        return cachedGroqKey;
    } catch (e) { return null; }
};

const getPexelsApiKey = async () => {
    if (cachedPexelsKey) return cachedPexelsKey;
    try {
        const { data, error } = await supabase.from('app_secrets').select('value').eq('name', 'PEXELS_API_KEY').single();
        if (error || !data) return null;
        cachedPexelsKey = data.value;
        return cachedPexelsKey;
    } catch (e) { return null; }
};

/**
 * Core function to communicate with Groq API.
 */
const callGroqAPI = async (
    messages: { role: string; content: string }[],
    jsonMode: boolean = false,
    temperature: number = 0.7
): Promise<string | null> => {
    const apiKey = await getGroqApiKey();
    if (!apiKey) {
        console.error("No Groq API Key found.");
        return null;
    }

    // Attempt to get a response using the models in priority order
    for (let i = 0; i < BACKUP_MODELS.length; i++) {
        const model = BACKUP_MODELS[i];
        
        try {
            const body: any = {
                model: model,
                messages: messages,
                temperature: temperature,
                max_tokens: 8096
            };

            if (jsonMode) {
                body.response_format = { type: "json_object" };
            }

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const status = response.status;
                if (status === 429) {
                    await new Promise(r => setTimeout(r, 1200)); 
                    continue; 
                }
                if (status >= 500) continue;
                console.warn(`Groq API Error (${status}) on ${model}.`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
            continue;

        } catch (e) {
            continue; 
        }
    }
    return null;
};

const cleanAndParseJSON = (text: string | null): any => {
    if (!text) return null;
    try {
        const cleanText = text.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        return null;
    }
};

// --- XP SYSTEM ---

/**
 * Awards XP to the user.
 */
export const checkAndAwardDailyXP = async (userId: string, amount: number, activityName: string) => {
    try {
        // Daily limit check removed by request.
        await supabase.rpc('increment_score', { row_id: userId, points: amount });
        showToast(`+${amount} XP! ${activityName} 🌟`, 'success');
    } catch (e) {
        console.error("XP Error", e);
    }
};

// --- PROMPTS & FEATURES ---

const CLASS_8_SYSTEM_PROMPT = `
You are "Science Buddy", a highly personalized AI tutor for Class 8 Science students.

CORE RULES:
1. **Context Aware**: I will provide you with the student's profile, recent scores, and interests. USE THIS DATA.
   - If they like "Football", use football analogies for physics.
   - If they failed a "Friction" quiz recently, gently suggest reviewing it.
   - If they have a high rank, congratulate them.
2. **Socratic**: Don't just give answers. Guide them.
3. **Memory**: Treat the conversation history as truth.

TONE:
- Enthusiastic, Relatable, Encouraging.
- Use emojis occasionally.
`;

const VOICE_SYSTEM_PROMPT = `
You are "Science Buddy", speaking directly to a Class 8 student via a voice call.
CRITICAL VOICE RULES:
1. **NO VISUALS**: Output is for Text-to-Speech only.
2. **Conversational**: Speak like a human friend.
3. **Concise**: Short answers (1-2 sentences max unless explained).
4. **Personal**: Use the user's name and interests.
`;

export interface LiveUserContext {
    name?: string | null;
    interests?: string;
    customBehavior?: string; 
    stats?: {
        rank: string | number;
        totalPoints: number;
        totalStudents: number;
        recentQuizScores: { topic: string, score: number }[];
        researchTopics: string[];
        savedPodTopics: string[];
        communityNotesCount: number;
    };
}

export const fetchLiveUserStats = async (userId: string) => {
    try {
        const [userRes, quizRes, researchRes, libraryRes, notesRes, allUsersRes] = await Promise.all([
            supabase.from('users').select('total_points, custom_ai_behavior').eq('id', userId).single(),
            supabase.from('quiz_progress').select('topic, score').eq('user_id', userId).order('updated_at', {ascending: false}).limit(5),
            supabase.from('research_projects').select('title').eq('user_id', userId).order('created_at', {ascending: false}).limit(3),
            supabase.from('study_library').select('topic').eq('user_id', userId).order('created_at', {ascending: false}).limit(3),
            supabase.from('community_notes').select('id', { count: 'exact' }).eq('user_id', userId),
            supabase.from('users').select('id, total_points').order('total_points', { ascending: false })
        ]);

        let rank = '-';
        let totalStudents = 0;
        if (allUsersRes.data) {
            totalStudents = allUsersRes.data.length;
            const idx = allUsersRes.data.findIndex(u => u.id === userId);
            if (idx !== -1) rank = (idx + 1).toString();
        }

        return {
            rank,
            totalPoints: userRes.data?.total_points || 0,
            customBehavior: userRes.data?.custom_ai_behavior || "",
            totalStudents,
            recentQuizScores: quizRes.data || [],
            researchTopics: researchRes.data?.map(r => r.title) || [],
            savedPodTopics: libraryRes.data?.map(l => l.topic) || [],
            communityNotesCount: notesRes.count || 0
        };
    } catch (e) {
        return undefined;
    }
};

export const analyzeUserProfile = async (data: any) => {
    return { name: null, interests: "General Science" };
};

export const chatWithAI = async (message: string, history: any[], userContext: LiveUserContext) => {
  let systemInstruction = CLASS_8_SYSTEM_PROMPT;
  
  // Inject Personalization
  const name = userContext.name || "Student";
  const interests = userContext.interests || "General Science";
  
  let statsContext = "";
  if (userContext.stats) {
      statsContext = `
      CURRENT STUDENT DATA:
      - Rank: #${userContext.stats.rank} (XP: ${userContext.stats.totalPoints})
      - Recent Quizzes: ${JSON.stringify(userContext.stats.recentQuizScores)}
      - Researching: ${JSON.stringify(userContext.stats.researchTopics)}
      `;
  }

  if (userContext.customBehavior) systemInstruction += `\n\nUSER CUSTOM INSTRUCTION: "${userContext.customBehavior}"`;
  
  systemInstruction += `\n\nPROFILE: Name: ${name}, Interests: ${interests}.\n${statsContext}`;

  const messages = [{ role: "system", content: systemInstruction }, ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })), { role: "user", content: message }];
  const response = await callGroqAPI(messages, false);
  return response || "My brain is buffering...";
};

export const chatWithAIVoice = async (message: string, history: any[], userContext: LiveUserContext) => {
  let systemInstruction = VOICE_SYSTEM_PROMPT;
  if (userContext.name) systemInstruction += `\nUser Name: ${userContext.name}`;
  if (userContext.interests) systemInstruction += `\nInterests: ${userContext.interests}`;

  const messages = [{ role: "system", content: systemInstruction }, ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })), { role: "user", content: message }];
  const response = await callGroqAPI(messages, false, 0.9);
  return response || "I'm not sure I heard that correctly.";
};

export const generateTitle = async (message: string): Promise<string> => {
    const prompt = `Summarize into 3-5 word title. Msg: "${message}"`;
    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response?.trim().replace(/^"|"$/g, '') || message.slice(0, 30);
};

// --- IMPLEMENTED GENERATORS ---

export const generatePerformanceReport = async (username: string, interests: string, stats: any) => {
    const prompt = `
    Act as a friendly, expert Academic Advisor for Class 8 student "${username}".
    
    STUDENT DATA:
    - Rank: #${stats.rank}
    - Total XP: ${stats.totalPoints}
    - Quizzes Taken: ${stats.quizzesAttempted}
    - Topic Scores: ${JSON.stringify(stats.topicScores)}
    - Research Docs: ${stats.researchProjects.length}
    - Community Notes Shared: ${stats.communityNotes}
    - Interests: ${interests}

    TASK:
    Write a detailed, personalized performance review in Markdown.
    
    STRUCTURE:
    1. **Overview**: A high-energy greeting acknowledging their Rank and XP.
    2. **Strengths**: Analyze high quiz scores. Be specific.
    3. **Areas for Growth**: Analyze low scores or topics not yet attempted.
    4. **Action Plan**: Suggest specific "Study Pod" topics or "Research Lab" ideas based on their interests (${interests}) to improve weak areas.
    5. **Fun Fact**: A weird scientific fact related to their best topic.

    Make it look dynamic and professional using bolding, lists, and emojis.
    `;

    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response || "Analysis unavailable at the moment.";
};

export const generateQuizQuestions = async (topic: string, count: number = 5, interests: string = "General", seed?: string): Promise<QuizQuestion[]> => {
    const prompt = `Generate ${count} multiple-choice questions for Class 8 Science level.
    Topic: "${topic}"
    Context: ${interests}
    
    Output strictly valid JSON:
    {
      "questions": [
        {
          "question": "Why is the sky blue?",
          "options": ["Rayleigh scattering", "Reflection", "Refraction", "Dispersion"],
          "correctAnswer": "Rayleigh scattering",
          "explanation": "Blue light is scattered in all directions by the tiny molecules of air in Earth's atmosphere."
        }
      ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.questions || [];
};

export const generateWordPuzzle = async (topic: string): Promise<PuzzleWord[]> => {
    const prompt = `Generate 8 scientific words related to "${topic}" for a word search puzzle.
    Return JSON: { "words": [ { "word": "ATOM", "clue": "Basic unit of matter" } ] }`;
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response)?.words || [];
};

export const generateMatchingPairs = async (topic: string): Promise<MatchingPair[]> => {
    const prompt = `Generate 5 matching pairs for topic "${topic}".
    Return JSON: { "pairs": [ { "id": "1", "term": "Mitochondria", "definition": "Powerhouse" } ] }`;
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response)?.pairs || [];
};

export const generateStudyPodSummary = async (topic: string) => { 
    const prompt = `Create a fun, engaging summary of "${topic}" for a Class 8 student. Avoid markdown symbols. Keep it conversational.`; 
    const r = await callGroqAPI([{ role: "user", content: prompt }]); 
    return r || "Could not generate summary."; 
};

export const generatePodcastScript = async (topic: string): Promise<PodcastSegment[]> => {
    const prompt = `Write a short 2-person educational podcast script about "${topic}".
    Host 1 (Rohan): Curious student.
    Host 2 (Ms. Rachel): Fun teacher.
    Return JSON: { "script": [ {"speaker": "Host 1", "text": "..."} ] }`;
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response)?.script || [];
}; 

// ... [Keep other stubbed functions if not critical, or implement similarly] ...
export const generateStoryNode = async (context: string, choice: string|null, topic?: string) => { 
    const prompt = topic ? `Start a sci-fi adventure about ${topic}. JSON: { "text": "...", "choices": [{"text": "...", "nextId": "..."}] }` : `Continue story. Context: ${context}. Choice: ${choice}. JSON same format.`;
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response);
};

export const rewriteText = async (text: string, style: string) => { 
    const prompt = `Rewrite this in ${style} style: "${text}"`;
    return await callGroqAPI([{ role: "user", content: prompt }]) || text;
};

export const generateConceptMapData = async (topic: string) => { 
    const prompt = `Create concept map for "${topic}". JSON: { "root": { "label": "${topic}", "description": "..." }, "children": [ { "label": "Subconcept", "description": "..." } ] }`;
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response);
};

export const generateResearchTitle = async (t: string) => { return "Research Note"; };
export const generateSummaryFromText = async (t: string) => { return await callGroqAPI([{role: "user", content: `Summarize: ${t.slice(0, 2000)}`}]) || ""; };
export const generateQuizFromText = async (t: string) => { return []; };
export const generateInfographicFromText = async (t: string) => { return {root:null,children:[]}; };
export const generatePodcastScriptFromText = async (t: string) => { return []; };
export const chatWithResearchDocument = async (q: string, h: any[], d: string) => { 
    return await callGroqAPI([{role: "system", content: `Context: ${d.slice(0, 3000)}`}, ...h, {role: "user", content: q}]) || ""; 
};

// --- VIDEO GENERATOR FUNCTIONS ---

export const generateVideoPlan = async (topic: string): Promise<VideoSlide[]> => {
    const prompt = `Create a comprehensive, in-depth educational video script about "${topic}" for Class 8 Science.
    Structure it as 10-15 distinct slides to ensure the video is at least 3 minutes long.
    For each slide, provide:
    1. "text": A long, detailed paragraph for the narrator to speak (approx 100-150 words per slide). Explain concepts thoroughly with examples, analogies, and scientific depth. Do not be brief.
    2. "keyword": A highly visual search term to find a stock photo for this specific context.

    Return ONLY a JSON object:
    {
        "slides": [
            { "text": "...", "keyword": "..." },
            ...
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.slides || [];
};

export const fetchStockImage = async (keyword: string): Promise<{ url: string, photographer: string } | null> => {
    const apiKey = await getPexelsApiKey();
    if (!apiKey) return null;

    try {
        const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`, {
            headers: {
                Authorization: apiKey
            }
        });
        
        if (!res.ok) return null;
        
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
            return {
                url: data.photos[0].src.large2x || data.photos[0].src.large,
                photographer: data.photos[0].photographer
            };
        }
    } catch (e) {
        console.error("Pexels fetch error", e);
    }
    return null;
};

export const createVideoProject = async (topic: string): Promise<VideoSlide[]> => {
    const slides = await generateVideoPlan(topic);
    const hydratedSlides = await Promise.all(slides.map(async (slide) => {
        const image = await fetchStockImage(slide.keyword + " science");
        return {
            ...slide,
            imageUrl: image?.url || 'https://images.pexels.com/photos/256381/pexels-photo-256381.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
            photographer: image?.photographer || 'Unknown'
        };
    }));
    return hydratedSlides;
};
