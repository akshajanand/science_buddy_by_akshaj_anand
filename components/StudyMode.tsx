
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Network, HelpCircle, ArrowLeft, Sun, Moon, Send, X, Loader2, Book } from 'lucide-react';
import TopicsDashboard from './TopicsDashboard';
import TopicQuiz from './TopicQuiz';
import { ConceptMap } from './CreativeTools';
import { callGroqAPI } from '../services/aiService';
import { renderRichText } from '../utils/textUtils';

interface StudyModeProps {
    userId: string;
    userInterests: string;
    onExit: () => void;
}

export const StudyMode: React.FC<StudyModeProps> = ({ userId, userInterests, onExit }) => {
    const [view, setView] = useState<'TOPICS' | 'MINDMAP' | 'QUIZ'>('TOPICS');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    
    // Stuck State
    const [stuckOpen, setStuckOpen] = useState(false);
    const [stuckQuery, setStuckQuery] = useState('');
    const [stuckAnswer, setStuckAnswer] = useState<string | null>(null);
    const [stuckLoading, setStuckLoading] = useState(false);

    // Apply Theme to Body (Override App Theme)
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'light') {
            // Softer, darker light theme (Slate-200 background)
            root.style.setProperty('--glass-bg', '#ffffff');
            root.style.setProperty('--glass-border', '#cbd5e1'); // Darker border for contrast
            root.style.setProperty('--glass-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.05)');
            root.style.setProperty('--text-color', '#0f172a'); // Slate-900 text
            document.body.style.background = '#e2e8f0'; // Slate-200 (Visibly gray/blueish, not bright white)
        } else {
            root.style.setProperty('--glass-bg', '#1e1e1e');
            root.style.setProperty('--glass-border', '#333333');
            root.style.setProperty('--glass-shadow', '0 4px 6px -1px rgba(0, 0, 0, 0.5)');
            root.style.setProperty('--text-color', '#f1f5f9');
            document.body.style.background = '#0f172a';
        }
        
        return () => {
            // Cleanup handled by App.tsx
        };
    }, [theme]);

    const handleAskStuck = async () => {
        if (!stuckQuery.trim()) return;
        setStuckLoading(true);
        setStuckAnswer(null);

        try {
            // Direct Prompt Construction
            const prompt = `
            You are a helpful, patient Science Tutor for a Class 8 student.
            The student is stuck on this problem: "${stuckQuery}".
            
            Provide a very detailed explanation.
            Structure:
            1. **Simple Definition**: What is it?
            2. **Step-by-Step Logic**: How does it work?
            3. **Real World Analogy**: Compare it to something daily (like a car, kitchen, sport).
            4. **Key Takeaway**: One sentence summary.
            
            Use formatting like bolding and bullet points. Be encouraging.
            `;

            // Direct call to AI service function we exported
            const response = await callGroqAPI([{ role: 'user', content: prompt }]);
            setStuckAnswer(response);
        } catch (e) {
            setStuckAnswer("I'm having trouble connecting to the brain network. Please try again.");
        }
        setStuckLoading(false);
    };

    return (
        <div className={`fixed inset-0 z-[100] flex flex-col font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-slate-200 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
            
            {/* Header */}
            <div className={`h-16 flex items-center justify-between px-6 border-b shadow-sm ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Book size={24} className={theme === 'light' ? 'text-blue-600' : 'text-blue-400'} />
                        <h1 className="text-xl font-bold tracking-tight">Study Mode</h1>
                    </div>
                </div>

                <div className={`flex p-1 rounded-lg ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'}`}>
                    <button 
                        onClick={() => { setView('TOPICS'); setSelectedTopic(null); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'TOPICS' || view === 'QUIZ' ? (theme === 'light' ? 'bg-white shadow-sm text-blue-600' : 'bg-slate-700 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
                    >
                        Topics
                    </button>
                    <button 
                        onClick={() => { setView('MINDMAP'); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'MINDMAP' ? (theme === 'light' ? 'bg-white shadow-sm text-blue-600' : 'bg-slate-700 shadow-sm') : 'opacity-60 hover:opacity-100'}`}
                    >
                        Mind Maps
                    </button>
                </div>

                <button 
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                    {theme === 'light' ? <Moon size={20} className="text-slate-600" /> : <Sun size={20} />}
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                {view === 'TOPICS' && (
                    <div className="h-full">
                        <TopicsDashboard 
                            userId={userId} 
                            onSelectTopic={(topic) => {
                                setSelectedTopic(topic);
                                setView('QUIZ');
                            }} 
                        />
                    </div>
                )}

                {view === 'QUIZ' && selectedTopic && (
                    <TopicQuiz 
                        userId={userId} 
                        topic={selectedTopic} 
                        userInterests={userInterests} 
                        onBack={() => setView('TOPICS')} 
                    />
                )}

                {view === 'MINDMAP' && (
                    <ConceptMap userId={userId} />
                )}
            </div>

            {/* I'm Stuck FAB */}
            <div className="absolute bottom-8 right-8 z-50">
                <button 
                    onClick={() => setStuckOpen(true)}
                    className="flex items-center gap-2 px-6 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all"
                >
                    <HelpCircle size={24} /> I'm Stuck
                </button>
            </div>

            {/* Stuck Modal */}
            {stuckOpen && (
                <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] ${theme === 'light' ? 'bg-white text-slate-900 ring-1 ring-slate-200' : 'bg-slate-900 text-slate-100'}`}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <HelpCircle className="text-blue-500" /> Assistance Required
                                </h2>
                                <p className="opacity-60 text-sm">Describe your problem, and I'll break it down.</p>
                            </div>
                            <button onClick={() => setStuckOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><X /></button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            {stuckAnswer ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="prose prose-slate dark:prose-invert max-w-none">
                                        {renderRichText(stuckAnswer)}
                                    </div>
                                    <div className="pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
                                        <button 
                                            onClick={() => { setStuckAnswer(null); setStuckQuery(''); }}
                                            className="text-blue-500 hover:underline text-sm font-bold"
                                        >
                                            Ask Another Question
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4 h-full justify-center">
                                    <textarea
                                        value={stuckQuery}
                                        onChange={(e) => setStuckQuery(e.target.value)}
                                        placeholder="Type your problem here... (e.g. 'I don't understand how force works' or 'What is photosynthesis?')"
                                        className={`w-full h-32 p-4 rounded-xl border resize-none focus:ring-2 focus:ring-blue-500 outline-none transition-all ${theme === 'light' ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-slate-700'}`}
                                    />
                                    <div className="text-xs opacity-50 text-center">
                                        AI will analyze your query and provide a structured explanation.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {!stuckAnswer && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                                <button 
                                    onClick={handleAskStuck}
                                    disabled={stuckLoading || !stuckQuery.trim()}
                                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {stuckLoading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                    {stuckLoading ? 'Analyzing...' : 'Help Me Out'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
