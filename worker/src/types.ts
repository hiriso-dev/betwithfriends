export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  APP_URL: string;
  FOOTBALL_DATA_API_KEY?: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  /** Resend API key (set via `wrangler secret put RESEND_API_KEY`). */
  RESEND_API_KEY?: string;
  /** Sender address for transactional email, e.g. "noreply@yourdomain.com".
   *  Must be on a domain verified in Resend. */
  EMAIL_FROM?: string;
}

export type AuthContext = {
  userId: string;
  email: string;
};

export type Match = {
  id: string;
  api_match_id: string;
  home_team: string;
  away_team: string;
  home_team_code: string | null;
  away_team_code: string | null;
  match_date: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "finished" | "postponed";
  stage: string | null;
  group_name: string | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  odds_updated_at: number | null;
  stadium: string | null;
  venue_city: string | null;
  updated_at: number;
  preview: number | null; // 1 = points shown but NOT added to leaderboard
};

export type TopScorer = {
  id: string;
  player_name: string;
  team_name: string;
  team_code: string;
  goals: number;
  assists: number;
  penalties: number;
};

export type Bet = {
  id: string;
  user_id: string;
  group_id: string;
  match_id: string;
  home_score_pred: number;
  away_score_pred: number;
  confidence: "cautious" | "confident" | "reckless" | null;
  double_up: number;
  points_earned: number | null;
  created_at: number;
  updated_at: number;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: number;
};

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string;
  pseudo: string;
  is_admin: number;
  total_points: number;
  joined_at: number;
};
