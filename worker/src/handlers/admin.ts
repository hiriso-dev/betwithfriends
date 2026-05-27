import { Env, AuthContext } from "../types";
import { syncScores } from "../services/scores-sync";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

const ADMIN_EMAIL = "jerome.ladeveze@gmail.com";

export async function handleAdmin(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthContext,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  if (auth.email !== ADMIN_EMAIL) return err("Forbidden", 403, origin);

  const { pathname } = url;

  // POST /api/admin/sync — pull matches from football-data.org into the DB
  if (pathname === "/api/admin/sync" && request.method === "POST") {
    if (!env.FOOTBALL_DATA_API_KEY) {
      return err("FOOTBALL_DATA_API_KEY not set", 503, origin);
    }
    const body = await request.json<{ competition?: string }>().catch(() => ({}));
    const competition = (body as { competition?: string }).competition ?? "WC";
    await syncScores(env, competition);
    return json({ ok: true, competition }, 200, origin);
  }

  return err("Not found", 404, origin);
}
