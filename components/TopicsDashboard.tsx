
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { BookOpen, CheckCircle, Circle, ArrowRight, RefreshCw, Loader2, Play } from 'lucide-react';
import { TopicProgress } from '../types';
import { Skeleton } from './Skeleton';

interface TopicsDashboardProps {
    userId: string;
    onSelectTopic: (topic: string) => void;
}

const NCERT_CHAPTERS = [
    "Crop Production and Management",
    "Microorganisms: Friend and Foe",
    "Coal and Petroleum",
    "Combustion and Flame",
    "Conservation of Plants and Animals",
    "Reproduction in Animals",
    "Reaching the Age of Adolescence",
    "Force and Pressure",
    "Friction",
    "Sound",
    "Chemical Effects Of Electric Current",
    "Some Natural Phenomena",
    "Light"
];

const TopicsDashboard: React.FC<TopicsDashboardProps> = ({ userId, onSelectTopic }) => {
    const [progressMap, setProgressMap] = useState<Record<string, TopicProgress>>({});
    const [loading, setLoading] = useState(true);

    const fetchProgress = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('quiz_progress')
            .select('topic, current_index, score, is_complete, questions')
            .eq('user_id', userId);
        
        const map: Record<string, TopicProgress> = {};
        if (data) {
            data.forEach((row: any) => {
                map[row.topic] = {
                    topic: row.topic,
                    current_index: row.current_index,
                    score: row.score,
                    is_complete: row.is_complete,
                    total_questions: Array.isArray(row.questions) ? row.questions.length : 30
                };
            });
        }
        setProgressMap(map);
        setLoading(false);
    };

    useEffect(() => {
        fetchProgress();
    }, [userId]);

    const handleCreateNew = async (e: React.MouseEvent, topic: string) => {
        e.stopPropagation();
        if (!window.confirm("This will generate a completely new set of questions and reset your score for this topic. Are you sure?")) return;
        
        // Delete existing progress
        await supabase
            .from('quiz_progress')
            .delete()
            .eq('user_id', userId)
            .eq('topic', topic);
        
        // Optimistic update
        const newMap = { ...progressMap };
        delete newMap[topic];
        setProgressMap(newMap);
        
        onSelectTopic(topic);
    };

    return (
        <div className="h-full flex flex-col p-6 overflow-hidden">
             <div className="mb-6">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-purple-300">
                    NCERT Class 8 Science
                </h2>
                <p className="text-white/60">Select a chapter to start your personalized quiz journey.</p>
            </div>

            {loading ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Skeleton key={i} className="h-40 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                    {NCERT_CHAPTERS.map((chapter) => {
                        const progress = progressMap[chapter];
                        const hasStarted = !!progress;
                        const isComplete = progress?.is_complete;
                        
                        return (
                            <div 
                                key={chapter}
                                onClick={() => onSelectTopic(chapter)}
                                className={`glass-panel p-5 rounded-2xl relative group cursor-pointer transition-all hover:scale-[1.02] border ${isComplete ? 'border-green-500/30' : 'border-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${isComplete ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-cyan-300'}`}>
                                        <BookOpen size={24} />
                                    </div>
                                    {hasStarted && (
                                        <button 
                                            onClick={(e) => handleCreateNew(e, chapter)}
                                            className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors z-10"
                                            title="Generate New Questions"
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    )}
                                </div>
                                
                                <h3 className="text-lg font-bold mb-2 leading-tight min-h-[50px]">{chapter}</h3>
                                
                                {hasStarted ? (
                                    <div>
                                        <div className="flex justify-between text-xs text-white/50 mb-1 uppercase tracking-wider">
                                            <span>{isComplete ? 'Completed' : 'In Progress'}</span>
                                            <span>Score: {progress.score}</span>
                                        </div>
                                        <div className="w-full bg-black/30 rounded-full h-2 mb-2">
                                            <div 
                                                className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-cyan-500'}`} 
                                                style={{ width: `${(progress.current_index / progress.total_questions) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white/80">
                                            {isComplete ? <CheckCircle size={14} className="text-green-400"/> : <Play size={14} className="text-cyan-400"/>}
                                            {isComplete ? 'Review Topic' : `Resume (Q${progress.current_index + 1})`}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-white/50 mt-4 group-hover:text-cyan-300 transition-colors">
                                        <Circle size={14} />
                                        Start Quiz
                                        <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TopicsDashboard;
