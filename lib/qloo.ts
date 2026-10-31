// Thin client for the Qloo hackathon API. Responses are compacted before they
// reach the model so a 50-entity result costs a few hundred tokens, not 30K.

const BASE = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 15_000;
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export class QlooError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export interface CompactEntity {
  id: string;
  name: string;
  type: string | null;
  year: string | null;
  affinity: number | null;
  popularity: number | null;
  tags: string[];
  image: string | null;
  address: string | null;
  description: string | null;
}

async function get(path: string, params: Record<string, string | number | undefined>) {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new QlooError("QLOO_API_KEY is not set on the server.");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const res = await fetch(url, {
    headers: { "X-Api-Key": key, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new QlooError(`Qloo ${path} returned ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const data = JSON.parse(text);
  cache.set(url, { at: Date.now(), data });
  return data;
}

// Qloo entities vary by type; read the fields defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function compactEntity(e: any): CompactEntity {
  const p = e?.properties ?? {};
  const year =
    p.release_year ?? p.publication_year ?? (typeof p.release_date === "string" ? p.release_date.slice(0, 4) : null);
  return {
    id: String(e?.entity_id ?? e?.id ?? ""),
    name: String(e?.name ?? "Unknown"),
    type: e?.subtype ?? e?.type ?? (Array.isArray(e?.types) ? e.types[0] : null) ?? null,
    year: year != null ? String(year) : null,
    affinity: typeof e?.query?.affinity === "number" ? Math.round(e.query.affinity * 100) / 100 : null,
    popularity: typeof e?.popularity === "number" ? Math.round(e.popularity * 100) / 100 : null,
    tags: Array.isArray(e?.tags)
      ? e.tags.slice(0, 6).map((t: { name?: string }) => t?.name).filter(Boolean)
      : [],
    image: p.image?.url ?? null,
    address: p.address ?? null,
    description: typeof p.description === "string" ? p.description.slice(0, 160) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickArray(data: any, ...paths: string[][]): any[] {
  for (const path of paths) {
    let cur = data;
    for (const k of path) cur = cur?.[k];
    if (Array.isArray(cur)) return cur;
  }
  return [];
}

export async function searchEntities(query: string, types: string[] = [], take = 5) {
  const data = await get("/search", {
    query,
    types: types.length ? types.join(",") : undefined,
    take: Math.min(Math.max(take, 1), 10),
  });
  return pickArray(data, ["results"], ["results", "entities"]).map(compactEntity);
}

export interface InsightsArgs {
  type: string;
  seedEntityIds?: string[];
  seedTagIds?: string[];
  filterTagIds?: string[];
  excludeIds?: string[];
  ageBucket?: string;
  gender?: string;
  signalLocation?: string;
  filterLocation?: string;
  releaseYearMin?: number;
  releaseYearMax?: number;
  take?: number;
}

// filter.release_year.* is documented for film and TV only.
const YEAR_FILTER_TYPES = new Set(["urn:entity:movie", "urn:entity:tv_show"]);

export async function insights(a: InsightsArgs) {
  const supportsYear = YEAR_FILTER_TYPES.has(a.type);
  const data = await get("/v2/insights", {
    "filter.type": a.type,
    "signal.interests.entities": a.seedEntityIds?.join(","),
    "signal.interests.tags": a.seedTagIds?.join(","),
    "filter.tags": a.filterTagIds?.join(","),
    "filter.exclude.entities": a.excludeIds?.length ? a.excludeIds.join(",") : undefined,
    "signal.demographics.age": a.ageBucket,
    "signal.demographics.gender": a.gender,
    "signal.location.query": a.signalLocation,
    "filter.location.query": a.filterLocation,
    "filter.release_year.min": supportsYear ? a.releaseYearMin : undefined,
    "filter.release_year.max": supportsYear ? a.releaseYearMax : undefined,
    take: Math.min(Math.max(a.take ?? 12, 1), 25),
  });
  return pickArray(data, ["results", "entities"], ["results"]).map(compactEntity);
}

export async function searchTags(query: string, take = 8) {
  const data = await get("/v2/tags", { "filter.query": query, take: Math.min(Math.max(take, 1), 15) });
  return pickArray(data, ["results", "tags"], ["results"]).map((t) => ({
    id: String(t?.id ?? t?.tag_id ?? ""),
    name: String(t?.name ?? ""),
    type: t?.type ?? t?.subtype ?? null,
  }));
}

export function ageBucket(birthYear: number, now = new Date().getFullYear()) {
  const age = now - birthYear;
  if (age <= 24) return "24_and_younger";
  if (age <= 29) return "25_to_29";
  if (age <= 34) return "30_to_34";
  if (age <= 44) return "35_to_44";
  if (age <= 54) return "45_to_54";
  return "55_and_older";
}
