import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { generatePerformanceReport } from '../services/aiService';
import { renderRichText } from '../utils/textUtils';
import { BarChart2, TrendingUp, Target, Award, Brain, Zap, Loader2, Mail, Check, AlertTriangle, Plus, Save, X } from 'lucide-react';
import emailjs from '@emailjs/browser';

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
    
    // Email Sending State
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [parentEmail, setParentEmail] = useState<string | null>(null);
    
    // Email Management State
    const [isAddingEmail, setIsAddingEmail] = useState(false);
    const [tempEmail, setTempEmail] = useState('');

    useEffect(() => {
        fetchStats();
    }, [userId, currentUserPoints]); // Re-fetch if points change

    const fetchStats = async () => {
        setLoading(true);

        // 1. Fetch Rank (All Time)
        const { data: usersData } = await supabase
            .from('users')
            .select('id, total_points, parent_email')
            .order('total_points', { ascending: false });

        let rank = '-';
        
        if (usersData) {
            const userRecord = usersData.find(u => u.id === userId);
            if (userRecord) {
                setParentEmail(userRecord.parent_email);
                const index = usersData.findIndex(u => u.id === userId);
                if (index !== -1) {
                    rank = (index + 1).toString();
                }
            }
        }

        // 2. Fetch Quiz Progress
        const { data: quizData } = await supabase
            .from('quiz_progress')
            .select('*')
            .eq('user_id', userId);
        
        const quizzesAttempted = quizData ? quizData.length : 0;
        const topicScores = quizData ? quizData.map(q => ({
            topic: q.topic,
            score: q.score,
            total: 60, // Assuming 30 questions * 2 points
            percent: Math.round((q.score / 60) * 100)
        })) : [];

        // 3. Fetch Chat Engagement
        const { data: chatData } = await supabase
            .from('chat_sessions')
            .select('id, title, messages')
            .eq('user_id', userId);
            
        const totalChats = chatData ? chatData.length : 0;
        const voiceChats = chatData ? chatData.filter(c => c.title.toLowerCase().includes('voice')).length : 0;

        setStats({
            rank,
            quizzesAttempted,
            topicScores,
            totalChats,
            voiceChats
        });
        setLoading(false);
    };

    const handleSaveEmail = async () => {
        if (!tempEmail.includes('@')) {
            alert("Please enter a valid email.");
            return;
        }
        
        const { error } = await supabase
            .from('users')
            .update({ parent_email: tempEmail })
            .eq('id', userId);

        if (error) {
            alert("Error saving email");
        } else {
            setParentEmail(tempEmail);
            setIsAddingEmail(false);
        }
    };

    const handleGenerateAnalysis = async () => {
        if (!stats) return;
        setAnalyzing(true);
        const report = await generatePerformanceReport(username, { ...stats, totalPoints: currentUserPoints });
        setAnalysis(report);
        setAnalyzing(false);
    };

    const stripMarkdown = (text: string) => {
        if (!text) return "";
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1')     // Italic
            .replace(/#{1,6}\s?/g, '')       // Headers
            .replace(/`/g, '')               // Code
            .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
    };

    const handleSendReport = async () => {
        if (!parentEmail || !stats) return;
        setSendingEmail(true);
        setEmailStatus('IDLE');

        try {
            // 1. Generate report content if needed
            const reportContent = analysis || await generatePerformanceReport(username, { ...stats, totalPoints: currentUserPoints });
            if (!analysis) setAnalysis(reportContent);

            // ---------------------------------------------------------------------------
            // FRONTEND EMAIL CONFIGURATION (EmailJS)
            // Configured with user keys
            // ---------------------------------------------------------------------------
            const SERVICE_ID: string = 'service_4rd3ex6'; 
            const TEMPLATE_ID: string = 'template_ld5md57';
            const PUBLIC_KEY: string = 'X1eYkPAczlxtDVjnw';
            // ---------------------------------------------------------------------------

            if (SERVICE_ID === 'YOUR_SERVICE_ID_HERE') {
                // FALLBACK: If keys are not configured, use "mailto" to open local email client.
                // This ensures the button works immediately without crashing.
                console.log("EmailJS not configured. Falling back to Mailto.");
                
                const cleanReport = stripMarkdown(reportContent);
                const subject = encodeURIComponent(`Science Buddy Progress: ${username}`);
                const body = encodeURIComponent(
                    `Dear Parent,\n\nHere is the latest progress report for ${username}.\n\n` +
                    `-- QUICK STATS --\n` +
                    `Global Rank: #${stats.rank}\n` +
                    `Total XP: ${currentUserPoints}\n` +
                    `Quizzes Taken: ${stats.quizzesAttempted}\n\n` +
                    `-- AI TUTOR ANALYSIS --\n` +
                    `${cleanReport}\n\n` +
                    `Generated by Science Buddy.`
                );

                // Small delay to simulate processing so the user sees the spinner
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                window.location.href = `mailto:${parentEmail}?subject=${subject}&body=${body}`;
                setEmailStatus('SUCCESS');
            } else {
                // PRIMARY: Send using EmailJS API
                await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                    to_email: parentEmail,
                    student_name: username,
                    message: stripMarkdown(reportContent),
                    total_points: currentUserPoints,
                    rank: stats.rank,
                    quizzes: stats.quizzesAttempted
                }, PUBLIC_KEY);
                setEmailStatus('SUCCESS');
            }

        } catch (e) {
            console.error("Failed to send email", e);
            setEmailStatus('ERROR');
        } finally {
            setSendingEmail(false);
        }
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
                    <p className="text-white/60">Track your progress and get AI-powered insights.</p>
                </div>
                
                {parentEmail ? (
                    <button 
                        onClick={handleSendReport}
                        disabled={sendingEmail || emailStatus === 'SUCCESS'}
                        className={`glass-button px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all ${emailStatus === 'SUCCESS' ? 'bg-green-500/20 text-green-300' : 'hover:bg-white/10'}`}
                    >
                        {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : 
                         emailStatus === 'SUCCESS' ? <Check size={16} /> : 
                         emailStatus === 'ERROR' ? <AlertTriangle size={16} className="text-red-400"/> :
                         <Mail size={16} />}
                        
                        {sendingEmail ? 'Preparing Email...' : 
                         emailStatus === 'SUCCESS' ? 'Email Opened!' : 
                         emailStatus === 'ERROR' ? 'Retry Sending' :
                         'Email Report to Parent'}
                    </button>
                ) : (
                    // Logic for adding email if missing
                    isAddingEmail ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                            <input 
                                value={tempEmail}
                                onChange={(e) => setTempEmail(e.target.value)}
                                placeholder="parent@email.com"
                                className="bg-black/20 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-400 outline-none w-48"
                            />
                            <button onClick={handleSaveEmail} className="glass-button p-2 rounded-xl bg-green-500/20 text-green-300 hover:bg-green-500/30"><Save size={18} /></button>
                            <button onClick={() => setIsAddingEmail(false)} className="glass-button p-2 rounded-xl hover:bg-red-500/20 hover:text-red-300"><X size={18} /></button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsAddingEmail(true)}
                            className="glass-button px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-white/10 text-white/70"
                        >
                            <Plus size={16} /> Connect Parent Email
                        </button>
                    )
                )}
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 bg-gradient-to-br from-yellow-900/40 to-black/20">
                    <div className="p-4 rounded-full bg-yellow-500/20 text-yellow-300">
                        <Award size={32} />
                    </div>
                    <div>
                        <div className="text-3xl font-bold">#{stats.rank}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Global Rank</div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 bg-gradient-to-br from-cyan-900/40 to-black/20">
                    <div className="p-4 rounded-full bg-cyan-500/20 text-cyan-300">
                        <Zap size={32} />
                    </div>
                    <div>
                        <div className="text-3xl font-bold">{currentUserPoints}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Total XP</div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 bg-gradient-to-br from-purple-900/40 to-black/20">
                    <div className="p-4 rounded-full bg-purple-500/20 text-purple-300">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <div className="text-3xl font-bold">{stats.quizzesAttempted}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Topics Started</div>
                    </div>
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
                        <Brain size={20} className="text-purple-400" /> AI Tutor Insight
                    </h3>

                    {!analysis ? (
                        <div className="text-center py-10">
                            <p className="mb-6 opacity-70">
                                Get a personalized analysis of your learning patterns, strengths, and areas for improvement based on your activity.
                            </p>
                            <button 
                                onClick={handleGenerateAnalysis}
                                disabled={analyzing}
                                className="glass-button px-8 py-4 rounded-full font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 border-purple-500/50 flex items-center justify-center gap-2 mx-auto"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : <Brain size={20} />}
                                {analyzing ? 'Analyzing Data...' : 'Generate Report'}
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