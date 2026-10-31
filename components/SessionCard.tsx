"use client";

import type { Reaction, Segment, StoredSession } from "@/lib/types";

const KIND: Record<Segment["kind"], { icon: string; label: string; action: string }> = {
  song: { icon: "♪", label: "Music", action: "Play on YouTube" },
  film: { icon: "🎞", label: "Film", action: "Find a clip" },
  tv: { icon: "📺", label: "TV", action: "Find a clip" },
  food: { icon: "🍲", label: "Food", action: "Find it" },
  place: { icon: "📍", label: "Place", action: "Open map" },
  book: { icon: "📖", label: "Book", action: "Look it up" },
};

const REACTIONS: { value: Reaction; label: string }[] = [
  { value: "lit", label: "Lit up" },
  { value: "neutral", label: "Neutral" },
  { value: "upset", label: "Upset" },
];

export function SessionCard({
  stored,
  name,
  onReact,
  onNote,
}: {
  stored: StoredSession;
  name: string;
  onReact: (index: number, r: Reaction | null) => void;
  onNote: (note: string) => void;
}) {
  const s = stored.session;
  return (
    <article className="card">
      <div className="session-head">
        <div>
          <div className="muted small">
            Session for {name} · {new Date(stored.createdAt).toLocaleDateString()}
          </div>
          <h2>{s.title}</h2>
        </div>
        <button className="btn ghost no-print" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {s.sample && (
        <div className="sample-banner">
          <b>Sample session.</b> This is a pre-written example of what Then &amp; Now produces. It wasn&apos;t generated
          live from Qloo, so it has no affinity scores. Live sessions start once the server has API keys.
        </div>
      )}
      <div className="opening">{s.opening}</div>

      <div className="segments">
        {s.segments.map((seg, i) => {
          const k = KIND[seg.kind];
          const reaction = stored.reactions[i];
          return (
            <section key={i} className="segment">
              <div className="art" aria-hidden>
                {seg.qloo?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={seg.qloo.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  k.icon
                )}
              </div>
              <div>
                <div className="pills">
                  <span className="pill">{k.label}</span>
                  {seg.year && <span className="pill">{seg.year}</span>}
                </div>
                <h3>{seg.name}</h3>
                <p className="why">{seg.why}</p>
                <ul>
                  {seg.prompts.map((pr, j) => (
                    <li key={j}>{pr}</li>
                  ))}
                </ul>
                {seg.sensory_cue && (
                  <p className="cue">
                    <b>Sensory cue:</b> {seg.sensory_cue}
                  </p>
                )}
                {seg.caregiver_tip && (
                  <p className="cue">
                    <b>Tip:</b> {seg.caregiver_tip}
                  </p>
                )}
                <div className="provenance">
                  {seg.seeds.map((sd) => (
                    <span key={sd} className="pill accent" title="Qloo seed that led here">
                      from {sd}
                    </span>
                  ))}
                  {seg.qloo?.affinity != null && (
                    <span className="pill sage" title="Qloo affinity with this person's taste">
                      Qloo affinity {seg.qloo.affinity.toFixed(2)}
                    </span>
                  )}
                  {seg.qloo?.tags.slice(0, 2).map((t) => (
                    <span key={t} className="pill">
                      {t}
                    </span>
                  ))}
                  {seg.link && (
                    <a className="pill no-print" href={seg.link} target="_blank" rel="noreferrer">
                      {k.action} ↗
                    </a>
                  )}
                </div>
                <div className="react" role="group" aria-label={`How did ${name} respond to ${seg.name}?`}>
                  <span className="small muted">How did it go?</span>
                  {REACTIONS.map((r) => (
                    <button
                      key={r.value}
                      className={r.value}
                      aria-pressed={reaction === r.value}
                      onClick={() => onReact(i, reaction === r.value ? null : r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="closing">
        <div>
          <h3>Closing</h3>
          <p>{s.closing}</p>
        </div>
        {s.watch_for.length > 0 && (
          <div>
            <h3>Watch for</h3>
            <ul>
              {s.watch_for.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3>Next time</h3>
          <p>{s.next_time}</p>
        </div>
        <div className="field no-print">
          <label htmlFor="note">Your notes from this session</label>
          <textarea
            id="note"
            value={stored.note}
            maxLength={500}
            placeholder="She sang every word of the second song. Got tired after 20 minutes."
            onChange={(e) => onNote(e.target.value)}
          />
        </div>
      </div>
    </article>
  );
}
