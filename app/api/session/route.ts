import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { mediaLink, runAgent } from "@/lib/agent";
import { isLive } from "@/lib/live";
import { SAMPLES } from "@/lib/samples";
import type { AgentEvent, SessionRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const RequestSchema = z.object({
  profile: z.object({
    id: z.string().max(64),
    name: z.string().min(1).max(40),
    birthYear: z.number().int().min(1910).max(2000),
    gender: z.enum(["", "female", "male"]),
    hometown: z.string().min(1).max(120),
    laterPlaces: z.string().max(300),
    currentCity: z.string().min(1).max(120),
    languages: z.string().max(120),
    loves: z.string().min(1).max(2000),
    avoid: z.string().max(1000),
    stage: z.enum(["mild", "moderate", "advanced"]),
    notes: z.string().max(1000),
    demo: z.boolean().optional(),
  }),
  feedback: z
    .array(
      z.object({
        entity_id: z.string().max(80),
        name: z.string().max(160),
        kind: z.enum(["song", "film", "tv", "food", "place", "book"]),
        reaction: z.enum(["lit", "neutral", "upset"]),
      }),
    )
    .max(60),
  caregiverNote: z.string().max(500),
  sessionNumber: z.number().int().min(1).max(500),
});

// Best-effort per-instance limit so a public demo can't drain the API keys.
const LIMIT = Number(process.env.SESSIONS_PER_HOUR ?? 12);
const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function ndjson(run: (emit: (e: AgentEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await run(emit);
      } catch (e) {
        let message = e instanceof Error ? e.message : String(e);
        if (e instanceof Anthropic.AuthenticationError) message = "The server's Anthropic API key is missing or invalid.";
        else if (e instanceof Anthropic.RateLimitError) message = "The AI service is busy right now. Please try again in a minute.";
        else if (e instanceof Anthropic.APIError) message = `AI service error (${e.status ?? "network"}). Please try again.`;
        console.error("[session]", e);
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Without keys, replay a pre-written example for the demo people so the app
// can still be explored. It is labeled as a sample everywhere it appears.
function sampleResponse(profileId: string) {
  const sample = SAMPLES[profileId];
  if (!sample) {
    return Response.json(
      {
        error:
          "Live sessions need API keys on the server (QLOO_API_KEY and ANTHROPIC_API_KEY). Until then, sample sessions are available for Rosa, Harold and Mei.",
      },
      { status: 503 },
    );
  }
  return ndjson(async (emit) => {
    for (const item of sample.trace) {
      emit({ type: "trace", item });
      await new Promise((r) => setTimeout(r, 450));
    }
    const segments = sample.session.segments.map((s) => ({ ...s, link: mediaLink(s) }));
    emit({ type: "session", session: { ...sample.session, segments, sample: true } });
  });
}

export async function POST(req: Request) {
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", detail: parsed.error.message }, { status: 400 });
  }
  const body: SessionRequest = parsed.data;

  if (!isLive()) return sampleResponse(body.profile.id);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) {
    return Response.json({ error: "Too many sessions from this connection. Please try again in an hour." }, { status: 429 });
  }

  return ndjson((emit) => runAgent(body, emit));
}
