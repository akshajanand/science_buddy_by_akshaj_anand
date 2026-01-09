import { supabase } from "./supabaseClient";
import { QuizQuestion, PuzzleWord, ChatSession, MatchingPair, PodcastSegment } from "../types";

// --- CORE GROQ CONFIGURATION ---

const GROQ_MODEL = "llama-3.3-70b-versatile";

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
 * Handles JSON mode enforcement and error parsing.
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

    try {
        const body: any = {
            model: GROQ_MODEL,
            messages: messages,
            temperature: temperature,
            max_tokens: 4096 // Increased for larger payloads
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
            console.warn(`Groq API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;

    } catch (e) {
        console.warn("Groq Connection Failed", e);
        return null;
    }
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

export const analyzeUserProfile = async (sessions: ChatSession[]) => {
    if (!sessions || sessions.length === 0) return { name: null, interests: "General Science, Basics" };

    try {
        const userMessages = sessions.flatMap(s => s.messages)
            .filter(m => m.role === 'user')
            .slice(-20)
            .map(m => m.text)
            .join('\n');

        if (!userMessages) return { name: null, interests: "General Science" };

        const responseText = await callGroqAPI([
            { role: "system", content: "You are an analyzer bot. Return JSON only." },
            { role: "user", content: `Analyze these chat messages from a Class 8 student to build a personalization profile.
            
            GOAL: Return a concise "interests" string that describes:
            1. Their specific hobbies (e.g., "Loves Minecraft", "Plays Football").
            2. Their learning struggle/style (e.g., "Hates formulas", "Needs visual examples").
            3. Their name (if mentioned).

            Respond ONLY with a JSON object in this format:
            { "name": "Rohan", "interests": "Loves cricket analogies, struggles with chemical equations, visual learner." }
            
            Messages:
            ${userMessages}` }
        ], true);

        const data = cleanAndParseJSON(responseText);
        return data || { name: null, interests: "General Science" };
    } catch (e) {
        console.error("Profile analysis failed", e);
        return { name: null, interests: "General Science" };
    }
};

export const chatWithAI = async (message: string, history: {role: 'user' | 'model', text: string}[], userContext: { name?: string | null, interests?: string }) => {
  let systemInstruction = CLASS_8_SYSTEM_PROMPT;
  const name = userContext.name || "Student";
  const interests = userContext.interests || "General Science";
  systemInstruction += `\n\nCURRENT STUDENT PROFILE:\n- Name: ${name}\n- Interests/Context: ${interests}\n\nINSTRUCTION: Adapt your language and analogies specifically for ${name} who likes ${interests}.`;

  const messages = [
      { role: "system", content: systemInstruction },
      ...history.map(h => ({ role: h.role === 'model' ? "assistant" : "user", content: h.text })),
      { role: "user", content: message }
  ];

  const response = await callGroqAPI(messages, false);
  return response || "My brain is buffering... can you try asking that again? 🧠";
};

export const chatWithAIVoice = async (message: string, history: {role: 'user' | 'model', text: string}[], userContext: { name?: string | null, interests?: string }) => {
  let systemInstruction = VOICE_SYSTEM_PROMPT;
  const name = userContext.name || "Friend";
  const interests = userContext.interests || "Science";
  systemInstruction += `\n\nUSER PROFILE:\n- Name: ${name}\n- Interests: ${interests}`;

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

    // For 30 questions, we might hit token limits if we ask for too much verbose detail
    // We increase max_tokens in callGroqAPI for this.
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

export const generatePerformanceReport = async (userName: string, stats: any) => {
    const prompt = `
    You are a Senior Academic Advisor for Class 8 Science. Analyze this student's performance data.

    STUDENT: ${userName}
    
    DATA:
    - Total XP: ${stats.totalPoints}
    - Global Rank: #${stats.rank}
    - Quiz Activity: ${stats.quizzesAttempted} quizzes taken.
    - Topic Mastery: ${JSON.stringify(stats.topicScores)}
    - Chat Engagement: ${stats.totalChats} sessions (${stats.voiceChats} voice).

    TASK:
    Write a brief, personalized performance review (approx 150 words).
    Structure:
    1. **Overall Progress**: A general assessment.
    2. **Strengths 🌟**: What are they doing well?
    3. **Focus Areas 🎯**: Which topics need more work? (Look at low scores).
    4. **Action Plan**: One specific suggestion (e.g. "Try the Study Pod for 'Force and Pressure'").

    Use Markdown. Be encouraging but analytical.
    `;
    return callGroqAPI([{role: 'user', content: prompt}], false);
};