
import { supabase } from "./supabaseClient";
import { QuizQuestion, PuzzleWord, ChatSession, MatchingPair, PodcastSegment, VideoSlide } from "../types";
import { showToast } from "../utils/notificationUtils";

// --- CORE GROQ CONFIGURATION ---

// Priority list of models to use. If one fails, the app automatically switches to the next.
const BACKUP_MODELS = [
    "llama-3.3-70b-versatile", // Primary: Highest Intelligence
    "llama-3.1-8b-instant",    // Secondary: Ultra Fast
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
export const callGroqAPI = async (
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
        // Remove markdown code blocks if present
        let cleanText = text.replace(/```json\n?|```/g, "").trim();
        
        // Robustness: Extract JSON object if text contains it but has prologue/epilogue
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
};

// --- XP SYSTEM ---

export const checkAndAwardDailyXP = async (userId: string, amount: number, activityName: string) => {
    try {
        await supabase.rpc('increment_score', { row_id: userId, points: amount });
        showToast(`+${amount} XP! ${activityName} 🌟`, 'success');
        const event = new CustomEvent('science-buddy-points-update', { detail: amount });
        window.dispatchEvent(event);
    } catch (e) {
        console.error("XP Error", e);
    }
};

// --- PROMPTS & FEATURES ---

const NCERT_SYSTEM_PROMPT = `
You are "Science Buddy", a friendly and personalized AI tutor strictly for CBSE/NCERT Science students (Classes 6, 7, and 8).

*** STRICT CONTENT BOUNDARIES ***
1. **Source Material**: You must ONLY refer to the NCERT Science Textbooks. Do not introduce concepts, formulas, or terminology from higher grades (9-12) or college level.
2. **Difficulty Level**: Keep explanations simple, concrete, and age-appropriate.
   - For Class 6: Very basic, observational, fun.
   - For Class 7: slightly more detailed but simple terms.
   - For Class 8: Conceptual but strictly within the syllabus.
3. **Tone**: Enthusiastic, Relatable, Socratic (ask questions to guide them), and Encouraging. Use emojis 🌟.
4. **No Hallucinations**: If a topic is not in the NCERT book, politely say it's advanced and explain the basic version found in their book.
`;

const VOICE_SYSTEM_PROMPT = `
You are "Science Buddy", speaking directly to a middle school student (Class 6-8) via a voice call.
RULES:
1. **NO VISUALS**: Output is for Text-to-Speech only.
2. **Conversational**: Speak like a human friend.
3. **Simple Language**: Use simple English. Avoid complex jargon unless it's a key NCERT definition.
4. **Concise**: Short answers (1-2 sentences max unless explained).
`;

export interface LiveUserContext {
    name?: string | null;
    interests?: string;
    customBehavior?: string; 
    classLevel?: string;
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
            supabase.from('users').select('total_points, custom_ai_behavior, class_level').eq('id', userId).single(),
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
            classLevel: userRes.data?.class_level || "8",
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
  let systemInstruction = NCERT_SYSTEM_PROMPT;
  const name = userContext.name || "Student";
  const interests = userContext.interests || "General Science";
  const grade = userContext.classLevel || "8";
  
  systemInstruction += `\n\nCURRENT STUDENT CONTEXT:\n- Class: ${grade} (Strictly adhere to this grade's NCERT level)\n- Name: ${name}\n- Interests: ${interests}`;

  if (userContext.stats) {
      systemInstruction += `\n- Recent Activity: ${JSON.stringify(userContext.stats.recentQuizScores)}`;
  }

  if (userContext.customBehavior) systemInstruction += `\n\nUSER CUSTOM INSTRUCTION: "${userContext.customBehavior}"`;

  const messages = [{ role: "system", content: systemInstruction }, ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })), { role: "user", content: message }];
  const response = await callGroqAPI(messages, false);
  return response || "My brain is buffering...";
};

export const chatWithAIVoice = async (message: string, history: any[], userContext: LiveUserContext) => {
  let systemInstruction = VOICE_SYSTEM_PROMPT;
  if (userContext.name) systemInstruction += `\nUser Name: ${userContext.name}`;
  if (userContext.classLevel) systemInstruction += `\nStudent Class: ${userContext.classLevel} (Keep explanations simple and NCERT aligned).`;

  const messages = [{ role: "system", content: systemInstruction }, ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })), { role: "user", content: message }];
  const response = await callGroqAPI(messages, false, 0.9);
  return response || "I'm not sure I heard that correctly.";
};

export const generateTitle = async (message: string) => {
    const prompt = `Summarize this message into a 3-5 word title: "${message}"`;
    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response?.replace(/"/g, '').trim();
};

export const generateStoryNode = async (history: string, choice: string | null | undefined, topic?: string, classLevel: string = '8') => {
    const prompt = `
    Interactive Science Story for Class ${classLevel}.
    STRICT CONSTRAINT: Use ONLY concepts from NCERT Class ${classLevel} Science Textbook.
    Topic: ${topic || 'Continuing the story'}.
    History: ${history}
    User Choice: ${choice || 'Start'}
    
    Output JSON:
    {
        "text": "Story segment (max 100 words)...",
        "choices": [ {"text": "Option 1"}, {"text": "Option 2"} ],
        "isEnding": false
    }
    `;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res);
};

export const rewriteText = async (text: string, style: string, classLevel: string = '8') => {
    const prompt = `Rewrite the following text in the style of ${style}. Keep it simple and understandable for a Class ${classLevel} student (NCERT Level):\n\n"${text}"`;
    return await callGroqAPI([{ role: "user", content: prompt }]) || "Failed to rewrite.";
};

export const generateConceptMapData = async (topic: string, classLevel: string = '8') => {
    const prompt = `Generate a simple concept map for "${topic}" in JSON format. 
    Use ONLY terms found in NCERT Class ${classLevel} Science textbooks. Do not use high school terms.
    OUTPUT JSON: { "root": {"label": "${topic}", "description": "short desc"}, "children": [{"label": "Subconcept", "description": "desc"}] }`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res);
};

export const generateMatchingPairs = async (topic: string, classLevel: string = '8'): Promise<MatchingPair[]> => {
    const prompt = `Generate 6 matching pairs (term and definition) for topic: ${topic}. 
    STRICTLY NCERT Class ${classLevel} LEVEL. No advanced definitions.
    OUTPUT JSON: { "pairs": [{ "id": "1", "term": "...", "definition": "..." }] }`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res)?.pairs || [];
};

export const generateStudyPodSummary = async (topic: string, classLevel: string = '8') => {
    const prompt = `Write a concise, engaging audio summary script about ${topic} for a Class ${classLevel} student based on NCERT. Max 150 words. Use simple language.`;
    return await callGroqAPI([{ role: "user", content: prompt }]) || "";
};

export const generatePodcastScript = async (topic: string, classLevel: string = '8'): Promise<PodcastSegment[]> => {
    const prompt = `Create a 2-person podcast script about ${topic}. Host 1 is Ms. Rachel (Teacher), Host 2 is Rohan (Student). 
    Keep the content strictly within NCERT Class ${classLevel} science level.
    OUTPUT JSON: { "script": [ {"speaker": "Host 1", "text": "..."}, {"speaker": "Host 2", "text": "..."} ] }`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res)?.script || [];
};

// FIXED QUIZ GENERATION TO ENSURE ROBUST JSON AND CORRECT ANSWERS
export const generateQuizQuestions = async (topic: string, count: number, interests: string, classLevel: string = '8', seed?: string): Promise<QuizQuestion[]> => {
    const prompt = `
    Role: Expert NCERT Science Teacher for Class ${classLevel}.
    Task: Create ${count} multiple-choice questions on "${topic}".
    Constraint: Strictly adhere to Class ${classLevel} NCERT syllabus. No advanced concepts.
    User Interest: ${interests}.
    
    Output Format: RAW JSON Object ONLY. No Markdown code blocks. No intro text.
    
    CRITICAL SCHEMA RULES:
    1. "options" must contain 4 distinct strings.
    2. "correctAnswer" MUST BE AN EXACT COPY of one of the strings in "options". 
       (e.g., if options is ["A", "B"], correctAnswer must be "A", not the index 0).
    
    JSON Structure:
    {
      "questions": [
        {
          "question": "Clear question text?",
          "options": ["Option 1 Text", "Option 2 Text", "Option 3 Text", "Option 4 Text"],
          "correctAnswer": "Option 2 Text", 
          "explanation": "Brief explanation."
        }
      ]
    }
    `;
    
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(res);
    return data?.questions || [];
};

export const generateWordPuzzle = async (topic: string, classLevel: string = '8'): Promise<PuzzleWord[]> => {
    const prompt = `Generate 8 scientific terms related to ${topic} for a word search. Use only terms found in NCERT Class ${classLevel} textbooks. 
    OUTPUT JSON: { "words": [ {"word": "ATOM", "clue": "Basic unit of matter"} ] }`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res)?.words || [];
};

export const generateResearchTitle = async (text: string) => {
    const prompt = `Generate a short title for this research note (max 5 words): ${text.substring(0, 500)}`;
    return await callGroqAPI([{ role: "user", content: prompt }]) || "New Research";
};

export const generateSummaryFromText = async (text: string, classLevel: string = '8') => {
    const prompt = `Summarize this text in bullet points suitable for a Class ${classLevel} student. Simple words, NCERT level: ${text.substring(0, 5000)}`;
    return await callGroqAPI([{ role: "user", content: prompt }]) || "Summary unavailable.";
};

export const generateQuizFromText = async (text: string, classLevel: string = '8') => {
    const prompt = `Generate 5 simple quiz questions based on this text. Level: Class ${classLevel}. JSON format: { "questions": [...] }. Text: ${text.substring(0, 5000)}`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res)?.questions || [];
};

export const generatePodcastScriptFromText = async (text: string, classLevel: string = '8') => {
    const prompt = `Convert this text into a simple dialogue script between a Teacher and Student (Class ${classLevel} level). JSON format: { "script": [...] }. Text: ${text.substring(0, 5000)}`;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(res)?.script || [];
};

export const checkContentSafety = async (text: string) => {
    // 1. Quick local keyword check (Fail-fast)
    const badWords = ['hate', 'kill', 'stupid', 'idiot', 'shut up', 'dumb', 'sex', 'porn', 'drug', 'suicide', 'die']; 
    if (badWords.some(w => text.toLowerCase().includes(w))) {
        return { safe: false, reason: "Contains flagged keywords." };
    }

    // 2. AI Moderation Check
    const prompt = `
    Act as a strict Content Moderator for a Class 6-8 Science App.
    Analyze the text below for safety.
    
    TEXT: "${text.substring(0, 500)}"
    
    RULES:
    - BLOCK: Bullying, hate speech, sexual content, violence, self-harm, insults.
    - ALLOW: Scientific discussions (e.g. "reproduction", "acids burn", "killing bacteria").
    - ALLOW: Helpful feedback.
    
    RESPONSE FORMAT (JSON ONLY):
    {
        "safe": boolean,
        "reason": "Short reason if unsafe"
    }
    `;

    try {
        const response = await callGroqAPI([{ role: "user", content: prompt }], true, 0.1); 
        const result = cleanAndParseJSON(response);
        
        if (result && typeof result.safe === 'boolean') {
            return {
                safe: result.safe,
                reason: result.reason || "Content flagged by AI moderator."
            };
        }
    } catch (e) {
        console.error("Moderation API failed", e);
    }

    return { safe: true };
};

export const generatePerformanceReport = async (username: string, interests: string, stats: any) => {
    const prompt = `
    Generate a motivational performance report for student ${username} (Interests: ${interests}).
    Stats: ${JSON.stringify(stats)}.
    Keep it under 200 words. Focus on their progress in their Science class.
    `;
    return await callGroqAPI([{ role: "user", content: prompt }]) || "Analysis unavailable.";
};

export const createVideoProject = async (topic: string, classLevel: string = '8'): Promise<VideoSlide[]> => {
    const prompt = `
    Create a 5-slide video script for "${topic}".
    Level: NCERT Class ${classLevel} Science.
    For each slide, provide:
    1. 'text': The narration script (max 30 words, simple language for Class ${classLevel}).
    2. 'keyword': A single visual keyword to search for an image (e.g. "volcano", "microscope").
    
    JSON Format: { "slides": [ {"text": "...", "keyword": "..."} ] }
    `;
    const res = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(res)?.slides || [];

    // Fetch images from Pexels for each slide
    const pexelsKey = await getPexelsApiKey();
    if (pexelsKey) {
        for (let slide of data) {
            try {
                const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${slide.keyword}&per_page=1`, {
                    headers: { Authorization: pexelsKey }
                });
                const pexelsData = await pexelsRes.json();
                if (pexelsData.photos && pexelsData.photos.length > 0) {
                    slide.imageUrl = pexelsData.photos[0].src.large;
                    slide.photographer = pexelsData.photos[0].photographer;
                }
            } catch (e) { console.error("Pexels error", e); }
        }
    }
    
    return data;
};
