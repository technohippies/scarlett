// src/services/db/types.ts

// Basic Tag structure based on schema.sql
// Note: schema had tag_id, tag_name - let's align type names
export interface Tag {
  tag_id: number; 
  tag_name: string; // e.g., "#tech"
  created_at: string; // Assuming TIMESTAMPTZ comes back as string
  updated_at: string;
  // is_predefined was in an earlier version, may need adding back if used
}

// Bookmark structure based on schema.sql
export interface Bookmark {
  id: number;
  url: string;
  title?: string | null;
  saved_at: string; // Assuming TIMESTAMP comes back as string
  tags?: string | null; // Comma-separated string as per schema
  embedding?: string | null; // TEXT for now
}

// Input type for creating bookmarks (omits id, saved_at)
export interface CreateBookmarkInput {
  url: string;
  title?: string | null;
  tags?: string | null;
  embedding?: string | null; 
  selectedText?: string | null;
}

// Flashcard structure based on schema.sql
export interface Flashcard {
  id: number;
  type: 'front_back' | 'cloze';
  front: string;
  back?: string | null;
  cloze_text?: string | null;
  context?: string | null;
  source_highlight?: string | null;
  source_url?: string | null;
  created_at: string; // Assuming TIMESTAMP comes back as string
  // SRS fields
  due?: string | null; // Assuming TIMESTAMP comes back as string
  stability?: number | null;
  difficulty?: number | null;
  elapsed_days?: number;
  scheduled_days?: number;
  reps?: number;
  lapses?: number;
  state?: 'new' | 'learning' | 'review' | 'relearning' | null;
  last_review?: string | null; // Assuming TIMESTAMP comes back as string
}

// Input type for creating flashcards (omits id, created_at, and SRS fields)
export interface CreateFlashcardInput {
  type: 'front_back' | 'cloze';
  front: string;
  back?: string | null;
  cloze_text?: string | null;
  context?: string | null;
  source_highlight?: string | null;
  source_url?: string | null;
} 