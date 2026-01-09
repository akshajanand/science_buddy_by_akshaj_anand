import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatSession, AppView } from '../types';
import { Mic, MessageSquare, Book, Zap, ArrowRight, Play, Trophy, Sparkles, Search, Headphones, Puzzle, Network, PenTool, BookOpen } from 'lucide-react';

interface DashboardProps {
    user: { id: string; username: string; interests: string };
    onNavigate: (view: AppView) => void;
    onResumeSession: (session: ChatSession) => void;
    onResumeTopic?: (topic: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate, onResumeSession, onResumeTopic }) => {
    const [stats, setStats] = useState({ totalChats: 0, voiceSessions: 0 });
    const [featuredActions, setFeaturedActions] = useState<any[]>([]);
    const [userRank, setUserRank] = useState<number | string>('-');
    
    // Jump Back In Data
    const [resumeTopics, setResumeTopics] = useState<any[]>([]);
    const [resumeTextChats, setResumeTextChats] = useState<ChatSession[]>([]);
    const [resumeVoiceChats, setResumeVoiceChats] = useState<ChatSession[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            // 1. Fetch Incomplete Topics (Limit 2)
            const { data: topicsData } = await supabase
                .from('quiz_progress')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_complete', false)
                .order('score', { ascending: false }) // Prioritize higher score incomplete ones? Or created_at?
                .limit(2);
            
            if (topicsData) {
                setResumeTopics(topicsData);
            }

            // 2. Fetch recent sessions
            const { data } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50); // Fetch enough to filter

            if (data) {
                const validSessions = data.filter(s => s.messages && s.messages.length > 1);
                
                // Identify types
                const voice = validSessions.filter(s => s.title.toLowerCase().includes('voice') || s.messages[0]?.meta?.type === 'voice');
                const text = validSessions.filter(s => !s.title.toLowerCase().includes('voice') && s.messages[0]?.meta?.type !== 'voice');

                setStats({ totalChats: validSessions.length, voiceSessions: voice.length });

                // Take top 2 of each
                setResumeVoiceChats(voice.slice(0, 2));
                setResumeTextChats(text.slice(0, 2));
            }

            // 3. Fetch Rank (All Time - No Date Filter)
            const { data: usersData } = await supabase
                .from('users')
                .select('id, total_points')
                .order('total_points', { ascending: false });
            
            if (usersData) {
                const rank = usersData.findIndex(u => u.id === user.id) + 1;
                setUserRank(rank > 0 ? rank : '-');
            }
        };
        fetchDashboardData();
        
        // Randomize Discover Actions
        const allActions = [
            { id: AppView.QUIZ, title: 'Flash Quiz', icon: Zap, color: 'text-indigo-400', bg: 'from-indigo-900/60', desc: 'Test your knowledge with AI generated questions instantly.' },
            { id: AppView.VOICE_CHAT, title: 'Voice Lab', icon: Mic, color: 'text-fuchsia-400', bg: 'from-fuchsia-900/60', desc: 'Have a real conversation with Science Buddy.' },
            { id: AppView.STORY, title: 'Story Mode', icon: Book, color: 'text-emerald-400', bg: 'from-emerald-900/60', desc: 'Choose your own adventure inside a scientific concept.' },
            { id: AppView.PUZZLE, title: 'Word Mine', icon: Search, color: 'text-cyan-400', bg: 'from-cyan-900/60', desc: 'Find hidden scientific terms in a generated grid.' },
            { id: AppView.STUDY_POD, title: 'Study Pod', icon: Headphones, color: 'text-orange-400', bg: 'from-orange-900/60', desc: 'Listen to AI-generated podcasts and summaries.' },
            { id: AppView.MATCHING, title: 'Mind Match', icon: Puzzle, color: 'text-pink-400', bg: 'from-pink-900/60', desc: 'Connect terms to their definitions.' },
            { id: AppView.CONCEPT_MAP, title: 'Concept Map', icon: Network, color: 'text-blue-400', bg: 'from-blue-900/60', desc: 'Visualize connections between topics.' },
            { id: AppView.STYLE_SWAPPER, title: 'Style Swap', icon: PenTool, color: 'text-yellow-400', bg: 'from-yellow-900/60', desc: 'Rewrite boring text into fun styles.' },
        ];
        
        const shuffled = [...allActions].sort(() => 0.5 - Math.random());
        setFeaturedActions(shuffled.slice(0, 3));

    }, [user.id]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const formatDate = (dateInput: string | number) => {
        if (!dateInput) return 'Recent';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'Recent';
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    const hasJumpBackContent = resumeTopics.length > 0 || resumeTextChats.length > 0 || resumeVoiceChats.length > 0;

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-2 md:p-6">
            {/* Header */}
            <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                <h1 className="text-3xl md:text-5xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-purple-300">
                    {getGreeting()}, {user.username}!
                </h1>
                <p className="text-white/60 text-lg">Ready to explore the universe today?</p>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="glass-panel p-4 rounded-xl flex items-center gap-3 bg-gradient-to-br from-cyan-900/40 to-black/20">
                    <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-300">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{stats.totalChats}+</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Active Chats</div>
                    </div>
                </div>
                <div className="glass-panel p-4 rounded-xl flex items-center gap-3 bg-gradient-to-br from-purple-900/40 to-black/20">
                    <div className="p-3 rounded-lg bg-purple-500/20 text-purple-300">
                        <Mic size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{stats.voiceSessions}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Voice Labs</div>
                    </div>
                </div>
                 <div className="glass-panel p-4 rounded-xl flex items-center gap-3 bg-gradient-to-br from-yellow-900/40 to-black/20">
                    <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-300">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">#{userRank}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Rank</div>
                    </div>
                </div>
            </div>

            {/* Jump Back In */}
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Play size={20} className="text-green-400" /> Jump Back In
            </h2>
            
            {!hasJumpBackContent ? (
                <div className="glass-panel p-8 text-center text-white/40 italic mb-8">
                    No recent adventures. Start a chat or a quiz!
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                    {/* 1. Incomplete Topics (Max 2) */}
                    {resumeTopics.map(topic => (
                            <button 
                            key={topic.topic}
                            onClick={() => onResumeTopic && onResumeTopic(topic.topic)}
                            className="glass-panel p-4 rounded-xl text-left group hover:bg-white/10 transition-all flex justify-between items-center border border-yellow-500/20 bg-gradient-to-r from-yellow-900/10 to-transparent"
                        >
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="p-3 rounded-full shrink-0 bg-yellow-500/20 text-yellow-300">
                                    <BookOpen size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold truncate">{topic.topic}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(topic.current_index / 30) * 100}%` }}></div>
                                        </div>
                                        <span className="text-xs text-white/50">{Math.round((topic.current_index / 30) * 100)}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white/10 px-3 py-1 rounded-lg text-xs font-bold uppercase">Resume</div>
                        </button>
                    ))}

                    {/* 2. Text Chats (Max 2) */}
                    {resumeTextChats.map(session => (
                        <button 
                            key={session.id}
                            onClick={() => onResumeSession(session)}
                            className="glass-panel p-4 rounded-xl text-left group hover:bg-white/10 transition-all flex justify-between items-center bg-gradient-to-r from-cyan-900/10 to-transparent"
                        >
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="p-3 rounded-full shrink-0 bg-cyan-500/20 text-cyan-300">
                                    <MessageSquare size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold truncate max-w-[150px]">{session.title}</h3>
                                    <p className="text-xs text-white/50">{formatDate(session.createdAt)}</p>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 p-2 rounded-full">
                                <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}

                    {/* 3. Voice Chats (Max 2) */}
                    {resumeVoiceChats.map(session => (
                        <button 
                            key={session.id}
                            onClick={() => onResumeSession(session)}
                            className="glass-panel p-4 rounded-xl text-left group hover:bg-white/10 transition-all flex justify-between items-center bg-gradient-to-r from-purple-900/10 to-transparent"
                        >
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="p-3 rounded-full shrink-0 bg-purple-500/20 text-purple-300">
                                    <Mic size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold truncate max-w-[150px]">{session.title || 'Voice Chat'}</h3>
                                    <p className="text-xs text-white/50">{formatDate(session.createdAt)}</p>
                                </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 p-2 rounded-full">
                                <ArrowRight size={16} />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Featured Actions */}
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Sparkles size={20} className="text-yellow-400" /> Discover More
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredActions.map(action => {
                    const Icon = action.icon;
                    return (
                        <button 
                            key={action.id}
                            onClick={() => onNavigate(action.id)}
                            className={`glass-panel p-6 rounded-2xl bg-gradient-to-br ${action.bg} to-black/40 hover:scale-[1.02] transition-transform text-left`}
                        >
                            <Icon size={32} className={`${action.color} mb-4`} />
                            <h3 className="text-xl font-bold mb-2">{action.title}</h3>
                            <p className="text-sm text-white/60">{action.desc}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};

export default Dashboard;