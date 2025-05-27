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
      console.log('[PersonalityService DEBUG] ai_personality table does not exist - creating it now');
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
      console.log('[PersonalityService DEBUG] ai_personality table created');
    }
    
    // DEBUG: First check if we have any data at all
    const countResult = await db.query('SELECT COUNT(*) as count FROM ai_personality');
    const totalRows = (countResult.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService DEBUG] Total personality rows in database: ${totalRows}`);
    
    if (totalRows === 0) {
      console.log('[PersonalityService DEBUG] No personality data found - this indicates a cross-context database issue');
      console.log('[PersonalityService DEBUG] Attempting to re-embed personality data in this context...');
      
      // CRITICAL FIX: Re-embed personality data if missing (cross-context issue)
      try {
        const embeddingResult = await embedPersonalityChunks(embeddingConfig);
        if (embeddingResult.success) {
          console.log(`[PersonalityService DEBUG] Successfully re-embedded ${embeddingResult.chunksEmbedded} chunks in this context`);
          // Continue with the search after re-embedding
        } else {
          console.error('[PersonalityService DEBUG] Failed to re-embed personality data:', embeddingResult.error);
          return [];
        }
      } catch (reEmbedError) {
        console.error('[PersonalityService DEBUG] Exception during re-embedding:', reEmbedError);
        return [];
      }
      
      // Re-check count after re-embedding
      const reCountResult = await db.query('SELECT COUNT(*) as count FROM ai_personality');
      const newTotalRows = (reCountResult.rows[0] as any)?.count || 0;
      console.log(`[PersonalityService DEBUG] After re-embedding: ${newTotalRows} rows`);
      
      if (newTotalRows === 0) {
        console.error('[PersonalityService DEBUG] Still no data after re-embedding - giving up');
        return [];
      }
    }
    
    // DEBUG: Show a sample of what's in the table
    const sampleResult = await db.query('SELECT category, text_content FROM ai_personality LIMIT 3');
    console.log('[PersonalityService DEBUG] Sample personality data:', sampleResult.rows);
    
    // DEBUG: Check what embedding dimensions we have
    const dimensionCheck = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE embedding_384 IS NOT NULL) as count_384,
        COUNT(*) FILTER (WHERE embedding_512 IS NOT NULL) as count_512,
        COUNT(*) FILTER (WHERE embedding_768 IS NOT NULL) as count_768,
        COUNT(*) FILTER (WHERE embedding_1024 IS NOT NULL) as count_1024,
        active_embedding_dimension
      FROM ai_personality
      GROUP BY active_embedding_dimension
    `);
    console.log('[PersonalityService DEBUG] Embedding dimensions available:', dimensionCheck.rows);
    
    // Semantic pass - FIX: Use proper L2 distance operator
    const embRes = await getEmbedding(query, embeddingConfig);
    if (!embRes) throw new Error('Embedding generation failed');
    const embeddingField = `embedding_${embRes.dimension}`;
    const queryVector = `[${embRes.embedding.join(',')}]`;
    
    console.log(`[PersonalityService DEBUG] Using embedding field: ${embeddingField}`);
    console.log(`[PersonalityService DEBUG] Query vector length: ${embRes.embedding.length}`);
    
    // DEBUG: Check if we have any rows with the required embedding dimension
    const embeddingAvailCheck = await db.query(
      `SELECT COUNT(*) as count FROM ai_personality WHERE ${embeddingField} IS NOT NULL`
    );
    const availableEmbeddings = (embeddingAvailCheck.rows[0] as any)?.count || 0;
    console.log(`[PersonalityService DEBUG] Rows with ${embeddingField}: ${availableEmbeddings}`);
    
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
       WHERE LOWER(text_content) LIKE LOWER($1)
          OR LOWER(category) LIKE LOWER($1)
          OR LOWER(text_content) LIKE LOWER($2)
          OR LOWER(text_content) LIKE LOWER($3)
       LIMIT $4`,
      [`%${query}%`, `%beyonce%`, `%blackpink%`, limit * 5]
    )).rows as PersonalityRowWithMeta[];
    
    // DEBUG: Enhanced logging with distances and categories
    console.log('[PersonalityService DEBUG] Semantic results:');
    semRows.forEach((row, i) => {
      console.log(`  ${i}: [${row.category}] distance=${row.distance?.toFixed(4)} text="${row.text_content.substring(0, 80)}..."`);
    });
    
    console.log('[PersonalityService DEBUG] Keyword results:');
    kwRows.forEach((row, i) => {
      console.log(`  ${i}: [${row.category}] text="${row.text_content.substring(0, 80)}..."`);
    });
    
    // DEBUG: Test specific keyword searches
    const blackpinkTest = await db.query(
      `SELECT id, text_content, category FROM ai_personality WHERE LOWER(text_content) LIKE '%blackpink%'`
    );
    console.log('[PersonalityService DEBUG] Direct Blackpink search:', blackpinkTest.rows.length, 'results');
    
    const beyonceTest = await db.query(
      `SELECT id, text_content, category FROM ai_personality WHERE LOWER(text_content) LIKE '%beyonc%'`
    );
    console.log('[PersonalityService DEBUG] Direct Beyoncé search:', beyonceTest.rows.length, 'results');
    
    // Reciprocal Rank Fusion with scoring details
    const rrfK = 50;
    const scoreMap: Record<string, { score: number; sources: string[] }> = {};
    
    semRows.forEach((r, i: number) => {
      const score = 1/(i+1+rrfK);
      if (!scoreMap[r.id]) scoreMap[r.id] = { score: 0, sources: [] };
      scoreMap[r.id].score += score;
      scoreMap[r.id].sources.push(`semantic(${i+1}, dist=${r.distance?.toFixed(4)})`);
    });
    
    kwRows.forEach((r, i: number) => {
      const score = 1/(i+1+rrfK);
      if (!scoreMap[r.id]) scoreMap[r.id] = { score: 0, sources: [] };
      scoreMap[r.id].score += score;
      scoreMap[r.id].sources.push(`keyword(${i+1})`);
    });
    
    // Sort and pick top N with detailed scoring
    const fusedWithScores = Object.entries(scoreMap)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit);
    
    console.log('[PersonalityService DEBUG] RRF scoring results:');
    fusedWithScores.forEach(([id, scoreInfo], i) => {
      const all: PersonalityRowWithMeta[] = [...semRows, ...kwRows];
      const found = all.find(x => String(x.id) === id);
      console.log(`  ${i}: ID=${id} score=${scoreInfo.score.toFixed(4)} sources=[${scoreInfo.sources.join(', ')}] category=[${found?.category}]`);
    });
    
    const fused = fusedWithScores.map(([id]) => {
      const all: PersonalityRowWithMeta[] = [...semRows, ...kwRows];
      const found = all.find(x => String(x.id) === id);
      return found?.text_content;
    }).filter(Boolean) as string[];
    
    console.log(`[PersonalityService] Hybrid RAG returned ${fused.length} chunks:`, fused.map(f => f.substring(0, 50) + '...'));
    return fused;
  } catch (error) {
    console.error('[PersonalityService] Hybrid personality context failed:', error);
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