"use client";

import { useEffect, useRef } from "react";
import type { TraceItem } from "@/lib/types";

const ICON: Record<TraceItem["kind"], string> = {
  tool: "Q",
  result: "✓",
  thought: "…",
  status: "•",
  error: "!",
};

export function Trace({ items, running }: { items: TraceItem[]; running: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (running) end.current?.scrollIntoView({ block: "nearest" });
  }, [items.length, running]);

  return (
    <div className="trace" aria-live="polite">
      {items.map((t, i) => (
        <div key={i} className={`trace-item ${t.kind}`}>
          <span className="dot" aria-hidden>
            {ICON[t.kind]}
          </span>
          <div>
            <div className="text">{t.text}</div>
            {t.detail && t.detail.length > 0 && <div className="detail">{t.detail.join(" · ")}</div>}
          </div>
        </div>
      ))}
      {running && (
        <div className="trace-item status">
          <span className="dot" aria-hidden>
            •
          </span>
          <span className="working" aria-label="Working">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
