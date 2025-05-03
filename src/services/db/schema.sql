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

-- Table linking source lexemes to their translations
CREATE TABLE IF NOT EXISTS lexeme_translations (
    translation_id SERIAL PRIMARY KEY,
    source_lexeme_id INTEGER NOT NULL REFERENCES lexemes(lexeme_id) ON DELETE CASCADE,
    target_lexeme_id INTEGER NOT NULL REFERENCES lexemes(lexeme_id) ON DELETE CASCADE,
    -- Optional: context hint from LLM if needed later for disambiguation
    llm_context_hint TEXT NULL, 
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    -- Usually one primary translation, but allow multiple if context differs significantly?
    -- Starting with unique pair constraint for simplicity.
    UNIQUE(source_lexeme_id, target_lexeme_id)
);

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

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Keep track of updates

    -- Ensure a user learns a specific translation pair only once
    -- Temporarily removing user_id until multi-user is implemented
    UNIQUE(translation_id) 
);

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

-- Optional: Trigger to update 'updated_at' on user_learning table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_learning_modtime
BEFORE UPDATE ON user_learning
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
