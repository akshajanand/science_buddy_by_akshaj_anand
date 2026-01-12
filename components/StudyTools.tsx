import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle, Brain, Volume2, Search, StopCircle, Atom, Puzzle, RefreshCw, Gauge, Podcast, Radio, Trophy, Play, Pause, Download, RotateCcw, List, Save, Trash2, Library, X, Loader2, Headphones, Zap, ArrowRight, ArrowLeft, Grid, XCircle } from 'lucide-react';
import { generateQuizQuestions, generateWordPuzzle, generateStudyPodSummary, generateMatchingPairs, generatePodcastScript } from '../services/aiService';
import { QuizQuestion, PuzzleWord, MatchCard, PodcastSegment, StudyItem } from '../types';
import { speechManager } from '../utils/audioUtils';
import { supabase } from '../services/supabaseClient';
import { showToast } from '../utils/notificationUtils';

// Helper for AI XP Reward
const awardXP = async (userId: string, amount: number, activity: string) => {
    try {
        await supabase.rpc('increment_score', { row_id: userId, points: amount });
        showToast(`AI Reward: +${amount} XP for ${activity}! 🌟`, 'success');
    } catch (e) {
        console.error("XP Error", e);
    }
};

// --- Mind Match Component ---
export const MindMatch: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [cards, setCards] = useState<MatchCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState(0);
    const [errorId, setErrorId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Quick fetch of user ID for XP
        const userStr = localStorage.getItem('science_buddy_user');
        if (userStr) setUserId(JSON.parse(userStr).id);
    }, []);

    const handleStart = async () => {
        if (!topic) return;
        setLoading(true);
        setCards([]);
        setMatches(0);
        setSelectedCard(null);

        const pairs = await generateMatchingPairs(topic);
        const deck: MatchCard[] = [];
        pairs.forEach(p => {
            deck.push({ id: p.id, text: p.term, type: 'term', isMatched: false });
            deck.push({ id: p.id, text: p.definition, type: 'def', isMatched: false });
        });
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        setCards(deck);
        setLoading(false);
    };

    const handleCardClick = (card: MatchCard) => {
        if (card.isMatched || loading || errorId) return;
        if (!selectedCard) {
            setSelectedCard(card);
            return;
        }
        if (selectedCard === card) {
            setSelectedCard(null);
            return;
        }
        if (selectedCard.id === card.id) {
            setCards(prev => prev.map(c => c.id === card.id ? { ...c, isMatched: true } : c));
            setMatches(m => {
                const newM = m + 1;
                // Game Over Check
                if (newM === cards.length / 2) {
                     if (userId) awardXP(userId, 50, "Completing Mind Match");
                }
                return newM;
            });
            setSelectedCard(null);
        } else {
            setErrorId(card.id);
            setTimeout(() => { setErrorId(null); setSelectedCard(null); }, 800);
        }
    };

    if (!cards.length && !loading) return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-in fade-in zoom-in">
            <Puzzle size={64} className="mb-4 text-green-300" /><h2 className="text-3xl font-bold mb-4">Mind Match</h2>
            <div className="relative w-full max-w-md"><input className="w-full bg-white/10 rounded-full px-6 py-4 border border-white/20 outline-none focus:border-green-400 transition-colors" placeholder="Topic (e.g. Gravity)" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStart()} /><button onClick={handleStart} className="absolute right-2 top-2 bottom-2 glass-button px-6 rounded-full active:scale-95 transition-transform bg-green-500/20 hover:bg-green-500/40 font-bold">Start</button></div>
        </div>
    )

    if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-xl text-green-300"><Loader2 className="animate-spin mr-2"/> Creating Game...</div>;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
             <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">{topic}</h2><button onClick={() => setCards([])}><RefreshCw/></button></div>
             {matches === cards.length / 2 ? <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in"><h1 className="text-5xl font-bold text-green-300 animate-bounce">Done!</h1><button onClick={() => setCards([])} className="mt-4 glass-button px-6 py-3 rounded-full font-bold">Play Another</button></div> : 
             <div className="flex-1 overflow-y-auto custom-scrollbar"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-10">{cards.map((card, idx) => <button key={idx} onClick={() => handleCardClick(card)} className={`glass-button p-4 rounded-xl min-h-[120px] flex items-center justify-center text-center transition-all active:scale-95 text-sm md:text-base font-medium ${card.isMatched ? 'opacity-20 bg-green-500' : selectedCard === card ? 'bg-yellow-500/30 border-yellow-400 scale-105' : errorId === card.id && selectedCard ? 'bg-red-500/30 animate-pulse border-red-500' : 'bg-white/5 hover:bg-white/10'}`}>{card.text}</button>)}</div></div>}
        </div>
    );
};

interface StudyPodProps {
    userId?: string;
}

// --- Study Pod Component ---
export const StudyPod: React.FC<StudyPodProps> = ({ userId }) => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [summary, setSummary] = useState('');
    const [mode, setMode] = useState<'SUMMARY' | 'PODCAST'>('SUMMARY');
    const [savedItems, setSavedItems] = useState<StudyItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    
    // Podcast State
    const [podcastScript, setPodcastScript] = useState<PodcastSegment[]>([]);
    const [currentPodcastLine, setCurrentPodcastLine] = useState(-1);
    
    useEffect(() => {
        if (userId) fetchSavedItems();
        return () => { speechManager.stop(); }
    }, [userId]);

    const fetchSavedItems = async () => {
        if (!userId) return;
        const { data } = await supabase.from('study_library').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setSavedItems(data);
    };

    const handleSave = async () => {
        if (!userId) {
            showToast("User ID not found. Cannot save.", 'error');
            return;
        }
        const contentToSave = mode === 'SUMMARY' ? summary : podcastScript;
        if (!contentToSave || (Array.isArray(contentToSave) && contentToSave.length === 0)) return;
        
        setIsSaving(true);
        
        const { data, error } = await supabase.from('study_library').insert({
            user_id: userId,
            topic: topic || 'Untitled',
            type: mode,
            content: contentToSave
        }).select().single();

        if (!error && data) {
            setSavedItems(prev => [data, ...prev]);
            showToast("Saved to Library!", 'success');
            // Award XP
            awardXP(userId, 10, "Saving Study Pod");
        } else {
            console.error(error);
            showToast("Failed to save: " + error.message, 'error');
        }
        setIsSaving(false);
    };

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        speechManager.stop();
        setPlaying(false);
        setCurrentPodcastLine(-1);
        
        if (mode === 'SUMMARY') {
            const text = await generateStudyPodSummary(topic);
            setSummary(text);
            // Auto-play
            speechManager.speak(text, {
                voice: speechManager.getFemaleVoice(),
                onStart: () => setPlaying(true),
                onEnd: () => setPlaying(false)
            });
        } else {
            const script = await generatePodcastScript(topic);
            setPodcastScript(script);
            // Auto-play
            setCurrentPodcastLine(0);
            setPlaying(true);
        }
        
        if (userId) awardXP(userId, 15, "Generating Study Pod");
        setLoading(false);
    };

    // Consolidated Speak Logic
    const speakSegment = (index: number) => {
        if (index >= podcastScript.length) { 
            setPlaying(false); 
            setCurrentPodcastLine(0); 
            return; 
        }

        const seg = podcastScript[index];
        
        let voice;
        let rate = 1.0;
        let pitch = 1.0;

        if (seg.speaker === 'Host 1') {
            voice = speechManager.getFemaleVoice(); // Ms. Rachel
            rate = 0.9; 
            pitch = 1.1; 
        } else {
            voice = speechManager.getMaleVoice(); // Rohan
            rate = 0.95; // Fixed: Rohan back to 0.95
            pitch = 0.9; 
        }
        
        speechManager.speak(seg.text, {
            voice,
            rate,
            pitch,
            onEnd: () => {
                setCurrentPodcastLine(p => p + 1);
            }
        });
    };

    // Toggle Play/Pause
    const togglePlayback = () => {
        if (mode === 'SUMMARY') {
            if (playing) {
                speechManager.pause();
                setPlaying(false);
            } else {
                // Resume summary logic
                if (window.speechSynthesis.paused) {
                    speechManager.resume();
                } else if (summary) {
                    speechManager.speak(summary, {
                         voice: speechManager.getFemaleVoice(),
                         onEnd: () => setPlaying(false)
                    });
                }
                setPlaying(true);
            }
            return;
        }

        // Podcast Logic
        if (playing) {
            speechManager.pause();
            setPlaying(false);
        } else {
            if (window.speechSynthesis.paused) {
                 speechManager.resume();
            } else {
                 // Start or Restart line
                 if (currentPodcastLine === -1) {
                     setCurrentPodcastLine(0);
                 } else {
                     speakSegment(currentPodcastLine);
                 }
            }
            setPlaying(true);
        }
    };

    // Podcast Play Loop Effect
    useEffect(() => {
        if (mode === 'PODCAST' && playing && currentPodcastLine >= 0) {
            speakSegment(currentPodcastLine);
        }
    }, [currentPodcastLine]); // Removed playing from deps to prevent restart loop on resume

    const loadItem = (item: StudyItem) => {
        setTopic(item.topic);
        setMode(item.type);
        setShowLibrary(false);
        if (item.type === 'SUMMARY') setSummary(item.content);
        else setPodcastScript(item.content);
        setPlaying(false);
        speechManager.stop();
        setCurrentPodcastLine(-1);
    };

    const deleteItem = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('study_library').delete().eq('id', id);
        setSavedItems(prev => prev.filter(i => i.id !== id));
        showToast("Removed from library", 'info');
    };

    const hasContent = (mode === 'SUMMARY' && summary) || (mode === 'PODCAST' && podcastScript.length > 0);

    return (
        <div className="h-full flex flex-col items-center p-6 relative overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowLibrary(!showLibrary)} className="absolute top-6 right-6 p-3 glass-button rounded-full z-20 active:scale-95 transition-transform"><Library size={24} /></button>
            
            {/* Library Overlay - Improved UI */}
            {showLibrary && (
                <div className="absolute inset-0 z-50 glass-panel bg-[#13131a]/95 backdrop-blur-xl flex flex-col p-6 animate-in slide-in-from-right duration-300 rounded-none md:rounded-2xl">
                    <div className="flex justify-between mb-6 border-b border-white/10 pb-4">
                        <h2 className="text-2xl md:text-3xl font-bold flex gap-2 items-center text-cyan-300"><Library/> Saved Pods</h2>
                        <button onClick={() => setShowLibrary(false)} className="glass-button p-2 md:px-4 md:py-2 rounded-lg hover:bg-white/20"><X size={24}/></button>
                    </div>
                    {savedItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                            <Headphones size={64} className="mb-4" />
                            <p>No saved pods yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar">
                            {savedItems.map(item => (
                                <div key={item.id} onClick={() => loadItem(item)} className="glass-panel p-4 rounded-xl cursor-pointer hover:bg-white/10 relative group flex justify-between items-center border border-white/10 active:scale-95 transition-transform">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${item.type === 'SUMMARY' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'}`}>
                                            {item.type === 'SUMMARY' ? <List size={20}/> : <Podcast size={20}/>}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">{item.topic}</h3>
                                            <p className="text-xs opacity-50 font-mono mt-1">{item.type} • {new Date(item.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <button onClick={(e) => deleteItem(e, item.id)} className="text-white/30 hover:text-red-400 p-2 transition-colors"><Trash2 size={18}/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center gap-4 mb-8">
                 <Headphones size={40} className="text-cyan-300" />
                 <h1 className="text-3xl font-bold">Study Pod</h1>
            </div>

            <div className="flex bg-white/10 p-1 rounded-xl mb-6 w-full max-w-sm">
                <button onClick={() => setMode('SUMMARY')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'SUMMARY' ? 'bg-cyan-500 text-white' : 'text-white/50'}`}>Summary</button>
                <button onClick={() => setMode('PODCAST')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'PODCAST' ? 'bg-purple-500 text-white' : 'text-white/50'}`}>Podcast</button>
            </div>
            
            <div className="flex gap-2 w-full max-w-2xl mb-6">
                <input className="flex-1 bg-white/10 rounded-xl px-4 py-3 border border-white/10 focus:border-cyan-400 outline-none transition-colors" placeholder={mode === 'SUMMARY' ? "Enter topic for Summary..." : "Enter topic for Podcast..."} value={topic} onChange={e => setTopic(e.target.value)} />
                <button onClick={handleGenerate} disabled={loading || !topic} className="glass-button px-6 rounded-xl font-bold bg-white/10 hover:bg-white/20 active:scale-95 transition-transform">
                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                </button>
            </div>

            {hasContent && (
                 <div className="w-full max-w-3xl flex items-center justify-between bg-black/40 p-4 rounded-2xl mb-4 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlayback} className={`w-12 h-12 rounded-full flex items-center justify-center ${playing ? 'bg-red-500' : 'bg-green-500'} text-white shadow-lg active:scale-90 transition-transform`}>
                            {playing ? <Pause fill="white"/> : <Play fill="white" className="ml-1"/>}
                        </button>
                        <div>
                            <div className="text-sm font-bold opacity-70 uppercase tracking-widest">{mode} Player</div>
                            <div className="font-bold">{topic}</div>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={isSaving} className="glass-button px-4 py-2 rounded-lg flex items-center gap-2 text-sm bg-white/5 hover:bg-white/10 active:scale-95">
                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16} />} Save
                    </button>
                 </div>
            )}

            <div className="w-full max-w-3xl glass-panel p-6 rounded-xl min-h-[300px] flex-1 overflow-y-auto custom-scrollbar">
                {mode === 'SUMMARY' ? (
                    summary ? <p className="leading-relaxed text-lg whitespace-pre-wrap animate-in fade-in">{summary}</p> : <div className="h-full flex items-center justify-center opacity-30">Enter a topic to generate a summary.</div>
                ) : (
                    podcastScript.length > 0 ? (
                        <div className="space-y-4">
                             {podcastScript.map((seg, i) => (
                                <div key={i} className={`flex gap-4 ${seg.speaker === 'Host 2' ? 'flex-row-reverse' : ''} ${currentPodcastLine === i ? 'opacity-100 scale-[1.01] bg-white/5 rounded-xl' : 'opacity-70'} transition-all p-2 duration-500`}>
                                     <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold border ${seg.speaker === 'Host 1' ? 'bg-cyan-900 border-cyan-500' : 'bg-purple-900 border-purple-500'}`}>{seg.speaker === 'Host 1' ? 'R' : 'Ro'}</div>
                                     <div className="p-2 rounded-xl flex-1 text-base">{seg.text}</div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="h-full flex items-center justify-center opacity-30">Enter a topic to generate a podcast.</div>
                )}
            </div>
        </div>
    );
};

// --- Flash Quiz Component ---
export const QuizModule: React.FC = () => { 
    const [topic, setTopic] = useState('');
    const [questionCount, setQuestionCount] = useState(5);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [quizComplete, setQuizComplete] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('science_buddy_user');
        if (userStr) setUserId(JSON.parse(userStr).id);
    }, []);

    const startQuiz = async () => {
        if (!topic) return;
        setLoading(true);
        setQuestions([]);
        setQuizComplete(false);
        setScore(0);
        setCurrentIndex(0);
        
        try {
            const qs = await generateQuizQuestions(topic, questionCount, 'General Science');
            setQuestions(qs);
        } catch(e) { showToast("Failed to gen quiz", 'error'); }
        setLoading(false);
    };

    const handleAnswer = (option: string) => {
        if (selectedOption) return;
        setSelectedOption(option);
        const correct = option === questions[currentIndex].correctAnswer;
        setIsCorrect(correct);
        if (correct) {
            setScore(s => s + 1);
        }
        
        setTimeout(() => {
            if (currentIndex + 1 < questions.length) {
                setCurrentIndex(p => p + 1);
                setSelectedOption(null);
                setIsCorrect(null);
            } else {
                setQuizComplete(true);
                // Award XP based on final score
                const finalScore = isCorrect ? score + 1 : score;
                if (userId) awardXP(userId, finalScore * 2, "Flash Quiz Performance");
            }
        }, 1500);
    };

    if (quizComplete) return (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-in zoom-in">
            <Trophy size={64} className="text-yellow-400 mb-4 drop-shadow-lg" />
            <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-xl mb-6">You scored {score} out of {questions.length}</p>
            <button onClick={() => setQuestions([])} className="glass-button px-8 py-3 rounded-full font-bold">New Quiz</button>
        </div>
    );

    if (questions.length === 0) return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <Zap size={64} className="mb-4 text-yellow-300" />
            <h2 className="text-3xl font-bold mb-4">Flash Quiz</h2>
            <p className="mb-8 opacity-60">Generate a custom test on any topic.</p>
            
            <div className="w-full max-w-md space-y-6">
                <div className="relative">
                     <input className="w-full bg-white/10 rounded-full px-6 py-4 border border-white/20 outline-none focus:border-yellow-400 transition-colors" placeholder="Topic (e.g. Friction)" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startQuiz()} />
                </div>
                
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <label className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2 opacity-70">
                        <span>Number of Questions</span>
                        <span>{questionCount}</span>
                    </label>
                    <input 
                        type="range" 
                        min="5" 
                        max="30" 
                        step="5"
                        value={questionCount} 
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                    />
                    <div className="flex justify-between text-[10px] opacity-40 mt-1">
                        <span>5</span>
                        <span>30</span>
                    </div>
                </div>

                <button onClick={startQuiz} disabled={loading || !topic} className="w-full glass-button py-4 rounded-full font-bold bg-gradient-to-r from-yellow-600/50 to-orange-600/50 hover:scale-[1.02] transition-transform">
                    {loading ? <Loader2 className="animate-spin inline mr-2" /> : 'Start Quiz'}
                </button>
            </div>
        </div>
    );

    const currentQ = questions[currentIndex];
    return (
        <div className="h-full flex flex-col p-6 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
                <button onClick={() => setQuestions([])} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft /></button>
                <div className="flex flex-col items-end">
                    <span className="text-xs text-white/50 uppercase tracking-widest">Question {currentIndex + 1} / {questions.length}</span>
                    <div className="w-32 bg-white/10 h-1.5 rounded-full mt-1">
                        <div className="bg-cyan-400 h-full rounded-full transition-all duration-300" style={{width: `${((currentIndex + 1)/questions.length)*100}%`}}></div>
                    </div>
                </div>
            </div>

            {/* Score Pill */}
            <div className="self-center bg-black/20 px-4 py-1 rounded-full border border-white/5 text-sm font-mono text-yellow-300 mb-6">
                Score: {score} pts
            </div>

            {/* Question Card */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl mb-6 min-h-[160px] flex items-center justify-center text-center shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-right-4">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-purple-500"></div>
                <h3 className="text-xl md:text-2xl font-medium leading-relaxed">{currentQ.question}</h3>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((opt, i) => {
                    let btnClass = "glass-button p-5 rounded-xl text-left transition-all hover:bg-white/10 border border-white/10 relative overflow-hidden group";
                    let icon = <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center text-xs group-hover:border-white/80">{String.fromCharCode(65 + i)}</div>;
                    
                    if (selectedOption) {
                        if (opt === currentQ.correctAnswer) {
                            btnClass = "bg-green-500/20 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                            icon = <CheckCircle size={24} className="text-green-400" />;
                        } else if (opt === selectedOption) {
                            btnClass = "bg-red-500/20 border-red-500 text-white opacity-80";
                            icon = <XCircle size={24} className="text-red-400" />;
                        } else {
                            btnClass = "bg-black/20 opacity-30 border-transparent";
                        }
                    }

                    return (
                        <button 
                            key={i} 
                            onClick={() => handleAnswer(opt)}
                            disabled={!!selectedOption}
                            className={btnClass}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                {icon}
                                <span className="font-medium">{opt}</span>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Explanation */}
            {selectedOption && (
                <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-green-900/20 border-green-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                        <div className="flex items-center gap-2 mb-2 font-bold uppercase text-xs tracking-wider opacity-70">
                            {isCorrect ? <CheckCircle size={14} /> : <ArrowRight size={14}/>}
                            Explanation
                        </div>
                        <p className="text-sm md:text-base opacity-90">{currentQ.explanation}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Word Mine (Puzzle) Component ---
export const WordPuzzle: React.FC = () => { 
    const [topic, setTopic] = useState('');
    const [words, setWords] = useState<PuzzleWord[]>([]);
    const [grid, setGrid] = useState<string[][]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCells, setSelectedCells] = useState<{r:number, c:number}[]>([]);
    const [foundCount, setFoundCount] = useState(0);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const userStr = localStorage.getItem('science_buddy_user');
        if (userStr) setUserId(JSON.parse(userStr).id);
    }, []);

    const gridSize = 10;

    const startPuzzle = async () => {
        if (!topic) return;
        setLoading(true);
        setWords([]);
        setGrid([]);
        setFoundCount(0);
        setSelectedCells([]);

        const puzzleData = await generateWordPuzzle(topic);
        if (puzzleData.length > 0) {
            // Generate Grid Client Side
            const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
            const placedWords: PuzzleWord[] = [];

            // Simple placement logic
            for (let pw of puzzleData) {
                const word = pw.word.toUpperCase().replace(/[^A-Z]/g, '');
                if (word.length > gridSize) continue;
                
                let placed = false;
                let attempts = 0;
                while (!placed && attempts < 50) {
                    const dir = Math.random() > 0.5 ? 'H' : 'V';
                    const row = Math.floor(Math.random() * (dir === 'H' ? gridSize : gridSize - word.length));
                    const col = Math.floor(Math.random() * (dir === 'H' ? gridSize - word.length : gridSize));
                    
                    // Check collision
                    let canPlace = true;
                    for (let i=0; i<word.length; i++) {
                        const r = dir === 'H' ? row : row + i;
                        const c = dir === 'H' ? col + i : col;
                        if (newGrid[r][c] !== '' && newGrid[r][c] !== word[i]) {
                            canPlace = false; break;
                        }
                    }
                    
                    if (canPlace) {
                        for (let i=0; i<word.length; i++) {
                            const r = dir === 'H' ? row : row + i;
                            const c = dir === 'H' ? col + i : col;
                            newGrid[r][c] = word[i];
                        }
                        placedWords.push({...pw, word: word}); // Use clean word
                        placed = true;
                    }
                    attempts++;
                }
            }

            // Fill empty
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            for(let r=0; r<gridSize; r++) {
                for(let c=0; c<gridSize; c++) {
                    if (newGrid[r][c] === '') newGrid[r][c] = chars[Math.floor(Math.random() * chars.length)];
                }
            }
            
            setGrid(newGrid);
            setWords(placedWords);
        }
        setLoading(false);
    };

    const handleCellClick = (r: number, c: number) => {
        // Toggle selection
        const idx = selectedCells.findIndex(cell => cell.r === r && cell.c === c);
        let newSelection = [];
        if (idx >= 0) {
            newSelection = selectedCells.filter((_, i) => i !== idx);
        } else {
            newSelection = [...selectedCells, {r, c}];
        }
        setSelectedCells(newSelection);
        
        const checkWord = (str: string) => {
            const foundIdx = words.findIndex(w => !w.found && w.word === str);
            if (foundIdx >= 0) {
                const newWords = [...words];
                newWords[foundIdx].found = true;
                setWords(newWords);
                const newFoundCount = foundCount + 1;
                setFoundCount(newFoundCount);
                
                // XP REWARD
                if (userId) awardXP(userId, 5, "Word Found");
                
                if (newFoundCount === words.length && userId) {
                    awardXP(userId, 50, "Completed Word Puzzle");
                }

                setSelectedCells([]);
                showToast(`Found: ${str}`, 'success');
                return true;
            }
            return false;
        };
        
        // Check string combinations
        const sorted = [...newSelection].sort((a,b) => (a.r - b.r) || (a.c - b.c));
        const str = sorted.map(cell => grid[cell.r][cell.c]).join('');
        
        if (!checkWord(str)) {
             const clickStr = newSelection.map(cell => grid[cell.r][cell.c]).join('');
             checkWord(clickStr);
        }
    };

    if (!words.length && !loading) return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <Grid size={64} className="mb-4 text-cyan-300" />
            <h2 className="text-3xl font-bold mb-4">Word Mine</h2>
            <p className="mb-8 opacity-60">Find hidden scientific terms generated by AI.</p>
            <div className="relative w-full max-w-md">
                <input className="w-full bg-white/10 rounded-full px-6 py-4 border border-white/20 outline-none focus:border-cyan-400 transition-colors" placeholder="Topic (e.g. Atoms)" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && startPuzzle()} />
                <button onClick={startPuzzle} disabled={loading || !topic} className="absolute right-2 top-2 bottom-2 glass-button px-6 rounded-full font-bold bg-cyan-500/20 hover:bg-cyan-500/40">{loading ? <Loader2 className="animate-spin" /> : 'Mine'}</button>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col md:flex-row p-6 gap-8 overflow-hidden">
            <div className="flex-1 flex flex-col items-center">
                <div className="flex w-full justify-between items-center mb-4 md:hidden">
                    <h2 className="font-bold text-xl">{topic}</h2>
                    <button onClick={() => setWords([])}><ArrowLeft/></button>
                </div>
                
                <div className="glass-panel p-4 rounded-xl aspect-square w-full max-w-[500px] grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gridTemplateRows: `repeat(${gridSize}, 1fr)` }}>
                    {grid.map((row, r) => row.map((char, c) => {
                        const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c);
                        return (
                            <button 
                                key={`${r}-${c}`} 
                                onClick={() => handleCellClick(r, c)}
                                className={`flex items-center justify-center font-bold text-sm md:text-xl rounded-md transition-colors ${isSelected ? 'bg-cyan-500 text-white' : 'hover:bg-white/10 text-white/70'}`}
                            >
                                {char}
                            </button>
                        );
                    }))}
                </div>
                <div className="mt-4 flex gap-4">
                     <button onClick={() => setSelectedCells([])} className="glass-button px-4 py-2 rounded-full text-xs">Clear Selection</button>
                     {foundCount === words.length && <div className="text-green-400 font-bold animate-bounce">ALL WORDS FOUND!</div>}
                </div>
            </div>

            <div className="w-full md:w-80 glass-panel rounded-xl p-6 flex flex-col overflow-hidden">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Search size={18}/> Clues ({foundCount}/{words.length})</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {words.map((w, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${w.found ? 'bg-green-500/20 border-green-500/50' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`font-bold ${w.found ? 'text-green-300 line-through' : 'text-cyan-300'}`}>
                                    {w.found ? w.word : '???????'}
                                </span>
                                {w.found && <CheckCircle size={14} className="text-green-400"/>}
                            </div>
                            <p className="text-xs opacity-70">{w.clue}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};