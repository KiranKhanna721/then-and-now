import { isLive } from "@/lib/live";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ live: isLive() });
}
