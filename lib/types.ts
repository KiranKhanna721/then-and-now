// Shared types for the browser and the API route.

export type Stage = "mild" | "moderate" | "advanced";

export interface Profile {
  id: string;
  name: string; // first name only
  birthYear: number;
  gender: "" | "female" | "male";
  hometown: string; // where they grew up
  laterPlaces: string; // other places lived, with rough years
  currentCity: string; // where sessions happen now
  languages: string;
  loves: string; // free text: what the caregiver knows they loved
  avoid: string; // one per line: topics, songs, people that upset them
  stage: Stage;
  notes: string; // career, personality, family (first names only)
  demo?: boolean;
}

export type SegmentKind = "song" | "film" | "tv" | "food" | "place" | "book";

export interface Segment {
  kind: SegmentKind;
  entity_id: string;
  name: string;
  year: string | null;
  media_query: string;
  why: string;
  seeds: string[];
  prompts: string[];
  sensory_cue: string;
  caregiver_tip: string;
  // Filled in by the server from Qloo data, never by the model.
  qloo?: {
    type: string | null;
    affinity: number | null;
    popularity: number | null;
    image: string | null;
    address: string | null;
    tags: string[];
  };
  link?: string;
}

export interface Session {
  title: string;
  opening: string;
  segments: Segment[];
  closing: string;
  watch_for: string[];
  next_time: string;
  sample?: boolean; // pre-written example shown when the server has no API keys
}

export type Reaction = "lit" | "neutral" | "upset";

export interface StoredSession {
  id: string;
  createdAt: string;
  session: Session;
  trace: TraceItem[];
  reactions: Record<number, Reaction>;
  note: string;
}

export interface TraceItem {
  kind: "thought" | "tool" | "result" | "status" | "error";
  text: string;
  detail?: string[];
}

// What the browser sends about earlier sessions so the agent can learn.
export interface FeedbackItem {
  entity_id: string;
  name: string;
  kind: SegmentKind;
  reaction: Reaction;
}

export interface SessionRequest {
  profile: Profile;
  feedback: FeedbackItem[];
  caregiverNote: string;
  sessionNumber: number;
}

export type AgentEvent =
  | { type: "trace"; item: TraceItem }
  | { type: "session"; session: Session }
  | { type: "error"; message: string };
