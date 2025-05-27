import { getDbInstance } from '../db/init';
import { getEmbedding } from './embedding';
import type { FunctionConfig } from '../storage/types';
import personalityChunks from './prompts/personality-embeddable.json';

export interface PersonalityChunk {
  category: string;
  text: string;
}

export interface PersonalityEmbeddingResult {
  success: boolean;
  chunksEmbedded: number;
  error?: string;
}

/**
 * Embeds all personality chunks into the database
 */
export async function embedPersonalityChunks(embeddingConfig: FunctionConfig): Promise<PersonalityEmbeddingResult> {
  console.log('[PersonalityService] Starting personality embedding...');
  
  try {
    const db = await getDbInstance();
    let chunksEmbedded = 0;
    
    // Create ai_personality table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_personality (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        text_content TEXT NOT NULL,
        embedding_384 vector(384) NULL,
        embedding_512 vector(512) NULL,
        embedding_768 vector(768) NULL,
        embedding_1024 vector(1024) NULL,
        active_embedding_dimension INTEGER NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Clear existing personality data
    await db.query('DELETE FROM ai_personality');
    
    // Embed each personality chunk
    for (const chunk of personalityChunks) {
      try {
        console.log(`[PersonalityService] Embedding chunk: ${chunk.category}`);
        
        const embeddingResult = await getEmbedding(chunk.text, embeddingConfig);
        
        if (!embeddingResult) {
          throw new Error(`Failed to generate embedding for chunk: ${chunk.category}`);
        }
        
        // Format embedding as PostgreSQL vector literal
        const embeddingVector = `[${embeddingResult.embedding.join(',')}]`;
        
        // Insert with appropriate embedding dimension
        const embeddingField = `embedding_${embeddingResult.dimension}`;
        await db.query(`
          INSERT INTO ai_personality (category, text_content, ${embeddingField}, active_embedding_dimension)
          VALUES ($1, $2, $3, $4)
        `, [chunk.category, chunk.text, embeddingVector, embeddingResult.dimension]);
        
        chunksEmbedded++;
        console.log(`[PersonalityService] Successfully embedded: ${chunk.category}`);
        
      } catch (error) {
        console.error(`[PersonalityService] Failed to embed chunk ${chunk.category}:`, error);
        throw error; // Fail fast if any chunk fails
      }
    }
    
    console.log(`[PersonalityService] Successfully embedded ${chunksEmbedded} personality chunks`);
    return { success: true, chunksEmbedded };
    
  } catch (error) {
    console.error('[PersonalityService] Failed to embed personality:', error);
    return { 
      success: false, 
      chunksEmbedded: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Retrieves relevant personality chunks based on a query
 */
export async function getPersonalityContext(query: string, embeddingConfig: FunctionConfig, limit = 3): Promise<string[]> {
  try {
    const db = await getDbInstance();
    
    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query, embeddingConfig);
    
    if (!queryEmbedding) {
      console.error('[PersonalityService] Failed to generate query embedding');
      return [];
    }
    
    const queryVector = `[${queryEmbedding.embedding.join(',')}]`;
    const embeddingField = `embedding_${queryEmbedding.dimension}`;
    
    // Search for similar personality chunks
    const results = await db.query(`
      SELECT text_content, category,
             ${embeddingField} <#> $1 as distance
      FROM ai_personality 
      WHERE ${embeddingField} IS NOT NULL
      ORDER BY distance
      LIMIT $2
    `, [queryVector, limit]);
    
    if (results.rows.length === 0) {
      console.log('[PersonalityService] No personality chunks found');
      return [];
    }
    
    console.log(`[PersonalityService] Retrieved ${results.rows.length} personality chunks for query: "${query}"`);
    return results.rows.map((row: any) => row.text_content);
    
  } catch (error) {
    console.error('[PersonalityService] Failed to retrieve personality context:', error);
    return [];
  }
}

/**
 * Checks if personality has been embedded
 */
export async function isPersonalityEmbedded(): Promise<boolean> {
  try {
    const db = await getDbInstance();
    const result = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    return (result.rows[0] as any)?.count > 0;
  } catch (error) {
    console.error('[PersonalityService] Failed to check personality embedding status:', error);
    return false;
  }
} 