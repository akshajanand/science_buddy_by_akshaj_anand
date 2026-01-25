
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Loader2, History, Plus, X, Trash2 } from 'lucide-react';
import { speechManager } from '../utils/audioUtils';
import { chatWithAIVoice, generateTitle, fetchLiveUserStats } from '../services/aiService';
import { supabase } from '../services/supabaseClient';
import { ChatSession, ChatMessage } from '../types';
import { showToast } from '../utils/notificationUtils';

interface VoiceChatProps {
    userProfile: { name?: string | null, interests?: string };
    userId?: string;
    initialSessionId?: string | null;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ userProfile, userId, initialSessionId }) => {
    const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('IDLE');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionHistory, setSessionHistory] = useState<ChatMessage[]>([]);
    const [autoMode, setAutoMode] = useState(true);
    const [voiceSessions, setVoiceSessions] = useState<ChatSession[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const recognitionRef = useRef<any>(null);
    const statusRef = useRef(status);
    const autoModeRef = useRef(autoMode);
    const sessionHistoryRef = useRef<ChatMessage[]>(sessionHistory);
    const isDraftRef = useRef(false);

    useEffect(() => {
        statusRef.current = status;
        autoModeRef.current = autoMode;
        sessionHistoryRef.current = sessionHistory;
    }, [status, autoMode, sessionHistory]);

    useEffect(() => {
        if (!userId) return;
        const initSession = async () => {
            setIsLoading(true);
            const { data } = await supabase.from('chat_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            const allSessions = data || [];
            const sessions = allSessions.filter((s: any) => s.title?.toLowerCase().includes('voice') || s.messages?.[0]?.meta?.type === 'voice');
            setVoiceSessions(sessions);

            let targetSession = null;
            if (initialSessionId) {
                targetSession = sessions.find((s: any) => s.id === initialSessionId);
                if (!targetSession) {
                     const { data: direct } = await supabase.from('chat_sessions').select('*').eq('id', initialSessionId).single();
                     if (direct) targetSession = direct;
                }
            }
            
            if (targetSession) {
                setSessionId(targetSession.id);
                setSessionHistory(targetSession.messages);
                isDraftRef.current = false;
            } else {
                await startNewSession(); 
            }
            setIsLoading(false);
        };
        initSession();
        return () => {
            speechManager.stop();
            if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }
        };
    }, [userId, initialSessionId]);

    const startNewSession = async () => {
        const newId = Date.now().toString();
        const initMsg: ChatMessage = { id: 'init', role: 'model', text: `Hello ${userProfile.name || 'friend'}! I'm ready to chat.`, timestamp: Date.now(), meta: { type: 'voice' } };
        setSessionId(newId);
        setSessionHistory([initMsg]);
        setStatus('IDLE');
        isDraftRef.current = true; 
    };

    const deleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('chat_sessions').delete().eq('id', id);
        setVoiceSessions(prev => prev.filter(s => s.id !== id));
        if (id === sessionId) await startNewSession();
    };

    const switchSession = async (id: string) => {
        const session = voiceSessions.find(s => s.id === id);
        if (session) {
            speechManager.stop();
            if (recognitionRef.current) recognitionRef.current.stop();
            setSessionId(session.id);
            setSessionHistory(session.messages);
            setStatus('IDLE');
            isDraftRef.current = false;
            setShowSidebar(false);
        }
    };

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) { showToast("Voice recognition not supported.", 'error'); return; }
        if (statusRef.current === 'LISTENING') return;
        if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        recognition.onstart = () => setStatus('LISTENING');
        let resultProcessed = false;
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript.trim()) { resultProcessed = true; processUserMessage(transcript); }
        };
        recognition.onerror = (event: any) => {
            if (event.error === 'no-speech') {
                if (autoModeRef.current) setTimeout(() => { if (statusRef.current !== 'SPEAKING' && statusRef.current !== 'PROCESSING') setStatus('IDLE'); }, 500);
                else setStatus('IDLE');
            } else setStatus('IDLE');
        };
        recognition.onend = () => { if (statusRef.current === 'LISTENING' && !resultProcessed) setStatus('IDLE'); };
        try { recognition.start(); } catch (e) { setStatus('IDLE'); }
    };

    const saveToDB = async (history: ChatMessage[]) => {
        if (!sessionId || !userId) return;
        if (isDraftRef.current) {
            await supabase.from('chat_sessions').insert({ id: sessionId, user_id: userId, title: 'Voice Chat', messages: history, created_at: Date.now() });
            isDraftRef.current = false;
            setVoiceSessions(prev => [{ id: sessionId, title: 'Voice Chat', messages: history, createdAt: Date.now() }, ...prev]);
        } else {
            await supabase.from('chat_sessions').update({ messages: history }).eq('id', sessionId);
        }
    };

    const processUserMessage = async (text: string) => {
        setStatus('PROCESSING');
        const currentHistory = sessionHistoryRef.current;
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now(), meta: { type: 'voice' } };
        const historyWithUser = [...currentHistory, userMsg];
        setSessionHistory(historyWithUser);
        await saveToDB(historyWithUser);

        if (historyWithUser.length <= 2 && sessionId && userId) {
            generateTitle(text).then(async (newTitle) => {
                if (newTitle) {
                    await supabase.from('chat_sessions').update({ title: newTitle }).eq('id', sessionId);
                    setVoiceSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
                }
            });
        }

        let liveStats = undefined;
        if (userId) liveStats = await fetchLiveUserStats(userId);
        
        const fullContext = { ...userProfile, stats: liveStats };
        const previousContext = historyWithUser.slice(0, -1).map(m => ({ role: m.role, text: m.text }));
        const aiText = await chatWithAIVoice(text, previousContext, fullContext);

        const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: aiText, timestamp: Date.now(), meta: { type: 'voice' } };
        const finalHistory = [...historyWithUser, aiMsg];
        setSessionHistory(finalHistory);
        await saveToDB(finalHistory);

        setStatus('SPEAKING');
        const femaleVoice = speechManager.getFemaleVoice();
        speechManager.speak(aiText, {
            voice: femaleVoice, pitch: 1.05, rate: 1.05,
            onEnd: () => { if (autoModeRef.current) startListening(); else setStatus('IDLE'); }
        });
    };

    const handleOrbClick = () => {
        if (status === 'IDLE') startListening();
        else { speechManager.stop(); if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e){} } setStatus('IDLE'); }
    };

    const Sidebar = () => (
        <div className={`absolute inset-y-0 left-0 z-30 w-64 glass-panel border-r border-white/20 transform transition-transform duration-300 flex flex-col ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <span className="font-bold text-white/70 uppercase tracking-wider text-xs">Voice History</span>
                <button onClick={() => setShowSidebar(false)} className="md:hidden"><X size={18}/></button>
            </div>
            <div className="p-4">
                <button onClick={startNewSession} className="w-full glass-button py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-white bg-gradient-to-r from-fuchsia-600/50 to-purple-600/50"><Plus size={18} /> New Chat</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {voiceSessions.map(s => (
                    <div key={s.id} onClick={() => switchSession(s.id)} className={`p-3 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${sessionId === s.id ? 'bg-white/20 border border-white/30' : 'hover:bg-white/10'}`}>
                         <div className="flex items-center gap-3 overflow-hidden">
                            <Mic size={16} className="shrink-0 opacity-70" />
                            <div className="overflow-hidden"><div className="truncate text-sm opacity-90 font-medium">{s.title || 'Voice Chat'}</div></div>
                        </div>
                        <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-300 transition-opacity"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="h-full flex overflow-hidden relative">
            <button onClick={() => setShowSidebar(!showSidebar)} className="absolute top-4 left-4 z-40 p-2 glass-button rounded-lg md:hidden"><History size={20} /></button>
            <Sidebar />
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-black/20">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`absolute border border-white/5 rounded-full w-[300px] h-[300px] md:w-[600px] md:h-[600px] transition-all duration-1000 ${status === 'SPEAKING' ? 'scale-110 opacity-30' : 'scale-100 opacity-10'}`}></div>
                    <div className={`absolute border border-white/5 rounded-full w-[200px] h-[200px] md:w-[400px] md:h-[400px] transition-all duration-1000 ${status === 'LISTENING' ? 'scale-110 opacity-30' : 'scale-100 opacity-10'}`}></div>
                </div>

                {isLoading ? (
                    <div className="z-10 flex flex-col items-center gap-4">
                        <Loader2 size={48} className="text-cyan-400 animate-spin" />
                        <p className="text-white/50 text-sm tracking-widest uppercase">Initializing Lab...</p>
                    </div>
                ) : (
                    <>
                        <div className="relative z-10 flex flex-col items-center gap-12">
                            <button onClick={handleOrbClick} className="relative outline-none group">
                                <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
                                    status === 'LISTENING' ? 'bg-red-500/20 shadow-[0_0_80px_rgba(239,68,68,0.4)] scale-110' :
                                    status === 'SPEAKING' ? 'bg-cyan-500/20 shadow-[0_0_80px_rgba(34,211,238,0.4)] scale-110' :
                                    status === 'PROCESSING' ? 'bg-purple-500/20 shadow-[0_0_80px_rgba(168,85,247,0.4)] animate-pulse' :
                                    'bg-white/5 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:bg-white/10'
                                }`}>
                                    {status === 'LISTENING' && <Mic size={48} className="text-red-400" />}
                                    {status === 'SPEAKING' && (
                                        <div className="flex gap-1 h-12 items-center">
                                            <div className="w-2 bg-cyan-400 animate-[bounce_1s_infinite] h-full"></div>
                                            <div className="w-2 bg-cyan-400 animate-[bounce_1.2s_infinite] h-3/4"></div>
                                            <div className="w-2 bg-cyan-400 animate-[bounce_0.8s_infinite] h-full"></div>
                                        </div>
                                    )}
                                    {status === 'PROCESSING' && <Loader2 size={48} className="text-purple-400 animate-spin" />}
                                    {status === 'IDLE' && <Mic size={48} className="text-white/30 group-hover:text-white/60 transition-colors" />}
                                </div>
                                {status === 'LISTENING' && <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping"></div>}
                                {status === 'SPEAKING' && <div className="absolute inset-0 rounded-full border-2 border-cyan-500/50 animate-ping"></div>}
                            </button>

                            <div className="h-8">
                                <p className="text-sm font-bold tracking-[0.3em] text-white/40 uppercase animate-in fade-in slide-in-from-bottom-2">
                                    {status === 'IDLE' ? 'Tap to Speak' : status}
                                </p>
                            </div>

                             {sessionHistory.length > 0 && (
                                <div className="max-w-md text-center glass-panel p-4 rounded-xl opacity-60 mx-4">
                                     <p className="text-xs text-white/50 mb-1 font-bold uppercase">{sessionHistory[sessionHistory.length - 1].role === 'user' ? 'You said' : 'Science Buddy said'}</p>
                                     <p className="text-sm italic line-clamp-3">"{sessionHistory[sessionHistory.length - 1].text}"</p>
                                </div>
                             )}
                        </div>

                        <div className="absolute bottom-8 flex items-center gap-3 bg-black/20 p-2 rounded-full px-4 border border-white/5 hover:border-white/20 transition-colors">
                            <span className="text-xs text-white/50 font-bold uppercase">Seamless Mode</span>
                            <button onClick={() => setAutoMode(!autoMode)} className={`w-10 h-5 rounded-full relative transition-colors ${autoMode ? 'bg-green-500/50' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 bottom-1 w-3 bg-white rounded-full transition-all ${autoMode ? 'left-6' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VoiceChat;
