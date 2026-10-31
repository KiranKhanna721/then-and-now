"use client";

// Everything a caregiver enters stays in their own browser. Storage can be
// unavailable (private windows, blocked site data), so every access is guarded.

import { PERSONAS } from "./personas";
import type { FeedbackItem, Profile, StoredSession } from "./types";

const PROFILES_KEY = "tan.profiles.v1";
const sessionsKey = (id: string) => `tan.sessions.v1.${id}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the app still works for this visit.
  }
}

export function loadProfiles(): Profile[] {
  const own = read<Profile[]>(PROFILES_KEY, []);
  const ids = new Set(own.map((p) => p.id));
  return [...own, ...PERSONAS.filter((p) => !ids.has(p.id))];
}

export function getProfile(id: string): Profile | undefined {
  return loadProfiles().find((p) => p.id === id);
}

export function saveProfile(p: Profile) {
  const own = read<Profile[]>(PROFILES_KEY, []).filter((x) => x.id !== p.id);
  write(PROFILES_KEY, [p, ...own]);
}

export function deleteProfile(id: string) {
  write(PROFILES_KEY, read<Profile[]>(PROFILES_KEY, []).filter((x) => x.id !== id));
  try {
    window.localStorage.removeItem(sessionsKey(id));
  } catch {}
}

export function loadSessions(profileId: string): StoredSession[] {
  return read<StoredSession[]>(sessionsKey(profileId), []);
}

export function saveSessions(profileId: string, sessions: StoredSession[]) {
  write(sessionsKey(profileId), sessions);
}

// Flatten reactions from every past session into what the agent learns from.
// A later reaction to the same entity wins.
export function feedbackFrom(sessions: StoredSession[]): FeedbackItem[] {
  const byId = new Map<string, FeedbackItem>();
  for (const s of [...sessions].reverse()) {
    s.session.segments.forEach((seg, i) => {
      const reaction = s.reactions[i];
      if (reaction) byId.set(seg.entity_id, { entity_id: seg.entity_id, name: seg.name, kind: seg.kind, reaction });
    });
  }
  return [...byId.values()];
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
