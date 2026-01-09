import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MessageSquare, Trash2, Bot, User, Settings, X, Save, History, Sparkles } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types';
import { chatWithAI, generateTitle } from '../services/aiService';
import { supabase } from '../services/supabaseClient';
import { renderRichText } from '../utils/textUtils';

interface ChatInterfaceProps {
    userProfile: { name?: string | null, interests?: string };
    onUpdateProfile: (profile: { name?: string | null, interests?: string }) => void;
    userId?: string;
    initialSessionId?: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ userProfile, onUpdateProfile, userId, initialSessionId }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  // currentSessionId can be a real ID, or 'new' for a draft session
  const [currentSessionId, setCurrentSessionId] = useState<string | null>('new');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  
  // Settings Form State
  const [tempName, setTempName] = useState(userProfile.name || '');
  const [tempInterests, setTempInterests] = useState(userProfile.interests || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Chats from Supabase on mount
  useEffect(() => {
    if (!userId) return;

    const loadChats = async () => {
        const { data } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        
        const history = data || [];
        setSessions(history);

        // If we have an initial session passed from Dashboard, load it.
        // Otherwise default to new.
        if (initialSessionId) {
             const exists = history.some((s: ChatSession) => s.id === initialSessionId);
             if (exists) {
                 setCurrentSessionId(initialSessionId);
             } else {
                 setCurrentSessionId('new');
             }
        } else {
            setCurrentSessionId('new');
        }
    }
    loadChats();
  }, [userId, initialSessionId]);

  useEffect(() => {
    setTempName(userProfile.name || '');
    setTempInterests(userProfile.interests || '');
  }, [userProfile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, loading]);

  const saveSettings = () => {
    onUpdateProfile({
        name: tempName,
        interests: tempInterests
    });
    setShowSettings(false);
  };

  const createNewSession = () => {
    // Just switch to draft mode. Do not create data yet.
    setCurrentSessionId('new');
    setShowHistoryMobile(false); 
    setInput('');
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    
    if (currentSessionId === id) {
      // If we deleted the active one, try to find another, or go to 'new'
      // Find next text session
      const nextSession = newSessions.find(s => !s.messages[0]?.meta?.type || s.messages[0]?.meta?.type === 'text');

      if (nextSession) {
          setCurrentSessionId(nextSession.id);
      } else {
          setCurrentSessionId('new');
      }
    }
    if (userId) {
        await supabase.from('chat_sessions').delete().eq('id', id);
    }
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
    let previousContext: any[] = [];

    // --- LOGIC FOR NEW VS EXISTING SESSION ---
    
    if (targetSessionId === 'new' || !targetSessionId) {
        // 1. Initialize new session ONLY now (Lazy Creation)
        const newId = Date.now().toString();
        targetSessionId = newId;

        // Generate smart title
        let title = userText.length > 30 ? userText.slice(0, 30) + '...' : userText;
        try {
            const genTitle = await generateTitle(userText);
            if (genTitle) title = genTitle;
        } catch(e) {
            console.warn("Title generation failed, using fallback");
        }

        const newSession: ChatSession = {
            id: newId,
            title: title,
            messages: [userMsg],
            createdAt: Date.now()
        };
        
        updatedSessions = [newSession, ...sessions];
        setCurrentSessionId(newId); // Switch UI to this ID
        previousContext = [];
    } else {
        // 2. Update existing session
        updatedSessions = sessions.map(s => {
            if (s.id === targetSessionId) {
                return {
                    ...s,
                    messages: [...s.messages, userMsg]
                };
            }
            return s;
        });
        
        const currentSession = updatedSessions.find(s => s.id === targetSessionId);
        // Sliding window logic (last 30 messages)
        if (currentSession && currentSession.messages.length > 1) {
             previousContext = currentSession.messages
                .slice(0, -1) // Exclude current message
                .slice(-30)   // Sliding window
                .map(m => ({ role: m.role, text: m.text }));
        } else {
            previousContext = [];
        }
    }
    
    setSessions(updatedSessions);

    // --- AI GENERATION ---

    const responseText = await chatWithAI(userText, previousContext, userProfile);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText || "I couldn't think of an answer right now.",
      timestamp: Date.now(),
      meta: { type: 'text' }
    };

    // Update session with AI response
    const finalSessions = updatedSessions.map(s => 
      s.id === targetSessionId ? { ...s, messages: [...s.messages, botMsg] } : s
    );
    setSessions(finalSessions);
    setLoading(false);

    // --- DB SYNC ---
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
  };

  const activeSession = currentSessionId === 'new' ? null : sessions.find(s => s.id === currentSessionId);
  
  // Filter sessions: Only Text chats
  const displayedSessions = sessions.filter(s => {
      // Logic: If explicitly voice type, or title contains Voice Chat, exclude it.
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
            className="glass-button w-full py-3 rounded-xl flex items-center justify-center gap-2 mb-4 font-bold text-white shadow-lg bg-gradient-to-r from-cyan-600/50 to-purple-600/50"
        >
            <Plus size={18} /> New Chat
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {displayedSessions.length === 0 && (
              <div className="text-center opacity-40 mt-10 text-sm">
                  No text chats yet.
              </div>
          )}
          {displayedSessions.map(session => (
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
          ))}
        </div>
        
        <button 
            onClick={() => {
                setShowSettings(true);
                setShowHistoryMobile(false);
            }}
            className="mt-4 p-3 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-colors text-white/70 hover:text-white border-t border-white/10"
        >
            <Settings size={18} />
            <span>Personalize</span>
        </button>
      </>
  );

  return (
    <div className="flex h-full gap-4 relative">
        
      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl bg-[#1a1a2e] border border-white/20 shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Settings className="text-purple-400" /> Personalize
                    </h2>
                    <button onClick={() => setShowSettings(false)} className="hover:text-red-400 transition-colors">
                        <X />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-white/70 mb-2 uppercase tracking-wider">Your Name</label>
                        <input 
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="w-full bg-black/30 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="What should I call you?"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-white/70 mb-2 uppercase tracking-wider">Interests & Context</label>
                        <textarea 
                            value={tempInterests}
                            onChange={(e) => setTempInterests(e.target.value)}
                            className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                            placeholder="e.g. I love space but hate biology. I learn best with car analogies."
                        />
                        <p className="text-xs text-white/40 mt-2">The AI will use this to tailor every answer to you.</p>
                    </div>

                    <button 
                        onClick={saveSettings}
                        className="w-full glass-button bg-gradient-to-r from-purple-600 to-blue-600 border-none hover:opacity-90 py-3 rounded-xl font-bold flex justify-center items-center gap-2 mt-4"
                    >
                        <Save size={18} /> Save Profile
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="w-1/4 glass-panel rounded-2xl flex-col p-4 hidden md:flex">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {showHistoryMobile && (
          <div className="absolute inset-0 z-40 flex md:hidden">
              <div 
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
                  onClick={() => setShowHistoryMobile(false)}
              />
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
        
        {/* Mobile Header for History */}
        <div className="md:hidden absolute top-4 right-4 z-30">
            <button 
                onClick={() => setShowHistoryMobile(true)}
                className="p-2 glass-button rounded-lg bg-black/20 hover:bg-white/10 text-white/70"
            >
                <History size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar scroll-smooth">
          {/* Welcome Screen for New Chat */}
          {currentSessionId === 'new' && (
              <div className="h-full flex flex-col items-center justify-center opacity-70">
                  <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Sparkles size={48} className="text-cyan-300" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Hello, {userProfile.name || 'Science Explorer'}!</h2>
                  <p className="text-white/60 max-w-md text-center">
                      I'm ready to help you ace Class 8 Science. Ask me anything to start a new session!
                  </p>
              </div>
          )}

          {/* Message List */}
          {activeSession?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-lg transition-all relative group ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-none' 
                  : 'bg-[#1e1e2f] border border-white/10 text-white rounded-tl-none'
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
        <div className="p-4 bg-black/20 backdrop-blur-md border-t border-white/10">
        <div className="relative max-w-4xl mx-auto flex gap-2 items-center">
            
            <div className="flex-1 relative">
                <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={userProfile.name ? `Ask me anything, ${userProfile.name}...` : "Ask about science..."}
                className="w-full bg-white/10 border border-white/20 rounded-xl py-4 pl-4 pr-12 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all text-sm md:text-base shadow-inner"
                />
            </div>

            <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl transition-all hover:shadow-lg disabled:opacity-30 disabled:shadow-none text-white"
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