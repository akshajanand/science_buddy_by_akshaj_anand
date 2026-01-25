
import React, { useState, useEffect } from 'react';
import { 
    Settings, LogOut, Moon, Sun, 
    Search, FileText, 
    Mic, MessageSquare, Zap, Puzzle, Headphones, Network, PenTool, Book, Atom, BookOpen, ArrowLeft, Layout, MessageCircle, User, Lock, Save, Loader2,
    Users, BarChart2, GraduationCap, ChevronRight, Brain, Trophy, Globe, Upload, Image as ImageIcon, X, CheckCircle, AlertTriangle, Send, Sparkles
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { UserData } from './types';
import { ToastContainer } from './components/ToastContainer';
import { supabase } from './services/supabaseClient';
import { showToast } from './utils/notificationUtils';
import { callGroqAPI } from './services/aiService';

// Import Child Features for preview/use
import ChatInterface from './components/ChatInterface';
import VoiceChat from './components/VoiceChat';
import { QuizModule, WordPuzzle, StudyPod, MindMatch } from './components/StudyTools';
import { ConceptMap, StyleSwapper, InteractiveStory } from './components/CreativeTools';
import VideoGenerator from './components/VideoGenerator';
import ResearchMode from './components/ResearchMode';
import YourFeed from './components/YourFeed';
import DiscussionBoard from './components/DiscussionBoard';
import PerformanceAnalytics from './components/PerformanceAnalytics';
import CommunityNotes from './components/CommunityNotes';
import Leaderboard from './components/Leaderboard';

interface TeacherAppProps {
    user: UserData;
    onLogout: () => void;
}

// Optimized Wrapper
const FeatureWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="dark w-full h-full flex flex-col bg-slate-950 text-slate-100 md:rounded-2xl overflow-hidden border-0 md:border border-slate-800 shadow-2xl relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black -z-10"></div>
        {children}
    </div>
);

interface ClassSelection {
    grade: string;
    section: string;
}

const TeacherApp: React.FC<TeacherAppProps> = ({ user, onLogout }) => {
    // Navigation State
    const [selectedClass, setSelectedClass] = useState<ClassSelection | null>(null);
    const [activeTab, setActiveTab] = useState<string>('overview');
    
    // Data State
    const [students, setStudents] = useState<any[]>([]);
    const [loadingClass, setLoadingClass] = useState(false);
    const [classStats, setClassStats] = useState<any>(null);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Individual Student View State
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentViewMode, setStudentViewMode] = useState<'PERFORMANCE' | 'NOTES' | 'FEED'>('PERFORMANCE');

    // Tool Preview State
    const [previewTool, setPreviewTool] = useState<string | null>(null);

    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsName, setSettingsName] = useState(user.display_name || user.username || '');
    const [settingsAvatar, setSettingsAvatar] = useState(user.avatar_url || '');
    const [settingsPassword, setSettingsPassword] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Feedback State
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackEmail, setFeedbackEmail] = useState('');
    const [isSendingFeedback, setIsSendingFeedback] = useState(false);

    // Apply Dark Mode
    useEffect(() => {
        document.documentElement.classList.add('dark');
        document.body.style.background = '#0f172a';
        return () => {}
    }, []);

    // Fetch Students when class is selected
    useEffect(() => {
        if (selectedClass && selectedClass.grade !== 'All') {
            fetchClassData();
        } else {
            // Global view - no students to fetch specifically
            setStudents([]);
            setClassStats(null);
        }
    }, [selectedClass]);

    const fetchClassData = async () => {
        if (!selectedClass || selectedClass.grade === 'All') return;
        setLoadingClass(true);
        setAiAnalysis(null);
        setSelectedStudentId(null);

        try {
            // 1. Fetch Students
            const { data: studentsData, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'student')
                .eq('class_level', selectedClass.grade)
                .eq('section', selectedClass.section)
                .order('username');

            if (error) throw error;
            setStudents(studentsData || []);

            // 2. Aggregate Stats (Mock logic for calculation if real stats table doesn't exist)
            if (studentsData && studentsData.length > 0) {
                const totalXP = studentsData.reduce((acc, curr) => acc + (curr.total_points || 0), 0);
                const avgXP = Math.round(totalXP / studentsData.length);
                
                setClassStats({
                    totalStudents: studentsData.length,
                    avgXP,
                    topPerformer: studentsData.reduce((prev, current) => ((prev.total_points || 0) > (current.total_points || 0)) ? prev : current),
                    needsAttention: studentsData.filter((s: any) => (s.total_points || 0) < avgXP * 0.5).length
                });
            } else {
                setClassStats({ totalStudents: 0, avgXP: 0, topPerformer: null, needsAttention: 0 });
            }

        } catch (err: any) {
            showToast("Error fetching class data: " + err.message, 'error');
        } finally {
            setLoadingClass(false);
        }
    };

    const generateClassAnalysis = async () => {
        if (!classStats || students.length === 0) return;
        setAnalyzing(true);
        
        const prompt = `
        Analyze this class performance for Class ${selectedClass?.grade}-${selectedClass?.section}.
        Data:
        - Total Students: ${classStats.totalStudents}
        - Average XP Score: ${classStats.avgXP}
        - Students needing attention (Low XP): ${classStats.needsAttention}
        
        Provide a concise 3-point summary for the teacher:
        1. Overall Class Health (Excellent/Good/Needs Improvement)
        2. Key Area of Focus
        3. A motivational tip for the teacher.
        Keep it professional but encouraging.
        `;

        const response = await callGroqAPI([{ role: 'user', content: prompt }]);
        setAiAnalysis(response);
        setAnalyzing(false);
    };

    const handleGlobalAccess = (tab: string) => {
        setSelectedClass({ grade: 'All', section: 'Global' });
        setActiveTab(tab);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        setUploadingAvatar(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            setSettingsAvatar(data.publicUrl);
            showToast('Image uploaded!', 'success');
        } catch (error: any) {
            showToast('Failed to upload image.', 'error');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!user) return;
        setIsSavingSettings(true);
        const updates: any = {
            display_name: settingsName,
            avatar_url: settingsAvatar,
        };
        if (settingsPassword.trim()) updates.password = settingsPassword;
        
        const { error } = await supabase.from('users').update(updates).eq('id', user.id);
        if (error) showToast("Failed to save settings.", 'error');
        else showToast("Settings Saved!", "success");
        setIsSavingSettings(false);
        setIsSettingsOpen(false);
    };

    const handleSendFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackText.trim()) return;
        setIsSendingFeedback(true);
        const finalMessage = `TEACHER REPORT\nUsername: @${user?.username}\nUser ID: ${user?.id}\nMessage:\n${feedbackText}\nEmail: ${feedbackEmail}`;
        try {
            await emailjs.send('service_4rd3ex6', 'template_ld5md57', { from_name: user?.username, message: finalMessage }, 'X1eYkPAczlxtDVjnw');
            showToast('Report sent successfully!', 'success');
            setFeedbackText('');
            setIsFeedbackOpen(false);
        } catch (error) { 
            showToast('Failed to send report.', 'error'); 
        } finally { 
            setIsSendingFeedback(false); 
        }
    };

    // --- Helper Render Functions ---

    const renderOverview = () => {
        if (!classStats) return <div className="p-8 text-center text-slate-500">Select a class to view overview</div>;
        
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="glass-panel p-6 rounded-2xl bg-slate-900 border border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl"><Users size={24} /></div>
                            <span className="text-xs font-bold text-slate-500 uppercase">Total Students</span>
                        </div>
                        <div className="text-4xl font-bold text-white">{classStats.totalStudents}</div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl bg-slate-900 border border-slate-800">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-yellow-500/20 text-yellow-400 rounded-xl"><Zap size={24} /></div>
                            <span className="text-xs font-bold text-slate-500 uppercase">Avg Class XP</span>
                        </div>
                        <div className="text-4xl font-bold text-white">{classStats.avgXP}</div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl bg-slate-900 border border-slate-800">
                         <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-500/20 text-green-400 rounded-xl"><Trophy size={24} /></div>
                            <span className="text-xs font-bold text-slate-500 uppercase">Top Performer</span>
                        </div>
                        <div className="text-xl font-bold text-white truncate">{classStats.topPerformer?.display_name || classStats.topPerformer?.username || '-'}</div>
                        <div className="text-sm text-slate-500">{classStats.topPerformer?.total_points || 0} XP</div>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl bg-slate-900 border border-slate-800">
                         <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-red-500/20 text-red-400 rounded-xl"><AlertTriangle size={24} /></div>
                            <span className="text-xs font-bold text-slate-500 uppercase">Needs Attention</span>
                        </div>
                        <div className="text-4xl font-bold text-white">{classStats.needsAttention}</div>
                    </div>
                </div>

                {/* AI Analysis Section */}
                <div className="glass-panel p-8 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20">
                    <div className="flex items-center gap-3 mb-6">
                        <Brain className="text-indigo-400" size={32} />
                        <h2 className="text-2xl font-bold text-white">Class Intelligence Report</h2>
                    </div>
                    
                    {!aiAnalysis ? (
                        <div className="text-center py-8">
                            <p className="text-slate-400 mb-6">Generate a comprehensive analysis of this class's performance trends and areas for improvement.</p>
                            <button 
                                onClick={generateClassAnalysis} 
                                disabled={analyzing}
                                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold flex items-center gap-2 mx-auto transition-all disabled:opacity-50"
                            >
                                {analyzing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                                {analyzing ? 'Analyzing Data...' : 'Generate Report'}
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                             <div className="prose prose-invert max-w-none text-slate-300">
                                <pre className="whitespace-pre-wrap font-sans text-base">{aiAnalysis}</pre>
                             </div>
                             <button onClick={generateClassAnalysis} className="mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium">Refresh Analysis</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderStudentsView = () => {
        if (!selectedClass) return null;

        if (selectedStudentId) {
            // Detailed View
            const student = students.find(s => s.id === selectedStudentId);
            if (!student) return null;

            return (
                <div className="h-full flex flex-col">
                    <div className="h-16 border-b border-slate-800 flex items-center px-4 gap-4 bg-slate-900 shrink-0">
                        <button onClick={() => setSelectedStudentId(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ArrowLeft size={20}/></button>
                        <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden">
                             {student.avatar_url ? <img src={student.avatar_url} className="w-full h-full object-cover"/> : <User className="p-1 w-full h-full"/>}
                        </div>
                        <div className="font-bold text-lg">{student.display_name || student.username}</div>
                        <div className="ml-auto flex gap-2">
                             {(['PERFORMANCE', 'NOTES', 'FEED'] as const).map(mode => (
                                 <button 
                                    key={mode}
                                    onClick={() => setStudentViewMode(mode)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${studentViewMode === mode ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {mode}
                                </button>
                             ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        {studentViewMode === 'PERFORMANCE' && <FeatureWrapper><PerformanceAnalytics userId={student.id} username={student.username} currentUserPoints={student.total_points || 0} /></FeatureWrapper>}
                        {studentViewMode === 'NOTES' && <FeatureWrapper><CommunityNotes userId={student.id} username={student.username} filterByUserId={student.id} /></FeatureWrapper>}
                        {studentViewMode === 'FEED' && <FeatureWrapper><YourFeed userId={student.id} username={student.username} avatarUrl={student.avatar_url} filterByUserId={student.id} readOnly /></FeatureWrapper>}
                    </div>
                </div>
            )
        }

        // List View
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Users className="text-cyan-400" /> Class Roster ({students.length})</h2>
                {loadingClass ? (
                    <div className="text-center py-10"><Loader2 className="animate-spin mx-auto"/> Loading class data...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {students.map(student => (
                            <div 
                                key={student.id}
                                onClick={() => setSelectedStudentId(student.id)}
                                className="bg-slate-900 border border-slate-800 p-4 rounded-xl cursor-pointer hover:border-cyan-500/50 hover:bg-slate-800 transition-all group"
                            >
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                                         {student.avatar_url ? <img src={student.avatar_url} className="w-full h-full object-cover"/> : <User className="p-2 w-full h-full opacity-50"/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">{student.display_name || student.username}</div>
                                        <div className="text-xs text-slate-500">ID: {student.username}</div>
                                    </div>
                                    <div className="ml-auto">
                                        <ChevronRight className="text-slate-600 group-hover:text-cyan-400" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                     <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                         <div className="text-slate-500">XP Points</div>
                                         <div className="font-bold text-yellow-400">{student.total_points || 0}</div>
                                     </div>
                                     <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                                         <div className="text-slate-500">Interests</div>
                                         <div className="font-bold text-white truncate">{student.interests || 'N/A'}</div>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderToolsGrid = () => {
        const tools = [
            { id: 'chat', label: 'AI Chat', icon: MessageSquare, desc: 'Preview the AI Tutor interface' },
            { id: 'voice', label: 'Voice Lab', icon: Mic, desc: 'Test voice interaction capabilities' },
            { id: 'quiz', label: 'Quiz Gen', icon: Zap, desc: 'Generate test quizzes' },
            { id: 'research', label: 'Research', icon: FileText, desc: 'Document analysis tool' },
            { id: 'video', label: 'Video Gen', icon: Layout, desc: 'Create lesson videos' },
            { id: 'story', label: 'Story Mode', icon: Book, desc: 'Interactive scenarios' },
            { id: 'puzzle', label: 'Word Mine', icon: Search, desc: 'Vocabulary puzzles' },
            { id: 'map', label: 'Concept Map', icon: Network, desc: 'Visual learning' },
            { id: 'pod', label: 'Study Pod', icon: Headphones, desc: 'Audio lessons' },
            { id: 'discussion', label: 'Discussion', icon: MessageCircle, desc: 'Manage boards' },
        ];

        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-6">
                 {previewTool && (
                     <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-6xl h-[85vh] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
                            <button onClick={() => setPreviewTool(null)} className="absolute top-4 right-4 z-50 p-2 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"><X size={24}/></button>
                            <div className="flex-1 overflow-hidden relative">
                                {previewTool === 'chat' && <FeatureWrapper><ChatInterface userProfile={{name: user.username}} onUpdateProfile={()=>{}} userId={user.id} /></FeatureWrapper>}
                                {previewTool === 'voice' && <FeatureWrapper><VoiceChat userProfile={{name: user.username}} userId={user.id} /></FeatureWrapper>}
                                {previewTool === 'quiz' && <FeatureWrapper><QuizModule /></FeatureWrapper>}
                                {previewTool === 'research' && <FeatureWrapper><ResearchMode userId={user.id} username={user.username} /></FeatureWrapper>}
                                {previewTool === 'video' && <FeatureWrapper><VideoGenerator userId={user.id} /></FeatureWrapper>}
                                {previewTool === 'story' && <FeatureWrapper><InteractiveStory /></FeatureWrapper>}
                                {previewTool === 'puzzle' && <FeatureWrapper><WordPuzzle /></FeatureWrapper>}
                                {previewTool === 'map' && <FeatureWrapper><ConceptMap userId={user.id} /></FeatureWrapper>}
                                {previewTool === 'pod' && <FeatureWrapper><StudyPod userId={user.id} /></FeatureWrapper>}
                                {previewTool === 'discussion' && <FeatureWrapper><DiscussionBoard user={user} /></FeatureWrapper>}
                            </div>
                        </div>
                     </div>
                 )}

                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Puzzle className="text-blue-400" /> Teaching Toolkit</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {tools.map(tool => (
                        <button 
                            key={tool.id}
                            onClick={() => setPreviewTool(tool.id)}
                            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-left hover:border-cyan-500/50 hover:bg-slate-800 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform group-hover:border-cyan-500/30">
                                <tool.icon size={24} className="text-slate-400 group-hover:text-cyan-400" />
                            </div>
                            <h3 className="font-bold text-lg text-white mb-1 group-hover:text-cyan-300">{tool.label}</h3>
                            <p className="text-sm text-slate-500">{tool.desc}</p>
                        </button>
                    ))}
                </div>
            </div>
        )
    };

    const renderClassSelectorContent = () => {
        const grades = ['6', '7', '8'];
        const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

        return (
            <div className="flex flex-col h-full w-full bg-slate-950 text-white overflow-hidden relative">
                {/* Header for Class Selector View */}
                <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
                    <button onClick={() => setIsFeedbackOpen(true)} className="flex items-center gap-2 text-slate-400 hover:text-yellow-400 px-4 py-2 bg-slate-900/50 rounded-full backdrop-blur-md border border-slate-800 transition-colors"><AlertTriangle size={16} /> Report</button>
                    <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 px-4 py-2 bg-slate-900/50 rounded-full backdrop-blur-md border border-slate-800 transition-colors"><Settings size={16} /> Settings</button>
                    <button onClick={onLogout} className="flex items-center gap-2 text-slate-500 hover:text-white px-4 py-2 bg-slate-900/50 rounded-full backdrop-blur-md border border-slate-800"><LogOut size={16}/> Logout</button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
                    {/* Branding Header */}
                    <div className="flex flex-col items-center pt-16 pb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                         <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 shadow-[0_0_50px_rgba(6,182,212,0.2)] relative group">
                            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all"></div>
                            <Atom size={64} className="text-cyan-400 animate-[spin_10s_linear_infinite] relative z-10" />
                         </div>
                         <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-white to-purple-400 mb-3 tracking-tight">
                            Science Buddy
                         </h1>
                         <p className="text-slate-400 text-lg md:text-xl tracking-widest uppercase font-medium">Teacher Command Center</p>
                    </div>

                    {/* Main Content Container */}
                    <div className="w-full max-w-6xl mx-auto p-6 space-y-12 pb-24">
                        {/* Class Selection Grid */}
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                            <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-cyan-500 pl-4 flex items-center gap-2">
                                <Users className="text-cyan-500" /> Select Class to Manage
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {grades.map(grade => (
                                    <div key={grade} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm hover:border-cyan-500/30 transition-all shadow-xl">
                                        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
                                            <h3 className="text-2xl font-bold text-white">Class {grade}</h3>
                                            <GraduationCap className="text-slate-600" />
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                            {sections.map(section => {
                                                // Remove G section for Class 8
                                                if (grade === '8' && section === 'G') return null;
                                                return (
                                                    <button
                                                        key={`${grade}-${section}`}
                                                        onClick={() => {
                                                            setSelectedClass({ grade, section });
                                                            setActiveTab('overview');
                                                        }}
                                                        className="aspect-square rounded-2xl bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-400 font-bold transition-all hover:scale-110 active:scale-95 shadow-lg flex flex-col items-center justify-center gap-1 group border border-transparent hover:border-cyan-400"
                                                    >
                                                        <span className="text-xl">{section}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* School Hub (Scroll Down Section) */}
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            <h2 className="text-2xl font-bold text-white mb-6 border-l-4 border-purple-500 pl-4 flex items-center gap-2">
                                <Globe className="text-purple-500" /> School Activity Hub
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <button onClick={() => handleGlobalAccess('feed')} className="bg-gradient-to-br from-slate-900 to-slate-900 hover:from-slate-800 hover:to-slate-900 border border-slate-800 p-8 rounded-3xl text-left group shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
                                    <div className="w-14 h-14 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                                        <Layout size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-pink-400 transition-colors mb-2">School Feed</h3>
                                    <p className="text-sm text-slate-500">View latest posts from all students.</p>
                                </button>

                                <button onClick={() => handleGlobalAccess('leaderboard')} className="bg-gradient-to-br from-slate-900 to-slate-900 hover:from-slate-800 hover:to-slate-900 border border-slate-800 p-8 rounded-3xl text-left group shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
                                    <div className="w-14 h-14 rounded-2xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                                        <Trophy size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors mb-2">Leaderboard</h3>
                                    <p className="text-sm text-slate-500">Check top performers across grades.</p>
                                </button>

                                <button onClick={() => handleGlobalAccess('discussion')} className="bg-gradient-to-br from-slate-900 to-slate-900 hover:from-slate-800 hover:to-slate-900 border border-slate-800 p-8 rounded-3xl text-left group shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
                                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                                        <MessageCircle size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors mb-2">Discussions</h3>
                                    <p className="text-sm text-slate-500">Manage topics and queries.</p>
                                </button>

                                <button onClick={() => handleGlobalAccess('notes')} className="bg-gradient-to-br from-slate-900 to-slate-900 hover:from-slate-800 hover:to-slate-900 border border-slate-800 p-8 rounded-3xl text-left group shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1">
                                    <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                                        <FileText size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors mb-2">Notes</h3>
                                    <p className="text-sm text-slate-500">Review shared study materials.</p>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- MAIN RENDER ---
    return (
        <div className="flex h-screen w-screen overflow-hidden font-sans bg-slate-950 text-slate-100 relative">
            <ToastContainer />

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-white"><Settings className="text-cyan-400" /> Settings</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="hover:text-red-400 text-slate-400"><X /></button>
                        </div>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0 relative group">
                                    {settingsAvatar ? <img src={settingsAvatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} className="opacity-50" />}
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold mb-2 block text-slate-400">PROFILE PICTURE</label>
                                    <label className="bg-slate-800 hover:bg-slate-700 px-4 py-2 w-full rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all font-bold text-sm border border-slate-700 text-white">
                                        <ImageIcon size={18} />
                                        {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
                                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1 block text-slate-400">CHANGE PASSWORD</label>
                                <input 
                                    type="password"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-500" 
                                    placeholder="New Password (leave blank to keep current)"
                                    value={settingsPassword} 
                                    onChange={(e) => setSettingsPassword(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="pt-6 mt-6 border-t border-slate-800 flex justify-end gap-3">
                            <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg hover:bg-slate-800 text-slate-400">Cancel</button>
                            <button onClick={handleSaveSettings} disabled={isSavingSettings} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold flex items-center gap-2 shadow-lg text-white transition-colors">
                                {isSavingSettings ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Issue Modal */}
            {isFeedbackOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl border-white/20 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-white"><AlertTriangle className="text-yellow-400" size={20} /> Report Issue</h3>
                            <button onClick={() => setIsFeedbackOpen(false)} className="hover:text-red-400 text-slate-400"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSendFeedback}>
                            <input type="email" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-3 text-sm text-white focus:outline-none focus:border-cyan-500" placeholder="Email (Optional)" />
                            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white resize-none mb-4 focus:outline-none focus:border-cyan-500" placeholder="Describe problem..." required />
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsFeedbackOpen(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-slate-800 text-slate-400">Cancel</button>
                                <button type="submit" disabled={isSendingFeedback} className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold flex items-center gap-2">
                                    {isSendingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Report
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!selectedClass ? (
                renderClassSelectorContent()
            ) : (
                <>
                    {/* Sidebar */}
                    <aside className="w-64 shrink-0 border-r flex flex-col bg-slate-900 border-slate-800">
                        <div className="p-6 border-b border-inherit">
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Atom className="text-cyan-400" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Science Buddy</span>
                            </h1>
                            <div className="flex items-center gap-2 mt-2">
                                <div className={`text-[10px] px-2 py-0.5 rounded border ${selectedClass.grade === 'All' ? 'bg-indigo-900/50 text-indigo-300 border-indigo-500/30' : 'bg-cyan-900/50 text-cyan-300 border-cyan-500/30'}`}>
                                    {selectedClass.grade === 'All' ? 'Global View' : `Class ${selectedClass.grade}-${selectedClass.section}`}
                                </div>
                                <button onClick={() => setSelectedClass(null)} className="text-[10px] text-slate-500 hover:text-white underline">Change</button>
                            </div>
                        </div>

                        <nav className="flex-1 p-4 space-y-2">
                            <button onClick={() => { setActiveTab('overview'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <BarChart2 size={20} /> Class Overview
                            </button>
                            <button onClick={() => { setActiveTab('students'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <Users size={20} /> Students
                            </button>
                            <button onClick={() => { setActiveTab('tools'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'tools' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}>
                                <Puzzle size={20} /> Learning Tools
                            </button>
                        </nav>

                        <div className="p-4 border-t border-inherit space-y-3">
                            <div className="flex items-center gap-3 px-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shadow-lg overflow-hidden">
                                    {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-bold truncate">{user.display_name || user.username}</div>
                                    <div className="text-xs opacity-60">Teacher</div>
                                </div>
                            </div>
                            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-900/50 bg-red-900/10 text-red-400 hover:bg-red-900/20 transition-colors text-sm font-bold">
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950">
                        {/* Global Teacher Header */}
                        <div className="h-16 shrink-0 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 z-20">
                            <div className="font-bold text-lg text-slate-200 capitalize flex items-center gap-2">
                                {activeTab === 'overview' && <BarChart2 size={20} className="text-blue-400" />}
                                {activeTab === 'students' && <Users size={20} className="text-blue-400" />}
                                {activeTab === 'tools' && <Puzzle size={20} className="text-blue-400" />}
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsFeedbackOpen(true)} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-yellow-400 transition-colors" title="Report Issue">
                                    <AlertTriangle size={20} />
                                </button>
                                <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors" title="Settings">
                                    <Settings size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            {activeTab === 'overview' && renderOverview()}
                            {activeTab === 'students' && renderStudentsView()}
                            {activeTab === 'tools' && renderToolsGrid()}
                            
                            {/* Community Features */}
                            {activeTab === 'feed' && (
                                <div className="h-full p-4 overflow-hidden">
                                    <FeatureWrapper><YourFeed userId={user.id} username={user.username} avatarUrl={user.avatar_url} /></FeatureWrapper>
                                </div>
                            )}
                            {activeTab === 'discussion' && (
                                <div className="h-full p-4 overflow-hidden">
                                    <FeatureWrapper><DiscussionBoard user={user} /></FeatureWrapper>
                                </div>
                            )}
                            {activeTab === 'notes' && (
                                <div className="h-full p-4 overflow-hidden">
                                    <FeatureWrapper><CommunityNotes userId={user.id} username={user.username} /></FeatureWrapper>
                                </div>
                            )}
                            {activeTab === 'leaderboard' && (
                                <div className="h-full p-4 overflow-hidden">
                                    <FeatureWrapper><Leaderboard currentUserId={user.id} currentUserPoints={0} /></FeatureWrapper>
                                </div>
                            )}
                        </div>
                    </main>
                </>
            )}
        </div>
    );
};

export default TeacherApp;
