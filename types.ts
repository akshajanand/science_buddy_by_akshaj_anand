
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  VOICE_CHAT = 'VOICE_CHAT',
  STORY = 'STORY',
  QUIZ = 'QUIZ', // Instant Flash Quiz
  TOPICS = 'TOPICS', // New Chapterwise Quiz
  LEADERBOARD = 'LEADERBOARD', // New Leaderboard
  PERFORMANCE = 'PERFORMANCE', // New Performance Analytics
  PUZZLE = 'PUZZLE',
  MATCHING = 'MATCHING',
  STUDY_POD = 'STUDY_POD',
  CONCEPT_MAP = 'CONCEPT_MAP',
  STYLE_SWAPPER = 'STYLE_SWAPPER',
  RESEARCH = 'RESEARCH',
  COMMUNITY = 'COMMUNITY', // New Feature
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  meta?: { type?: 'voice' | 'text' };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface TopicProgress {
    topic: string;
    current_index: number;
    total_questions: number;
    score: number;
    is_complete: boolean;
}

export interface StoryNode {
  id: string;
  text: string;
  choices: { text: string; nextId: string }[];
  isEnding?: boolean;
}

export interface ConceptNode {
  id: string;
  label: string;
  description: string;
  related: string[];
  x?: number;
  y?: number;
}

export type PuzzleWord = {
  word: string;
  clue: string;
  found: boolean;
};

export interface PuzzleGrid {
  grid: string[][];
  words: PuzzleWord[];
}

export interface MatchingPair {
  id: string;
  term: string;
  definition: string;
}

export interface MatchCard {
  id: string;
  text: string;
  type: 'term' | 'def';
  isMatched: boolean;
}

export interface PodcastSegment {
    speaker: 'Host 1' | 'Host 2';
    text: string;
}

export interface StudyItem {
    id: string;
    user_id: string;
    topic: string;
    type: 'SUMMARY' | 'PODCAST';
    content: any; // string for summary, PodcastSegment[] for podcast
    created_at: string;
}

export interface ResearchProject {
    id: string;
    user_id: string;
    title: string;
    source_text: string;
    summary?: string;
    quiz_data?: QuizQuestion[];
    infographic_data?: {root: any, children: any[]};
    podcast_script?: PodcastSegment[];
    chat_history?: ChatMessage[];
    created_at: string;
}

export interface CommunityNote {
    id: string;
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    title: string;
    content: string;
    file_type: string;
    created_at: string;
}