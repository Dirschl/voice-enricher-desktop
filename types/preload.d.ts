export type LlmProvider = "ollama" | "gemini" | "openai" | "openrouter";
export type SttProvider = "webspeech";
export type OutputFormat = "markdown" | "html" | "text" | "plain";
export type Mode = "note" | "meeting" | "tasks" | "email" | "custom";

export type Prompts = {
  note: string;
  meeting: string;
  tasks: string;
  email: string;
  custom: string;
};

export type AppSettings = {
  sttProvider: SttProvider;
  llmProvider: LlmProvider;
  llmModel: string;
  llmApiKey?: string;
  ollamaBaseUrl: string;
  language: string;
  hotkey: string;
  outputFormat: OutputFormat;
  prompts: Prompts;
  customPromptInstructions: string;
};

// Project types
export interface TranscriptSegment {
  id: number;
  text: string;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  audioFile?: string; // relative path to audio file
  isUncertain?: boolean;
}

export interface Project {
  id: string;
  path: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  mode: Mode;
  language: string;
  audioFiles: string[];
  segments: TranscriptSegment[];
  enrichedResult?: string;
  rawTranscript?: string;
}

export interface ProjectsAPI {
  list: () => Promise<Project[]>;
  create: (data: { name?: string; mode?: Mode; language?: string }) => Promise<Project>;
  save: (projectId: string, data: Partial<Project>) => Promise<Project>;
  saveAudio: (projectId: string, audioData: string, segmentIndex: number) => Promise<{ fileName: string; filePath: string }>;
  load: (projectId: string) => Promise<Project>;
  rename: (projectId: string, newName: string) => Promise<Project>;
  delete: (projectId: string) => Promise<boolean>;
  getAudioPath: (projectId: string, audioFile: string) => Promise<string | null>;
  getDir: () => Promise<string>;
  openFolder: (projectId?: string) => Promise<void>;
  selectDir: () => Promise<string | null>;
}

export interface DesktopAPI {
  getSettings: () => Promise<AppSettings>;
  saveSettings: (s: Partial<AppSettings>) => Promise<AppSettings>;
  resetPrompts: () => Promise<AppSettings>;
  onHotkey: (cb: () => void) => () => void;
  bringToFront: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  projects: ProjectsAPI;
}

declare global {
  interface Window {
    desktop?: DesktopAPI;
  }
}
