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

// Typed interface for DB rows
interface PersonalityRow { id: number; text_content: string; }
interface PersonalityRowWithMeta extends PersonalityRow { 
  category: string; 
  distance?: number; 
}

/**
 * Embeds all personality chunks into the database
 */
export async function embedPersonalityChunks(embeddingConfig: FunctionConfig): Promise<PersonalityEmbeddingResult> {
  console.log('[PersonalityService] Starting personality embedding...');
  console.log('[PersonalityService] EMBED DEBUG: Function called with config:', embeddingConfig);
  console.log('[PersonalityService] EMBED DEBUG: Timestamp at start:', new Date().toISOString());
  
  try {
    console.log('[PersonalityService] EMBED DEBUG: Getting database instance...');
    const db = await getDbInstance();
    console.log('[PersonalityService] EMBED DEBUG: Database instance obtained successfully');
    
    let chunksEmbedded = 0;
    
    // Create ai_personality table if it doesn't exist
    console.log('[PersonalityService] EMBED DEBUG: Creating ai_personality table if not exists...');
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
    console.log('[PersonalityService] EMBED DEBUG: Table creation query completed');
    
    // Check if table exists and get current count
    const tableCheck = await db.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_personality');`);
    const tableExists = (tableCheck.rows[0] as any)?.exists;
    console.log(`[PersonalityService] EMBED DEBUG: Table exists after creation: ${tableExists}`);
    
    if (tableExists) {
      const preDeleteCount = await db.query('SELECT COUNT(*) as count FROM ai_personality');
      const preCount = (preDeleteCount.rows[0] as any)?.count || 0;
      console.log(`[PersonalityService] EMBED DEBUG: Rows before DELETE: ${preCount}`);
    }
    
    // Clear existing personality data
    console.log('[PersonalityService] EMBED DEBUG: Clearing existing personality data...');
    const deleteResult = await db.query('DELETE FROM ai_personality');
    console.log('[PersonalityService] EMBED DEBUG: DELETE query completed, affected rows:', deleteResult.affectedRows);
    
    // Verify deletion
    const postDeleteCount = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    const postDeleteCountValue = (postDeleteCount.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService] EMBED DEBUG: Rows after DELETE: ${postDeleteCountValue}`);
    
    console.log(`[PersonalityService] EMBED DEBUG: About to embed ${personalityChunks.length} chunks`);
    
    // Embed each personality chunk
    for (const chunk of personalityChunks) {
      try {
        console.log(`[PersonalityService] Embedding chunk: ${chunk.category}`);
        console.log(`[PersonalityService] EMBED DEBUG: Chunk text length: ${chunk.text.length}`);
        
        const embeddingResult = await getEmbedding(chunk.text, embeddingConfig);
        console.log(`[PersonalityService] EMBED DEBUG: Embedding result for ${chunk.category}:`, embeddingResult ? `dimension ${embeddingResult.dimension}, vector length ${embeddingResult.embedding.length}` : 'null');
        
        if (!embeddingResult) {
          throw new Error(`Failed to generate embedding for chunk: ${chunk.category}`);
        }
        
        // Format embedding as PostgreSQL vector literal
        const embeddingVector = `[${embeddingResult.embedding.join(',')}]`;
        console.log(`[PersonalityService] EMBED DEBUG: Formatted vector for ${chunk.category}, first 5 values: [${embeddingResult.embedding.slice(0, 5).join(',')}...]`);
        
        // Insert with appropriate embedding dimension
        const embeddingField = `embedding_${embeddingResult.dimension}`;
        console.log(`[PersonalityService] EMBED DEBUG: About to INSERT into ${embeddingField} for ${chunk.category}`);
        
        const insertResult = await db.query(`
          INSERT INTO ai_personality (category, text_content, ${embeddingField}, active_embedding_dimension)
          VALUES ($1, $2, $3, $4)
        `, [chunk.category, chunk.text, embeddingVector, embeddingResult.dimension]);
        
        console.log(`[PersonalityService] EMBED DEBUG: INSERT completed for ${chunk.category}, affected rows:`, insertResult.affectedRows);
        
        // Verify the insert worked
        const verifyInsert = await db.query('SELECT COUNT(*) as count FROM ai_personality WHERE category = $1', [chunk.category]);
        const insertedCount = (verifyInsert.rows[0] as any)?.count || 0;
        console.log(`[PersonalityService] EMBED DEBUG: Verification - ${chunk.category} appears ${insertedCount} times in table`);
        
        chunksEmbedded++;
        console.log(`[PersonalityService] Successfully embedded: ${chunk.category} (${chunksEmbedded}/${personalityChunks.length})`);
        
      } catch (error) {
        console.error(`[PersonalityService] EMBED DEBUG: Failed to embed chunk ${chunk.category}:`, error);
        throw error; // Fail fast if any chunk fails
      }
    }
    
    // Final verification
    console.log('[PersonalityService] EMBED DEBUG: Final verification of all embedded data...');
    const finalCount = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    const finalCountValue = (finalCount.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService] EMBED DEBUG: Final count in database: ${finalCountValue}`);
    
    if (finalCountValue !== chunksEmbedded) {
      console.error(`[PersonalityService] EMBED DEBUG: MISMATCH! Expected ${chunksEmbedded} chunks, but database has ${finalCountValue}`);
    }
    
    // Sample the data to verify it's actually there
    const sampleData = await db.query('SELECT category, LEFT(text_content, 50) as text_preview FROM ai_personality LIMIT 3');
    console.log('[PersonalityService] EMBED DEBUG: Sample of embedded data:', sampleData.rows);
    
    console.log(`[PersonalityService] Successfully embedded ${chunksEmbedded} personality chunks`);
    console.log('[PersonalityService] EMBED DEBUG: Function completing successfully at:', new Date().toISOString());
    
    // CRITICAL DEBUG: Immediate verification with fresh query
    console.log('[PersonalityService] EMBED DEBUG: IMMEDIATE VERIFICATION - Testing data persistence...');
    try {
      // Wait a moment for any potential async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get a fresh database instance to test persistence
      const verifyDb = await getDbInstance();
      const immediateVerifyResult = await verifyDb.query('SELECT COUNT(*) as count FROM ai_personality');
      const immediateCount = (immediateVerifyResult.rows[0] as any)?.count || 0;
      console.log(`[PersonalityService] EMBED DEBUG: IMMEDIATE verification count: ${immediateCount}`);
      
      if (immediateCount === 0) {
        console.error('[PersonalityService] EMBED DEBUG: CRITICAL ISSUE - Data not persisted immediately after embedding!');
        
        // Check if table exists
        const tableCheck = await verifyDb.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_personality');`);
        const tableExists = (tableCheck.rows[0] as any)?.exists;
        console.log(`[PersonalityService] EMBED DEBUG: Table exists in immediate verification: ${tableExists}`);
        
        // Try to see what tables do exist
        const allTables = await verifyDb.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`);
        console.log('[PersonalityService] EMBED DEBUG: All tables during immediate verification:', allTables.rows.map(r => (r as any).table_name));
        
        return { 
          success: false, 
          chunksEmbedded: 0, 
          error: 'Data not persisted - immediate verification failed' 
        };
      } else {
        console.log(`[PersonalityService] EMBED DEBUG: IMMEDIATE verification PASSED - ${immediateCount} rows found`);
        
        // Sample the data to make sure it's real
        const sampleCheck = await verifyDb.query('SELECT category, LEFT(text_content, 30) as preview FROM ai_personality LIMIT 2');
        console.log('[PersonalityService] EMBED DEBUG: Sample data in immediate verification:', sampleCheck.rows);
      }
    } catch (verifyError) {
      console.error('[PersonalityService] EMBED DEBUG: Immediate verification failed with error:', verifyError);
      return { 
        success: false, 
        chunksEmbedded: 0, 
        error: `Immediate verification failed: ${verifyError}` 
      };
    }
    
    return { success: true, chunksEmbedded };
  } catch (error) {
    console.error('[PersonalityService] EMBED DEBUG: Function failed with error:', error);
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
  console.log('[PersonalityService] Hybrid search for personality context:', query);
  try {
    const db = await getDbInstance();
    
    // DEBUG: Check if ai_personality table exists
    const tableExistsResult = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_personality'
      );
    `);
    const tableExists = (tableExistsResult.rows[0] as any)?.exists;
    console.log(`[PersonalityService DEBUG] ai_personality table exists: ${tableExists}`);
    
    if (!tableExists) {
      console.log('[PersonalityService DEBUG] ai_personality table does not exist');
      return [];
    }
    
    // DEBUG: First check if we have any data at all
    const countResult = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    const totalRows = (countResult.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService DEBUG] Total personality rows in database: ${totalRows}`);
    
    if (totalRows === 0) {
      console.log('[PersonalityService DEBUG] No personality data found - personality needs to be embedded first');
      return [];
    }
    
    // Generate query embedding
    const queryEmbedding = await getEmbedding(query, embeddingConfig);
    if (!queryEmbedding) {
      console.log('[PersonalityService DEBUG] Failed to generate query embedding');
      return [];
    }
    const queryVector = JSON.stringify(queryEmbedding.embedding);
    
    // Determine embedding field based on actual embedding dimension
    const embeddingField = `embedding_${queryEmbedding.dimension}`;
    console.log(`[PersonalityService DEBUG] Using embedding field: ${embeddingField}`);
    
    // Semantic search with distance scoring
    const semRows = (await db.query(
      `SELECT id, text_content, category, ${embeddingField} <-> $1 as distance
       FROM ai_personality
       WHERE ${embeddingField} IS NOT NULL
       ORDER BY ${embeddingField} <-> $1
       LIMIT $2`,
      [queryVector, limit * 5]  // Increased pool size
    )).rows as PersonalityRowWithMeta[];
    
    // Keyword pass - FIX: More robust text matching
    const kwRows = (await db.query(
      `SELECT id, text_content, category
       FROM ai_personality
       WHERE text_content ILIKE ANY($1)`,
      [['%beyonce%', '%beyoncé%', '%blackpink%', '%music%', '%empowerment%', '%energy%', '%classical%', '%opera%']]
    )).rows as PersonalityRowWithMeta[];
    
    console.log(`[PersonalityService DEBUG] Semantic search found ${semRows.length} results`);
    console.log(`[PersonalityService DEBUG] Keyword search found ${kwRows.length} results`);
    
    if (semRows.length > 0) {
      console.log(`[PersonalityService DEBUG] Top semantic result: category="${semRows[0].category}", distance=${semRows[0].distance}`);
    }
    if (kwRows.length > 0) {
      console.log(`[PersonalityService DEBUG] Keyword results: ${kwRows.map(r => r.category).join(', ')}`);
    }
    
    // Combine and deduplicate by ID
    const seenIds = new Set<number>();
    const allCandidates: PersonalityRowWithMeta[] = [];
    
    // Add semantic results first (they have distance scores)
    for (const row of semRows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        allCandidates.push(row);
      }
    }
    
    // Add keyword results that weren't already included
    for (const row of kwRows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        allCandidates.push({ ...row, distance: 1.0 }); // Assign default distance for keyword matches
      }
    }
    
    console.log(`[PersonalityService DEBUG] Total unique candidates after fusion: ${allCandidates.length}`);
    
    // Take top results and return text content
    const finalResults = allCandidates.slice(0, limit);
    const contextTexts = finalResults.map(row => row.text_content);
    
    console.log(`[PersonalityService DEBUG] Returning ${contextTexts.length} personality chunks`);
    if (contextTexts.length > 0) {
      console.log(`[PersonalityService DEBUG] Sample result: "${contextTexts[0].substring(0, 100)}..."`);
    }
    
    return contextTexts;
  } catch (error) {
    console.error('[PersonalityService] Error in getPersonalityContext:', error);
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

/**
 * Manual function to re-embed personality chunks for testing/debugging
 * This can be called from the browser console to test the embedding process
 */
export async function manuallyEmbedPersonality(embeddingConfig: FunctionConfig): Promise<void> {
  console.log('[PersonalityService] MANUAL: Starting personality embedding...');
  
  try {
    const result = await embedPersonalityChunks(embeddingConfig);
    console.log('[PersonalityService] MANUAL: Embedding result:', result);
    
    // Verify the data was actually saved
    const db = await getDbInstance();
    const countResult = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    const totalRows = (countResult.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService] MANUAL: Verification - ${totalRows} rows in database after embedding`);
    
    if (totalRows > 0) {
      const sampleResult = await db.query('SELECT category, text_content FROM ai_personality LIMIT 2');
      console.log('[PersonalityService] MANUAL: Sample data:', sampleResult.rows);
    }
    
  } catch (error) {
    console.error('[PersonalityService] MANUAL: Failed to embed personality:', error);
  }
}

// Export for console access
(globalThis as any).manuallyEmbedPersonality = manuallyEmbedPersonality; 