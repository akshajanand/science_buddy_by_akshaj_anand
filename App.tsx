
import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Book, Zap, 
  Search, Headphones, Network, PenTool, Menu, X, Brain, Puzzle, LogOut, Loader2, Sparkles, CheckCircle, Atom, Mic, LayoutDashboard, Layers, Trophy, BarChart2, FileText, Users, Wifi, Lock, Server, Cpu, AlertTriangle, Send, Settings, Palette, User, Upload, Image as ImageIcon, Layout, ArrowRight, Save, LayoutPanelLeft, LayoutPanelTop, Monitor, Smartphone, Clapperboard, Database, Globe, Command, SidebarClose, SidebarOpen, PanelLeftClose, PanelLeftOpen, MessageCircle, Rocket, Microscope, Dna, GraduationCap,
  Heart, Bookmark, Reply, RefreshCw
} from 'lucide-react';
import emailjs from '@emailjs/browser';
import { AppView, UserData } from './types';
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
import VideoGenerator from './components/VideoGenerator';
import DiscussionBoard from './components/DiscussionBoard';
import YourFeed from './components/YourFeed';
import { StudyMode } from './components/StudyMode'; 
import { analyzeUserProfile } from './services/aiService';
import { supabase } from './services/supabaseClient';
import { Auth } from './components/Auth';
import { ToastContainer } from './components/ToastContainer';
import { showToast } from './utils/notificationUtils';
import TeacherApp from './TeacherApp';

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
    { label: "Igniting Core Reactor", icon: Zap },
    { label: "Gathering Star Dust", icon: Sparkles },
    { label: "Synthesizing Knowledge", icon: Dna },
    { label: "Aligning Planets", icon: Globe },
    { label: "Launch Ready", icon: Rocket }
];

const App: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true); 
  const [studentLoading, setStudentLoading] = useState(false); 
  const [currentFact, setCurrentFact] = useState(SCIENCE_FACTS[0]);
  
  // Layout State
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  
  // Modes
  const [isStudyMode, setIsStudyMode] = useState(false);

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
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsAIBehavior, setSettingsAIBehavior] = useState('');
  const [settingsDock, setSettingsDock] = useState<'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM'>('LEFT');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Session State
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  // Topic State
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  // Loading State for Cinematic
  const [loadingStage, setLoadingStage] = useState(0); 

  // Cycle facts during loading
  useEffect(() => {
    if (!studentLoading) return;
    const interval = setInterval(() => {
        setCurrentFact(SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)]);
    }, 3500);
    return () => clearInterval(interval);
  }, [studentLoading]);

  const runLoadingSequence = async (userData: UserData) => {
    setStudentLoading(true);
    setLoadingStage(0);
    setCurrentFact(SCIENCE_FACTS[Math.floor(Math.random() * SCIENCE_FACTS.length)]);

    const possibleDurations = [6000, 10000, 12000];
    const totalDuration = possibleDurations[Math.floor(Math.random() * possibleDurations.length)];
    
    const baseStep = totalDuration / 5;
    const variance = baseStep * 0.3;

    const getStepTime = () => baseStep + (Math.random() * variance * 2 - variance);
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    setLoadingStage(1); await delay(getStepTime());
    setLoadingStage(2); await delay(getStepTime());
    setLoadingStage(3);
    try {
        const fullProfileData = { sessions: [], rank: 0, totalPoints: userData.total_points || 0, totalStudents: 0, recentQuizScores: [], researchTopics: [], savedPodTopics: [] };
        analyzeUserProfile(fullProfileData).then(analysis => {
             if (analysis.interests) supabase.from('users').update({ interests: analysis.interests }).eq('id', userData.id).then();
        });
    } catch (e) { console.error(e); }
    await delay(getStepTime());
    setLoadingStage(4); await delay(getStepTime());
    setLoadingStage(5); await delay(getStepTime());
    
    setCurrentView(AppView.DASHBOARD);
    setStudentLoading(false);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('science_buddy_user');
    if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.role !== 'teacher') {
            runLoadingSequence(parsedUser);
        } else {
            setLoading(false); 
        }
    } else {
        setLoading(false);
    }
  }, []);

  const handleLogin = (userData: UserData) => {
      setUser(userData);
      localStorage.setItem('science_buddy_user', JSON.stringify(userData));
      if (userData.role === 'teacher') {
          setLoading(false);
      } else {
          runLoadingSequence(userData);
      }
  };

  const handleLogout = () => {
    localStorage.removeItem('science_buddy_user');
    setUser(null);
    setIsStudyMode(false);
  };

  // Apply Theme (Student Mode Only)
  useEffect(() => {
    if (isStudyMode || !user || user.role === 'teacher') return; 

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
        root.style.setProperty('--glass-bg', 'rgba(20, 20, 35, 0.6)');
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--glass-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.5)');
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.6)');
    }
  }, [user?.ui_theme, isStudyMode]);

  useEffect(() => {
      const handlePointsUpdate = (e: Event) => {
          const customEvent = e as CustomEvent;
          const pointsToAdd = customEvent.detail;
          
          if (typeof pointsToAdd === 'number') {
              setUser(prev => {
                  if (!prev) return null;
                  const newTotal = (prev.total_points || 0) + pointsToAdd;
                  const updatedUser = { ...prev, total_points: newTotal };
                  localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
                  return updatedUser;
              });
          }
      };

      window.addEventListener('science-buddy-points-update', handlePointsUpdate);
      return () => {
          window.removeEventListener('science-buddy-points-update', handlePointsUpdate);
      };
  }, []);

  useEffect(() => {
      if (isSettingsOpen && user) {
          setSettingsName(user.display_name || user.username || '');
          setSettingsAvatar(user.avatar_url || '');
          setSettingsTheme(user.ui_theme || 'default');
          setSettingsAIBehavior(user.custom_ai_behavior || '');
          setSettingsDock(user.sidebar_dock || 'LEFT');
          setSettingsPassword('');
      }
  }, [isSettingsOpen, user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || !user) return;
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
          setSettingsAvatar(data.publicUrl);
          showToast('Image uploaded!', 'success');
      } catch (error: any) {
          showToast('Failed to upload image.', 'error');
      } finally {
          setUploadingAvatar(false);
      }
  };

  const handleSaveSettings = async () => {
      if (!user) return;
      setIsSavingSettings(true);
      const updates: any = {
          display_name: settingsName,
          avatar_url: settingsAvatar,
          ui_theme: settingsTheme,
          custom_ai_behavior: settingsAIBehavior,
          sidebar_dock: settingsDock
      };
      if (settingsPassword.trim()) updates.password = settingsPassword;
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('science_buddy_user', JSON.stringify(updatedUser));
      const { error } = await supabase.from('users').update(updates).eq('id', user.id);
      if (error) showToast("Failed to save settings.", 'error');
      else showToast("Settings Saved!", "success");
      setIsSavingSettings(false);
      setIsSettingsOpen(false);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setIsSendingFeedback(true);
    const finalMessage = `Username: @${user?.username}\nUser ID: ${user?.id}\nMessage:\n${feedbackText}\nEmail: ${feedbackEmail}`;
    try {
        await emailjs.send('service_4rd3ex6', 'template_ld5md57', { from_name: user?.username, message: finalMessage }, 'X1eYkPAczlxtDVjnw');
        showToast('Report sent successfully!', 'success');
        setFeedbackText('');
        setIsFeedbackOpen(false);
    } catch (error) { showToast('Failed to send report.', 'error'); } 
    finally { setIsSendingFeedback(false); }
  };

  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.FEED, label: 'Your Feed', icon: Layout }, 
    { id: AppView.TOPICS, label: 'Topics', icon: Layers }, 
    { id: AppView.PERFORMANCE, label: 'My Performance', icon: BarChart2 }, 
    { id: AppView.RESEARCH, label: 'Research Lab', icon: FileText },
    { id: AppView.COMMUNITY, label: 'Community Notes', icon: Users }, 
    { id: AppView.DISCUSSION, label: 'Discussion Board', icon: MessageCircle },
    { id: AppView.VIDEO_GEN, label: 'AI Video Lab', icon: Clapperboard }, 
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
                userClass={user!.class_level}
            />;
        }
        return <TopicsDashboard 
            userId={user!.id} 
            userClass={user!.class_level} 
            onSelectTopic={setSelectedTopic} 
        />;
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
      case AppView.FEED: 
          return <YourFeed userId={user!.id} username={user!.display_name || user!.username} avatarUrl={user!.avatar_url} />;
      case AppView.PERFORMANCE:
          return <PerformanceAnalytics userId={user!.id} username={user!.username} currentUserPoints={user!.total_points || 0} />;
      case AppView.RESEARCH: return <ResearchMode userId={user!.id} username={user!.username} userClass={user!.class_level} />;
      case AppView.COMMUNITY: return <CommunityNotes userId={user!.id} username={user!.username} />;
      case AppView.DISCUSSION: return <DiscussionBoard user={user} />;
      case AppView.VIDEO_GEN: return <VideoGenerator userId={user!.id} userClass={user!.class_level} />;
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
      case AppView.STORY: return <InteractiveStory userClass={user!.class_level} />;
      case AppView.QUIZ: return <QuizModule userClass={user!.class_level} />;
      case AppView.STYLE_SWAPPER: return <StyleSwapper userClass={user!.class_level} />;
      case AppView.CONCEPT_MAP: return <ConceptMap userId={user!.id} userClass={user!.class_level} />;
      case AppView.STUDY_POD: return <StudyPod userId={user!.id} userClass={user!.class_level} />;
      case AppView.PUZZLE: return <WordPuzzle userClass={user!.class_level} />;
      case AppView.MATCHING: return <MindMatch userClass={user!.class_level} />;
      default: return null;
    }
  };

  // --- RENDERING ORDER FIXED TO PREVENT HOOK ERRORS ---
  
  // 1. Loading Screen (Student)
  if (studentLoading && user) {
     const progressPercent = (loadingStage / 5) * 100;
     const currentStep = LOADING_STEPS[loadingStage - 1] || LOADING_STEPS[0];
     return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col font-sans text-white overflow-hidden">
             <div className="absolute inset-0 pointer-events-none">
                 {[...Array(40)].map((_, i) => (
                     <div key={i} className="absolute bg-white rounded-full opacity-0 animate-pulse" style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, width: `${Math.random() * 2 + 1}px`, height: `${Math.random() * 2 + 1}px`, animationDelay: `${Math.random() * 5}s`, animationDuration: `${Math.random() * 3 + 2}s`, opacity: Math.random() * 0.7 + 0.1 }} />
                 ))}
             </div>
             <div className="relative z-10 flex flex-col items-center justify-between h-full p-6 md:p-12">
                 <div className="flex-1 flex flex-col items-center justify-center w-full">
                     <div className="relative mb-12 scale-[0.85] md:scale-125">
                         <div className="relative w-64 h-64 flex items-center justify-center">
                            <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
                            <div className="absolute inset-0 border-t border-cyan-400 rounded-full animate-[spin_3s_linear_infinite]" />
                            <div className="absolute inset-0 m-auto w-24 h-24 bg-black/50 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] z-20">
                                 <span className="text-2xl font-bold text-white font-mono">{Math.round(progressPercent)}%</span>
                            </div>
                         </div>
                     </div>
                     <div className="w-full max-w-sm px-4 flex flex-col items-center gap-3 text-center">
                          <h2 className="text-lg md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-300 animate-pulse tracking-wide uppercase">{currentStep.label}</h2>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden shadow-inner border border-white/5">
                              <div className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 transition-all duration-300 ease-out relative" style={{ width: `${progressPercent}%` }}></div>
                          </div>
                     </div>
                 </div>
                 <div className="w-full max-w-lg mt-8 animate-in slide-in-from-bottom-8 fade-in duration-1000">
                     <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-5 rounded-2xl text-center relative overflow-hidden">
                          <p className="text-white/90 text-sm md:text-lg font-light leading-relaxed font-sans">"{currentFact}"</p>
                     </div>
                 </div>
             </div>
        </div>
     );
  }

  // 2. Auth Screen
  if (!user) return <><ToastContainer /><Auth onLogin={handleLogin} /></>;

  // 3. Teacher App (Main Fix: Checked AFTER hooks)
  if (user.role === 'teacher') {
      return <TeacherApp user={user} onLogout={handleLogout} />;
  }

  // 4. Study Mode
  if (isStudyMode) {
      return (
          <>
            <ToastContainer />
            <StudyMode userId={user.id} userInterests={user.interests} onExit={() => setIsStudyMode(false)} userClass={user.class_level} />
          </>
      );
  }

  // 5. Student Dashboard
  const dock = user?.sidebar_dock || 'LEFT';
  const isHorizontalDock = dock === 'TOP' || dock === 'BOTTOM';
  const getContainerClass = () => {
      if (desktopSidebarOpen) {
          if (dock === 'RIGHT') return 'flex-col md:flex-row-reverse';
          if (dock === 'TOP') return 'flex-col md:flex-col';
          if (dock === 'BOTTOM') return 'flex-col md:flex-col-reverse';
          return 'flex-col md:flex-row'; 
      }
      return 'flex-col';
  };
  const getSidebarClass = () => {
      let base = `fixed inset-y-0 left-0 z-50 w-72 glass-panel flex flex-col p-4 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] `;
      if (mobileMenuOpen) base += ' translate-x-0'; else base += ' -translate-x-full';
      if (desktopSidebarOpen) {
          base += ` md:relative md:inset-auto md:m-0 md:transform-none md:shadow-none md:rounded-2xl md:m-2`;
          if (isHorizontalDock) {
              base += ' md:w-full md:h-auto md:flex-row md:items-center md:justify-between md:p-3 shrink-0';
          } else {
              base += ' md:w-72 md:h-full md:flex-col shrink-0';
          }
      } else {
          base += ` md:fixed md:z-50 md:inset-y-0 md:left-0 md:w-72 md:h-full`;
      }
      return base;
  };

  return (
    <div className={`flex h-[100dvh] w-screen overflow-hidden font-sans p-2 md:p-6 md:gap-6 relative bg-transparent transition-colors duration-500 ${getContainerClass()}`}>
      
      <div className="fixed top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 bg-cyan-500/10 rounded-full blur-[80px] animate-pulse z-[-1] pointer-events-none"></div>
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 bg-purple-500/10 rounded-full blur-[80px] animate-pulse z-[-1] pointer-events-none" style={{animationDelay: '2s'}}></div>

      <ToastContainer />

      {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              {/* Settings Modal (Simplified reuse) */}
              <div className="glass-panel w-full max-w-lg p-6 rounded-2xl flex flex-col max-h-[90vh] bg-[#050505]">
                  <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                      <h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="text-cyan-400" /> Settings</h2>
                      <button onClick={() => setIsSettingsOpen(false)} className="hover:text-red-400"><X /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
                      <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2 text-cyan-200"><User size={14}/> Public Profile</h3>
                          <div className="flex items-center gap-4">
                              <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center shrink-0 relative group">
                                  {settingsAvatar ? <img src={settingsAvatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} className="opacity-50" />}
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
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold mb-1 block">DISPLAY NAME</label>
                              <input className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
                          </div>
                          <div>
                              <label className="text-xs font-bold mb-1 block">NEW PASSWORD</label>
                              <input 
                                  type="password" 
                                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm" 
                                  placeholder="Enter new password (leave blank to keep)" 
                                  value={settingsPassword} 
                                  onChange={(e) => setSettingsPassword(e.target.value)} 
                              />
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2 text-purple-200"><Brain size={14}/> AI Persona</h3>
                          <div>
                              <label className="text-xs font-bold mb-1 block">CUSTOM INSTRUCTIONS</label>
                              <textarea 
                                  className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm h-24 resize-none focus:border-purple-400 focus:outline-none" 
                                  placeholder="e.g. Speak like a pirate, or explain things using football analogies..." 
                                  value={settingsAIBehavior} 
                                  onChange={(e) => setSettingsAIBehavior(e.target.value)} 
                              />
                              <p className="text-[10px] opacity-50 mt-1">This guides how Science Buddy talks to you.</p>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-widest opacity-50 flex items-center gap-2 text-green-200"><Layout size={14}/> Layout</h3>
                          <div>
                              <label className="text-xs font-bold mb-2 block">SIDEBAR POSITION</label>
                              <div className="grid grid-cols-2 gap-2">
                                  {['LEFT', 'RIGHT', 'TOP', 'BOTTOM'].map((pos) => (
                                      <button key={pos} onClick={() => setSettingsDock(pos as any)} className={`px-4 py-3 rounded-xl text-xs font-bold border ${settingsDock === pos ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-white/5 border-white/10'}`}>{pos}</button>
                                  ))}
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold mb-2 block">THEME</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {Object.entries(THEMES).map(([key, theme]) => (
                                      <button key={key} onClick={() => setSettingsTheme(key)} className={`p-3 rounded-xl border text-left relative overflow-hidden group ${settingsTheme === key ? 'border-cyan-400 bg-white/10' : 'border-white/10 hover:bg-white/5'}`}>
                                          <div className="absolute inset-0 opacity-30" style={{background: theme.gradient}}></div>
                                          <div className="relative z-10 flex justify-between items-center"><span className="font-bold text-sm">{theme.name}</span>{settingsTheme === key && <CheckCircle size={16} className="text-cyan-400" />}</div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="pt-6 mt-2 border-t border-white/10 flex justify-end gap-3">
                      <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg hover:bg-white/10">Cancel</button>
                      <button onClick={handleSaveSettings} disabled={isSavingSettings} className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 font-bold flex items-center gap-2 shadow-lg text-white">
                          {isSavingSettings ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Changes
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl border-white/20">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2"><AlertTriangle className="text-yellow-400" size={20} /> Report Issue</h3>
                    <button onClick={() => setIsFeedbackOpen(false)} className="hover:text-red-400"><X size={20}/></button>
                </div>
                <form onSubmit={handleSendFeedback}>
                    <input type="email" value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 mb-3 text-sm" placeholder="Email (Optional)" />
                    <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} className="w-full h-32 bg-white/10 border border-white/10 rounded-xl p-3 text-sm resize-none mb-4" placeholder="Describe problem..." required />
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
      
      <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} />

      <nav className={getSidebarClass()}>
        <div className="flex justify-end mb-2">
            {!desktopSidebarOpen && <button onClick={() => { setDesktopSidebarOpen(true); setMobileMenuOpen(false); }} className="p-2 glass-button rounded-lg hover:bg-white/10 hidden md:flex items-center gap-2 text-xs mr-auto"><PanelLeftOpen size={16} /> Dock Sidebar</button>}
            <button onClick={() => setMobileMenuOpen(false)} className={`p-2 glass-button rounded-lg hover:bg-white/10 ${desktopSidebarOpen ? 'md:hidden' : ''}`}><X size={20} /></button>
        </div>
        <div className={`mb-8 p-2 text-center mt-2 md:mt-0 ${isHorizontalDock && desktopSidebarOpen ? 'md:mb-0 md:flex md:items-center md:gap-4 md:text-left md:w-auto md:p-0 md:px-4' : ''}`}>
          <div className={`inline-flex p-3 rounded-full bg-white/5 mb-3 border border-white/10 ${isHorizontalDock && desktopSidebarOpen ? 'md:mb-0 md:p-2' : ''}`}>
              <Atom size={isHorizontalDock && desktopSidebarOpen ? 24 : 32} className="text-cyan-400 animate-[spin_10s_linear_infinite]" />
          </div>
          <div className={isHorizontalDock && desktopSidebarOpen ? 'hidden lg:block' : ''}>
              <h1 className={`font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 ${isHorizontalDock && desktopSidebarOpen ? 'text-lg' : 'text-2xl'}`}>Science Buddy</h1>
              {!(isHorizontalDock && desktopSidebarOpen) && (
                  <div className="mt-4 flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 mb-2 shadow-[0_0_15px_rgba(255,255,255,0.1)]">{user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={32} className="w-full h-full p-3 bg-white/10"/>}</div>
                      <div className="text-sm font-bold truncate max-w-[150px]">{user.display_name || user.username}</div>
                      <div className="flex items-center justify-center gap-1 text-yellow-400 font-bold text-xs mt-1"><Trophy size={12} /> {user.total_points || 0} pts</div>
                  </div>
              )}
          </div>
        </div>
        <div className={`flex-1 overflow-y-auto custom-scrollbar space-y-2 ${isHorizontalDock && desktopSidebarOpen ? 'md:flex md:flex-row md:space-y-0 md:space-x-1 md:items-center md:overflow-x-auto md:overflow-y-hidden md:px-4' : ''}`}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button key={item.id} onClick={() => { if (item.id !== AppView.CHAT && item.id !== AppView.VOICE_CHAT) setTargetSessionId(null); setCurrentView(item.id); if (item.id !== AppView.TOPICS) setSelectedTopic(null); setMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border active:scale-95 ${isHorizontalDock && desktopSidebarOpen ? 'md:py-2 md:px-3 md:justify-center' : 'w-full'} ${isActive ? 'bg-white/10 border-white/20 font-bold shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'}`} title={item.label}>
                <Icon size={20} className={isActive ? 'text-cyan-400' : ''} /><span className={isHorizontalDock && desktopSidebarOpen ? 'hidden xl:inline' : ''}>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className={`mt-auto pt-4 ${isHorizontalDock && desktopSidebarOpen ? 'md:pt-0 md:mt-0 md:flex md:items-center md:gap-2 md:px-4' : ''}`}>
            {isHorizontalDock && desktopSidebarOpen && <div className="hidden md:flex items-center gap-2 mr-4"><div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">{user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover"/> : <User size={16} className="w-full h-full p-1 bg-white/10"/>}</div><div className="text-xs font-bold text-yellow-400 flex gap-1"><Trophy size={14}/> {user.total_points || 0}</div></div>}
            {!isHorizontalDock && desktopSidebarOpen && <button onClick={() => setDesktopSidebarOpen(false)} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl hover:bg-white/5 opacity-50 hover:opacity-100 transition-all text-xs mb-2 hidden md:flex"><PanelLeftClose size={14} /> Minimize Sidebar</button>}
            <button onClick={handleLogout} className={`flex items-center justify-center gap-2 py-3 rounded-xl hover:bg-red-500/20 opacity-60 hover:opacity-100 transition-all text-sm ${isHorizontalDock && desktopSidebarOpen ? 'md:py-2 md:px-3 md:w-auto' : 'w-full mb-1'}`}><LogOut size={16} /> <span className={isHorizontalDock && desktopSidebarOpen ? 'hidden lg:inline' : ''}>Logout</span></button>
        </div>
      </nav>

      <main className={`flex-1 glass-panel rounded-2xl overflow-hidden relative z-0 h-full w-full flex flex-col shadow-2xl min-w-0 transition-all duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]`}>
         <div className="h-16 shrink-0 flex items-center justify-end px-4 md:px-6 gap-2 md:gap-4 border-b border-white/5 bg-black/5 backdrop-blur-sm relative z-50">
              {(!desktopSidebarOpen || window.innerWidth < 768) && <button onClick={() => setMobileMenuOpen(true)} className="p-2 glass-button rounded-lg hover:bg-white/10 mr-2 md:mr-4"><Menu size={20} /></button>}
              
              <div className="mr-auto ml-2 flex items-center">
                  <div className="flex items-center gap-2 text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 border border-white/10 px-3 py-1 rounded-full bg-white/5 shadow-inner">
                      <Atom size={16} className="text-cyan-400 animate-pulse" /> Developed By Akshaj
                  </div>
              </div>

              {/* Study Mode Toggle Button */}
              <button 
                  onClick={() => setIsStudyMode(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-transform active:scale-95"
              >
                  <GraduationCap size={16} /> Study Mode
              </button>

              <button onClick={() => setIsFeedbackOpen(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 active:scale-95" title="Report Issue"><AlertTriangle size={20} /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 active:scale-95" title="Settings"><Settings size={20} /></button>
         </div>
         <div className="flex-1 overflow-hidden relative">
             <div className="h-full w-full">{renderContent()}</div>
         </div>
      </main>
    </div>
  );
};

export default App;
