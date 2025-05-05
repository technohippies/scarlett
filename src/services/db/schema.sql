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
    markdown_content TEXT NULL,           -- The processed markdown for this version
    markdown_hash TEXT NULL,              -- Hash of markdown_content for quick equality checks
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- When this version was captured
    
    -- Embedding columns
    embedding_512 vector(512) NULL,
    embedding_768 vector(768) NULL,
    embedding_1024 vector(1024) NULL,
    active_embedding_dimension INTEGER NULL, -- Which dimension is currently populated?
    last_embedded_at TIMESTAMPTZ NULL,     -- When this version was last successfully embedded
    
    -- Metadata
    visit_count INTEGER DEFAULT 1           -- How many times content similar to this version was encountered
);

-- Indices for `pages` table
CREATE INDEX IF NOT EXISTS idx_pages_last_visited ON pages (last_visited_at DESC);

-- Indices for `page_versions` table
CREATE INDEX IF NOT EXISTS idx_page_versions_url_captured ON page_versions (url, captured_at DESC);
-- Index to quickly find versions needing embedding
CREATE INDEX IF NOT EXISTS idx_page_versions_needs_embedding ON page_versions (last_embedded_at) WHERE last_embedded_at IS NULL;
-- Index to quickly find the latest embedded version for a URL
CREATE INDEX IF NOT EXISTS idx_page_versions_latest_embedded ON page_versions (url, last_embedded_at DESC) WHERE last_embedded_at IS NOT NULL;


-- --- END RAG / Page History Tables ---
