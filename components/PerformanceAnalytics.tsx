import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { generatePerformanceReport } from '../services/aiService';
import { renderRichText } from '../utils/textUtils';
import { BarChart2, TrendingUp, Target, Award, Brain, Zap, Loader2, FileText, Headphones, Users } from 'lucide-react';

interface PerformanceAnalyticsProps {
    userId: string;
    username: string;
    currentUserPoints: number;
}

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ userId, username, currentUserPoints }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [userInterests, setUserInterests] = useState('');

    useEffect(() => {
        fetchStats();
    }, [userId, currentUserPoints]); // Re-fetch if points change

    const fetchStats = async () => {
        setLoading(true);

        // Parallel Fetching for holistic view
        const [usersData, quizData, chatData, researchData, libraryData, notesData, userProfile] = await Promise.all([
            supabase.from('users').select('id, total_points').order('total_points', { ascending: false }),
            supabase.from('quiz_progress').select('*').eq('user_id', userId),
            supabase.from('chat_sessions').select('id, title, messages').eq('user_id', userId),
            supabase.from('research_projects').select('title, created_at').eq('user_id', userId),
            supabase.from('study_library').select('topic, type').eq('user_id', userId),
            supabase.from('community_notes').select('id').eq('user_id', userId),
            supabase.from('users').select('interests').eq('id', userId).single()
        ]);

        // 1. Process Rank
        let rank = '-';
        if (usersData.data) {
            const index = usersData.data.findIndex(u => u.id === userId);
            if (index !== -1) {
                rank = (index + 1).toString();
            }
        }

        // 2. Process Quiz Progress
        const quizzesAttempted = quizData.data ? quizData.data.length : 0;
        const topicScores = quizData.data ? quizData.data.map((q: any) => ({
            topic: q.topic,
            score: q.score,
            total: 60, // Assuming 30 questions * 2 points
            percent: Math.round((q.score / 60) * 100)
        })) : [];

        // 3. Process Chat
        const totalChats = chatData.data ? chatData.data.length : 0;
        const voiceChats = chatData.data ? chatData.data.filter((c: any) => c.title.toLowerCase().includes('voice')).length : 0;

        // 4. Set Profile Interests
        if (userProfile.data) {
            setUserInterests(userProfile.data.interests || "General Science");
        }

        setStats({
            rank,
            quizzesAttempted,
            topicScores,
            totalChats,
            voiceChats,
            researchProjects: researchData.data || [],
            savedPods: libraryData.data || [],
            communityNotes: notesData.data ? notesData.data.length : 0,
            totalPoints: currentUserPoints
        });
        setLoading(false);
    };

    const handleGenerateAnalysis = async () => {
        if (!stats) return;
        setAnalyzing(true);
        const report = await generatePerformanceReport(username, userInterests, stats);
        setAnalysis(report);
        setAnalyzing(false);
    };

    if (loading) {
        return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" size={48} /></div>;
    }

    return (
        <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-300 to-cyan-300 mb-2">
                        My Performance
                    </h2>
                    <p className="text-white/60">Holistic view of your entire learning journey.</p>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-yellow-900/40 to-black/20 text-center">
                    <div className="text-yellow-300 mb-2"><Award size={24} /></div>
                    <div className="text-2xl font-bold">#{stats.rank}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Global Rank</div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-cyan-900/40 to-black/20 text-center">
                    <div className="text-cyan-300 mb-2"><Zap size={24} /></div>
                    <div className="text-2xl font-bold">{currentUserPoints}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Total XP</div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-purple-900/40 to-black/20 text-center">
                    <div className="text-purple-300 mb-2"><TrendingUp size={24} /></div>
                    <div className="text-2xl font-bold">{stats.quizzesAttempted}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Quizzes</div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-blue-900/40 to-black/20 text-center">
                    <div className="text-blue-300 mb-2"><FileText size={24} /></div>
                    <div className="text-2xl font-bold">{stats.researchProjects.length}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Research Docs</div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-orange-900/40 to-black/20 text-center">
                    <div className="text-orange-300 mb-2"><Headphones size={24} /></div>
                    <div className="text-2xl font-bold">{stats.savedPods.length}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Saved Pods</div>
                </div>

                <div className="glass-panel p-4 rounded-xl flex flex-col justify-center items-center bg-gradient-to-br from-pink-900/40 to-black/20 text-center">
                    <div className="text-pink-300 mb-2"><Users size={24} /></div>
                    <div className="text-2xl font-bold">{stats.communityNotes}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Contributions</div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Topic Breakdown */}
                <div className="flex-1 glass-panel p-6 rounded-2xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Target size={20} className="text-cyan-400" /> Topic Mastery
                    </h3>
                    
                    {stats.topicScores.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <BarChart2 size={48} className="mx-auto mb-4" />
                            <p>No quiz data available yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {stats.topicScores.map((t: any) => (
                                <div key={t.topic}>
                                    <div className="flex justify-between mb-2 text-sm">
                                        <span className="font-bold">{t.topic}</span>
                                        <span className={t.percent >= 80 ? 'text-green-400' : t.percent >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                                            {t.percent}% ({t.score} pts)
                                        </span>
                                    </div>
                                    <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${t.percent >= 80 ? 'bg-green-500' : t.percent >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${t.percent}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Analysis */}
                <div className="flex-1 glass-panel p-6 rounded-2xl bg-gradient-to-b from-indigo-900/20 to-black/20 border border-indigo-500/20">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Brain size={20} className="text-purple-400" /> Deep Analysis
                    </h3>

                    {!analysis ? (
                        <div className="text-center py-10">
                            <p className="mb-6 opacity-70">
                                I will scan your Research Docs, Library, Quizzes, and Community Activity to generate a complete report.
                            </p>
                            <button 
                                onClick={handleGenerateAnalysis}
                                disabled={analyzing}
                                className="glass-button px-8 py-4 rounded-full font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 border-purple-500/50 flex items-center justify-center gap-2 mx-auto"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : <Brain size={20} />}
                                {analyzing ? 'Scanning Entire Footprint...' : 'Generate Full Report'}
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="prose prose-invert prose-sm max-w-none">
                                {renderRichText(analysis)}
                            </div>
                            <button 
                                onClick={handleGenerateAnalysis}
                                className="mt-6 text-xs text-white/40 hover:text-white underline"
                            >
                                Refresh Analysis
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PerformanceAnalytics;