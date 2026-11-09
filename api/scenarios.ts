import { requireIdentity } from "../cursor/identity";
import { sql } from "../src/lib/db";

const MAX_BODY = 750_000;
const MAX_SCENARIOS = 40;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

function ownerOf(identity: { stage: string; sub: string }): string {
  return `${identity.stage}:${identity.sub}`;
}

function hasPlannerHeader(request: Request): boolean {
  return request.headers.get("x-retirement-planner") === "1";
}

interface ScenarioInput {
  id: string;
  name: string;
  updatedAt?: number;
  state: unknown;
}

function parseDocument(body: unknown): { activeId: string; scenarios: ScenarioInput[] } | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as { activeId?: unknown; scenarios?: unknown };
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0 || raw.scenarios.length > MAX_SCENARIOS) {
    return null;
  }
  const scenarios: ScenarioInput[] = [];
  for (const item of raw.scenarios) {
    if (!item || typeof item !== "object") return null;
    const row = item as { id?: unknown; name?: unknown; updatedAt?: unknown; state?: unknown };
    if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(row.id)) return null;
    if (typeof row.name !== "string") return null;
    const name = row.name.trim().slice(0, 80);
    if (!name) return null;
    if (!row.state || typeof row.state !== "object" || Array.isArray(row.state)) return null;
    scenarios.push({
      id: row.id,
      name,
      updatedAt: typeof row.updatedAt === "number" ? row.updatedAt : Date.now(),
      state: row.state,
    });
  }
  if (new Set(scenarios.map((s) => s.id)).size !== scenarios.length) return null;
  const activeId = typeof raw.activeId === "string" ? raw.activeId : scenarios[0].id;
  if (!scenarios.some((s) => s.id === activeId)) return null;
  return { activeId, scenarios };
}

export async function GET(request: Request): Promise<Response> {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const rows = await sql<{ document: unknown }>(
    "select document from planner_saves where owner = $1",
    [ownerOf(identity)],
  );
  const document = rows[0]?.document ?? { activeId: null, scenarios: [] };
  return json(document);
}

export async function PUT(request: Request): Promise<Response> {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (!hasPlannerHeader(request)) return json({ error: "missing header" }, 400);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const document = parseDocument(parsed);
  if (!document) return json({ error: "invalid document" }, 400);

  await sql(
    `insert into planner_saves (owner, document, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (owner) do update set document = excluded.document, updated_at = now()`,
    [ownerOf(identity), JSON.stringify(document)],
  );
  return json({ ok: true });
}
