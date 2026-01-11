import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Book, Zap, 
  Search, Headphones, Network, PenTool, Menu, X, Brain, Puzzle, LogOut, Loader2, Sparkles, CheckCircle, Atom, Mic, LayoutDashboard, Layers, Trophy, BarChart2, FileText, Users, Wifi, Shield, Database, Cpu, AlertTriangle, Send, Settings, Palette, User, Upload, Image as ImageIcon, Lock, Server
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
    avatar_url?: string;
    display_name?: string;
    ui_theme?: string;
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

const THEMES = {
    'default': { name: 'Cosmic Default', gradient: 'linear-gradient(125deg, #020024, #090979, #2d0042, #000000)', accent: 'text-cyan-300' },
    'blue': { name: 'Deep Sea', gradient: 'linear-gradient(125deg, #001f3f, #003366, #00509e, #000033)', accent: 'text-blue-300' },
    'green': { name: 'Bio Lab', gradient: 'linear-gradient(125deg, #022c22, #14532d, #064e3b, #000000)', accent: 'text-green-300' },
    'red': { name: 'Volcano', gradient: 'linear-gradient(125deg, #450a0a, #7f1d1d, #991b1b, #000000)', accent: 'text-red-300' },
    'formal_dark': { name: 'Formal Dark', gradient: 'linear-gradient(125deg, #0f172a, #1e293b, #0f172a)', accent: 'text-slate-300' },
    'formal_light': { name: 'Formal Light', gradient: 'linear-gradient(125deg, #e2e8f0, #f8fafc, #f1f5f9)', accent: 'text-slate-600' },
};

const LOADING_STEPS = [
    { label: "Establishing Secure Connection", icon: Wifi },
    { label: "Verifying User Credentials", icon: Lock },
    { label: "Syncing Cloud Database", icon: Server },
    { label: "Optimizing AI Neural Net", icon: Cpu },
    { label: "Finalizing Interface", icon: LayoutDashboard }
];

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentFact, setCurrentFact] = useState(SCIENCE_FACTS[0]);
  
  // Settings & Feedback State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  
  // Feedback Form
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Settings Form
  const [settingsName, setSettingsName] = useState('');
  const [settingsAvatar, setSettingsAvatar] = useState('');
  const [settingsTheme, setSettingsTheme] = useState('default');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Session State
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  // Topic State
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Loading State
  const [loadingStage, setLoadingStage] = useState(0); // 0 to 5

  // Cycle facts during loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
        setCurrentFact(SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [loading]);

  // Apply Theme
  useEffect(() => {
    const themeKey = user?.ui_theme || 'default';
    const theme = THEMES[themeKey as keyof typeof THEMES] || THEMES['default'];
    
    document.body.style.background = theme.gradient;
    document.body.style.backgroundSize = "300% 300%";
    
    const root = document.documentElement;
    if (themeKey === 'formal_light') {
        root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
        root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--glass-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--text-color', '#1e293b');
        root.style.setProperty('--text-muted', 'rgba(30, 41, 59, 0.6)');
    } else {
        // Dark themes
        root.style.setProperty('--glass-bg', 'rgba(20, 20, 35, 0.6)');
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--glass-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.5)');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.6)');
    }
  }, [user?.ui_theme]);

  // Initialize Settings Form when opened
  useEffect(() => {
      if (isSettingsOpen && user) {
          setSettingsName(user.display_name || user.username || '');
          setSettingsAvatar(user.avatar_url || '');
          setSettingsTheme(user.ui_theme || 'default');
      }
  }, [isSettingsOpen, user]);

  const runLoadingSequence = async (userData: UserData) => {
    setLoading(true);
    setLoadingStage(0);

    // Random duration selection: 5s, 7s, or 10s
    const r = Math.random();
    const totalDuration = r < 0.33 ? 5000 : r < 0.66 ? 7000 : 10000;
    
    // Distribute duration across steps (weighted for realism)
    const step1 = totalDuration * 0.10; // Connection (Fast)
    const step2 = totalDuration * 0.15; // Verify
    const step3 = totalDuration * 0.35; // Cloud Sync (Slowest)
    const step4 = totalDuration * 0.25; // AI Optimization
    const step5 = totalDuration * 0.15; // Finalize
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Step 1: Secure Connection
    setLoadingStage(1);
    await delay(step1);

    // Step 2: Verification
    setLoadingStage(2);
    await delay(step2);

    // Step 3: Syncing
    setLoadingStage(3);
    try {
        const fullProfileData = {
            sessions: [], rank: 0, totalPoints: userData.total_points || 0,
            totalStudents: 0, recentQuizScores: [], researchTopics: [], savedPodTopics: []
        };
        // Trigger background analysis
        analyzeUserProfile(fullProfileData).then(analysis => {
             if (analysis.interests) {
                 supabase.from('users').update({ interests: analysis.interests }).eq('id', userData.id).then();
             }
        });
    } catch (e) { console.error(e); }
    await delay(step3);

    // Step 4: Optimizing AI
    setLoadingStage(4);
    await delay(step4);

    // Step 5: Finalizing
    setLoadingStage(5);
    await delay(step5);
    
    // Complete
    setCurrentView(AppView.DASHBOARD);
    setLoading(false);
  };

  // Check Local Storage
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

  const handleLogin = (userData: UserData) => {
      setUser(userData);
      localStorage.setItem('science_buddy_user', JSON.stringify(userData));
      runLoadingSequence(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('science_buddy_user');
    setUser(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !user) return;
      
      const file = e.target.files[0];
      setUploadingAvatar(true);
      
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-${Math.random()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
              .from('avatars')
              .upload(filePath, file);

          if (uploadError) {
              throw uploadError;
          }

          const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
          setSettingsAvatar(data.publicUrl);
          showToast('Image uploaded! Click Save to apply.', 'success');
      } catch (error: any) {
          console.error("Upload error", error);
          showToast('Failed to upload image. ' + error.message, 'error');
      } finally {
          setUploadingAvatar(false);
      }
  };

  const handleSaveSettings = async () => {
      if (!user) return;
      setIsSavingSettings(true);
      
      const updates = {
          display_name: settingsName,
          avatar_url: settingsAvatar,
          ui_theme: settingsTheme
      };

      // Optimistic Update
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));

      await supabase.from('users').update(updates).eq('id', user.id);
      
      showToast("Settings saved!", "success");
      setIsSavingSettings(false);
      setIsSettingsOpen(false);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    
    setIsSendingFeedback(true);
    
    try {
        await emailjs.send(
            'service_4rd3ex6',
            'template_ld5md57',
            {
                from_name: user?.username || 'User',
                user_email: feedbackEmail || 'Not Provided',
                message: `Username: ${user?.username}\nEmail: ${feedbackEmail}\n\n${feedbackText}`,
                reply_to: feedbackEmail || 'No Reply'
            },
            'X1eYkPAczlxtDVjnw'
        );
        showToast('Report sent successfully!', 'success');
        setFeedbackText('');
        setFeedbackEmail('');
        setIsFeedbackOpen(false);
    } catch (error) {
        console.error('EmailJS Error:', error);
        showToast('Failed to send report.', 'error');
    } finally {
        setIsSendingFeedback(false);
    }
  };

  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.TOPICS, label: 'Topics', icon: Layers }, 
    { id: AppView.PERFORMANCE, label: 'My Performance', icon: BarChart2 }, 
    { id: AppView.RESEARCH, label: 'Research Lab', icon: FileText },
    { id: AppView.COMMUNITY, label: 'Community Notes', icon: Users }, 
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
    if (currentView === AppView.TOPICS) {
        if (selectedTopic) {
            return <TopicQuiz 
                userId={user!.id}
                topic={selectedTopic}
                userInterests={user!.interests}
                onBack={() => setSelectedTopic(null)}
                onScoreUpdate={() => {}} 
            />;
        }
        return <TopicsDashboard userId={user!.id} onSelectTopic={setSelectedTopic} />;
    }

    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard 
            user={user!} 
            onNavigate={setCurrentView} 
            onResumeSession={(s) => {
                setTargetSessionId(s.id);
                setCurrentView(s.title.includes('Voice') ? AppView.VOICE_CHAT : AppView.CHAT);
            }} 
            onResumeTopic={setSelectedTopic}
            onReportIssue={() => setIsFeedbackOpen(true)}
        />;
      case AppView.PERFORMANCE:
          return <PerformanceAnalytics userId={user!.id} username={user!.username} currentUserPoints={user!.total_points || 0} />;
      case AppView.RESEARCH: return <ResearchMode userId={user!.id} username={user!.username} />;
      case AppView.COMMUNITY: return <CommunityNotes userId={user!.id} username={user!.username} />;
      case AppView.CHAT: 
        return <ChatInterface 
            userProfile={{ name: user?.username, interests: user?.interests }} 
            onUpdateProfile={() => {}} 
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
        return <Leaderboard currentUserId={user!.id} currentUserPoints={user!.total_points || 0} />;
      case AppView.STORY: return <InteractiveStory />;
      case AppView.QUIZ: return <QuizModule />;
      case AppView.STYLE_SWAPPER: return <StyleSwapper />;
      case AppView.CONCEPT_MAP: return <ConceptMap userId={user!.id} />;
      case AppView.STUDY_POD: return <StudyPod userId={user!.id} />;
      case AppView.PUZZLE: return <WordPuzzle />;
      case AppView.MATCHING: return <MindMatch />;
      default: return null;
    }
  };

  if (loading && user) {
     return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#050505] text-white font-sans overflow-hidden">
             {/* Background Effects */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-[#050505] animate-pulse"></div>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
             <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

             <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                 {/* Central Orb/Spinner */}
                 <div className="relative mb-12">
                     <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse"></div>
                     <div className="relative z-10 p-6 bg-white/5 rounded-full border border-white/10 backdrop-blur-md shadow-2xl">
                        <Atom size={64} className="text-cyan-400 animate-[spin_3s_linear_infinite]" />
                     </div>
                     {/* Orbital Ring 1 */}
                     <div className="absolute inset-[-10px] border border-cyan-500/30 rounded-full animate-[spin_4s_linear_infinite_reverse] border-t-transparent border-r-transparent"></div>
                     {/* Orbital Ring 2 */}
                     <div className="absolute inset-[-20px] border border-purple-500/30 rounded-full animate-[spin_6s_linear_infinite] border-b-transparent border-l-transparent"></div>
                 </div>

                 <h2 className="text-2xl font-bold mb-8 tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 animate-pulse">
                    System Initialization
                 </h2>

                 {/* 5 Step Checklist */}
                 <div className="w-full space-y-4 px-8">
                     {LOADING_STEPS.map((step, index) => {
                         const stepNum = index + 1;
                         const isActive = loadingStage === stepNum;
                         const isCompleted = loadingStage > stepNum;
                         const isPending = loadingStage < stepNum;
                         
                         return (
                             <div key={index} className={`flex items-center gap-4 transition-all duration-500 ${isPending ? 'opacity-20 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                                 <div className={`
                                     w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]
                                     ${isCompleted ? 'bg-green-500 border-green-500 text-black scale-100' : 
                                       isActive ? 'bg-cyan-500 border-cyan-400 text-black scale-110 shadow-[0_0_15px_rgba(34,211,238,0.6)]' : 
                                       'border-white/10 bg-transparent text-transparent scale-90'}
                                 `}>
                                     {isCompleted ? <CheckCircle size={14} /> : 
                                      isActive ? <Loader2 size={14} className="animate-spin" /> : 
                                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                 </div>
                                 <div className="flex-1">
                                     <span className={`font-medium text-sm tracking-wide transition-colors duration-300 ${isActive ? 'text-cyan-300' : isCompleted ? 'text-green-300' : 'text-white'}`}>
                                         {step.label}
                                     </span>
                                     {isActive && (
                                         <div className="h-0.5 bg-cyan-500/30 w-full mt-1 rounded-full overflow-hidden">
                                             <div className="h-full bg-cyan-400 animate-[progress_1s_ease-in-out_infinite] w-1/2"></div>
                                         </div>
                                     )}
                                 </div>
                             </div>
                         );
                     })}
                 </div>

                 {/* Fact Footer */}
                 <div className="mt-12 text-center px-6 max-w-sm">
                     <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        <Sparkles size={12} className="text-yellow-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Science Fact</span>
                     </div>
                     <p className="text-sm font-medium text-white/80 italic leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-700 key={currentFact}">
                        "{currentFact}"
                     </p>
                 </div>
             </div>
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

  // --- SETTINGS MODAL ---
  const SettingsModal = () => (
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-cyan-400" /> Settings</h2>
                  <button onClick={() => setIsSettingsOpen(false)} className="hover:text-red-400"><X /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                  {/* Public Profile Section */}
                  <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2"><User size={14}/> Public Profile</h3>
                      
                      <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center shrink-0 relative group">
                              {settingsAvatar ? <img src={settingsAvatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} className="opacity-50" />}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                                  {uploadingAvatar ? <Loader2 className="animate-spin text-white"/> : <Upload className="text-white"/>}
                              </div>
                              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                          </div>
                          <div className="flex-1">
                              <label className="text-xs font-bold mb-2 block">CHANGE PROFILE PICTURE</label>
                              <div className="flex gap-2">
                                  <label className="glass-button px-4 py-3 w-full rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 transition-all font-bold text-sm bg-white/5 border border-white/10">
                                      <ImageIcon size={18} />
                                      {uploadingAvatar ? 'Uploading...' : 'Upload Image'}
                                      <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                                  </label>
                              </div>
                              <p className="text-[10px] opacity-40 mt-2">Recommended: Square JPG/PNG, max 2MB.</p>
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold mb-1 block">DISPLAY NAME (Optional)</label>
                          <input 
                              className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-cyan-400 outline-none" 
                              placeholder={`Defaults to @${user.username}`}
                              value={settingsName}
                              onChange={(e) => setSettingsName(e.target.value)}
                          />
                          <p className="text-[10px] opacity-40 mt-1">Used in Leaderboard and Community Notes.</p>
                      </div>
                  </div>

                  {/* UI Customization Section */}
                  <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2"><Palette size={14}/> Interface Theme</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(THEMES).map(([key, theme]) => (
                              <button 
                                  key={key}
                                  onClick={() => setSettingsTheme(key)}
                                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${settingsTheme === key ? 'border-cyan-400 bg-white/10' : 'border-white/10 hover:bg-white/5'}`}
                              >
                                  <div className="absolute inset-0 opacity-30" style={{background: theme.gradient}}></div>
                                  <div className="relative z-10 flex justify-between items-center">
                                      <span className="font-bold text-sm">{theme.name}</span>
                                      {settingsTheme === key && <CheckCircle size={16} className="text-cyan-400" />}
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="pt-6 mt-2 border-t border-white/10 flex justify-end gap-3">
                  <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg hover:bg-white/10">Cancel</button>
                  <button 
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 font-bold flex items-center gap-2 shadow-lg text-white"
                  >
                      {isSavingSettings ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                      Save Changes
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className={`flex h-[100dvh] w-screen overflow-hidden font-sans p-2 md:p-6 gap-6 relative bg-transparent transition-colors duration-500`}>
      
      <ToastContainer />
      
      {/* Modals */}
      {isSettingsOpen && <SettingsModal />}
      
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl animate-in zoom-in duration-200 border-white/20">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="text-yellow-400" size={20} /> Report Issue</h3>
                    <button onClick={() => setIsFeedbackOpen(false)} className="hover:text-red-400"><X size={20}/></button>
                </div>
                <form onSubmit={handleSendFeedback}>
                    <input
                        type="email"
                        value={feedbackEmail}
                        onChange={(e) => setFeedbackEmail(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 mb-3 text-sm focus:border-cyan-400 outline-none"
                        placeholder="Email Address (Optional)"
                    />
                    <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full h-32 bg-white/10 border border-white/10 rounded-xl p-3 text-sm focus:border-cyan-400 outline-none resize-none mb-4"
                        placeholder="Describe the problem..."
                        required
                    />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setIsFeedbackOpen(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-white/10">Cancel</button>
                        <button type="submit" disabled={isSendingFeedback} className="px-4 py-2 rounded-lg text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold flex items-center gap-2">
                            {isSendingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Report
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
      
      {/* Mobile Menu Button */}
      <button 
        className={`md:hidden absolute top-4 left-4 z-50 p-2 glass-button rounded-lg`}
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Navigation Sidebar */}
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
          <div className="inline-flex p-3 rounded-full bg-white/5 mb-3 border border-white/10">
             <Atom size={32} className="text-cyan-400 animate-[spin_10s_linear_infinite]" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">Science Buddy</h1>
          
          <div className="mt-4 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 mb-2">
                  {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={32} className="w-full h-full p-3 bg-white/10"/>}
              </div>
              <div className="text-sm font-bold truncate max-w-[150px]">{user.display_name || user.username}</div>
              <div className="flex items-center justify-center gap-1 text-yellow-400 font-bold text-xs mt-1">
                <Trophy size={12} /> {user.total_points || 0} pts
              </div>
          </div>
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
                    ? 'bg-white/10 border-white/20 font-bold shadow-lg' 
                    : 'bg-transparent border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'}
                `}
              >
                <Icon size={20} className={isActive ? 'text-cyan-400' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="mt-auto pt-4">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/20 opacity-60 hover:opacity-100 transition-all text-sm mb-4">
                <LogOut size={16} /> Logout
            </button>
            <div className="text-center p-4 border-t border-white/5">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Developed By</p>
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">Akshaj</h3>
            </div>
        </div>
      </nav>

      <main className={`flex-1 glass-panel rounded-2xl overflow-hidden relative z-10 h-full w-full flex flex-col shadow-2xl`}>
         {/* TOP HEADER BAR */}
         <div className="h-16 shrink-0 flex items-center justify-end px-6 gap-4 border-b border-white/5 bg-black/5">
              {/* Add Top Buttons */}
              <button 
                  onClick={() => setIsFeedbackOpen(true)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
                  title="Report Issue"
              >
                  <AlertTriangle size={20} />
              </button>
              <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors opacity-70 hover:opacity-100"
                  title="Settings"
              >
                  <Settings size={20} />
              </button>
         </div>

         <div className="flex-1 overflow-hidden relative">
            {renderContent()}
         </div>
      </main>

    </div>
  );
};

export default App;