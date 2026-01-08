import React, { useState } from 'react';
import { BookOpen, Sparkles, Network, ArrowRight } from 'lucide-react';
import { generateStoryNode, rewriteText, generateConceptMapData } from '../services/aiService';
import { StoryNode, ConceptNode } from '../types';

// --- Story Component ---
export const InteractiveStory: React.FC = () => {
  const [node, setNode] = useState<StoryNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [history, setHistory] = useState<string>('');

  const handleStart = async () => {
    setLoading(true);
    const data = await generateStoryNode('', null);
    if (data) {
        setNode({ ...data, id: 'start' });
        setHistory(data.text);
        setStarted(true);
    }
    setLoading(false);
  };

  const handleChoice = async (choiceText: string) => {
    setLoading(true);
    const data = await generateStoryNode(history, choiceText);
    if (data) {
        setNode({ ...data, id: Date.now().toString() });
        setHistory(prev => prev + "\n" + data.text);
    }
    setLoading(false);
  };

  if (!started) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <BookOpen size={64} className="mb-4 text-purple-300" />
              <h2 className="text-3xl font-bold mb-4">Scientific Adventure</h2>
              <p className="mb-8 max-w-md">Embark on a journey through the microscopic world or deep space. Your choices determine the outcome!</p>
              <button 
                onClick={handleStart} 
                disabled={loading}
                className="glass-button px-8 py-4 rounded-full text-xl font-bold"
              >
                  {loading ? 'Generating World...' : 'Start Adventure'}
              </button>
          </div>
      );
  }

  return (
      <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
          <div className="flex-1">
            <div className="glass-panel p-6 rounded-2xl mb-6 bg-black/20">
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
                    className="flex-1 w-full bg-white/10 rounded-xl p-4 resize-none border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400"
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
                    className="glass-button p-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:scale-110 transition-transform"
                >
                    <Sparkles size={24} className={loading ? 'animate-spin' : ''}/>
                </button>
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20}/> {style} Version</h3>
                <div className="flex-1 w-full glass-panel bg-black/20 rounded-xl p-4 overflow-y-auto">
                    {output || <span className="opacity-50 italic">Magic result will appear here...</span>}
                </div>
            </div>
        </div>
    );
}

// --- Concept Map Component ---
export const ConceptMap: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [data, setData] = useState<{root: any, children: any[]} | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedNode, setSelectedNode] = useState<any | null>(null);

    const handleGenerate = async () => {
        if (!topic) return;
        setLoading(true);
        setData(null);
        setSelectedNode(null);
        const result = await generateConceptMapData(topic);
        setData(result);
        setLoading(false);
    };

    return (
        <div className="h-full flex flex-col p-6">
            <div className="flex gap-4 mb-6">
                <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter a topic (e.g., Photosynthesis)"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/50 focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                <button 
                    onClick={handleGenerate}
                    disabled={loading}
                    className="glass-button px-6 py-2 rounded-xl"
                >
                    {loading ? 'Mapping...' : 'Map It'}
                </button>
            </div>

            <div className="flex-1 relative glass-panel rounded-2xl overflow-hidden bg-slate-900/30">
                {data ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                         {/* Simple visualizer using absolute positioning for demo */}
                         {/* Central Node */}
                         <div className="relative w-full h-full">
                            <div 
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
                                onClick={() => setSelectedNode(data.root)}
                            >
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-center p-2 font-bold shadow-[0_0_30px_rgba(255,165,0,0.5)] border-4 border-white/20 hover:scale-110 transition-transform">
                                    {data.root.label}
                                </div>
                            </div>
                            
                            {/* Children */}
                            {data.children.map((child, i) => {
                                const angle = (i / data.children.length) * 2 * Math.PI;
                                const radius = 180; // Distance from center
                                const left = `calc(50% + ${Math.cos(angle) * radius}px)`;
                                const top = `calc(50% + ${Math.sin(angle) * radius}px)`;
                                
                                return (
                                    <React.Fragment key={i}>
                                        {/* Line (approximate using CSS transform would be complex, ignoring line for simple React demo, focusing on nodes) */}
                                        <div 
                                            className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center text-center p-2 text-sm font-semibold hover:bg-white/20 cursor-pointer transition-all hover:scale-110 z-10"
                                            style={{ left, top }}
                                            onClick={() => setSelectedNode(child)}
                                        >
                                            {child.label}
                                        </div>
                                    </React.Fragment>
                                )
                            })}
                         </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full opacity-50">
                        <Network size={48} className="mr-4" />
                        <p>Enter a topic to reveal connections.</p>
                    </div>
                )}

                {/* Info Popup */}
                {selectedNode && (
                    <div className="absolute bottom-6 left-6 right-6 glass-panel bg-black/60 p-6 rounded-xl animate-slide-up z-30">
                        <h3 className="text-xl font-bold mb-2 text-yellow-300">{selectedNode.label}</h3>
                        <p>{selectedNode.description}</p>
                        <button onClick={() => setSelectedNode(null)} className="absolute top-2 right-2 text-white/50 hover:text-white">✕</button>
                    </div>
                )}
            </div>
        </div>
    );
}