/**
 * VoidZone shared security helpers (Phase 0b).
 * - Role checks are SERVER-SIDE and based on a revocable, expiring session (auth_sessions.token_hash).
 * - No default PINs. Legacy PIN header auth is OFF unless ALLOW_LEGACY_PIN_AUTH="true" AND the PIN secret is set.
 */
const SESSION_SALT = "vz_session_token_salt_v8";
const enc = new TextEncoder();

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function hashSessionToken(raw, env) {
  if (!env?.HMAC_PEPPER) return null; // fail closed: no pepper, no sessions
  return hmacHex(env.HMAC_PEPPER, `${SESSION_SALT}:${raw}`);
}

export function readSessionToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)vz_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

/** Returns the session row if the caller holds a valid, unexpired, unrevoked, CCBoot-verified session with an allowed role. */
export async function getSession(request, env, roles) {
  const db = env?.DB;
  const raw = readSessionToken(request);
  if (!db || !raw) return null;
  const hash = await hashSessionToken(raw, env);
  if (!hash) return null;
  const row = await db.prepare(
    "SELECT member_id, role, revoked, ccboot_verified, expires_at FROM auth_sessions WHERE token_hash = ?1 LIMIT 1"
  ).bind(hash).first();
  if (!row || row.revoked || !row.ccboot_verified) return null;
  if (!(new Date(row.expires_at).getTime() > Date.now())) return null;
  if (roles && !roles.includes(row.role)) return null;
  return row;
}

function legacyPinAllowed(request, env, roles) {
  if (env?.ALLOW_LEGACY_PIN_AUTH !== "true") return false;
  const pin = request.headers.get("X-VZ-Pin") || "";
  const checks = [];
  if (roles.includes("owner") && env?.OWNER_PIN) checks.push(env.OWNER_PIN);
  if (roles.includes("staff") && env?.STAFF_PIN) checks.push(env.STAFF_PIN);
  return checks.some((p) => String(p).length >= 6 && safeEqual(pin, String(p)));
}

export async function requireRole(request, env, roles) {
  if (await getSession(request, env, roles)) return true;
  return legacyPinAllowed(request, env, roles);
}

/** Fixed-window rate limit stored in D1. Fails CLOSED if the table is missing (apply migrations/0002). */
export async function rateLimit(env, key, max, windowSec) {
  const db = env?.DB;
  if (!db) return false;
  try {
    const now = Math.floor(Date.now() / 1000);
    const win = now - (now % windowSec);
    await db.prepare(
      "INSERT INTO rate_limits (rl_key, window_start, hits) VALUES (?1, ?2, 1) ON CONFLICT(rl_key, window_start) DO UPDATE SET hits = hits + 1"
    ).bind(key, win).run();
    const row = await db.prepare("SELECT hits FROM rate_limits WHERE rl_key = ?1 AND window_start = ?2").bind(key, win).first();
    if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limits WHERE window_start < ?1").bind(now - 86400).run();
    return Number(row?.hits || 0) <= max;
  } catch {
    return false;
  }
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
