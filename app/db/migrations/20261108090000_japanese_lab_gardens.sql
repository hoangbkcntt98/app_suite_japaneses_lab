CREATE TABLE IF NOT EXISTS japanese_lab_gardens (
  player_id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{"xp":0,"landCount":0,"plants":[],"items":{"hoe":0,"wateringCan":0,"fertilizer":0,"superFertilizer":0,"pesticide":0}}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE japanese_lab_gardens
  ALTER COLUMN state SET DEFAULT '{"xp":0,"landCount":0,"plants":[],"items":{"hoe":0,"wateringCan":0,"fertilizer":0,"superFertilizer":0,"pesticide":0}}'::jsonb;
