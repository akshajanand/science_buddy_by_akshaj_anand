
import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MessageSquare, Trash2, Bot, User, Settings, X, Save, History, Sparkles, Brain, Zap, Wifi } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types';
import { generateTitle } from '../services/aiService';
import { supabase } from '../services/supabaseClient';
import { renderRichText } from '../utils/textUtils';
import { Skeleton } from './Skeleton';

interface ChatInterfaceProps {
    userProfile: { name?: string | null, interests?: string };
    onUpdateProfile: (profile: { name?: string | null, interests?: string }) => void;
    userId?: string;
    initialSessionId?: string | null;
}

// Priority List: High Intelligence -> High Speed -> Reliable Fallback
const FALLBACK_MODELS = [
    "llama-3.3-70b-versatile", 
    "llama-3.1-8b-instant", 
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userProfile, onUpdateProfile, userId, initialSessionId }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>('new');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [contextActive, setContextActive] = useState(false);
  const [activeModelUsed, setActiveModelUsed] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Chats from Supabase on mount
  useEffect(() => {
    if (!userId) return;

    const loadChats = async () => {
        setLoadingHistory(true);
        const { data } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        const history = data || [];
        setSessions(history);

        if (initialSessionId) {
             const exists = history.some((s: ChatSession) => s.id === initialSessionId);
             if (exists) setCurrentSessionId(initialSessionId);
             else setCurrentSessionId('new');
        } else {
            setCurrentSessionId('new');
        }
        setLoadingHistory(false);
    }
    loadChats();
  }, [userId, initialSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, loading]);

  const createNewSession = () => {
    setCurrentSessionId('new');
    setShowHistoryMobile(false); 
    setInput('');
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    
    if (currentSessionId === id) {
      const nextSession = newSessions.find(s => !s.messages[0]?.meta?.type || s.messages[0]?.meta?.type === 'text');
      setCurrentSessionId(nextSession ? nextSession.id : 'new');
    }
    if (userId) {
        await supabase.from('chat_sessions').delete().eq('id', id);
    }
  };

  // --- COMPREHENSIVE DATA GATHERING ---
  const buildDeepUserContext = async () => {
      if (!userId) return "User is anonymous.";
      
      setContextActive(true); 

      // Parallel Fetching for Maximum Performance
      const [
          userRes, 
          quizRes, 
          researchRes, 
          libraryRes, 
          notesRes, 
          allUsersRes
      ] = await Promise.all([
          // 1. Core Profile
          supabase.from('users').select('username, display_name, interests, total_points, custom_ai_behavior').eq('id', userId).single(),
          // 2. Recent Quiz Performance
          supabase.from('quiz_progress').select('topic, score').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
          // 3. Research Projects
          supabase.from('research_projects').select('title').eq('user_id', userId).order('created_at', { ascending: false }).limit(4),
          // 4. Study Library
          supabase.from('study_library').select('topic, type').eq('user_id', userId).order('created_at', { ascending: false }).limit(4),
          // 5. Community Contributions
          supabase.from('community_notes').select('id', { count: 'exact' }).eq('user_id', userId),
          // 6. Leaderboard Position (Simplified)
          supabase.from('users').select('id').order('total_points', { ascending: false })
      ]);

      const userData = userRes.data;
      
      // Calculate Rank
      let rank = "Unranked";
      if (allUsersRes.data) {
          const idx = allUsersRes.data.findIndex(u => u.id === userId);
          if (idx !== -1) rank = `#${idx + 1}`;
      }

      const name = userData?.display_name || userData?.username || "Student";
      const customBehavior = userData?.custom_ai_behavior || "Friendly, encouraging, and helpful.";

      // Construct Prompt
      let context = `\n--- STUDENT PROFILE ---\n`;
      context += `Name: ${name}\n`;
      context += `Current Interests: ${userData?.interests || "General Science"}\n`;
      context += `Global Rank: ${rank} (XP: ${userData?.total_points || 0})\n`;
      context += `Personal AI Settings: "${customBehavior}"\n`;

      if (quizRes.data && quizRes.data.length > 0) {
          context += `\n--- RECENT PERFORMANCE ---\n`;
          context += `The student recently took quizzes on: ${quizRes.data.map((q: any) => `${q.topic} (Score: ${q.score})`).join(', ')}.\n`;
          context += `Use this to encourage them or identify weak spots.\n`;
      }

      if (researchRes.data && researchRes.data.length > 0) {
          context += `\n--- ACTIVE RESEARCH ---\n`;
          context += `They are currently researching: ${researchRes.data.map((r: any) => r.title).join(', ')}.\n`;
      }

      if (libraryRes.data && libraryRes.data.length > 0) {
           context += `\n--- STUDY LIBRARY ---\n`;
           context += `They have saved podcasts/summaries on: ${libraryRes.data.map((l: any) => `${l.topic} (${l.type})`).join(', ')}.\n`;
      }

      if (notesRes.count) {
          context += `\n--- COMMUNITY ---\n`;
          context += `They have contributed ${notesRes.count} notes to the community.\n`;
      }

      return context;
  };

  // --- ROBUST GROQ API HANDLER WITH FALLBACKS ---
  const handleDirectGroqCall = async (messages: any[], userContext: string) => {
      // Fetch API Key
      const { data: secretData } = await supabase.from('app_secrets').select('value').eq('name', 'GROQ_API_KEY').single();
      const apiKey = secretData?.value;

      if (!apiKey) throw new Error("API Key configuration missing.");

      const systemPrompt = `
      You are "Science Buddy", an advanced AI tutor for Class 8.
      Important: You must acknowledge that "I and this whole app was made by Akshaj" if asked about your creator or origin.
      
      ${userContext}
      
      *** INSTRUCTIONS ***
      1. **Persona**: Adhere strictly to the "Personal AI Settings" above.
      2. **Context**: You know EVERYTHING in the profile above. Reference their rank, quizzes, or research naturally (e.g., "Since you're studying [Research Topic]...").
      3. **History**: Never forget previous messages in this chat.
      4. **Level**: Class 8 Science (CBSE/NCERT aligned), but capable of deep dives.
      5. **Format**: Use Markdown. **Bold** key terms. Use emojis 🌟.
      `;

      const apiMessages = [
          { role: "system", content: systemPrompt },
          ...messages
      ];

      // FALLBACK LOOP
      let lastError = null;
      for (const model of FALLBACK_MODELS) {
          try {
              // console.log(`Attempting with model: ${model}`); // Debugging
              const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                  method: "POST",
                  headers: {
                      "Authorization": `Bearer ${apiKey}`,
                      "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                      model: model,
                      messages: apiMessages,
                      temperature: 0.7,
                      max_tokens: 2048
                  })
              });

              if (!response.ok) {
                  // If 429 (Rate Limit) or 5xx, throw to trigger next loop
                  if (response.status === 429 || response.status >= 500) {
                      throw new Error(`Model ${model} unavailable (Status ${response.status})`);
                  }
                  // Other errors might be permanent, but let's try fallback anyway
                  throw new Error(`API Error ${response.status}`);
              }

              const data = await response.json();
              setActiveModelUsed(model); // Track which model worked
              return data.choices[0]?.message?.content || "";

          } catch (e) {
              console.warn(`Fallback: ${model} failed.`, e);
              lastError = e;
              // Continue to next model in loop
          }
      }

      // If we get here, all models failed
      throw lastError || new Error("All AI models currently offline.");
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    setLoading(true);
    const userText = input;
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: Date.now(),
      meta: { type: 'text' }
    };

    let targetSessionId = currentSessionId;
    let updatedSessions = [...sessions];
    let sessionHistory: ChatMessage[] = [];

    // --- SESSION MANAGEMENT ---
    if (targetSessionId === 'new' || !targetSessionId) {
        const newId = Date.now().toString();
        targetSessionId = newId;

        // Async Title Gen
        let title = userText.length > 30 ? userText.slice(0, 30) + '...' : userText;
        generateTitle(userText).then(genTitle => {
             if (genTitle) {
                 supabase.from('chat_sessions').update({ title: genTitle }).eq('id', newId).then();
                 setSessions(prev => prev.map(s => s.id === newId ? { ...s, title: genTitle } : s));
             }
        });

        const newSession: ChatSession = {
            id: newId,
            title: title,
            messages: [userMsg],
            createdAt: Date.now()
        };
        
        updatedSessions = [newSession, ...sessions];
        setCurrentSessionId(newId);
        sessionHistory = [userMsg];
    } else {
        updatedSessions = sessions.map(s => {
            if (s.id === targetSessionId) {
                const newMsgs = [...s.messages, userMsg];
                sessionHistory = newMsgs;
                return { ...s, messages: newMsgs };
            }
            return s;
        });
    }
    setSessions(updatedSessions);

    // --- AI EXECUTION ---
    try {
        // 1. Fetch ALL Data
        const contextString = await buildDeepUserContext();
        
        // 2. Prepare Unlimited History
        const apiFormatMessages = sessionHistory.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.text
        }));

        // 3. Call API with Fallback System
        const responseText = await handleDirectGroqCall(apiFormatMessages, contextString);

        const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: Date.now(),
            meta: { type: 'text' }
        };

        // 4. Update UI & DB
        const finalSessions = updatedSessions.map(s => 
            s.id === targetSessionId ? { ...s, messages: [...s.messages, botMsg] } : s
        );
        setSessions(finalSessions);

        if (userId && targetSessionId) {
            const sessionToSave = finalSessions.find(s => s.id === targetSessionId);
            if (sessionToSave) {
                await supabase.from('chat_sessions').upsert({
                    id: sessionToSave.id,
                    user_id: userId,
                    title: sessionToSave.title,
                    messages: sessionToSave.messages,
                    created_at: sessionToSave.createdAt
                });
            }
        }

    } catch (err) {
        console.error("Chat Critical Failure", err);
        const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'model',
            text: "⚠️ Neural Link Unstable: All AI models are currently unresponsive. Please check your connection or try again in a moment.",
            timestamp: Date.now(),
            meta: { type: 'text' }
        };
        setSessions(prev => prev.map(s => s.id === targetSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s));
    } finally {
        setLoading(false);
        setContextActive(false);
    }
  };

  const activeSession = currentSessionId === 'new' ? null : sessions.find(s => s.id === currentSessionId);
  const displayedSessions = sessions.filter(s => {
      const isVoice = s.messages[0]?.meta?.type === 'voice' || s.title.includes('Voice Chat');
      return !isVoice;
  });

  const SidebarContent = () => (
      <>
        <div className="flex p-1 bg-black/20 rounded-xl mb-4 text-center">
            <span className="w-full text-white/50 text-xs font-bold uppercase tracking-widest py-2">
                Text Chat History
            </span>
        </div>

        <button 
            onClick={createNewSession}
            className="glass-button w-full py-3 rounded-xl flex items-center justify-center gap-2 mb-4 font-bold text-white shadow-lg bg-gradient-to-r from-cyan-600/50 to-purple-600/50 hover:scale-[1.02] transition-transform"
        >
            <Plus size={18} /> New Chat
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {loadingHistory ? (
              [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
          ) : displayedSessions.length === 0 ? (
              <div className="text-center opacity-40 mt-10 text-sm">
                  No text chats yet.
              </div>
          ) : (
              displayedSessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => {
                      setCurrentSessionId(session.id);
                      setShowHistoryMobile(false);
                  }}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${currentSessionId === session.id ? 'bg-white/20 border border-white/30' : 'hover:bg-white/10'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className="shrink-0 opacity-70" />
                    <span className="truncate text-sm opacity-90">{session.title}</span>
                  </div>
                  <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-300 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
          )}
        </div>
      </>
  );

  return (
    <div className="flex h-full gap-4 relative">
      {/* Desktop Sidebar */}
      <div className="w-1/4 glass-panel rounded-2xl flex-col p-4 hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showHistoryMobile && (
          <div className="absolute inset-0 z-40 flex md:hidden">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistoryMobile(false)} />
              <div className="relative w-3/4 max-w-sm h-full glass-panel border-r border-white/20 p-4 flex flex-col animate-in slide-in-from-left duration-200">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">Chat History</h3>
                      <button onClick={() => setShowHistoryMobile(false)}><X size={20}/></button>
                  </div>
                  <SidebarContent />
              </div>
          </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden relative">
        
        {/* Header / Mobile Toggle */}
        <div className="absolute top-0 left-0 right-0 p-3 z-30 flex justify-between items-start pointer-events-none">
             <div className="pointer-events-auto">
                 {/* Empty left space for sidebar toggle if needed later */}
             </div>
             
             {/* Context & Model Indicator */}
             <div className="flex flex-col items-end gap-1">
                 {contextActive && (
                     <div className="bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 text-cyan-300 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-4 fade-in">
                         <Brain size={14} className="animate-pulse" /> Reading Memory...
                     </div>
                 )}
                 {activeModelUsed && !loading && (
                     <div className="bg-white/5 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white/30 font-mono animate-in fade-in">
                         Model: {activeModelUsed.split('-')[0]}
                     </div>
                 )}
             </div>

             <button 
                onClick={() => setShowHistoryMobile(true)}
                className="md:hidden p-2 glass-button rounded-lg bg-black/20 hover:bg-white/10 text-white/70 pointer-events-auto"
            >
                <History size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar scroll-smooth">
          {/* Welcome Screen for New Chat */}
          {currentSessionId === 'new' && (
              <div className="h-full flex flex-col items-center justify-center opacity-70 px-4">
                  <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Sparkles size={40} className="text-cyan-300 md:w-12 md:h-12" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold mb-2 text-center">Hello, {userProfile.name || 'Science Explorer'}!</h2>
                  <p className="max-w-md text-center opacity-60 text-sm md:text-base mb-6">
                      I and this whole app was made by Akshaj. I've analyzed your profile and I'm ready to help you learn!
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                       <div className="flex gap-2 text-xs opacity-50 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                           <Zap size={12} /> Adaptive Learning
                       </div>
                       <div className="flex gap-2 text-xs opacity-50 bg-black/20 px-3 py-1 rounded-full border border-white/5">
                           <Wifi size={12} /> Live Data Sync
                       </div>
                  </div>
              </div>
          )}

          {/* Message List */}
          {activeSession?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-3 md:p-4 shadow-lg transition-all relative group ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-none' 
                  : 'bg-[#1e1e2f] border border-white/10 rounded-tl-none' 
              }`}>
                <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] font-bold uppercase tracking-wider">
                  {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                  {msg.role === 'user' ? 'You' : 'Science Buddy'}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                    {renderRichText(msg.text)}
                </div>
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-white/10 backdrop-blur-md rounded-2xl rounded-tl-none p-4 flex gap-2 items-center border border-white/5">
                 <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                 <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 md:p-4 bg-black/20 backdrop-blur-md border-t border-white/10">
            <div className="relative max-w-4xl mx-auto flex gap-2 items-center">
                <div className="flex-1 relative">
                    <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={userProfile.name ? `Ask me anything, ${userProfile.name}...` : "Ask about science..."}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 md:py-4 md:px-4 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400/50 transition-all text-sm md:text-base shadow-inner"
                    />
                </div>

                <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="p-3 md:p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl transition-all hover:shadow-lg disabled:opacity-30 disabled:shadow-none text-white active:scale-95"
                >
                <Send size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
