// Usage: HMAC_PEPPER=... node scripts/create-operator.mjs <operator_id> <staff|owner|developer> <linked_member_id> <app_username> [cafe_id]
// Prompts for the password (not echoed into shell history), prints an INSERT with an HMAC hash. Run the SQL with wrangler d1 execute.
import { createInterface } from "node:readline";
import { webcrypto as crypto } from "node:crypto";
const [id, role, member, user, cafe = "7777"] = process.argv.slice(2);
const pepper = process.env.HMAC_PEPPER;
if (!id || !["staff","owner","developer"].includes(role) || !member || !user || !pepper) { console.error("Usage: HMAC_PEPPER=... node scripts/create-operator.mjs <id> <staff|owner|developer> <member_id> <username> [cafe]"); process.exit(1); }
const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question("New password (min 12 chars): ", async (pw) => {
  rl.close();
  if (pw.length < 12) { console.error("Too short."); process.exit(1); }
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${salt}:${pw}`));
  const hash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  console.log(`INSERT OR REPLACE INTO ccboot_operator_links (ccboot_operator_id, cafe_id, pass_salt, pass_hash, linked_member_id, app_username, assigned_role, permissions_json, is_linked, active) VALUES (${q(id.toLowerCase())}, ${q(cafe)}, ${q(salt)}, ${q(hash)}, ${q(member)}, ${q(user)}, ${q(role)}, '[]', 1, 1);`);
});
