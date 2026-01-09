import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Book, Zap, 
  Search, Headphones, Network, PenTool, Menu, X, Brain, Puzzle, LogOut, Loader2, Sparkles, CheckCircle, Atom, Mic, LayoutDashboard, Layers, Trophy, BarChart2
} from 'lucide-react';
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
import { analyzeUserProfile } from './services/aiService';
import { supabase } from './services/supabaseClient';
import { Auth } from './components/Auth';

interface UserData {
    id: string;
    username: string;
    interests: string;
    total_points?: number;
    last_reset_date?: string;
    parent_email?: string;
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
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");
  const [currentFact, setCurrentFact] = useState(SCIENCE_FACTS[0]);
  
  // Session State
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  // Topic State
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Loading Stage: 0=Init, 1=Analyzing, 2=Personalizing, 3=Ready
  const [loadingStage, setLoadingStage] = useState(0);

  // Cycle facts during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
        setCurrentFact(SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  const runLoadingSequence = async (userData: UserData) => {
    try {
        setLoading(true);
        setLoadingStage(0);
        
        // STAGE 1: Analyzing
        setLoadingStage(1);
        setLoadingMessage("Syncing with satellite...");
        
        // Fetch recent chats from DB
        const { data: sessions } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', userData.id)
            .order('created_at', { ascending: false })
            .limit(15); 

        if (sessions && sessions.length > 0) {
                // STAGE 2: Learning
                setLoadingStage(2);
                setLoadingMessage("Analyzing neural patterns...");
                
                const analysis = await analyzeUserProfile(sessions);
                
                if (analysis.interests) {
                    // STAGE 2.5: Personalizing
                    setLoadingMessage(`Calibrating for: ${analysis.interests.split(',')[0]}...`);
                    
                    const updatedUser = { 
                        ...userData, 
                        interests: analysis.interests,
                    };
                    setUser(updatedUser);
                    localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
                    
                    // Sync to DB (Background)
                    supabase
                    .from('users')
                    .update({ interests: analysis.interests })
                    .eq('id', userData.id)
                    .then();
                }
        }
        
        // STAGE 3: Ready
        setLoadingStage(3);
        setLoadingMessage("Systems Online.");
        // Short delay to show the final message
        await new Promise(r => setTimeout(r, 1200));
        setLoading(false);

    } catch (e) {
        console.error("Failed to parse user or analyze profile", e);
        setLoading(false);
    }
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

  // Removed checkMonthlyReset useEffect to stop score resetting

  const refreshUserScore = async (addedPoints: number = 0) => {
      if (!user) return;
      
      // OPTIMISTIC UPDATE
      // If we know points were added, update local state immediately.
      // We do NOT fetch from DB immediately to avoid "read-after-write" lag (getting stale data).
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
      // Trigger the fancy loading sequence on login
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

  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.TOPICS, label: 'Topics', icon: Layers }, 
    { id: AppView.PERFORMANCE, label: 'My Performance', icon: BarChart2 }, 
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
            onResumeTopic={handleSelectTopic} // Pass topic resume handler
        />;
      case AppView.PERFORMANCE:
          return <PerformanceAnalytics 
              userId={user!.id} 
              username={user!.username} 
              currentUserPoints={user!.total_points || 0} // Pass current points for immediate UI sync
          />;
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
            currentUserPoints={user!.total_points || 0} // Pass current points to ensure leaderboard reflects reset
        />;
      case AppView.STORY: return <InteractiveStory />;
      case AppView.QUIZ: return <QuizModule />;
      case AppView.STYLE_SWAPPER: return <StyleSwapper />;
      case AppView.CONCEPT_MAP: return <ConceptMap />;
      case AppView.STUDY_POD: return <StudyPod />;
      case AppView.PUZZLE: return <WordPuzzle />;
      case AppView.MATCHING: return <MindMatch />;
      default: return <Dashboard user={user!} onNavigate={setCurrentView} onResumeSession={handleResumeSession} onResumeTopic={handleSelectTopic} />;
    }
  };

  if (loading && user) {
     return (
        <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-black text-white relative overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-black to-black" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="relative z-10 flex flex-col items-center max-w-md w-full p-8">
                {/* Central Orb */}
                <div className="relative mb-12 group">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] rounded-full animate-pulse"></div>
                    <Atom size={80} className={`text-cyan-300 relative z-10 ${loadingStage < 3 ? 'animate-[spin_4s_linear_infinite]' : 'scale-110'}`} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-500/30 rounded-full animate-[spin_10s_linear_infinite_reverse]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-dotted border-purple-500/30 rounded-full animate-[spin_15s_linear_infinite]"></div>
                </div>
                
                <h2 className="text-4xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-white to-purple-200">
                    Science Buddy
                </h2>
                <div className="h-6 mb-8">
                    <p className="text-cyan-400/80 font-mono text-xs uppercase tracking-[0.2em] animate-pulse">
                        {loadingMessage}
                    </p>
                </div>

                {/* Progress Indicators */}
                <div className="w-full bg-white/5 rounded-full h-1.5 mb-8 overflow-hidden relative">
                    <div 
                        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000 ease-out"
                        style={{ width: `${((loadingStage + 1) / 4) * 100}%` }}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/50 blur-[2px]"></div>
                    </div>
                </div>
                
                {/* Checkpoints */}
                <div className="flex justify-between w-full px-4 mb-12 opacity-70">
                    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 1 ? 'text-cyan-300 scale-110' : 'text-white/20'}`}>
                        <Network size={20} />
                    </div>
                    <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 2 ? 'text-purple-300 scale-110' : 'text-white/20'}`}>
                        <Brain size={20} />
                    </div>
                     <div className={`flex flex-col items-center gap-2 transition-all duration-500 ${loadingStage >= 3 ? 'text-green-300 scale-110' : 'text-white/20'}`}>
                        <CheckCircle size={20} />
                    </div>
                </div>

                {/* Science Fact Carousel */}
                <div className="glass-panel p-4 rounded-xl text-center min-h-[100px] flex items-center justify-center border border-white/5 bg-black/40 w-full animate-in fade-in duration-700 key={currentFact}">
                    <p className="text-white/80 text-sm italic leading-relaxed">
                        <span className="text-purple-400 font-bold mr-2">✦</span>
                        {currentFact}
                    </p>
                </div>
            </div>
            
            <div className="absolute bottom-6 text-xs text-white/20">v2.1 • Voice Enabled</div>
        </div>
     );
  }

  // If no user, show Auth screen
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    // Use h-[100dvh] for mobile browsers to account for address bar
    <div className="flex h-[100dvh] w-screen overflow-hidden font-sans text-white p-2 md:p-6 gap-6 relative bg-transparent">
      
      {/* Mobile Menu Toggle - Floating above content */}
      <button 
        className="md:hidden absolute top-4 left-4 z-50 p-2 glass-button rounded-lg bg-black/40 border-white/20"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Navigation Sidebar */}
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
          
          {/* Total Score Counter */}
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
                  // Reset target session if navigating away from chat
                  if (item.id !== AppView.CHAT && item.id !== AppView.VOICE_CHAT) setTargetSessionId(null);
                  setCurrentView(item.id);
                  if (item.id !== AppView.TOPICS) setSelectedTopic(null); // Reset topic selection if leaving
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border
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
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/20 text-white/60 hover:text-white transition-all text-sm"
        >
            <LogOut size={16} /> Logout
        </button>

        <div className="mt-4 p-4 glass-panel rounded-xl bg-black/40 border-white/5 text-[10px] text-center text-white/40">
           Made By Akshaj
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 glass-panel rounded-2xl overflow-hidden relative z-10 h-full w-full flex flex-col shadow-2xl border-white/10">
         {/* Top bar spacer for mobile to avoid menu button overlap */}
         <div className="h-14 md:h-0 shrink-0 bg-gradient-to-b from-black/20 to-transparent md:hidden"></div>
         
         <div className="flex-1 overflow-hidden relative">
            {renderContent()}
         </div>
      </main>

    </div>
  );
};

export default App;