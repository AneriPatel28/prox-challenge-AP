export interface ThinkingStep {
  message: string;
  ts: number;
}

export interface Source {
  chunk_id:     string;
  source:       string;
  page:         number;
  section:      string;
  content_type: string;
  image_url:    string | null;
  score:        number;
}

export interface Artifact {
  identifier:  string;
  type:        "text/html" | "application/vnd.ant.mermaid" | "image" | "image/jpeg" | "image/png";
  title:       string;
  content:     string;
  source?:     string;
  page?:       number | null;
  figure_urls?: string[];
}

export interface ChatMessage {
  id:           string;
  role:         "user" | "assistant";
  text:         string;
  thinking?:    ThinkingStep[];
  artifacts?:   Artifact[];
  sources?:     Source[];
  isStreaming?: boolean;
  userQuery?:   string;
}

export interface ConversationTurn {
  id:          string;
  userMsg:     ChatMessage;
  responses:   ChatMessage[];
  activeIndex: number;
}

// SSE event shapes from backend
export type SSEEvent =
  | { type: "thinking";  message: string }
  | { type: "answer";    text: string; artifacts: Artifact[]; sources: Source[] }
  | { type: "error";     message: string }
  | { type: "heartbeat" }
  | { type: "done" };
