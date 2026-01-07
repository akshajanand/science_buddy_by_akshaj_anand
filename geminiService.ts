import { GoogleGenAI, Modality, Type } from "@google/genai";
import { QuizQuestion, PuzzleWord } from "../types";

// The API key must be obtained exclusively from the environment variable process.env.API_KEY.
// Assume this variable is pre-configured, valid, and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const CLASS_8_SYSTEM_PROMPT = `
You are a friendly, energetic, and encouraging Class 8 Science Tutor. 
Your goal is to explain concepts simply, use analogies relevant to 13-14 year olds, and make learning fun.
When answering, use formatting like bullet points and bold text for clarity.
Cover topics like Crop Production, Microorganisms, Synthetic Fibres, Metals/Non-metals, Coal/Petroleum, Combustion, Conservation, Cells, Reproduction, Force, Friction, Sound, Chemical Effects of Current, Natural Phenomena, Light, Stars/Solar System, Pollution.
`;

export const chatWithGemini = async (message: string, history: {role: 'user' | 'model', text: string}[]) => {
  try {
    const formattedHistory = history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      history: formattedHistory,
      config: {
        systemInstruction: CLASS_8_SYSTEM_PROMPT,
      },
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "Oops! I had a little trouble thinking about that. Can you ask again?";
  }
};

export const generateQuizQuestions = async (topic: string): Promise<QuizQuestion[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Generate 5 multiple choice questions for Class 8 Science regarding: ${topic}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.STRING },
                            explanation: { type: Type.STRING }
                        },
                        required: ["question", "options", "correctAnswer", "explanation"]
                    }
                }
            }
        });
        
        if (response.text) {
             return JSON.parse(response.text) as QuizQuestion[];
        }
        return [];
    } catch (e) {
        console.error("Quiz gen error", e);
        return [];
    }
}

export const generateStoryNode = async (context: string, choiceMade: string | null): Promise<any> => {
     try {
        const prompt = choiceMade 
            ? `Continue the Class 8 Science adventure story. The user chose: "${choiceMade}". Previous context: ${context}. Provide the next story segment and 2-3 new choices.`
            : `Start a "Choose Your Own Adventure" story based on a Class 8 Science concept (e.g., traveling inside a cell, being an electron, exploring space). Provide the intro and 2-3 choices.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "The story narrative segment." },
                        choices: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING, description: "The choice text shown to user" },
                                    nextId: { type: Type.STRING, description: "A unique short ID for this choice path" }
                                }
                            }
                        },
                        isEnding: { type: Type.BOOLEAN }
                    }
                }
            }
        });
         if (response.text) return JSON.parse(response.text);
         return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const rewriteText = async (text: string, style: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Rewrite the following scientific text in the style of a ${style}. Make it fun but keep the facts accurate for a Class 8 student:\n\n"${text}"`,
        });
        return response.text || "Could not rewrite text.";
    } catch (e) {
        return "Error transforming text.";
    }
}

export const generateConceptMapData = async (topic: string) => {
    try {
         const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a concept map for the topic: "${topic}" (Class 8 Science). Return a central node and 4-6 related child nodes with brief descriptions.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                         root: {
                             type: Type.OBJECT,
                             properties: {
                                 label: { type: Type.STRING },
                                 description: { type: Type.STRING }
                             }
                         },
                         children: {
                             type: Type.ARRAY,
                             items: {
                                 type: Type.OBJECT,
                                 properties: {
                                     label: { type: Type.STRING },
                                     description: { type: Type.STRING }
                                 }
                             }
                         }
                    }
                }
            }
        });
        if(response.text) return JSON.parse(response.text);
        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export const generateSpeech = async (text: string, voiceName: 'Puck' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Charon' = 'Puck') => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (e) {
        console.error("TTS Error", e);
        return null;
    }
}

export const generateWordPuzzle = async (topic: string): Promise<PuzzleWord[]> => {
     try {
         const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `List 8 key single-word scientific terms related to "${topic}" for Class 8. Provide a short clue for each.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            word: { type: Type.STRING },
                            clue: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        if(response.text) {
             const data = JSON.parse(response.text) as {word: string, clue: string}[];
             return data.map(d => ({...d, found: false}));
        }
        return [];
    } catch (e) { return [] }
}