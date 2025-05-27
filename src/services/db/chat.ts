import { getDbInstance } from './init';
import type { Thread, ChatMessage } from '../../features/chat/types';
import type { PGlite } from '@electric-sql/pglite';

// Helper to convert DB row to Thread type (adjust as needed for embedding columns)
const mapDbRowToThread = (row: any): Thread => {
  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt || '',
    scenarioDescription: row.scenario_description,
    createdAt: row.created_at,
    lastActivity: row.last_activity_at,
    messages: [], // Messages are loaded separately
    embedding_384: row.embedding_384,
    embedding_512: row.embedding_512,
    embedding_768: row.embedding_768,
    embedding_1024: row.embedding_1024,
    active_embedding_dimension: row.active_embedding_dimension,
  };
};

// Helper to convert DB row to ChatMessage type (adjust as needed for embedding columns)
const mapDbRowToChatMessage = (row: any): ChatMessage => {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender: row.sender,
    text_content: row.text_content,
    timestamp: row.timestamp,
    tts_lang: row.tts_lang,
    alignmentData: row.tts_alignment_data ? JSON.parse(row.tts_alignment_data) : undefined,
    embedding_384: row.embedding_384,
    embedding_512: row.embedding_512,
    embedding_768: row.embedding_768,
    embedding_1024: row.embedding_1024,
    active_embedding_dimension: row.active_embedding_dimension,
  };
};

export const getAllChatThreads = async (): Promise<Thread[]> => {
  const db: PGlite = await getDbInstance();
  try {
    const results = await db.query(`
      SELECT 
        id, 
        title, 
        system_prompt, 
        scenario_description, 
        created_at, 
        last_activity_at,
        embedding_384,
        embedding_512,
        embedding_768,
        embedding_1024,
        active_embedding_dimension
      FROM chat_threads 
      ORDER BY last_activity_at DESC
    `);
    const rows = results.rows;
    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map(mapDbRowToThread);
  } catch (error) {
    console.error('[DB ChatService] Error fetching all chat threads:', error);
    return [];
  }
};

export const getChatMessagesByThreadId = async (threadId: string): Promise<ChatMessage[]> => {
  const db: PGlite = await getDbInstance();
  try {
    const results = await db.query(`
      SELECT 
        id, 
        thread_id,
        sender, 
        text_content, 
        timestamp, 
        tts_lang, 
        tts_alignment_data,
        embedding_384,
        embedding_512,
        embedding_768,
        embedding_1024,
        active_embedding_dimension
      FROM chat_messages 
      WHERE thread_id = $1 
      ORDER BY timestamp ASC
    `, [threadId]);
    const rows = results.rows;
    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map(mapDbRowToChatMessage);
  } catch (error) {
    console.error(`[DB ChatService] Error fetching messages for thread ${threadId}:`, error);
    return [];
  }
};

export interface NewChatThreadData {
  id: string; 
  title: string;
  systemPrompt?: string;
  scenarioDescription?: string;
  embedding_384?: number[] | null;
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 384 | 512 | 768 | 1024 | null;
}

export const addChatThread = async (threadData: NewChatThreadData): Promise<Thread> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    // Format embeddings as PostgreSQL vector literals
    const embedding_384 = threadData.embedding_384 ? `[${threadData.embedding_384.join(',')}]` : null;
    const embedding_512 = threadData.embedding_512 ? `[${threadData.embedding_512.join(',')}]` : null;
    const embedding_768 = threadData.embedding_768 ? `[${threadData.embedding_768.join(',')}]` : null;
    const embedding_1024 = threadData.embedding_1024 ? `[${threadData.embedding_1024.join(',')}]` : null;
    
    await db.query(
      `INSERT INTO chat_threads (
         id, title, system_prompt, created_at, last_activity_at, 
         scenario_description, embedding_model_id, last_embedded_at, 
         embedding_384, embedding_512, embedding_768, embedding_1024, active_embedding_dimension
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
      [
        threadData.id,
        threadData.title,
        threadData.systemPrompt || '',
        now,
        now,
        threadData.scenarioDescription ?? null,
        null,
        null,
        embedding_384,
        embedding_512,
        embedding_768,
        embedding_1024,
        threadData.active_embedding_dimension ?? null,
      ]
    );
    const newThread: Thread = {
      id: threadData.id,
      title: threadData.title,
      systemPrompt: threadData.systemPrompt || '',
      scenarioDescription: threadData.scenarioDescription,
      createdAt: now,
      lastActivity: now,
      messages: [],
      embedding_384: threadData.embedding_384,
      embedding_512: threadData.embedding_512,
      embedding_768: threadData.embedding_768,
      embedding_1024: threadData.embedding_1024,
      active_embedding_dimension: threadData.active_embedding_dimension,
    };
    return newThread;
  } catch (error) {
    console.error('[DB ChatService] Error adding new chat thread:', error);
    throw error;
  }
};

export interface NewChatMessageData {
  id: string; 
  thread_id: string;
  sender: 'user' | 'ai';
  text_content: string;
  tts_lang?: string;
  tts_alignment_data?: any; 
  embedding_384?: number[] | null;
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 384 | 512 | 768 | 1024 | null;
}

export const addChatMessage = async (messageData: NewChatMessageData): Promise<ChatMessage> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    await db.transaction(async (tx) => {
      // Format embeddings as PostgreSQL vector literals
      const embedding_384 = messageData.embedding_384 ? `[${messageData.embedding_384.join(',')}]` : null;
      const embedding_512 = messageData.embedding_512 ? `[${messageData.embedding_512.join(',')}]` : null;
      const embedding_768 = messageData.embedding_768 ? `[${messageData.embedding_768.join(',')}]` : null;
      const embedding_1024 = messageData.embedding_1024 ? `[${messageData.embedding_1024.join(',')}]` : null;
      
      await tx.query(
        `INSERT INTO chat_messages (id, thread_id, sender, text_content, timestamp, tts_lang, tts_alignment_data, embedding_384, embedding_512, embedding_768, embedding_1024, active_embedding_dimension, processed_for_embedding_at, embedding_model_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
        [
          messageData.id,
          messageData.thread_id,
          messageData.sender,
          messageData.text_content,
          now,
          messageData.tts_lang ?? null,
          messageData.tts_alignment_data ? JSON.stringify(messageData.tts_alignment_data) : null,
          embedding_384,
          embedding_512,
          embedding_768,
          embedding_1024,
          messageData.active_embedding_dimension ?? null,
          messageData.embedding_384 || messageData.embedding_512 || messageData.embedding_768 || messageData.embedding_1024 ? now : null, // Set processed_for_embedding_at if any embedding exists
          null, // embedding_model_id - we can add this to the interface later if needed
        ]
      );
      await tx.query(
        'UPDATE chat_threads SET last_activity_at = $1 WHERE id = $2',
        [now, messageData.thread_id]
      );
    });

    const newMessage: ChatMessage = {
      id: messageData.id,
      thread_id: messageData.thread_id,
      sender: messageData.sender,
      text_content: messageData.text_content,
      timestamp: now,
      tts_lang: messageData.tts_lang,
      alignmentData: messageData.tts_alignment_data,
      embedding_384: messageData.embedding_384,
      embedding_512: messageData.embedding_512,
      embedding_768: messageData.embedding_768,
      embedding_1024: messageData.embedding_1024,
      active_embedding_dimension: messageData.active_embedding_dimension,
    };
    return newMessage;
  } catch (error) {
    console.error('[DB ChatService] Error adding new chat message:', error);
    throw error;
  }
};

export const updateThreadLastActivity = async (threadId: string): Promise<void> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    await db.query(
      'UPDATE chat_threads SET last_activity_at = $1 WHERE id = $2',
      [now, threadId]
    );
  } catch (error) {
    console.error(`[DB ChatService] Error updating last_activity_at for thread ${threadId}:`, error);
    throw error;
  }
};

export const updateChatThread = async (
  db: PGlite,
  threadId: string,
  updates: {
    title?: string;
    systemPrompt?: string;
    embedding_384?: number[] | null;
    embedding_512?: number[] | null;
    embedding_768?: number[] | null;
    embedding_1024?: number[] | null;
    active_embedding_dimension?: 384 | 512 | 768 | 1024 | null;
  }
): Promise<Thread | null> => {
  if (Object.keys(updates).length === 0) {
    const currentThreadResult = await db.query('SELECT * FROM chat_threads WHERE id = $1', [threadId]);
    return currentThreadResult.rows.length > 0 ? mapDbRowToThread(currentThreadResult.rows[0]) : null;
  }

  const now = new Date().toISOString();
  const fieldsToUpdate: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    fieldsToUpdate.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.systemPrompt !== undefined) {
    fieldsToUpdate.push(`system_prompt = $${paramIndex++}`);
    values.push(updates.systemPrompt);
  }
  if (updates.embedding_384 !== undefined) {
    fieldsToUpdate.push(`embedding_384 = $${paramIndex++}`);
    values.push(updates.embedding_384 ?? null);
  }
  if (updates.embedding_512 !== undefined) {
    fieldsToUpdate.push(`embedding_512 = $${paramIndex++}`);
    values.push(updates.embedding_512 ?? null);
  }
  if (updates.embedding_768 !== undefined) {
    fieldsToUpdate.push(`embedding_768 = $${paramIndex++}`);
    values.push(updates.embedding_768 ?? null);
  }
  if (updates.embedding_1024 !== undefined) {
    fieldsToUpdate.push(`embedding_1024 = $${paramIndex++}`);
    values.push(updates.embedding_1024 ?? null);
  }
  if (updates.active_embedding_dimension !== undefined) {
    fieldsToUpdate.push(`active_embedding_dimension = $${paramIndex++}`);
    values.push(updates.active_embedding_dimension ?? null);
  }
  
  if (fieldsToUpdate.length === 0) {
    const currentThreadResult = await db.query('SELECT * FROM chat_threads WHERE id = $1', [threadId]);
    return currentThreadResult.rows.length > 0 ? mapDbRowToThread(currentThreadResult.rows[0]) : null;
  }

  fieldsToUpdate.push(`last_activity_at = $${paramIndex++}`);
  values.push(now);
  values.push(threadId);

  const sql = `UPDATE chat_threads SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex}`;

  try {
    await db.query(sql, values);
    const result = await db.query('SELECT * FROM chat_threads WHERE id = $1', [threadId]);
    return result.rows.length > 0 ? mapDbRowToThread(result.rows[0]) : null;
  } catch (error) {
    console.error(`Error updating chat thread ${threadId}:`, error);
    return null;
  }
};

export const updateChatThreadTitle = async (threadId: string, newTitle: string): Promise<void> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString(); // To update last_activity_at as well
  try {
    console.log(`[DB ChatService] Updating title for thread ${threadId} to "${newTitle}"`);
    await db.query(
      'UPDATE chat_threads SET title = $1, last_activity_at = $2 WHERE id = $3',
      [newTitle, now, threadId]
    );
    console.log(`[DB ChatService] Successfully updated title for thread ${threadId}.`);
  } catch (error) {
    console.error(`[DB ChatService] Error updating title for thread ${threadId}:`, error);
    throw error; // Re-throw to allow caller to handle
  }
};

export const deleteChatThread = async (db: PGlite, threadId: string): Promise<boolean> => {
  try {
    await db.transaction(async (tx) => {
      await tx.query('DELETE FROM chat_messages WHERE thread_id = $1', [threadId]);
      await tx.query('DELETE FROM chat_threads WHERE id = $1', [threadId]);
    });
    return true;
  } catch (error) {
    console.error(`Error deleting chat thread ${threadId}:`, error);
    return false;
  }
}; 