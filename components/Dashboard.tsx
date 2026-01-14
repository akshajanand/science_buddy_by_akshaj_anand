
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatSession, AppView } from '../types';
import { 
    Mic, MessageSquare, Book, Zap, ArrowRight, Play, Trophy, Sparkles, 
    Search, Headphones, Puzzle, Network, PenTool, BookOpen, FileText, 
    Clock, Activity, Star, Clapperboard
} from 'lucide-react';
import { Skeleton } from './Skeleton';

interface DashboardProps {
    user: { id: string; username: string; interests: string };
    onNavigate: (view: AppView) => void;
    onResumeSession: (session: ChatSession) => void;
    onResumeTopic?: (topic: string) => void;
    onReportIssue: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate, onResumeSession, onResumeTopic }) => {
    const [stats, setStats] = useState({ totalChats: 0, voiceSessions: 0 });
    const [userRank, setUserRank] = useState<number | string>('-');
    const [loading, setLoading] = useState(true);
    
    // Jump Back In Data
    const [resumeTopics, setResumeTopics] = useState<any[]>([]);
    const [resumeTextChats, setResumeTextChats] = useState<ChatSession[]>([]);
    const [resumeVoiceChats, setResumeVoiceChats] = useState<ChatSession[]>([]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            // 1. Fetch Incomplete Topics (Limit 2)
            const { data: topicsData } = await supabase
                .from('quiz_progress')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_complete', false)
                .order('score', { ascending: false }) 
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
                .limit(50); 

            if (data) {
                const validSessions = data.filter(s => s.messages && s.messages.length > 1);
                
                const voice = validSessions.filter(s => s.title.toLowerCase().includes('voice') || s.messages[0]?.meta?.type === 'voice');
                const text = validSessions.filter(s => !s.title.toLowerCase().includes('voice') && s.messages[0]?.meta?.type !== 'voice');

                setStats({ totalChats: validSessions.length, voiceSessions: voice.length });

                setResumeVoiceChats(voice.slice(0, 2));
                setResumeTextChats(text.slice(0, 2));
            }

            // 3. Fetch Rank (All Time)
            const { data: usersData } = await supabase
                .from('users')
                .select('id, total_points')
                .order('total_points', { ascending: false });
            
            if (usersData) {
                const rank = usersData.findIndex(u => u.id === user.id) + 1;
                setUserRank(rank > 0 ? rank : '-');
            }
            setLoading(false);
        };
        fetchDashboardData();
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

    const getGradientForTool = (id: string) => {
        switch(id) {
            case AppView.RESEARCH: return "from-blue-500 to-cyan-500";
            case AppView.VIDEO_GEN: return "from-pink-500 to-rose-500";
            case AppView.QUIZ: return "from-indigo-500 to-violet-500";
            case AppView.VOICE_CHAT: return "from-fuchsia-500 to-pink-500";
            case AppView.STORY: return "from-emerald-500 to-green-500";
            case AppView.PUZZLE: return "from-amber-500 to-orange-500";
            case AppView.STUDY_POD: return "from-rose-500 to-red-500";
            case AppView.MATCHING: return "from-lime-500 to-green-500";
            case AppView.CONCEPT_MAP: return "from-sky-500 to-blue-500";
            case AppView.STYLE_SWAPPER: return "from-yellow-400 to-orange-500";
            default: return "from-gray-600 to-gray-500";
        }
    };

    const hasJumpBackContent = resumeTopics.length > 0 || resumeTextChats.length > 0 || resumeVoiceChats.length > 0;

    const allActions = [
        { id: AppView.RESEARCH, title: 'Research Lab', icon: FileText, desc: 'Upload PDFs & Generate Quizzes' },
        { id: AppView.VIDEO_GEN, title: 'AI Video Lab', icon: Clapperboard, desc: 'Generate Narrated Lessons' },
        { id: AppView.QUIZ, title: 'Flash Quiz', icon: Zap, desc: 'Instant AI Questions' },
        { id: AppView.VOICE_CHAT, title: 'Voice Lab', icon: Mic, desc: 'Talk to Science Buddy' },
        { id: AppView.STORY, title: 'Story Mode', icon: Book, desc: 'Sci-Fi Adventure' },
        { id: AppView.PUZZLE, title: 'Word Mine', icon: Search, desc: 'Hidden Terms Puzzle' },
        { id: AppView.STUDY_POD, title: 'Study Pod', icon: Headphones, desc: 'AI Podcasts & Summaries' },
        { id: AppView.MATCHING, title: 'Mind Match', icon: Puzzle, desc: 'Memory Card Game' },
        { id: AppView.CONCEPT_MAP, title: 'Concept Map', icon: Network, desc: 'Visual Knowledge Graph' },
        { id: AppView.STYLE_SWAPPER, title: 'Style Swap', icon: PenTool, desc: 'Rewrite Boring Text' },
    ];

    if (loading) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">
                <Skeleton className="h-48 w-full rounded-3xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-8 w-40" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Skeleton className="h-40 rounded-2xl" />
                        <Skeleton className="h-40 rounded-2xl" />
                        <Skeleton className="h-40 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">
            
            {/* 1. Hero Section */}
            <div className="relative overflow-hidden rounded-3xl p-8 border border-white/10 shadow-2xl group">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-purple-900/40 to-black/60 z-0"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-cyan-300 mb-4 shadow-lg">
                            <Sparkles size={12} /> Science Buddy
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                            {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">{user.username}</span>
                        </h1>
                        <p className="text-lg text-white/60 max-w-xl">
                            Ready to unlock some new knowledge today? Your personal AI lab is prepped and ready.
                        </p>
                    </div>
                    
                    {/* Rank Badge - Hero Side */}
                    <div className="hidden md:flex flex-col items-center bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl cursor-default">
                        <Trophy size={32} className="text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                        <span className="text-2xl font-bold text-white">Rank #{userRank}</span>
                        <span className="text-xs text-white/40 uppercase tracking-widest">Global Standings</span>
                    </div>
                </div>
            </div>

            {/* 2. Stats & Quick Actions Grid - Optimized for Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stats Cards */}
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-cyan-500 flex flex-col justify-between group hover:bg-white/5 transition-all">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-xl shadow-lg shadow-cyan-500/10"><MessageSquare size={24} /></div>
                        <span className="text-xs text-white/40 font-bold uppercase tracking-wider mt-1">Total Chats</span>
                    </div>
                    <div>
                        <div className="text-4xl font-bold">{stats.totalChats}</div>
                        <div className="text-xs text-white/30 mt-1">Lifetime text sessions</div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-purple-500 flex flex-col justify-between group hover:bg-white/5 transition-all">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl shadow-lg shadow-purple-500/10"><Mic size={24} /></div>
                        <span className="text-xs text-white/40 font-bold uppercase tracking-wider mt-1">Voice Labs</span>
                    </div>
                    <div>
                        <div className="text-4xl font-bold">{stats.voiceSessions}</div>
                        <div className="text-xs text-white/30 mt-1">Interactive voice calls</div>
                    </div>
                </div>
                
                {/* Mobile Rank Card - Shows only on small screens */}
                 <div className="md:hidden glass-panel p-6 rounded-2xl border-l-4 border-l-yellow-500 flex flex-col justify-between shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-yellow-500/20 text-yellow-400 rounded-lg"><Trophy size={20} /></div>
                         <span className="text-xs text-white/30 font-bold uppercase tracking-wider">Rank</span>
                    </div>
                    <div className="text-3xl font-bold">#{userRank}</div>
                    <div className="text-xs text-white/30 mt-1">Global Standing</div>
                </div>
            </div>

            {/* 3. Continue Learning Section */}
            {hasJumpBackContent && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1 opacity-80">
                        <Clock size={20} className="text-cyan-400" />
                        <h2 className="text-xl font-bold">Jump Back In</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {resumeTopics.map(topic => (
                             <button 
                                key={topic.topic}
                                onClick={() => onResumeTopic && onResumeTopic(topic.topic)}
                                className="group relative overflow-hidden glass-panel p-0 rounded-2xl text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 hover:border-yellow-400/30"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400 group-hover:bg-yellow-400/20 transition-colors"><BookOpen size={20} /></div>
                                        <div className="text-[10px] font-bold opacity-50 bg-white/5 px-2 py-1 rounded border border-white/5">QUIZ</div>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1 truncate group-hover:text-yellow-200 transition-colors">{topic.topic}</h3>
                                    <div className="flex items-center gap-2 text-xs opacity-60 mb-3">
                                        <span>Progress</span>
                                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-yellow-400" style={{ width: `${(topic.current_index / 30) * 100}%` }}></div>
                                        </div>
                                        <span>{Math.round((topic.current_index / 30) * 100)}%</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-yellow-300 group-hover:gap-3 transition-all">
                                        Continue <ArrowRight size={14} />
                                    </div>
                                </div>
                            </button>
                        ))}

                        {resumeVoiceChats.map(session => (
                            <button 
                                key={session.id}
                                onClick={() => onResumeSession(session)}
                                className="group relative overflow-hidden glass-panel p-0 rounded-2xl text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 hover:border-fuchsia-400/30"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-400"></div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 rounded-lg bg-fuchsia-400/10 text-fuchsia-400 group-hover:bg-fuchsia-400/20 transition-colors"><Mic size={20} /></div>
                                        <div className="text-[10px] font-bold opacity-50 bg-white/5 px-2 py-1 rounded border border-white/5">VOICE</div>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1 truncate group-hover:text-fuchsia-200 transition-colors">{session.title || 'Voice Session'}</h3>
                                    <div className="text-xs opacity-50 mb-4">{formatDate(session.createdAt)}</div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-fuchsia-300 group-hover:gap-3 transition-all">
                                        Resume <ArrowRight size={14} />
                                    </div>
                                </div>
                            </button>
                        ))}

                        {resumeTextChats.map(session => (
                            <button 
                                key={session.id}
                                onClick={() => onResumeSession(session)}
                                className="group relative overflow-hidden glass-panel p-0 rounded-2xl text-left transition-all hover:-translate-y-1 hover:shadow-xl border border-white/5 hover:border-cyan-400/30"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 rounded-lg bg-cyan-400/10 text-cyan-400 group-hover:bg-cyan-400/20 transition-colors"><MessageSquare size={20} /></div>
                                        <div className="text-[10px] font-bold opacity-50 bg-white/5 px-2 py-1 rounded border border-white/5">CHAT</div>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1 truncate group-hover:text-cyan-200 transition-colors">{session.title}</h3>
                                    <div className="text-xs opacity-50 mb-4">{formatDate(session.createdAt)}</div>
                                    <div className="flex items-center gap-2 text-sm font-bold text-cyan-300 group-hover:gap-3 transition-all">
                                        Resume <ArrowRight size={14} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Explore Tools Grid (Bento Style) */}
            <div className="space-y-4">
                 <div className="flex items-center gap-2 px-1 opacity-80">
                    <Network size={20} className="text-purple-400" />
                    <h2 className="text-xl font-bold">Research & Tools</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Render tool cards with vibrant gradients on hover/icon backgrounds */}
                    {allActions.map(action => (
                         <button 
                            key={action.id}
                            onClick={() => onNavigate(action.id)}
                            className="group glass-panel p-5 rounded-2xl text-left relative overflow-hidden transition-all hover:bg-white/10 hover:shadow-2xl hover:border-white/20 border border-white/5 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            
                            <div className="relative z-10">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white shadow-lg bg-gradient-to-br ${getGradientForTool(action.id)}`}>
                                    <action.icon size={24} />
                                </div>
                                <h3 className="text-lg font-bold mb-1 group-hover:text-cyan-300 transition-colors">{action.title}</h3>
                                <p className="text-xs text-white/50 leading-relaxed mb-4 min-h-[40px]">{action.desc}</p>
                                
                                <div className="flex items-center gap-2 text-xs font-bold opacity-40 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                    Launch <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="h-10"></div> {/* Bottom spacer */}
        </div>
    );
};

export default Dashboard;
