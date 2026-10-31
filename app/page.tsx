"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProfiles, loadSessions } from "@/lib/store";
import type { Profile } from "@/lib/types";

export default function Home() {
  const [people, setPeople] = useState<{ p: Profile; sessions: number }[] | null>(null);

  useEffect(() => {
    setPeople(loadProfiles().map((p) => ({ p, sessions: loadSessions(p.id).length })));
  }, []);

  return (
    <>
      <section className="hero">
        <h1>Bring back the songs, shows and smells of their best years.</h1>
        <p>
          Tell Then &amp; Now a few things you know about someone living with dementia. It builds a 20-minute
          reminiscence session from the culture of <em>their</em> youth (music, film, food and places), learns from how
          they react, and makes the next one better.
        </p>
      </section>

      <h2>Who are you visiting?</h2>
      <div className="grid">
        {people?.map(({ p, sessions }) => (
          <Link key={p.id} href={`/person/${p.id}`} className="card person-card">
            <h3>{p.name}</h3>
            <div className="muted small">
              Born {p.birthYear} · grew up in {p.hometown.split(",")[0]}
            </div>
            <p className="small" style={{ margin: 0 }}>
              {p.loves.length > 110 ? `${p.loves.slice(0, 110)}…` : p.loves}
            </p>
            <div className="pills">
              {p.demo && <span className="pill accent">Demo</span>}
              <span className="pill">{p.stage} stage</span>
              {sessions > 0 && <span className="pill sage">{sessions} session{sessions > 1 ? "s" : ""}</span>}
            </div>
          </Link>
        ))}
        <Link href="/person/new" className="card add-card">
          + Add someone
        </Link>
      </div>

      <section className="how">
        <div className="card">
          <div className="step-num">1</div>
          <h3>Start with what you know</h3>
          <p className="small muted">
            Birth year, where they grew up, a few things they loved, and anything that upsets them.
          </p>
        </div>
        <div className="card">
          <div className="step-num">2</div>
          <h3>The agent finds their culture</h3>
          <p className="small muted">
            Qloo&apos;s taste graph expands those memories across music, film, TV, food and places, focused on ages
            10-30, when memories stick best. Every pick shows where it came from.
          </p>
        </div>
        <div className="card">
          <div className="step-num">3</div>
          <h3>Run it, then tell us how it went</h3>
          <p className="small muted">
            Mark what made them light up and what didn&apos;t land. The next session builds on what worked and leaves
            out what didn&apos;t.
          </p>
        </div>
      </section>
    </>
  );
}
