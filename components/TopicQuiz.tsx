
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { generateQuizQuestions } from '../services/aiService';
import { QuizQuestion } from '../types';
import { Loader2, CheckCircle, XCircle, ArrowLeft, Trophy, ArrowRight } from 'lucide-react';
import { showToast } from '../utils/notificationUtils';
import { Skeleton } from './Skeleton';

interface TopicQuizProps {
    userId: string;
    topic: string;
    userInterests: string;
    onBack: () => void;
    onScoreUpdate?: (points: number) => void;
}

const TopicQuiz: React.FC<TopicQuizProps> = ({ userId, topic, userInterests, onBack, onScoreUpdate }) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    
    // UI State for answering
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        loadSession();
    }, [userId, topic]);

    const loadSession = async () => {
        setLoading(true);
        // Check if progress exists
        const { data } = await supabase
            .from('quiz_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('topic', topic)
            .single();

        if (data) {
            // Resume
            setQuestions(data.questions);
            setCurrentIndex(data.current_index);
            setScore(data.score);
            setIsComplete(data.is_complete);
            setLoading(false);
        } else {
            // Generate New
            generateNewQuiz();
        }
    };

    const generateNewQuiz = async () => {
        setGenerating(true);
        // Generate 30 questions with a random seed
        const seed = Date.now().toString();
        const newQuestions = await generateQuizQuestions(topic, 30, userInterests, seed);
        
        if (newQuestions.length > 0) {
            // Save to DB
            const { error } = await supabase
                .from('quiz_progress')
                .insert({
                    user_id: userId,
                    topic: topic,
                    questions: newQuestions,
                    current_index: 0,
                    score: 0,
                    is_complete: false
                });
            
            if (error) {
                console.error("Error saving quiz", error);
                showToast("Failed to save quiz progress.", 'error');
            }

            setQuestions(newQuestions);
            setCurrentIndex(0);
            setScore(0);
            setIsComplete(false);
        } else {
            showToast("Failed to generate questions. Please try again.", 'error');
            onBack();
        }
        setGenerating(false);
        setLoading(false);
    };

    const normalize = (text: string) => text ? text.trim().toLowerCase() : '';

    const handleAnswer = async (option: string) => {
        if (selectedOption) return; // Prevent double click
        
        setSelectedOption(option);
        const currentQ = questions[currentIndex];
        
        // Robust comparison
        const correct = normalize(option) === normalize(currentQ.correctAnswer);
        setIsCorrect(correct);

        let newScore = score;
        if (correct) {
            newScore += 2;
            setScore(newScore);
            
            // Update User Total Points (Leaderboard)
            await supabase.rpc('increment_score', { row_id: userId, points: 2 });
            
            // Notify Parent Component to refresh score in UI immediately (Optimistic)
            if (onScoreUpdate) onScoreUpdate(2);
        }

        // Wait a bit to show result then move on
        setTimeout(async () => {
            const nextIndex = currentIndex + 1;
            const complete = nextIndex >= questions.length;
            
            // Update Progress in DB
            await supabase
                .from('quiz_progress')
                .update({
                    current_index: complete ? currentIndex : nextIndex, // If complete, stay on last index or mark complete
                    score: newScore,
                    is_complete: complete
                })
                .eq('user_id', userId)
                .eq('topic', topic);

            if (complete) {
                setIsComplete(true);
            } else {
                setCurrentIndex(nextIndex);
                setSelectedOption(null);
                setIsCorrect(null);
            }
        }, 2000);
    };

    if (generating) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                    <Loader2 size={64} className="text-cyan-400 animate-spin relative z-10" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Generating Quiz...</h2>
                <p className="opacity-60">Crafting personalized questions about {topic} based on your interest in {userInterests}.</p>
                <p className="text-xs opacity-40 mt-4">This uses advanced AI and might take a few seconds.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex flex-col p-8 gap-6">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Trophy size={80} className="text-yellow-300 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h2 className="text-4xl font-bold mb-2">Topic Mastered!</h2>
                <p className="text-xl mb-6 opacity-80">You completed {topic}</p>
                <div className="glass-panel p-6 rounded-2xl mb-8 min-w-[200px]">
                    <div className="text-sm uppercase tracking-widest opacity-50 mb-1">Total Score</div>
                    <div className="text-5xl font-bold text-cyan-300">{score} <span className="text-2xl text-white/50">/ {questions.length * 2}</span></div>
                </div>
                <button onClick={onBack} className="glass-button px-8 py-3 rounded-full font-bold flex items-center gap-2">
                    <ArrowLeft size={20} /> Back to Topics
                </button>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    // Safety check
    if (!currentQ) return <div className="p-4">Error loading question. <button onClick={onBack}>Back</button></div>;

    return (
        <div className="h-full flex flex-col p-4 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ArrowLeft/></button>
                <div className="flex flex-col items-end">
                    <span className="text-xs opacity-50 uppercase tracking-widest">Question {currentIndex + 1} / {questions.length}</span>
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
            <div className="glass-panel p-6 md:p-8 rounded-2xl mb-6 min-h-[160px] flex items-center justify-center text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-400 to-purple-500"></div>
                <h3 className="text-xl md:text-2xl font-medium leading-relaxed">{currentQ.question}</h3>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((opt, i) => {
                    let btnClass = "glass-button p-5 rounded-xl text-left transition-all hover:bg-white/10 border border-white/10 relative overflow-hidden group";
                    let icon = <div className="w-6 h-6 rounded-full border border-white/30 flex items-center justify-center text-xs group-hover:border-white/80">{String.fromCharCode(65 + i)}</div>;
                    
                    // Robust check for styling
                    const isSelected = selectedOption === opt;
                    const isThisCorrect = normalize(opt) === normalize(currentQ.correctAnswer);

                    if (selectedOption) {
                        if (isThisCorrect) {
                            btnClass = "bg-green-500/20 border-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]";
                            icon = <CheckCircle size={24} className="text-green-400" />;
                        } else if (isSelected) {
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
                            <div className="flex items-center gap-4 relative z-10 w-full">
                                {icon}
                                <span className="font-medium flex-1 whitespace-normal text-left">{opt}</span>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Explanation */}
            {selectedOption && (
                <div className="mt-6">
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

export default TopicQuiz;
