
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { createVideoProject } from '../services/aiService';
import { VideoSlide, VideoProject } from '../types';
import { speechManager } from '../utils/audioUtils';
import { showToast } from '../utils/notificationUtils';
import { Clapperboard, Play, Pause, Save, Loader2, Sparkles, Film, Trash2, SkipForward, Repeat, Maximize, Minimize } from 'lucide-react';

interface VideoGeneratorProps {
    userId: string;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({ userId }) => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentSlides, setCurrentSlides] = useState<VideoSlide[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [savedProjects, setSavedProjects] = useState<VideoProject[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Refs for playback loop
    const slideIndexRef = useRef(0);
    const isPlayingRef = useRef(false);
    const playerContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchProjects();
        return () => {
            stopPlayback();
        };
    }, [userId]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const fetchProjects = async () => {
        const { data } = await supabase.from('video_projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setSavedProjects(data);
    };

    const handleGenerate = async () => {
        if (!topic) return;
        stopPlayback();
        setLoading(true);
        try {
            const slides = await createVideoProject(topic);
            setCurrentSlides(slides);
            setCurrentSlideIndex(0);
            slideIndexRef.current = 0;
            // Auto-play after generation
            handlePlay();
        } catch (e) {
            showToast("Failed to generate video.", 'error');
            console.error(e);
        }
        setLoading(false);
    };

    const handlePlay = () => {
        if (currentSlides.length === 0) return;
        setIsPlaying(true);
        isPlayingRef.current = true;
        
        // Start speaking the current slide
        speakSlide(slideIndexRef.current);
    };

    const speakSlide = (index: number) => {
        if (index >= currentSlides.length || !isPlayingRef.current) {
            stopPlayback();
            return;
        }

        setCurrentSlideIndex(index);
        slideIndexRef.current = index;

        const slide = currentSlides[index];
        speechManager.speak(slide.text, {
            voice: speechManager.getFemaleVoice(),
            rate: 0.95,
            onEnd: () => {
                if (isPlayingRef.current) {
                    // Short pause before next slide
                    setTimeout(() => {
                        speakSlide(index + 1);
                    }, 500);
                }
            }
        });
    };

    const stopPlayback = () => {
        setIsPlaying(false);
        isPlayingRef.current = false;
        speechManager.stop();
    };

    const togglePlay = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            handlePlay();
        }
    };

    const toggleFullscreen = () => {
        if (!playerContainerRef.current) return;
        
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newIndex = Number(e.target.value);
        setCurrentSlideIndex(newIndex);
        slideIndexRef.current = newIndex;
        // If playing, restart speech from new slide
        if (isPlaying) {
            stopPlayback();
            setIsPlaying(true);
            isPlayingRef.current = true;
            speakSlide(newIndex);
        }
    };

    const handleSave = async () => {
        if (currentSlides.length === 0 || !userId) return;
        const { data, error } = await supabase.from('video_projects').insert({
            user_id: userId,
            title: topic,
            slides: currentSlides
        }).select().single();

        if (data && !error) {
            setSavedProjects([data, ...savedProjects]);
            showToast("Video saved to library!", 'success');
        } else {
            showToast("Failed to save.", 'error');
        }
    };

    const loadProject = (project: VideoProject) => {
        stopPlayback();
        setTopic(project.title);
        setCurrentSlides(project.slides);
        setCurrentSlideIndex(0);
        slideIndexRef.current = 0;
        setShowLibrary(false);
    };

    const deleteProject = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('video_projects').delete().eq('id', id);
        setSavedProjects(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6 relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-rose-400 flex items-center gap-2">
                        <Clapperboard className="text-rose-400" /> AI Video Lab
                    </h2>
                    <p className="text-white/60">Generate full narrated lessons.</p>
                </div>
                <button onClick={() => setShowLibrary(!showLibrary)} className="glass-button px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold">
                    <Film size={18} /> Library
                </button>
            </div>

            {/* Library Overlay */}
            {showLibrary && (
                <div className="absolute inset-0 z-50 glass-panel bg-[#1a0b10]/95 backdrop-blur-xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
                        <h3 className="text-xl font-bold">Saved Videos</h3>
                        <button onClick={() => setShowLibrary(false)} className="hover:text-rose-400">Close</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {savedProjects.length === 0 && <p className="opacity-50 text-center col-span-full mt-10">No videos saved yet.</p>}
                        {savedProjects.map(p => (
                            <div key={p.id} onClick={() => loadProject(p)} className="glass-panel p-4 rounded-xl cursor-pointer hover:bg-white/10 group relative">
                                <div className="aspect-video bg-black/50 rounded-lg mb-3 overflow-hidden relative">
                                    <img src={p.slides[0]?.imageUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Play className="fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                                <h4 className="font-bold truncate">{p.title}</h4>
                                <p className="text-xs opacity-50">{p.slides.length} slides • {new Date(p.created_at).toLocaleDateString()}</p>
                                <button onClick={(e) => deleteProject(e, p.id)} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                {currentSlides.length > 0 ? (
                    <div className="w-full h-full flex flex-col gap-4">
                        {/* Player Frame */}
                        <div 
                            ref={playerContainerRef}
                            className={`relative bg-black overflow-hidden shadow-2xl border border-white/10 group flex flex-col md:flex-row
                                ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'w-full h-full max-h-[70vh] rounded-3xl'}
                            `}
                        >
                            {/* Left: Image (40% width in desktop, top in mobile) */}
                            <div className="md:w-5/12 h-1/2 md:h-full relative overflow-hidden bg-gray-900 border-r border-white/10">
                                <img 
                                    key={currentSlideIndex} 
                                    src={currentSlides[currentSlideIndex].imageUrl} 
                                    className="w-full h-full object-cover"
                                    alt="Slide Visual"
                                />
                                {/* Photographer Credit */}
                                <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/70">
                                    📸 {currentSlides[currentSlideIndex].photographer} | Pexels
                                </div>
                            </div>

                            {/* Right: Text (60% width) */}
                            <div className="md:w-7/12 h-1/2 md:h-full bg-[#0a0a0f] p-6 md:p-10 flex flex-col justify-center relative overflow-y-auto custom-scrollbar">
                                <div key={currentSlideIndex}>
                                    <h3 className={`font-bold text-rose-400 mb-4 uppercase tracking-wider opacity-80 ${isFullscreen ? 'text-lg md:text-xl' : 'text-xs'}`}>
                                        Slide {currentSlideIndex + 1} / {currentSlides.length}
                                    </h3>
                                    <p className={`font-medium text-white leading-relaxed font-sans ${isFullscreen ? 'text-lg md:text-2xl leading-loose' : 'text-xs md:text-sm'}`}>
                                        {currentSlides[currentSlideIndex].text}
                                    </p>
                                </div>
                            </div>

                            {/* Control Bar (Overlay on bottom) */}
                            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-300 ${isFullscreen && !isPlaying ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                                {/* Progress Slider */}
                                <input 
                                    type="range" 
                                    min="0" 
                                    max={currentSlides.length - 1} 
                                    value={currentSlideIndex} 
                                    onChange={handleSliderChange}
                                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-400"
                                />
                                
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex items-center gap-4">
                                        <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform">
                                            {isPlaying ? <Pause size={20} fill="black"/> : <Play size={20} fill="black" className="ml-1"/>}
                                        </button>
                                        <span className="text-xs font-mono opacity-70">
                                            {currentSlideIndex + 1} / {currentSlides.length}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleSave} 
                                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                        >
                                            <Save size={14}/> Save
                                        </button>
                                        <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                            {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Top Bar Controls (When not fullscreen) */}
                        {!isFullscreen && (
                            <div className="flex justify-between items-center px-2">
                                <div className="flex items-center gap-4 opacity-70">
                                    <button onClick={() => { setTopic(''); setCurrentSlides([]); }} className="flex items-center gap-2 hover:text-white transition-colors" title="New Video">
                                        <Repeat size={16}/> New Topic
                                    </button>
                                    <div className="h-4 w-px bg-white/20"></div>
                                    <span className="font-bold truncate max-w-[200px]">{topic}</span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center w-full max-w-lg p-6">
                        <div className="w-32 h-32 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                            <Clapperboard size={64} className="text-rose-400" />
                            <div className="absolute inset-0 border-4 border-rose-500/30 rounded-full"></div>
                        </div>
                        <h2 className="text-3xl font-bold mb-4">What shall we learn?</h2>
                        <p className="text-white/60 mb-8">Enter a topic, and I'll create a 3-minute narrated lesson with rich visuals.</p>
                        
                        <div className="relative">
                            <input 
                                className="w-full bg-white/10 border border-white/20 rounded-full px-8 py-5 text-lg outline-none focus:border-rose-400 transition-colors pr-32 shadow-xl"
                                placeholder="e.g. The Structure of an Atom"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={loading || !topic}
                                className="absolute right-2 top-2 bottom-2 px-6 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 font-bold hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                                {loading ? 'Creating...' : 'Generate'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoGenerator;
