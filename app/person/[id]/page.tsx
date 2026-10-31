"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProfileForm } from "@/components/ProfileForm";
import { SessionCard } from "@/components/SessionCard";
import { Trace } from "@/components/Trace";
import { PERSONAS } from "@/lib/personas";
import { deleteProfile, feedbackFrom, getProfile, loadSessions, newId, saveProfile, saveSessions } from "@/lib/store";
import type { AgentEvent, Profile, Reaction, StoredSession, TraceItem } from "@/lib/types";

const BLANK: Profile = {
  id: "",
  name: "",
  birthYear: 1950,
  gender: "",
  hometown: "",
  laterPlaces: "",
  currentCity: "",
  languages: "",
  loves: "",
  avoid: "",
  stage: "mild",
  notes: "",
};

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [live, setLive] = useState<TraceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const [liveMode, setLiveMode] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j) => setLiveMode(Boolean(j.live)))
      .catch(() => setLiveMode(null));
  }, []);

  useEffect(() => {
    if (isNew) {
      setProfile(null);
      return;
    }
    const p = getProfile(id);
    setProfile(p ?? null);
    const ss = loadSessions(id);
    setSessions(ss);
    setSelected(ss[0]?.id ?? null);
    setNote(ss[0]?.note ?? "");
  }, [id, isNew]);

  const persist = useCallback(
    (next: StoredSession[]) => {
      setSessions(next);
      if (profile) saveSessions(profile.id, next);
    },
    [profile],
  );

  const current = sessions.find((s) => s.id === selected) ?? null;
  const feedback = feedbackFrom(sessions);
  const rated = current ? Object.keys(current.reactions).length : 0;

  async function build() {
    if (!profile || running) return;
    setRunning(true);
    setError(null);
    setLive([]);
    setShowTrace(true);
    const collected: TraceItem[] = [];
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, feedback, caregiverNote: note, sessionNumber: sessions.length + 1 }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buf += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as AgentEvent;
          if (ev.type === "trace") {
            collected.push(ev.item);
            setLive([...collected]);
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          } else if (ev.type === "session") {
            const stored: StoredSession = {
              id: newId(),
              createdAt: new Date().toISOString(),
              session: ev.session,
              trace: collected,
              reactions: {},
              note: "",
            };
            persist([stored, ...sessions]);
            setSelected(stored.id);
            setShowTrace(false);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  function updateCurrent(fn: (s: StoredSession) => StoredSession) {
    if (!current) return;
    persist(sessions.map((s) => (s.id === current.id ? fn(s) : s)));
  }

  function react(i: number, r: Reaction | null) {
    updateCurrent((s) => {
      const reactions = { ...s.reactions };
      if (r) reactions[i] = r;
      else delete reactions[i];
      return { ...s, reactions };
    });
  }

  if (profile === undefined) return null;

  if (isNew || editing || profile === null) {
    if (!isNew && profile === null) {
      return (
        <div className="empty card">
          <h2>We couldn&apos;t find that person</h2>
          <p className="muted">Profiles live in the browser where they were created.</p>
          <Link className="btn" href="/">
            Back home
          </Link>
        </div>
      );
    }
    return (
      <>
        <h1>{isNew ? "Add someone" : `Edit ${profile?.name}`}</h1>
        <p className="muted">The more specific you are (names of singers, shows, dishes, streets), the better the session.</p>
        <ProfileForm
          initial={profile ?? { ...BLANK, id: newId() }}
          onSave={(p) => {
            saveProfile(p);
            if (isNew) router.replace(`/person/${p.id}`);
            else {
              setProfile(p);
              setEditing(false);
            }
          }}
          onCancel={() => (isNew ? router.push("/") : setEditing(false))}
        />
      </>
    );
  }

  const isDemo = PERSONAS.some((p) => p.id === profile.id);
  const shownTrace = running || showTrace ? live : current?.trace ?? [];

  return (
    <div className="layout">
      <aside className="side">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>{profile.name}</h2>
          <div className="pills" style={{ marginBottom: 12 }}>
            <span className="pill">Born {profile.birthYear}</span>
            <span className="pill">{profile.stage} stage</span>
            <span className="pill accent">
              Bump {profile.birthYear + 10}–{profile.birthYear + 30}
            </span>
          </div>
          <dl className="facts">
            <dt>Grew up</dt>
            <dd>{profile.hometown}</dd>
            <dt>Lives now</dt>
            <dd>{profile.currentCity}</dd>
            <dt>Loved</dt>
            <dd>{profile.loves}</dd>
            {profile.avoid.trim() && (
              <>
                <dt>Avoid</dt>
                <dd style={{ whiteSpace: "pre-line" }}>{profile.avoid}</dd>
              </>
            )}
          </dl>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setEditing(true)}>
              Edit
            </button>
            {!isDemo && (
              <button
                className="btn ghost"
                onClick={() => {
                  if (confirm(`Delete ${profile.name} and all their sessions from this browser?`)) {
                    deleteProfile(profile.id);
                    router.push("/");
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {feedback.length > 0 && (
          <div className="card">
            <h3>What the agent has learned</h3>
            <div className="pills">
              {feedback.map((f) => (
                <span key={f.entity_id} className={`pill ${f.reaction === "lit" ? "sage" : f.reaction === "upset" ? "accent" : ""}`}>
                  {f.reaction === "lit" ? "♥" : f.reaction === "upset" ? "✕" : "·"} {f.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="card">
            <h3>Sessions</h3>
            <div className="history">
              {sessions.map((s, i) => (
                <button
                  key={s.id}
                  aria-current={s.id === selected}
                  onClick={() => {
                    setSelected(s.id);
                    setShowTrace(false);
                  }}
                >
                  <b>#{sessions.length - i}</b> {s.session.title}
                  {s.session.sample && <span className="pill accent" style={{ marginLeft: 6 }}>Sample</span>}
                  <div className="small muted">{new Date(s.createdAt).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <section style={{ display: "grid", gap: 20 }}>
        <div className="card no-print">
          <h3>{sessions.length ? `Plan session #${sessions.length + 1}` : `Plan ${profile.name}'s first session`}</h3>
          {liveMode === false && (
            <p className="sample-banner" style={{ marginTop: 0 }}>
              <b>Sample mode.</b>{" "}
              {isDemo
                ? `The server has no API keys yet, so this shows a pre-written example session for ${profile.name}.`
                : "The server has no API keys yet. Live sessions for new people start once keys are added; try Rosa, Harold or Mei to see a sample."}
            </p>
          )}
          {sessions.length > 0 && (
            <p className="small muted">
              {feedback.length
                ? `The agent will build on ${feedback.filter((f) => f.reaction === "lit").length} favorites and skip ${feedback.filter((f) => f.reaction !== "lit").length} items that didn't land.`
                : "Tip: mark how the last session went first, so this one can learn from it."}
            </p>
          )}
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="today">Anything to tell the agent today? (optional)</label>
            <input
              id="today"
              value={note}
              maxLength={500}
              placeholder="It's her birthday this week. She's been tired in the afternoons."
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="row">
            <button className="btn big" onClick={build} disabled={running}>
              {running ? "Building…" : sessions.length ? "Build next session" : "Build session"}
            </button>
            {!running && shownTrace.length > 0 && (
              <button className="btn ghost" onClick={() => setShowTrace((v) => !v)}>
                {showTrace ? "Hide" : "Show"} how it was made
              </button>
            )}
          </div>
          {error && (
            <div className="error-box" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          {(running || showTrace) && shownTrace.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Trace items={shownTrace} running={running} />
            </div>
          )}
          {running && <p className="small muted" style={{ marginTop: 12 }}>This usually takes about a minute.</p>}
        </div>

        {current ? (
          <>
            <SessionCard
              stored={current}
              name={profile.name}
              onReact={react}
              onNote={(n) => updateCurrent((s) => ({ ...s, note: n }))}
            />
            {rated > 0 && (
              <p className="small muted no-print">
                Saved {rated} reaction{rated > 1 ? "s" : ""}. They&apos;ll shape the next session.
              </p>
            )}
          </>
        ) : (
          !running && (
            <div className="card empty muted">
              No sessions yet. Build one above. It takes about a minute, and you can watch the agent work.
            </div>
          )
        )}
      </section>
    </div>
  );
}
