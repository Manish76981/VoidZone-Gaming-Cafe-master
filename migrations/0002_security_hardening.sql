-- Phase 0b. REVIEW BEFORE APPLYING TO PRODUCTION.
-- 1) Rate-limit table (required: login endpoints fail closed without it).
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rl_key, window_start)
);
-- 2) Disable the publicly-known seeded operator accounts (their passwords were committed in plaintext).
--    Create real ones with: node scripts/create-operator.mjs <id> <role> <linked_member_id> <app_username>
UPDATE ccboot_operator_links SET active = 0
 WHERE ccboot_operator_id IN ('ccboot_staff_mazgaon','ccboot_owner_manish','ccboot_dev_arch','ccboot_unlinked_op');
-- 3) Revoke every existing admin session.
UPDATE auth_sessions SET revoked = 1 WHERE role IN ('staff','owner','developer');
