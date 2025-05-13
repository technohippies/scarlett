-- Enable pgvector extension if not already enabled (optional but good practice)
CREATE EXTENSION IF NOT EXISTS vector;

-- Remove old tables if they exist (optional, but cleaner for dev)
DROP TABLE IF EXISTS flashcards;
DROP TABLE IF EXISTS webpages;

-- Table for unique words or phrases (lexemes)
CREATE TABLE IF NOT EXISTS lexemes (
    lexeme_id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    language TEXT NOT NULL, -- e.g., 'en', 'zh-CN'
    part_of_speech TEXT NULL, -- Added: Store POS tag (e.g., 'Noun', 'Verb')
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(text, language)
);

-- Table for storing definitions associated with lexemes
CREATE TABLE IF NOT EXISTS lexeme_definitions (
    definition_id SERIAL PRIMARY KEY,
    lexeme_id INTEGER NOT NULL REFERENCES lexemes(lexeme_id) ON DELETE CASCADE, -- Link to the word/phrase
    definition_text TEXT NOT NULL, -- The actual definition
    source TEXT NULL, -- Optional: Where did this definition come from? (e.g., 'HSK1 Seed', 'LLM:gemma3', 'CEDICT', 'User')
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster definition lookups by lexeme
CREATE INDEX IF NOT EXISTS idx_lexeme_definitions_lexeme_id ON lexeme_definitions(lexeme_id);

-- Function to update 'updated_at' timestamp (defined once, before triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Table linking source lexemes to their translations
CREATE TABLE IF NOT EXISTS lexeme_translations (
    translation_id SERIAL PRIMARY KEY,
    source_lexeme_id INTEGER NOT NULL,
    target_lexeme_id INTEGER NOT NULL,
    llm_context_hint TEXT,          -- Optional hint from LLM about usage
    llm_distractors TEXT,           -- Storing distractors as JSON string array? Or use separate table?
                                    -- Using TEXT for JSON array for now.
    cached_distractors TEXT,        -- Cached distractors (JSON array) generated via fallback/user feedback?
    variation_type TEXT,            -- NEW: Type of variation (e.g., 'original', 'past_tense', 'negative')
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_lexeme_id) REFERENCES lexemes(lexeme_id) ON DELETE CASCADE,
    FOREIGN KEY (target_lexeme_id) REFERENCES lexemes(lexeme_id) ON DELETE CASCADE,
    UNIQUE (source_lexeme_id, target_lexeme_id) -- Ensure unique translation pairs
);

-- Trigger to update updated_at timestamp for lexeme_translations
DROP TRIGGER IF EXISTS update_lexeme_translations_modtime ON lexeme_translations;
CREATE TRIGGER update_lexeme_translations_modtime
BEFORE UPDATE ON lexeme_translations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Table tracking user's learning progress for specific translations (SRS state)
CREATE TABLE IF NOT EXISTS user_learning (
    learning_id SERIAL PRIMARY KEY,
    -- user_id TEXT NOT NULL DEFAULT 'local', -- For potential multi-user support later
    translation_id INTEGER NOT NULL REFERENCES lexeme_translations(translation_id) ON DELETE CASCADE,

    -- FSRS related fields
    due TIMESTAMPTZ NOT NULL,       -- When the card is next due for review
    stability REAL DEFAULT 0,       -- Stability (interval growth factor)
    difficulty REAL DEFAULT 0,      -- Difficulty (ease factor)
    elapsed_days INTEGER DEFAULT 0, -- Days since last review (used in FSRS calc)
    scheduled_days INTEGER DEFAULT 0, -- Interval scheduled by FSRS
    reps INTEGER DEFAULT 0,         -- Number of successful reviews
    lapses INTEGER DEFAULT 0,       -- Number of times forgotten
    state INTEGER DEFAULT 0,        -- FSRS state (0:New, 1:Learning, 2:Review, 3:Relearning)
    last_review TIMESTAMPTZ NULL,   -- Timestamp of the last review

    -- Adaptive learning fields
    last_incorrect_choice TEXT NULL, -- Added: Store text of last incorrect MCQ choice

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Keep track of updates

    -- Ensure a user learns a specific translation pair only once
    -- Temporarily removing user_id until multi-user is implemented
    UNIQUE(translation_id) 
);

-- Trigger to update 'updated_at' on user_learning table
DROP TRIGGER IF EXISTS update_user_learning_modtime ON user_learning;
CREATE TRIGGER update_user_learning_modtime
BEFORE UPDATE ON user_learning
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Table logging when and where a user encountered a specific translation
CREATE TABLE IF NOT EXISTS encounters (
    encounter_id SERIAL PRIMARY KEY,
    learning_id INTEGER NOT NULL REFERENCES user_learning(learning_id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    source_highlight TEXT NOT NULL, -- The exact text highlighted by the user
    page_context_snippet TEXT NULL, -- Optional: Store surrounding text later
    encountered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_lexemes_text_lang ON lexemes(text, language);
CREATE INDEX IF NOT EXISTS idx_lexeme_translations_source ON lexeme_translations(source_lexeme_id);
CREATE INDEX IF NOT EXISTS idx_lexeme_translations_target ON lexeme_translations(target_lexeme_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_due ON user_learning(due); -- Important for finding due cards
CREATE INDEX IF NOT EXISTS idx_user_learning_translation ON user_learning(translation_id);
CREATE INDEX IF NOT EXISTS idx_encounters_learning_id ON encounters(learning_id);

-- Table for flashcards (learning items)
-- This table definition appears to be older/legacy. 
-- user_learning and lexeme_translations are the primary tables for SRS items.
-- Consider removing or reconciling this table if not actively used.
/* 
CREATE TABLE IF NOT EXISTS flashcards (
    id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    type TEXT CHECK(type IN ('front_back', 'cloze')) NOT NULL,
    front TEXT NOT NULL,
    back TEXT NULL,
    cloze_text TEXT NULL,
    context TEXT NULL,            -- Optional context or sentence containing the word/phrase
    source_highlight TEXT NULL,   -- The exact text highlighted by the user
    source_url TEXT NULL,       -- URL where the flashcard was created
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- SRS fields (nullable)
    due TIMESTAMP NULL,            -- When the card is next due for review
    stability REAL NULL,           -- Memory stability (days)
    difficulty REAL NULL,          -- Item difficulty (0-1)
    elapsed_days INTEGER DEFAULT 0, -- Days since last review
    scheduled_days INTEGER DEFAULT 0, -- Scheduled interval in days
    reps INTEGER DEFAULT 0,         -- Number of repetitions
    lapses INTEGER DEFAULT 0,        -- Number of times forgotten
    state TEXT CHECK(state IN ('new', 'learning', 'review', 'relearning')) NULL, -- FSRS state
    last_review TIMESTAMP NULL     -- Timestamp of the last review
);
*/

-- Table for bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    url TEXT NOT NULL UNIQUE, -- Keep URL unique for bookmarks
    title TEXT,             -- Page title
    selected_text TEXT NULL,-- Added: Store the clipped text snippet
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT NULL,         -- Comma-separated tags or JSON array
    embedding TEXT NULL -- Temporarily change to TEXT to avoid vector type error
    -- embedding vector(1024) NULL -- Use vector type (adjust dimension if needed)
);

-- Table for managing predefined and user-added tags
CREATE TABLE IF NOT EXISTS tags (
    tag_id SERIAL PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE, -- Added UNIQUE constraint
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookup of tags by name
CREATE INDEX IF NOT EXISTS idx_tags_tag_name ON tags (tag_name);

-- Table for managing predefined blocked domains for Focus Mode
CREATE TABLE IF NOT EXISTS blocked_domains (
    domain_id SERIAL PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    category TEXT NULL, -- Category from the CSV (e.g., "Social Media", "News")
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookup of blocked domains by name
CREATE INDEX IF NOT EXISTS idx_blocked_domains_domain_name ON blocked_domains (domain_name);
-- Index for faster lookup by category (optional, but might be useful)
CREATE INDEX IF NOT EXISTS idx_blocked_domains_category ON blocked_domains (category);

-- Trigger to update updated_at timestamp for blocked_domains (if you have the function defined elsewhere)
-- Assuming update_updated_at_column() function is already defined from other tables
DROP TRIGGER IF EXISTS update_blocked_domains_modtime ON blocked_domains;
CREATE TRIGGER update_blocked_domains_modtime
BEFORE UPDATE ON blocked_domains
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- --- Deck Organization Tables ---

-- Stores metadata about predefined or user-added decks
CREATE TABLE IF NOT EXISTS decks (
    deck_id SERIAL PRIMARY KEY,
    deck_identifier TEXT UNIQUE NOT NULL, -- e.g., "programming_vi_en", used for referencing from code/API
    name TEXT NOT NULL,
    description TEXT NULL,
    source_language TEXT NULL, -- Primary source language of the deck
    target_language TEXT NULL, -- Primary target language of the deck
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at timestamp for decks
DROP TRIGGER IF EXISTS update_decks_modtime ON decks;
CREATE TRIGGER update_decks_modtime
BEFORE UPDATE ON decks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Links translations to the decks they belong to (Many-to-Many)
CREATE TABLE IF NOT EXISTS translation_decks (
    translation_id INTEGER NOT NULL REFERENCES lexeme_translations(translation_id) ON DELETE CASCADE,
    deck_id INTEGER NOT NULL REFERENCES decks(deck_id) ON DELETE CASCADE,
    PRIMARY KEY (translation_id, deck_id) -- Ensures a translation is linked to a specific deck only once
);

-- Index for faster lookup of translations by deck
CREATE INDEX IF NOT EXISTS idx_translation_decks_deck_id ON translation_decks(deck_id);
-- Index for faster lookup of decks by translation
CREATE INDEX IF NOT EXISTS idx_translation_decks_translation_id ON translation_decks(translation_id);

-- --- END Deck Organization Tables ---

-- --- Mood Entry Table ---
-- This is the active definition for mood entries.
-- The commented out block for "daily_moods" further down should be ignored or removed later.
CREATE TABLE IF NOT EXISTS mood_entries (
    id SERIAL PRIMARY KEY,
    mood TEXT NOT NULL CHECK(mood IN ('happy', 'slightly-happy', 'neutral', 'slightly-frowning', 'sad')),
    entry_date TEXT NOT NULL, -- Format YYYY-MM-DD
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entry_date) -- Optional: If only one mood entry per day is allowed.
);
CREATE INDEX IF NOT EXISTS idx_mood_entries_entry_date ON mood_entries(entry_date);
-- --- END Mood Entry Table ---

-- --- RAG / Page History Tables --- 

-- Drop OLD visited_pages table if it exists to ensure clean migration
DROP TABLE IF EXISTS visited_pages;

-- NEW: Main table for unique URLs visited
CREATE TABLE IF NOT EXISTS pages (
    url TEXT PRIMARY KEY,
    title TEXT NULL,                       -- Store the latest known title?
    first_visited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_visited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    latest_version_id INTEGER NULL      -- Reference to the most recent version in page_versions (optional)
    -- NOTE: Foreign Key constraint not added yet for simplicity
);

-- NEW: Table storing specific versions/snapshots of page content
CREATE TABLE IF NOT EXISTS page_versions (
    version_id SERIAL PRIMARY KEY,
    url TEXT NOT NULL REFERENCES pages(url) ON DELETE CASCADE, -- Link back to the main URL
    markdown_content TEXT NULL,           -- The *original* processed markdown (can be set to NULL after summarization)
    markdown_hash TEXT NULL,              -- Hash of *original* markdown_content
    summary_content TEXT NULL,            -- NEW: The LLM-generated summary
    summary_hash TEXT NULL,               -- NEW: Hash of summary_content
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- When this version was captured
    processed_for_embedding_at TIMESTAMPTZ NULL, -- Timestamp of when processing for embedding started
    embedding_model_id TEXT NULL,       -- Identifier for the embedding model used (e.g., 'text-embedding-ada-002', 'ollama:mxbai-embed-large')
    last_embedded_at TIMESTAMPTZ NULL,   -- Timestamp of when embedding was last successfully stored
    processing_error TEXT NULL          -- Store any error message during processing/embedding
);

-- Trigger to update last_visited_at in pages table when a new page_version is inserted
DROP TRIGGER IF EXISTS update_pages_last_visited_on_version_insert ON page_versions;
CREATE OR REPLACE FUNCTION update_pages_last_visited_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pages
    SET last_visited_at = NEW.captured_at,
        latest_version_id = NEW.version_id -- Also update the latest_version_id
    WHERE url = NEW.url;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pages_last_visited_on_version_insert
AFTER INSERT ON page_versions
FOR EACH ROW
EXECUTE FUNCTION update_pages_last_visited_trigger();

-- Indices for pages and page_versions
CREATE INDEX IF NOT EXISTS idx_pages_last_visited ON pages (last_visited_at DESC);
-- For finding versions of a specific URL, ordered by capture time
CREATE INDEX IF NOT EXISTS idx_page_versions_url_captured ON page_versions (url, captured_at DESC);
-- For finding pages that need embedding (last_embedded_at is NULL)
CREATE INDEX IF NOT EXISTS idx_page_versions_needs_embedding ON page_versions (last_embedded_at) WHERE last_embedded_at IS NULL;
-- For finding the latest successfully embedded version for a URL (more specific than just needs_embedding)
CREATE INDEX IF NOT EXISTS idx_page_versions_latest_embedded ON page_versions (url, last_embedded_at DESC) WHERE last_embedded_at IS NOT NULL;
-- Optional: Indices on hashes if you query by them frequently
CREATE INDEX IF NOT EXISTS idx_page_versions_markdown_hash ON page_versions (markdown_hash);
CREATE INDEX IF NOT EXISTS idx_page_versions_summary_hash ON page_versions (summary_hash);

-- --- END RAG / Page History Tables ---

-- NEW: Table for storing daily mood selections (COMMENTED OUT as mood_entries is being used ABOVE)
/*
CREATE TABLE IF NOT EXISTS daily_moods (
    date TEXT PRIMARY KEY NOT NULL,      -- Date in YYYY-MM-DD format
    mood TEXT NOT NULL CHECK(mood IN ('happy', 'slightly-happy', 'neutral', 'slightly-frowning', 'sad')),
    selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- When the mood was selected
);
*/

-- --- Daily Study Stats Table ---
-- Table to store daily study session statistics
CREATE TABLE IF NOT EXISTS daily_study_stats (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Using a fixed ID for a singleton row representing global daily stats
    last_reset_date TEXT NOT NULL,    -- Date in YYYY-MM-DD format, when the new_items_studied_today was last reset
    new_items_studied_today INTEGER NOT NULL DEFAULT 0, -- Count of new items studied since last_reset_date
    CONSTRAINT daily_study_stats_singleton CHECK (id = 1) -- Enforce singleton row
);
-- --- END Daily Study Stats Table ---
