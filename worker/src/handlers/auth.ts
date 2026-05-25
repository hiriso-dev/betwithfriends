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

function randomId(): string {
  return crypto.randomUUID();
}

const PASSWORD_ITERATIONS = 100000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(pairs.map((pair) => parseInt(pair, 16)));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}$${hash}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterStr, saltHex, expectedHash] = stored.split("$");
  if (algo !== "pbkdf2_sha256" || !iterStr || !saltHex || !expectedHash) return false;

  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const computed = await derivePasswordHash(password, hexToBytes(saltHex), iterations);
  return timingSafeEqual(computed, expectedHash);
}

async function ensurePasswordColumn(env: Env): Promise<void> {
  try {
    await env.DB.prepare("SELECT password_hash FROM users LIMIT 1").first();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes("no such column: password_hash")) throw e;
    await env.DB.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  }
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

  // POST /api/auth/register — create account and return JWT
  if (pathname === "/api/auth/register" && request.method === "POST") {
    await ensurePasswordColumn(env);

    const { email, password } = await request.json<{ email: string; password: string }>();
    if (!email || !email.includes("@")) return err("Invalid email", 400, origin);
    if (!password || password.length < 8) return err("Password must be at least 8 characters", 400, origin);

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await hashPassword(password);

    const existingUser = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .bind(normalizedEmail).first<{ id: string; password_hash: string | null }>();

    let userId: string;

    if (!existingUser) {
      userId = randomId();
      await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
        .bind(userId, normalizedEmail, passwordHash).run();
    } else {
      if (existingUser.password_hash) {
        return err("An account already exists for this email", 409, origin);
      }
      userId = existingUser.id;
      await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(passwordHash, userId).run();
    }

    const jwt = await makeJWT(
      { sub: userId, email: normalizedEmail, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
      env.JWT_SECRET
    );

    return json({ jwt }, 200, origin);
  }

  // POST /api/auth/login — verify credentials and return JWT
  if (pathname === "/api/auth/login" && request.method === "POST") {
    await ensurePasswordColumn(env);

    const { email, password } = await request.json<{ email: string; password: string }>();
    if (!email || !email.includes("@")) return err("Invalid email", 400, origin);
    if (!password) return err("Password is required", 400, origin);

    const normalizedEmail = email.toLowerCase().trim();

    const user = await env.DB.prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .bind(normalizedEmail).first<{ id: string; email: string; password_hash: string | null }>();

    if (!user || !user.password_hash) return err("Invalid email or password", 401, origin);

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) return err("Invalid email or password", 401, origin);

    const jwt = await makeJWT(
      { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
      env.JWT_SECRET
    );

    return json({ jwt }, 200, origin);
  }

  if ((pathname === "/api/auth/magic-link" || pathname === "/api/auth/verify") && request.method !== "OPTIONS") {
    return err("Magic-link auth is disabled", 410, origin);
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
