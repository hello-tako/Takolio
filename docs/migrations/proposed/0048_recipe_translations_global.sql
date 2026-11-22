-- Migration 0048: Global Multilingual Recipe Localization Table
-- Additive, idempotent table for verified localized recipe metadata, slugs, ingredients, steps, and SEO/GEO copy
-- across global languages (en, ja, ko, th, zh, it, etc.) without mutating the canonical Vietnamese baseline in `recipes`.

CREATE TABLE IF NOT EXISTS recipe_localized_content (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  localized_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  cuisine_label TEXT,
  category_label TEXT,
  ingredients_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(recipe_id, language),
  UNIQUE(language, localized_slug)
);

CREATE INDEX IF NOT EXISTS idx_recipe_localized_content_lang
  ON recipe_localized_content(language, recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_localized_content_slug
  ON recipe_localized_content(language, localized_slug);
