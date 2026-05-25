import { Env, AuthContext } from "../types";

type JsonFn = (data: unknown, status?: number, origin?: string) => Response;
type ErrFn = (msg: string, status?: number, origin?: string) => Response;

function makeJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encoder = new TextEncoder();
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`)))
    .then((sig) => {
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      return `${header}.${body}.${sigB64}`;
    });
}

function randomToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomId(): string {
  return crypto.randomUUID();
}

export async function handleAuth(
  request: Request,
  env: Env,
  url: URL,
  json: JsonFn,
  err: ErrFn,
  origin: string
): Promise<Response> {
  const { pathname } = url;

  // POST /api/auth/magic-link — send magic link
  if (pathname === "/api/auth/magic-link" && request.method === "POST") {
    const { email } = await request.json<{ email: string }>();
    if (!email || !email.includes("@")) return err("Invalid email", 400, origin);

    const normalizedEmail = email.toLowerCase().trim();

    // Upsert user
    let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(normalizedEmail).first<{ id: string }>();

    if (!user) {
      const id = randomId();
      await env.DB.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
        .bind(id, normalizedEmail).run();
      user = { id };
    }

    const token = randomToken();
    const expires = Math.floor(Date.now() / 1000) + 60 * 15; // 15 minutes

    await env.DB.prepare(
      "UPDATE users SET magic_link_token = ?, magic_link_expires = ? WHERE id = ?"
    ).bind(token, expires, user.id).run();

    const link = `${env.APP_URL}/verify?token=${token}`;

    // In dev (no RESEND_API_KEY), return the link directly for testing
    if (!env.RESEND_API_KEY) {
      return json({ ok: true, dev_link: link }, 200, origin);
    }

    // Send email via Resend
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BetWithFriends <noreply@betwithfriends.app>",
        to: normalizedEmail,
        subject: "⚽ Your magic link for BetWithFriends",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#00d4aa">⚽ BetWithFriends</h2>
            <p>Click the link below to sign in. It expires in 15 minutes.</p>
            <a href="${link}" style="display:inline-block;background:#00d4aa;color:#0f0f23;padding:12px 24px;border-radius:12px;font-weight:bold;text-decoration:none;margin:16px 0">
              Sign in to BetWithFriends
            </a>
            <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    return json({ ok: true }, 200, origin);
  }

  // GET /api/auth/verify?token=... — verify token, return JWT
  if (pathname === "/api/auth/verify" && request.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return err("Missing token", 400, origin);

    const user = await env.DB.prepare(
      "SELECT id, email, magic_link_expires FROM users WHERE magic_link_token = ?"
    ).bind(token).first<{ id: string; email: string; magic_link_expires: number }>();

    if (!user) return err("Invalid token", 400, origin);
    if (user.magic_link_expires < Math.floor(Date.now() / 1000)) return err("Token expired", 400, origin);

    // Invalidate token
    await env.DB.prepare("UPDATE users SET magic_link_token = NULL, magic_link_expires = NULL WHERE id = ?")
      .bind(user.id).run();

    const jwt = await makeJWT(
      { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
      env.JWT_SECRET
    );

    return json({ jwt }, 200, origin);
  }

  // GET /api/auth/me — current user info
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const bearerToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!bearerToken) return err("Unauthorized", 401, origin);

    // Re-verify JWT to get auth context
    const auth = await verifyToken(bearerToken, env.JWT_SECRET);
    if (!auth) return err("Invalid token", 401, origin);

    return json({ email: auth.email }, 200, origin);
  }

  return err("Not found", 404, origin);
}

async function verifyToken(token: string, secret: string): Promise<AuthContext | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const sig = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sig, encoder.encode(`${h}.${p}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.sub, email: payload.email };
  } catch { return null; }
}
