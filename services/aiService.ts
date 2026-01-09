import { supabase } from "./supabaseClient";
import { QuizQuestion, PuzzleWord, ChatSession, MatchingPair, PodcastSegment } from "../types";

// --- CORE GROQ CONFIGURATION ---

// Priority list of models to use. If one fails, the app automatically switches to the next.
const BACKUP_MODELS = [
    "llama-3.3-70b-versatile", // Primary: Highest Intelligence
    "llama-3.1-8b-instant",    // Secondary: Ultra Fast, good for basic chat
    "mixtral-8x7b-32768",      // Tertiary: Reliable Fallback
    "gemma2-9b-it"             // Final Resort
];

let cachedGroqKey: string | null = null;

const getGroqApiKey = async () => {
    if (cachedGroqKey) return cachedGroqKey;
    
    try {
        const { data, error } = await supabase
            .from('app_secrets')
            .select('value')
            .eq('name', 'GROQ_API_KEY')
            .single();
            
        if (error || !data) {
            console.warn("Could not fetch Groq Key from Supabase", error);
            return null;
        }
        
        cachedGroqKey = data.value;
        return cachedGroqKey;
    } catch (e) {
        console.warn("Error accessing Supabase for Groq Key", e);
        return null;
    }
};

/**
 * Core function to communicate with Groq API.
 * Handles JSON mode enforcement, error parsing, and AUTOMATIC RETRIES with FALLBACK MODELS.
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
                
                // If Rate Limited (429), wait briefly and try the next model (which might be on a different shard)
                if (status === 429) {
                    console.warn(`Groq Rate Limit on ${model}. Switching to backup...`);
                    await new Promise(r => setTimeout(r, 1200)); // 1.2s delay
                    continue; // Try next model
                }
                
                // If Server Error (5xx), try next model immediately
                if (status >= 500) {
                    console.warn(`Groq Server Error (${status}) on ${model}. Switching...`);
                    continue;
                }

                // For other errors (400, 401), logging it and trying next just in case it's a model specific issue
                console.warn(`Groq API Error (${status}) on ${model}.`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            
            if (content) return content;
            
            // If content is empty/null, try next model
            console.warn(`Empty response from ${model}`);
            continue;

        } catch (e) {
            console.warn(`Connection Failed for ${model}`, e);
            // Network error, try next model
            continue; 
        }
    }
    
    // If all models failed
    console.error("All AI Models failed to respond.");
    return null;
};

/**
 * Helper to parse JSON safely, handling potential markdown code blocks
 */
const cleanAndParseJSON = (text: string | null): any => {
    if (!text) return null;
    try {
        // Remove ```json and ``` if present
        const cleanText = text.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error", e, text);
        return null;
    }
};

// --- PROMPTS ---

const CLASS_8_SYSTEM_PROMPT = `
You are "Science Buddy", a world-class AI tutor for Class 8 Science students.

CRITICAL MEMORY & CONTEXT RULES:
1. You must ALWAYS treat the provided message history as the absolute truth of our conversation.
2. If the user asks "What did we just talk about?" or "Explain that again", you MUST look at the immediate previous messages in the history to find the context.
3. Do not Hallucinate that you don't have memory. The messages provided in the prompt ARE your memory. Use them.
4. Maintain a consistent thread. If we were talking about cells, and the user asks "How big is it?", assume "it" refers to the cell.

CORE PERSONALITY:
- **Enthusiastic & Encouraging**: You love science. Use emojis 🌟 🚀 🧬.
- **Relatable**: Explain complex concepts using analogies from the student's stated interests.
- **Socratic**: Don't just lecture. Ask questions to check understanding.
- **Curriculum Aligned**: Focus on Class 8 topics.

RESPONSE GUIDELINES:
1. **Visual Formatting**: Use **bold** for vocabulary. Use *italics* for emphasis. Use bullet points for lists.
2. **Analogies**: ALWAYS try to connect the concept to the user's real world or specific interests.
3. **Brevity**: Keep responses concise (under 200 words) unless asked for a deep dive.
4. **Safety**: Encourage safe experiment practices.

If the user context provides a Name and Interests, you MUST incorporate them.
`;

const VOICE_SYSTEM_PROMPT = `
You are "Science Buddy", speaking directly to a Class 8 student via a voice call.
Your goal is to have a natural, friendly, and seamless conversation about science.

CRITICAL MEMORY RULES:
1. Treat this as a continuous conversation. 
2. Remember what we just talked about. If I ask a follow-up question like "Why?", answer it based on the previous statement in the history.
3. Do not repeat introductions if we are already deep in conversation.

CRITICAL VOICE RULES:
1. **NO VISUALS**: Do NOT use emojis, asterisks (*), bold (**), or markdown of any kind. The output is for Text-to-Speech only.
2. **Conversational**: Speak like a human friend. Use fillers occasionally (like "Hmm", "Well") if appropriate, but keep it professional.
3. **Concise**: Keep answers short (2-3 sentences max) to allow for a back-and-forth dialogue.
4. **Engaging**: Always end with a short question to keep the conversation flowing seamlessly.
5. **Personal**: Use the student's Name and Interests frequently.
`;

// --- FEATURES ---

export interface LiveUserContext {
    name?: string | null;
    interests?: string;
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

// Aggregates user activity from multiple tables for real-time context
export const fetchLiveUserStats = async (userId: string) => {
    try {
        const [userRes, quizRes, researchRes, libraryRes, notesRes, allUsersRes] = await Promise.all([
            supabase.from('users').select('total_points').eq('id', userId).single(),
            supabase.from('quiz_progress').select('topic, score').eq('user_id', userId).order('updated_at', {ascending: false}).limit(3),
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
            totalStudents,
            recentQuizScores: quizRes.data || [],
            researchTopics: researchRes.data?.map(r => r.title) || [],
            savedPodTopics: libraryRes.data?.map(l => l.topic) || [],
            communityNotesCount: notesRes.count || 0
        };
    } catch (e) {
        console.error("Error fetching live stats", e);
        return undefined;
    }
};

interface AnalysisData {
    sessions: ChatSession[];
    rank: string | number;
    totalPoints: number;
    totalStudents?: number;
    recentQuizScores: { topic: string, score: number }[];
    researchTopics: string[];
    savedPodTopics: string[];
}

export const analyzeUserProfile = async (data: AnalysisData) => {
    try {
        // Construct rich context
        const chatContext = data.sessions.flatMap(s => s.messages)
            .filter(m => m.role === 'user')
            .slice(-15) // Recent 15 messages
            .map(m => m.text)
            .join('\n');

        // Only proceed if there is SOME activity
        const hasActivity = chatContext || data.recentQuizScores.length > 0 || data.researchTopics.length > 0 || data.savedPodTopics.length > 0;
        
        if (!hasActivity) return { name: null, interests: "General Science, Basics" };

        const systemPrompt = `You are an AI Analyst for an educational app. Return JSON only.`;
        
        const userPrompt = `Analyze this Class 8 student's ENTIRE digital footprint to build a personalization profile.
        
        DATA FOOTPRINT:
        - Global Rank: #${data.rank} out of ${data.totalStudents || '?'} students (XP: ${data.totalPoints})
        - Recent Quiz Scores: ${JSON.stringify(data.recentQuizScores)}
        - Research Projects Created: ${data.researchTopics.join(', ') || 'None'}
        - Saved Study Pods: ${data.savedPodTopics.join(', ') || 'None'}
        - Recent Chat Messages:
        ${chatContext}

        GOAL: Return a concise "interests" string that describes:
        1. Their specific hobbies (e.g. "Loves Minecraft").
        2. Their learning style based on data (e.g. "High rank but low research means they prefer quizzes", "Visual learner", "Struggles with Physics").
        3. Their name (if mentioned in chat).

        Respond ONLY with a JSON object:
        { "name": "Rohan", "interests": "Loves cricket analogies, top scorer in Biology but avoids Physics, enjoys visual study pods." }`;

        const responseText = await callGroqAPI([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ], true);

        const parsed = cleanAndParseJSON(responseText);
        return parsed || { name: null, interests: "General Science" };
    } catch (e) {
        console.error("Profile analysis failed", e);
        return { name: null, interests: "General Science" };
    }
};

export const chatWithAI = async (message: string, history: {role: 'user' | 'model', text: string}[], userContext: LiveUserContext) => {
  let systemInstruction = CLASS_8_SYSTEM_PROMPT;
  const name = userContext.name || "Student";
  const interests = userContext.interests || "General Science";
  
  systemInstruction += `\n\nCURRENT STUDENT PROFILE:\n- Name: ${name}\n- Interests/Context: ${interests}`;

  if (userContext.stats) {
      systemInstruction += `\n\nLIVE DASHBOARD DATA (Real-time):
      - Global Rank: #${userContext.stats.rank} (out of ${userContext.stats.totalStudents} students)
      - Total XP: ${userContext.stats.totalPoints}
      - Recent Quizzes: ${JSON.stringify(userContext.stats.recentQuizScores)}
      - Recent Research: ${userContext.stats.researchTopics.join(', ') || 'None'}
      - Saved Pods: ${userContext.stats.savedPodTopics.join(', ') || 'None'}
      
      INSTRUCTION: Use this live data to personalize. 
      - If they have high XP, praise them as a pro. 
      - If they failed a recent quiz, offer help on that specific topic. 
      - Mention their research topics if relevant.`;
  }
  
  systemInstruction += `\n\nINSTRUCTION: Adapt your language and analogies specifically for ${name} who likes ${interests}.`;

  const messages = [
      { role: "system", content: systemInstruction },
      ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })),
      { role: "user", content: message }
  ];

  const response = await callGroqAPI(messages, false);
  return response || "My brain is buffering... can you try asking that again? 🧠";
};

export const chatWithAIVoice = async (message: string, history: {role: 'user' | 'model', text: string}[], userContext: LiveUserContext) => {
  let systemInstruction = VOICE_SYSTEM_PROMPT;
  const name = userContext.name || "Friend";
  const interests = userContext.interests || "Science";
  
  systemInstruction += `\n\nUSER PROFILE:\n- Name: ${name}\n- Interests: ${interests}`;

  if (userContext.stats) {
    systemInstruction += `\n\nLIVE DATA:
    - Rank: #${userContext.stats.rank} / ${userContext.stats.totalStudents} (XP: ${userContext.stats.totalPoints})
    - Quizzes: ${JSON.stringify(userContext.stats.recentQuizScores)}
    
    INSTRUCTION: If they ask about their performance, use this data. If they struggled on a quiz, encourage them.`;
  }

  const messages = [
      { role: "system", content: systemInstruction },
      ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })),
      { role: "user", content: message }
  ];

  const response = await callGroqAPI(messages, false, 0.9);
  return response || "I'm not sure I heard that correctly.";
};

export const generateTitle = async (message: string): Promise<string> => {
    const prompt = `Summarize this message into a short, 3-5 word title for a chat session. Do not use quotes. Message: "${message}"`;
    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    let title = response?.trim() || message.slice(0, 30);
    // Remove quotes if present
    title = title.replace(/^"|"$/g, '');
    return title;
};

export const generateStudyPodSummary = async (topic: string) => {
    const prompt = `Write a VERY comprehensive, detailed, and engaging summary about "${topic}" for a Class 8 student. 
    The output must be a SINGLE, continuous block of text (no line breaks) of approximately 300-400 words.
    Cover the definition, types, examples, and real-life applications in depth.
    STRICT RULES:
    1. Do NOT use emojis.
    2. Do NOT use markdown formatting like **bold** or *italics*.
    3. Do NOT use bullet points.
    4. Keep it purely text suitable for reading aloud.`;

    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response || "Could not generate summary.";
};

export const generatePodcastScript = async (topic: string): Promise<PodcastSegment[]> => {
    const prompt = `Write a long, engaging podcast script between two hosts explaining the topic: "${topic}".
            
    CHARACTERS:
    - "Host 1": A female science expert (Ms. Rachel). Enthusiastic, knowledgeable, uses clear analogies.
    - "Host 2": A male curious student (Rohan). Asks "stupid" questions, makes jokes, represents the learner.

    TONE: Conversational, fast-paced, funny, and deeply educational. Suitable for Class 8.
    LENGTH: Approximately 12-16 exchanges total (make it a full conversation).
    
    Return ONLY a JSON object with this structure:
    {
        "script": [
            { "speaker": "Host 1", "text": "..." },
            { "speaker": "Host 2", "text": "..." }
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.script || [];
};

export const generateQuizQuestions = async (topic: string, count: number = 5, interests: string = "General", seed?: string): Promise<QuizQuestion[]> => {
    const prompt = `Generate ${count} multiple choice questions for Class 8 Science regarding: "${topic}".
    
    CRITICAL INSTRUCTIONS:
    1. Strictly adhere to NCERT Class 8 Science curriculum.
    2. Personalize the questions slightly based on these interests: "${interests}" (e.g. if they like football, use force/friction examples related to football).
    3. Ensure the questions vary in difficulty.
    4. VARIATION SEED: ${seed || Date.now()} (Use this value to randomize your question selection so you don't repeat previous outputs).
    5. Generate a FRESH, UNIQUE set of questions that are different from common textbook examples if possible.
    
    Return ONLY a JSON object with this structure:
    {
        "questions": [
            {
                "question": "...",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": "The correct option text (Must match one of options exactly)",
                "explanation": "Short explanation of why."
            }
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.questions || [];
};

export const generateStoryNode = async (context: string, choiceMade: string | null, topic?: string): Promise<any> => {
    // If choiceMade is null, it's the start of the story
    const userPrompt = choiceMade 
        ? `Continue the Class 8 Science adventure story. The user chose: "${choiceMade}". Previous context: ${context}. Provide the next story segment and 2-3 new choices.`
        : `Start a "Choose Your Own Adventure" story based on the Class 8 Science topic: "${topic || 'A journey inside a generic animal cell'}". Provide the intro and 2-3 choices.`;

    const systemPrompt = `You are an interactive story engine. Return ONLY a JSON object with this structure:
    {
        "text": "The story narrative segment...",
        "choices": [
            { "text": "Choice 1 text", "nextId": "unique_id_1" },
            { "text": "Choice 2 text", "nextId": "unique_id_2" }
        ],
        "isEnding": boolean
    }`;

    const response = await callGroqAPI([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ], true);

    return cleanAndParseJSON(response);
};

export const rewriteText = async (text: string, style: string) => {
    const prompt = `Rewrite the following scientific text in the style of a ${style}. 
    Make it fun but keep the facts accurate for a Class 8 student. 
    You CAN use **bold** and *italics* for effect.
    
    Text: "${text}"`;

    const response = await callGroqAPI([
        { role: "system", content: CLASS_8_SYSTEM_PROMPT },
        { role: "user", content: prompt }
    ]);
    return response || "Could not rewrite text.";
};

export const generateConceptMapData = async (topic: string) => {
    const prompt = `Create a concept map for the topic: "${topic}" (Class 8 Science). 
    Return ONLY a JSON object with this structure:
    {
        "root": { "label": "Main Topic", "description": "Short desc" },
        "children": [
            { "label": "Subtopic 1", "description": "Short desc" },
            { "label": "Subtopic 2", "description": "Short desc" },
            ... (4-6 total children)
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response);
};

export const generateWordPuzzle = async (topic: string): Promise<PuzzleWord[]> => {
    const prompt = `List 8 key single-word scientific terms related to "${topic}" for Class 8. Provide a short clue for each.
    Return ONLY a JSON object with this structure:
    {
        "words": [
            { "word": "TERM", "clue": "Short hint" }
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    
    if (data?.words) {
        return data.words.map((d: any) => ({...d, found: false}));
    }
    return [];
};

export const generateMatchingPairs = async (topic: string): Promise<MatchingPair[]> => {
    const prompt = `Generate 6 pairs of "Term" and "Definition" related to the topic: "${topic}" for Class 8 Science. The definition should be short (under 10 words).
    Return ONLY a JSON object with this structure:
    {
        "pairs": [
            { "id": "1", "term": "...", "definition": "..." },
            ...
        ]
    }`;

    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.pairs || [];
};

export const generatePerformanceReport = async (userName: string, interests: string, stats: any) => {
    const prompt = `
    You are a Senior Academic Advisor for Class 8 Science. 
    You have analyzed the student's ENTIRE digital footprint on the app.
    
    STUDENT: ${userName}
    INTERESTS: ${interests}
    
    DATA ANALYSIS:
    1. **Rank & XP**: Global Rank #${stats.rank} with ${stats.totalPoints} XP.
    2. **Quiz Mastery**: 
       ${JSON.stringify(stats.topicScores)}
    3. **Research Lab Activity**: 
       ${stats.researchProjects && stats.researchProjects.length > 0 ? `Created ${stats.researchProjects.length} projects: ${stats.researchProjects.map((r:any) => r.title).join(', ')}` : "No research projects yet."}
    4. **Study Pod Library**: 
       ${stats.savedPods && stats.savedPods.length > 0 ? `Saved ${stats.savedPods.length} items (${stats.savedPods.map((s:any) => s.topic).join(', ')}).` : "Library is empty."}
    5. **Community Contribution**: 
       ${stats.communityNotes && stats.communityNotes > 0 ? `Shared ${stats.communityNotes} notes with the community.` : "Has not contributed to community yet."}
    6. **Chat Engagement**: ${stats.totalChats} sessions (${stats.voiceChats} voice).

    TASK:
    Write a hyper-personalized, holistic performance review (approx 200 words).
    - **Connect the dots**: e.g., "I see you researched Black Holes but haven't taken the Light quiz yet." or "You love saving Podcasts about Biology."
    - **Structure**:
      1. **Holistic Overview**: How are they using the app overall?
      2. **Deep Dive 🧠**: Analyze their research/study habits vs their quiz scores.
      3. **Strengths 🌟**: What are they best at?
      4. **Next Steps 🚀**: Specific advice based on what they *haven't* done yet.

    Use Markdown. Be encouraging but highly analytical.
    `;
    return callGroqAPI([{role: 'user', content: prompt}], false);
};

// --- RESEARCH MODE FUNCTIONS ---

export const generateResearchTitle = async (text: string): Promise<string> => {
    // Truncate text if too long to save tokens
    const sample = text.slice(0, 2000);
    const prompt = `Read the following text content and give it a short, catchy scientific title (3-6 words). Do NOT use quotes.
    Content: ${sample}`;
    
    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response?.trim().replace(/^"|"$/g, '') || "Untitled Research";
};

export const generateSummaryFromText = async (text: string): Promise<string> => {
    const sample = text.slice(0, 15000); // Larger window for research
    const prompt = `Summarize the following research text into a clear, structured note for a Class 8 student.
    Use headings, bullet points, and **bold** text. Make it easy to revise.
    
    Text: ${sample}`;
    
    const response = await callGroqAPI([{ role: "user", content: prompt }]);
    return response || "Could not generate summary.";
};

export const generateQuizFromText = async (text: string): Promise<QuizQuestion[]> => {
    const sample = text.slice(0, 8000);
    const prompt = `Based strictly on the provided text, generate 5 multiple choice questions for a Class 8 student.
    Return ONLY a JSON object with this structure:
    {
        "questions": [
            {
                "question": "...",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": "Exact Option Text",
                "explanation": "Why?"
            }
        ]
    }
    
    Text: ${sample}`;
    
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.questions || [];
};

export const generateInfographicFromText = async (text: string): Promise<{root: any, children: any[]}> => {
    const sample = text.slice(0, 5000);
    const prompt = `Analyze this text and create a concept map structure.
    Return ONLY a JSON object:
    {
        "root": { "label": "Main Concept", "description": "Short summary" },
        "children": [
            { "label": "Subconcept 1", "description": "Connection details" },
            { "label": "Subconcept 2", "description": "Connection details" },
            ... (Max 6 children)
        ]
    }
    
    Text: ${sample}`;
    
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    return cleanAndParseJSON(response);
};

export const generatePodcastScriptFromText = async (text: string): Promise<PodcastSegment[]> => {
    const sample = text.slice(0, 8000);
    const prompt = `Create a 2-person podcast script discussing the following text.
    Host 1 (Ms. Rachel): Expert.
    Host 2 (Rohan): Curious Student.
    Make it engaging and educational. Length: ~10 exchanges.
    
    Return JSON:
    {
        "script": [
            { "speaker": "Host 1", "text": "..." },
            ...
        ]
    }
    
    Text: ${sample}`;
    
    const response = await callGroqAPI([{ role: "user", content: prompt }], true);
    const data = cleanAndParseJSON(response);
    return data?.script || [];
};

export const chatWithResearchDocument = async (
    question: string, 
    history: {role: 'user' | 'model', text: string}[], 
    documentText: string
) => {
    // Truncate doc text to avoid token limits (approx 40k chars is safe for Llama 3 on Groq usually)
    const context = documentText.slice(0, 40000); 
    
    const systemPrompt = `You are a research assistant. 
    You have been provided with a document text. 
    Answer the user's question STRICTLY based on the provided document context below.
    If the answer is not in the document, say "I cannot find that information in the document."
    
    DOCUMENT CONTEXT:
    ${context}`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })),
        { role: "user", content: question }
    ];

    return await callGroqAPI(messages, false);
};