CREATE TABLE IF NOT EXISTS japanese_game_ratings (
  game_type TEXT NOT NULL CHECK (game_type IN ('words', 'kanji', 'grammar')),
  resource_id TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('Hard', 'Good', 'Easy')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_type, resource_id)
);
