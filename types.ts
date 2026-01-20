
export enum AppScreen {
  SPLASH = 'SPLASH',
  CHAT = 'CHAT',
  SETTINGS = 'SETTINGS',
}

export interface GroundingChunk {
  web?: { uri?: string; title?: string };
  maps?: { uri?: string; title?: string };
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
  fileName?: string;
  fileType?: string;
  groundingLinks?: GroundingChunk[];
}

export interface AppState {
  screen: AppScreen;
  darkMode: boolean;
  voiceEnabled: boolean;
  language: string;
}