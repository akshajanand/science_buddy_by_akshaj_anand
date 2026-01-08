import { QuizQuestion, PuzzleWord } from "../types";

// Using the provided Groq API Key
const API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-70b-8192"; // High performance model good for logic/JSON

if (!API_KEY) {
  console.warn("Missing Groq API Key.");
}

const CLASS_8_SYSTEM_PROMPT = `
You are a friendly, energetic, and encouraging Class 8 Science Tutor. 
Your goal is to explain concepts simply, use analogies relevant to 13-14 year olds, and make learning fun.
When answering, use formatting like bullet points and bold text for clarity.
Cover topics like Crop Production, Microorganisms, Synthetic Fibres, Metals/Non-metals, Coal/Petroleum, Combustion, Conservation, Cells, Reproduction, Force, Friction, Sound, Chemical Effects of Current, Natural Phenomena, Light, Stars/Solar System, Pollution.
`;

async function callGroq(messages: any[], jsonMode: boolean = false) {
    if (!API_KEY) return null;
    
    try {
        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                model: MODEL,
                temperature: 0.7,
                response_format: { type: jsonMode ? "json_object" : "text" }
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error("Groq API Error:", error);
        return null;
    }
}

export const chatWithAI = async (message: string, history: {role: 'user' | 'model', text: string}[]) => {
    const messages = [
        { role: "system", content: CLASS_8_SYSTEM_PROMPT },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: "user", content: message }
    ];

    const text = await callGroq(messages);
    return text || "Oops! I had a little trouble thinking about that. Can you ask again?";
};

export const generateQuizQuestions = async (topic: string): Promise<QuizQuestion[]> => {
    // Robustness: Asking for a root object "questions" because some JSON modes fail on root arrays
    const prompt = `Generate 5 multiple choice questions for Class 8 Science regarding: "${topic}".
    Return purely valid JSON with this structure:
    {
      "questions": [
          {
            "question": "string",
            "options": ["string", "string", "string", "string"],
            "correctAnswer": "string",
            "explanation": "string"
          }
      ]
    }
    Do not add markdown formatting or explanations outside the JSON.`;

    const text = await callGroq([
        { role: "system", content: "You are a JSON generator." },
        { role: "user", content: prompt }
    ], true);

    if (text) {
        try {
            const data = JSON.parse(text);
            // Handle both potential formats just in case, but prefer the object property
            if (data.questions && Array.isArray(data.questions)) {
                return data.questions as QuizQuestion[];
            }
            if (Array.isArray(data)) {
                return data as QuizQuestion[];
            }
            return [];
        } catch (e) {
            console.error("Failed to parse Quiz JSON", e);
            return [];
        }
    }
    return [];
};

export const generateStoryNode = async (context: string, choiceMade: string | null): Promise<any> => {
    const prompt = choiceMade 
        ? `Continue the Class 8 Science adventure story. The user chose: "${choiceMade}". Previous context: ${context}. 
           Provide the next story segment and 2-3 new choices.
           Return purely valid JSON: { "text": "story segment", "choices": [{"text": "choice 1", "nextId": "id1"}], "isEnding": boolean }`
        : `Start a "Choose Your Own Adventure" story based on a Class 8 Science concept (e.g., traveling inside a cell, being an electron, exploring space). 
           Return purely valid JSON: { "text": "intro text", "choices": [{"text": "choice 1", "nextId": "id1"}], "isEnding": boolean }`;

    const text = await callGroq([
        { role: "system", content: "You are a creative JSON story generator." },
        { role: "user", content: prompt }
    ], true);

    if (text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse Story JSON", e);
            return null;
        }
    }
    return null;
};

export const rewriteText = async (text: string, style: string) => {
    const prompt = `Rewrite the following scientific text in the style of a ${style}. Make it fun but keep the facts accurate for a Class 8 student:\n\n"${text}"`;
    const result = await callGroq([{ role: "system", content: CLASS_8_SYSTEM_PROMPT }, { role: "user", content: prompt }]);
    return result || "Could not rewrite text.";
};

export const generateConceptMapData = async (topic: string) => {
    const prompt = `Create a concept map for the topic: "${topic}" (Class 8 Science). 
    Return purely valid JSON:
    {
      "root": { "label": "string", "description": "string" },
      "children": [ { "label": "string", "description": "string" } ]
    }`;

    const text = await callGroq([
        { role: "system", content: "You are a JSON generator." },
        { role: "user", content: prompt }
    ], true);

    if (text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse Concept Map JSON", e);
            return null;
        }
    }
    return null;
};

export const generateWordPuzzle = async (topic: string): Promise<PuzzleWord[]> => {
    // Robustness: Asking for a root object "words"
    const prompt = `List 8 key single-word scientific terms related to "${topic}" for Class 8. Provide a short clue for each.
    Return purely valid JSON: { "words": [ { "word": "string", "clue": "string" } ] }`;

    const text = await callGroq([
        { role: "system", content: "You are a JSON generator." },
        { role: "user", content: prompt }
    ], true);

    if (text) {
        try {
             const data = JSON.parse(text);
             let items: {word: string, clue: string}[] = [];
             
             if (data.words && Array.isArray(data.words)) {
                 items = data.words;
             } else if (Array.isArray(data)) {
                 items = data;
             }

             return items.map(d => ({...d, found: false}));
        } catch (e) {
            console.error("Failed to parse Puzzle JSON", e);
            return [];
        }
    }
    return [];
};