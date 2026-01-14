
import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Sparkles, Network, ArrowRight, X, Info, Plus, ChevronLeft, GitBranch, Layers, Save, Trash2, History, Layout, Loader2, Move, Maximize, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generateStoryNode, rewriteText, generateConceptMapData, checkAndAwardDailyXP } from '../services/aiService';
import { StoryNode, ConceptNode } from '../types';
import { renderRichText } from '../utils/textUtils';
import { supabase } from '../services/supabaseClient';
import { showToast } from '../utils/notificationUtils';

// --- Story Component ---
export const InteractiveStory: React.FC = () => {
  const [node, setNode] = useState<StoryNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('science_buddy_user');
    if (userStr) setUserId(JSON.parse(userStr).id);
  }, []);

  const handleStart = async () => {
    if (!topic) return;
    setLoading(true);
    const data = await generateStoryNode('', null, topic);
    if (data) {
        setNode({ ...data, id: 'start' });
        setHistory(data.text);
        setStarted(true);
        if (userId) checkAndAwardDailyXP(userId, 5, "Starting Adventure");
    }
    setLoading(false);
  };

  const handleChoice = async (choiceText: string) => {
    setLoading(true);
    const data = await generateStoryNode(history, choiceText);
    if (data) {
        setNode({ ...data, id: Date.now().toString() });
        setHistory(prev => prev + "\n" + data.text);
        if (userId) checkAndAwardDailyXP(userId, 2, "Story Decision");
    }
    setLoading(false);
  };

  if (!started) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in zoom-in">
              <BookOpen size={64} className="mb-4 text-purple-300" />
              <h2 className="text-3xl font-bold mb-4">Scientific Adventure</h2>
              <p className="mb-8 max-w-md">Embark on a journey through any scientific concept. Your choices determine the outcome!</p>
              
              <div className="w-full max-w-md space-y-4">
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter Adventure Topic (e.g. Inside a Volcano)"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-lg focus:outline-none focus:border-purple-400 placeholder-white/40 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  />
                  <button 
                    onClick={handleStart} 
                    disabled={loading || !topic}
                    className="w-full glass-button px-8 py-4 rounded-xl text-xl font-bold flex items-center justify-center gap-2"
                  >
                      {loading ? 'Generating World...' : 'Start Adventure'}
                  </button>
              </div>
          </div>
      );
  }

  return (
      <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
          <div className="flex-1">
            <div className="glass-panel p-6 rounded-2xl mb-6 bg-black/20 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-lg leading-relaxed whitespace-pre-wrap">{node?.text}</p>
            </div>
          </div>
          <div className="mt-auto">
              {node?.isEnding ? (
                  <div className="text-center">
                      <h3 className="text-2xl font-bold mb-4 text-yellow-300">The End</h3>
                      <button onClick={() => setStarted(false)} className="glass-button px-6 py-2 rounded-full">Play Again</button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {node?.choices.map((choice, i) => (
                          <button 
                            key={i} 
                            onClick={() => handleChoice(choice.text)}
                            disabled={loading}
                            className="glass-button p-4 rounded-xl text-left hover:bg-white/20 transition-all flex items-center justify-between group"
                          >
                              <span>{choice.text}</span>
                              <ArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                          </button>
                      ))}
                  </div>
              )}
               {loading && <p className="text-center mt-4 animate-pulse">Consulting the universe...</p>}
          </div>
      </div>
  );
};

// --- Style Swapper Component ---
export const StyleSwapper: React.FC = () => {
    const [input, setInput] = useState('');
    const [style, setStyle] = useState('Pirate');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSwap = async () => {
        if (!input) return;
        setLoading(true);
        const res = await rewriteText(input, style);
        setOutput(res);
        setLoading(false);
    }

    const styles = ['Pirate', 'Robot', 'Superhero', 'Shakespearean', 'Rapping Scientist'];

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 p-6">
            <div className="flex-1 flex flex-col gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><BookOpen size={20}/> Original Text</h3>
                <textarea 
                    className="flex-1 w-full bg-white/10 rounded-xl p-4 resize-none border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all"
                    placeholder="Paste a boring paragraph from your textbook here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
            </div>
            
            <div className="flex flex-col justify-center items-center gap-4">
                <div className="glass-panel p-2 rounded-xl flex flex-col gap-2">
                    {styles.map(s => (
                        <button 
                            key={s} 
                            onClick={() => setStyle(s)}
                            className={`px-4 py-2 rounded-lg text-sm transition-all ${style === s ? 'bg-white text-purple-900 font-bold' : 'hover:bg-white/10'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={handleSwap} 
                    disabled={loading || !input}
                    className="glass-button p-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:scale-110 transition-transform shadow-lg"
                >
                    <Sparkles size={24} className={loading ? 'animate-spin' : ''}/>
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20}/> {style} Version</h3>
                <div className="flex-1 w-full glass-panel bg-black/20 rounded-xl p-4 overflow-y-auto">
                    {output ? renderRichText(output) : <span className="opacity-50 italic">Magic result will appear here...</span>}
                </div>
            </div>
        </div>
    );
}

interface ConceptMapProps {
    userId?: string;
    overrideData?: any; // For Research Mode to pass data directly
}

interface LayoutNode {
    data: any;
    x: number;
    y: number;
    isRoot: boolean;
}

// --- Concept Map Component ---
export const ConceptMap: React.FC<ConceptMapProps> = ({ userId, overrideData }) => {
    const [topic, setTopic] = useState('');
    const [data, setData] = useState<{root: any, children: any[]} | null>(null);
    const [layout, setLayout] = useState<LayoutNode[]>([]);
    
    const [history, setHistory] = useState<{root: any, children: any[]}[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedNode, setSelectedNode] = useState<any | null>(null);
    const [savedMaps, setSavedMaps] = useState<any[]>([]);
    const [showSidebar, setShowSidebar] = useState(true);
    
    // Pan & Zoom
    const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Fetch
    useEffect(() => {
        if (!userId || overrideData) return;
        const fetchMaps = async () => {
            const { data } = await supabase
                .from('concept_maps')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (data) setSavedMaps(data);
        };
        fetchMaps();
    }, [userId, overrideData]);

    // Handle Override
    useEffect(() => {
        if (overrideData) {
            setData(overrideData);
            setShowSidebar(false);
            resetView();
        }
    }, [overrideData]);

    // Calculate Layout whenever Data Changes
    useEffect(() => {
        if (!data) {
            setLayout([]);
            return;
        }

        const newLayout: LayoutNode[] = [];
        // Root at 0,0
        newLayout.push({ data: data.root, x: 0, y: 0, isRoot: true });

        // Children in circle
        const count = data.children.length;
        const radius = 250;
        data.children.forEach((child, i) => {
            const angle = (i / count) * 2 * Math.PI - (Math.PI / 2); // Start from top
            newLayout.push({
                data: child,
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                isRoot: false
            });
        });
        
        setLayout(newLayout);

    }, [data]);

    const resetView = () => {
        setViewState({ x: 0, y: 0, scale: 1 });
    };

    const handleGenerate = async (searchTopic: string) => {
        if (!searchTopic) return;
        setSelectedNode(null);
        setHistory([]);
        resetView();
        setLoading(true);
        try {
            const result = await generateConceptMapData(searchTopic);
            if (result && result.root && Array.isArray(result.children)) {
                setData(result);
                if (userId) checkAndAwardDailyXP(userId, 15, "Generating Concept Map");
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleSaveMap = async () => {
        if (!userId || !data || !topic) return;
        setSaving(true);
        const { data: savedEntry, error } = await supabase
            .from('concept_maps')
            .insert({ user_id: userId, topic: topic, data: data })
            .select().single();

        if (error) {
            showToast("Failed to save map.", 'error');
        } else if (savedEntry) {
            setSavedMaps(prev => [savedEntry, ...prev]);
            showToast("Map saved successfully", 'success');
            checkAndAwardDailyXP(userId, 15, "Saving Map");
        }
        setSaving(false);
    };

    const handleLoadMap = (mapEntry: any) => {
        setTopic(mapEntry.topic);
        setData(mapEntry.data);
        setHistory([]);
        setSelectedNode(null);
        resetView();
        if (window.innerWidth < 768) setShowSidebar(false);
    };

    const handleDeleteMap = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await supabase.from('concept_maps').delete().eq('id', id);
        setSavedMaps(prev => prev.filter(m => m.id !== id));
        showToast("Map deleted", 'info');
    };

    const handleExpandNode = async () => {
        if (!selectedNode || !data) return;
        setHistory(prev => [...prev, data]);
        setLoading(true);
        try {
            const result = await generateConceptMapData(selectedNode.label);
            if (result && result.root) {
                setData(result);
                setSelectedNode(null);
                resetView();
                if (userId) checkAndAwardDailyXP(userId, 5, "Deep Dive");
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleBack = () => {
        if (history.length === 0) return;
        const previousData = history[history.length - 1];
        setData(previousData);
        setHistory(prev => prev.slice(0, -1));
        setSelectedNode(null);
        resetView();
    };

    // --- Pan & Zoom Handlers ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation(); 
        const delta = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.5, viewState.scale + delta), 2.5);
        setViewState(prev => ({ ...prev, scale: newScale }));
    };
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setIsDragging(false);

    // Touch Handlers for Mobile Panning
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        // Prevent default scrolling when dragging
        if (isDragging) {
            e.preventDefault();
        }

        if (!isDragging || e.touches.length !== 1) return;
        // Calculate delta
        const dx = e.touches[0].clientX - lastMousePos.x;
        const dy = e.touches[0].clientY - lastMousePos.y;
        
        // Update state
        setViewState(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        
        // Update last pos
        setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    };
    const handleTouchEnd = () => setIsDragging(false);

    return (
        <div className="h-full flex gap-4 p-4 md:p-6 relative overflow-hidden">
            {!overrideData && (
                 <button onClick={() => setShowSidebar(!showSidebar)} className={`absolute top-6 left-6 z-40 p-2 glass-button rounded-lg md:hidden ${showSidebar ? 'bg-white/20' : ''}`}>
                    <History size={20} />
                </button>
             )}

            {!overrideData && (
                <div className={`fixed inset-y-0 left-0 z-30 w-72 glass-panel m-0 rounded-r-2xl border-l-0 border-y-0 border-white/10 flex flex-col transition-transform duration-300 transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:flex md:w-64 md:m-0 md:border md:rounded-2xl md:h-full`}>
                    <div className="p-4 border-b border-white/10 flex justify-between items-center mt-12 md:mt-0">
                        <span className="font-bold text-white/70 uppercase tracking-wider text-xs flex items-center gap-2"><History size={14} /> Map History</span>
                        <button onClick={() => setShowSidebar(false)} className="md:hidden"><X size={18}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {savedMaps.map(map => (
                            <div key={map.id} onClick={() => handleLoadMap(map)} className={`p-3 rounded-xl cursor-pointer flex items-center justify-between group transition-all hover:bg-white/10 ${data === map.data ? 'bg-white/10 border border-white/20' : 'border border-transparent'}`}>
                                <div className="truncate text-sm opacity-90 font-medium">{map.topic}</div>
                                <button onClick={(e) => handleDeleteMap(e, map.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-300 transition-opacity"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {!overrideData && (
                    <div className="flex flex-col md:flex-row gap-4 mb-6 relative z-20 pl-12 md:pl-0">
                        <div className="flex-1 relative">
                            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter concept (e.g. Photosynthesis)" className="w-full bg-[#1e1e2e] border border-white/10 rounded-full px-6 py-3 pl-12 text-white placeholder-white/40 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-medium shadow-sm" onKeyDown={(e) => e.key === 'Enter' && handleGenerate(topic)} />
                            <Sparkles size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
                        </div>
                        <button onClick={() => handleGenerate(topic)} disabled={loading || !topic} className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/20 whitespace-nowrap flex-1 md:flex-none">
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Visualize'}
                        </button>
                        {data && <button onClick={handleSaveMap} disabled={saving} className="glass-button px-4 py-2 rounded-full font-bold flex items-center gap-2 border-white/20"><Save size={18} /><span className="hidden md:inline">Save</span></button>}
                    </div>
                )}

                <div 
                    ref={containerRef} 
                    className="flex-1 relative rounded-3xl overflow-hidden bg-[#131316] border border-white/5 shadow-2xl min-h-[400px] cursor-grab active:cursor-grabbing touch-none"
                    style={{ touchAction: 'none' }}
                    onWheel={handleWheel} 
                    onMouseDown={handleMouseDown} 
                    onMouseMove={handleMouseMove} 
                    onMouseUp={handleMouseUp} 
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    
                    {/* Background Grid */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #444444 1px, transparent 1px)', backgroundSize: '24px 24px', transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`, transformOrigin: 'center' }}></div>

                    {history.length > 0 && (
                        <div className="absolute top-4 left-4 z-40 animate-in fade-in slide-in-from-left-2 pointer-events-auto">
                            <button onClick={handleBack} className="bg-[#1a1a20]/90 backdrop-blur-md border border-white/10 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-[#2a2a35] transition-colors shadow-lg">
                                <ChevronLeft size={16} /><span className="text-sm font-medium">Back</span>
                            </button>
                        </div>
                    )}

                    {/* Canvas Layer */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{
                        transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        width: '100%', height: '100%'
                    }}>
                        {layout.length > 0 ? (
                            <div className="relative w-0 h-0" style={{ top: '50%', left: '50%' }}>
                                {/* Lines */}
                                <svg className="absolute overflow-visible" style={{ top: 0, left: 0 }}>
                                    {layout.filter(l => !l.isRoot).map((childNode, i) => (
                                        <line 
                                            key={i}
                                            x1={0} y1={0} // Root is always 0,0 in this relative container
                                            x2={childNode.x} y2={childNode.y}
                                            stroke="#4b5563" strokeWidth="2" opacity="0.5"
                                        />
                                    ))}
                                </svg>
                                
                                {/* Nodes */}
                                {layout.map((node, i) => (
                                    <div 
                                        key={i}
                                        className="absolute pointer-events-auto"
                                        style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                                    >
                                        <div 
                                            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:scale-105"
                                            onClick={(e) => { e.stopPropagation(); setSelectedNode(node.data); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                        >
                                            {node.isRoot ? (
                                                 <div className="bg-[#1a1a20] text-white px-6 py-3 rounded-full border border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] flex items-center gap-2 whitespace-nowrap z-20">
                                                    <Network size={18} className="text-cyan-400" />
                                                    <span className="font-bold text-lg">{node.data.label}</span>
                                                 </div>
                                            ) : (
                                                <div className={`px-5 py-2 rounded-full border backdrop-blur-md shadow-lg flex items-center gap-2 whitespace-nowrap ${selectedNode === node.data ? 'bg-[#2a2a35] border-cyan-500 text-white z-20 scale-110' : 'bg-[#1a1a20] border-white/10 text-white/80'}`}>
                                                    <span className="text-sm font-medium max-w-[150px] truncate">{node.data.label}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center opacity-30">
                                <Plus size={32} className="mb-2" />
                                <p>Generate a map to see connections</p>
                            </div>
                        )}
                    </div>

                    {/* Details Sidebar */}
                    {selectedNode && (
                        <div className="absolute z-50 flex flex-col bg-[#1a1a20]/95 backdrop-blur-xl border border-white/10 shadow-2xl p-6 rounded-2xl md:right-6 md:top-6 md:w-80 md:bottom-auto inset-x-4 bottom-4 top-auto max-h-[60%] overflow-y-auto custom-scrollbar pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-bold text-white">{selectedNode.label}</h3>
                                <button onClick={() => setSelectedNode(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
                            </div>
                            <p className="text-sm text-white/70 mb-6 leading-relaxed">{selectedNode.description}</p>
                            {selectedNode !== data?.root && (
                                <button onClick={handleExpandNode} disabled={loading} className="w-full glass-button py-3 px-4 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-cyan-500/30 font-medium">
                                    {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <><Layers size={16} /> Explore This Concept</>}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
