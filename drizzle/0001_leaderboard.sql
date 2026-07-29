CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  elapsed INTEGER NOT NULL,
  highest_level INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('won', 'lost')),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS leaderboard_rank_idx
ON leaderboard (result, highest_level DESC, score DESC, elapsed DESC, created_at DESC);
