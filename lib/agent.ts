// The reminiscence agent: Claude plans, Qloo supplies the cultural ground truth.
// Every item in a finished session must be an entity Qloo actually returned
// during this run, so the provenance chips in the UI are real, not invented.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ageBucket, insights, searchEntities, searchTags, type CompactEntity, QlooError } from "./qloo";
import type { AgentEvent, FeedbackItem, Profile, Segment, Session, SessionRequest, TraceItem } from "./types";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type Tool = Anthropic.Beta.Messages.BetaTool;
type ToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type ToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT ?? "medium") as "low" | "medium" | "high";
const MAX_TURNS = 12;

const ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:place",
  "urn:entity:book",
  "urn:entity:person",
  "urn:entity:brand",
  "urn:entity:destination",
] as const;

const TYPE_LABEL: Record<string, string> = {
  "urn:entity:artist": "artists",
  "urn:entity:movie": "films",
  "urn:entity:tv_show": "TV shows",
  "urn:entity:place": "places",
  "urn:entity:book": "books",
  "urn:entity:person": "people",
  "urn:entity:brand": "brands",
  "urn:entity:destination": "destinations",
};

// ---------- Tool schemas ----------

const SearchInput = z.object({
  query: z.string().min(1).max(120),
  types: z.array(z.enum(ENTITY_TYPES)).max(3).optional(),
  take: z.number().int().min(1).max(10).optional(),
});

const InsightsInput = z.object({
  type: z.enum(ENTITY_TYPES),
  seed_entity_ids: z.array(z.string()).max(10).optional(),
  seed_tag_ids: z.array(z.string()).max(6).optional(),
  filter_tag_ids: z.array(z.string()).max(4).optional(),
  taste_location: z.string().max(120).optional(),
  near: z.string().max(120).optional(),
  year_from: z.number().int().min(1900).max(2030).optional(),
  year_to: z.number().int().min(1900).max(2030).optional(),
  take: z.number().int().min(1).max(25).optional(),
});

const TagsInput = z.object({ query: z.string().min(1).max(80) });

const SegmentInput = z.object({
  kind: z.enum(["song", "film", "tv", "food", "place", "book"]),
  entity_id: z.string().min(1),
  name: z.string().min(1).max(160),
  year: z.string().max(20).nullable(),
  media_query: z.string().max(200),
  why: z.string().max(400),
  seeds: z.array(z.string().max(120)).max(5),
  prompts: z.array(z.string().max(300)).min(1).max(5),
  sensory_cue: z.string().max(300),
  caregiver_tip: z.string().max(300),
});

const SessionInput = z.object({
  title: z.string().max(120),
  opening: z.string().max(800),
  segments: z.array(SegmentInput).min(4).max(8),
  closing: z.string().max(600),
  watch_for: z.array(z.string().max(300)).max(5),
  next_time: z.string().max(600),
});

const tools: Tool[] = [
  {
    name: "qloo_search",
    description:
      "Resolve a name the caregiver mentioned (a singer, film, show, restaurant, book) to Qloo entity IDs. Returns up to `take` candidates with id, name, type and year. Use this before qloo_insights so you have seed IDs.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name to look up, e.g. 'Vicente Fernández' or 'I Love Lucy'." },
        types: {
          type: "array",
          items: { type: "string", enum: [...ENTITY_TYPES] },
          description: "Optional entity types to restrict the search to.",
        },
        take: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "qloo_insights",
    description:
      "Qloo taste-graph recommendations. Given seed entities and/or tags, returns entities of `type` that people with that taste also love, each with an affinity score (0-1). The person's age bracket and gender are applied automatically, and items the person reacted badly to are excluded automatically. Use year_from/year_to (films and TV only) to stay inside the reminiscence-bump years. For places, `near` is required and should be the city where sessions happen.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...ENTITY_TYPES] },
        seed_entity_ids: { type: "array", items: { type: "string" }, description: "Qloo entity IDs from qloo_search." },
        seed_tag_ids: { type: "array", items: { type: "string" }, description: "Tag IDs from qloo_tags used as taste signals." },
        filter_tag_ids: {
          type: "array",
          items: { type: "string" },
          description: "Tag IDs results must carry, e.g. a cuisine tag for places.",
        },
        taste_location: {
          type: "string",
          description: "Bias taste toward people from this place, e.g. the hometown ('East Los Angeles').",
        },
        near: { type: "string", description: "Only return places/destinations located here (required for places)." },
        year_from: { type: "integer", description: "Earliest release year (films/TV only)." },
        year_to: { type: "integer", description: "Latest release year (films/TV only)." },
        take: { type: "integer", minimum: 1, maximum: 25 },
      },
      required: ["type"],
    },
  },
  {
    name: "qloo_tags",
    description:
      "Find Qloo tag IDs for a genre, cuisine or theme (e.g. 'mariachi', 'motown', 'mexican bakery', 'western'). Use them as seed_tag_ids or filter_tag_ids in qloo_insights.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "finalize_session",
    description:
      "Submit the finished reminiscence session. Every segment's entity_id must be an ID that a Qloo tool returned during this run. Call this exactly once, when the session is ready.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Warm, short title, e.g. 'Sunday mornings in Boyle Heights'." },
        opening: {
          type: "string",
          description: "2-3 sentences telling the caregiver how to set up: room, timing, volume, what to have on hand.",
        },
        segments: {
          type: "array",
          minItems: 4,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["song", "film", "tv", "food", "place", "book"] },
              entity_id: { type: "string", description: "Qloo entity ID this segment is built on." },
              name: { type: "string", description: "What the caregiver will play/show/serve, e.g. 'Javier Solís — Sombras'." },
              year: { type: ["string", "null"], description: "Year or decade, if known." },
              media_query: {
                type: "string",
                description: "Search phrase to find this on YouTube or Google, e.g. 'Javier Solis Sombras 1964'.",
              },
              why: {
                type: "string",
                description: "One plain-language sentence on why this fits, naming the seed and era.",
              },
              seeds: { type: "array", items: { type: "string" }, description: "Names of the seeds that led here." },
              prompts: {
                type: "array",
                items: { type: "string" },
                description: "Conversation prompts matched to the person's stage.",
              },
              sensory_cue: { type: "string", description: "Something to see, smell, taste or touch." },
              caregiver_tip: { type: "string", description: "One practical tip for this segment." },
            },
            required: ["kind", "entity_id", "name", "year", "media_query", "why", "seeds", "prompts", "sensory_cue", "caregiver_tip"],
          },
        },
        closing: { type: "string", description: "How to end calmly." },
        watch_for: { type: "array", items: { type: "string" }, description: "Signs of distress and what to do." },
        next_time: { type: "string", description: "What to try next session." },
      },
      required: ["title", "opening", "segments", "closing", "watch_for", "next_time"],
    },
  },
];

// ---------- Prompting ----------

const SYSTEM = `You are Then & Now, an agent that plans reminiscence-therapy sessions for people living with dementia. Caregivers (family members, activity directors, home aides) give you what they know about one person; you return a 20-30 minute session they can run today.

Why this works: people remember ages ~10-30 most vividly (the "reminiscence bump"), and familiar music and media from that window can reach people when other conversation can't. Generic "oldies" lists miss the person. Your job is to find *their* culture: the artists, films, shows, foods and places that someone with their taste, background and hometown actually loved in those years.

Use Qloo, a taste graph of hundreds of millions of cultural entities, as your source of truth:
1. Resolve the specific things the caregiver mentioned with qloo_search (run several searches in parallel in one turn).
2. Expand across domains with qloo_insights: music from music, but also film/TV/food from music, and so on. Stay inside the bump years for films and TV with year_from/year_to. Use the hometown as taste_location so a girl from East LA gets East LA's culture, not a national chart. Run several insights calls in parallel in one turn.
3. For food and outings, use qloo_insights with type place and near set to the person's current city, seeded by their taste (and a cuisine tag from qloo_tags if useful) - places that feel like home and that the caregiver could actually visit or order from.
4. Curate. Qloo returns candidates; you choose. Prefer items from the bump years. Use your own knowledge to pick the right song by an artist or check an era, but every segment must be anchored to an entity_id that a Qloo tool returned in this run. Mix domains: usually 2-3 music segments (open and close with music), plus film/TV, food, and a place.
5. Call finalize_session once.

Matching the stage:
- mild: open-ended questions ("Tell me about the dances at…"), invite stories, it's fine to ask about names and places.
- moderate: recognition and choice prompts ("Do you know this song?", "Did you like it sweet or spicy?"), short sentences, never quiz or correct.
- advanced: sensory and presence only - sing along, hold hands, smell, taste; prompts are things the caregiver says, not questions that need answers.

Safety: never include anything on the person's avoid list, or close variants of it (if a specific song is on the list, other songs by that artist may still be fine, but say so in the caregiver_tip). Steer away from war, loss and trauma unless the caregiver says otherwise. Food suggestions must respect any swallowing or diet notes. This is a comfort activity, not medical care.

Write for a tired caregiver: warm, concrete, brief.`;

function describeProfile(p: Profile, feedback: FeedbackItem[], caregiverNote: string, sessionNumber: number) {
  const bumpFrom = p.birthYear + 10;
  const bumpTo = p.birthYear + 30;
  const lit = feedback.filter((f) => f.reaction === "lit");
  const neutral = feedback.filter((f) => f.reaction === "neutral");
  const upset = feedback.filter((f) => f.reaction === "upset");
  const fmt = (xs: FeedbackItem[]) => xs.map((f) => `${f.name} [${f.kind}, id ${f.entity_id}]`).join("; ") || "none";

  return `Plan session #${sessionNumber} for ${p.name}.

Born: ${p.birthYear} (reminiscence bump ≈ ${bumpFrom}-${bumpTo})
Gender: ${p.gender || "not given"}
Grew up in: ${p.hometown}
Later lived in: ${p.laterPlaces || "not given"}
Lives now in (for places/outings): ${p.currentCity}
Languages: ${p.languages || "not given"}
Dementia stage: ${p.stage}

What the caregiver knows they loved:
${p.loves}

Avoid (do not include these or close variants):
${p.avoid.trim() || "nothing listed"}

Other notes: ${p.notes || "none"}
${
  feedback.length
    ? `
What happened in earlier sessions:
- Lit up (use these as strong seeds in qloo_insights; you may bring back at most one as a familiar anchor): ${fmt(lit)}
- Neutral (don't repeat; already excluded from Qloo results): ${fmt(neutral)}
- Upset (never repeat; excluded from Qloo results; steer away from what they share): ${fmt(upset)}
Make this session build on what worked.`
    : ""
}${caregiverNote.trim() ? `\nCaregiver's note for today: ${caregiverNote.trim()}` : ""}`;
}

// ---------- Helpers ----------

function forModel(e: CompactEntity) {
  const out: Record<string, unknown> = { id: e.id, name: e.name };
  if (e.type) out.type = e.type;
  if (e.year) out.year = e.year;
  if (e.affinity != null) out.affinity = e.affinity;
  if (e.popularity != null) out.popularity = e.popularity;
  if (e.tags.length) out.tags = e.tags;
  if (e.address) out.address = e.address;
  return out;
}

// Short, literal phrases from the avoid list for a server-side backstop check.
// The model handles the nuance; this catches exact titles it should never use.
function avoidTerms(p: Profile) {
  return p.avoid
    .split(/\n|;/)
    .map((s) => s.trim().toLowerCase())
    .flatMap((line) => {
      const quoted = [...line.matchAll(/(?:^|\s)["'“‘]([^"”’']{3,})["'”’]/g)].map((m) => m[1].trim());
      const pieces = line.replace(/\([^)]*\)/g, "").split(",").map((s) => s.trim());
      return [...quoted, ...pieces];
    })
    .filter((s) => s.length >= 4 && s.split(/\s+/).length <= 4);
}

export function mediaLink(s: Segment, e?: CompactEntity) {
  const q = encodeURIComponent(s.media_query || s.name);
  switch (s.kind) {
    case "place":
      return `https://www.google.com/maps/search/${encodeURIComponent([e?.name ?? s.name, e?.address].filter(Boolean).join(" "))}`;
    case "food":
      return e?.address
        ? `https://www.google.com/maps/search/${encodeURIComponent(`${e.name} ${e.address}`)}`
        : `https://www.google.com/search?q=${q}`;
    case "book":
      return `https://www.google.com/search?q=${q}`;
    default:
      return `https://www.youtube.com/results?search_query=${q}`;
  }
}

function summarizeInput(name: string, input: Record<string, unknown>) {
  if (name === "qloo_search") return `Qloo search: "${input.query}"`;
  if (name === "qloo_tags") return `Qloo tags: "${input.query}"`;
  if (name === "qloo_insights") {
    const label = TYPE_LABEL[String(input.type)] ?? String(input.type);
    const bits: string[] = [];
    if (Array.isArray(input.seed_entity_ids) && input.seed_entity_ids.length) bits.push(`${input.seed_entity_ids.length} seeds`);
    if (Array.isArray(input.seed_tag_ids) && input.seed_tag_ids.length) bits.push(`${input.seed_tag_ids.length} tags`);
    if (input.taste_location) bits.push(`taste of ${input.taste_location}`);
    if (input.near) bits.push(`near ${input.near}`);
    if (input.year_from || input.year_to) bits.push(`${input.year_from ?? "…"}–${input.year_to ?? "…"}`);
    return `Qloo insights → ${label}${bits.length ? ` (${bits.join(", ")})` : ""}`;
  }
  return name;
}

// ---------- Agent loop ----------

export async function runAgent(req: SessionRequest, emit: (e: AgentEvent) => void) {
  const { profile, feedback, caregiverNote, sessionNumber } = req;
  const client = new Anthropic();
  const seen = new Map<string, CompactEntity>();
  const excludeIds = [...new Set(feedback.filter((f) => f.reaction !== "lit").map((f) => f.entity_id))];
  const bucket = ageBucket(profile.birthYear);
  const avoid = avoidTerms(profile);
  const trace = (item: TraceItem) => emit({ type: "trace", item });

  const remember = (list: CompactEntity[]) => {
    for (const e of list) if (e.id) seen.set(e.id, e);
    return list;
  };

  async function runTool(block: ToolUseBlock): Promise<{ result: ToolResultBlockParam; session?: Session }> {
    const err = (content: string): { result: ToolResultBlockParam } => ({
      result: { type: "tool_result", tool_use_id: block.id, is_error: true, content },
    });
    const ok = (data: unknown): { result: ToolResultBlockParam } => ({
      result: { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(data) },
    });

    try {
      if (block.name === "qloo_search") {
        const a = SearchInput.safeParse(block.input);
        if (!a.success) return err(`Invalid input: ${a.error.message}`);
        const list = remember(await searchEntities(a.data.query, a.data.types, a.data.take ?? 5));
        trace({ kind: "result", text: `${list.length} matches`, detail: list.slice(0, 5).map((e) => e.name) });
        return ok(list.map(forModel));
      }

      if (block.name === "qloo_tags") {
        const a = TagsInput.safeParse(block.input);
        if (!a.success) return err(`Invalid input: ${a.error.message}`);
        const tags = await searchTags(a.data.query);
        trace({ kind: "result", text: `${tags.length} tags`, detail: tags.slice(0, 5).map((t) => t.name) });
        return ok(tags);
      }

      if (block.name === "qloo_insights") {
        const a = InsightsInput.safeParse(block.input);
        if (!a.success) return err(`Invalid input: ${a.error.message}`);
        const d = a.data;
        const isPlace = d.type === "urn:entity:place" || d.type === "urn:entity:destination";
        if (d.type === "urn:entity:place" && !d.near) return err("`near` is required for places; use the current city.");
        if (!d.seed_entity_ids?.length && !d.seed_tag_ids?.length && !d.filter_tag_ids?.length && !isPlace) {
          return err("Give at least one seed_entity_id or tag so results reflect this person's taste.");
        }
        const list = remember(
          await insights({
            type: d.type,
            seedEntityIds: d.seed_entity_ids,
            seedTagIds: d.seed_tag_ids,
            filterTagIds: d.filter_tag_ids,
            excludeIds,
            ageBucket: bucket,
            gender: profile.gender || undefined,
            signalLocation: d.taste_location,
            filterLocation: d.near,
            releaseYearMin: d.year_from,
            releaseYearMax: d.year_to,
            take: d.take ?? 15,
          }),
        );
        trace({
          kind: "result",
          text: `${list.length} ${TYPE_LABEL[d.type] ?? "results"}`,
          detail: list.slice(0, 6).map((e) => (e.affinity != null ? `${e.name} · ${e.affinity}` : e.name)),
        });
        return ok(list.map(forModel));
      }

      if (block.name === "finalize_session") {
        const a = SessionInput.safeParse(block.input);
        if (!a.success) return err(`Session failed validation: ${a.error.message}`);
        const s = a.data;

        const unknown = s.segments.filter((seg) => !seen.has(seg.entity_id)).map((seg) => `${seg.name} (${seg.entity_id})`);
        if (unknown.length) {
          return err(
            `These segments use entity IDs no Qloo tool returned in this run: ${unknown.join(", ")}. Replace them with Qloo results (search or insights first if needed), then call finalize_session again.`,
          );
        }
        const hits = s.segments.filter((seg) => {
          const hay = `${seg.name} ${seg.media_query}`.toLowerCase();
          return avoid.some((term) => hay.includes(term));
        });
        if (hits.length) {
          return err(
            `These segments match the avoid list: ${hits.map((h) => h.name).join(", ")}. Replace them and call finalize_session again.`,
          );
        }

        const segments: Segment[] = s.segments.map((seg) => {
          const e = seen.get(seg.entity_id);
          return {
            ...seg,
            qloo: e
              ? {
                  type: e.type,
                  affinity: e.affinity,
                  popularity: e.popularity,
                  image: e.image,
                  address: e.address,
                  tags: e.tags,
                }
              : undefined,
            link: mediaLink(seg as Segment, e),
          };
        });
        return { ...ok({ accepted: true }), session: { ...s, segments } };
      }

      return err(`Unknown tool ${block.name}`);
    } catch (e) {
      const msg = e instanceof QlooError ? e.message : e instanceof Error ? e.message : String(e);
      trace({ kind: "error", text: msg.slice(0, 200) });
      return err(msg);
    }
  }

  const messages: MessageParam[] = [
    { role: "user", content: describeProfile(profile, feedback, caregiverNote, sessionNumber) },
  ];
  let nudged = false;

  trace({ kind: "status", text: `Planning session #${sessionNumber} for ${profile.name} (bump years ${profile.birthYear + 10}–${profile.birthYear + 30})` });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "thinking" && block.thinking.trim()) {
        trace({ kind: "thought", text: block.thinking.trim().slice(0, 500) });
      } else if (block.type === "text" && block.text.trim()) {
        trace({ kind: "thought", text: block.text.trim().slice(0, 500) });
      } else if (block.type === "tool_use" && block.name !== "finalize_session") {
        trace({ kind: "tool", text: summarizeInput(block.name, block.input as Record<string, unknown>) });
      }
    }

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to plan this session. Try rewording the profile.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("The model ran out of output space. Please try again.");
    }

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      if (nudged) break;
      nudged = true;
      messages.push({ role: "user", content: "Please submit the session now with finalize_session." });
      continue;
    }

    if (toolUses.some((b) => b.name === "finalize_session")) {
      trace({ kind: "status", text: "Checking the session against Qloo results and the avoid list" });
    }

    // Run all tool calls from this turn concurrently, return all results in one message.
    const outcomes = await Promise.all(toolUses.map(runTool));
    const final = outcomes.find((o) => o.session)?.session;
    if (final) {
      trace({ kind: "status", text: `Session ready: ${final.segments.length} segments` });
      emit({ type: "session", session: final });
      return;
    }
    const rejected = outcomes.find((o) => o.result.is_error && toolUses.find((t) => t.id === o.result.tool_use_id)?.name === "finalize_session");
    if (rejected) trace({ kind: "status", text: "Revising: a segment didn't pass the checks" });

    messages.push({ role: "user", content: outcomes.map((o) => o.result) });
  }

  throw new Error("The agent did not finish a session in time. Please try again.");
}
