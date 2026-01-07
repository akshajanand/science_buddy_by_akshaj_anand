import React, { useState } from 'react';
import { 
  MessageSquare, Book, Zap, 
  Grid, Headphones, Network, PenTool, Menu, X 
} from 'lucide-react';
import { AppView } from './types';
import ChatInterface from './components/ChatInterface';
import { InteractiveStory, ConceptMap, StyleSwapper } from './components/CreativeTools';
import { QuizModule, WordPuzzle, StudyPod } from './components/StudyTools';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: AppView.CHAT, label: 'AI Chat', icon: MessageSquare },
    { id: AppView.STUDY_POD, label: 'Study Pod', icon: Headphones },
    { id: AppView.STORY, label: 'Story Mode', icon: Book },
    { id: AppView.QUIZ, label: 'Flash Quiz', icon: Zap },
    { id: AppView.PUZZLE, label: 'Word Puzzle', icon: Grid },
    { id: AppView.CONCEPT_MAP, label: 'Concept Map', icon: Network },
    { id: AppView.STYLE_SWAPPER, label: 'Style Swapper', icon: PenTool },
  ];

  const renderContent = () => {
    switch (currentView) {
      case AppView.CHAT: return <ChatInterface />;
      case AppView.STORY: return <InteractiveStory />;
      case AppView.QUIZ: return <QuizModule />;
      case AppView.STYLE_SWAPPER: return <StyleSwapper />;
      case AppView.CONCEPT_MAP: return <ConceptMap />;
      case AppView.STUDY_POD: return <StudyPod />;
      case AppView.PUZZLE: return <WordPuzzle />;
      default: return <ChatInterface />;
    }
  };

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
        fixed inset-y-0 left-0 z-50 w-64 glass-panel m-2 rounded-2xl flex flex-col p-4 transform transition-transform duration-300 shadow-2xl
        md:relative md:translate-x-0 md:inset-auto md:m-0 md:h-full md:flex md:shadow-none
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%]'}
      `}>
        <div className="mb-8 p-2 text-center mt-10 md:mt-0">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-purple-300">
            Science Buddy
          </h1>
          <p className="text-xs text-white/50 tracking-wider uppercase mt-1">Class 8 Revision</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
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

        <div className="mt-4 p-4 glass-panel rounded-xl bg-black/40 border-white/5 text-xs text-center text-white/40">
           Made By Akshaj
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 glass-panel rounded-2xl overflow-hidden relative z-10 h-full w-full flex flex-col shadow-2xl">
         {/* Top bar spacer for mobile to avoid menu button overlap */}
         <div className="h-14 md:h-0 shrink-0"></div>
         
         <div className="flex-1 overflow-hidden relative">
            {renderContent()}
         </div>
      </main>

    </div>
  );
};

export default App;