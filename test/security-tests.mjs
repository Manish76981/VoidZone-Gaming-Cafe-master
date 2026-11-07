/** Backend security regression tests (Phase 0). Uses a fake D1; no network. */
import assert from "node:assert/strict";
import * as auth from "../functions/api/auth.js";
import * as cms from "../functions/api/cms.js";
import * as ccboot from "../functions/api/ccboot.js";
import fs from "node:fs";
import * as sec from "../lib/security.js";
import worker from "../worker.js";
import * as owner from "../functions/api/owner.js";

let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("  [PASS]", name); },
  (e) => { console.error("  [FAIL]", name, "-", e.message); process.exitCode = 1; });

function fakeDb({ insertChanges = 0 } = {}) {
  const calls = [];
  const stmt = (sql) => ({ bind: (...a) => ({
    run: async () => { calls.push(sql); return { meta: { changes: /INSERT INTO members/.test(sql) ? insertChanges : 1 } }; },
    first: async () => null, all: async () => ({ results: [] }) }) });
  return { prepare: stmt, calls };
}
const post = (url, body, headers = {}) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

console.log("=== Security: Phase 0 ===");
await ok("signup on an existing phone returns 409 and issues no session", async () => {
  const db = fakeDb({ insertChanges: 0 });
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "signup", phone: "9820011223", name: "Victim Takeover", pin: "1234" }), env: { DB: db } });
  assert.equal(res.status, 409);
  assert.ok(!db.calls.some((s) => /INSERT INTO auth_sessions/.test(s)), "no session must be created");
});
await ok("signup without a PIN is rejected (no silent 0000 default)", async () => {
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "signup", phone: "9820011223", name: "No Pin" }), env: { DB: fakeDb({ insertChanges: 1 }) } });
  assert.equal(res.status, 400);
});
await ok("members upsert never overwrites pin_hash in source", () => {
  for (const f of ["functions/api/auth.js", "worker.js"]) {
    const s = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/ON CONFLICT\(member_phone\) DO UPDATE/.test(s), f);
  }
});
await ok("hard-coded dev backdoor keys are gone from all backends", () => {
  for (const f of ["functions/api/cms.js", "functions/api/ccboot.js", "worker.js"]) {
    const s = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/4242|VZ-DEV-MASTER-9999/.test(s), f);
  }
});
await ok("no ?pin= / ?dev_key= query-string credentials in any backend", () => {
  for (const f of ["worker.js", ...fs.readdirSync(new URL("../functions/api", import.meta.url)).map((n) => "functions/api/" + n)]) {
    const s = fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.ok(!/searchParams\.get\(["'](pin|dev_key)["']\)/.test(s), f);
  }
});
await ok("cms POST with the old backdoor key is rejected", async () => {
  const res = await cms.onRequestPost({ request: post("https://x/api/cms", { action: "save_draft" }, { "X-VZ-Dev-Key": "VZ-DEV-MASTER-9999" }), env: { DB: fakeDb(), OWNER_PIN: "s3cret-not-9999" } });
  assert.equal(res.status, 403);
});
await ok("raw error messages are not returned to clients", async () => {
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "signin", identifier: "x", pin: "1" }), env: { DB: { prepare() { throw new Error("SECRET_DB_DETAIL"); } } } });
  assert.ok(!(await res.text()).includes("SECRET_DB_DETAIL"));
});

// ---- Phase 0b ----
const PEPPER = "test-pepper-value";
const RAW = "vzs_abc123";
const sessRow = (over = {}) => ({ member_id: "VZ-OP-OWNER-01", role: "owner", revoked: 0, ccboot_verified: 1, expires_at: new Date(Date.now() + 3600e3).toISOString(), ...over });
const dbWith = (row, hits = 1) => ({ prepare: (sql) => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }),
  first: async () => (/FROM auth_sessions/.test(sql) ? row : /FROM rate_limits/.test(sql) ? { hits } : null), all: async () => ({ results: [] }) }) }) });
const reqWith = (h) => new Request("https://x/api/owner", { headers: h });
await ok("valid owner session cookie is accepted for owner role", async () => {
  assert.equal(await sec.requireRole(reqWith({ Cookie: `vz_session=${RAW}` }), { DB: dbWith(sessRow()), HMAC_PEPPER: PEPPER }, ["owner"]), true);
});
await ok("staff session is rejected on owner-only role", async () => {
  assert.equal(await sec.requireRole(reqWith({ Authorization: `Bearer ${RAW}` }), { DB: dbWith(sessRow({ role: "staff" })), HMAC_PEPPER: PEPPER }, ["owner"]), false);
});
await ok("expired, revoked, and unverified sessions are rejected", async () => {
  for (const o of [{ expires_at: new Date(Date.now() - 1000).toISOString() }, { revoked: 1 }, { ccboot_verified: 0 }])
    assert.equal(await sec.requireRole(reqWith({ Authorization: `Bearer ${RAW}` }), { DB: dbWith(sessRow(o)), HMAC_PEPPER: PEPPER }, ["owner"]), false);
});
await ok("no HMAC_PEPPER configured -> all sessions rejected (fail closed)", async () => {
  assert.equal(await sec.requireRole(reqWith({ Authorization: `Bearer ${RAW}` }), { DB: dbWith(sessRow()) }, ["owner"]), false);
});
await ok("old default PINs 1234 / 9999 no longer grant access", async () => {
  for (const pin of ["1234", "9999"]) {
    assert.equal(await sec.requireRole(reqWith({ "X-VZ-Pin": pin }), { DB: dbWith(null) }, ["owner", "staff"]), false);
    assert.equal(await sec.requireRole(reqWith({ "X-VZ-Pin": pin }), { DB: dbWith(null), OWNER_PIN: pin, STAFF_PIN: pin }, ["owner", "staff"]), false, "flag off");
  }
});
await ok("owner API returns 403 with no session and 403 with default PIN", async () => {
  const res = await owner.onRequestGet({ request: reqWith({ "X-VZ-Pin": "9999" }), env: { DB: dbWith(null), HMAC_PEPPER: PEPPER } });
  assert.equal(res.status, 403);
});
await ok("response has no wildcard CORS header", async () => {
  const res = await owner.onRequestGet({ request: reqWith({}), env: { DB: dbWith(null), HMAC_PEPPER: PEPPER } });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});
await ok("rate limiter blocks after the limit and fails closed on DB error", async () => {
  assert.equal(await sec.rateLimit({ DB: dbWith(null, 3) }, "k", 5, 60), true);
  assert.equal(await sec.rateLimit({ DB: dbWith(null, 6) }, "k", 5, 60), false);
  assert.equal(await sec.rateLimit({ DB: { prepare() { throw new Error("no such table"); } } }, "k", 5, 60), false);
});
await ok("signin is rate limited (429)", async () => {
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "signin", identifier: "9820011223", pin: "1" }), env: { DB: dbWith(null, 99) } });
  assert.equal(res.status, 429);
});
await ok("CCBoot operator login refuses to run without HMAC_PEPPER", async () => {
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "ccboot_operator_login", ccboot_operator_id: "a", ccboot_password: "b" }), env: { DB: dbWith(null) } });
  assert.equal(res.status, 503);
});
await ok("staff_unlock (PIN -> session) is removed (410)", async () => {
  const res = await auth.onRequestPost({ request: post("https://x/api/auth", { action: "staff_unlock", pin: "9999" }), env: { DB: dbWith(null) } });
  assert.equal(res.status, 410);
});
await ok("worker.js delegates /api/* to the same handlers (no duplicate backend)", async () => {
  const res = await worker.fetch(reqWith({ "X-VZ-Pin": "9999" }), { DB: dbWith(null), HMAC_PEPPER: PEPPER });
  assert.equal(res.status, 403);
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(!/OWNER_PIN|STAFF_PIN|X-VZ-Pin/.test(src));
});
await ok("worker serves the homepage HTML at / and an unknown path (no exception)", async () => {
  for (const path of ["/", "/anything"]) {
    const res = await worker.fetch(new Request("https://x" + path), {});
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes("<html"));
  }
});
await ok("schema.sql has no seeded plaintext operator passwords and has rate_limits", () => {
  const sql = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  assert.ok(!/ccboot_(owner|staff|dev|unlinked)_2026/.test(sql));
  assert.ok(/CREATE TABLE IF NOT EXISTS rate_limits/.test(sql));
});
await ok("index.html no longer sends PINs/dev keys to the API", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!/"X-VZ-(Pin|Dev-Key)"/.test(html));
});
console.log(`=== SECURITY SUMMARY: ${passed} passed ===`);
