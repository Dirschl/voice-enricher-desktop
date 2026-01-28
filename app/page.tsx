"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type Mode = "note" | "meeting" | "tasks" | "email" | "custom";
type LlmProvider = "ollama" | "gemini" | "openai" | "openrouter";
type SttProvider = "whisper-api" | "whisper-local" | "webspeech";
type OutputFormat = "markdown" | "html" | "text" | "plain";

type Prompts = {
  note: string;
  meeting: string;
  tasks: string;
  email: string;
  custom: string;
};

// New flexible prompt system
interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
}

type Settings = {
  sttProvider: SttProvider;
  whisperModel: string;
  /** OpenAI API Key für Whisper API (Spracherkennung). Getrennt vom LLM-API-Key. */
  whisperApiKey?: string;
  llmProvider: LlmProvider;
  llmModel: string;
  llmApiKey?: string;
  ollamaBaseUrl: string;
  language: string;
  hotkey: string;
  outputFormat: OutputFormat;
  prompts: Prompts;
  customPromptInstructions: string;
  // New flexible prompt settings
  customPrompts?: CustomPrompt[];
  defaultPromptId?: string;
  // Live mode settings
  liveIdleTime?: number; // ms of silence before processing segment (default: 3000)
};

// Project types
interface TranscriptSegment {
  id: number;
  text: string;
  startTime: number;
  endTime: number;
  audioFile?: string;
  isUncertain?: boolean;
}

interface Project {
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

const defaultPrompts: Prompts = {
  note: `Mache aus dem Transkript eine strukturierte Notiz mit Titel, Key Points, Details und Next Steps.`,
  meeting: `Wandle das Transkript in Meeting Minutes um mit Summary, Entscheidungen, Action Items und offenen Fragen.`,
  tasks: `Extrahiere alle Aufgaben aus dem Transkript mit Datum falls erwähnt und Kontext.`,
  email: `Formuliere aus dem Transkript eine professionelle E-Mail auf Deutsch (Sie) mit Betreff.`,
  custom: `Verarbeite das Transkript nach den Anweisungen.`,
};

// Initial prompts (used when no custom prompts exist yet)
const initialPrompts: CustomPrompt[] = [
  { id: "note", name: "Notiz", prompt: "Mache aus dem Transkript eine strukturierte Notiz mit Titel, Key Points, Details und Next Steps." },
  { id: "meeting", name: "Meeting", prompt: "Wandle das Transkript in Meeting Minutes um mit Summary, Entscheidungen, Action Items und offenen Fragen." },
  { id: "tasks", name: "Aufgaben", prompt: "Extrahiere alle Aufgaben aus dem Transkript mit Datum falls erwählt und Kontext." },
  { id: "email", name: "E-Mail", prompt: "Formuliere aus dem Transkript eine professionelle E-Mail auf Deutsch (Sie) mit Betreff." },
];

// LLM Model definitions per provider
interface LlmModelInfo {
  id: string;
  name: string;
  size: string;
  description: string;
  recommended?: boolean;
}

const llmModels: Record<LlmProvider, LlmModelInfo[]> = {
  ollama: [
    { id: "llama3.2:3b", name: "Llama 3.2 3B", size: "~3 GB", description: "Schnell, kompakt", recommended: true },
    { id: "mistral:7b", name: "Mistral 7B", size: "~8 GB", description: "Gute Qualität, folgt Anweisungen gut", recommended: true },
    { id: "gemma2:9b", name: "Gemma 2 9B", size: "~10 GB", description: "Beste Formatierung (HTML, JSON)", recommended: true },
    { id: "llama3.1:8b", name: "Llama 3.1 8B", size: "~8 GB", description: "Guter Allrounder" },
    { id: "qwen2.5:7b", name: "Qwen 2.5 7B", size: "~8 GB", description: "Gut bei Instruktionen" },
    { id: "phi3:mini", name: "Phi-3 Mini", size: "~4 GB", description: "Kompakt, schnell" },
  ],
  gemini: [
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", size: "API", description: "Schnell, günstig", recommended: true },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", size: "API", description: "Beste Qualität" },
    { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", size: "API", description: "Neueste Version" },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", size: "API", description: "Schnell, günstig", recommended: true },
    { id: "gpt-4o", name: "GPT-4o", size: "API", description: "Beste Qualität" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", size: "API", description: "Schnell" },
  ],
  openrouter: [
    { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)", size: "API", description: "Kostenlos", recommended: true },
    { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)", size: "API", description: "Kostenlos" },
    { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)", size: "API", description: "Kostenlos" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", size: "API", description: "Sehr gute Qualität" },
  ],
};

function kbdLabel(hotkey: string) {
  return hotkey.replace("CommandOrControl", "⌘/Ctrl").replaceAll("+", " + ");
}

const modeLabels: Record<Mode, string> = {
  note: "📝 Notiz",
  meeting: "👥 Meeting",
  tasks: "✅ Tasks",
  email: "📧 E-Mail",
  custom: "⚙️ Custom",
};

const formatLabels: Record<OutputFormat, string> = {
  markdown: "Markdown",
  html: "HTML",
  text: "Text (formatiert)",
  plain: "Fließtext",
};

export default function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<Mode>("note");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("note");
  const [listening, setListening] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [status, setStatus] = useState("Bereit");
  const [transcript, setTranscript] = useState("");
  const [showNonSpeechTags] = useState(true); // Always show tags (checkbox removed)
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"main" | "settings" | "prompts">("main");
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null); // Prompt ID being edited
  const [tempPrompt, setTempPrompt] = useState("");
  const [tempPromptName, setTempPromptName] = useState("");
  const [showNewPromptDialog, setShowNewPromptDialog] = useState(false);
  const [draggedPromptId, setDraggedPromptId] = useState<string | null>(null);
  const [dragOverPromptId, setDragOverPromptId] = useState<string | null>(null);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState("");
  const [installingModel, setInstallingModel] = useState(false);
  const [installModelStatus, setInstallModelStatus] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micTestStatus, setMicTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [micTestError, setMicTestError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speechTestStatus, setSpeechTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [speechTestError, setSpeechTestError] = useState<string | null>(null);
  const [speechTestResult, setSpeechTestResult] = useState<string>("");
  const micTestRef = useRef<{ stream: MediaStream | null; analyser: AnalyserNode | null; animationId: number | null }>({
    stream: null,
    analyser: null,
    animationId: null,
  });
  
  // Project management state
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState<string | null>(null); // Name for next recording
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectNameInput, setNewProjectNameInput] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  
  // Audio playback state
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  
  // Segment editing state
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  
  // View toggle: segments vs summary (only relevant when segments exist)
  const [showSummaryView, setShowSummaryView] = useState(false);
  
  // Transcript textarea ref for cursor position (Start/Stop mode)
  const transcriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPositionRef = useRef<{ start: number; end: number } | null>(null);
  
  // Ref for segments-view, um bei neuen Segmenten nach unten zu scrollen
  const segmentsViewRef = useRef<HTMLDivElement | null>(null);
  const transcriptLengthPrevRef = useRef<number>(0);
  
  // Ref to store the actual text value (preserves leading/trailing spaces)
  const transcriptValueRef = useRef<string>("");
  
  // Debounce timer for manual transcript edits
  const manualEditSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Live mode audio chunks for saving
  const liveAudioBlobsRef = useRef<{ blob: Blob; startTime: number }[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Transcription queue for background processing
  const transcriptionQueueRef = useRef<{
    audioBlob: Blob;
    segmentIndex: number;
    startTime: number;
    audioFilePath: string | null;
  }[]>([]);
  const isTranscribingRef = useRef(false);
  
  // Live: "Verarbeitung" state after Stop until queue is empty
  const [isProcessingAfterLiveStop, setIsProcessingAfterLiveStop] = useState(false);
  const isProcessingAfterLiveStopRef = useRef(false);
  const liveProcessingTotalRef = useRef(0);
  
  // Ref to track current project (for use in async functions)
  const currentProjectRef = useRef<Project | null>(null);
  
  // Check if Electron projects API is available
  const [hasElectronProjects, setHasElectronProjects] = useState(false);
  const [projectsDir, setProjectsDir] = useState<string>("");
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);
  
  // Check for Electron API on mount and load projects directory
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const available = !!(window as any).desktop?.projects;
    console.log("Electron projects API available:", available);
    setHasElectronProjects(available);
    
    // Load the projects directory path
    if (available) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).desktop.projects.getDir().then((dir: string) => {
        setProjectsDir(dir);
      }).catch(console.error);
    }
  }, []);
  
  // Audio recording for Whisper (direct Float32 capture)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioSamplesRef = useRef<Float32Array[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  // Live mode refs for Voice Activity Detection
  const liveAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveAnimationRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const isProcessingSegmentRef = useRef(false);
  const liveModeActiveRef = useRef(false);
  
  // Silence countdown for visual feedback
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  
  // Whisper pipeline (loaded in browser)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whisperPipelineRef = useRef<any>(null);
  const [whisperLoading, setWhisperLoading] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState<string>("");
  const [whisperTestStatus, setWhisperTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [whisperTestError, setWhisperTestError] = useState<string | null>(null);
  const [whisperTestLog, setWhisperTestLog] = useState<string[]>([]);
  
  // Ollama setup state
  const [ollamaSetupStatus, setOllamaSetupStatus] = useState<"idle" | "checking" | "installing" | "starting" | "pulling" | "success" | "error">("idle");
  const [ollamaSetupMessage, setOllamaSetupMessage] = useState<string>("");
  const [ollamaSetupSteps, setOllamaSetupSteps] = useState<string[]>([]);
  
  // FFmpeg setup state (für Whisper lokal)
  const [ffmpegStatus, setFfmpegStatus] = useState<"idle" | "checking" | "installed" | "missing" | "installing" | "error">("idle");
  const [ffmpegMessage, setFfmpegMessage] = useState<string>("");
  
  // LLM connection state
  const [llmConnected, setLlmConnected] = useState<boolean | null>(null); // null = not checked

  const supportsWebSpeech = useMemo(() => {
    if (typeof window === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SR;
  }, []);

  // Convert audio blob to Float32Array for Whisper
  // Uses server-side FFmpeg conversion (reliable in Electron)
  async function convertAudioToFloat32(audioBlob: Blob): Promise<Float32Array> {
    // Use FileReader to convert blob to base64 - most reliable method
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Remove the data:audio/webm;base64, prefix
        const base64Data = dataUrl.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
    
    console.log("convertAudioToFloat32: Sending", (base64.length / 1024).toFixed(1), "KB to server");
    
    // Send to server for FFmpeg conversion
    const response = await fetch("/api/convert-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64 }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData.error || "Audio conversion failed") as string;
      if (typeof msg === "string" && (msg.includes("FFmpeg nicht gefunden") || msg.includes("FFmpeg not found"))) {
        throw new Error("FFmpeg fehlt. Bitte in Einstellungen → Spracherkennung auf „FFmpeg einrichten“ klicken.");
      }
      throw new Error(msg);
    }
    
    const data = await response.json();
    
    // Decode base64 to Float32Array - use atob which handles large strings fine
    const samplesBase64 = data.samples;
    const decodedBinaryString = atob(samplesBase64);
    const bytes = new Uint8Array(decodedBinaryString.length);
    for (let i = 0; i < decodedBinaryString.length; i++) {
      bytes[i] = decodedBinaryString.charCodeAt(i);
    }
    console.log("Audio converted via server, samples:", data.length);
    return new Float32Array(bytes.buffer);
  }

  // Dauer aus Audio-Blob (z.B. für Whisper-API-Pfad, der keine Länge zurückgibt)
  async function getAudioDurationFromBlob(blob: Blob): Promise<number> {
    const ctx = new AudioContext();
    try {
      const ab = await blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      return buf.duration;
    } finally {
      await ctx.close();
    }
  }

  // Non-speech tags that can be filtered
  const nonSpeechTagPatterns = useMemo(() => [
    // Generic catch-all for square brackets [anything] - catches [Musik], [Aufregung], [Schreien], etc.
    /\[[^\]]{1,50}\]/gi,
    // Parentheses variants (Musik), (Music), etc.
    /\(\s*Musik\s*\)/gi,
    /\(\s*Music\s*\)/gi,
    /\(\s*Applaus\s*\)/gi,
    /\(\s*Lachen\s*\)/gi,
    /\(\s*Aufregung\s*\)/gi,
    /\(\s*Schreien\s*\)/gi,
    // Asterisk variants *Musik*, * Musik *, *schweißes Lachen*, etc.
    /\*\s*Musik\s*\*/gi,
    /\*\s*Music\s*\*/gi,
    /\*\s*Applaus\s*\*/gi,
    /\*\s*Applause\s*\*/gi,
    /\*\s*Lachen\s*\*/gi,
    /\*\s*Laughter\s*\*/gi,
    /\*\s*Gelächter\s*\*/gi,
    /\*\s*Stille\s*\*/gi,
    /\*\s*Silence\s*\*/gi,
    /\*\s*Räuspern\s*\*/gi,
    /\*\s*Husten\s*\*/gi,
    /\*\s*Seufzen\s*\*/gi,
    /\*\s*Aufregung\s*\*/gi,
    /\*\s*Schreien\s*\*/gi,
    // Generic asterisk patterns for common Whisper outputs
    /\*[^*]{1,30}Lachen[^*]*\*/gi,  // catches *schweißes Lachen*, *nervöses Lachen*, etc.
    /\*[^*]{1,30}Musik[^*]*\*/gi,   // catches *leise Musik*, *laute Musik*, etc.
    /\*[^*]{1,30}Geräusch[^*]*\*/gi, // catches *Hintergrundgeräusche*, etc.
  ], []);

  // Filter non-speech tags from text (preserveWhitespace: true for editing, false for processing)
  const filterNonSpeechTags = useCallback((text: string, preserveWhitespace: boolean = false): string => {
    let filtered = text;
    for (const pattern of nonSpeechTagPatterns) {
      filtered = filtered.replace(pattern, "");
    }
    if (preserveWhitespace) {
      // For editing: don't modify whitespace at all - let user type freely
      return filtered;
    }
    // For processing: collapse all whitespace and trim
    return filtered.replace(/\s+/g, " ").trim();
  }, [nonSpeechTagPatterns]);

  // Erklärung für rote Markierung (isUncertain) – gleiche Heuristiken wie bei der Transkription
  function getUncertainTooltip(segment: TranscriptSegment): string {
    if (!segment.isUncertain) return "Unsichere Erkennung";
    const text = segment.text || "";
    const without = filterNonSpeechTags(text);
    const wordCount = without ? without.split(/\s+/).filter(Boolean).length : 0;
    const duration = Math.max(0, (segment.endTime || 0) - (segment.startTime || 0));
    const hasRepeatedChars = /(.)\1{3,}/.test(without || "");
    const hasEllipsis = (without || "").includes("...");
    const tooFewWordsForDuration = wordCount <= 2 && duration > 3;
    const hasActualSpeech = !!(without && without.length >= 2);

    const reasons: string[] = [];
    if (!hasActualSpeech) {
      reasons.push("Kaum oder kein erkannter Sprachinhalt.");
    } else {
      if (tooFewWordsForDuration) reasons.push("Nur wenige Wörter für die Aufnahmedauer – Transkription könnte unvollständig sein.");
      if (hasEllipsis) reasons.push("Pausen oder Abbrüche (\"…\") in der Erkennung.");
      if (hasRepeatedChars) reasons.push("Wiederholte Zeichen (z.B. Dehnungen) – Erkennung möglicherweise unsicher.");
    }
    return reasons.length > 0 ? reasons.join(" ") : "Unsichere Erkennung – bitte prüfen.";
  }

  // Displayed transcript (filtered if showNonSpeechTags is false)
  // Use preserveWhitespace=true to allow editing at start/end
  const displayedTranscript = useMemo(() => {
    if (showNonSpeechTags) return transcript;
    return filterNonSpeechTags(transcript, true); // preserve whitespace for editing
  }, [transcript, showNonSpeechTags, filterNonSpeechTags]);

  // All available prompts - merge initial prompts with custom ones
  const allPrompts = useMemo(() => {
    const custom = settings?.customPrompts || [];
    if (custom.length === 0) {
      return initialPrompts;
    }
    // Add any missing initial prompts to the list
    const merged = [...custom];
    for (const initial of initialPrompts) {
      if (!merged.some(p => p.id === initial.id)) {
        merged.push(initial);
      }
    }
    return merged;
  }, [settings?.customPrompts]);

  // Get currently selected prompt
  const currentPrompt = useMemo(() => {
    return allPrompts.find(p => p.id === selectedPromptId) || allPrompts[0];
  }, [allPrompts, selectedPromptId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef = useRef<any>(null);

  const defaultSettings: Settings = {
    sttProvider: "whisper-local",
    whisperModel: "Xenova/whisper-base",
    whisperApiKey: "",
    llmProvider: "ollama",
    llmModel: "llama3.2:3b",
    llmApiKey: "",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    language: "de-DE",
    hotkey: "CommandOrControl+Shift+Space",
    outputFormat: "markdown",
    prompts: defaultPrompts,
    customPromptInstructions: "",
    customPrompts: [],
    defaultPromptId: "note",
  };

  async function loadSettings() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).desktop?.getSettings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (await (window as any).desktop.getSettings()) as Settings;
        setSettings(s);
        if (s.outputFormat) setOutputFormat(s.outputFormat);
        if (s.defaultPromptId) setSelectedPromptId(s.defaultPromptId);
      } else {
        setSettings(defaultSettings);
      }
    } catch (e) {
      console.error("loadSettings failed, using defaults:", e);
      setSettings(defaultSettings);
    }
  }

  useEffect(() => {
    loadSettings();
    loadProjects();
  }, []);

  // FFmpeg-Status prüfen, wenn Einstellungen → Spracherkennung mit Whisper lokal
  useEffect(() => {
    if (activeTab === "settings" && settings?.sttProvider === "whisper-local") {
      checkFFmpeg();
    }
  }, [activeTab, settings?.sttProvider]);

  // Bei neuem Segment nach unten scrollen (Live-Modus)
  useEffect(() => {
    if (segments.length === 0) return;
    const el = segmentsViewRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [segments.length]);

  // Bei neuem Transkript-Text nach unten scrollen (Start/Stop: Aufnahme oder Batch)
  useEffect(() => {
    const el = transcriptTextareaRef.current;
    if (!el) return;
    const prev = transcriptLengthPrevRef.current;
    transcriptLengthPrevRef.current = transcript.length;
    if (prev === 0 && transcript.length === 0) return;
    const shouldScroll = listening || (transcript.length > prev && transcript.length - prev > 20);
    if (shouldScroll) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript, listening]);

  // Project management functions
  async function loadProjects() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects) {
      console.log("loadProjects: desktop.projects not available (browser mode)");
      return;
    }
    try {
      console.log("loadProjects: Fetching project list...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectList = await (window as any).desktop.projects.list();
      console.log("loadProjects: Received", projectList.length, "projects");
      
      // Debug: Log first project with segments
      if (projectList.length > 0) {
        const first = projectList[0];
        console.log("loadProjects: First project:", first.name, "segments:", first.segments?.length || 0);
      }
      
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  }

  function prepareNewProject() {
    setNewProjectNameInput("");
    setShowNewProjectDialog(true);
  }
  
  function confirmNewProject() {
    const name = newProjectNameInput.trim();
    setPendingProjectName(name || null);
    // Clear current project so next recording starts fresh
    setCurrentProject(null);
    currentProjectRef.current = null;
    setSegments([]);
    transcriptValueRef.current = "";
    setTranscript("");
    setResult("");
    setProjectName(name || "");
    setShowNewProjectDialog(false);
    setNewProjectNameInput("");
  }
  
  function cancelNewProject() {
    setShowNewProjectDialog(false);
    setNewProjectNameInput("");
  }

  async function createProject(name?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasDesktopProjects = !!(window as any).desktop?.projects;
    console.log("createProject: desktop.projects available:", hasDesktopProjects);
    
    if (!hasDesktopProjects) {
      console.warn("createProject: Electron projects API not available - running in browser mode");
      // Create a mock project for browser mode (no file saving)
      const mockProject: Project = {
        id: `browser_${Date.now()}`,
        path: "",
        name: name || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mode,
        language: settings?.language || "de-DE",
        audioFiles: [],
        segments: []
      };
      // Set both ref and state immediately
      currentProjectRef.current = mockProject;
      setCurrentProject(mockProject);
      setProjectName(mockProject.name);
      setSegments([]);
      return mockProject;
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const project = await (window as any).desktop.projects.create({
        name: name || "",
        mode,
        language: settings?.language || "de-DE"
      });
      console.log("createProject: Project created:", project);
      // Set ref immediately before state (state is async)
      currentProjectRef.current = project;
      await loadProjects();
      setCurrentProject(project);
      setProjectName(project.name);
      setSegments([]);
      return project;
    } catch (err) {
      console.error("Failed to create project:", err);
      return null;
    }
  }

  // Lock to prevent concurrent saves
  const saveLockRef = useRef(false);
  const saveQueueRef = useRef<Array<{ projectId: string; data: Partial<Project> }>>([]);
  
  async function saveCurrentProject(data: Partial<Project>, projectId?: string) {
    // Use provided projectId or fall back to ref (more reliable than state during async ops)
    const targetProjectId = projectId || currentProjectRef.current?.id;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects || !targetProjectId) {
      console.warn("saveCurrentProject: Cannot save - no project ID");
      return;
    }
    
    // Queue the save if already saving
    if (saveLockRef.current) {
      console.log("saveCurrentProject: Queued save for", targetProjectId);
      saveQueueRef.current.push({ projectId: targetProjectId, data });
      return;
    }
    
    saveLockRef.current = true;
    
    try {
      console.log("saveCurrentProject: Saving project", targetProjectId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (window as any).desktop.projects.save(targetProjectId, data);
      
      // Only update state if this is still the current project
      if (currentProjectRef.current?.id === targetProjectId) {
        setCurrentProject(updated);
        currentProjectRef.current = updated;
      }
      
      // Don't reload all projects on every save - too expensive
      // loadProjects() will be called when needed (e.g., when opening dropdown)
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      saveLockRef.current = false;
      
      // Process queued saves
      if (saveQueueRef.current.length > 0) {
        const next = saveQueueRef.current.shift()!;
        saveCurrentProject(next.data, next.projectId);
      }
    }
  }

  async function saveAudioToProject(audioBlob: Blob, segmentIndex: number, projectId?: string): Promise<string | null> {
    const targetProjectId = projectId || currentProject?.id;
    console.log("saveAudioToProject: projectId:", targetProjectId, "segmentIndex:", segmentIndex, "blobSize:", audioBlob.size);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects) {
      console.warn("saveAudioToProject: Electron not available - cannot save audio file");
      return null;
    }
    
    if (!targetProjectId) {
      console.warn("saveAudioToProject: No project ID available");
      return null;
    }
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      console.log("saveAudioToProject: Base64 length:", base64.length);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).desktop.projects.saveAudio(targetProjectId, base64, segmentIndex);
      console.log("saveAudioToProject: Saved as:", result.filePath);
      return result.filePath;
    } catch (err) {
      console.error("Failed to save audio:", err);
      return null;
    }
  }

  async function loadProject(projectId: string) {
    console.log("loadProject: Starting to load project", projectId);
    
    // Clear any pending manual edit save when switching projects
    if (manualEditSaveTimerRef.current) {
      clearTimeout(manualEditSaveTimerRef.current);
      manualEditSaveTimerRef.current = null;
    }
    
    try {
      // First, try to find the project in the already-loaded projects list
      // This is more reliable as the data was already fetched
      let project = projects.find(p => p.id === projectId);
      
      // If not in cache or cache might be stale, fetch fresh from disk
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!project && (window as any).desktop?.projects) {
        console.log("loadProject: Project not in cache, loading from disk");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        project = await (window as any).desktop.projects.load(projectId);
      }
      
      if (!project) {
        console.error("loadProject: Project not found:", projectId);
        setError("Projekt nicht gefunden");
        return;
      }
      
      // Debug: Log the full project object
      console.log("loadProject: Full project data:", JSON.stringify(project, null, 2));
      console.log("loadProject: segments array:", project.segments);
      console.log("loadProject: rawTranscript:", project.rawTranscript?.substring(0, 100));
      
      // Set ref immediately
      currentProjectRef.current = project;
      
      // Set all state
      setCurrentProject(project);
      setProjectName(project.name || "");
      
      // Ensure segments is an array
      const loadedSegments = Array.isArray(project.segments) ? project.segments : [];
      console.log("loadProject: Setting segments:", loadedSegments.length, "items");
      setSegments(loadedSegments);
      
      setMode(project.mode || "note");
      
      // Build transcript from segments or use saved raw transcript
      const fullTranscript = loadedSegments.map((s: TranscriptSegment) => s.text).join(" ");
      const transcriptToSet = project.rawTranscript || fullTranscript || "";
      console.log("loadProject: Setting transcript:", transcriptToSet.substring(0, 100));
      // Update both state and ref to preserve leading/trailing spaces
      transcriptValueRef.current = transcriptToSet;
      setTranscript(transcriptToSet);
      
      const resultToSet = project.enrichedResult || "";
      console.log("loadProject: Setting result:", resultToSet.substring(0, 100));
      setResult(resultToSet);
      
      // Reset audio blobs ref
      liveAudioBlobsRef.current = [];
      
      // Close dropdowns/sidebars
      setShowProjects(false);
      setShowProjectsDropdown(false);
      
      // Reset view to segments (not summary)
      setShowSummaryView(false);
      
      // Switch to main tab to show the loaded content
      setActiveTab("main");
      
      setStatus(`Projekt "${project.name || "Unbenannt"}" geladen`);
      setTimeout(() => setStatus("Bereit"), 2000);
      
      console.log("loadProject: Done - state should be updated now");
    } catch (err) {
      console.error("Failed to load project:", err);
      setError("Projekt konnte nicht geladen werden");
    }
  }

  async function renameProject(newName: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects || !currentProject) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = await (window as any).desktop.projects.rename(currentProject.id, newName);
      setCurrentProject(updated);
      setProjectName(updated.name);
      await loadProjects();
    } catch (err) {
      console.error("Failed to rename project:", err);
    }
  }

  async function deleteProject(projectId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects) return;
    if (!confirm("Projekt wirklich löschen?")) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).desktop.projects.delete(projectId);
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setSegments([]);
        transcriptValueRef.current = "";
        setTranscript("");
        setResult("");
      }
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }

  async function downloadProject(projectId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects?.download) return;
    try {
      setStatus("Exportiere Projekt...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (window as any).desktop.projects.download(projectId);
      if (result) {
        setStatus("Projekt exportiert");
        setTimeout(() => setStatus("Bereit"), 2000);
      } else {
        setStatus("Export abgebrochen");
        setTimeout(() => setStatus("Bereit"), 1500);
      }
    } catch (err) {
      console.error("Failed to download project:", err);
      setError("Export fehlgeschlagen");
      setStatus("Fehler");
    }
  }

  async function uploadProject() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects?.upload) return;
    try {
      setStatus("Importiere Projekt...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const projectId = await (window as any).desktop.projects.upload();
      if (projectId) {
        await loadProjects();
        // Automatically load the imported project
        await loadProject(projectId);
        setStatus("Projekt importiert und geladen");
        setTimeout(() => setStatus("Bereit"), 2000);
      } else {
        setStatus("Import abgebrochen");
        setTimeout(() => setStatus("Bereit"), 1500);
      }
    } catch (err) {
      console.error("Failed to upload project:", err);
      setError("Import fehlgeschlagen");
      setStatus("Fehler");
    }
  }

  async function openProjectFolder(projectId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.projects) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).desktop.projects.openFolder(projectId);
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }

  // Audio playback functions
  // Track pending play to avoid double-play issues
  const pendingPlayRef = useRef<string | null>(null);
  
  async function playSegment(segment: TranscriptSegment) {
    if (!segment.audioFile || !currentProject) return;
    
    // Prevent double-play if already playing this segment
    if (playingSegment === segment.id && audioPlayerRef.current && !audioPlayerRef.current.paused) {
      console.log("playSegment: Already playing this segment, ignoring");
      return;
    }
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioPath = await (window as any).desktop?.projects?.getAudioPath(currentProject.id, segment.audioFile);
      if (!audioPath) {
        console.error("Audio file not found");
        return;
      }
      
      console.log("playSegment: Setting up audio for segment", segment.id, audioPath);
      
      // Stop any current playback first
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      
      // Mark this as pending play
      pendingPlayRef.current = audioPath;
      
      setPlayingSegment(segment.id);
      setAudioSrc(audioPath);
      
      // The actual play will happen in onCanPlayThrough handler
    } catch (err) {
      console.error("Failed to play segment:", err);
      pendingPlayRef.current = null;
    }
  }

  function stopPlayback() {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setPlayingSegment(null);
    setCurrentAudioTime(0);
  }

  // Segment editing functions
  function startEditingSegment(segment: TranscriptSegment) {
    setEditingSegmentId(segment.id);
    setEditingText(segment.text);
  }
  
  function cancelEditingSegment() {
    setEditingSegmentId(null);
    setEditingText("");
  }
  
  async function saveSegmentEdit(segmentId: number) {
    const trimmedText = editingText.trim();
    
    // Update segments state
    const updatedSegments = segments.map(seg => 
      seg.id === segmentId ? { ...seg, text: trimmedText } : seg
    );
    setSegments(updatedSegments);
    
    // Update transcript
    const newTranscript = updatedSegments.map(seg => seg.text).join(" ");
    setTranscript(newTranscript);
    
    // Save to project
    const projectId = currentProjectRef.current?.id;
    if (projectId) {
      await saveCurrentProject({
        segments: updatedSegments,
        rawTranscript: newTranscript
      }, projectId);
    }
    
    // Exit edit mode
    setEditingSegmentId(null);
    setEditingText("");
  }

  // Handle manual transcript edit (Start/Stop mode) with debounced save
  function handleManualTranscriptChange(newText: string) {
    // Save the exact value (preserves leading/trailing spaces)
    transcriptValueRef.current = newText;
    
    // Save cursor position before state update
    const textarea = transcriptTextareaRef.current;
    const cursorPos = textarea ? {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    } : null;
    
    // Calculate new cursor position (adjust if text was inserted/deleted)
    let newCursorPos = cursorPos;
    if (cursorPos && textarea) {
      const oldText = transcriptValueRef.current || transcript;
      const oldLen = oldText.length;
      const newLen = newText.length;
      const diff = newLen - oldLen;
      
      // If text was inserted at cursor, move cursor forward
      if (diff > 0 && cursorPos.start === cursorPos.end) {
        newCursorPos = {
          start: cursorPos.start + diff,
          end: cursorPos.start + diff
        };
      }
      // If text was deleted, cursor position should stay the same or move back
      else if (diff < 0) {
        // Keep cursor at same position (or at end if text was deleted after cursor)
        newCursorPos = {
          start: Math.min(cursorPos.start, newLen),
          end: Math.min(cursorPos.end, newLen)
        };
      }
    }
    
    // Update state immediately (no trim - user might be adding spaces at start/end)
    setTranscript(newText);
    
    // Restore cursor position after React re-render
    // Use double requestAnimationFrame to ensure DOM is fully updated
    if (newCursorPos && textarea) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (transcriptTextareaRef.current) {
            const finalPos = {
              start: Math.min(newCursorPos!.start, newText.length),
              end: Math.min(newCursorPos!.end, newText.length)
            };
            transcriptTextareaRef.current.setSelectionRange(finalPos.start, finalPos.end);
          }
        });
      });
    }
    
    // Debounce saving to avoid too many writes
    if (manualEditSaveTimerRef.current) {
      clearTimeout(manualEditSaveTimerRef.current);
    }
    
    manualEditSaveTimerRef.current = setTimeout(() => {
      const projectId = currentProjectRef.current?.id;
      if (projectId) {
        console.log("handleManualTranscriptChange: Saving manual edit to project", projectId);
        saveCurrentProject({ rawTranscript: newText }, projectId);
      }
    }, 500); // Save 500ms after user stops typing
  }

  // Format timestamp for display
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Format date for display
  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // Global error handler to catch unhandled errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error("Global error:", event.error);
      setError(`Unbehandelter Fehler: ${event.message}`);
      setStatus("Fehler");
      setListening(false);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      const message = event.reason?.message || String(event.reason);
      setError(`Promise-Fehler: ${message}`);
      setStatus("Fehler");
      setListening(false);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.onHotkey) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const off = (window as any).desktop.onHotkey(() => toggleListen());
    return () => off?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, listening, mode]);

  // Auto-check LLM connection when settings change
  useEffect(() => {
    if (settings) {
      // Check LLM connection silently
      testProvider(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.llmProvider, settings?.llmModel, settings?.ollamaBaseUrl]);

  function ensureRecognizer() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) throw new Error("Web Speech API nicht unterstützt.");
    if (recogRef.current) return recogRef.current;

    const rec = new SR();
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = settings?.language || "de-DE";
    rec.continuous = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const parts: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        parts.push(e.results[i][0].transcript);
      }
      setTranscript(parts.join(" ").trim());
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const errorCode = e?.error || "unknown";
      let errorMsg = errorCode;
      
      if (errorCode === "not-allowed") {
        errorMsg = "Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Systemeinstellungen:\n• macOS: Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon → Voice Enricher aktivieren\n• Windows: Einstellungen → Datenschutz → Mikrofon";
      } else if (errorCode === "no-speech") {
        errorMsg = "Keine Sprache erkannt. Bitte sprich deutlicher oder näher am Mikrofon.";
      } else if (errorCode === "audio-capture") {
        errorMsg = "Mikrofon nicht verfügbar. Ist ein Mikrofon angeschlossen?";
      } else if (errorCode === "network") {
        errorMsg = "Netzwerkfehler bei der Spracherkennung. Die Web Speech API benötigt eine aktive Internetverbindung zu Google-Servern. Bitte prüfe deine Verbindung und versuche es erneut.";
      }
      
      setError(errorMsg);
      setStatus("Fehler");
      setListening(false);
    };

    rec.onend = () => {};

    recogRef.current = rec;
    return rec;
  }

  async function startWhisperRecording() {
    try {
      console.log("startWhisperRecording: Getting microphone...");
      
      // Create project for Start/Stop mode (no audio files, just transcript)
      if (!currentProjectRef.current) {
        const project = await createProject(pendingProjectName || undefined);
        if (project) {
          console.log("startWhisperRecording: Created project", project.id);
        }
        setPendingProjectName(null);
      }
      
      recordingStartTimeRef.current = Date.now();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      recordingStreamRef.current = stream;
      audioSamplesRef.current = [];
      audioChunksRef.current = [];
      
      // Check if we should use API (needs MediaRecorder) or local (needs raw samples)
      const useApi = settings?.sttProvider === "whisper-api";
      
      if (useApi) {
        // For API: use MediaRecorder to create WebM file
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
        console.log("startWhisperRecording: Using MediaRecorder for API, mimeType:", mimeType);
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100);
      } else {
        // For local Whisper: use MediaRecorder but convert in a Web Worker or skip decodeAudioData
        // We'll use MediaRecorder and try a safer conversion method
        console.log("startWhisperRecording: Using MediaRecorder for local Whisper");
        
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
        console.log("startWhisperRecording: mimeType:", mimeType);
        
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100);
      }
      
      console.log("startWhisperRecording: Recording started");
      
    } catch (err) {
      const error = err as Error;
      console.error("startWhisperRecording: Error:", err);
      if (error.name === "NotAllowedError") {
        throw new Error("Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Systemeinstellungen.");
      } else if (error.name === "NotFoundError") {
        throw new Error("Kein Mikrofon gefunden.");
      }
      throw error;
    }
  }

  // Live Mode: Start continuous recording with Voice Activity Detection
  async function startLiveMode() {
    try {
      console.log("startLiveMode: Starting...");
      liveModeActiveRef.current = true;
      
      // Check if we're continuing an existing project
      const existingProject = currentProjectRef.current;
      const existingSegments = segments;
      const isContinuing = existingProject && existingSegments.length > 0;
      
      if (isContinuing) {
        console.log("startLiveMode: Continuing existing project", existingProject.id, "with", existingSegments.length, "segments");
        // Keep existing segments and set up audio blobs ref to match
        liveAudioBlobsRef.current = existingSegments.map(() => ({ blob: new Blob(), startTime: 0 }));
      } else {
        // Create a new project for this live session (use pending name if set)
        const project = await createProject(pendingProjectName || undefined);
        if (!project) {
          console.log("startLiveMode: Running without project (browser mode)");
        }
        // Clear pending name after use
        setPendingProjectName(null);
        liveAudioBlobsRef.current = [];
        setSegments([]);
      }
      
      recordingStartTimeRef.current = Date.now();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      recordingStreamRef.current = stream;
      
      // Setup AudioContext for VAD
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      liveAnalyserRef.current = analyser;
      
      // Setup MediaRecorder for segments
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      
      // Start Voice Activity Detection loop
      const silenceThreshold = 15; // Lower threshold - more sensitive to voice
      const silenceDuration = settings?.liveIdleTime || 3000; // ms of silence before processing segment
      const minChunksForSegment = 15; // Minimum ~1.5 seconds of audio before processing
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkVoiceActivity = () => {
        if (!liveModeActiveRef.current) {
          setSilenceCountdown(null);
          return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        if (average < silenceThreshold) {
          // Silence detected - but only start counting when we have enough audio
          // This prevents the silence timer from starting during the "ramp up" phase after recorder restart
          if (audioChunksRef.current.length >= minChunksForSegment) {
            if (silenceStartRef.current === null) {
              // Start silence timer NOW (when we have enough chunks)
              silenceStartRef.current = Date.now();
              console.log("Live: Silence started, chunks:", audioChunksRef.current.length);
            } else {
              const silenceTime = Date.now() - silenceStartRef.current;
              const remaining = Math.max(0, silenceDuration - silenceTime);
              setSilenceCountdown(remaining);
              
              if (silenceTime > silenceDuration && !isProcessingSegmentRef.current) {
                console.log("Live: Processing segment, chunks:", audioChunksRef.current.length);
                // Reset silence timer BEFORE processing to avoid re-triggering
                silenceStartRef.current = null;
                setSilenceCountdown(null);
                processLiveSegment();
              }
            }
          } else {
            // Not enough chunks yet - keep silence timer reset so it doesn't accumulate prematurely
            // This ensures the full countdown is visible once we have enough audio
            silenceStartRef.current = null;
            setSilenceCountdown(null);
          }
        } else {
          // Voice detected - reset silence timer
          silenceStartRef.current = null;
          setSilenceCountdown(null);
        }
        
        // Continue VAD loop
        if (liveModeActiveRef.current) {
          liveAnimationRef.current = requestAnimationFrame(checkVoiceActivity);
        }
      };
      
      liveAnimationRef.current = requestAnimationFrame(checkVoiceActivity);
      console.log("startLiveMode: VAD started");
      
    } catch (err) {
      const error = err as Error;
      console.error("startLiveMode: Error:", err);
      liveModeActiveRef.current = false;
      throw error;
    }
  }
  
  // Process live segment: Save audio first, then queue for transcription
  async function processLiveSegment() {
    if (isProcessingSegmentRef.current) return;
    if (!mediaRecorderRef.current || !recordingStreamRef.current) return;
    isProcessingSegmentRef.current = true;
    
    const segmentStartTime = (Date.now() - recordingStartTimeRef.current) / 1000;
    
    try {
      console.log("processLiveSegment: Stopping recorder for segment...");
      
      // Stop MediaRecorder to get complete WebM file with headers
      const recorder = mediaRecorderRef.current;
      
      // Create a promise that resolves when stop event fires
      const audioBlob = await new Promise<Blob>((resolve) => {
        const chunks = [...audioChunksRef.current];
        
        recorder.onstop = () => {
          // Include any final chunks
          const allChunks = [...chunks, ...audioChunksRef.current.slice(chunks.length)];
          const blob = new Blob(allChunks, { type: 'audio/webm' });
          resolve(blob);
        };
        
        recorder.stop();
      });
      
      // Reset chunks for next segment
      audioChunksRef.current = [];
      
      console.log("processLiveSegment: Blob size:", audioBlob.size);
      
      // Restart MediaRecorder for next segment IMMEDIATELY (if still in live mode)
      if (liveModeActiveRef.current && recordingStreamRef.current) {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm';
        
        const newRecorder = new MediaRecorder(recordingStreamRef.current, { mimeType });
        newRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorderRef.current = newRecorder;
        newRecorder.start(100);
        console.log("processLiveSegment: Restarted recorder immediately");
      }
      
      // Release the processing lock NOW - recording continues
      isProcessingSegmentRef.current = false;
      
      // Skip if too small
      if (audioBlob.size < 1000) {
        console.log("processLiveSegment: Skipped (too small)");
        return;
      }
      
      // FIRST: Save audio file to disk
      const activeProject = currentProjectRef.current;
      const segmentIndex = liveAudioBlobsRef.current.length;
      let audioFilePath: string | null = null;
      
      if (activeProject?.id) {
        console.log("processLiveSegment: Saving audio file first...");
        audioFilePath = await saveAudioToProject(audioBlob, segmentIndex, activeProject.id);
        console.log("processLiveSegment: Audio saved:", audioFilePath);
      }
      
      // Store audio blob reference
      liveAudioBlobsRef.current.push({ blob: audioBlob, startTime: segmentStartTime });
      
      // THEN: Queue for background transcription
      transcriptionQueueRef.current.push({
        audioBlob,
        segmentIndex,
        startTime: segmentStartTime,
        audioFilePath,
      });
      
      console.log("processLiveSegment: Queued for transcription, queue length:", transcriptionQueueRef.current.length);
      
      // Start background transcription if not already running - with delay to not block VAD loop
      if (!isTranscribingRef.current) {
        setTimeout(() => processTranscriptionQueue(), 50);
      }
      
    } catch (err) {
      console.error("processLiveSegment: Error:", err);
      isProcessingSegmentRef.current = false;
    }
  }
  
  // Background transcription processor - works on saved audio files
  async function processTranscriptionQueue() {
    if (isTranscribingRef.current) return;
    if (transcriptionQueueRef.current.length === 0) return;
    
    isTranscribingRef.current = true;
    const total = transcriptionQueueRef.current.length;
    liveProcessingTotalRef.current = total;
    
    while (transcriptionQueueRef.current.length > 0) {
      // IMPORTANT: Yield to event loop BEFORE each transcription
      // This allows the VAD loop (requestAnimationFrame) to run and detect new segments
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const item = transcriptionQueueRef.current.shift()!;
      const currentNum = total - transcriptionQueueRef.current.length;
      
      try {
        console.log("processTranscriptionQueue: Processing segment", item.segmentIndex);
        
        const useSttApi = settings?.sttProvider === "whisper-api";
        let segmentText: string;
        let audioDuration: number;

        if (useSttApi) {
          // Whisper-API-Pfad: Dauer aus Blob, dann /api/transcribe
          if (isProcessingAfterLiveStopRef.current) {
            setStatus(`Transkribiere (Segment ${currentNum} von ${total})...`);
          }
          audioDuration = await getAudioDurationFromBlob(item.audioBlob);
          if (audioDuration < 0.5) {
            console.log("processTranscriptionQueue: Skipped segment", item.segmentIndex, "(too short)");
            continue;
          }
          const wk = settings?.whisperApiKey?.trim();
          if (!wk) {
            setError("OpenAI API Key für Whisper fehlt. Bitte in Einstellungen → Spracherkennung eintragen.");
            continue;
          }
          const formData = new FormData();
          formData.append("audio", item.audioBlob, "audio.webm");
          formData.append("apiKey", wk);
          formData.append("language", settings?.language?.split("-")[0] || "de");
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({})) as { error?: string };
            setError(errData.error || "Whisper-API-Fehler");
            continue;
          }
          const data = await res.json() as { transcript?: string };
          segmentText = (data.transcript || "").trim();
          console.log("processTranscriptionQueue: API transcript for segment", item.segmentIndex, "length:", segmentText.length);
        } else {
          // Lokaler Whisper-Pfad
          if (isProcessingAfterLiveStopRef.current) {
            setStatus(`Konvertiere Audio (Segment ${currentNum} von ${total})...`);
          }
          console.log("processTranscriptionQueue: Converting audio for segment", item.segmentIndex);
          const audioData = await convertAudioToFloat32(item.audioBlob);
          console.log("processTranscriptionQueue: Converted audio samples:", audioData.length, 
            "first:", audioData[0]?.toFixed(6),
            "last:", audioData[audioData.length - 1]?.toFixed(6));
          if (audioData.length < 8000) {
            console.log("processTranscriptionQueue: Skipped segment", item.segmentIndex, "(too short after conversion)");
            continue;
          }
          audioDuration = audioData.length / 16000;
          const whisper = await loadWhisperPipeline();
          if (isProcessingAfterLiveStopRef.current) {
            setStatus(`Transkribiere (Segment ${currentNum} von ${total})...`);
          }
          const language = settings?.language?.split("-")[0] || "german";
          console.log("processTranscriptionQueue: Transcribing segment", item.segmentIndex, "duration:", audioDuration.toFixed(2), "s");
          const result = await whisper(audioData, {
            language,
            task: "transcribe",
            return_timestamps: true,
            chunk_length_s: 30,
            stride_length_s: 5,
          });
          segmentText = (typeof result === "string" ? result : (result as { text?: string }).text || "").trim();
        }
        
        // Skip if completely empty
        if (!segmentText || segmentText.length < 2) {
          console.log("processTranscriptionQueue: Skipped segment", item.segmentIndex, "(empty result)");
          continue;
        }
        
        // Check if segment contains actual speech (not just tags)
        const textWithoutTags = filterNonSpeechTags(segmentText);
        const hasActualSpeech = textWithoutTags && textWithoutTags.length >= 2;
        
        // Check for potentially uncertain recognition
        const wordCount = textWithoutTags ? textWithoutTags.split(/\s+/).length : 0;
        const hasRepeatedChars = /(.)\1{3,}/.test(textWithoutTags || "");
        const hasEllipsis = (textWithoutTags || "").includes("...");
        const tooFewWordsForDuration = wordCount <= 2 && audioDuration > 3;
        const isUncertain = (hasActualSpeech && (tooFewWordsForDuration || hasEllipsis || hasRepeatedChars)) || !hasActualSpeech;
        
        // Create new segment with timestamps
        const newSegment: TranscriptSegment = {
          id: item.segmentIndex,
          text: segmentText,
          startTime: item.startTime,
          endTime: item.startTime + audioDuration,
          audioFile: item.audioFilePath || undefined,
          isUncertain,
        };
        
        // Update segments state
        const activeProject = currentProjectRef.current;
        const activeProjectId = activeProject?.id;
        
        setSegments(prev => {
          const updated = [...prev, newSegment];
          // Save to project - pass projectId explicitly to avoid race conditions
          if (activeProjectId) {
            saveCurrentProject({ segments: updated }, activeProjectId);
          }
          return updated;
        });
        
        // Update transcript
        setTranscript(prev => {
          const textToAdd = isUncertain 
            ? `❓«${segmentText}»`
            : segmentText;
          const newText = prev ? prev + " " + textToAdd : textToAdd;
          
          // Save raw transcript to project - pass projectId explicitly
          if (activeProjectId) {
            saveCurrentProject({ rawTranscript: newText }, activeProjectId);
          }
          
          return newText;
        });
        
        console.log("processTranscriptionQueue: Completed segment", item.segmentIndex, ":", segmentText.substring(0, 50) + "...");
        
        // Yield AFTER transcription to let VAD loop process pending silence detections
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (err) {
        console.error("processTranscriptionQueue: Error processing segment", item.segmentIndex, err);
        setError((err as Error).message);
      }
    }
    
    isTranscribingRef.current = false;
    console.log("processTranscriptionQueue: Queue empty, done.");
  }
  
  async function stopLiveMode() {
    console.log("stopLiveMode: Stopping...");
    liveModeActiveRef.current = false;
    
    // Cancel VAD loop immediately
    if (liveAnimationRef.current) {
      cancelAnimationFrame(liveAnimationRef.current);
      liveAnimationRef.current = null;
    }
    
    // Wait for any current processing to finish (max 5 seconds)
    if (isProcessingSegmentRef.current) {
      console.log("stopLiveMode: Waiting for current processing to finish...");
      let waitCount = 0;
      while (isProcessingSegmentRef.current && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
    }
    
    // Immer processLiveSegment, wenn der Recorder läuft – erfasst auch den finalen Flush bei stop()
    // (bei 0 Chunks liefert onstop die beim stop() geflushten Daten; zu kleine Blobs werden übersprungen)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.log("stopLiveMode: Verarbeite letztes Segment (Chunks jetzt:", audioChunksRef.current.length, ")");
      await processLiveSegment();
    }
    
    // Don't clear mediaRecorderRef here - processLiveSegment might still need it
    // It will be cleared when a new recording starts
    
    // Stop stream
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    
    // Close AudioContext - but don't await to avoid blocking
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    liveAnalyserRef.current = null;
    silenceStartRef.current = null;
    
    // NOTE: Don't save here - wait for transcription queue to finish first!
    // Final save will be done in toggleLiveMode after queue is empty
  }
  
  async function toggleLiveMode() {
    if (liveMode) {
      // UI sofort umschalten, damit der Klick direkt "Verarbeitung" zeigt
      setLiveMode(false);
      setListening(false);
      setSilenceCountdown(null);
      setStatus("Beende Aufnahme...");
      setIsProcessingAfterLiveStop(true);
      isProcessingAfterLiveStopRef.current = true;
      
      // stopLiveMode erst im nächsten Tick starten, damit React die setStates rendern kann
      setTimeout(() => {
        stopLiveMode().then(async () => {
        // Check if there are still items in the transcription queue
        const queueLength = transcriptionQueueRef.current.length;
        if (queueLength > 0 || isTranscribingRef.current) {
          setStatus(`Verarbeite Aufnahme (${queueLength} Segment${queueLength !== 1 ? "e" : ""} in Warteschlange)...`);
          
          // Wait for transcription queue to finish in background (status updated by processTranscriptionQueue)
          const checkQueue = () => {
            return new Promise<void>((resolve) => {
              const check = () => {
                if (transcriptionQueueRef.current.length === 0 && !isTranscribingRef.current) {
                  resolve();
                } else {
                  setTimeout(check, 500);
                }
              };
              check();
            });
          };
          
          await checkQueue();
        }
        
        // Verarbeitung abgeschlossen – Button kann wieder "Fortsetzen" oder "Live" zeigen
        setIsProcessingAfterLiveStop(false);
        isProcessingAfterLiveStopRef.current = false;
        
        // NOW save final project state - after all transcriptions are complete
        // Use a small delay to ensure all state updates have been processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const finalProjectId = currentProjectRef.current?.id;
        if (finalProjectId) {
          console.log("toggleLiveMode: Saving final project state, segments:", segments.length);
          // Generate audioFiles list based on actual segments count
          const audioFiles = segments.map((seg) => seg.audioFile || `audio/segment_${String(seg.id).padStart(4, "0")}.webm`);
          await saveCurrentProject({ audioFiles }, finalProjectId);
          
          // Also refresh the projects list
          await loadProjects();
        }
        
        setStatus("Fertig - Alle Segmente verarbeitet");
        setTimeout(() => setStatus("Bereit"), 2000);
      });
      }, 0); // Nächster Tick: React kann Button-Update rendern, danach stopLiveMode
      
      return; // Don't continue to the else branch
    } else {
      try {
        // Check if continuing existing project
        const isContinuing = currentProjectRef.current && segments.length > 0;
        
        setStatus(isContinuing ? "Setze Aufnahme fort..." : "Starte Live-Modus...");
        
        // Only clear transcript/result for new projects
        if (!isContinuing) {
          transcriptValueRef.current = "";
          setTranscript("");
          setResult("");
        }
        
        transcriptionQueueRef.current = []; // Clear any old queue
        await startLiveMode();
        setLiveMode(true);
        setListening(true);
        setStatus("🔴 Live - Sprich jetzt...");
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setStatus("Fehler");
      }
    }
  }

  // Load Whisper model (runs in browser via WebAssembly)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadWhisperPipeline(): Promise<any> {
    if (whisperPipelineRef.current) {
      return whisperPipelineRef.current;
    }
    
    setWhisperLoading(true);
    setWhisperProgress("Lade Whisper-Bibliothek...");
    
    const model = settings?.whisperModel || "Xenova/whisper-base";
    
    try {
      // Dynamic import to avoid SSR issues
      const { pipeline, env } = await import("@xenova/transformers");
      
      // Configure to load from Hugging Face CDN
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      
      setWhisperProgress("Lade Whisper-Modell...");
      
      const pipe = await pipeline("automatic-speech-recognition", model, {
        progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
          if (progress.status === "downloading") {
            const pct = progress.progress ? Math.round(progress.progress) : 0;
            const fileName = progress.file?.split("/").pop() || "Modell";
            setWhisperProgress(`Lade ${fileName}: ${pct}%`);
          } else if (progress.status === "loading") {
            setWhisperProgress("Initialisiere Modell...");
          } else if (progress.status === "ready") {
            setWhisperProgress("Modell bereit!");
          }
        },
      });
      
      whisperPipelineRef.current = pipe;
      setWhisperLoading(false);
      setWhisperProgress("");
      return pipe;
    } catch (err) {
      setWhisperLoading(false);
      setWhisperProgress("");
      console.error("Whisper loading error:", err);
      throw err;
    }
  }

  // Convert audio blob to Float32Array for Whisper
  async function audioToFloat32(audioBlob: Blob): Promise<Float32Array> {
    console.log("audioToFloat32: Starting conversion, blob size:", audioBlob.size, "type:", audioBlob.type);
    
    const arrayBuffer = await audioBlob.arrayBuffer();
    console.log("audioToFloat32: ArrayBuffer size:", arrayBuffer.byteLength);
    
    // Try to decode the audio
    const audioContext = new AudioContext();
    console.log("audioToFloat32: AudioContext created, sampleRate:", audioContext.sampleRate);
    
    try {
      // Clone the buffer since decodeAudioData detaches it
      const bufferCopy = arrayBuffer.slice(0);
      
      console.log("audioToFloat32: Decoding audio data...");
      const audioBuffer = await audioContext.decodeAudioData(bufferCopy);
      console.log("audioToFloat32: Decoded! Duration:", audioBuffer.duration, "sampleRate:", audioBuffer.sampleRate, "channels:", audioBuffer.numberOfChannels);
      
      const channelData = audioBuffer.getChannelData(0);
      console.log("audioToFloat32: Channel data length:", channelData.length);
      
      // Resample to 16kHz for Whisper
      const targetSampleRate = 16000;
      if (audioBuffer.sampleRate !== targetSampleRate) {
        console.log("audioToFloat32: Resampling from", audioBuffer.sampleRate, "to", targetSampleRate);
        const ratio = audioBuffer.sampleRate / targetSampleRate;
        const newLength = Math.floor(channelData.length / ratio);
        const resampled = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          resampled[i] = channelData[Math.floor(i * ratio)];
        }
        console.log("audioToFloat32: Resampled to", resampled.length, "samples");
        return resampled;
      }
      
      return new Float32Array(channelData);
    } catch (decodeError) {
      console.error("audioToFloat32: decodeAudioData failed:", decodeError);
      throw new Error(`Audio-Decodierung fehlgeschlagen: ${(decodeError as Error).message}. Das WebM-Format wird möglicherweise nicht unterstützt.`);
    } finally {
      await audioContext.close();
    }
  }

  async function stopWhisperRecording(): Promise<string> {
    const useApi = settings?.sttProvider === "whisper-api";
    
    if (useApi) {
      // API path: stop MediaRecorder and send to API
      return new Promise((resolve, reject) => {
        const mediaRecorder = mediaRecorderRef.current;
        if (!mediaRecorder) {
          reject(new Error("Keine Aufnahme aktiv"));
          return;
        }
        
        mediaRecorder.onstop = async () => {
          try {
            console.log("stopWhisperRecording: MediaRecorder stopped");
            
            // Stop all tracks
            recordingStreamRef.current?.getTracks().forEach(track => track.stop());
            recordingStreamRef.current = null;
            
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log("stopWhisperRecording: Audio blob created, size:", audioBlob.size);
            audioChunksRef.current = [];
            
            if (audioBlob.size < 1000) {
              reject(new Error("Aufnahme zu kurz. Bitte sprich länger."));
              return;
            }
            
            setStatus("Sende an Whisper API...");
            console.log("stopWhisperRecording: Using Whisper API");
            
            const apiKey = settings?.whisperApiKey?.trim();
            if (!apiKey) {
              reject(new Error("OpenAI API Key für Whisper fehlt. Bitte in Einstellungen → Spracherkennung eintragen."));
              return;
            }
            
            const formData = new FormData();
            formData.append("audio", audioBlob, "recording.webm");
            formData.append("apiKey", apiKey);
            formData.append("language", settings?.language?.split("-")[0] || "de");
            
            const response = await fetch("/api/transcribe", {
              method: "POST",
              body: formData,
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              reject(new Error(errorData.error || "Transkription fehlgeschlagen"));
              return;
            }
            
            const data = await response.json();
            resolve((data.transcript || "").trim());
            
          } catch (err) {
            console.error("stopWhisperRecording API error:", err);
            reject(err);
          }
        };
        
        mediaRecorder.stop();
      });
    } else {
      // Local Whisper path: use MediaRecorder + safe audio conversion
      return new Promise((resolve, reject) => {
        const mediaRecorder = mediaRecorderRef.current;
        if (!mediaRecorder) {
          reject(new Error("Keine Aufnahme aktiv"));
          return;
        }
        
        mediaRecorder.onstop = async () => {
          try {
            console.log("stopWhisperRecording local: MediaRecorder stopped");
            
            // Stop all tracks
            recordingStreamRef.current?.getTracks().forEach(track => track.stop());
            recordingStreamRef.current = null;
            
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            console.log("stopWhisperRecording local: Blob size:", audioBlob.size);
            audioChunksRef.current = [];
            
            if (audioBlob.size < 1000) {
              reject(new Error("Aufnahme zu kurz. Bitte sprich länger."));
              return;
            }
            
            // Convert audio on server using FFmpeg (avoids Electron decodeAudioData crash)
            setStatus("Konvertiere Audio...");
            console.log("stopWhisperRecording local: Converting audio...");
            
            const audioData = await convertAudioToFloat32(audioBlob);
            console.log("stopWhisperRecording local: Conversion done, samples:", audioData.length);
            
            if (audioData.length < 8000) {
              reject(new Error("Audio zu kurz nach Konvertierung"));
              return;
            }
            
            const duration = audioData.length / 16000;
            console.log("stopWhisperRecording local: Audio duration:", duration, "s");
            
            // Load Whisper model
            setStatus("Lade Whisper-Modell...");
            console.log("stopWhisperRecording local: Loading Whisper model...");
            const whisper = await loadWhisperPipeline();
            console.log("stopWhisperRecording local: Whisper model loaded");
            
            // Transcribe
            setStatus("Transkribiere...");
            const language = settings?.language?.split("-")[0] || "german";
            console.log("stopWhisperRecording local: Transcribing, duration:", duration, "s, language:", language);
            
            // Use chunking for longer audio to avoid 30-second limit
            const result = await whisper(audioData, {
              language: language,
              task: "transcribe",
              chunk_length_s: 30,
              stride_length_s: 5,
            });
            
            console.log("stopWhisperRecording local: Result:", result);
            
            const transcript = (typeof result === "string" 
              ? result 
              : (result as { text?: string }).text || "").trim();
            
            resolve(transcript);
            
          } catch (err) {
            console.error("stopWhisperRecording local error:", err);
            reject(err);
          }
        };
        
        mediaRecorder.stop();
      });
    }
  }

  async function toggleListen() {
    setError(null);
    if (!settings) return;

    const useWhisper = settings.sttProvider === "whisper-local" || settings.sttProvider === "whisper-api";

    if (!listening) {
      // Start recording
      setStatus("Höre zu...");
      setResult("");
      // Don't clear transcript - we'll insert at cursor position (saved on blur/select)
      
      try {
        if (useWhisper) {
          await startWhisperRecording();
        } else {
          // Web Speech API fallback
          if (!supportsWebSpeech) {
            setError("Web Speech API nicht verfügbar (Chromium erforderlich)");
            return;
          }
          const rec = ensureRecognizer();
          rec.lang = settings.language || "de-DE";
          rec.start();
        }
        setListening(true);
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setStatus("Fehler");
      }
    } else {
      // Stop recording
      setStatus("Verarbeite...");
      setListening(false);
      
      try {
        if (useWhisper) {
          const newText = await stopWhisperRecording();
          
          if (newText.trim()) {
            // Insert at cursor position or append
            const cursor = cursorPositionRef.current;
            console.log("Inserting text, cursor position:", cursor, "existing text length:", transcript.length);
            
            let finalTranscript = "";
            
            setTranscript(prev => {
              // Check if there's any existing content (including just spaces - user might want them)
              if (prev.length === 0) {
                // Completely empty, just use new text (trimmed for initial text)
                finalTranscript = newText.trim();
                return finalTranscript;
              }
              
              if (cursor && cursor.start !== undefined) {
                // Insert at cursor position (preserve all existing content including spaces)
                const before = prev.substring(0, cursor.start);
                const after = prev.substring(cursor.end);
                // Only add separator if needed (not if user deliberately placed cursor after/before space)
                const separator = before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
                const separatorAfter = after.length > 0 && !after.startsWith(" ") && !after.startsWith("\n") ? " " : "";
                finalTranscript = before + separator + newText.trim() + separatorAfter + after;
                return finalTranscript;
              } else {
                // Append to end (add space only if previous doesn't end with space/newline)
                const separator = prev.endsWith(" ") || prev.endsWith("\n") ? "" : " ";
                finalTranscript = prev + separator + newText.trim();
                return finalTranscript;
              }
            });
            
            // Clear cursor position
            cursorPositionRef.current = null;
            
            // Save transcript to project (Start/Stop mode - no audio)
            const projectId = currentProjectRef.current?.id;
            if (projectId) {
              // Use setTimeout to ensure state has updated
              setTimeout(() => {
                saveCurrentProject({ rawTranscript: finalTranscript }, projectId);
              }, 100);
            }
            
            // Don't auto-run enrichment in append mode - let user trigger it
            if (!transcript.trim()) {
              runEnrichment(newText);
            } else {
              setStatus("Text hinzugefügt");
              setTimeout(() => setStatus("Bereit"), 1500);
            }
          } else {
            setStatus("Keine Sprache erkannt");
          }
        } else {
          // Web Speech API fallback
          const rec = ensureRecognizer();
          try {
            rec.stop();
          } catch { /* ignore */ }
          setTimeout(() => runEnrichment(), 250);
        }
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        setStatus("Fehler");
      }
    }
  }

  const runEnrichment = useCallback(async (transcriptText?: string) => {
    if (!settings) return;
    let tx = (transcriptText || transcript).trim();
    
    // Clean up text before sending to LLM:
    // 1. Remove non-speech tags like [Musik], [Applaus] etc.
    tx = filterNonSpeechTags(tx);
    // 2. Remove uncertainty markers ❓«...»
    tx = tx.replace(/❓«([^»]*)»/g, "$1");
    tx = tx.trim();
    
    if (!tx) {
      setStatus("Keine Sprache erkannt");
      return;
    }
    setStatus("KI verarbeitet...");
    try {
      // Use the selected prompt from the new flexible system
      const selectedPrompt = allPrompts.find(p => p.id === selectedPromptId);
      const promptText = selectedPrompt?.prompt || "Mache aus dem Transkript eine strukturierte Notiz.";
      
      console.log("runEnrichment - selectedPromptId:", selectedPromptId);
      console.log("runEnrichment - selectedPrompt:", selectedPrompt);
      console.log("runEnrichment - promptText:", promptText);
      
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.llmProvider,
          model: settings.llmModel,
          apiKey: settings.llmApiKey || "",
          transcript: tx,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          customPrompt: promptText,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const enrichedResult = (data.result || "").trim();
      setResult(enrichedResult);
      setStatus("Fertig");
      
      // Save enriched result to project - only for Live Mode projects (with segments)
      const projectId = currentProjectRef.current?.id;
      const hasSegments = currentProjectRef.current?.segments && currentProjectRef.current.segments.length > 0;
      if (projectId && hasSegments) {
        saveCurrentProject({ enrichedResult }, projectId);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Enrichment failed";
      setError(message);
      setStatus("Fehler");
    }
  }, [settings, transcript, filterNonSpeechTags, allPrompts, selectedPromptId]);

  async function saveSettings(partial: Partial<Settings>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).desktop?.saveSettings) {
      setSettings((s) => (s ? { ...s, ...partial } : (partial as Settings)));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (await (window as any).desktop.saveSettings(partial)) as Settings;
    setSettings(next);
  }

  async function savePrompt(m: Mode, prompt: string) {
    if (!settings) return;
    const newPrompts = { ...settings.prompts, [m]: prompt };
    await saveSettings({ prompts: newPrompts });
  }

  async function resetPrompts() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).desktop?.resetPrompts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = await (window as any).desktop.resetPrompts();
      setSettings(next);
    } else {
      await saveSettings({ prompts: defaultPrompts });
    }
  }

  async function copyResult() {
    if (!result.trim()) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const desktop = (window as any).desktop;
      
      // Try Electron clipboard first (always use if available)
      if (desktop?.copyToClipboard) {
        desktop.copyToClipboard(result);
        setStatus("Kopiert!");
        setTimeout(() => setStatus("Bereit"), 1500);
        return;
      }
      
      // Fallback: execCommand (works everywhere including Electron)
      const textArea = document.createElement("textarea");
      textArea.value = result;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      
      if (success) {
        setStatus("Kopiert!");
        setTimeout(() => setStatus("Bereit"), 1500);
      } else {
        setStatus("Kopieren fehlgeschlagen");
      }
    } catch (err) {
      console.error("Copy error:", err);
      setStatus("Kopieren fehlgeschlagen");
    }
  }

  async function speakResult() {
    if (!result.trim()) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const desktop = (window as any).desktop;
    
    // Stop if already speaking
    if (isSpeaking) {
      if (desktop?.stopSpeaking) await desktop.stopSpeaking();
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    
    // Clean text for speech (remove markdown/html formatting)
    const textToSpeak = result
      .replace(/#{1,6}\s*/g, "") // Remove markdown headers
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold
      .replace(/\*([^*]+)\*/g, "$1") // Remove italic
      .replace(/`([^`]+)`/g, "$1") // Remove code
      .replace(/<[^>]+>/g, " ") // Remove HTML tags, replace with space
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
      .replace(/[-*]\s+/g, "") // Remove list markers
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim();
    
    // Try native macOS TTS first (better quality)
    if (desktop?.speak) {
      const res = await desktop.speak(textToSpeak);
      if (res?.success && res?.native) {
        console.log("TTS: Using native macOS say command");
        setIsSpeaking(true);
        // Estimate duration (~150 words/min)
        const words = textToSpeak.split(/\s+/).length;
        const estimatedMs = Math.max((words / 150) * 60 * 1000, 2000);
        setTimeout(() => setIsSpeaking(false), estimatedMs);
        return;
      }
    }
    
    // Fallback to Web Speech API
    console.log("TTS: Using Web Speech API");
    window.speechSynthesis.cancel();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          window.speechSynthesis.onvoiceschanged = null;
          resolve();
        };
        setTimeout(resolve, 500);
      });
    }
    
    const langCode = settings?.language?.split("-")[0] || "de";
    const langVoices = voices.filter(v => v.lang.startsWith(langCode));
    let selectedVoice = langVoices.find(v => v.localService) || langVoices[0];
    if (!selectedVoice) selectedVoice = voices[0];
    
    console.log("TTS: Voice:", selectedVoice?.name);
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = settings?.language || "de-DE";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      if (e.error !== "interrupted") console.error("TTS error:", e.error);
      setIsSpeaking(false);
    };
    
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  async function setupOllama() {
    const model = settings?.llmModel || "llama3.2:3b";
    
    setOllamaSetupStatus("checking");
    setOllamaSetupMessage("Prüfe Ollama-Status...");
    setOllamaSetupSteps([]);
    
    try {
      const response = await fetch("/api/ollama-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup", model }),
      });
      
      const data = await response.json();
      
      if (data.steps) {
        setOllamaSetupSteps(data.steps);
      }
      
      if (data.success) {
        setOllamaSetupStatus("success");
        setOllamaSetupMessage("Ollama ist bereit!");
        // Refresh connection status
        await checkOllama();
      } else {
        setOllamaSetupStatus("error");
        setOllamaSetupMessage(data.message || "Setup fehlgeschlagen");
      }
    } catch (err) {
      console.error("Ollama setup error:", err);
      setOllamaSetupStatus("error");
      setOllamaSetupMessage("Setup fehlgeschlagen. Bitte manuell installieren.");
      // Fallback: open download page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).desktop?.openExternal?.("https://ollama.com/download");
    }
  }
  
  async function checkOllama() {
    try {
      const response = await fetch("/api/ollama-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });
      const data = await response.json();
      return data;
    } catch {
      return { installed: false, running: false };
    }
  }

  async function checkFFmpeg() {
    setFfmpegStatus("checking");
    setFfmpegMessage("");
    try {
      const res = await fetch("/api/ffmpeg-setup", { method: "GET" });
      const data = await res.json();
      setFfmpegStatus(data.installed ? "installed" : "missing");
      return data.installed;
    } catch {
      setFfmpegStatus("missing");
      return false;
    }
  }

  async function setupFFmpeg() {
    setFfmpegStatus("installing");
    setFfmpegMessage("Installiere FFmpeg...");
    try {
      const res = await fetch("/api/ffmpeg-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });
      const data = await res.json();
      if (data.success) {
        setFfmpegStatus("installed");
        setFfmpegMessage(data.message || "FFmpeg installiert.");
      } else {
        setFfmpegStatus("error");
        setFfmpegMessage(data.message || "Installation fehlgeschlagen.");
      }
    } catch (err) {
      setFfmpegStatus("error");
      setFfmpegMessage("Installation fehlgeschlagen. Bitte manuell: brew install ffmpeg");
    }
  }

  async function testMicrophone() {
    setMicTestStatus("testing");
    setMicTestError(null);
    setMicLevel(0);

    // Stop any existing test
    stopMicTest();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micTestRef.current.stream = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micTestRef.current.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function updateLevel() {
        if (!micTestRef.current.analyser) return;
        micTestRef.current.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(100, average * 1.5));
        micTestRef.current.animationId = requestAnimationFrame(updateLevel);
      }
      updateLevel();

      setMicTestStatus("success");

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (micTestRef.current.stream) {
          stopMicTest();
        }
      }, 10000);
    } catch (err) {
      const error = err as Error;
      let errorMsg = error.message;
      
      if (error.name === "NotAllowedError") {
        errorMsg = "Mikrofon-Zugriff verweigert. Bitte erlaube den Zugriff in den Systemeinstellungen.";
      } else if (error.name === "NotFoundError") {
        errorMsg = "Kein Mikrofon gefunden. Ist ein Mikrofon angeschlossen?";
      } else if (error.name === "NotReadableError") {
        errorMsg = "Mikrofon wird bereits von einer anderen App verwendet.";
      }
      
      setMicTestError(errorMsg);
      setMicTestStatus("error");
    }
  }

  function stopMicTest() {
    if (micTestRef.current.animationId) {
      cancelAnimationFrame(micTestRef.current.animationId);
      micTestRef.current.animationId = null;
    }
    if (micTestRef.current.stream) {
      micTestRef.current.stream.getTracks().forEach(track => track.stop());
      micTestRef.current.stream = null;
    }
    micTestRef.current.analyser = null;
    setMicLevel(0);
    if (micTestStatus === "success") {
      setMicTestStatus("idle");
    }
  }

  async function testSpeechRecognition() {
    setSpeechTestStatus("testing");
    setSpeechTestError(null);
    setSpeechTestResult("");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        throw new Error("Web Speech API nicht unterstützt in diesem Browser.");
      }

      const rec = new SR();
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.lang = settings?.language || "de-DE";
      rec.continuous = false;

      const timeout = setTimeout(() => {
        rec.stop();
        setSpeechTestError("Timeout: Keine Sprache erkannt nach 5 Sekunden. Bitte sprich lauter oder näher am Mikrofon.");
        setSpeechTestStatus("error");
      }, 5000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        clearTimeout(timeout);
        const transcript = e.results[0][0].transcript;
        setSpeechTestResult(transcript);
        setSpeechTestStatus("success");
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        clearTimeout(timeout);
        const errorCode = e?.error || "unknown";
        let errorMsg = `Fehler: ${errorCode}`;
        
        if (errorCode === "not-allowed") {
          errorMsg = "Mikrofon-Zugriff verweigert. Bitte prüfe die Berechtigungen.";
        } else if (errorCode === "no-speech") {
          errorMsg = "Keine Sprache erkannt. Bitte sprich lauter.";
        } else if (errorCode === "audio-capture") {
          errorMsg = "Mikrofon nicht verfügbar. Ist ein Mikrofon angeschlossen?";
        } else if (errorCode === "network") {
          errorMsg = `Netzwerkfehler: Die Web Speech API benötigt eine Verbindung zu Google-Servern. 
Mögliche Ursachen:
• Keine Internetverbindung
• Firewall blockiert google.com
• VPN-Probleme
• Google-Server nicht erreichbar

Tipp: Prüfe ob https://www.google.com erreichbar ist.`;
        } else if (errorCode === "aborted") {
          errorMsg = "Spracherkennung abgebrochen.";
        } else if (errorCode === "service-not-allowed") {
          errorMsg = "Spracherkennungsdienst nicht erlaubt. Dies kann an Browser-Einschränkungen liegen.";
        }
        
        setSpeechTestError(errorMsg);
        setSpeechTestStatus("error");
      };

      rec.onend = () => {
        clearTimeout(timeout);
      };

      rec.start();
    } catch (err) {
      const error = err as Error;
      setSpeechTestError(error.message);
      setSpeechTestStatus("error");
    }
  }

  async function testWhisper() {
    setWhisperTestStatus("testing");
    setWhisperTestError(null);
    setWhisperTestLog(["🚀 Starte Whisper-Test..."]);

    const addLog = (msg: string) => {
      setWhisperTestLog(prev => [...prev, msg]);
    };

    try {
      // Step 1: Check browser support
      addLog("📋 Prüfe Browser-Unterstützung...");
      if (typeof window === "undefined") {
        throw new Error("Kein Browser-Kontext verfügbar");
      }
      addLog("✓ Browser-Kontext OK");

      // Step 2: Load transformers library
      addLog("📦 Lade @xenova/transformers Bibliothek...");
      const { pipeline, env } = await import("@xenova/transformers");
      addLog("✓ Bibliothek geladen");

      // Step 3: Configure environment
      addLog("⚙️ Konfiguriere Umgebung...");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      addLog("✓ Umgebung konfiguriert (CDN-Modus)");

      // Step 4: Load Whisper model
      const model = settings?.whisperModel || "Xenova/whisper-tiny";
      addLog(`📥 Lade Whisper-Modell: ${model}`);
      addLog("   (Dies kann beim ersten Mal 1-2 Minuten dauern...)");

      const transcriber = await pipeline("automatic-speech-recognition", model, {
        progress_callback: (progress: { status: string; progress?: number; file?: string; loaded?: number; total?: number }) => {
          if (progress.status === "downloading" && progress.file) {
            const pct = progress.progress ? Math.round(progress.progress) : 0;
            const fileName = progress.file.split("/").pop() || progress.file;
            addLog(`   ⬇️ ${fileName}: ${pct}%`);
          } else if (progress.status === "loading") {
            addLog("   🔄 Lade Modell in Speicher...");
          } else if (progress.status === "ready") {
            addLog("   ✓ Modell bereit!");
          }
        },
      });
      addLog("✓ Whisper-Modell geladen");

      // Step 5: Create test audio (simple sine wave)
      addLog("🎵 Erstelle Test-Audio...");
      const sampleRate = 16000;
      const duration = 1; // 1 second of silence/noise
      const samples = new Float32Array(sampleRate * duration);
      // Fill with very quiet noise (simulates silence)
      for (let i = 0; i < samples.length; i++) {
        samples[i] = (Math.random() - 0.5) * 0.001;
      }
      addLog("✓ Test-Audio erstellt");

      // Step 6: Run transcription
      addLog("🎤 Führe Test-Transkription durch...");
      const result = await transcriber(samples, {
        language: "german",
        task: "transcribe",
      });
      addLog("✓ Transkription abgeschlossen");

      // Step 7: Check result
      const transcript = typeof result === "string" ? result : (result as { text?: string }).text || "(leer)";
      addLog(`📝 Ergebnis: "${transcript.trim() || "(Stille erkannt)"}"`);

      // Cache the pipeline for later use
      whisperPipelineRef.current = transcriber;

      addLog("");
      addLog("🎉 WHISPER FUNKTIONIERT!");
      setWhisperTestStatus("success");

    } catch (err) {
      const error = err as Error;
      addLog("");
      addLog(`❌ FEHLER: ${error.message}`);
      if (error.stack) {
        addLog(`   Stack: ${error.stack.split("\n")[1]?.trim() || "N/A"}`);
      }
      setWhisperTestError(error.message);
      setWhisperTestStatus("error");
    }
  }

  async function testProvider(silent = false) {
    if (!silent) setError(null);
    if (!settings) return false;
    if (!silent) setStatus("Teste Verbindung...");
    try {
      const currentPrompt = settings.prompts?.[mode] || defaultPrompts[mode];
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.llmProvider,
          model: settings.llmModel,
          apiKey: settings.llmApiKey || "",
          transcript: "Test",
          mode: "note",
          ollamaBaseUrl: settings.ollamaBaseUrl,
          outputFormat,
          customPrompt: currentPrompt,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLlmConnected(true);
      if (!silent) {
        setStatus("Test erfolgreich!");
      }
      return true;
    } catch (e: unknown) {
      setLlmConnected(false);
      if (!silent) {
        const message = e instanceof Error ? e.message : "Test failed";
        setError(message);
        setStatus("Test fehlgeschlagen");
      }
      return false;
    }
  }

  if (!settings) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner" />
          <span>Lade...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${showProjects ? "with-sidebar" : ""}`}>
      {/* Hidden Audio Player */}
      <audio
        ref={audioPlayerRef}
        src={audioSrc || undefined}
        onTimeUpdate={(e) => setCurrentAudioTime(e.currentTarget.currentTime)}
        onCanPlayThrough={(e) => {
          // Only auto-play if this is the pending audio
          const currentSrc = e.currentTarget.src;
          if (pendingPlayRef.current && currentSrc.includes(pendingPlayRef.current.replace("audio-file://", ""))) {
            console.log("onCanPlayThrough: Starting playback");
            pendingPlayRef.current = null;
            e.currentTarget.currentTime = 0;
            e.currentTarget.play().catch(err => console.error("Play failed:", err));
          }
        }}
        onEnded={() => {
          setPlayingSegment(null);
          setCurrentAudioTime(0);
        }}
        style={{ display: "none" }}
      />

      {/* Projects Sidebar */}
      {showProjects && (
        <aside className="projects-sidebar">
          <div className="sidebar-header">
            <h3>📁 Projekte</h3>
            <button className="btn icon" onClick={() => setShowProjects(false)} title="Schließen">×</button>
          </div>
          {!hasElectronProjects && (
            <div className="sidebar-warning">
              ⚠️ Browser-Modus: Projekte werden nicht dauerhaft gespeichert. Starte die App mit <code>npm run electron</code> für vollständige Funktionalität.
            </div>
          )}
          <div className="sidebar-actions">
            <button className="btn small" onClick={prepareNewProject} disabled={!hasElectronProjects}>+ Neu</button>
            <button className="btn small icon" onClick={() => openProjectFolder()} title="Ordner öffnen" disabled={!hasElectronProjects}>📂</button>
          </div>
          <div className="projects-list">
            {projects.length === 0 ? (
              <div className="empty-state">{hasElectronProjects ? "Keine Projekte vorhanden" : "Starte Electron für Projektspeicherung"}</div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className={`project-item ${currentProject?.id === project.id ? "active" : ""}`}
                  onClick={() => loadProject(project.id)}
                >
                  <div className="project-name">{project.name || "Unbenannt"}</div>
                  <div className="project-meta">
                    <span className="project-date">{formatDate(project.createdAt)}</span>
                    <span className="project-mode">{modeLabels[project.mode]}</span>
                  </div>
                  <div className="project-actions">
                    <button
                      className="btn icon small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProjectFolder(project.id);
                      }}
                      title="Ordner öffnen"
                    >
                      📂
                    </button>
                    <button
                      className="btn icon small danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      title="Löschen"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button
            className={`btn icon ${showProjects ? "active" : ""}`}
            onClick={() => setShowProjects(!showProjects)}
            title="Projekte anzeigen"
          >
            📁
          </button>
          <h1 className="logo">
            <span className="logo-icon">🎤</span>
            Voice Enricher
          </h1>
          <span className="version">v1.0</span>
          
          {/* Project selector with dropdown */}
          <div className="project-selector">
            {currentProject ? (
              <div className="current-project">
                {editingProjectName ? (
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => {
                      renameProject(projectName);
                      setEditingProjectName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        renameProject(projectName);
                        setEditingProjectName(false);
                      } else if (e.key === "Escape") {
                        setProjectName(currentProject.name);
                        setEditingProjectName(false);
                      }
                    }}
                    autoFocus
                    className="project-name-input"
                  />
                ) : (
                  <span
                    className="project-name-display"
                    onClick={() => setEditingProjectName(true)}
                    title="Klicken zum Umbenennen"
                  >
                    {projectName || "Unbenanntes Projekt"}
                  </span>
                )}
              </div>
            ) : pendingProjectName !== null ? (
              <div className="project-selector pending">
                <span className="pending-project-name" title="Name für nächste Aufnahme">
                  📝 {pendingProjectName || "Unbenannt"} <small>(bereit)</small>
                </span>
              </div>
            ) : (
              <span className="no-project">Kein Projekt</span>
            )}
            
            {/* Dropdown toggle for recent projects */}
            {hasElectronProjects && projects.length > 0 && (
              <div className="projects-dropdown-container">
                <button
                  className={`btn icon small projects-dropdown-btn ${showProjectsDropdown ? "active" : ""}`}
                  onClick={() => {
                    if (!showProjectsDropdown) {
                      // Reload projects when opening dropdown
                      loadProjects();
                    }
                    setShowProjectsDropdown(!showProjectsDropdown);
                  }}
                  title="Letzte Projekte"
                >
                  ▼
                </button>
                
                {/* Project action buttons */}
                <button
                  className="project-action-btn"
                  onClick={uploadProject}
                  title="Projekt importieren (ZIP)"
                >
                  ↑
                </button>
                {currentProject && (
                  <>
                    <button
                      className="project-action-btn"
                      onClick={() => downloadProject(currentProject.id)}
                      title="Projekt exportieren (ZIP)"
                    >
                      ↓
                    </button>
                    <button
                      className="delete-project-btn"
                      onClick={() => deleteProject(currentProject.id)}
                      title="Projekt löschen"
                    >
                      ✕
                    </button>
                  </>
                )}
                
                {showProjectsDropdown && (
                  <>
                    <div className="dropdown-backdrop" onClick={() => setShowProjectsDropdown(false)} />
                    <div className="projects-dropdown">
                      <div className="dropdown-header">
                        <span>Letzte Projekte</span>
                        <button 
                          className="btn small"
                          onClick={() => {
                            prepareNewProject();
                            setShowProjectsDropdown(false);
                          }}
                        >
                          + Neu
                        </button>
                      </div>
                      <div className="dropdown-list">
                        {projects.slice(0, 10).map((project) => (
                          <div
                            key={project.id}
                            className={`dropdown-item ${currentProject?.id === project.id ? "active" : ""}`}
                            onClick={() => {
                              loadProject(project.id);
                              setShowProjectsDropdown(false);
                            }}
                          >
                            <div className="dropdown-item-name">
                              {project.name || "Unbenannt"}
                            </div>
                            <div className="dropdown-item-meta">
                              <span>{formatDate(project.createdAt)}</span>
                              <span className="dropdown-item-mode">{project.segments && project.segments.length > 0 ? "🎵 Live" : "📝 Text"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="dropdown-footer">
                        <button
                          className="btn small"
                          onClick={() => {
                            setShowProjects(true);
                            setShowProjectsDropdown(false);
                          }}
                        >
                          Alle Projekte anzeigen
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="hotkey-badge">
            <span className="kbd">{kbdLabel(settings.hotkey)}</span>
          </div>
          <nav className="tabs">
            <button
              className={`tab ${activeTab === "main" ? "active" : ""}`}
              onClick={() => setActiveTab("main")}
            >
              Aufnahme
            </button>
            <button
              className={`tab ${activeTab === "prompts" ? "active" : ""}`}
              onClick={() => setActiveTab("prompts")}
            >
              Prompts
            </button>
            <button
              className={`tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Einstellungen
            </button>
          </nav>
        </div>
      </header>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-left">
          <span className={`status-dot ${listening ? "recording" : whisperLoading ? "loading" : error ? "error" : "idle"}`} />
          <span className="status-text">
            {whisperProgress || status}
          </span>
          {/* Live mode silence countdown */}
          {liveMode && silenceCountdown !== null && (
            <span className="silence-countdown" title="Sprechpause erkannt - Segment wird verarbeitet">
              ⏱️ {(silenceCountdown / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <div className="status-right">
          {settings.sttProvider === "whisper-local" && (
            <span className="provider-badge stt">🎙️ Whisper</span>
          )}
          <span className={`provider-badge ${llmConnected === true ? "connected" : llmConnected === false ? "disconnected" : ""}`}>
            {llmConnected === true ? "✓ " : llmConnected === false ? "✗ " : ""}
            {settings.llmProvider === "ollama" ? "Ollama" : 
             settings.llmProvider === "gemini" ? "Gemini" :
             settings.llmProvider === "openai" ? "OpenAI" : "OpenRouter"}
          </span>
          {!supportsWebSpeech && (
            <span className="error-badge">⚠️ WebSpeech nicht verfügbar</span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button className="error-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Main Content */}
      <main className="main">
        {activeTab === "main" && (
          <div className="main-content">
            {/* Controls */}
            <div className="controls-row">
              <div className="control-group">
                <label>Prompt</label>
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  className="prompt-select"
                >
                  {allPrompts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {/* Show Start/Stop button only if project has no Live segments */}
              {segments.length === 0 && (
                <button
                  className={`record-btn ${listening && !liveMode ? "recording" : ""}`}
                  onMouseDown={() => {
                    // Save cursor position BEFORE focus changes
                    if (transcriptTextareaRef.current && !listening) {
                      cursorPositionRef.current = {
                        start: transcriptTextareaRef.current.selectionStart,
                        end: transcriptTextareaRef.current.selectionEnd
                      };
                      console.log("Saved cursor position:", cursorPositionRef.current);
                    }
                  }}
                  onClick={toggleListen}
                  disabled={liveMode}
                >
                  {listening && !liveMode ? (
                    <>
                      <span className="pulse" />
                      Stop
                    </>
                  ) : (
                    <>🎤 Start</>
                  )}
                </button>
              )}
              {/* Show Live button only if project has no Start/Stop text (or is empty or already Live) */}
              {(segments.length > 0 || transcript.trim().length === 0) && (
                <button
                  className={`record-btn live ${liveMode ? "recording" : ""} ${isProcessingAfterLiveStop ? "processing" : ""}`}
                  onClick={toggleLiveMode}
                  disabled={(listening && !liveMode) || isProcessingAfterLiveStop}
                  title={isProcessingAfterLiveStop ? "Verarbeitung läuft im Hintergrund" : segments.length > 0 ? "Aufnahme fortsetzen" : "Live-Modus: Transkribiert kontinuierlich bei Sprechpausen"}
                >
                  {liveMode ? (
                    <>
                      <span className="pulse" />
                      Live Stop
                    </>
                  ) : isProcessingAfterLiveStop ? (
                    <>⏳ Verarbeitung</>
                  ) : segments.length > 0 ? (
                    <>🔴 Fortsetzen</>
                  ) : (
                    <>🔴 Live</>
                  )}
                </button>
              )}
            </div>

            {/* Editor Grid */}
            <div className="editor-grid">
              <div className="editor-panel">
                <div className="panel-header">
                  <h3>Transkript</h3>
                  <span className="char-count">{displayedTranscript.length} Zeichen</span>
                  {segments.length > 0 && (
                    <span className="segment-count">{segments.length} Segmente</span>
                  )}
                </div>
                
                {/* Segmented Transcript View with Audio Playback */}
                {segments.length > 0 && !showSummaryView ? (
                  <div className="segments-view" ref={segmentsViewRef}>
                    {segments.map((segment) => {
                      const displayText = showNonSpeechTags ? segment.text : filterNonSpeechTags(segment.text);
                      const isPlaying = playingSegment === segment.id;
                      const duration = Math.max(0, (segment.endTime || 0) - (segment.startTime || 0));
                      const progress = duration > 0 && isPlaying
                        ? Math.min(100, (currentAudioTime / duration) * 100)
                        : 0;
                      
                      return (
                        <div
                          key={segment.id}
                          className={`segment-item ${isPlaying ? "playing" : ""} ${segment.isUncertain ? "uncertain" : ""}`}
                          title={segment.isUncertain ? getUncertainTooltip(segment) : undefined}
                        >
                          <div className="segment-header">
                            <span className="segment-time" title={`Dauer: ${formatTime(duration)}`}>
                              {formatTime(duration)}
                            </span>
                            {segment.audioFile && (
                              <button
                                className={`btn icon small ${isPlaying ? "playing" : ""}`}
                                onClick={() => isPlaying ? stopPlayback() : playSegment(segment)}
                                title={isPlaying ? "Stoppen" : "Abspielen"}
                              >
                                {isPlaying ? "⏹" : "▶️"}
                              </button>
                            )}
                            {segment.audioFile && (
                              <input
                                type="range"
                                className="segment-progress"
                                min={0}
                                max={100}
                                step={0.5}
                                value={progress}
                                disabled={!isPlaying}
                                title={isPlaying ? "Scrubbing: Position ändern" : "Während der Wiedergabe scrubben"}
                                onInput={(e) => {
                                  if (!isPlaying || !audioPlayerRef.current) return;
                                  const pct = Number((e.target as HTMLInputElement).value);
                                  const t = (pct / 100) * duration;
                                  audioPlayerRef.current.currentTime = t;
                                  setCurrentAudioTime(t);
                                }}
                              />
                            )}
                            {segment.isUncertain && (
                              <span className="uncertain-badge" title={getUncertainTooltip(segment)}>❓</span>
                            )}
                          </div>
                          <div className="segment-text">
                            {editingSegmentId === segment.id ? (
                              <div className="segment-edit-container">
                                <textarea
                                  className="segment-edit-textarea"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      saveSegmentEdit(segment.id);
                                    } else if (e.key === "Escape") {
                                      cancelEditingSegment();
                                    }
                                  }}
                                  autoFocus
                                  rows={3}
                                />
                                <div className="segment-edit-buttons">
                                  <button
                                    className="btn small primary"
                                    onClick={() => saveSegmentEdit(segment.id)}
                                    title="Speichern (Enter)"
                                  >
                                    ✓ Speichern
                                  </button>
                                  <button
                                    className="btn small"
                                    onClick={cancelEditingSegment}
                                    title="Abbrechen (Esc)"
                                  >
                                    ✕ Abbrechen
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="segment-text-content"
                                onClick={() => startEditingSegment(segment)}
                                title="Klicken zum Bearbeiten"
                              >
                                {displayText || <em className="empty-segment">(Kein Text)</em>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    ref={transcriptTextareaRef}
                    className="editor"
                    value={transcript}
                    onChange={(e) => handleManualTranscriptChange(e.target.value)}
                    placeholder="Hier erscheint das Transkript...

Tipp: Du kannst den Text vor dem Enrichment bearbeiten.
Platziere den Cursor und nimm auf, um Text einzufügen."
                  />
                )}
                
                <div className="panel-footer">
                  <button
                    className="btn secondary"
                    onClick={() => runEnrichment()}
                    disabled={!displayedTranscript.trim()}
                  >
                    ↻ KI Prompt verarbeiten
                  </button>
                  {segments.length > 0 && (
                    showSummaryView ? (
                      <button
                        className="btn secondary"
                        onClick={() => setShowSummaryView(false)}
                        title="Segmentierte Ansicht anzeigen"
                      >
                        🎵 Segmente
                      </button>
                    ) : (
                      <button
                        className="btn secondary"
                        onClick={() => setShowSummaryView(true)}
                        title="Zusammenfassung ohne Segmentierung anzeigen"
                      >
                        📄 Zusammenfassung
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="editor-panel">
                <div className="panel-header">
                  <h3>Ergebnis</h3>
                  <div className="panel-actions">
                    <button
                      className="btn icon"
                      onClick={() => runEnrichment()}
                      disabled={!displayedTranscript.trim() || status === "KI verarbeitet..."}
                      title="Mit KI anreichern"
                    >
                      {status === "KI verarbeitet..." ? "⏳" : "✨"}
                    </button>
                    <button
                      className={`btn icon ${isSpeaking ? "speaking" : ""}`}
                      onClick={speakResult}
                      disabled={!result.trim()}
                      title={isSpeaking ? "Vorlesen stoppen" : "Ergebnis vorlesen"}
                    >
                      {isSpeaking ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="btn icon"
                      onClick={copyResult}
                      disabled={!result.trim()}
                      title="In Zwischenablage kopieren"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
                <textarea
                  className="editor result"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  onBlur={async (e) => {
                    // Auto-save on blur - only for Live Mode projects (with segments)
                    const projectId = currentProjectRef.current?.id;
                    if (projectId && segments.length > 0 && e.target.value) {
                      await saveCurrentProject({ enrichedResult: e.target.value }, projectId);
                    }
                  }}
                  placeholder="Hier erscheint das aufbereitete Ergebnis..."
                />
                <div className="panel-footer">
                  <span className="hint">
                    Direkt nutzbar in Notion, Obsidian, Jira, E-Mail...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "prompts" && (
          <div className="prompts-content">
            <div className="section-header">
              <h2>Prompts verwalten</h2>
              <p>Erstelle und bearbeite Prompts für verschiedene Anwendungsfälle.</p>
            </div>

            {/* Default Prompt Selection */}
            <div className="default-prompt-section">
              <label>Standard-Prompt (wird bei Start vorausgewählt):</label>
              <select
                value={settings.defaultPromptId || "note"}
                onChange={(e) => {
                  saveSettings({ defaultPromptId: e.target.value });
                  setSelectedPromptId(e.target.value);
                }}
              >
                {allPrompts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* All Prompts */}
            <div className="prompts-section">
              <div className="section-header-row">
                <h3>Prompts</h3>
                <button 
                  className="btn small primary"
                  onClick={() => {
                    setShowNewPromptDialog(true);
                    setTempPromptName("");
                    setTempPrompt("");
                  }}
                >
                  + Neuer Prompt
                </button>
              </div>
              <div className="prompts-grid">
                {allPrompts.map((p, index) => (
                  <div 
                    key={p.id} 
                    className={`prompt-card ${settings.defaultPromptId === p.id ? "default" : ""} ${draggedPromptId === p.id ? "dragging" : ""} ${dragOverPromptId === p.id ? "drag-over" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPromptId(p.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedPromptId && draggedPromptId !== p.id) {
                        setDragOverPromptId(p.id);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverPromptId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggedPromptId || draggedPromptId === p.id) return;
                      
                      // Reorder prompts
                      const draggedIndex = allPrompts.findIndex(pr => pr.id === draggedPromptId);
                      const dropIndex = index;
                      
                      if (draggedIndex !== -1 && dropIndex !== -1) {
                        const newPrompts = [...allPrompts];
                        const [removed] = newPrompts.splice(draggedIndex, 1);
                        newPrompts.splice(dropIndex, 0, removed);
                        saveSettings({ customPrompts: newPrompts });
                      }
                      
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                  >
                    <div className="prompt-header">
                      <span className="drag-handle" title="Ziehen zum Sortieren">⋮⋮</span>
                      <h4>{p.name}</h4>
                      <div className="prompt-actions">
                        {settings.defaultPromptId === p.id && <span className="default-badge">Standard</span>}
                        <button
                          className="btn small"
                          onClick={() => {
                            setEditingPrompt(p.id);
                            setTempPromptName(p.name);
                            setTempPrompt(p.prompt);
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => {
                            // Don't allow deleting the last prompt
                            if (allPrompts.length <= 1) return;
                            const updated = allPrompts.filter(cp => cp.id !== p.id);
                            saveSettings({ customPrompts: updated });
                            // If deleted prompt was default, set first remaining as default
                            if (settings.defaultPromptId === p.id) {
                              const newDefault = updated[0]?.id || "note";
                              saveSettings({ defaultPromptId: newDefault });
                              setSelectedPromptId(newDefault);
                            }
                          }}
                          disabled={allPrompts.length <= 1}
                          title={allPrompts.length <= 1 ? "Mindestens ein Prompt erforderlich" : "Löschen"}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <pre className="prompt-preview">{p.prompt}</pre>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit Prompt Modal */}
            {editingPrompt && (
              <div className="modal-overlay" onClick={() => setEditingPrompt(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Prompt bearbeiten</h3>
                    <button className="close-btn" onClick={() => setEditingPrompt(null)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={tempPromptName}
                        onChange={(e) => setTempPromptName(e.target.value)}
                        placeholder="z.B. Zusammenfassung, Blog-Post..."
                      />
                    </div>
                    <div className="form-group">
                      <label>Prompt-Text</label>
                      <textarea
                        className="prompt-editor"
                        value={tempPrompt}
                        onChange={(e) => setTempPrompt(e.target.value)}
                        placeholder="Gib hier deine Anweisungen für die KI ein..."
                      />
                    </div>
                    <div className="prompt-tips">
                      <h5>Tipps:</h5>
                      <ul>
                        <li>Beschreibe klar das gewünschte Ausgabeformat (Markdown, HTML, Liste, etc.)</li>
                        <li>Gib Beispiele für die Struktur</li>
                        <li>Definiere Länge/Detailgrad (z.B. &quot;max. 5 Bulletpoints&quot;)</li>
                      </ul>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn secondary" onClick={() => setEditingPrompt(null)}>
                      Abbrechen
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => {
                        const updated = allPrompts.map(p => 
                          p.id === editingPrompt 
                            ? { ...p, name: tempPromptName || p.name, prompt: tempPrompt }
                            : p
                        );
                        saveSettings({ customPrompts: updated });
                        setEditingPrompt(null);
                      }}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New Prompt Dialog */}
            {showNewPromptDialog && (
              <div className="modal-overlay" onClick={() => setShowNewPromptDialog(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Neuer Prompt</h3>
                    <button className="close-btn" onClick={() => setShowNewPromptDialog(false)}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={tempPromptName}
                        onChange={(e) => setTempPromptName(e.target.value)}
                        placeholder="z.B. Zusammenfassung, Blog-Post..."
                        autoFocus
                      />
                    </div>
                    <div className="form-group">
                      <label>Prompt-Text</label>
                      <textarea
                        className="prompt-editor"
                        value={tempPrompt}
                        onChange={(e) => setTempPrompt(e.target.value)}
                        placeholder="Gib hier deine Anweisungen für die KI ein..."
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn secondary" onClick={() => setShowNewPromptDialog(false)}>
                      Abbrechen
                    </button>
                    <button
                      className="btn primary"
                      disabled={!tempPromptName.trim() || !tempPrompt.trim()}
                      onClick={() => {
                        const id = `custom_${Date.now()}`;
                        const newPrompt: CustomPrompt = {
                          id,
                          name: tempPromptName.trim(),
                          prompt: tempPrompt.trim()
                        };
                        saveSettings({ customPrompts: [...allPrompts, newPrompt] });
                        setShowNewPromptDialog(false);
                      }}
                    >
                      Erstellen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-content">
            <div className="settings-section">
              <h3>🤖 KI Provider</h3>
              <div className="settings-grid">
                <div className="setting">
                  <label>Provider</label>
                  <select
                    value={settings.llmProvider}
                    onChange={(e) => saveSettings({ llmProvider: e.target.value as LlmProvider })}
                  >
                    <option value="ollama">Ollama (lokal, kostenlos)</option>
                    <option value="gemini">Google Gemini (API Key)</option>
                    <option value="openai">OpenAI (API Key)</option>
                    <option value="openrouter">OpenRouter (API Key)</option>
                  </select>
                </div>
                <div className="setting model-setting">
                  <label>Modell</label>
                  {(() => {
                    const providerModels = llmModels[settings.llmProvider] || [];
                    const isKnownModel = providerModels.some(m => m.id === settings.llmModel);
                    
                    if (useCustomModel) {
                      return (
                        <div className="custom-model-input">
                          <input
                            type="text"
                            value={customModelInput}
                            onChange={(e) => setCustomModelInput(e.target.value)}
                            placeholder="z.B. llama3.1:70b oder custom-model:latest"
                            autoFocus
                          />
                          <div className="custom-model-actions">
                            <button
                              className="btn small primary"
                              onClick={() => {
                                if (customModelInput.trim()) {
                                  saveSettings({ llmModel: customModelInput.trim() });
                                }
                                setUseCustomModel(false);
                              }}
                            >
                              Übernehmen
                            </button>
                            <button
                              className="btn small"
                              onClick={() => {
                                setUseCustomModel(false);
                                setCustomModelInput("");
                              }}
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="model-selector">
                        <select
                          value={isKnownModel ? settings.llmModel : "__custom_current__"}
                          onChange={(e) => {
                            if (e.target.value === "__custom__" || e.target.value === "__custom_current__") {
                              setUseCustomModel(true);
                              setCustomModelInput(settings.llmModel);
                            } else {
                              saveSettings({ llmModel: e.target.value });
                            }
                          }}
                        >
                          {/* Show current custom model if not in list */}
                          {!isKnownModel && (
                            <optgroup label="🔧 Aktuell">
                              <option value="__custom_current__">
                                {settings.llmModel} (benutzerdefiniert)
                              </option>
                            </optgroup>
                          )}
                          <optgroup label="⭐ Empfohlen">
                            {providerModels
                              .filter(m => m.recommended)
                              .map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.size}) - {m.description}
                                </option>
                              ))}
                          </optgroup>
                          {providerModels.filter(m => !m.recommended).length > 0 && (
                            <optgroup label="📦 Weitere">
                              {providerModels
                                .filter(m => !m.recommended)
                                .map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.size}) - {m.description}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                          <optgroup label="✏️ Eigenes">
                            <option value="__custom__">Eigenes Modell eingeben...</option>
                          </optgroup>
                        </select>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {settings.llmProvider === "ollama" && (
                <div className="ollama-section">
                  <div className="setting">
                    <label>Ollama Base URL</label>
                    <input
                      type="text"
                      value={settings.ollamaBaseUrl}
                      onChange={(e) => saveSettings({ ollamaBaseUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  
                  {/* Model Install Button */}
                  <div className="model-install-section">
                    <button
                      className={`btn model-install-btn ${installingModel ? "installing" : ""}`}
                      onClick={async () => {
                        setInstallingModel(true);
                        setInstallModelStatus(`Installiere ${settings.llmModel}...`);
                        try {
                          const res = await fetch("/api/ollama-setup", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "pull", model: settings.llmModel }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setInstallModelStatus(`✓ ${settings.llmModel} ist bereit!`);
                          } else {
                            setInstallModelStatus(`⚠️ ${data.error || "Fehler beim Installieren"}`);
                          }
                        } catch (err) {
                          setInstallModelStatus(`⚠️ Fehler: ${err instanceof Error ? err.message : "Unbekannt"}`);
                        } finally {
                          setInstallingModel(false);
                          setTimeout(() => setInstallModelStatus(null), 5000);
                        }
                      }}
                      disabled={installingModel}
                    >
                      {installingModel ? "📥 Installiere..." : `📥 ${settings.llmModel} installieren`}
                    </button>
                    {installModelStatus && (
                      <p className={`hint ${installModelStatus.startsWith("✓") ? "success-hint" : installModelStatus.startsWith("⚠️") ? "error-hint" : ""}`}>
                        {installModelStatus}
                      </p>
                    )}
                  </div>

                  <div className="help-box">
                    <p>Ollama nicht installiert oder gestartet?</p>
                    <button 
                      className={`btn ${ollamaSetupStatus === "success" ? "success" : ""}`}
                      onClick={setupOllama}
                      disabled={ollamaSetupStatus !== "idle" && ollamaSetupStatus !== "success" && ollamaSetupStatus !== "error"}
                    >
                      {ollamaSetupStatus === "idle" && "🚀 Ollama automatisch einrichten"}
                      {ollamaSetupStatus === "checking" && "⏳ Prüfe..."}
                      {ollamaSetupStatus === "installing" && "📦 Installiere..."}
                      {ollamaSetupStatus === "starting" && "🔄 Starte..."}
                      {ollamaSetupStatus === "pulling" && "📥 Lade Modell..."}
                      {ollamaSetupStatus === "success" && "✓ Bereit!"}
                      {ollamaSetupStatus === "error" && "⚠️ Erneut versuchen"}
                    </button>
                    {ollamaSetupMessage && (
                      <p className={`hint ${ollamaSetupStatus === "error" ? "error-hint" : ollamaSetupStatus === "success" ? "success-hint" : ""}`}>
                        {ollamaSetupMessage}
                      </p>
                    )}
                    {ollamaSetupSteps.length > 0 && (
                      <div className="setup-steps">
                        {ollamaSetupSteps.map((step, i) => (
                          <p key={i} className="hint">✓ {step}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settings.llmProvider !== "ollama" && (
                <div className="setting">
                  <label>API Key</label>
                  <input
                    type="password"
                    value={settings.llmApiKey || ""}
                    onChange={(e) => saveSettings({ llmApiKey: e.target.value })}
                    placeholder="API Key hier einfügen..."
                  />
                  <p className="hint">
                    Der Key wird lokal gespeichert und nie übertragen.
                  </p>
                </div>
              )}

              <button className="btn primary" onClick={() => testProvider()}>
                Verbindung testen
              </button>
            </div>

            <div className="settings-section">
              <h3>🎤 Spracherkennung</h3>
              <div className="settings-grid">
                <div className="setting">
                  <label>Provider</label>
                  <select
                    value={settings.sttProvider}
                    onChange={(e) => saveSettings({ sttProvider: e.target.value as SttProvider })}
                  >
                    <option value="whisper-local">Whisper lokal (offline, empfohlen)</option>
                    <option value="whisper-api">Whisper API (OpenAI)</option>
                    <option value="webspeech">Web Speech API (instabil)</option>
                  </select>
                </div>
                {settings.sttProvider === "whisper-local" && (
                  <div className="setting">
                    <label>Whisper Modell</label>
                    <select
                      value={settings.whisperModel || "Xenova/whisper-base"}
                      onChange={(e) => saveSettings({ whisperModel: e.target.value })}
                    >
                      <option value="Xenova/whisper-tiny">Tiny (~75MB, schnell)</option>
                      <option value="Xenova/whisper-base">Base (~150MB, ausgewogen)</option>
                      <option value="Xenova/whisper-small">Small (~500MB, genauer)</option>
                    </select>
                  </div>
                )}
                {settings.sttProvider === "whisper-local" && (
                  <div className="setting ffmpeg-setting">
                    <label>FFmpeg (Audio-Konvertierung)</label>
                    {ffmpegStatus === "checking" && <p className="hint">Prüfe…</p>}
                    {ffmpegStatus === "installed" && <p className="hint success-hint">✓ FFmpeg gefunden</p>}
                    {(ffmpegStatus === "missing" || ffmpegStatus === "error" || ffmpegStatus === "installing") && (
                      <>
                        <p className="hint">
                          {ffmpegStatus === "installing" ? ffmpegMessage || "Installiere…" : "Wird für Whisper lokal benötigt. Nicht installiert? Ein Klick genügt."}
                        </p>
                        <button
                          type="button"
                          className={`btn ${ffmpegStatus === "error" ? "" : "primary"}`}
                          onClick={setupFFmpeg}
                          disabled={ffmpegStatus === "installing"}
                        >
                          {ffmpegStatus === "installing" ? "⏳ Installiere…" : "🔧 FFmpeg einrichten"}
                        </button>
                      </>
                    )}
                    {ffmpegStatus === "error" && ffmpegMessage && <p className="hint error-hint">{ffmpegMessage}</p>}
                  </div>
                )}
                {settings.sttProvider === "whisper-api" && (
                  <div className="setting">
                    <label>OpenAI API Key (für Whisper)</label>
                    <input
                      type="password"
                      value={settings.whisperApiKey || ""}
                      onChange={(e) => saveSettings({ whisperApiKey: e.target.value })}
                      placeholder="sk-… (OpenAI API Key)"
                    />
                    <p className="hint">
                      Wird nur für die Spracherkennung (Whisper) genutzt. Getrennt vom LLM-API-Key. Lokal gespeichert.
                    </p>
                  </div>
                )}
                <div className="setting">
                  <label>Sprache</label>
                  <input
                    type="text"
                    value={settings.language}
                    onChange={(e) => saveSettings({ language: e.target.value })}
                    placeholder="de-DE"
                  />
                </div>
              </div>
              {settings.sttProvider === "whisper-local" ? (
                <p className="hint success-hint">
                  ✓ Whisper läuft komplett lokal und offline. Das Modell wird beim ersten Start heruntergeladen.
                </p>
              ) : settings.sttProvider === "whisper-api" ? (
                <p className="hint success-hint">
                  ✓ OpenAI Whisper API – schnell und zuverlässig. Nutzt den oben eingetragenen OpenAI API Key (~0.5 Cent/Min).
                </p>
              ) : (
                <p className="hint warning-hint">
                  ⚠️ Web Speech API ist instabil und benötigt Internetverbindung zu Google-Servern.
                </p>
              )}

              {/* Mikrofon Test */}
              <div className="test-section">
                <h4>Mikrofon-Test</h4>
                <div className="test-controls">
                  <button 
                    className={`btn ${micTestStatus === "success" ? "recording" : ""}`}
                    onClick={micTestStatus === "success" ? stopMicTest : testMicrophone}
                  >
                    {micTestStatus === "testing" ? "Teste..." : 
                     micTestStatus === "success" ? "⏹ Stoppen" : "🎤 Mikrofon testen"}
                  </button>
                  {micTestStatus === "success" && (
                    <div className="mic-level-container">
                      <div className="mic-level-bar">
                        <div 
                          className="mic-level-fill" 
                          style={{ width: `${micLevel}%` }}
                        />
                      </div>
                      <span className="mic-level-text">
                        {micLevel > 0 ? "Audio erkannt ✓" : "Sprich ins Mikrofon..."}
                      </span>
                    </div>
                  )}
                </div>
                {micTestError && (
                  <div className="test-error">
                    <span className="error-icon">⚠️</span>
                    <span>{micTestError}</span>
                  </div>
                )}
                {micTestStatus === "success" && (
                  <p className="test-success">✓ Mikrofon funktioniert!</p>
                )}
              </div>

              {/* Whisper Test - nur wenn Whisper ausgewählt */}
              {settings.sttProvider === "whisper-local" && (
                <div className="test-section">
                  <h4>Whisper-Test</h4>
                  <p className="hint">Testet ob das lokale Whisper-Modell funktioniert</p>
                  <div className="test-controls">
                    <button 
                      className="btn"
                      onClick={testWhisper}
                      disabled={whisperTestStatus === "testing"}
                    >
                      {whisperTestStatus === "testing" ? "🔄 Teste..." : "🧪 Whisper testen"}
                    </button>
                  </div>
                  
                  {/* Log Output */}
                  {whisperTestLog.length > 0 && (
                    <div className="whisper-log">
                      {whisperTestLog.map((line, i) => (
                        <div key={i} className="log-line">{line}</div>
                      ))}
                    </div>
                  )}
                  
                  {whisperTestStatus === "success" && (
                    <p className="test-success">✓ Whisper funktioniert!</p>
                  )}
                  {whisperTestStatus === "error" && whisperTestError && (
                    <div className="test-error detailed">
                      <span className="error-icon">❌</span>
                      <span>{whisperTestError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="settings-section">
              <h3>🔴 Live-Modus</h3>
              <div className="setting">
                <label>Sprechpause (Idle Time)</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    value={settings.liveIdleTime || 3000}
                    onChange={(e) => saveSettings({ liveIdleTime: parseInt(e.target.value) || 3000 })}
                  />
                  <span className="unit">ms</span>
                </div>
              </div>
              <p className="hint">
                Zeit in Millisekunden, die gewartet wird, bevor ein Segment bei Stille verarbeitet wird. 
                Standard: 3000ms (3 Sekunden). Während der Aufnahme zeigt ein Countdown die verbleibende Zeit an.
              </p>
            </div>

            <div className="settings-section">
              <h3>⌨️ Hotkey</h3>
              <div className="setting">
                <label>Globaler Hotkey</label>
                <input
                  type="text"
                  value={settings.hotkey}
                  onChange={(e) => saveSettings({ hotkey: e.target.value })}
                  placeholder="CommandOrControl+Shift+Space"
                />
              </div>
              <p className="hint">
                Format: CommandOrControl+Shift+Space, Alt+R, etc.
              </p>
            </div>

            <div className="settings-section">
              <h3>📁 Projektspeicherung</h3>
              <div className="setting">
                <label>Speicherort</label>
                <div className="path-display">
                  <code className="path-text">{projectsDir || "Nicht verfügbar"}</code>
                  <button 
                    className="btn small" 
                    onClick={() => openProjectFolder()}
                    disabled={!hasElectronProjects}
                    title="Im Finder öffnen"
                  >
                    📂 Öffnen
                  </button>
                </div>
              </div>
              <p className="hint">
                Projekte werden automatisch mit Datum/Uhrzeit gespeichert. Jedes Projekt enthält die Transkription und Audio-Segmente.
              </p>
              <div className="project-stats">
                <span>{projects.length} Projekt{projects.length !== 1 ? "e" : ""} gespeichert</span>
                {currentProject && (
                  <span className="current-project-info">
                    • Aktuell: {currentProject.name || currentProject.id}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* New Project Name Dialog */}
      {showNewProjectDialog && (
        <div className="dialog-overlay" onClick={cancelNewProject}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Neues Projekt vorbereiten</h3>
            <p>Name für die nächste Aufnahme:</p>
            <input
              type="text"
              value={newProjectNameInput}
              onChange={(e) => setNewProjectNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmNewProject();
                if (e.key === "Escape") cancelNewProject();
              }}
              placeholder="Projektname (optional)"
              autoFocus
              className="dialog-input"
            />
            <div className="dialog-buttons">
              <button className="btn" onClick={cancelNewProject}>
                Abbrechen
              </button>
              <button className="btn primary" onClick={confirmNewProject}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
