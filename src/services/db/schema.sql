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

-- Table for bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    url TEXT NOT NULL UNIQUE, -- Keep URL unique for bookmarks
    title TEXT,             -- Page title
    selected_text TEXT NULL,-- Added: Store the clipped text snippet
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT NULL,         -- Comma-separated tags or JSON array
    embedding_384 vector(384) NULL, -- Added: support for MiniLM-L6-v2 embeddings
    embedding_512 vector(512) NULL,
    embedding_768 vector(768) NULL,
    embedding_1024 vector(1024) NULL,
    active_embedding_dimension INTEGER NULL, -- Which dimension is currently populated?
    embedding_model_id TEXT NULL,
    last_embedded_at TIMESTAMPTZ NULL
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
    defuddle_metadata JSONB NULL, -- Raw Defuddle metadata from Defuddle.parse()
    summary_content TEXT NULL,            -- NEW: The LLM-generated summary
    summary_hash TEXT NULL,               -- NEW: Hash of summary_content
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- When this version was captured
    processed_for_embedding_at TIMESTAMPTZ NULL, -- Timestamp of when processing for embedding started
    embedding_model_id TEXT NULL,       -- Identifier for the embedding model used (e.g., 'text-embedding-ada-002', 'ollama:mxbai-embed-large')
    last_embedded_at TIMESTAMPTZ NULL,   -- Timestamp of when embedding was last successfully stored
    embedding_512 vector(512) NULL,
    embedding_384 vector(384) NULL, -- Added: support for MiniLM-L6-v2 embeddings
    embedding_768 vector(768) NULL,
    embedding_1024 vector(1024) NULL,
    active_embedding_dimension INTEGER NULL, -- Which dimension is currently populated?
    visit_count INTEGER DEFAULT 0 NOT NULL, -- ADDED: To track visits for this specific version
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

-- --- Daily Study Stats Table ---
-- Table to store daily study session statistics
CREATE TABLE IF NOT EXISTS daily_study_stats (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Using a fixed ID for a singleton row representing global daily stats
    last_reset_date TEXT NOT NULL,    -- YYYY-MM-DD format, when new_items_studied_today was last reset
    new_items_studied_today INTEGER NOT NULL DEFAULT 0 -- Count of new items studied on last_reset_date
    -- removed updated_at as it's not directly managed by triggers and was causing issues
);
-- --- END Daily Study Stats Table ---

-- --- Study Streak Table ---
CREATE TABLE IF NOT EXISTS study_streak (
    id INTEGER PRIMARY KEY DEFAULT 1,                      -- Fixed ID for a single global user streak record
    current_streak INTEGER NOT NULL DEFAULT 0,             -- Current consecutive days goal met
    longest_streak INTEGER NOT NULL DEFAULT 0,             -- Longest streak achieved
    last_streak_increment_date TEXT,                       -- YYYY-MM-DD: Last date streak was incremented (goal met)
    last_activity_date TEXT                                -- YYYY-MM-DD: Last date any new item was studied (even if goal not met)
);

-- Initialize with a default row if it doesn't exist.
-- This helps simplify application logic by ensuring a row is always present.
INSERT INTO study_streak (id, current_streak, longest_streak, last_streak_increment_date, last_activity_date)
SELECT 1, 0, 0, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM study_streak WHERE id = 1);
-- --- END Study Streak Table ---

-- Note: Removed incomplete user_configuration table placeholder

-- --- Song Lyrics Table ---
CREATE TABLE IF NOT EXISTS song_lyrics (
    id SERIAL PRIMARY KEY,
    lrclib_id INTEGER UNIQUE, -- ID from lrclib.net to prevent duplicates
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_name TEXT,
    duration INTEGER, -- Song duration in seconds
    instrumental BOOLEAN DEFAULT FALSE,
    plain_lyrics TEXT,
    synced_lyrics TEXT, -- Storing as JSON string or TEXT; parsing will be done in application code
    has_synced_lyrics BOOLEAN NOT NULL DEFAULT FALSE, -- True if synced_lyrics are available and valid
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at timestamp for song_lyrics
DROP TRIGGER IF EXISTS update_song_lyrics_modtime ON song_lyrics;
CREATE TRIGGER update_song_lyrics_modtime
BEFORE UPDATE ON song_lyrics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indices for song_lyrics table
CREATE INDEX IF NOT EXISTS idx_song_lyrics_lrclib_id ON song_lyrics(lrclib_id);
-- CREATE INDEX IF NOT EXISTS idx_song_lyrics_track_artist ON song_lyrics(track_name, artist_name);
-- --- END Song Lyrics Table ---

-- --- Chat / Conversation Tables ---

CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,                      -- Unique ID for the thread (e.g., UUID)
    title TEXT NOT NULL,                      -- Title of the chat thread
    system_prompt TEXT NOT NULL DEFAULT '',   -- System prompt for this thread, default to empty string
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- When the thread was created
    last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Last user or AI interaction
    -- For potential future "scenario-based" roleplay chats
    scenario_description TEXT NULL,
    -- Add other metadata as needed, e.g., user_id for multi-user
    -- Embedding fields for the thread itself
    embedding_model_id TEXT NULL,
    last_embedded_at TIMESTAMPTZ NULL,
    embedding_384 vector(384) NULL, -- Added: support for MiniLM-L6-v2 embeddings
    embedding_512 vector(512) NULL, -- Changed from TEXT to vector(512)
    embedding_768 vector(768) NULL, -- Changed from TEXT to vector(768)
    embedding_1024 vector(1024) NULL, -- Changed from TEXT to vector(1024)
    active_embedding_dimension INTEGER NULL -- 384, 512, 768, or 1024
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, 
    thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user' or 'ai'
    text_content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    tts_lang TEXT NULL, 
    tts_alignment_data TEXT NULL, 
    embedding_384 vector(384) NULL, -- Added: support for MiniLM-L6-v2 embeddings
    embedding_512 vector(512) NULL, -- Changed from TEXT to vector(512)
    embedding_768 vector(768) NULL, -- Changed from TEXT to vector(768)
    embedding_1024 vector(1024) NULL, -- Changed from TEXT to vector(1024)
    active_embedding_dimension INTEGER NULL, -- Stores 384, 512, 768, or 1024 etc.
    processed_for_embedding_at TIMESTAMPTZ NULL,
    embedding_model_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_last_activity ON chat_threads(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id_timestamp ON chat_messages(thread_id, timestamp);
-- Optional: Index for finding messages that need embedding
CREATE INDEX IF NOT EXISTS idx_chat_messages_needs_embedding ON chat_messages (processed_for_embedding_at) WHERE processed_for_embedding_at IS NULL;

-- --- END Chat / Conversation Tables ---

-- Table for tracking song listening events (listening history)
CREATE TABLE IF NOT EXISTS listening_history (
    listen_id SERIAL PRIMARY KEY,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    album_name TEXT NULL,
    listened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying listens by track and date
CREATE INDEX IF NOT EXISTS idx_listening_history_track_date ON listening_history (track_name, listened_at);
