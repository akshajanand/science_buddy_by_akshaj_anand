import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Upload, FileText, Loader2, Play, Headphones, Network, Zap, Download, Trash2, Pause, ChevronLeft, MessageSquare, Send, CheckCircle, XCircle } from 'lucide-react';
import { generateResearchTitle, generateSummaryFromText, generateQuizFromText, generateInfographicFromText, generatePodcastScriptFromText, chatWithResearchDocument } from '../services/aiService';
import { ResearchProject, ChatMessage } from '../types';
import { ConceptMap } from './CreativeTools';
import { renderRichText } from '../utils/textUtils';
import { speechManager } from '../utils/audioUtils';
import { showToast } from '../utils/notificationUtils';

interface ResearchModeProps {
    userId: string;
    username: string;
}

const ResearchMode: React.FC<ResearchModeProps> = ({ userId, username }) => {
    const [view, setView] = useState<'LIST' | 'WORKSPACE'>('LIST');
    const [researches, setResearches] = useState<ResearchProject[]>([]);
    const [currentProject, setCurrentProject] = useState<ResearchProject | null>(null);
    const [processingFile, setProcessingFile] = useState(false);
    
    // Workspace State
    const [activeTab, setActiveTab] = useState<'SUMMARY' | 'QUIZ' | 'GRAPH' | 'PODCAST' | 'CHAT'>('SUMMARY');
    const [isGenerating, setIsGenerating] = useState(false);

    // Audio State
    const [currentLine, setCurrentLine] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);

    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Quiz State
    const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
    const [showQuizResults, setShowQuizResults] = useState(false);
    const [quizScore, setQuizScore] = useState(0);

    useEffect(() => {
        fetchResearches();
        return () => { speechManager.stop(); };
    }, [userId]);

    useEffect(() => {
        if (activeTab === 'CHAT') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        // Reset quiz state when switching projects or tabs
        if (activeTab !== 'QUIZ') {
             // Optional: keep state if they switch back? For now, simple reset if project changes
        }
    }, [activeTab, currentProject?.chat_history, chatLoading]);

    useEffect(() => {
        if (currentProject) {
            setQuizAnswers({});
            setShowQuizResults(false);
            setQuizScore(0);
        }
    }, [currentProject?.id]);

    const fetchResearches = async () => {
        const { data } = await supabase
            .from('research_projects')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (data) setResearches(data);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setProcessingFile(true);
        let textContent = "";

        try {
            const fileType = file.name.split('.').pop()?.toLowerCase();
            
            if (fileType === 'pdf') {
                const pdfjsLib = (window as any).pdfjsLib;
                if (!pdfjsLib) throw new Error("PDF Engine not ready.");
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContentPage = await page.getTextContent();
                    fullText += textContentPage.items.map((item: any) => item.str).join(' ') + '\n';
                }
                textContent = fullText;
            } else if (['jpg', 'jpeg', 'png'].includes(fileType || '')) {
                const Tesseract = (window as any).Tesseract;
                if (!Tesseract) throw new Error("OCR Engine not ready.");
                const { data: { text } } = await Tesseract.recognize(file, 'eng');
                textContent = text;
            } else {
                textContent = await file.text();
            }

            if (!textContent.trim()) throw new Error("Empty file.");

            let title = `${username}'s Note`;
            try {
                const aiTitle = await generateResearchTitle(textContent);
                if (aiTitle && aiTitle.length > 2) title = aiTitle;
            } catch (err) {}
            
            const newProject = {
                user_id: userId,
                title: title,
                source_text: textContent,
                chat_history: [],
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase.from('research_projects').insert(newProject).select().single();
            if (error) throw error;
            
            setResearches([data, ...researches]);
            setCurrentProject(data);
            setView('WORKSPACE');

        } catch (err: any) {
            showToast("Error processing file: " + err.message, 'error');
        }
        setProcessingFile(false);
    };

    const updateProjectInDb = async (updates: Partial<ResearchProject>) => {
        if (!currentProject) return;
        const { error } = await supabase.from('research_projects').update(updates).eq('id', currentProject.id);
        if (!error) {
            setCurrentProject({ ...currentProject, ...updates });
        }
    };

    const handleGeneratePodcastScript = async () => {
        if (!currentProject) return;
        setIsGenerating(true);
        try {
            const script = await generatePodcastScriptFromText(currentProject.source_text);
            await updateProjectInDb({ podcast_script: script });
        } catch(e) { showToast("Failed to generate podcast.", 'error'); }
        setIsGenerating(false);
    };

    // Consolidated Speak Logic
    const speakSegment = (index: number) => {
        if (!currentProject?.podcast_script || index >= currentProject.podcast_script.length) {
             setIsPlaying(false);
             setCurrentLine(0);
             return;
        }

        const seg = currentProject.podcast_script[index];
        const isMsRachel = seg.speaker === 'Host 1' || seg.speaker.includes('Rachel') || seg.speaker.includes('Expert');
        
        let voice;
        let rate = 1.0;
        let pitch = 1.0;

        if (isMsRachel) {
             voice = speechManager.getFemaleVoice();
             rate = 0.9; 
             pitch = 1.1;
        } else {
             voice = speechManager.getMaleVoice();
             rate = 0.95; 
             pitch = 0.9;
        }

        speechManager.speak(seg.text, {
            voice,
            rate,
            pitch,
            onEnd: () => setCurrentLine(p => p + 1)
        });
    };

    const togglePlayback = () => {
        if (!currentProject?.podcast_script) return;
        
        if (isPlaying) {
            speechManager.pause();
            setIsPlaying(false);
        } else {
            if (window.speechSynthesis.paused) {
                speechManager.resume();
            } else {
                if (currentLine === -1) {
                    setCurrentLine(0);
                } else {
                    speakSegment(currentLine);
                }
            }
            setIsPlaying(true);
        }
    };

    useEffect(() => {
        if (isPlaying && currentLine >= 0) {
            speakSegment(currentLine);
        }
    }, [currentLine]);

    // Other Tabs
    const handleGenerateSummary = async () => { if (!currentProject) return; setIsGenerating(true); const summary = await generateSummaryFromText(currentProject.source_text); await updateProjectInDb({ summary }); setIsGenerating(false); };
    const handleGenerateQuiz = async () => { if (!currentProject) return; setIsGenerating(true); const questions = await generateQuizFromText(currentProject.source_text); await updateProjectInDb({ quiz_data: questions }); setIsGenerating(false); };
    const handleGenerateGraph = async () => { if (!currentProject) return; setIsGenerating(true); const graphData = await generateInfographicFromText(currentProject.source_text); await updateProjectInDb({ infographic_data: graphData }); setIsGenerating(false); };
    const handleChatSend = async () => { 
        if (!currentProject || !chatInput.trim()) return; 
        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() }; 
        const newHistory = [...(currentProject.chat_history || []), userMsg];
        setCurrentProject({ ...currentProject, chat_history: newHistory }); setChatInput(''); setChatLoading(true);
        try { 
            const historyForAI = newHistory.slice(-10).map(h => ({ role: h.role, text: h.text }));
            const response = await chatWithResearchDocument(userMsg.text, historyForAI, currentProject.source_text);
            const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: response || "Error.", timestamp: Date.now() };
            await updateProjectInDb({ chat_history: [...newHistory, aiMsg] });
        } catch(e) {}
        setChatLoading(false);
    };

    const handleQuizAnswer = (index: number, option: string) => {
        if (showQuizResults) return;
        setQuizAnswers(prev => ({ ...prev, [index]: option }));
    };

    const submitQuiz = () => {
        if (!currentProject?.quiz_data) return;
        let score = 0;
        currentProject.quiz_data.forEach((q, i) => {
            if (quizAnswers[i] === q.correctAnswer) score++;
        });
        setQuizScore(score);
        setShowQuizResults(true);
    };

    const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('research_projects').delete().eq('id', id);
        setResearches(prev => prev.filter(r => r.id !== id));
        showToast("Project deleted", 'info');
    };

    if (view === 'LIST') return (
        <div className="h-full flex flex-col p-6">
             <div className="mb-8 flex justify-between items-end">
                <div><h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-indigo-300 mb-2">Research Lab</h2><p className="text-white/60">Analyze documents with AI.</p></div>
                <label className="cursor-pointer glass-button px-6 py-3 rounded-xl flex items-center gap-2 font-bold bg-blue-600/20 hover:bg-blue-600/40 text-blue-100 border-blue-500/30">
                    {processingFile ? <Loader2 className="animate-spin" /> : <Upload size={20} />} <span>Upload Note / Doc</span>
                    <input type="file" accept=".pdf,.txt,.png,.jpg" className="hidden" onChange={handleFileUpload} disabled={processingFile} />
                </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pb-10">
                {researches.map(r => (
                    <div key={r.id} onClick={() => { setCurrentProject(r); setView('WORKSPACE'); setActiveTab('SUMMARY'); speechManager.stop(); }} className="glass-panel p-6 rounded-2xl group cursor-pointer hover:bg-white/5 transition-all relative">
                        <button onClick={(e) => handleDeleteProject(e, r.id)} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 rounded-lg text-red-300"><Trash2 size={16} /></button>
                        <div className="p-3 bg-blue-500/20 text-blue-300 rounded-xl w-fit mb-4"><FileText size={24} /></div>
                        <h3 className="text-xl font-bold mb-2 line-clamp-1">{r.title}</h3>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col p-4 md:p-6 relative">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setView('LIST')} className="p-2 glass-button rounded-lg"><ChevronLeft /></button>
                <div className="flex-1"><h2 className="text-xl font-bold">{currentProject?.title}</h2></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {[ { id: 'SUMMARY', icon: FileText, label: 'Summary' }, { id: 'CHAT', icon: MessageSquare, label: 'Chat' }, { id: 'QUIZ', icon: Zap, label: 'Quiz' }, { id: 'GRAPH', icon: Network, label: 'Infographic' }, { id: 'PODCAST', icon: Headphones, label: 'Podcast' } ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black' : 'glass-button text-white/70'}`}><tab.icon size={18} /> {tab.label}</button>
                ))}
            </div>
            <div className="flex-1 glass-panel rounded-2xl overflow-hidden relative border-white/10 bg-black/20 flex flex-col">
                {isGenerating && <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"><Loader2 size={48} className="text-cyan-400 animate-spin" /><p className="font-bold animate-pulse">Generating...</p></div>}
                
                {activeTab === 'SUMMARY' && (
                    !currentProject?.summary ? <div className="flex-1 flex flex-col items-center justify-center opacity-50"><FileText size={64} className="mb-4"/><button onClick={handleGenerateSummary} className="glass-button px-8 py-3 rounded-full font-bold">Generate Summary</button></div> 
                    : <div className="flex-1 overflow-y-auto custom-scrollbar p-8"><div className="prose prose-invert max-w-none">{renderRichText(currentProject.summary)}</div></div>
                )}

                {activeTab === 'CHAT' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">{currentProject?.chat_history?.map(msg => <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : ''}`}><div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-cyan-900/40 border-cyan-500/30' : 'bg-white/10'}`}>{renderRichText(msg.text)}</div></div>)}<div ref={chatEndRef} /></div>
                        <div className="p-4 bg-black/20 border-t border-white/10 flex gap-2"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3" placeholder="Ask about the note..." /><button onClick={handleChatSend} className="p-3 bg-cyan-600 rounded-xl"><Send size={20}/></button></div>
                    </div>
                )}

                {activeTab === 'QUIZ' && (
                    !currentProject?.quiz_data ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                            <Zap size={64} className="mb-4"/>
                            <button onClick={handleGenerateQuiz} className="glass-button px-8 py-3 rounded-full font-bold">Generate Quiz</button>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                             {showQuizResults && (
                                <div className="mb-8 p-6 bg-green-500/20 border border-green-500 rounded-2xl text-center">
                                    <h3 className="text-2xl font-bold mb-2">Quiz Results</h3>
                                    <p className="text-lg">You scored <span className="text-green-400 font-bold">{quizScore}</span> out of {currentProject.quiz_data.length}</p>
                                </div>
                            )}
                            
                            <div className="space-y-8">
                                {currentProject.quiz_data.map((q, i) => {
                                    const userAnswer = quizAnswers[i];
                                    const isCorrect = userAnswer === q.correctAnswer;
                                    
                                    return (
                                        <div key={i} className="p-6 glass-panel rounded-xl">
                                            <p className="font-bold text-lg mb-4 flex gap-2">
                                                <span className="text-white/50">{i+1}.</span> {q.question}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {q.options.map((opt, idx) => {
                                                    let className = "p-3 rounded-lg border text-left transition-all ";
                                                    
                                                    if (showQuizResults) {
                                                        if (opt === q.correctAnswer) className += "bg-green-500/30 border-green-500 text-white";
                                                        else if (opt === userAnswer && !isCorrect) className += "bg-red-500/30 border-red-500 text-white";
                                                        else className += "border-white/10 opacity-50";
                                                    } else {
                                                        className += userAnswer === opt ? "bg-cyan-500/30 border-cyan-500" : "border-white/10 hover:bg-white/5";
                                                    }

                                                    return (
                                                        <button 
                                                            key={idx}
                                                            disabled={showQuizResults}
                                                            onClick={() => handleQuizAnswer(i, opt)}
                                                            className={className}
                                                        >
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {showQuizResults && (
                                                <div className="mt-4 text-sm text-white/60 p-3 bg-white/5 rounded-lg">
                                                    <strong className="text-cyan-400">Explanation:</strong> {q.explanation}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {!showQuizResults && (
                                <div className="mt-8 flex justify-center">
                                    <button 
                                        onClick={submitQuiz}
                                        disabled={Object.keys(quizAnswers).length < currentProject.quiz_data.length}
                                        className="glass-button px-8 py-3 rounded-full font-bold bg-green-600/20 hover:bg-green-600/40 text-green-100 disabled:opacity-50"
                                    >
                                        Submit Answers
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                )}

                {activeTab === 'GRAPH' && (
                    !currentProject?.infographic_data ? <div className="flex-1 flex flex-col items-center justify-center opacity-50"><Network size={64} className="mb-4"/><button onClick={handleGenerateGraph} className="glass-button px-8 py-3 rounded-full font-bold">Generate Concept Map</button></div>
                    : <ConceptMap overrideData={currentProject.infographic_data} />
                )}

                {activeTab === 'PODCAST' && (
                    !currentProject?.podcast_script ? <div className="flex-1 flex flex-col items-center justify-center opacity-50"><Headphones size={64} className="mb-4"/><button onClick={handleGeneratePodcastScript} className="glass-button px-8 py-3 rounded-full font-bold">Generate Script</button></div>
                    : <div className="flex-1 flex flex-col h-full relative">
                        <div className="flex justify-between items-center p-6 bg-white/5 border-b border-white/10 z-10">
                            <div className="flex items-center gap-6">
                                <button onClick={togglePlayback} className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform ${isPlaying ? 'bg-red-500' : 'bg-green-500'}`}>{isPlaying ? <Pause fill="white"/> : <Play fill="white"/>}</button>
                                <div><h3 className="font-bold">Podcast</h3><div className="text-sm opacity-50">Browser TTS (Optimized)</div></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-black/20">
                            {currentProject.podcast_script.map((seg, i) => {
                                const isMsRachel = seg.speaker === 'Host 1' || seg.speaker.includes('Rachel') || seg.speaker.includes('Expert');
                                return (
                                <div key={i} className={`flex gap-4 ${!isMsRachel ? 'flex-row-reverse' : ''} ${currentLine === i && isPlaying ? 'opacity-100 scale-[1.01] bg-white/5 p-2 rounded-xl' : 'opacity-70'} transition-all`}>
                                    <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center border-2 ${isMsRachel ? 'bg-cyan-900/50 border-cyan-500' : 'bg-purple-900/50 border-purple-500'}`}>{isMsRachel ? '👩‍🔬' : '👨‍🎓'}</div>
                                    <div className="p-2 flex-1">
                                        <div className="text-xs opacity-50 font-bold mb-1 uppercase">{isMsRachel ? 'Ms. Rachel' : 'Rohan'}</div>
                                        {seg.text}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ResearchMode;