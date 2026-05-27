-- ============================================================
-- BetWithFriends — Full DB reset + schema + WC2026 seed
-- Run this in the Cloudflare D1 console (or via wrangler)
-- WARNING: drops ALL data
-- ============================================================

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS notification_prefs;
DROP TABLE IF EXISTS notification_deliveries;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS special_bets;
DROP TABLE IF EXISTS bets;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS top_scorers;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Groups
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch())
);

-- Group members
CREATE TABLE group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  pseudo TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  total_points REAL DEFAULT 0,
  joined_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(group_id, user_id),
  UNIQUE(group_id, pseudo)
);

-- Matches
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  api_match_id TEXT UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_code TEXT,
  away_team_code TEXT,
  match_date INTEGER NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'scheduled',
  stage TEXT,
  group_name TEXT,
  stadium TEXT,
  venue_city TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Top scorers
CREATE TABLE top_scorers (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_code TEXT NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  penalties INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(player_name, team_code)
);

-- Bets
CREATE TABLE bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  match_id TEXT NOT NULL REFERENCES matches(id),
  home_score_pred INTEGER NOT NULL,
  away_score_pred INTEGER NOT NULL,
  confidence TEXT,
  double_up INTEGER DEFAULT 0,
  points_earned REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, group_id, match_id)
);

-- Special bets
CREATE TABLE special_bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  bet_type TEXT NOT NULL,
  bet_value TEXT NOT NULL,
  points_earned REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, group_id, bet_type)
);

-- Push subscriptions
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  subscription_json TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Notification prefs
CREATE TABLE notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  remind_before_game INTEGER DEFAULT 1,
  result_after_game INTEGER DEFAULT 1
);

CREATE TABLE notification_deliveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  match_id TEXT NOT NULL REFERENCES matches(id),
  delivery_type TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, match_id, delivery_type)
);

-- Indexes
CREATE INDEX idx_bets_match ON bets(match_id);
CREATE INDEX idx_bets_user_group ON bets(user_id, group_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_notification_deliveries_match ON notification_deliveries(match_id, delivery_type);

-- ============================================================
-- WC 2026 Group Stage Fixtures seed
-- ============================================================

INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a1', 'seed-801', 'Mexico', 'Ecuador', 'MEX', 'ECU', 1781294400, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a2', 'seed-802', 'USA', 'Cameroon', 'USA', 'CMR', 1781298000, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a3', 'seed-803', 'Mexico', 'USA', 'MEX', 'USA', 1781726400, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a4', 'seed-804', 'Ecuador', 'Cameroon', 'ECU', 'CMR', 1781730000, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a5', 'seed-805', 'Mexico', 'Cameroon', 'MEX', 'CMR', 1782158400, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-a6', 'seed-806', 'Ecuador', 'USA', 'ECU', 'USA', 1782158400, 'scheduled', 'group', 'A');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b1', 'seed-807', 'Spain', 'Morocco', 'ESP', 'MAR', 1781283600, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b2', 'seed-808', 'Japan', 'New Zealand', 'JPN', 'NZL', 1781287200, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b3', 'seed-809', 'Spain', 'Japan', 'ESP', 'JPN', 1781715600, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b4', 'seed-810', 'Morocco', 'New Zealand', 'MAR', 'NZL', 1781719200, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b5', 'seed-811', 'Spain', 'New Zealand', 'ESP', 'NZL', 1782147600, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-b6', 'seed-812', 'Morocco', 'Japan', 'MAR', 'JPN', 1782147600, 'scheduled', 'group', 'B');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c1', 'seed-813', 'France', 'Denmark', 'FRA', 'DEN', 1781380800, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c2', 'seed-814', 'Nigeria', 'Uruguay', 'NGA', 'URU', 1781384400, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c3', 'seed-815', 'France', 'Nigeria', 'FRA', 'NGA', 1781812800, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c4', 'seed-816', 'Denmark', 'Uruguay', 'DEN', 'URU', 1781816400, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c5', 'seed-817', 'France', 'Uruguay', 'FRA', 'URU', 1782244800, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-c6', 'seed-818', 'Denmark', 'Nigeria', 'DEN', 'NGA', 1782244800, 'scheduled', 'group', 'C');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d1', 'seed-819', 'England', 'Poland', 'ENG', 'POL', 1781370000, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d2', 'seed-820', 'Argentina', 'Peru', 'ARG', 'PER', 1781373600, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d3', 'seed-821', 'England', 'Argentina', 'ENG', 'ARG', 1781802000, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d4', 'seed-822', 'Poland', 'Peru', 'POL', 'PER', 1781805600, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d5', 'seed-823', 'England', 'Peru', 'ENG', 'PER', 1782234000, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-d6', 'seed-824', 'Poland', 'Argentina', 'POL', 'ARG', 1782234000, 'scheduled', 'group', 'D');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e1', 'seed-825', 'Brazil', 'Germany', 'BRA', 'GER', 1781467200, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e2', 'seed-826', 'Switzerland', 'Saudi Arabia', 'SUI', 'KSA', 1781470800, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e3', 'seed-827', 'Brazil', 'Switzerland', 'BRA', 'SUI', 1781899200, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e4', 'seed-828', 'Germany', 'Saudi Arabia', 'GER', 'KSA', 1781902800, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e5', 'seed-829', 'Brazil', 'Saudi Arabia', 'BRA', 'KSA', 1782331200, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-e6', 'seed-830', 'Germany', 'Switzerland', 'GER', 'SUI', 1782331200, 'scheduled', 'group', 'E');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f1', 'seed-831', 'Portugal', 'Belgium', 'POR', 'BEL', 1781456400, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f2', 'seed-832', 'Colombia', 'Ghana', 'COL', 'GHA', 1781460000, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f3', 'seed-833', 'Portugal', 'Colombia', 'POR', 'COL', 1781888400, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f4', 'seed-834', 'Belgium', 'Ghana', 'BEL', 'GHA', 1781892000, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f5', 'seed-835', 'Portugal', 'Ghana', 'POR', 'GHA', 1782320400, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-f6', 'seed-836', 'Belgium', 'Colombia', 'BEL', 'COL', 1782320400, 'scheduled', 'group', 'F');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g1', 'seed-837', 'Netherlands', 'Croatia', 'NED', 'CRO', 1781553600, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g2', 'seed-838', 'Senegal', 'South Korea', 'SEN', 'KOR', 1781557200, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g3', 'seed-839', 'Netherlands', 'Senegal', 'NED', 'SEN', 1781985600, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g4', 'seed-840', 'Croatia', 'South Korea', 'CRO', 'KOR', 1781989200, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g5', 'seed-841', 'Netherlands', 'South Korea', 'NED', 'KOR', 1782417600, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-g6', 'seed-842', 'Croatia', 'Senegal', 'CRO', 'SEN', 1782417600, 'scheduled', 'group', 'G');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h1', 'seed-843', 'Canada', 'Serbia', 'CAN', 'SRB', 1781542800, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h2', 'seed-844', 'Honduras', 'Wales', 'HON', 'WAL', 1781546400, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h3', 'seed-845', 'Canada', 'Honduras', 'CAN', 'HON', 1781974800, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h4', 'seed-846', 'Serbia', 'Wales', 'SRB', 'WAL', 1781978400, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h5', 'seed-847', 'Canada', 'Wales', 'CAN', 'WAL', 1782406800, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-h6', 'seed-848', 'Serbia', 'Honduras', 'SRB', 'HON', 1782406800, 'scheduled', 'group', 'H');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i1', 'seed-849', 'Italy', 'Chile', 'ITA', 'CHI', 1781640000, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i2', 'seed-850', 'Austria', 'Ivory Coast', 'AUT', 'CIV', 1781643600, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i3', 'seed-851', 'Italy', 'Austria', 'ITA', 'AUT', 1782072000, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i4', 'seed-852', 'Chile', 'Ivory Coast', 'CHI', 'CIV', 1782075600, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i5', 'seed-853', 'Italy', 'Ivory Coast', 'ITA', 'CIV', 1782504000, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-i6', 'seed-854', 'Chile', 'Austria', 'CHI', 'AUT', 1782504000, 'scheduled', 'group', 'I');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j1', 'seed-855', 'Iran', 'Turkey', 'IRN', 'TUR', 1781629200, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j2', 'seed-856', 'Ireland', 'South Africa', 'IRL', 'RSA', 1781632800, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j3', 'seed-857', 'Iran', 'Ireland', 'IRN', 'IRL', 1782061200, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j4', 'seed-858', 'Turkey', 'South Africa', 'TUR', 'RSA', 1782064800, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j5', 'seed-859', 'Iran', 'South Africa', 'IRN', 'RSA', 1782493200, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-j6', 'seed-860', 'Turkey', 'Ireland', 'TUR', 'IRL', 1782493200, 'scheduled', 'group', 'J');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k1', 'seed-861', 'Egypt', 'Costa Rica', 'EGY', 'CRC', 1781272800, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k2', 'seed-862', 'Scotland', 'Qatar', 'SCO', 'QAT', 1781276400, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k3', 'seed-863', 'Egypt', 'Scotland', 'EGY', 'SCO', 1781704800, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k4', 'seed-864', 'Costa Rica', 'Qatar', 'CRC', 'QAT', 1781708400, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k5', 'seed-865', 'Egypt', 'Qatar', 'EGY', 'QAT', 1782136800, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-k6', 'seed-866', 'Costa Rica', 'Scotland', 'CRC', 'SCO', 1782136800, 'scheduled', 'group', 'K');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l1', 'seed-867', 'Australia', 'Sweden', 'AUS', 'SWE', 1781359200, 'scheduled', 'group', 'L');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l2', 'seed-868', 'Venezuela', 'Philippines', 'VEN', 'PHI', 1781362800, 'scheduled', 'group', 'L');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l3', 'seed-869', 'Australia', 'Venezuela', 'AUS', 'VEN', 1781791200, 'scheduled', 'group', 'L');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l4', 'seed-870', 'Sweden', 'Philippines', 'SWE', 'PHI', 1781794800, 'scheduled', 'group', 'L');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l5', 'seed-871', 'Australia', 'Philippines', 'AUS', 'PHI', 1782223200, 'scheduled', 'group', 'L');
INSERT INTO matches (id, api_match_id, home_team, away_team, home_team_code, away_team_code, match_date, status, stage, group_name) VALUES ('m-l6', 'seed-872', 'Sweden', 'Venezuela', 'SWE', 'VEN', 1782223200, 'scheduled', 'group', 'L');
