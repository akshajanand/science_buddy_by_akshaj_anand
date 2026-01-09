import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle, Brain, Volume2, Search, StopCircle, Atom, Puzzle, RefreshCw, Gauge, Podcast, Radio, Trophy, Play, Pause, Download, RotateCcw, List, Save, Trash2, Library, X, Loader2, Headphones } from 'lucide-react';
import { generateQuizQuestions, generateWordPuzzle, generateStudyPodSummary, generateMatchingPairs, generatePodcastScript } from '../services/aiService';
import { QuizQuestion, PuzzleWord, MatchCard, PodcastSegment, StudyItem } from '../types';
import { speechManager } from '../utils/audioUtils';
import { supabase } from '../services/supabaseClient';
import { showToast } from '../utils/notificationUtils';

// --- Mind Match Component ---
export const MindMatch: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [cards, setCards] = useState<MatchCard[]>([]);
    const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
    const [loading, setLoading] = useState(false);
    const [matches, setMatches] = useState(0);
    const [errorId, setErrorId] = useState<string | null>(null);

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
            setMatches(m => m + 1);
            setSelectedCard(null);
        } else {
            setErrorId(card.id);
            setTimeout(() => { setErrorId(null); setSelectedCard(null); }, 800);
        }
    };

    if (!cards.length && !loading) return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Puzzle size={64} className="mb-4 text-green-300" /><h2 className="text-3xl font-bold mb-4">Mind Match</h2>
            <div className="relative w-full max-w-md"><input className="w-full bg-white/10 rounded-full px-6 py-4 border border-white/20" placeholder="Topic (e.g. Gravity)" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStart()} /><button onClick={handleStart} className="absolute right-1 top-1 bottom-1 glass-button px-6 rounded-full active:scale-95 transition-transform">Generate</button></div>
        </div>
    )

    if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-xl">Generating...</div>;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
             <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">{topic}</h2><button onClick={() => setCards([])}><RefreshCw/></button></div>
             {matches === cards.length / 2 ? <div className="flex-1 flex flex-col items-center justify-center"><h1 className="text-5xl font-bold text-green-300">Done!</h1><button onClick={() => setCards([])} className="mt-4 glass-button px-6 py-3 rounded-full">Again</button></div> : 
             <div className="flex-1 overflow-y-auto custom-scrollbar"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-10">{cards.map((card, idx) => <button key={idx} onClick={() => handleCardClick(card)} className={`glass-button p-4 rounded-xl min-h-[120px] flex items-center justify-center text-center transition-all active:scale-95 ${card.isMatched ? 'opacity-20 bg-green-500' : selectedCard === card ? 'bg-yellow-500/30 border-yellow-400' : errorId === card.id && selectedCard ? 'bg-red-500/30 animate-pulse' : 'bg-white/5'}`}>{card.text}</button>)}</div></div>}
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
                <button onClick={() => setMode('SUMMARY')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'SUMMARY' ? 'bg-cyan-500 text-white' : 'text-white/50'}`}>Summary</button>
                <button onClick={() => setMode('PODCAST')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'PODCAST' ? 'bg-purple-500 text-white' : 'text-white/50'}`}>Podcast</button>
            </div>
            
            <div className="flex gap-2 w-full max-w-2xl mb-6">
                <input className="flex-1 bg-white/10 rounded-xl px-4 py-3 border border-white/10 focus:border-cyan-400 outline-none" placeholder={mode === 'SUMMARY' ? "Enter topic for Summary..." : "Enter topic for Podcast..."} value={topic} onChange={e => setTopic(e.target.value)} />
                <button onClick={handleGenerate} disabled={loading || !topic} className="glass-button px-6 rounded-xl font-bold bg-white/10 hover:bg-white/20 active:scale-95 transition-transform">
                    {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                </button>
            </div>

            {hasContent && (
                 <div className="w-full max-w-3xl flex items-center justify-between bg-black/40 p-4 rounded-2xl mb-4 border border-white/10">
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
                    summary ? <p className="leading-relaxed text-lg whitespace-pre-wrap">{summary}</p> : <div className="h-full flex items-center justify-center opacity-30">Enter a topic to generate a summary.</div>
                ) : (
                    podcastScript.length > 0 ? (
                        <div className="space-y-4">
                             {podcastScript.map((seg, i) => (
                                <div key={i} className={`flex gap-4 ${seg.speaker === 'Host 2' ? 'flex-row-reverse' : ''} ${currentPodcastLine === i ? 'opacity-100 scale-[1.01] bg-white/5 rounded-xl' : 'opacity-70'} transition-all p-2`}>
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

export const QuizModule: React.FC = () => { return <div></div> }; 
export const WordPuzzle: React.FC = () => { return <div></div> };