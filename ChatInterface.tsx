import React, { useState, useEffect, useRef } from 'react';
import { Send, Plus, MessageSquare, Trash2, Bot, User } from 'lucide-react';
import { ChatSession, ChatMessage } from '../types';
import { chatWithAI } from '../services/aiService';

const STORAGE_KEY = 'science_buddy_chats';

const ChatInterface: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      else createNewSession();
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Science Topic',
      messages: [{
        id: 'init',
        role: 'model',
        text: 'Hi! I am your Science Buddy. Ask me anything about Class 8 Science!',
        timestamp: Date.now()
      }],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
      if (newSessions.length === 0) createNewSession();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    // Update UI immediately
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
           ...s, 
           messages: [...s.messages, userMsg],
           title: s.messages.length <= 1 ? input.slice(0, 20) + '...' : s.title
        };
      }
      return s;
    }));
    setInput('');
    setLoading(true);

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const history = currentSession ? currentSession.messages : [];
    
    // Add user message to history context for API
    const context = [
      ...history.map(m => ({ role: m.role, text: m.text })), 
      { role: 'user' as const, text: input }
    ];

    const responseText = await chatWithAI(input, context);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText || "I couldn't think of an answer right now.",
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { ...s, messages: [...s.messages, botMsg] } : s
    ));
    setLoading(false);
  };

  const activeSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <div className="w-1/4 glass-panel rounded-2xl flex flex-col p-4 hidden md:flex">
        <button 
          onClick={createNewSession}
          className="glass-button w-full py-3 rounded-xl flex items-center justify-center gap-2 mb-4 font-bold text-white"
        >
          <Plus size={18} /> New Chat
        </button>
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`p-3 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${currentSessionId === session.id ? 'bg-white/20 border border-white/30' : 'hover:bg-white/10'}`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <MessageSquare size={16} className="shrink-0 opacity-70" />
                <span className="truncate text-sm opacity-90">{session.title}</span>
              </div>
              <button onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-300 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeSession?.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-tr-none shadow-lg' 
                  : 'bg-white/20 backdrop-blur-md border border-white/10 text-white rounded-tl-none shadow-lg'
              }`}>
                <div className="flex items-center gap-2 mb-1 opacity-70 text-xs font-bold uppercase tracking-wider">
                  {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                  {msg.role === 'user' ? 'You' : 'Science Buddy'}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text}
                </div>
              </div>
            </div>
          ))}
          {loading && (
             <div className="flex justify-start">
               <div className="bg-white/20 backdrop-blur-md rounded-2xl rounded-tl-none p-4 flex gap-2 items-center">
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                 <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-black/20 backdrop-blur-md border-t border-white/10">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about metals, cells, force..."
              className="w-full bg-white/10 border border-white/20 rounded-xl py-4 pl-4 pr-12 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-2 top-2 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
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