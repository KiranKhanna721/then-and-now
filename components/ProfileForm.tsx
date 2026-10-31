"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";

export function ProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Profile;
  onSave: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [p, setP] = useState<Profile>(initial);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const valid = p.name.trim() && p.birthYear >= 1910 && p.birthYear <= 2000 && p.hometown.trim() && p.currentCity.trim() && p.loves.trim();

  return (
    <form
      className="profile card"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave({ ...p, name: p.name.trim(), demo: false });
      }}
    >
      <div className="two">
        <div className="field">
          <label htmlFor="name">First name</label>
          <input id="name" value={p.name} maxLength={40} onChange={(e) => set("name", e.target.value)} required />
          <span className="hint">First name or nickname only.</span>
        </div>
        <div className="field">
          <label htmlFor="birthYear">Birth year</label>
          <input
            id="birthYear"
            type="number"
            min={1910}
            max={2000}
            value={p.birthYear || ""}
            onChange={(e) => set("birthYear", Number(e.target.value))}
            required
          />
        </div>
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="hometown">Where they grew up</label>
          <input id="hometown" value={p.hometown} maxLength={120} placeholder="East Los Angeles, California" onChange={(e) => set("hometown", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="currentCity">Where they live now</label>
          <input id="currentCity" value={p.currentCity} maxLength={120} placeholder="Whittier, California" onChange={(e) => set("currentCity", e.target.value)} required />
          <span className="hint">Used to find nearby places and food.</span>
        </div>
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="laterPlaces">Other places they lived</label>
          <input id="laterPlaces" value={p.laterPlaces} maxLength={300} placeholder="Pico Rivera (1970-2015)" onChange={(e) => set("laterPlaces", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="languages">Languages</label>
          <input id="languages" value={p.languages} maxLength={120} placeholder="Spanish, English" onChange={(e) => set("languages", e.target.value)} />
        </div>
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor="gender">Gender (optional)</label>
          <select id="gender" value={p.gender} onChange={(e) => set("gender", e.target.value as Profile["gender"])}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="stage">Stage</label>
          <select id="stage" value={p.stage} onChange={(e) => set("stage", e.target.value as Profile["stage"])}>
            <option value="mild">Mild: enjoys conversation and stories</option>
            <option value="moderate">Moderate: better with recognition than recall</option>
            <option value="advanced">Advanced: responds to music, touch and taste</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="loves">What they loved</label>
        <textarea
          id="loves"
          value={p.loves}
          maxLength={2000}
          placeholder="Singers, songs, shows, films, foods, places, hobbies. Specific names help most."
          onChange={(e) => set("loves", e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="avoid">Things to avoid</label>
        <textarea
          id="avoid"
          value={p.avoid}
          maxLength={1000}
          placeholder={"One per line, e.g.\nthe war\nher late husband's favorite song 'Unchained Melody'"}
          onChange={(e) => set("avoid", e.target.value)}
        />
        <span className="hint">Anything on this list is kept out of every session.</span>
      </div>
      <div className="field">
        <label htmlFor="notes">Anything else</label>
        <textarea
          id="notes"
          value={p.notes}
          maxLength={1000}
          placeholder="Work, personality, family first names, diet or swallowing needs."
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <p className="notice">Saved only in this browser. Nothing is stored on our servers.</p>
      <div className="row">
        <button className="btn" type="submit" disabled={!valid}>
          Save
        </button>
        {onCancel && (
          <button className="btn ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
