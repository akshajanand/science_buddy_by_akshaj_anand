import React, { useState, useEffect } from 'react';
import { Mic, CheckCircle, Brain, Volume2, Search, StopCircle } from 'lucide-react';
import { generateQuizQuestions, generateWordPuzzle, chatWithAI } from '../services/aiService';
import { QuizQuestion, PuzzleWord } from '../types';
import { speechManager } from '../utils/audioUtils';

// --- Study Pod Component ---
export const StudyPod: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [summary, setSummary] = useState('');

    const handlePlay = async () => {
        if(!topic) return;
        setLoading(true);
        setSummary('');
        
        // Generate summary first using Groq (chatWithAI)
        const text = await chatWithAI(`Create a fun, energetic, short podcast intro and summary about ${topic} for a Class 8 student. Keep it under 100 words.`, []);
        
        setSummary(text);
        setLoading(false);
        speechManager.speak(text, 
            () => setPlaying(true),
            () => setPlaying(false)
        );
    };

    const handleStop = () => {
        speechManager.stop();
        setPlaying(false);
    };

    // Cleanup
    useEffect(() => () => speechManager.stop(), []);

    return (
        <div className="h-full flex flex-col items-center p-6 overflow-y-auto custom-scrollbar">
            <div className="text-center mb-8 mt-4">
                <div className="w-48 h-48 mx-auto rounded-full border-8 border-white/10 flex items-center justify-center relative mb-6 bg-black/20">
                    <div className={`absolute inset-0 rounded-full border-t-4 border-cyan-400 ${playing ? 'animate-spin' : ''}`}></div>
                    {playing ? <Volume2 size={64} className="opacity-80" /> : <Mic size={64} className="opacity-80" />}
                </div>
                <h2 className="text-3xl font-bold mb-2">Study Pod</h2>
                <p className="opacity-70">Enter a topic, get an AI audio summary.</p>
            </div>
            
            <div className="flex gap-4 w-full max-w-md mb-8">
                 <input 
                    className="flex-1 bg-white/10 rounded-xl px-4 py-3 border border-white/20 outline-none" 
                    placeholder="Topic (e.g. Coal and Petroleum)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && !playing && handlePlay()}
                />
                {!playing ? (
                    <button 
                        onClick={handlePlay} 
                        disabled={loading || !topic}
                        className="glass-button px-6 py-3 rounded-xl font-bold whitespace-nowrap"
                    >
                        {loading ? 'Thinking...' : 'Listen'}
                    </button>
                ) : (
                    <button 
                        onClick={handleStop} 
                        className="glass-button px-6 py-3 rounded-xl font-bold bg-red-500/20 hover:bg-red-500/40"
                    >
                        <StopCircle />
                    </button>
                )}
            </div>

            {summary && (
                <div className="glass-panel p-6 rounded-xl max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-50">Podcast Script</h3>
                    <p className="leading-relaxed text-lg">{summary}</p>
                </div>
            )}
        </div>
    )
}

// --- Quiz Component ---
export const QuizModule: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const startQuiz = async () => {
        if (!topic) return;
        setLoading(true);
        const qs = await generateQuizQuestions(topic);
        setQuestions(qs);
        setCurrentIndex(0);
        setScore(0);
        setShowResult(false);
        setLoading(false);
    };

    const handleAnswer = (option: string) => {
        if (selectedOption) return; // Prevent multi-click
        setSelectedOption(option);
        
        const correct = option === questions[currentIndex].correctAnswer;
        if (correct) setScore(s => s + 1);

        setTimeout(() => {
            setSelectedOption(null);
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(i => i + 1);
            } else {
                setShowResult(true);
            }
        }, 2000);
    };

    if (loading) return <div className="flex h-full items-center justify-center animate-pulse text-xl">Generating Quiz...</div>;

    if (questions.length === 0) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-6 text-center">
                <Brain size={64} className="mb-4 text-pink-300" />
                <h2 className="text-3xl font-bold mb-4">Flash-Recall Quiz</h2>
                <div className="flex gap-2 w-full max-w-md">
                    <input 
                        className="flex-1 bg-white/10 rounded-xl px-4 py-3 border border-white/20 outline-none" 
                        placeholder="Enter Topic (e.g. Cells)"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && startQuiz()}
                    />
                    <button onClick={startQuiz} className="glass-button px-6 py-3 rounded-xl">Start</button>
                </div>
            </div>
        );
    }

    if (showResult) {
        return (
             <div className="flex flex-col h-full items-center justify-center p-6 text-center">
                <h2 className="text-4xl font-bold mb-4">Quiz Complete!</h2>
                <div className="text-6xl font-bold mb-8 text-yellow-300">{score} / {questions.length}</div>
                <button onClick={() => setQuestions([])} className="glass-button px-8 py-3 rounded-full text-xl">New Quiz</button>
             </div>
        )
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="flex flex-col h-full p-6 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8 text-sm uppercase tracking-widest opacity-70">
                <span>Question {currentIndex + 1}/{questions.length}</span>
                <span>Score: {score}</span>
            </div>
            
            <div className="glass-panel p-8 rounded-2xl mb-8">
                <h3 className="text-2xl font-bold leading-relaxed">{currentQ.question}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQ.options.map((opt, i) => {
                    let stateClass = "hover:bg-white/10";
                    if (selectedOption) {
                        if (opt === currentQ.correctAnswer) stateClass = "bg-green-500/50 border-green-400";
                        else if (opt === selectedOption) stateClass = "bg-red-500/50 border-red-400";
                        else stateClass = "opacity-50";
                    }

                    return (
                        <button 
                            key={i}
                            onClick={() => handleAnswer(opt)}
                            className={`glass-button p-6 rounded-xl text-left transition-all border border-white/10 ${stateClass}`}
                        >
                            {opt}
                        </button>
                    )
                })}
            </div>
            
            {selectedOption && (
                <div className="mt-6 p-4 bg-black/30 rounded-xl">
                    <span className="font-bold text-yellow-300">Explanation: </span>
                    {currentQ.explanation}
                </div>
            )}
        </div>
    );
};

// --- Puzzle Component ---
export const WordPuzzle: React.FC = () => {
    const [words, setWords] = useState<PuzzleWord[]>([]);
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if(!topic) return;
        setLoading(true);
        const data = await generateWordPuzzle(topic);
        setWords(data);
        setLoading(false);
    };

    const toggleFound = (index: number) => {
        const newWords = [...words];
        newWords[index].found = !newWords[index].found;
        setWords(newWords);
    }

    return (
        <div className="h-full flex flex-col p-6">
            {!words.length ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <Search size={64} className="mb-4 text-cyan-300" />
                    <h2 className="text-3xl font-bold mb-4">Word Builder</h2>
                    <div className="flex gap-2 w-full max-w-md">
                        <input 
                            className="flex-1 bg-white/10 rounded-xl px-4 py-3 border border-white/20 outline-none" 
                            placeholder="Enter Topic"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                        <button onClick={handleCreate} disabled={loading} className="glass-button px-6 py-3 rounded-xl">
                            {loading ? '...' : 'Create'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">{topic} Keywords</h2>
                        <button onClick={() => setWords([])} className="text-sm opacity-70 hover:opacity-100">Reset</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {words.map((w, i) => (
                            <div 
                                key={i} 
                                onClick={() => toggleFound(i)}
                                className={`glass-button p-4 rounded-xl flex justify-between items-center cursor-pointer ${w.found ? 'bg-green-500/20 border-green-500/50' : ''}`}
                            >
                                <div>
                                    <h4 className={`font-bold text-lg ${w.found ? 'line-through opacity-50' : ''}`}>{w.word}</h4>
                                    <p className="text-sm opacity-70">{w.clue}</p>
                                </div>
                                {w.found ? <CheckCircle className="text-green-400" /> : <div className="w-6 h-6 rounded-full border border-white/30"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}