import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Book, Zap, 
  Search, Headphones, Network, PenTool, Menu, X, Brain, Puzzle, LogOut, Loader2, Sparkles, CheckCircle, Atom, Mic, LayoutDashboard, Layers, Trophy, BarChart2, FileText, Users, Wifi, Shield, Database, Cpu, AlertTriangle, Send
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { AppView, ChatSession } from './types';
import ChatInterface from './components/ChatInterface';
import VoiceChat from './components/VoiceChat';
import { InteractiveStory, ConceptMap, StyleSwapper } from './components/CreativeTools';
import { QuizModule, WordPuzzle, StudyPod, MindMatch } from './components/StudyTools';
import TopicsDashboard from './components/TopicsDashboard';
import TopicQuiz from './components/TopicQuiz';
import Leaderboard from './components/Leaderboard';
import PerformanceAnalytics from './components/PerformanceAnalytics';
import Dashboard from './components/Dashboard';
import ResearchMode from './components/ResearchMode';
import CommunityNotes from './components/CommunityNotes';
import { analyzeUserProfile } from './services/aiService';
import { supabase } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { ToastContainer } from './components/ToastContainer';
import { showToast } from './utils/notificationUtils';

interface UserData {
    id: string;
    username: string;
    interests: string;
    total_points?: number;
    last_reset_date?: string;
}

const SCIENCE_FACTS = [
    "Did you know? Light takes about 8 minutes and 20 seconds to travel from the Sun to Earth.",
    "The human brain creates enough electricity to power a small light bulb.",
    "A teaspoon of a neutron star would weigh about 6 billion tons.",
    "Bananas are radioactive! (But only a tiny, tiny bit due to Potassium-40).",
    "Water can boil and freeze at the same time under the right pressure (Triple Point).",
    "There are more atoms in a glass of water than glasses of water in all the oceans.",
    "Your DNA could stretch from the earth to the sun and back ~600 times.",
    "Sound travels 4 times faster in water than it does in air."
];

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing System...");
  const [currentFact, setCurrentFact] = useState(SCIENCE_FACTS[0]);
  
  // Feedback State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  
  // Session State
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  // Topic State
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Loading Stage: 0-4 for distinct visual phases
  const [loadingStage, setLoadingStage] = useState(0);

  // Cycle facts during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
        setCurrentFact(SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  // Prefill name when feedback opens
  useEffect(() => {
      if (isFeedbackOpen && user) {
          setFeedbackName(user.username);
      }
  }, [isFeedbackOpen, user]);

  const runLoadingSequence = async (userData: UserData) => {
    setLoading(true);
    setLoadingStage(0);

    // --- DYNAMIC LOADING LOGIC ---
    // Randomize speed factor to simulate real environment variability
    const rand = Math.random();
    let speedFactor = 1.0;
    let modeText = "Standard";

    if (rand < 0.25) { 
        speedFactor = 0.3; // Very Fast
        modeText = "Optimized";
    } else if (rand < 0.75) { 
        speedFactor = 1.0; // Normal
        modeText = "Standard";
    } else if (rand < 0.95) { 
        speedFactor = 1.8; // Slow
        modeText = "Deep Scan";
    } else { 
        speedFactor = 2.8; // Very Slow
        modeText = "Comprehensive";
    }

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms * speedFactor));

    // STEP 1: Establish Connection
    setLoadingMessage(`Establishing Secure Link (${modeText})...`);
    await delay(1500);
    setLoadingStage(1);

    // STEP 2: Verify Security/User
    setLoadingMessage("Verifying User Protocols...");
    await delay(1500);
    setLoadingStage(2);

    // STEP 3: Load Assets & Pre-fetch Data
    setLoadingMessage(speedFactor > 1.5 ? "Downloading Large Educational Assets..." : "Syncing Assets...");
    try {
        // Pre-fetch EXTENSIVE data for Deep AI Profiling
        const [sessionsRes, quizRes, leaderboardRes, researchRes, libraryRes] = await Promise.all([
            // 1. Fetch recent sessions
            supabase.from('chat_sessions')
                .select('*')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: false })
                .limit(10),
            // 2. Fetch quiz progress
            supabase.from('quiz_progress')
                .select('topic, score')
                .eq('user_id', userData.id)
                .limit(5),
            // 3. Leaderboard for Rank
            supabase.from('users')
                .select('id, total_points')
                .order('total_points', { ascending: false }),
            // 4. Research Projects
            supabase.from('research_projects')
                .select('title')
                .eq('user_id', userData.id)
                .limit(5),
             // 5. Study Library
            supabase.from('study_library')
                .select('topic')
                .eq('user_id', userData.id)
                .limit(5)
        ]);
        
        await delay(1000);
        setLoadingStage(3);

        // STEP 4: AI Analysis with FULL CONTEXT
        setLoadingMessage("Calibrating Neural Network...");
        
        // Calculate Rank Manually
        let rank = '-';
        if (leaderboardRes.data) {
             const index = leaderboardRes.data.findIndex(u => u.id === userData.id);
             if (index !== -1) rank = (index + 1).toString();
        }

        const fullProfileData = {
            sessions: sessionsRes.data || [],
            rank: rank,
            totalPoints: userData.total_points || 0,
            totalStudents: leaderboardRes.data?.length || 0,
            recentQuizScores: quizRes.data || [],
            researchTopics: researchRes.data?.map(r => r.title) || [],
            savedPodTopics: libraryRes.data?.map(l => l.topic) || []
        };
        
        // Always run analysis if we have ANY data, not just chat sessions
        const hasData = fullProfileData.sessions.length > 0 || fullProfileData.recentQuizScores.length > 0;
        
        if (hasData) {
            const analysis = await analyzeUserProfile(fullProfileData);
            if (analysis.interests) {
                const updatedUser = { 
                    ...userData, 
                    interests: analysis.interests,
                };
                setUser(updatedUser);
                localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
                // Background sync
                supabase.from('users').update({ interests: analysis.interests }).eq('id', userData.id).then();
            }
        }
    } catch (e) {
        console.error("Loading sequence error", e);
    }
    
    await delay(1500);

    // STEP 5: Finalize
    setLoadingStage(4);
    setLoadingMessage("Systems Online. Welcome.");
    await delay(1000);
    
    // Ensure we start on Dashboard
    setCurrentView(AppView.DASHBOARD);
    setLoading(false);
  };

  // Check Local Storage on Mount
  useEffect(() => {
    const savedUser = localStorage.getItem('science_buddy_user');
    if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        runLoadingSequence(parsedUser);
    } else {
        setLoading(false);
    }
  }, []);

  const refreshUserScore = async (addedPoints: number = 0) => {
      if (!user) return;
      
      // OPTIMISTIC UPDATE
      if (addedPoints > 0) {
          const optimisticPoints = (user.total_points || 0) + addedPoints;
          const updatedUser = { ...user, total_points: optimisticPoints };
          setUser(updatedUser);
          localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
      } else {
          // If no specific points added (general sync), fetch from DB
          const { data } = await supabase.from('users').select('total_points').eq('id', user.id).single();
          if (data) {
              const updatedUser = { ...user, total_points: data.total_points };
              setUser(updatedUser);
              localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
          }
      }
  };

  const handleLogin = (userData: UserData) => {
      setUser(userData);
      localStorage.setItem('science_buddy_user', JSON.stringify(userData));
      runLoadingSequence(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('science_buddy_user');
    setUser(null);
  };

  const handleUpdateProfile = async (newProfile: {name?: string | null, interests?: string}) => {
    if (!user) return;
    
    // Optimistic UI update
    const updatedUser = { ...user, username: newProfile.name || user.username, interests: newProfile.interests || '' };
    setUser(updatedUser);
    localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));

    try {
        const { error } = await supabase
            .from('users')
            .update({
                interests: newProfile.interests,
            })
            .eq('id', user.id);

        if (error) console.error("Supabase profile error", error);
    } catch (e) {
        console.error("Profile save failed", e);
    }
  };
  
  const handleResumeSession = (session: ChatSession) => {
      setTargetSessionId(session.id);
      
      // Determine if Voice or Text
      const isVoice = session.title.toLowerCase().includes('voice') || session.messages[0]?.meta?.type === 'voice';
      
      if (isVoice) {
          setCurrentView(AppView.VOICE_CHAT);
      } else {
          setCurrentView(AppView.CHAT);
      }
  };

  const handleSelectTopic = (topic: string) => {
      setSelectedTopic(topic);
      if (currentView !== AppView.TOPICS) setCurrentView(AppView.TOPICS);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !feedbackName.trim()) return;
    
    setIsSendingFeedback(true);
    
    try {
        await emailjs.send(
            'service_4rd3ex6',
            'template_ld5md57',
            {
                from_name: feedbackName,
                message: `Username: ${user?.username}\n\n${feedbackText}`,
                reply_to: 'No Reply'
            },
            'X1eYkPAczlxtDVjnw'
        );
        showToast('Feedback sent successfully!', 'success');
        setFeedbackText('');
        setIsFeedbackOpen(false);
    } catch (error) {
        console.error('EmailJS Error:', error);
        showToast('Failed to send feedback. Please try again.', 'error');
    } finally {
        setIsSendingFeedback(false);
    }
  };

  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.TOPICS, label: 'Topics', icon: Layers }, 
    { id: AppView.PERFORMANCE, label: 'My Performance', icon: BarChart2 }, 
    { id: AppView.RESEARCH, label: 'Research Lab', icon: FileText },
    { id: AppView.COMMUNITY, label: 'Community Notes', icon: Users }, // New
    { id: AppView.LEADERBOARD, label: 'Leaderboard', icon: Trophy }, 
    { id: AppView.CHAT, label: 'AI Chat', icon: MessageSquare },
    { id: AppView.VOICE_CHAT, label: 'Voice Chat', icon: Mic },
    { id: AppView.STUDY_POD, label: 'Study Pod', icon: Headphones },
    { id: AppView.MATCHING, label: 'Mind Match', icon: Puzzle },
    { id: AppView.STORY, label: 'Story Mode', icon: Book },
    { id: AppView.QUIZ, label: 'Flash Quiz', icon: Zap },
    { id: AppView.PUZZLE, label: 'Word Mine', icon: Search },
    { id: AppView.CONCEPT_MAP, label: 'Concept Map', icon: Network },
    { id: AppView.STYLE_SWAPPER, label: 'Style Swapper', icon: PenTool },
  ];

  const renderContent = () => {
    // Special handling for Topics/TopicQuiz
    if (currentView === AppView.TOPICS) {
        if (selectedTopic) {
            return <TopicQuiz 
                userId={user!.id}
                topic={selectedTopic}
                userInterests={user!.interests}
                onBack={() => setSelectedTopic(null)}
                onScoreUpdate={refreshUserScore}
            />;
        }
        return <TopicsDashboard userId={user!.id} onSelectTopic={handleSelectTopic} />;
    }

    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard 
            user={user!} 
            onNavigate={setCurrentView} 
            onResumeSession={handleResumeSession} 
            onResumeTopic={handleSelectTopic}
            onReportIssue={() => setIsFeedbackOpen(true)}
        />;
      case AppView.PERFORMANCE:
          return <PerformanceAnalytics 
              userId={user!.id} 
              username={user!.username} 
              currentUserPoints={user!.total_points || 0} 
          />;
      case AppView.RESEARCH: return <ResearchMode userId={user!.id} username={user!.username} />;
      case AppView.COMMUNITY: return <CommunityNotes userId={user!.id} username={user!.username} />;
      case AppView.CHAT: 
        return <ChatInterface 
            userProfile={{ name: user?.username, interests: user?.interests }} 
            onUpdateProfile={handleUpdateProfile} 
            userId={user?.id}
            initialSessionId={targetSessionId}
        />;
      case AppView.VOICE_CHAT:
        return <VoiceChat 
            userProfile={{ name: user?.username, interests: user?.interests }}
            userId={user?.id}
            initialSessionId={targetSessionId}
        />;
      case AppView.LEADERBOARD: 
        return <Leaderboard 
            currentUserId={user!.id} 
            currentUserPoints={user!.total_points || 0} 
        />;
      case AppView.STORY: return <InteractiveStory />;
      case AppView.QUIZ: return <QuizModule />;
      case AppView.STYLE_SWAPPER: return <StyleSwapper />;
      case AppView.CONCEPT_MAP: return <ConceptMap userId={user!.id} />;
      case AppView.STUDY_POD: return <StudyPod userId={user!.id} />;
      case AppView.PUZZLE: return <WordPuzzle />;
      case AppView.MATCHING: return <MindMatch />;
      default: return <Dashboard user={user!} onNavigate={setCurrentView} onResumeSession={handleResumeSession} onResumeTopic={handleSelectTopic} onReportIssue={() => setIsFeedbackOpen(true)} />;
    }
  };

  if (loading && user) {
     return (
        <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-black text-white relative overflow-hidden font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-black to-black" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="relative z-10 flex flex-col items-center max-w-md w-full p-8">
                {/* Visual Centerpiece */}
                <div className="relative mb-12 group transition-all duration-1000">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] rounded-full animate-pulse"></div>
                    
                    {/* Dynamic Icon based on stage */}
                    <div className="relative z-10 text-cyan-300 transform transition-all duration-500">
                        {loadingStage === 0 && <Wifi size={80} className="animate-pulse" />}
                        {loadingStage === 1 && <Shield size={80} className="animate-bounce" />}
                        {loadingStage === 2 && <Database size={80} className="animate-pulse" />}
                        {loadingStage === 3 && <Brain size={80} className="animate-pulse" />}
                        {loadingStage === 4 && <CheckCircle size={80} className="scale-110 text-green-400" />}
                    </div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite_reverse]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-dotted border-purple-500/30 rounded-full animate-[spin_15s_linear_infinite]"></div>
                </div>
                
                <h2 className="text-4xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-white to-purple-200 text-center">
                    Science Buddy
                </h2>
                <div className="h-6 mb-8 text-center w-full">
                    <p className="text-cyan-400/80 font-mono text-sm uppercase tracking-[0.2em] animate-pulse">
                        {loadingMessage}
                    </p>
                </div>

                {/* Multi-stage Progress Bar */}
                <div className="w-full flex gap-1 mb-8">
                    {[0, 1, 2, 3, 4].map((step) => (
                        <div key={step} className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${loadingStage >= step ? 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-transparent'}`}
                            ></div>
                        </div>
                    ))}
                </div>
                
                {/* Checkpoints */}
                <div className="flex justify-between w-full px-4 mb-12 opacity-70">
                    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 1 ? 'text-cyan-300' : 'text-white/20'}`}>
                        <Shield size={16} />
                    </div>
                    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 2 ? 'text-purple-300' : 'text-white/20'}`}>
                        <Database size={16} />
                    </div>
                    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 3 ? 'text-pink-300' : 'text-white/20'}`}>
                        <Brain size={16} />
                    </div>
                     <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 4 ? 'text-green-300' : 'text-white/20'}`}>
                        <CheckCircle size={16} />
                    </div>
                </div>

                <div className="glass-panel p-4 rounded-xl text-center min-h-[100px] flex items-center justify-center border border-white/5 bg-black/40 w-full animate-in fade-in duration-700 key={currentFact}">
                    <p className="text-white/80 text-sm italic leading-relaxed">
                        <span className="text-purple-400 font-bold mr-2">✦</span>
                        {currentFact}
                    </p>
                </div>
            </div>
            
            <div className="absolute bottom-6 text-xs text-white/20">v2.4 • System Optimized</div>
        </div>
     );
  }

  if (!user) {
    return (
        <>
            <ToastContainer />
            <Auth onLogin={handleLogin} />
        </>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden font-sans text-white p-2 md:p-6 gap-6 relative bg-transparent">
      
      <ToastContainer />
      
      {/* Feedback Modal */}
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl bg-[#1a1a2e] animate-in zoom-in duration-200 shadow-2xl border-white/20">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            <AlertTriangle className="text-yellow-400" size={20} /> Report an Issue
                        </h3>
                        <p className="text-sm text-white/60 mt-1">
                            Found a bug? Let Akshaj know!
                        </p>
                    </div>
                    <button onClick={() => setIsFeedbackOpen(false)} className="hover:text-red-400 transition-colors"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSendFeedback}>
                    <input
                        type="text"
                        value={feedbackName}
                        onChange={(e) => setFeedbackName(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 mb-3 text-sm focus:border-cyan-400 outline-none text-white placeholder-white/30 transition-all focus:ring-1 focus:ring-cyan-400/50"
                        placeholder="Your Name"
                        required
                    />
                    <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full h-32 bg-black/30 border border-white/10 rounded-xl p-3 text-sm focus:border-cyan-400 outline-none resize-none mb-4 custom-scrollbar text-white placeholder-white/30 transition-all focus:ring-1 focus:ring-cyan-400/50"
                        placeholder="Describe the problem you are facing..."
                        required
                    />
                    <div className="flex gap-2 justify-end">
                        <button 
                            type="button"
                            onClick={() => setIsFeedbackOpen(false)}
                            className="px-4 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isSendingFeedback}
                            className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold flex items-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSendingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            {isSendingFeedback ? 'Sending...' : 'Send Report'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      <button 
        className="md:hidden absolute top-4 left-4 z-50 p-2 glass-button rounded-lg bg-black/40 border-white/20 active:scale-95 transition-transform"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <nav className={`
        fixed inset-y-0 left-0 z-50 w-72 glass-panel m-2 rounded-2xl flex flex-col p-4 transform transition-transform duration-300 shadow-2xl
        md:relative md:translate-x-0 md:inset-auto md:m-0 md:h-full md:w-64 md:flex md:shadow-none
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]'}
      `}>
        <div className="mb-8 p-2 text-center mt-12 md:mt-0">
          <div className="inline-flex p-3 rounded-full bg-cyan-500/10 mb-3 border border-cyan-500/20">
             <Atom size={32} className="text-cyan-300 animate-[spin_10s_linear_infinite]" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-purple-300">
            Science Buddy
          </h1>
          <p className="text-[10px] text-white/50 tracking-[0.2em] uppercase mt-1">Class 8 Revision</p>
          
          {user.username && (
             <div className="mt-4 text-sm text-cyan-200 bg-white/10 rounded-lg py-2 px-3 inline-block border border-white/10 w-full truncate mb-2">
                Hi, {user.username}!
             </div>
          )}
          
          <div className="flex items-center justify-center gap-2 text-yellow-300 font-bold bg-yellow-500/10 py-2 px-3 rounded-lg border border-yellow-500/20 w-full animate-in zoom-in duration-300">
            <Trophy size={16} />
            <span>{user.total_points || 0} pts</span>
          </div>
          <p className="text-[9px] text-white/30 mt-1 uppercase tracking-wide">Total Score</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id !== AppView.CHAT && item.id !== AppView.VOICE_CHAT) setTargetSessionId(null);
                  setCurrentView(item.id);
                  if (item.id !== AppView.TOPICS) setSelectedTopic(null); 
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border active:scale-95
                  ${isActive 
                    ? 'bg-gradient-to-r from-purple-500/30 to-blue-500/30 border-white/30 font-bold text-white shadow-lg' 
                    : 'bg-transparent border-transparent hover:bg-white/5 text-white/70 hover:text-white'}
                `}
              >
                <Icon size={20} className={isActive ? 'text-cyan-300' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <button 
            onClick={handleLogout}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/20 text-white/60 hover:text-white transition-all text-sm active:scale-95"
        >
            <LogOut size={16} /> Logout
        </button>

        <div className="mt-4 p-4 glass-panel rounded-xl bg-black/40 border-white/5 text-center">
           <p className="text-[10px] text-white/40">Made By Akshaj</p>
        </div>
      </nav>

      <main className="flex-1 glass-panel rounded-2xl overflow-hidden relative z-10 h-full w-full flex flex-col shadow-2xl border-white/10">
         <div className="h-14 md:h-0 shrink-0 bg-gradient-to-b from-black/20 to-transparent md:hidden"></div>
         <div className="flex-1 overflow-hidden relative">
            {renderContent()}
         </div>
      </main>

    </div>
  );
};

export default App;