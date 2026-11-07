-- ============================================================================
-- VoidZone Gaming Cafe - Production Cloudflare D1 Relational Schema & Seed Data
-- Strict RBAC Architecture: Customer, Staff (PIN 1234), Owner (PIN 9999)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Members Table (Player Authentication & Loyalty Vault)
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    member_account TEXT NOT NULL UNIQUE COLLATE NOCASE,
    member_phone TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    riot_id TEXT DEFAULT '',
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    pass_tier TEXT NOT NULL DEFAULT 'none' CHECK (pass_tier IN ('none', 'silver', 'gold', 'radiant')),
    pass_expires_at TEXT,
    wallet_balance REAL NOT NULL DEFAULT 0.0 CHECK (wallet_balance >= 0.0),
    bonus_hh_minutes INTEGER NOT NULL DEFAULT 0,
    spins_available INTEGER NOT NULL DEFAULT 1,
    drops_available INTEGER NOT NULL DEFAULT 0,
    shards_count INTEGER NOT NULL DEFAULT 0,
    cooler_coupons INTEGER NOT NULL DEFAULT 0,
    playtime_streak_days INTEGER NOT NULL DEFAULT 0,
    streak_shields INTEGER NOT NULL DEFAULT 1,
    kyc_verified INTEGER NOT NULL DEFAULT 0 CHECK (kyc_verified IN (0, 1)),
    kyc_doc_note TEXT DEFAULT 'Pending Desk KYC',
    visits INTEGER NOT NULL DEFAULT 0,
    total_hours REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Auth Sessions Table (Hashed Session Tokens, CCBoot Context & RBAC Roles)
CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL DEFAULT '',
    member_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'owner', 'developer')),
    ccboot_operator_id TEXT NOT NULL DEFAULT '',
    ccboot_cafe_id TEXT NOT NULL DEFAULT '',
    ccboot_verified INTEGER NOT NULL DEFAULT 0 CHECK (ccboot_verified IN (0, 1)),
    auth_mode TEXT NOT NULL DEFAULT 'WEBSITE_CUSTOMER',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Stations Table (Mazgaon Hardware Fleet: 16 PCs, 4 PS5s, 1 Racing Sim)
CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    branch TEXT NOT NULL DEFAULT 'MAZGAON' CHECK (branch IN ('MAZGAON', 'CHARNI_ROAD')),
    station_type TEXT NOT NULL CHECK (station_type IN ('PC', 'PS5', 'SIM', 'VR')),
    rig_name TEXT NOT NULL,
    hardware_specs TEXT NOT NULL,
    hourly_rate_peak REAL NOT NULL,
    hourly_rate_hh REAL NOT NULL,
    live_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (live_status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED')),
    current_customer TEXT DEFAULT '—',
    session_start_ms INTEGER DEFAULT 0
);

-- 4. Master Log Table (Sheet 1 & Sheet 13: 21-Column Transactional & Floor History Ledger)
CREATE TABLE IF NOT EXISTS master_log (
    tx_id TEXT PRIMARY KEY,
    session_date TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    time_in TEXT DEFAULT '',
    time_out TEXT DEFAULT '',
    total_hr REAL NOT NULL DEFAULT 0.0,
    console_id TEXT DEFAULT '',
    category TEXT DEFAULT 'Standard',
    controllers INTEGER NOT NULL DEFAULT 1,
    game_charges REAL NOT NULL DEFAULT 0.0,
    snacks REAL NOT NULL DEFAULT 0.0,
    total_bill REAL NOT NULL DEFAULT 0.0,
    cash REAL NOT NULL DEFAULT 0.0,
    upi REAL NOT NULL DEFAULT 0.0,
    wallet REAL NOT NULL DEFAULT 0.0,
    total_received REAL NOT NULL DEFAULT 0.0,
    balance_due REAL NOT NULL DEFAULT 0.0,
    cash_given REAL NOT NULL DEFAULT 0.0,
    change_to_return REAL NOT NULL DEFAULT 0.0,
    wallet_status TEXT NOT NULL DEFAULT '✅ Paid',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_master_log_date ON master_log(session_date);
CREATE INDEX IF NOT EXISTS idx_master_log_console ON master_log(console_id, session_date, time_in, time_out);

-- 5. Snack Log Table (Sheet 2: Itemized F&B Sales)
CREATE TABLE IF NOT EXISTS snack_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_id TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    snack_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    total_cost REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Inventory Table (Sheet 8: F&B Stock & Reorder Thresholds)
CREATE TABLE IF NOT EXISTS inventory (
    item_name TEXT PRIMARY KEY,
    sell_price REAL NOT NULL,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_sold INTEGER NOT NULL DEFAULT 0,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10
);

-- 7. Wallet Top-Ups Table (Sheet 3 & Sheet 4: Deposits & Cash Bonus %)
CREATE TABLE IF NOT EXISTS wallet_topups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deposit_date TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    amount_deposited REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'UPI',
    bonus_pct REAL NOT NULL DEFAULT 0.0,
    bonus_amount REAL NOT NULL DEFAULT 0.0,
    total_credited REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. OpEx Ledger Table (Sheet 5 & Sheet 10: Operating Expenses)
CREATE TABLE IF NOT EXISTS opex_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL,
    expense_category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Customer Directory Table (Sheet 12: Customer Details Dashboard)
CREATE TABLE IF NOT EXISTS customer_directory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    membership_tier TEXT NOT NULL DEFAULT 'Non-Member',
    UNIQUE(customer_name, phone)
);

-- ============================================================================
-- Seed Data from Master_Calculator_Hardened.xlsx
-- ============================================================================

INSERT OR IGNORE INTO stations (id, branch, station_type, rig_name, hardware_specs, hourly_rate_peak, hourly_rate_hh) VALUES
('PC-1', 'MAZGAON', 'PC', 'Rig 01 [VIP Alpha]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-2', 'MAZGAON', 'PC', 'Rig 02 [VIP Bravo]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-3', 'MAZGAON', 'PC', 'Rig 03 [Stage Main]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-4', 'MAZGAON', 'PC', 'Rig 04 [Stage Wing]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-5', 'MAZGAON', 'PC', 'Rig 05 [Stage Mid]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-6', 'MAZGAON', 'PC', 'Rig 06 [Stage Anchor]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 240Hz Zowie', 80.0, 60.0),
('PC-7', 'MAZGAON', 'PC', 'Rig 07 [Arena A1]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 180Hz BenQ', 80.0, 60.0),
('PC-8', 'MAZGAON', 'PC', 'Rig 08 [Arena A2]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 180Hz BenQ', 80.0, 60.0),
('PC-9', 'MAZGAON', 'PC', 'Rig 09 [Arena A3]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 180Hz BenQ', 80.0, 60.0),
('PC-10', 'MAZGAON', 'PC', 'Rig 10 [Arena A4]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 180Hz BenQ', 80.0, 60.0),
('PC-11', 'MAZGAON', 'PC', 'Rig 11 [Squad B1]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PC-12', 'MAZGAON', 'PC', 'Rig 12 [Squad B2]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PC-13', 'MAZGAON', 'PC', 'Rig 13 [Squad B3]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PC-14', 'MAZGAON', 'PC', 'Rig 14 [Squad B4]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PC-15', 'MAZGAON', 'PC', 'Rig 15 [Squad B5]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PC-16', 'MAZGAON', 'PC', 'Rig 16 [Streamer Pod]', 'i5-14400F · RTX 4060 · Dual 240Hz · Shure Mic', 80.0, 60.0),
('PC-17', 'MAZGAON', 'PC', 'Rig 17 [Squad B6]', 'i5-14400F · RTX 4060 · 32GB DDR5 · 165Hz Asus', 80.0, 60.0),
('PS-1', 'MAZGAON', 'PS5', 'PS5 Lounge Pod 1', 'Sony PS5 · 55" 4K OLED 120Hz · 4x DualSense', 100.0, 80.0),
('PS-2', 'MAZGAON', 'PS5', 'PS5 Lounge Pod 2', 'Sony PS5 · 55" 4K OLED 120Hz · 4x DualSense', 100.0, 80.0),
('PS-3', 'MAZGAON', 'PS5', 'PS5 Private Pod 3', 'Sony PS5 · 65" Sony Bravia 120Hz · 4x DualSense Edge', 100.0, 80.0),
('PS-4', 'MAZGAON', 'PS5', 'PS5 Arena Pod 4', 'Sony PS5 · 55" Samsung Neo QLED · 4x DualSense', 100.0, 80.0),
('SIM-1', 'MAZGAON', 'SIM', 'Racing Simulator Cockpit', 'Fanatec Podium DD2 · ClubSport V3 · Triple 32" + PSVR2', 200.0, 150.0);

INSERT OR IGNORE INTO members (id, member_account, member_phone, full_name, email, riot_id, pin_salt, pin_hash, pass_tier, wallet_balance, playtime_streak_days, kyc_verified, kyc_doc_note) VALUES
('ICF-1001', 'rahul_vz', '9820011223', 'Rahul', 'rahul.esports@gmail.com', 'Rahul#VZ01', 'vz_9820011223', '0000', 'none', 1880.0, 4, 1, 'Aadhaar Last-4 (4821)'),
('ICF-1002', 'manish_vz', '9819397166', 'manish', 'manishjaryan@gmail.com', 'manish#VZ02', 'vz_9819397166', '0000', 'silver', 400.0, 3, 1, 'College ID Verified'),
('ICF-1003', 'amit_vz', '9820044556', 'Amit', 'amit@gmail.com', 'Amit#VZ03', 'vz_9820044556', '0000', 'none', 0.0, 1, 0, 'Pending Desk KYC'),
('ICF-1004', 'suresh_vz', '9833011221', 'Suresh', 'suresh@gmail.com', 'Suresh#VZ04', 'vz_9833011221', '0000', 'none', 0.0, 1, 0, 'Pending Desk KYC'),
('ICF-1005', 'group_a', '9800000001', 'Group_A', 'groupa@gmail.com', 'GroupA#VZ05', 'vz_9800000001', '0000', 'none', 0.0, 1, 1, 'Tournament Squad'),
('ICF-1006', 'player_5', '9800000002', 'Player_5', 'player5@gmail.com', 'Player5#VZ06', 'vz_9800000002', '0000', 'none', 0.0, 1, 0, 'Pending Desk KYC'),
('ICF-1007', 'makdn_vz', '4864548845', 'Makdn', 'makdn@gmail.com', 'Makdn#VZ07', 'vz_4864548845', '0000', 'none', 0.0, 1, 0, 'Pending Desk KYC'),
('ICF-1008', 'manish_2', '9819394511', 'manish', 'manish2@gmail.com', 'manish#VZ08', 'vz_9819394511', '0000', 'none', 0.0, 1, 0, 'Pending Desk KYC');

INSERT OR IGNORE INTO master_log (tx_id, session_date, customer_name, phone, time_in, time_out, total_hr, console_id, category, controllers, game_charges, snacks, total_bill, cash, upi, wallet, total_received, balance_due, cash_given, change_to_return, wallet_status) VALUES
('20260318001', '2026-03-18', 'Rahul', '9820011223', '11:20:00', '16:20:00', 5.0, 'PC-1', 'Split Time', 0, 350.0, 120.0, 470.0, 0.0, 0.0, 120.0, 120.0, 350.0, 0.0, 0.0, '✅ Paid'),
('20260321001', '2026-03-21', 'manish', '9819397166', '00:33:00', '02:33:00', 2.0, 'PC-3', 'Standard', 1, 160.0, 0.0, 160.0, 120.0, 40.0, 0.0, 160.0, 0.0, 120.0, 0.0, '✅ Paid'),
('20260321002', '2026-03-21', 'rahul', '9820011223', '10:12:00', '12:05:00', 1.8833, 'PS-1', 'Happy Hr', 4, 640.0, 0.0, 640.0, 500.0, 140.0, 0.0, 640.0, 0.0, 500.0, 0.0, '✅ Paid'),
('20260322001', '2026-03-22', 'manish', '', '', '', 0.0, '', '', 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, '✅ Paid'),
('20260313001', '2026-03-13', 'rahul', '9820011223', '00:33:00', '02:33:00', 2.0, 'PC-5', 'Standard', 1, 160.0, 0.0, 160.0, 0.0, 0.0, 0.0, 0.0, 160.0, 0.0, 0.0, '✅ Paid'),
('20260321003', '2026-03-21', 'manish', '', '', '', 0.0, 'PS-3', '', 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, '✅ Paid');

INSERT OR IGNORE INTO snack_log (tx_id, sale_date, snack_name, qty, unit_price, total_cost) VALUES
('20260318001', '2026-03-18', 'Maggi', 2, 60.0, 120.0);

INSERT OR IGNORE INTO inventory (item_name, sell_price, total_purchased, total_sold, current_stock, reorder_level) VALUES
('diet coke', 50.0, 100, 0, 100, 20),
('Maggi', 60.0, 50, 2, 48, 10);

INSERT OR IGNORE INTO wallet_topups (deposit_date, customer_name, phone, amount_deposited, payment_method, bonus_pct, bonus_amount, total_credited) VALUES
('2026-03-18', 'Rahul', '9820011223', 2000.0, 'UPI', 0.0, 0.0, 2000.0);

INSERT OR IGNORE INTO opex_ledger (expense_date, expense_category, description, amount) VALUES
('2026-03-18', 'Electricity', 'Commercial Power', 25000.0);

INSERT OR IGNORE INTO customer_directory (customer_name, phone, membership_tier) VALUES
('Rahul', '9820011223', 'Tier 1'),
('manish', '9819397166', 'Non-Member'),
('manish', 'No Phone', 'Non-Member'),
('Amit', '9820044556', 'Non-Member'),
('Suresh', '9833011221', 'Non-Member'),
('Group_A', '9800000001', 'Non-Member'),
('Player_5', '9800000002', 'Non-Member'),
('Makdn', '4864548845', 'Non-Member'),
('manish', '9819394511', 'Non-Member');

-- 10. CASH_DRAWER_LEDGER TABLE (Physical Till Count & Shift Variance Snapshots)
CREATE TABLE IF NOT EXISTS cash_drawer_ledger (
  id TEXT PRIMARY KEY,
  snapshot_ts TEXT NOT NULL,
  staff_id TEXT NOT NULL DEFAULT 'STAFF_1234',
  opening_float REAL NOT NULL DEFAULT 2000,
  cash_received REAL NOT NULL DEFAULT 0,
  cash_payouts REAL NOT NULL DEFAULT 0,
  physical_cash REAL NOT NULL DEFAULT 0,
  expected_cash REAL NOT NULL DEFAULT 0,
  discrepancy REAL NOT NULL DEFAULT 0,
  notes_json TEXT NOT NULL DEFAULT '{}',
  notes_remark TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_ts ON cash_drawer_ledger(snapshot_ts);

-- SEED CASH DRAWER SHIFT SNAPSHOT
INSERT OR IGNORE INTO cash_drawer_ledger (id, snapshot_ts, staff_id, opening_float, cash_received, cash_payouts, physical_cash, expected_cash, discrepancy, notes_json, notes_remark)
VALUES ('TILL-20260318-01', '2026-03-18 23:55:00', 'STAFF_1234', 2000, 120, 0, 2120, 2120, 0, '{"500":2,"200":2,"100":5,"50":2,"20":4,"10":2,"5":2,"2":3,"1":4}', 'Shift handover balanced.');


-- ============================================================================
-- 11. CMS SETTINGS TABLE (Published & Draft Website Identity, Theme, Pricing & Content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_settings (
  config_key TEXT PRIMARY KEY,
  published_json TEXT NOT NULL DEFAULT '{}',
  draft_json TEXT NOT NULL DEFAULT '{}',
  version_num INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT 'DEV_ADMIN',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- 12. CMS VERSION HISTORY TABLE (Snapshots for 1-Click Rollback)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_label TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  published_by TEXT NOT NULL DEFAULT 'DEV_ADMIN',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- 13. CMS OFFERS & PROMOTIONS TABLE (Server-Enforced Coupons & Discounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_offers (
  code TEXT PRIMARY KEY COLLATE NOCASE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT NOT NULL DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'FLAT')),
  discount_value REAL NOT NULL DEFAULT 10.0,
  min_bill REAL NOT NULL DEFAULT 0.0,
  max_discount REAL NOT NULL DEFAULT 500.0,
  eligible_service TEXT NOT NULL DEFAULT 'ALL',
  start_date TEXT NOT NULL DEFAULT '2026-01-01',
  end_date TEXT NOT NULL DEFAULT '2027-12-31',
  usage_limit INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  featured INTEGER NOT NULL DEFAULT 1 CHECK (featured IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- 14. CMS DEVELOPER AUDIT LOG TABLE (Security & Configuration Activity History)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cms_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO cms_offers (code, title, description, discount_type, discount_value, min_bill, max_discount, eligible_service, start_date, end_date, usage_limit, used_count, active, featured) VALUES
('VOID20', 'Launch 20% Off Promo', '20% off any PC, PS5, or Sim booking (up to ₹200)', 'PERCENT', 20.0, 100.0, 200.0, 'ALL', '2026-01-01', '2027-12-31', 500, 0, 1, 1),
('SQUAD50', 'Flat ₹50 Off Squad Session', 'Flat ₹50 off bookings of ₹250 or more', 'FLAT', 50.0, 250.0, 50.0, 'ALL', '2026-01-01', '2027-12-31', 200, 0, 1, 0);


-- ============================================================================
-- 15. CCBOOT / ICAFECLOUD INTEGRATION CONFIGURATION TABLE (Two-Mode Architecture)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ccboot_config (
  config_key TEXT PRIMARY KEY,
  operating_mode TEXT NOT NULL DEFAULT 'STANDALONE' CHECK (operating_mode IN ('STANDALONE', 'CCBOOT_INTEGRATION')),
  cp_portal_url TEXT NOT NULL DEFAULT 'https://cp.icafecloud.com',
  api_base_url TEXT NOT NULL DEFAULT 'https://api.icafecloud.com',
  cafe_id TEXT NOT NULL DEFAULT '',
  api_token_masked TEXT NOT NULL DEFAULT '',
  has_token INTEGER NOT NULL DEFAULT 0 CHECK (has_token IN (0, 1)),
  timeout_ms INTEGER NOT NULL DEFAULT 5000,
  max_retries INTEGER NOT NULL DEFAULT 2,
  feature_flags_json TEXT NOT NULL DEFAULT '{"enableConnection":false,"syncClientStatus":true,"syncPcInfo":true,"syncMaintenanceStatus":true,"syncManagementReporting":false}',
  connection_status TEXT NOT NULL DEFAULT 'STANDALONE_ACTIVE',
  last_sync_at TEXT DEFAULT '',
  last_error TEXT DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'DEV_ADMIN',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ccboot_config (
  config_key, operating_mode, cp_portal_url, api_base_url, cafe_id, api_token_masked, has_token, timeout_ms, max_retries, connection_status
) VALUES (
  'main', 'STANDALONE', 'https://cp.icafecloud.com', 'https://api.icafecloud.com', '', '', 0, 5000, 2, 'STANDALONE_ACTIVE'
);

-- ============================================================================
-- 16. GAMING PC & CONSOLE INFRASTRUCTURE INVENTORY TABLE (Standalone + CCBoot Sync)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ccboot_pcs (
  station_id TEXT PRIMARY KEY,
  zone_name TEXT NOT NULL DEFAULT 'Pro Esports Zone',
  console_type TEXT NOT NULL DEFAULT 'PC' CHECK (console_type IN ('PC', 'PS5', 'SIM')),
  ip_address TEXT NOT NULL DEFAULT '192.168.10.101',
  mac_address TEXT NOT NULL DEFAULT '00-E0-4C-68-01-01',
  hardware_profile TEXT NOT NULL DEFAULT 'Intel Core i5-14400F · RTX 4060 8GB · 16GB DDR5 · 240Hz',
  boot_mode TEXT NOT NULL DEFAULT 'LOCAL_NVME' CHECK (boot_mode IN ('LOCAL_NVME', 'PXE_ISCSI', 'HYBRID', 'CONSOLE_OS')),
  boot_image_name TEXT NOT NULL DEFAULT 'VZ-Win11-24H2-Esports-v4.vhd',
  writeback_status TEXT NOT NULL DEFAULT 'HEALTHY (Local NVMe)',
  installed_games_json TEXT NOT NULL DEFAULT '["Valorant 9.08","CS2 1.40.4","Dota 2 7.37d","Apex Legends S22","GTA V"]',
  maintenance_status TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (maintenance_status IN ('OPERATIONAL', 'MAINTENANCE', 'LOGIN_LOCKED')),
  issue_notes TEXT NOT NULL DEFAULT '',
  ccboot_online INTEGER NOT NULL DEFAULT 0 CHECK (ccboot_online IN (0, 1)),
  last_maintained_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ccboot_pcs (station_id, zone_name, console_type, ip_address, mac_address, hardware_profile, boot_mode, boot_image_name, writeback_status, maintenance_status) VALUES
('PC-1',  'Pro Arena Row A', 'PC',  '192.168.10.101', '5A-9A-9B-26-01-01', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-2',  'Pro Arena Row A', 'PC',  '192.168.10.102', '5A-9A-9B-26-01-02', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-3',  'Pro Arena Row A', 'PC',  '192.168.10.103', '5A-9A-9B-26-01-03', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-4',  'Pro Arena Row A', 'PC',  '192.168.10.104', '5A-9A-9B-26-01-04', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-5',  'Pro Arena Row A', 'PC',  '192.168.10.105', '5A-9A-9B-26-01-05', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-6',  'Pro Arena Row B', 'PC',  '192.168.10.106', '5A-9A-9B-26-01-06', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-7',  'Pro Arena Row B', 'PC',  '192.168.10.107', '5A-9A-9B-26-01-07', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz Zowie', 'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-8',  'Squad 5v5 Pod',   'PC',  '192.168.10.108', '5A-9A-9B-26-01-08', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-9',  'Squad 5v5 Pod',   'PC',  '192.168.10.109', '5A-9A-9B-26-01-09', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-10', 'Squad 5v5 Pod',   'PC',  '192.168.10.110', '5A-9A-9B-26-01-10', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-11', 'Squad 5v5 Pod',   'PC',  '192.168.10.111', '5A-9A-9B-26-01-11', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-12', 'Squad 5v5 Pod',   'PC',  '192.168.10.112', '5A-9A-9B-26-01-12', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-13', 'Squad 5v5 Pod',   'PC',  '192.168.10.113', '5A-9A-9B-26-01-13', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-14', 'Squad 5v5 Pod',   'PC',  '192.168.10.114', '5A-9A-9B-26-01-14', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-15', 'Squad 5v5 Pod',   'PC',  '192.168.10.115', '5A-9A-9B-26-01-15', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-16', 'Squad 5v5 Pod',   'PC',  '192.168.10.116', '5A-9A-9B-26-01-16', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PC-17', 'Squad 5v5 Pod',   'PC',  '192.168.10.117', '5A-9A-9B-26-01-17', 'i5-14400F · RTX 4060 · 16GB DDR5 · 240Hz BenQ',  'LOCAL_NVME', 'VZ-Win11-24H2-Esports-v4.vhd', 'HEALTHY', 'OPERATIONAL'),
('PS-1',  'PS5 Bean Bag Lounge', 'PS5', '192.168.10.201', '7C-BB-8A-11-02-01', 'Sony PlayStation 5 Disc · 4K 120Hz OLED · 4 DualSense', 'CONSOLE_OS', 'PS5-System-FW-Latest', 'HEALTHY', 'OPERATIONAL'),
('PS-2',  'PS5 Bean Bag Lounge', 'PS5', '192.168.10.202', '7C-BB-8A-11-02-02', 'Sony PlayStation 5 Disc · 4K 120Hz OLED · 4 DualSense', 'CONSOLE_OS', 'PS5-System-FW-Latest', 'HEALTHY', 'OPERATIONAL'),
('PS-3',  'PS5 Bean Bag Lounge', 'PS5', '192.168.10.203', '7C-BB-8A-11-02-03', 'Sony PlayStation 5 Disc · 4K 120Hz OLED · 4 DualSense', 'CONSOLE_OS', 'PS5-System-FW-Latest', 'HEALTHY', 'OPERATIONAL'),
('PS-4',  'PS5 Bean Bag Lounge', 'PS5', '192.168.10.204', '7C-BB-8A-11-02-04', 'Sony PlayStation 5 Disc · 4K 120Hz OLED · 4 DualSense', 'CONSOLE_OS', 'PS5-System-FW-Latest', 'HEALTHY', 'OPERATIONAL'),
('SIM-1', 'Racing Sim Cockpit',  'SIM', '192.168.10.210', '7C-BB-8A-11-03-01', 'GT-Racer Cockpit · Force-Feedback Wheel + Pedals + PS VR2', 'CONSOLE_OS', 'PS5-GT7-VR2-Build', 'HEALTHY', 'OPERATIONAL');

-- ============================================================================
-- 17. CCBOOT / ICAFECLOUD INTEGRATION & INFRASTRUCTURE TELEMETRY LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS ccboot_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  operating_mode TEXT NOT NULL DEFAULT 'STANDALONE',
  endpoint TEXT NOT NULL DEFAULT 'LOCAL',
  status_code INTEGER NOT NULL DEFAULT 200,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ============================================================================
-- 18. CCBOOT OPERATOR LINKS & APPLICATION RBAC TABLE (CCBoot-First Auth Gateway)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ccboot_operator_links (
  ccboot_operator_id TEXT PRIMARY KEY COLLATE NOCASE,
  cafe_id TEXT NOT NULL DEFAULT '7777',
  pass_salt TEXT NOT NULL DEFAULT 'vz_ccboot_op_salt_v8',
  pass_hash TEXT NOT NULL,
  linked_member_id TEXT NOT NULL DEFAULT '',
  app_username TEXT NOT NULL DEFAULT '',
  assigned_role TEXT NOT NULL DEFAULT 'unlinked' CHECK (assigned_role IN ('staff', 'owner', 'developer', 'unlinked')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  is_linked INTEGER NOT NULL DEFAULT 0 CHECK (is_linked IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SECURITY (Phase 0b): no seeded operator accounts. Create real ones with scripts/create-operator.mjs (hashed password).

-- ============================================================================
-- 19. ESPORTS TOURNAMENTS, ACADEMY & CREATOR STUDIO ECOSYSTEM TABLE (v9.0)
-- ============================================================================
CREATE TABLE IF NOT EXISTS esports_ecosystem (
  id TEXT PRIMARY KEY,
  vertical_type TEXT NOT NULL CHECK (vertical_type IN ('TOURNAMENT', 'ACADEMY', 'CREATOR_STUDIO')),
  title TEXT NOT NULL,
  game_or_track TEXT NOT NULL,
  schedule_label TEXT NOT NULL,
  fee_inr REAL NOT NULL DEFAULT 0.0,
  prize_or_benefit TEXT NOT NULL DEFAULT '',
  slots_total INTEGER NOT NULL DEFAULT 16,
  slots_filled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULL', 'COMPLETED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO esports_ecosystem (id, vertical_type, title, game_or_track, schedule_label, fee_inr, prize_or_benefit, slots_total, slots_filled, status) VALUES
('ESP-VALO-01', 'TOURNAMENT',     'VoidZone Mumbai 5v5 Valorant LAN Cup', 'Valorant (Riot Direct <5ms)', 'Every Sunday · 2:00 PM IST', 500.0, '₹25,000 Prize Pool + Radiant Shards', 16, 12, 'OPEN'),
('ESP-CS2-02',  'TOURNAMENT',     'CS2 2v2 Wingman Premier Showdown',      'Counter-Strike 2 (240Hz Zowie)', 'Every Friday · 6:00 PM IST', 200.0, '₹10,000 Prize Pool + Free HH Pass', 16, 10, 'OPEN'),
('ACA-AIM-01',  'ACADEMY',        'Radiant FPS Mechanics & VOD Bootcamp',  'Valorant & CS2 Pro Coaching', 'Tue / Thu / Sat · 4:00 PM – 6:00 PM', 999.0, '1-on-1 Immortal/Radiant Coach + Cert', 10, 6, 'OPEN'),
('CRE-POD-01',  'CREATOR_STUDIO', 'Dual-PC 4K60 Creator & Streamer Booth', 'OBS Studio + Elgato 4K + Shure SM7B', 'Daily · 10:00 AM – 2:00 AM', 250.0, 'Isolated Acoustic Pod + Fiber Upload', 4, 1, 'OPEN');

-- ============================================================================
-- COMPOSITE PERFORMANCE INDEXES (v9.0 Database Audit Remediation)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_auth_sessions_lookup ON auth_sessions(token_hash, revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_members_account ON members(member_account);
CREATE INDEX IF NOT EXISTS idx_snack_log_date_tx ON snack_log(sale_date, tx_id);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_date_phone ON wallet_topups(deposit_date, phone);
CREATE INDEX IF NOT EXISTS idx_opex_ledger_date ON opex_ledger(expense_date);
CREATE INDEX IF NOT EXISTS idx_ccboot_pcs_maint ON ccboot_pcs(maintenance_status);

-- Phase 0b: login/signup rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  rl_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rl_key, window_start)
);
