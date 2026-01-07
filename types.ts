export enum AppView {
  CHAT = 'CHAT',
  STORY = 'STORY',
  QUIZ = 'QUIZ',
  PUZZLE = 'PUZZLE',
  STUDY_POD = 'STUDY_POD',
  CONCEPT_MAP = 'CONCEPT_MAP',
  STYLE_SWAPPER = 'STYLE_SWAPPER',
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
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
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
  related: string[]; // IDs of related nodes
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