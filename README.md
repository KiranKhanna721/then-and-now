# Then & Now

**Reminiscence-therapy sessions for people living with dementia, built from the culture of their own youth.**

A caregiver enters what they know about someone: birth year, where they grew up, a few things they loved, and what upsets them. An agent uses [Qloo](https://qloo.com)'s taste graph to expand those memories across music, film, TV, food and places, focused on the years memories stick best. It returns a 20-30 minute session the caregiver can run today. After each session, the caregiver marks what made the person light up and what didn't land, and the next session builds on that.

## Why it needs Qloo

Reminiscence work and personalized music are established, low-cost ways to support mood and connection in dementia care. The hard part is personalization. A generic LLM gives every 80-year-old the same Sinatra-and-Elvis list. Then & Now finds *this person's* culture:

- **Reminiscence bump.** People remember ages ~10-30 most vividly. Film and TV picks are filtered to those release years (`filter.release_year.min/max`).
- **Cross-domain taste.** Seeds from what the caregiver mentioned (e.g. Vicente Fernández, *I Love Lucy*) are expanded with `/v2/insights` into artists, films, shows and places the same taste community loves.
- **Hometown and generation.** `signal.location.query` biases toward the culture of where they grew up (East LA, not a national chart), and `signal.demographics.age` / `gender` are applied automatically.
- **Real places today.** Restaurants and bakeries near where they live now (`filter.location.query`), seeded by their taste, for a food memory or an outing.
- **Verified provenance.** Every segment must be anchored to an entity ID that Qloo returned during the run; the server rejects anything else. Each card shows its seeds and Qloo affinity score.
- **Learning loop.** "Lit up" items become seeds next time; "neutral" and "upset" items are excluded via `filter.exclude.entities`.

## How the agent works

```
Caregiver profile + past reactions
        │
        ▼
Claude (tool-use loop, app/api/session → lib/agent.ts)
  ├─ qloo_search     resolve names → Qloo entity IDs            (GET /search)
  ├─ qloo_tags       genres / cuisines → tag IDs                (GET /v2/tags)
  ├─ qloo_insights   cross-domain recommendations with          (GET /v2/insights)
  │                  age, gender, hometown, era and exclusions
  └─ finalize_session
        │  server checks: every entity_id came from Qloo this run,
        │  nothing matches the avoid list → otherwise sent back to revise
        ▼
Session card: opening · 4-8 segments (song, film, TV, food, place) with
stage-appropriate prompts, sensory cues, tips, links · closing · watch-for
```

Prompts adapt to stage: open questions for mild, recognition and choice for moderate, sensory presence for advanced. The agent's steps stream live to the UI so caregivers (and judges) can see how each pick was found.

## Privacy and safety

- Profiles and sessions are stored only in the caregiver's browser (`localStorage`). The server keeps nothing.
- First names only are encouraged; the form says so.
- An avoid list is enforced both in the prompt and by a server-side check.
- It is a comfort activity, not medical care, and says so.

## Run locally

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # add QLOO_API_KEY and ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 and pick a demo person (Rosa, Harold or Mei), or add your own.

**Sample mode:** if either key is missing, the app still runs. Rosa, Harold and Mei get a pre-written example session (`lib/samples.ts`), clearly labeled as a sample and without Qloo affinity scores. Live sessions start automatically once both keys are set.

| Variable | Required | Default |
| --- | --- | --- |
| `QLOO_API_KEY` | yes | |
| `ANTHROPIC_API_KEY` | yes | |
| `ANTHROPIC_MODEL` | no | `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | no | `medium` |
| `QLOO_BASE_URL` | no | `https://hackathon.api.qloo.com` |
| `SESSIONS_PER_HOUR` | no | `12` per IP (rate limit for the public demo) |

## Deploy

Deploys to Vercel as-is: import the repo, set `QLOO_API_KEY` and `ANTHROPIC_API_KEY`, deploy. The session route runs up to 300 s (`maxDuration`).

## Project layout

```
app/page.tsx                 home: people + how it works
app/person/[id]/page.tsx     profile, build session, live trace, reactions, history
app/api/session/route.ts     validates input, streams agent events as NDJSON
lib/agent.ts                 system prompt, tools, agent loop, provenance + avoid checks
lib/qloo.ts                  Qloo client (search, insights, tags) with response compaction
lib/personas.ts              three fictional demo people
lib/store.ts                 browser storage and feedback aggregation
components/                  ProfileForm, SessionCard, Trace
```

## License

[MIT](LICENSE)
