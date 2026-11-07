/**
 * VoidZone Gaming Cafe — Complete Automated Build, SQLite D1, CMS & E2E Regression Suite (test/run-tests.mjs)
 * Covers Phases 3, 4, 6, 15, 16, and 17.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
  }
}

console.log("=== 1. JavaScript Syntax & Bundle Parity Checks ===");
const jsFiles = [
  "worker.js",
  "scripts/build.mjs",
  "functions/api/auth.js",
  "functions/api/bookings.js",
  "functions/api/cash-drawer.js",
  "functions/api/ccboot.js",
  "functions/api/cms.js",
  "functions/api/health.js",
  "functions/api/inventory.js",
  "functions/api/master-log.js",
  "functions/api/owner.js",
  "functions/api/wallet.js"
];
for (const rel of jsFiles) {
  const full = path.join(rootDir, rel);
  execFileSync(process.execPath, ["--check", full]);
  assert(true, `node --check ${rel}`);
}

const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const distHtml = fs.readFileSync(path.join(rootDir, "dist", "index.html"), "utf8");
assert(indexHtml === distHtml, "dist/index.html matches root index.html byte-for-byte");

const workerCode = fs.readFileSync(path.join(rootDir, "worker.js"), "utf8");
const b64Match = workerCode.match(/const HTML_BASE64 = "([A-Za-z0-9+/=]+)";/);
assert(Boolean(b64Match), "worker.js contains HTML_BASE64 constant");
const decodedHtml = Buffer.from(b64Match[1], "base64").toString("utf8");
assert(decodedHtml === indexHtml, "worker.js HTML_BASE64 matches index.html 100%");

console.log("=== 2. SQLite3 D1 Schema (14 Tables) & SQL Query Verification ===");
const pySqlCheck = `
import os, re, sqlite3
root = ${JSON.stringify(rootDir)}
conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys = ON;")
with open(os.path.join(root, "schema.sql"), "r", encoding="utf-8") as f:
    conn.executescript(f.read())
st_cnt = conn.execute("SELECT COUNT(*) FROM stations").fetchone()[0]
offers_cnt = conn.execute("SELECT COUNT(*) FROM cms_offers").fetchone()[0]
assert st_cnt == 22, f"Expected 22 stations, got {st_cnt}"
assert offers_cnt >= 2, f"Expected >=2 seeded cms_offers, got {offers_cnt}"

files = ["worker.js"] + [os.path.join("functions/api", f) for f in sorted(os.listdir(os.path.join(root, "functions/api"))) if f.endswith(".js")]
seq = 0
total_q = 0
for rel in files:
    with open(os.path.join(root, rel), "r", encoding="utf-8") as f:
        txt = f.read()
    txt = re.sub(r'const HTML_BASE64 = "[^"]+";', '', txt)
    sqls = re.findall(r'db\\.prepare\\(\\s*(["\`])([\\s\\S]*?)\\1\\s*\\)', txt)
    for _, q in sqls:
        seq += 1
        total_q += 1
        num_p = max([int(x) for x in re.findall(r'\\?(\\d+)', q)] or [0])
        params = [f"v_{seq}_{i}" for i in range(1, num_p + 1)]
        if "auth_sessions" in q and num_p == 4:
            params[2] = "staff"
        if "cms_offers" in q and num_p == 13:
            params[3] = "PERCENT"
            params[11] = 1
            params[12] = 1
        if "ccboot_config" in q and num_p == 10:
            params[0] = "STANDALONE"
            params[5] = 0
        if "ccboot_config" in q and num_p == 3 and "operating_mode = ?1" in q:
            params[0] = "STANDALONE" 
        if "ccboot_pcs" in q and num_p == 7:
            params[0] = "LOCAL_NVME"
            params[4] = "OPERATIONAL"
        if "auth_sessions" in q and num_p == 8:
            params[3] = "staff" 
        conn.execute(q, params)
print(f"SQL_OK:{total_q}")
`;
const pyOut = execFileSync("python3", ["-c", pySqlCheck], { encoding: "utf8" }).trim();
assert(pyOut.startsWith("SQL_OK:"), `All SQL statements across worker.js and functions/api/*.js verified (${pyOut})`);

console.log("=== 3. End-to-End Runtime User Flows & Developer CMS Verification (Phases 16 & 17) ===");
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
let appJs = scriptMatch[1];
appJs = appJs.replace(
  "render();\n    playIn();",
  `globalThis.__TEST__ = {
    getS: () => S, getView: () => view, getBk: () => bk, getCafeOrder: () => cafeOrder,
    getStaffRole: () => staffRole, getDevOk: () => devOk,
    setDevSubTab: (t) => { devSubTab = t; },
    getRate: () => RATE, getExcelPricing: () => EXCEL_PRICING,
    confirmBook, submitCafeOrder, login, devLogin, panel,
    validateAndHydrateState, estBreakdown, excelCalcGameCharges,
    evaluatePromoOffer, computeDraftDiffCount, ensureCmsState, ensureCcbootState, isStationInMaintenance, ensureAdminAuthGatewayState, hasValidAdminSession, authenticateCcbootFirst, logoutAdminSession, getRoleHomeDestination, getAuthorizedNavTabIds, swipeTab, handleSwipeGesture, ensureEsportsState, go, render, home
  };
  render();
  playIn();`
);

const elements = {};
function makeEl(id) {
  return {
    id, innerHTML: "", textContent: "", value: "", checked: false, disabled: false,
    style: { setProperty: () => {} }, dataset: {}, setAttribute: () => {}, getAttribute: () => null,
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    querySelectorAll: () => [], appendChild: () => {}, focus: () => {}, setSelectionRange: () => {},
    getContext: () => ({
      save: () => {}, scale: () => {}, clearRect: () => {}, beginPath: () => {},
      moveTo: () => {}, arc: () => {}, closePath: () => {}, fill: () => {},
      translate: () => {}, rotate: () => {}, fillText: () => {}, stroke: () => {}, restore: () => {}
    }),
    width: 400, height: 400
  };
}
[
  "#nav", "#hdr-auth", "#auth-drawer-root", "#app", "#toast", "#wheel", "#bp", "#bn", "#bpin", "#bpromo",
  "#cafe-pin", "#owner-elevate-pin", "#dev-user", "#dev-pin", "#cms-promo-banner-root", "#cms-footer-root",
  "#cms-offer-code", "#cms-offer-title", "#cms-offer-type", "#cms-offer-val", "#cms-offer-min", "#cms-offer-max",
  "#cms-offer-end", "#cms-offer-service", "#cms-sec-tag", "#cms-sec-title", "#cms-sec-body", "#cms-sec-cta",
  "#cms-sec-view", "#cms-version-label", "#stage", "#cb-cp-url", "#cb-api-url", "#cb-cafe-id", "#cb-api-token", "#cb-whitelist-ip", "#cb-timeout", "#cb-retries", "#cb-game-title", "#cb-game-ver", "#ccboot-login-cafe", "#ccboot-login-user", "#ccboot-login-pass", "#si-id", "#si-pin"
].forEach(k => { elements[k] = makeEl(k); });

const rootStyleProps = {};
const storage = {};
const listeners = {};
const sandbox = {
  window: {
    crypto: { getRandomValues: (buf) => { buf[0] = 123456789; return buf; } },
    matchMedia: () => ({ matches: true }),
    addEventListener: (ev, fn) => { listeners["win_" + ev] = fn; },
    open: () => {}, print: () => {}, devicePixelRatio: 1
  },
  document: {
    title: "",
    documentElement: {
      style: { setProperty: (k, v) => { rootStyleProps[k] = v; } },
      setAttribute: () => {}
    },
    querySelector: (sel) => elements[sel] || null,
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { listeners[ev] = fn; },
    createElement: (tag) => makeEl(tag),
    body: { dataset: {}, prepend: () => {}, appendChild: () => {}, removeChild: () => {} }
  },
  localStorage: {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  },
  location: { hash: "#home" },
  navigator: { clipboard: { writeText: async () => {} } },
  fetch: async () => ({ ok: true, json: async () => ({ ok: true, bookings: [] }) }),
  Blob: class {},
  URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} },
  setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1,
  Date, Math, Number, String, Boolean, Array, Object, Set, JSON, RegExp, console, Uint32Array
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(appJs, sandbox);

const T = sandbox.__TEST__;
const S = T.getS();

// Original 6 Core Regression Tests
elements["#bp"].value = "9820011223";
elements["#bn"].value = "Rahul";
elements["#bpin"].value = "0000";
T.getBk().ty = "pc"; T.getBk().prefRig = "ANY"; T.getBk().h = 14; T.getBk().d = 2;
T.confirmBook("desk");
elements["#bp"].value = "9819397166";
elements["#bn"].value = "manish";
T.confirmBook("desk");
assert(S.book[0].stationId === "PC-1" && S.book[1].stationId === "PC-2", "Smart ANY station assignment prevents double-booking PC-1");

T.getBk().ty = "ps"; T.getBk().prefRig = "ANY";
T.confirmBook("desk");
const psBook = S.book[S.book.length - 1];
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "seat-booking-direct" : psBook.id }) } });
assert(T.panel().length > 1000, "PS5 seat-booking-direct renders active floor control panel()");

listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "tracker-start" : "PC-5" }) } });
assert(Boolean(S.rigs["PC-5"]), "tracker-start activates live stopwatch session on PC-5");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "tracker-checkout" : "PC-5" }) } });
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "commit-master-entry" : null }) } });
assert(!S.rigs["PC-5"], "tracker-checkout + commit-master-entry releases PC-5 back to Available");

const prevSnackLen = S.snackLog.length;
T.getCafeOrder().cart = { c4: 2 };
T.getCafeOrder().phone = "9820011223";
T.getCafeOrder().rigId = "STANDALONE";
T.submitCafeOrder("cash");
assert(S.snackLog.length > prevSnackLen, "Standalone Cooler order records sale into S.snackLog");

listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "adjust-denom" : k === "data-val" ? "500" : "10" }) } });
const hydrated = T.validateAndHydrateState(JSON.parse(storage["vz_mazgaon_v5_live"]));
assert(hydrated.cashDrawer?.notes?.[500] === 12, "Cash Drawer denomination state persists across localStorage reload");

T.login("staff");
elements["#owner-elevate-pin"].value = "";
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "elevate-owner-pin" : null }) } });
assert(T.getStaffRole() === "staff", "Blank Owner PIN input is rejected on elevate-owner-pin");

// Phase 16 & 17 Developer Control Panel & CMS Tests
T.go("developer");
assert(T.getDevOk() === false && elements["#app"].innerHTML.includes("Welcome to VOIDZONE"), "Developer CMS starts locked behind CCBoot-First authentication gate");

elements["#dev-user"].value = "admin_dev";
elements["#dev-pin"].value = "wrong_pin";
T.devLogin();
assert(T.getDevOk() === false, "Invalid Developer PIN is rejected");

elements["#dev-pin"].value = "9999";
T.devLogin();
assert(T.getDevOk() === true, "Valid Developer credentials unlock the Developer Control Panel");

for (const tab of ["overview", "branding", "theme", "pricing", "offers", "media", "pages", "nav", "publish", "security"]) {
  T.setDevSubTab(tab);
  T.render();
  assert(elements["#app"].innerHTML.length > 800, `Developer CMS tab [${tab}] renders cleanly`);
}

// Test Theme Preset switch
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "cms-apply-preset" : "crimson_valo" }) } });
assert(rootStyleProps["--ac"] === "#ff4655", "CMS Theme Preset updates CSS Custom Property --ac to #ff4655");

// Test Dynamic Pricing update (PC Peak 80 -> 90)
listeners.change({ target: { value: "90", closest: () => ({ value: "90", getAttribute: (k) => k === "data-action" ? "cms-price-input" : "pcPeak" }) } });
assert(T.getRate().pc[0] === 90 && T.getExcelPricing().standard.pcRate === 90, "CMS Pricing update dynamically updates both RATE.pc[0] and EXCEL_PRICING.standard.pcRate");

// Test Promo Offer creation & Booking Discount calculation
elements["#cms-offer-code"].value = "LAN30";
elements["#cms-offer-title"].value = "LAN 30% Off";
elements["#cms-offer-type"].value = "PERCENT";
elements["#cms-offer-val"].value = "30";
elements["#cms-offer-min"].value = "100";
elements["#cms-offer-max"].value = "300";
elements["#cms-offer-end"].value = "2027-12-31";
elements["#cms-offer-service"].value = "ALL";
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "cms-save-offer" : null }) } });
const promoRes = T.evaluatePromoOffer("LAN30", 200, "PC");
assert(promoRes.valid && promoRes.discountAmt === 60, "Newly created CMS promo code LAN30 calculates 30% discount (₹60 off ₹200)");

// Test Publish & Version Rollback
assert(T.computeDraftDiffCount() > 0, "Draft diff counter detects unpublished branding/theme/pricing changes");
elements["#cms-version-label"].value = "v2 Tournament Pricing";
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "cms-publish" : null }) } });
assert(T.computeDraftDiffCount() === 0 && T.ensureCmsState().versionNum === 2, "Publishing syncs draft to published and increments release version to v2");

listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "cms-restore-version" : "1" }) } });
assert(T.getRate().pc[0] === 80 && rootStyleProps["--ac"] === "#ff6b00", "1-Click Version Rollback to v1 restores baseline PC rate (₹80) and theme (#ff6b00)");


// Phase 12 — CCBoot Two-Mode System (Standalone, Integration, Mode Switching & Security) Tests
const cbState = T.ensureCcbootState();
assert(cbState.operatingMode === "STANDALONE" && cbState.connectionStatus === "STANDALONE_ACTIVE", "Default PC Infrastructure Mode is Mode A (STANDALONE) with zero CCBoot dependency");
assert(cbState.pcs.length === 22, "Standalone PC & Console Inventory tracks all 22 stations independently");

T.setDevSubTab("ccboot");
T.render();
assert(elements["#app"].innerHTML.includes("Two-Mode PC Infrastructure") && elements["#app"].innerHTML.includes("cp.icafecloud.com"), "Developer CMS renders PC Infra & CCBoot tab with cp.icafecloud.com reference");

// Test Independent Station Maintenance toggle in Standalone Mode
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-toggle-maint" : "PC-3" }) } });
assert(T.isStationInMaintenance("PC-3") === true, "Standalone maintenance toggle marks PC-3 as MAINTENANCE");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-toggle-maint" : "PC-3" }) } });
assert(T.isStationInMaintenance("PC-3") === false, "Standalone maintenance toggle restores PC-3 back to OPERATIONAL");

// Test Mode Switching: Standalone -> CCBoot Integration Mode
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-set-mode" : "CCBOOT_INTEGRATION" }) } });
assert(T.ensureCcbootState().operatingMode === "CCBOOT_INTEGRATION", "Mode switcher transitions cleanly to CCBOOT_INTEGRATION mode");

// Test saving CCBoot / iCafeCloud Settings & Credential Masking
elements["#cb-api-url"].value = "https://api.icafecloud.com";
elements["#cb-cafe-id"].value = "7777";
elements["#cb-api-token"].value = "icafe_secret_bearer_token_2026";
elements["#cb-whitelist-ip"].value = "203.0.113.50";
elements["#cb-timeout"].value = "4500";
elements["#cb-retries"].value = "2";
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-save-settings" : null }) } });
assert(
  T.ensureCcbootState().hasToken === true &&
  T.ensureCcbootState().apiTokenMasked === "icaf••••••••2026" &&
  !JSON.stringify(T.ensureCcbootState()).includes("icafe_secret_bearer_token_2026"),
  "Bearer API token is masked after saving and never stored or rendered in plaintext"
);

// Test Connection Check (verifies no fake connected clients are fabricated when server is unreachable)
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-test-connection" : null }) } });
assert(
  T.ensureCcbootState().pcs.every((p) => p.ccbootOnline === false),
  "Connection test does not fabricate simulated online CCBoot clients when live server is unverified"
);

// Test Safe Disconnect & Switching back to Standalone without data loss
const bookingsBeforeDisconnect = S.book.length;
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "ccboot-disconnect" : null }) } });
assert(
  T.ensureCcbootState().operatingMode === "STANDALONE" &&
  T.ensureCcbootState().hasToken === false &&
  T.ensureCcbootState().apiTokenMasked === "" &&
  S.book.length === bookingsBeforeDisconnect &&
  T.ensureCcbootState().pcs.length === 22,
  "Safe Disconnect clears credentials, reverts to STANDALONE mode, and preserves all VoidZone bookings and station records"
);


// ============================================================================
// CCBoot-First Authentication Gateway — 11 Mandatory Verification Tests
// ============================================================================
console.log("=== 4. CCBoot-First Authentication Gateway (11 Mandatory Security & Routing Tests) ===");

// Ensure clean starting session state
T.logoutAdminSession();

// Test 1: Staff cannot open the dashboard before CCBoot login
T.go("staff");
assert(
  T.hasValidAdminSession("staff") === false &&
  elements["#app"].innerHTML.includes("Welcome to VOIDZONE") &&
  elements["#app"].innerHTML.includes("Staff / Admin Login — Continue with CCBoot") &&
  !elements["#nav"].innerHTML.includes('data-view="staff"'),
  "1. Staff cannot open Staff Dashboard before CCBoot login (shows Welcome to VOIDZONE CCBoot gateway; nav link hidden)"
);

// Test 2: Owner cannot open the dashboard before CCBoot login
T.go("owner");
assert(
  T.hasValidAdminSession("owner") === false &&
  elements["#app"].innerHTML.includes("Welcome to VOIDZONE") &&
  elements["#app"].innerHTML.includes("Protected Route (<code>#owner</code>)"),
  "2. Owner cannot open Owner Dashboard before CCBoot login"
);

// Test 3: Developer cannot open the dashboard before CCBoot login
T.go("developer");
assert(
  T.hasValidAdminSession("developer") === false &&
  elements["#app"].innerHTML.includes("Welcome to VOIDZONE") &&
  elements["#app"].innerHTML.includes("Protected Route (<code>#developer</code>)") &&
  !elements["#nav"].innerHTML.includes('data-view="developer"'),
  "3. Developer cannot open Developer CMS before CCBoot login"
);

// Test 5: Invalid CCBoot credentials block administrative access
const badRes = T.authenticateCcbootFirst("7777", "ccboot_staff_mazgaon", "wrong_password_123");
assert(
  badRes.ok === false &&
  badRes.step === 1 &&
  T.hasValidAdminSession("staff") === false,
  "5. Invalid CCBoot credentials fail at Step 1 and block administrative access"
);

// Test 6: Unlinked CCBoot identities are denied at Step 2
const unlinkedRes = T.authenticateCcbootFirst("7777", "ccboot_unlinked_op", "ccboot_unlinked_2026");
assert(
  unlinkedRes.ok === false &&
  unlinkedRes.step === 2 &&
  unlinkedRes.step1Verified === true &&
  T.hasValidAdminSession("staff") === false,
  "6. Unlinked CCBoot identity (ccboot_unlinked_op) passes Step 1 but is strictly denied at Step 2 (UNLINKED_CCBOOT_IDENTITY)"
);

// Test 7 & Test 8: Customer login works without CCBoot and never activates the CCBoot bridge
elements["#si-id"].value = "9820011223";
elements["#si-pin"].value = "0000";
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "submit-signin" : null }) } });
assert(
  S.authSession?.phone === "9820011223" &&
  T.ensureAdminAuthGatewayState().bridge.active === false &&
  T.hasValidAdminSession("staff") === false,
  "7 & 8. Customer login succeeds independently without CCBoot and never activates the CCBoot infrastructure bridge"
);

// Test 9: Direct URL / route access by a logged-in Customer cannot bypass CCBoot authentication
T.go("developer");
assert(
  T.hasValidAdminSession("developer") === false &&
  elements["#app"].innerHTML.includes("Welcome to VOIDZONE"),
  "9. Direct URL/route navigation (#developer) while logged in as Customer cannot bypass CCBoot-first authentication"
);

// Test 4 (Part A - Staff): Valid CCBoot login + linked account routes to Staff Dashboard & stores only tokenHash
const staffAuth = T.authenticateCcbootFirst("7777", "ccboot_staff_mazgaon", "ccboot_staff_2026");
const gwAfterStaff = T.ensureAdminAuthGatewayState();
assert(
  staffAuth.ok === true &&
  staffAuth.role === "staff" &&
  staffAuth.destination === "staff" &&
  T.hasValidAdminSession("staff") === true &&
  T.hasValidAdminSession("owner") === false &&
  gwAfterStaff.bridge.active === true &&
  gwAfterStaff.sessionStore.every((s) => s.tokenHash.startsWith("vz$") && !("rawToken" in s)),
  "4a. Valid CCBoot Staff login (ccboot_staff_mazgaon) verifies linked account, stores only tokenHash, activates bridge, and routes to Staff Dashboard"
);

// Test 4 (Part B - Owner) & Test 11: Multiple authorized users share the CCBoot bridge safely
const ownerAuth = T.authenticateCcbootFirst("7777", "ccboot_owner_manish", "ccboot_owner_2026");
assert(
  ownerAuth.ok === true &&
  ownerAuth.role === "owner" &&
  ownerAuth.destination === "owner" &&
  T.hasValidAdminSession("owner") === true &&
  T.ensureAdminAuthGatewayState().bridge.activeOperators.length === 2,
  "4b & 11a. Valid CCBoot Owner login (ccboot_owner_manish) routes to Owner Dashboard and shares the active CCBoot bridge (2 concurrent sessions)"
);

// Test 4 (Part C - Developer): Valid CCBoot Developer login routes to Developer CMS
const devAuth = T.authenticateCcbootFirst("7777", "ccboot_dev_arch", "ccboot_dev_2026");
assert(
  devAuth.ok === true &&
  devAuth.role === "developer" &&
  devAuth.destination === "developer" &&
  T.hasValidAdminSession("developer") === true &&
  T.ensureAdminAuthGatewayState().bridge.activeOperators.length === 3,
  "4c. Valid CCBoot Developer login (ccboot_dev_arch) routes to Developer CMS and shares the active CCBoot bridge (3 concurrent sessions)"
);

// Test 10 & Test 11b: Logout invalidates current admin session while preserving the shared bridge for remaining active sessions
T.logoutAdminSession();
assert(
  T.hasValidAdminSession("developer") === false &&
  T.ensureAdminAuthGatewayState().bridge.active === true &&
  T.ensureAdminAuthGatewayState().bridge.activeOperators.length === 2,
  "10 & 11b. Logging out Developer revokes Developer session while preserving the shared CCBoot bridge for the 2 remaining Staff/Owner sessions"
);


// ============================================================================
// Title-to-Home & Swipe-to-Change-Tabs Navigation Tests
// ============================================================================
console.log("=== 5. Title-to-Home & Horizontal Swipe Tab Navigation Tests ===");
T.logoutAdminSession();
T.go("rewards");
assert(T.getView() === "rewards", "Navigated to #rewards tab before testing Title-to-Home");

// Test clicking the header title/logo (.logo / #hdr-logo-home) navigates directly to home
assert(!elements["#nav"].innerHTML.includes('data-view="home"'), "Top #nav bar omits redundant Home tab button because the VOIDZONE header title is used to go Home");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "title-go-home" : null }) } });
assert(T.getView() === "home", "Clicking the header VOIDZONE title (.logo) navigates directly back to #home");

// Test horizontal swipe-left (endX < startX) cycles forward through visible public tabs (home -> book -> cafe -> rewards -> home)
assert(JSON.stringify(T.getAuthorizedNavTabIds()) === JSON.stringify(["home", "book", "cafe", "esports", "rewards"]), "Unauthenticated swipe tab cycle includes only public tabs (home, book, cafe, esports, rewards)");
T.handleSwipeGesture(320, 200, 180, 205);
assert(T.getView() === "book", "Swiping left on #home switches to #book tab");
T.handleSwipeGesture(320, 200, 180, 205);
assert(T.getView() === "cafe", "Swiping left on #book switches to #cafe tab");
T.handleSwipeGesture(320, 200, 180, 205);
assert(T.getView() === "esports", "Swiping left on #cafe switches to #esports tab");
T.handleSwipeGesture(320, 200, 180, 205);
assert(T.getView() === "rewards", "Swiping left on #esports switches to #rewards tab");

// Test last-tab boundary clamping (swiping left on the last tab stays on #rewards without wrapping around)
T.handleSwipeGesture(320, 200, 180, 205);
assert(T.getView() === "rewards", "Swiping left at last tab boundary (#rewards) clamps cleanly without wrapping around");

// Test horizontal swipe-right (endX > startX) moves backward (rewards -> esports -> cafe)
T.handleSwipeGesture(150, 200, 300, 204);
assert(T.getView() === "esports", "Swiping right on #rewards switches back to #esports tab");
T.handleSwipeGesture(150, 200, 300, 204);
assert(T.getView() === "cafe", "Swiping right on #esports switches back to #cafe tab");

// Test vertical scroll does NOT trigger a horizontal tab swipe
T.handleSwipeGesture(200, 100, 215, 380);
assert(T.getView() === "cafe", "Vertical scroll gesture is ignored by horizontal tab swipe detector");


// ============================================================================
// Section 6. v9.0 Full Codebase Audit Remediations (Role-Aware Title Home, Strict RBAC Isolation, Esports Ecosystem)
// ============================================================================
console.log("=== 6. v9.0 Audit Remediation Tests (Role-Aware Title Home, Escalation Prevention & Esports Hub) ===");

// 6a. First-tab boundary clamping test: on #home, swiping right stays on #home
T.logoutAdminSession();
T.go("home");
T.handleSwipeGesture(120, 200, 300, 204);
assert(T.getView() === "home", "Swiping right at first tab boundary (#home) stays on #home without wrapping to last tab");

// 6b. Role-Aware VOIDZONE Brand Title Navigation (Section 24):
// Customer / Guest -> #home
T.go("cafe");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "title-go-home" : null }) } });
assert(T.getView() === "home", "Role-Aware Brand Title: Clicking VOIDZONE title as Customer/Guest routes to Customer Home (#home)");

// Staff -> #staff (without logging out or resetting CCBoot state)
T.authenticateCcbootFirst("7777", "ccboot_staff_mazgaon", "ccboot_staff_2026");
T.go("book");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "title-go-home" : null }) } });
assert(T.getView() === "staff" && T.hasValidAdminSession("staff") === true, "Role-Aware Brand Title: Clicking VOIDZONE title as Staff routes to Staff Home (#staff) and preserves session");

// Staff -> Owner escalation blocked
assert(T.hasValidAdminSession("owner") === false, "Strict RBAC Isolation: Staff session cannot escalate to Owner permissions");

// Owner -> #owner
T.authenticateCcbootFirst("7777", "ccboot_owner_manish", "ccboot_owner_2026");
T.go("cafe");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "title-go-home" : null }) } });
assert(T.getView() === "owner" && T.hasValidAdminSession("owner") === true, "Role-Aware Brand Title: Clicking VOIDZONE title as Owner routes to Owner Home (#owner)");

// Developer -> #developer & Developer -> Owner escalation blocked (SEC-01 fix)
T.authenticateCcbootFirst("7777", "ccboot_dev_arch", "ccboot_dev_2026");
assert(T.hasValidAdminSession("developer") === true && T.hasValidAdminSession("owner") === false, "Strict RBAC Isolation (SEC-01): Developer session is isolated to #developer and blocked from Owner P&L permissions");
T.go("rewards");
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "title-go-home" : null }) } });
assert(T.getView() === "developer" && T.hasValidAdminSession("developer") === true, "Role-Aware Brand Title: Clicking VOIDZONE title as Developer routes to Developer Home (#developer)");

// 6c. Esports, Academy & Creator Studio Hub (#esports) registration flow
T.go("esports");
assert(elements["#app"].innerHTML.includes("VoidZone Mumbai 5v5 Valorant LAN Cup") && elements["#app"].innerHTML.includes("Creator Studio Pod 1"), "#esports view renders Tournaments, Academy Coaching, and Creator Studio verticals");
const prevRegLen = T.ensureEsportsState().registrations.length;
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "register-esports-event" : "ESP-VALO-01" }) } });
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "enroll-academy-course" : "ACA-AIM-01" }) } });
listeners.click({ target: { closest: () => ({ getAttribute: (k) => k === "data-action" ? "book-creator-studio" : "CRE-POD-01" }) } });
assert(T.ensureEsportsState().registrations.length === prevRegLen + 3, "Tournament registration, Academy enrollment, and Creator Studio booking record cleanly into S.esports.registrations");

console.log(`\n=== TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
