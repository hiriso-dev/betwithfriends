-- BetWithFriends D1 Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  magic_link_token TEXT,
  magic_link_expires INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS group_members (
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

CREATE TABLE IF NOT EXISTS matches (
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
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  match_id TEXT NOT NULL REFERENCES matches(id),
  home_score_pred INTEGER NOT NULL,
  away_score_pred INTEGER NOT NULL,
  points_earned REAL,
  cote_applied REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, group_id, match_id)
);

CREATE TABLE IF NOT EXISTS special_bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  bet_type TEXT NOT NULL,
  bet_value TEXT NOT NULL,
  points_earned REAL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(user_id, group_id, bet_type)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  subscription_json TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  remind_before_game INTEGER DEFAULT 1,
  result_after_game INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_bets_match ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_group ON bets(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
