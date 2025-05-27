import { getDbInstance } from '../db/init';
import { getEmbedding } from './embedding';
import type { UserConfiguration, FunctionConfig } from '../storage/types';
import { userConfigurationStorage } from '../storage/storage';

// Model context window configurations
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Ollama models
  'llama3.2:latest': 128000,
  'llama3.2:3b': 128000,
  'llama3.1:latest': 128000,
  'llama3.1:8b': 128000,
  'llama3.1:70b': 128000,
  'llama3:latest': 8192,
  'llama3:8b': 8192,
  'llama3:70b': 8192,
  'gemma2:latest': 8192,
  'gemma2:9b': 8192,
  'gemma2:27b': 8192,
  'qwen2.5:latest': 32768,
  'qwen2.5:7b': 32768,
  'qwen2.5:14b': 32768,
  'qwen2.5:32b': 32768,
  'mistral:latest': 32768,
  'mistral:7b': 32768,
  'codellama:latest': 16384,
  'codellama:7b': 16384,
  'codellama:13b': 16384,
  'phi3:latest': 128000,
  'phi3:mini': 128000,
  'phi3:medium': 128000,
  
  // Jan models (similar to Ollama)
  'llama-3.2-3b-instruct': 128000,
  'llama-3.1-8b-instruct': 128000,
  'gemma-2-9b-it': 8192,
  
  // LM Studio models (similar patterns)
  'meta-llama-3.1-8b-instruct': 128000,
  'microsoft-phi-3-mini-4k-instruct': 4096,
  'microsoft-phi-3-medium-14b-instruct': 4096,
  
  // Default fallback
  'default': 4096
};

export interface RAGResult {
  content: string;
  source: 'chat' | 'bookmark' | 'page' | 'learning' | 'context';
  relevanceScore: number;
  metadata?: {
    url?: string;
    timestamp?: string;
    title?: string;
    messageId?: string;
    threadId?: string;
  };
}

export interface RAGSearchOptions {
  maxResults?: number;
  minRelevanceScore?: number;
  sources?: ('chat' | 'bookmark' | 'page' | 'learning' | 'context')[];
  timeWindow?: {
    start?: Date;
    end?: Date;
  };
}

export interface RAGContext {
  results: RAGResult[];
  totalTokensUsed: number;
  availableTokens: number;
  truncated: boolean;
}

// Database result interfaces
interface ChatMessageRow {
  id: string;
  thread_id: string;
  sender: string;
  text_content: string;
  timestamp: string;
  similarity: number;
}

interface BookmarkRow {
  url: string;
  title: string;
  selected_text: string;
  saved_at: string;
  similarity: number;
}

interface PageRow {
  url: string;
  summary_content: string;
  captured_at: string;
  similarity: number;
}

interface LearningRow {
  text: string;
  definition_text: string;
  language: string;
  source: string;
  similarity: number;
}

/**
 * Get the context window size for a given model
 */
export function getModelContextWindow(modelId: string): number {
  // Try exact match first
  if (MODEL_CONTEXT_WINDOWS[modelId]) {
    return MODEL_CONTEXT_WINDOWS[modelId];
  }
  
  // Try partial matches for versioned models
  for (const [pattern, contextSize] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelId.includes(pattern.split(':')[0])) {
      return contextSize;
    }
  }
  
  return MODEL_CONTEXT_WINDOWS.default;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Perform hybrid search across all data sources
 */
export async function performRAGSearch(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGResult[]> {
  const {
    maxResults = 10,
    minRelevanceScore = 0.3,
    sources = ['chat', 'bookmark', 'page', 'learning', 'context'],
    timeWindow
  } = options;

  console.log(`[RAG] 📚 GENERAL RAG: Performing hybrid search for: "${query.substring(0, 50)}..."`);
  
  const db = await getDbInstance();
  const results: RAGResult[] = [];

  try {
    // Get user's embedding configuration
    const userConfig = await userConfigurationStorage.getValue();
    const embeddingConfig = userConfig?.embeddingConfig;
    
    if (!embeddingConfig) {
      console.warn('[RAG] 📚 GENERAL RAG: No embedding configuration found, falling back to keyword search');
      return await performKeywordSearch(query, options);
    }

    // Get embedding for the query
    console.log('[RAG] 📚 GENERAL RAG: Generating embedding for content search...');
    const queryEmbedding = await getEmbedding(query, embeddingConfig);
    if (!queryEmbedding || !queryEmbedding.embedding) {
      console.warn('[RAG] 📚 GENERAL RAG: Failed to generate query embedding, falling back to keyword search');
      return await performKeywordSearch(query, options);
    }

    const embedding = queryEmbedding.embedding;
    const dimension = queryEmbedding.dimension;
    console.log('[RAG] 📚 GENERAL RAG: Using embedding dimension:', dimension);

    // Build time filter clause
    const timeFilter = timeWindow ? 
      `AND timestamp >= '${timeWindow.start?.toISOString()}' AND timestamp <= '${timeWindow.end?.toISOString()}'` : '';

    // 1. Search chat messages
    if (sources.includes('chat')) {
      console.log('[RAG] 📚 GENERAL RAG: Searching chat messages...');
      const chatQuery = `
        SELECT 
          id, thread_id, sender, text_content, timestamp,
          1 - (embedding_${dimension} <=> $1::vector) as similarity
        FROM chat_messages 
        WHERE embedding_${dimension} IS NOT NULL 
          ${timeFilter}
          AND (1 - (embedding_${dimension} <=> $1::vector)) > $2
        ORDER BY similarity DESC
        LIMIT $3
      `;
      
      // Format embedding as PostgreSQL vector literal
      const vectorLiteral = `[${embedding.join(',')}]`;
      
      const chatResults = await db.query<ChatMessageRow>(chatQuery, [
        vectorLiteral,
        minRelevanceScore,
        Math.ceil(maxResults * 0.4) // 40% of results from chat
      ]);

      if (chatResults.rows) {
        console.log('[RAG] 📚 GENERAL RAG: Found', chatResults.rows.length, 'chat message results');
        for (const row of chatResults.rows) {
          const chatRow = row as ChatMessageRow;
          results.push({
            content: chatRow.text_content,
            source: 'chat',
            relevanceScore: chatRow.similarity,
            metadata: {
              messageId: chatRow.id,
              threadId: chatRow.thread_id,
              timestamp: chatRow.timestamp
            }
          });
        }
      }
    }

    // 2. Search bookmarks
    if (sources.includes('bookmark')) {
      console.log('[RAG] 📚 GENERAL RAG: Searching bookmarks...');
      const bookmarkQuery = `
        SELECT 
          url, title, selected_text, saved_at,
          1 - (embedding_${dimension} <=> $1::vector) as similarity
        FROM bookmarks 
        WHERE embedding_${dimension} IS NOT NULL 
          AND selected_text IS NOT NULL
          ${timeFilter.replace('timestamp', 'saved_at')}
          AND (1 - (embedding_${dimension} <=> $1::vector)) > $2
        ORDER BY similarity DESC
        LIMIT $3
      `;
      
      // Format embedding as PostgreSQL vector literal
      const vectorLiteral = `[${embedding.join(',')}]`;
      
      const bookmarkResults = await db.query<BookmarkRow>(bookmarkQuery, [
        vectorLiteral,
        minRelevanceScore,
        Math.ceil(maxResults * 0.3) // 30% from bookmarks
      ]);

      if (bookmarkResults.rows) {
        console.log('[RAG] 📚 GENERAL RAG: Found', bookmarkResults.rows.length, 'bookmark results');
        for (const row of bookmarkResults.rows) {
          const bookmarkRow = row as BookmarkRow;
          results.push({
            content: bookmarkRow.selected_text || bookmarkRow.title,
            source: 'bookmark',
            relevanceScore: bookmarkRow.similarity,
            metadata: {
              url: bookmarkRow.url,
              title: bookmarkRow.title,
              timestamp: bookmarkRow.saved_at
            }
          });
        }
      }
    }

    // 3. Search page content
    if (sources.includes('page')) {
      console.log('[RAG] 📚 GENERAL RAG: Searching page content...');
      const pageQuery = `
        SELECT 
          url, summary_content, captured_at,
          1 - (embedding_${dimension} <=> $1::vector) as similarity
        FROM page_versions 
        WHERE embedding_${dimension} IS NOT NULL 
          AND summary_content IS NOT NULL
          ${timeFilter.replace('timestamp', 'captured_at')}
          AND (1 - (embedding_${dimension} <=> $1::vector)) > $2
        ORDER BY similarity DESC
        LIMIT $3
      `;
      
      // Format embedding as PostgreSQL vector literal
      const vectorLiteral = `[${embedding.join(',')}]`;
      
      const pageResults = await db.query<PageRow>(pageQuery, [
        vectorLiteral,
        minRelevanceScore,
        Math.ceil(maxResults * 0.2) // 20% from pages
      ]);

      if (pageResults.rows) {
        console.log('[RAG] 📚 GENERAL RAG: Found', pageResults.rows.length, 'page content results');
        for (const row of pageResults.rows) {
          const pageRow = row as PageRow;
          results.push({
            content: pageRow.summary_content,
            source: 'page',
            relevanceScore: pageRow.similarity,
            metadata: {
              url: pageRow.url,
              timestamp: pageRow.captured_at
            }
          });
        }
      }
    }

    // 4. Search learning content (lexemes + definitions) - using keyword search instead of similarity
    if (sources.includes('learning')) {
      console.log('[RAG] 📚 GENERAL RAG: Searching learning content...');
      try {
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (keywords.length > 0) {
          const learningQuery = `
            SELECT 
              l.text, ld.definition_text, l.language, ld.source
            FROM lexemes l
            JOIN lexeme_definitions ld ON l.lexeme_id = ld.lexeme_id
            WHERE LOWER(l.text || ' ' || ld.definition_text) LIKE ANY($1)
            ORDER BY l.text
            LIMIT $2
          `;
          
          const patterns = keywords.map(k => `%${k}%`);
          const learningResults = await db.query<LearningRow>(learningQuery, [
            patterns,
            Math.ceil(maxResults * 0.1) // 10% from learning
          ]);

          if (learningResults.rows) {
            console.log('[RAG] 📚 GENERAL RAG: Found', learningResults.rows.length, 'learning content results');
            for (const row of learningResults.rows) {
              const learningRow = row as LearningRow;
              results.push({
                content: `${learningRow.text}: ${learningRow.definition_text}`,
                source: 'learning',
                relevanceScore: 0.4, // Default score for keyword matches
                metadata: {
                  title: `${learningRow.language} vocabulary`
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn('[RAG] 📚 GENERAL RAG: Learning content search failed, skipping:', error);
      }
    }

  } catch (error) {
    console.error('[RAG] 📚 GENERAL RAG: Vector search failed:', error);
    // Fallback to keyword search
    return await performKeywordSearch(query, options);
  }

  // Sort all results by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`[RAG] 📚 GENERAL RAG: Found ${results.length} total results, returning top ${Math.min(results.length, maxResults)}`);
  if (results.length > 0) {
    console.log('[RAG] 📚 GENERAL RAG: Top result relevance score:', results[0].relevanceScore.toFixed(3));
  }
  
  return results.slice(0, maxResults);
}

/**
 * Fallback keyword search when embeddings fail
 */
async function performKeywordSearch(
  query: string,
  options: RAGSearchOptions
): Promise<RAGResult[]> {
  const { maxResults = 10, sources = ['chat', 'bookmark', 'page'] } = options;
  const db = await getDbInstance();
  const results: RAGResult[] = [];
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  console.log(`[RAG] Performing keyword search with terms: ${keywords.join(', ')}`);

  // Simple keyword matching for chat messages
  if (sources.includes('chat')) {
    const chatQuery = `
      SELECT id, thread_id, text_content, timestamp
      FROM chat_messages 
      WHERE LOWER(text_content) LIKE ANY($1)
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    
    const patterns = keywords.map(k => `%${k}%`);
    const chatResults = await db.query(chatQuery, [patterns, Math.ceil(maxResults * 0.5)]);
    
    for (const row of chatResults.rows) {
      const chatRow = row as any; // Type assertion for keyword search results
      results.push({
        content: chatRow.text_content,
        source: 'chat',
        relevanceScore: 0.5, // Default score for keyword matches
        metadata: {
          messageId: chatRow.id,
          threadId: chatRow.thread_id,
          timestamp: chatRow.timestamp
        }
      });
    }
  }

  // Keyword search for bookmarks
  if (sources.includes('bookmark')) {
    const bookmarkQuery = `
      SELECT url, title, selected_text, saved_at
      FROM bookmarks 
      WHERE LOWER(title || ' ' || COALESCE(selected_text, '')) LIKE ANY($1)
      ORDER BY saved_at DESC
      LIMIT $2
    `;
    
    const patterns = keywords.map(k => `%${k}%`);
    const bookmarkResults = await db.query(bookmarkQuery, [patterns, Math.ceil(maxResults * 0.5)]);
    
    for (const row of bookmarkResults.rows) {
      const bookmarkRow = row as any; // Type assertion for keyword search results
      results.push({
        content: bookmarkRow.selected_text || bookmarkRow.title,
        source: 'bookmark',
        relevanceScore: 0.5,
        metadata: {
          url: bookmarkRow.url,
          title: bookmarkRow.title,
          timestamp: bookmarkRow.saved_at
        }
      });
    }
  }

  return results.slice(0, maxResults);
}

/**
 * Build RAG context for LLM with dynamic token management
 */
export async function buildRAGContext(
  query: string,
  modelId: string,
  options: RAGSearchOptions = {}
): Promise<RAGContext> {
  const contextWindow = getModelContextWindow(modelId);
  const reservedTokens = 1000; // Reserve tokens for system prompt, user message, and response
  const availableTokens = contextWindow - reservedTokens;
  
  console.log(`[RAG] Building context for model ${modelId} (${contextWindow} tokens, ${availableTokens} available)`);
  
  // Perform RAG search
  const results = await performRAGSearch(query, options);
  
  // Build context string within token limits
  const contextParts: string[] = [];
  let totalTokensUsed = 0;
  let truncated = false;
  
  for (const result of results) {
    const resultText = `[${result.source.toUpperCase()}] ${result.content}`;
    const resultTokens = estimateTokens(resultText);
    
    if (totalTokensUsed + resultTokens > availableTokens) {
      truncated = true;
      break;
    }
    
    contextParts.push(resultText);
    totalTokensUsed += resultTokens;
  }
  
  console.log(`[RAG] Built context with ${contextParts.length}/${results.length} results, ${totalTokensUsed} tokens`);
  
  return {
    results: results.slice(0, contextParts.length),
    totalTokensUsed,
    availableTokens,
    truncated
  };
}

/**
 * Format RAG context for inclusion in LLM prompt
 */
export function formatRAGContextForPrompt(ragContext: RAGContext): string {
  if (ragContext.results.length === 0) {
    return '';
  }
  
  const contextLines = ragContext.results.map(result => {
    const source = result.source.toUpperCase();
    const timestamp = result.metadata?.timestamp ? 
      ` (${new Date(result.metadata.timestamp).toLocaleDateString()})` : '';
    return `[${source}${timestamp}] ${result.content}`;
  });
  
  let contextString = `[RELEVANT CONTEXT]\n${contextLines.join('\n\n')}\n[/RELEVANT CONTEXT]`;
  
  if (ragContext.truncated) {
    contextString += '\n\n(Note: Additional relevant information was found but truncated due to context window limits)';
  }
  
  return contextString;
}

/**
 * Enhanced memory search for user information (name, preferences, etc.)
 */
export async function searchUserMemory(query: string): Promise<RAGResult[]> {
  // Search for personal information in chat history
  const personalQueries = [
    'my name is',
    'i am',
    'i like',
    'i prefer',
    'i want to learn',
    'my goal',
    'call me'
  ];
  
  const results: RAGResult[] = [];
  
  for (const personalQuery of personalQueries) {
    const searchResults = await performRAGSearch(personalQuery, {
      maxResults: 3,
      sources: ['chat'],
      minRelevanceScore: 0.2
    });
    
    results.push(...searchResults);
  }
  
  // Also search for the specific query
  const queryResults = await performRAGSearch(query, {
    maxResults: 5,
    sources: ['chat'],
    minRelevanceScore: 0.3
  });
  
  results.push(...queryResults);
  
  // Deduplicate and sort by relevance
  const uniqueResults = results.filter((result, index, self) => 
    index === self.findIndex(r => r.metadata?.messageId === result.metadata?.messageId)
  );
  
  return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
} 