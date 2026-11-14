ALTER TABLE japanese_lab_gardens
  ALTER COLUMN state SET DEFAULT '{"xp":0,"landCount":0,"plants":[],"seeds":{"oak":0,"pine":0,"cherry":0,"apple":0,"orange":0,"maple":0},"items":{"hoe":0,"wateringCan":0,"fertilizer":0,"superFertilizer":0,"pesticide":0}}'::jsonb;
