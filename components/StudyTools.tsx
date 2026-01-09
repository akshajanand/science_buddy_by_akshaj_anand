import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle, Brain, Volume2, Search, StopCircle, Atom, Puzzle, RefreshCw, Gauge, Podcast, Radio, Trophy, Play, Pause, Download, RotateCcw } from 'lucide-react';
import { generateQuizQuestions, generateWordPuzzle, generateStudyPodSummary, generateMatchingPairs, generatePodcastScript } from '../services/aiService';
import { QuizQuestion, PuzzleWord, MatchCard, PodcastSegment } from '../types';
import { speechManager } from '../utils/audioUtils';

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
        
        // Split pairs into Term cards and Definition cards
        const deck: MatchCard[] = [];
        pairs.forEach(p => {
            deck.push({ id: p.id, text: p.term, type: 'term', isMatched: false });
            deck.push({ id: p.id, text: p.definition, type: 'def', isMatched: false });
        });

        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        setCards(deck);
        setLoading(false);
    };

    const handleCardClick = (card: MatchCard) => {
        if (card.isMatched || loading || errorId) return;

        // If no card selected, select this one
        if (!selectedCard) {
            setSelectedCard(card);
            return;
        }

        // If clicked same card, deselect
        if (selectedCard === card) {
            setSelectedCard(null);
            return;
        }

        // Check Match
        if (selectedCard.id === card.id) {
            // Match found!
            setCards(prev => prev.map(c => c.id === card.id ? { ...c, isMatched: true } : c));
            setMatches(m => m + 1);
            setSelectedCard(null);
        } else {
            // No match
            setErrorId(card.id); // Trigger visual error on current card
            setTimeout(() => {
                setErrorId(null);
                setSelectedCard(null);
            }, 800);
        }
    };

    if (!cards.length && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <Puzzle size={64} className="mb-4 text-green-300" />
                <h2 className="text-3xl font-bold mb-4">Mind Match</h2>
                <p className="mb-8 opacity-70">Connect terms to their definitions to test your understanding.</p>
                <div className="relative w-full max-w-md">
                    <input 
                        className="w-full bg-white/10 rounded-full px-6 py-4 pr-36 border border-white/20 outline-none focus:border-green-400 focus:bg-white/20 transition-all text-lg placeholder-white/40 shadow-lg" 
                        placeholder="Topic (e.g. Friction)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    />
                     <button 
                        onClick={handleStart} 
                        disabled={loading} 
                        className="absolute right-1 top-1 bottom-1 glass-button px-6 rounded-full font-bold text-sm bg-green-500/20 hover:bg-green-400/30 text-green-100 border-none transition-all"
                    >
                        Generate
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="flex h-full items-center justify-center animate-pulse text-xl">Generating Puzzle Pieces...</div>;
    }

    const allMatched = matches > 0 && matches === cards.length / 2;

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Mind Match: {topic}</h2>
                <div className="flex gap-2">
                    <div className="bg-white/10 px-4 py-2 rounded-lg font-mono">
                         Pairs: {matches} / {cards.length / 2}
                    </div>
                    <button onClick={() => setCards([])} className="glass-button p-2 rounded-lg"><RefreshCw size={20}/></button>
                </div>
            </div>

            {allMatched ? (
                 <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-500 mb-4">Perfect Match!</h1>
                    <button onClick={() => setCards([])} className="glass-button px-8 py-3 rounded-full text-xl mt-4">Play Again</button>
                 </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-10">
                        {cards.map((card, idx) => {
                            let styleClass = "bg-white/5 border-white/10 hover:bg-white/10";
                            
                            if (card.isMatched) {
                                styleClass = "bg-green-500/20 border-green-500/50 scale-95 opacity-50 cursor-default";
                            } else if (selectedCard === card) {
                                styleClass = "bg-yellow-500/30 border-yellow-400 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
                            } else if (errorId === card.id && selectedCard) {
                                // Error state when mismatched (shake animation logic would go here)
                                styleClass = "bg-red-500/30 border-red-400 animate-pulse";
                            }

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleCardClick(card)}
                                    className={`glass-button p-4 rounded-xl min-h-[120px] flex items-center justify-center text-center transition-all duration-200 border ${styleClass}`}
                                >
                                    <span className="text-sm md:text-base font-medium leading-snug">{card.text}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Study Pod Component ---
export const StudyPod: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [paused, setPaused] = useState(false);
    const [summary, setSummary] = useState('');
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [usingFallback, setUsingFallback] = useState(false);
    const [mode, setMode] = useState<'SUMMARY' | 'PODCAST'>('SUMMARY');
    
    // Podcast State
    const [podcastScript, setPodcastScript] = useState<PodcastSegment[]>([]);
    const [podcastAudioBlobs, setPodcastAudioBlobs] = useState<string[]>([]);
    const [currentPodcastLine, setCurrentPodcastLine] = useState(-1);
    const [preparingAudio, setPreparingAudio] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // API Keys
    const API_KEY_PRIMARY = "sk_5c0b84721d7a978d7b0eff250b1713726e769e5974d7b811";
    const API_KEY_BACKUP = "sk_1b9f21aeca142775f777d68ff64cdfff596a732660647330";
    
    const VOICE_ID_A = "21m00Tcm4TlvDq8ikWAM"; // Rachel (Female)
    const VOICE_ID_B = "pNInz6obpgDQGcFmaJgB"; // Second Voice (Male)
    
    // Cleanup blobs
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            podcastAudioBlobs.forEach(url => URL.revokeObjectURL(url));
        }
    }, []);

    const callElevenLabs = async (text: string, voiceId: string, apiKey: string) => {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': apiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.9, similarity_boost: 0.8 }
            })
        });
        if (!response.ok) throw new Error("11Labs API Error: " + response.statusText);
        return await response.blob();
    };

    const fetch11LabsAudio = async (text: string, voiceId: string) => {
        try {
            return await callElevenLabs(text, voiceId, API_KEY_PRIMARY);
        } catch (e) {
            console.warn("Primary key failed, switching to backup...", e);
            return await callElevenLabs(text, voiceId, API_KEY_BACKUP);
        }
    };

    const handlePlaySummary = async () => {
        if(!topic) return;
        setLoading(true);
        setSummary('');
        setUsingFallback(false);
        speechManager.stop();
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setPaused(false);
        
        // 1. Generate Summary Text
        const text = await generateStudyPodSummary(topic);
        setSummary(text);

        // 2. Fetch Audio
        try {
            const blob = await fetch11LabsAudio(text, VOICE_ID_A);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url); 
            setLoading(false);
        } catch (e) {
            console.warn("All keys failed, falling back to Browser TTS", e);
            setUsingFallback(true);
            setLoading(false);
            speechManager.speak(text, () => setPlaying(true), () => setPlaying(false));
        }
    };

    const handleGeneratePodcast = async () => {
        if (!topic) return;
        setLoading(true);
        setPodcastScript([]);
        setPodcastAudioBlobs([]);
        setCurrentPodcastLine(-1);
        setUsingFallback(false);
        setPaused(false);
        speechManager.stop();
        
        // 1. Generate Script
        const script = await generatePodcastScript(topic);
        setPodcastScript(script);
        setLoading(false);
        setPreparingAudio(true);

        // 2. Fetch Audio (Try ElevenLabs first, then fallback)
        try {
            const blobs: string[] = [];
            // Sequential fetching for error handling control
            for (let i = 0; i < script.length; i++) {
                const seg = script[i];
                const voice = seg.speaker === 'Host 1' ? VOICE_ID_A : VOICE_ID_B;
                const blob = await fetch11LabsAudio(seg.text, voice);
                blobs.push(URL.createObjectURL(blob));
            }
            setPodcastAudioBlobs(blobs);
            setPreparingAudio(false);
            
            // Start Playing Normal Audio
            setCurrentPodcastLine(0);
            setPlaying(true);
        } catch (e) {
            console.warn("Podcast audio generation failed, switching to fallback.", e);
            setUsingFallback(true);
            setPreparingAudio(false);
            // Start Playing Fallback TTS
            setCurrentPodcastLine(0);
            setPlaying(true);
        }
    };

    // --- Control Handlers ---

    const handleTogglePlay = () => {
        if (playing) {
            // Pause
            if (audioRef.current) audioRef.current.pause();
            if (usingFallback) speechManager.pause();
            setPlaying(false);
            setPaused(true);
        } else {
            // Resume
            if (audioRef.current && (audioUrl || podcastAudioBlobs.length > 0)) audioRef.current.play();
            if (usingFallback) speechManager.resume();
            setPlaying(true);
            setPaused(false);
        }
    };

    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        speechManager.stop();
        setPlaying(false);
        setPaused(false);
        if (mode === 'PODCAST') setCurrentPodcastLine(-1);
    };

    const handleRepeat = () => {
        if (mode === 'SUMMARY' && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
            setPlaying(true);
            setPaused(false);
        } else if (mode === 'PODCAST') {
            setCurrentPodcastLine(0);
            setPlaying(true);
            setPaused(false);
            if(usingFallback) {
                // Manually restart TTS flow for podcast logic below
            }
        }
    };

    const handleDownload = async () => {
        if (mode === 'SUMMARY' && audioUrl) {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `StudyPod_Summary_${topic.replace(/\s+/g, '_')}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (mode === 'PODCAST' && podcastAudioBlobs.length > 0) {
             try {
                 // Fetch all blobs from their object URLs
                 const blobPromises = podcastAudioBlobs.map(url => fetch(url).then(r => r.blob()));
                 const blobs = await Promise.all(blobPromises);
                 
                 // Create a single blob. MP3 concatenation usually works well by just appending the files.
                 const mergedBlob = new Blob(blobs, { type: 'audio/mpeg' });
                 const downloadUrl = URL.createObjectURL(mergedBlob);
                 
                 const a = document.createElement('a');
                 a.href = downloadUrl;
                 a.download = `StudyPod_Podcast_${topic.replace(/\s+/g, '_')}.mp3`;
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 
                 // Cleanup
                 setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            } catch (e) {
                console.error("Error downloading podcast", e);
                alert("Could not prepare download. Please try again.");
            }
        }
    };

    // --- Audio Effects ---

    // Summary Playback Trigger
    useEffect(() => {
        if (mode === 'SUMMARY' && audioUrl && audioRef.current && !usingFallback) {
            audioRef.current.src = audioUrl;
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.play()
                .then(() => {
                    setPlaying(true);
                    setPaused(false);
                })
                .catch(e => {
                    console.error("Playback failed", e);
                    setPlaying(false);
                });
        }
    }, [audioUrl, mode, usingFallback]);

    // Speed Changes
    useEffect(() => {
        if (mode === 'SUMMARY' && audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    // Podcast Playback Logic
    useEffect(() => {
        if (mode !== 'PODCAST' || !playing) return;
        
        // End of script check
        if (currentPodcastLine >= podcastScript.length || currentPodcastLine < 0) {
            setPlaying(false);
            setCurrentPodcastLine(-1);
            return;
        }

        if (usingFallback) {
            // --- Fallback TTS Logic ---
            const seg = podcastScript[currentPodcastLine];
            const voices = speechManager.getVoices();
            
            let voice = null;
            if (seg.speaker === 'Host 1') {
                voice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google US English')) || voices[0];
            } else {
                voice = voices.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google UK English Male')) || voices[1] || voices[0];
            }

            speechManager.speak(
                seg.text, 
                () => {}, // onStart
                () => setCurrentPodcastLine(prev => prev + 1), // onEnd
                voice
            );

        } else {
            // --- Normal Blob Logic ---
            if (currentPodcastLine < podcastAudioBlobs.length && audioRef.current) {
                const blobUrl = podcastAudioBlobs[currentPodcastLine];
                // Only set src if it changed to avoid resetting playback on re-renders
                if (audioRef.current.src !== blobUrl) {
                    audioRef.current.src = blobUrl;
                }
                audioRef.current.playbackRate = 1.0;
                audioRef.current.play().catch(e => {
                    console.error("Playback failed", e);
                    setPlaying(false);
                });
            }
        }
    }, [currentPodcastLine, playing, mode, podcastAudioBlobs, usingFallback, podcastScript]);

    const handleAudioEnded = () => {
        if (mode === 'SUMMARY') {
            setPlaying(false);
            setPaused(false);
        } else {
            // Podcast Mode (Blob): Play next
            if (!usingFallback) {
                setCurrentPodcastLine(prev => prev + 1);
            }
        }
    };

    const hasAudio = (mode === 'SUMMARY' && (audioUrl || usingFallback && summary)) || 
                     (mode === 'PODCAST' && (podcastAudioBlobs.length > 0 || usingFallback && podcastScript.length > 0));

    return (
        <div className="h-full flex flex-col items-center p-6 overflow-y-auto custom-scrollbar">
            {/* Header / Mode Switcher */}
            <div className="flex bg-white/10 p-2 rounded-xl mb-8 w-full max-w-lg">
                <button 
                    onClick={() => { setMode('SUMMARY'); handleStop(); }}
                    className={`flex-1 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all ${mode === 'SUMMARY' ? 'bg-cyan-500 text-white shadow-lg' : 'hover:bg-white/10'}`}
                >
                    <Mic size={24} /> Summary
                </button>
                <button 
                    onClick={() => { setMode('PODCAST'); handleStop(); }}
                    className={`flex-1 py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-3 transition-all ${mode === 'PODCAST' ? 'bg-purple-500 text-white shadow-lg' : 'hover:bg-white/10'}`}
                >
                    <Podcast size={24} /> Podcast
                </button>
            </div>

            <div className="text-center mb-8">
                {mode === 'SUMMARY' ? (
                    <div className="w-48 h-48 mx-auto rounded-full border-4 border-white/10 flex items-center justify-center relative mb-4 bg-black/20">
                        <div className={`absolute inset-0 rounded-full border-t-4 border-cyan-400 ${playing ? 'animate-spin' : ''}`}></div>
                        <Mic size={64} className="opacity-80 text-cyan-200" />
                    </div>
                ) : (
                    <div className="flex justify-center items-center gap-8 mb-6">
                         {/* Host 1: Female */}
                         <div className={`w-32 h-32 rounded-full border-4 border-cyan-500/30 flex items-center justify-center transition-all ${currentPodcastLine !== -1 && podcastScript[currentPodcastLine]?.speaker === 'Host 1' ? 'scale-110 border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.5)]' : 'opacity-50'}`}>
                             <span className="text-5xl">👩‍🔬</span>
                         </div>
                         {/* Host 2: Male */}
                         <div className={`w-32 h-32 rounded-full border-4 border-purple-500/30 flex items-center justify-center transition-all ${currentPodcastLine !== -1 && podcastScript[currentPodcastLine]?.speaker === 'Host 2' ? 'scale-110 border-purple-400 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.5)]' : 'opacity-50'}`}>
                             <span className="text-5xl">👨‍🎓</span>
                         </div>
                    </div>
                )}
                
                <h2 className="text-4xl font-bold mb-3">{mode === 'SUMMARY' ? 'Deep Dive Summary' : 'Science Duo Podcast'}</h2>
                <p className="opacity-70 text-base">
                    {mode === 'SUMMARY' ? 'Enter a topic for an in-depth AI narration.' : 'Listen to Ms. Rachel and Rohan explore the topic!'}
                </p>
                {preparingAudio && <div className="mt-4 text-purple-300 animate-pulse text-base font-bold">Synthesizing Voice Actors...</div>}
                {usingFallback && (playing || paused) && <div className="mt-2 text-yellow-300 text-sm">Using standard voices (High traffic)</div>}
            </div>
            
            <div className="flex flex-col w-full max-w-lg gap-4 mb-8">
                <div className="flex gap-4">
                    <input 
                        className="flex-1 bg-white/10 rounded-xl px-6 py-4 border border-white/20 outline-none focus:border-cyan-400 transition-colors text-lg placeholder-white/40" 
                        placeholder={mode === 'SUMMARY' ? "Topic (e.g. Coal)" : "Topic (e.g. Black Holes)"}
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !loading && !playing && (mode === 'SUMMARY' ? handlePlaySummary() : handleGeneratePodcast())}
                    />
                    {!hasAudio ? (
                        <button 
                            onClick={mode === 'SUMMARY' ? handlePlaySummary : handleGeneratePodcast} 
                            disabled={loading || !topic || preparingAudio}
                            className="glass-button px-8 py-4 rounded-xl font-bold whitespace-nowrap flex items-center gap-2 text-lg"
                        >
                            {loading ? <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full"></div> : (mode === 'SUMMARY' ? 'Listen' : 'Generate')}
                        </button>
                    ) : (
                        <button 
                            onClick={handleStop} 
                            className="glass-button px-8 py-4 rounded-xl font-bold bg-red-500/20 hover:bg-red-500/40 text-red-200 border-red-500/30"
                        >
                            <StopCircle size={28} />
                        </button>
                    )}
                </div>

                {/* Audio Controls */}
                {hasAudio && (
                     <div className="glass-panel p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                         <div className="flex gap-2">
                            <button onClick={handleRepeat} className="p-3 rounded-lg hover:bg-white/10 transition-colors" title="Repeat">
                                <RotateCcw size={24} />
                            </button>
                            <button onClick={handleTogglePlay} className="p-3 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors" title={playing ? "Pause" : "Play"}>
                                {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                            </button>
                            {/* Download Button (Available for both if not fallback) */}
                            {!usingFallback && (
                                <button onClick={handleDownload} className="p-3 rounded-lg hover:bg-white/10 transition-colors" title="Download Audio">
                                    <Download size={24} />
                                </button>
                            )}
                         </div>

                        {/* Speed Control (Summary Only) */}
                        {mode === 'SUMMARY' && !usingFallback && (
                            <div className="flex gap-1 ml-4">
                                {[0.75, 1.0, 1.25, 1.5, 2.0].map(rate => (
                                    <button
                                        key={rate}
                                        onClick={() => setPlaybackSpeed(rate)}
                                        className={`text-xs px-2 py-1 rounded font-bold transition-all ${playbackSpeed === rate ? 'bg-cyan-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                                    >
                                        {rate}x
                                    </button>
                                ))}
                            </div>
                        )}
                     </div>
                )}
            </div>
            
            {/* Audio Element */}
            <audio 
                ref={audioRef} 
                onEnded={handleAudioEnded} 
            />

            {/* Display Text Area */}
            <div className="w-full max-w-3xl glass-panel p-8 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
                {mode === 'SUMMARY' && summary && (
                     <p className="leading-relaxed text-xl text-justify font-serif tracking-wide opacity-90">{summary}</p>
                )}
                {mode === 'PODCAST' && podcastScript.length > 0 && (
                    <div className="space-y-6">
                        {podcastScript.map((seg, i) => (
                            <div key={i} className={`flex gap-6 ${seg.speaker === 'Host 2' ? 'flex-row-reverse' : ''} ${currentPodcastLine === i ? 'opacity-100 scale-[1.02]' : 'opacity-60'} transition-all duration-300`}>
                                <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-2xl border-2 ${seg.speaker === 'Host 1' ? 'bg-cyan-900/50 border-cyan-500' : 'bg-purple-900/50 border-purple-500'}`}>
                                    {seg.speaker === 'Host 1' ? '👩‍🔬' : '👨‍🎓'}
                                </div>
                                <div className={`p-5 rounded-2xl text-base md:text-lg shadow-lg ${seg.speaker === 'Host 1' ? 'bg-cyan-900/20 border border-cyan-500/20 rounded-tl-none' : 'bg-purple-900/20 border border-purple-500/20 rounded-tr-none'}`}>
                                    <span className={`font-bold block mb-2 text-xs uppercase tracking-wider ${seg.speaker === 'Host 1' ? 'text-cyan-300' : 'text-purple-300'}`}>
                                        {seg.speaker === 'Host 1' ? 'Ms. Rachel' : 'Rohan'}
                                    </span>
                                    {seg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {!summary && podcastScript.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-64 opacity-30">
                        <Radio size={64} className="mb-4" />
                        <p className="text-xl">Content will appear here...</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// --- Quiz Module ---
export const QuizModule: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

    const handleStart = async () => {
        if (!topic) return;
        setLoading(true);
        setQuestions([]);
        setScore(0);
        setCurrentIndex(0);
        setShowResult(false);
        setSelectedOption(null);
        setIsCorrect(null);
        
        const qs = await generateQuizQuestions(topic);
        setQuestions(qs);
        setLoading(false);
    };

    const handleAnswer = (option: string) => {
        if (selectedOption) return;
        setSelectedOption(option);
        const currentQ = questions[currentIndex];
        const correct = option === currentQ.correctAnswer;
        setIsCorrect(correct);
        if (correct) setScore(s => s + 1);

        setTimeout(() => {
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(p => p + 1);
                setSelectedOption(null);
                setIsCorrect(null);
            } else {
                setShowResult(true);
            }
        }, 2500);
    };

    if (loading) return <div className="h-full flex items-center justify-center animate-pulse text-xl">Generating Quiz...</div>;

    if (showResult) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Trophy size={64} className="text-yellow-300 mb-4" />
                <h2 className="text-3xl font-bold mb-2">Quiz Complete!</h2>
                <p className="text-xl mb-6">You scored {score} out of {questions.length}</p>
                <button onClick={() => { setQuestions([]); setTopic(''); }} className="glass-button px-8 py-3 rounded-full">New Quiz</button>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <Brain size={64} className="mb-4 text-purple-300" />
                <h2 className="text-3xl font-bold mb-4">Flash Quiz</h2>
                <input 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    placeholder="Enter topic (e.g. Metals)"
                    className="bg-white/10 border border-white/20 rounded-xl px-6 py-3 w-full max-w-md mb-4 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
                />
                <button onClick={handleStart} disabled={!topic} className="glass-button px-8 py-3 rounded-full font-bold">Start Quiz</button>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="h-full flex flex-col p-6 max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <span className="text-sm opacity-60">Question {currentIndex + 1}/{questions.length}</span>
                <span className="text-sm font-bold text-yellow-300">Score: {score}</span>
            </div>
            
            <div className="glass-panel p-6 rounded-2xl mb-6 min-h-[150px] flex items-center justify-center text-center">
                <h3 className="text-xl md:text-2xl font-bold">{currentQ.question}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((opt, i) => {
                    let btnClass = "glass-button p-4 rounded-xl text-left transition-all hover:bg-white/20";
                    if (selectedOption) {
                        if (opt === currentQ.correctAnswer) btnClass = "bg-green-500/20 border-green-500 text-green-100";
                        else if (opt === selectedOption) btnClass = "bg-red-500/20 border-red-500 text-red-100";
                        else btnClass = "bg-white/5 opacity-50";
                    }
                    
                    return (
                        <button 
                            key={i} 
                            onClick={() => handleAnswer(opt)}
                            disabled={!!selectedOption}
                            className={btnClass}
                        >
                            <div className="flex justify-between items-center">
                                <span>{opt}</span>
                                {selectedOption && opt === currentQ.correctAnswer && <CheckCircle size={20} className="text-green-400"/>}
                            </div>
                        </button>
                    )
                })}
            </div>

            {selectedOption && (
                <div className="mt-6 p-4 rounded-xl bg-blue-900/30 border border-blue-500/30 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-sm"><strong className="text-blue-300">Explanation:</strong> {currentQ.explanation}</p>
                </div>
            )}
        </div>
    );
};

// --- Word Puzzle Component ---
export const WordPuzzle: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [words, setWords] = useState<PuzzleWord[]>([]);
    const [grid, setGrid] = useState<string[][]>([]);
    const [guess, setGuess] = useState('');
    
    // Grid generation helper
    const createGrid = (wordList: PuzzleWord[]) => {
        const size = 10;
        const newGrid = Array(size).fill(null).map(() => Array(size).fill(''));
        const directions = [[0, 1], [1, 0], [1, 1]]; // Horizontal, Vertical, Diagonal
        
        wordList.forEach(w => {
            const word = w.word.toUpperCase().replace(/[^A-Z]/g, '');
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 50) {
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const row = Math.floor(Math.random() * size);
                const col = Math.floor(Math.random() * size);
                
                // Check bounds
                if (
                    row + dir[0] * (word.length - 1) < size &&
                    col + dir[1] * (word.length - 1) < size &&
                    row + dir[0] * (word.length - 1) >= 0 &&
                    col + dir[1] * (word.length - 1) >= 0
                ) {
                    // Check overlap
                    let canPlace = true;
                    for (let i = 0; i < word.length; i++) {
                        const charAt = newGrid[row + dir[0] * i][col + dir[1] * i];
                        if (charAt && charAt !== word[i]) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    if (canPlace) {
                        for (let i = 0; i < word.length; i++) {
                            newGrid[row + dir[0] * i][col + dir[1] * i] = word[i];
                        }
                        placed = true;
                    }
                }
                attempts++;
            }
        });

        // Fill empty
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for(let i=0; i<size; i++) {
            for(let j=0; j<size; j++) {
                if(!newGrid[i][j]) newGrid[i][j] = letters[Math.floor(Math.random() * letters.length)];
            }
        }
        return newGrid;
    };

    const handleStart = async () => {
        if (!topic) return;
        setLoading(true);
        setWords([]);
        setGrid([]);
        const ws = await generateWordPuzzle(topic);
        if (ws && ws.length > 0) {
            const g = createGrid(ws);
            setGrid(g);
            setWords(ws);
        }
        setLoading(false);
    };

    const checkWord = () => {
        const cleanGuess = guess.trim().toUpperCase();
        const matchIndex = words.findIndex(w => w.word.toUpperCase() === cleanGuess && !w.found);
        if (matchIndex !== -1) {
            const newWords = [...words];
            newWords[matchIndex].found = true;
            setWords(newWords);
            setGuess('');
        }
    };

    if (loading) return <div className="h-full flex items-center justify-center animate-pulse">Forging Words...</div>;

    if (words.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <Search size={64} className="mb-4 text-cyan-300" />
                <h2 className="text-3xl font-bold mb-4">Word Mine</h2>
                <input 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    placeholder="Enter topic (e.g. Atmosphere)"
                    className="bg-white/10 border border-white/20 rounded-xl px-6 py-3 w-full max-w-md mb-4 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
                />
                <button onClick={handleStart} disabled={!topic} className="glass-button px-8 py-3 rounded-full font-bold">Start Mining</button>
            </div>
        );
    }
    
    const allFound = words.every(w => w.found);

    return (
        <div className="h-full flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
            {/* Left: Grid */}
            <div className="flex-1 flex flex-col items-center justify-center">
                 {allFound ? (
                     <div className="text-center animate-bounce">
                         <Trophy size={80} className="text-yellow-300 mx-auto mb-4" />
                         <h2 className="text-3xl font-bold">All Words Found!</h2>
                         <button onClick={() => setWords([])} className="mt-4 glass-button px-6 py-2 rounded-full">Play Again</button>
                     </div>
                 ) : (
                    <div className="grid grid-cols-10 gap-1 p-2 bg-black/30 rounded-xl border border-white/10 aspect-square max-h-[400px] max-w-[400px]">
                        {grid.map((row, r) => 
                            row.map((char, c) => (
                                <div key={`${r}-${c}`} className="flex items-center justify-center text-sm md:text-lg font-mono font-bold text-white/70 hover:bg-white/10 rounded cursor-default select-none">
                                    {char}
                                </div>
                            ))
                        )}
                    </div>
                 )}
            </div>

            {/* Right: Clues & Input */}
            <div className="md:w-1/3 flex flex-col">
                <div className="mb-4">
                    <h3 className="text-xl font-bold mb-2">Find {words.length} Words</h3>
                    <div className="flex gap-2">
                        <input 
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && checkWord()}
                            placeholder="Type word found..."
                            className="flex-1 bg-white/10 rounded-lg px-4 py-2 border border-white/20 focus:outline-none focus:border-cyan-400 uppercase"
                        />
                        <button onClick={checkWord} className="glass-button px-4 rounded-lg">Check</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {words.map((w, i) => (
                        <div key={i} className={`p-3 rounded-xl border transition-all ${w.found ? 'bg-green-500/20 border-green-500/50' : 'bg-white/5 border-white/10'}`}>
                            {w.found ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={16} className="text-green-400" />
                                    <span className="font-bold line-through text-white/50">{w.word}</span>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-xs text-white/50 mb-1">Clue</div>
                                    <div className="text-sm">{w.clue}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};