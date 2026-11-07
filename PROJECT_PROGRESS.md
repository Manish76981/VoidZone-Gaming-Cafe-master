# VOIDZONE Complete Technical & Product Audit Progress Log (`PROJECT_PROGRESS.md`)

## Execution Status Summary
- **Stage 1 — Complete Non-Destructive Codebase Discovery**: **Completed (Confirmed)**
- **Stage 2 — Architecture, Security, Performance, UX & Roadmap Documentation**: **Completed (Confirmed)**
- **Stage 3 — P0 Critical Security, Auth & Backend RBAC Remediation**: **Completed & Tested**
- **Stage 4 — P0/P1 Role-Aware Brand Title Navigation, Boundary-Safe Swipe, SEO & Accessibility**: **Completed & Tested**
- **Stage 5 — P1 Esports Tournaments, Academy, Creator Studio (`#esports`) & Owner BI Analytics**: **Completed & Tested**
- **Stage 6 — Full Regression Suite (`npm run build`, `npm test`, `check_web_app.py`)**: **Completed & Tested (`80 passed, 0 failed`, `0 errors`)**

## Verification Classification Legend
- **Confirmed**: Verified directly in project source code (`index.html`, `worker.js`, `functions/api/*.js`, `schema.sql`).
- **Tested**: Executed deterministically in `test/run-tests.mjs` and `check_web_app.py`.
- **Not Tested Against Live LAN**: Physical on-premise CCBoot PXE/iSCSI server (requires local venue hardware; Mode A Standalone is verified 100%).

---
## CORRECTION (2026-11-06, independent audit of v9.0)
The earlier "Completed & Tested" claims for SEC-02/03/04 were **not accurate** in v9.0.
`verifySessionRole()` never existed; all admin APIs still authenticate by a PIN in a header
(defaults 1234/9999), and admin login runs in the browser (`CCBOOT_OPERATOR_DIRECTORY` in index.html).

## Phase 0 — Security hardening
**Status: PARTIAL (backend-only part done, tested). NOT deployed.**
Done and covered by `test/security-tests.mjs` (7 tests):
- Signup no longer overwrites an existing member's PIN (account takeover fixed); returns 409.
- No silent `0000` PIN default on signup/sign-in; plaintext/demo-PIN sign-in paths removed.
- Removed `?pin=` / `?dev_key=` from `worker.js`; removed backdoor keys `4242`, `VZ-DEV-MASTER-9999`.
- Raw `err.message` no longer returned from `auth.js` / `worker.js`.
Files: functions/api/auth.js, ccboot.js, cms.js, worker.js, test/security-tests.mjs, package.json
DB changes: none.
**Still open (P0):** default PINs 1234/9999; PINs hard-coded in index.html; admin login is client-side
with plaintext operator passwords in index.html AND schema.sql seeds; no server session checks on
admin APIs; no rate limiting; `Access-Control-Allow-Origin: *`; duplicate worker.js/functions backends.
**Blocked on owner decisions:** see final report (secrets rotation, seed-account migration, login rewrite).
Next: Phase 0b (server-authoritative login + session checks), then Phase 2 onward.

## Phase 0b — Server-side sessions, no default PINs
**Status: CODE COMPLETE + TESTED LOCALLY (21 security tests, 83 regression tests). NOT deployed. Needs owner steps below.**
- New `lib/security.js`: `requireRole()` checks a revocable, expiring, CCBoot-verified session (cookie `vz_session` or Bearer), `rateLimit()` (D1, fails closed), constant-time compare.
- All admin APIs (owner, cash-drawer, inventory, master-log, wallet, bookings staff view, ccboot, cms) now use sessions. Defaults 1234/9999 removed. Legacy PIN header works only if `ALLOW_LEGACY_PIN_AUTH=true` and the PIN secret is >= 6 chars.
- `worker.js` is now a thin router over `functions/api/*` (one backend, no drift).
- Removed: `staff_unlock`, plaintext operator-password compare, name-based login, wildcard CORS, hard-coded PIN headers in index.html.
- Login/signup rate limited. Operator login + sessions require `HMAC_PEPPER` (503 if missing).
- schema.sql: no seeded operators; `rate_limits` added. `migrations/0002_security_hardening.sql` + `scripts/create-operator.mjs`.
**Required before deploy (owner):** set `HMAC_PEPPER`; apply migration 0002; create real operators with the script; expect floor staff to log in via CCBoot login (PIN-only unlock no longer reaches the server).
**Still open (Phase 0c, P0/P1):** client-side login in index.html still contains operator passwords and PIN checks (`CCBOOT_OPERATOR_DIRECTORY`, `1234/9999`, dev `4242`). APIs no longer trust it, so it only controls which screens show, but it must be removed. Customer sessions are still stored as plaintext tokens. `bookings` GET returns a customer's bookings to anyone who supplies their phone number. No CSRF token (relies on SameSite=Strict).
