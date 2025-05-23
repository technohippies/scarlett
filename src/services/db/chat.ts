import { getDbInstance } from './init';
import type { Thread, ChatMessage } from '../../features/chat/types';
import type { PGlite } from '@electric-sql/pglite';

// Helper to convert DB row to Thread type (adjust as needed for embedding columns)
const mapDbRowToThread = (row: any): Thread => {
  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt,
    scenarioDescription: row.scenario_description,
    createdAt: row.created_at,
    lastActivity: row.last_activity_at,
    messages: [], // Messages will be loaded separately
    embedding_512: row.embedding_512 ? JSON.parse(row.embedding_512) : null,
    embedding_768: row.embedding_768 ? JSON.parse(row.embedding_768) : null,
    embedding_1024: row.embedding_1024 ? JSON.parse(row.embedding_1024) : null,
    active_embedding_dimension: row.active_embedding_dimension,
  };
};

// Helper to convert DB row to ChatMessage type (adjust as needed for embedding columns)
const mapDbRowToChatMessage = (row: any): ChatMessage => {
  return {
    id: row.id,
    thread_id: row.thread_id,
    sender: row.sender as 'user' | 'ai',
    text_content: row.text_content,
    timestamp: row.timestamp,
    tts_lang: row.tts_lang,
    alignmentData: row.tts_alignment_data ? JSON.parse(row.tts_alignment_data) : null,
    embedding_512: row.embedding_512 ? JSON.parse(row.embedding_512) : null,
    embedding_768: row.embedding_768 ? JSON.parse(row.embedding_768) : null,
    embedding_1024: row.embedding_1024 ? JSON.parse(row.embedding_1024) : null,
    active_embedding_dimension: row.active_embedding_dimension,
    isStreaming: row.is_streaming === 1,
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
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 512 | 768 | 1024 | null;
}

export const addChatThread = async (threadData: NewChatThreadData): Promise<Thread> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    await db.query(
      `INSERT INTO chat_threads (
         id, title, system_prompt, created_at, last_activity_at, 
         scenario_description, embedding_model_id, last_embedded_at, 
         embedding_512, embedding_768, embedding_1024, active_embedding_dimension
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
      [
        threadData.id,
        threadData.title,
        threadData.systemPrompt || '',
        now,
        now,
        threadData.scenarioDescription ?? null,
        null,
        null,

        threadData.embedding_512 ? JSON.stringify(threadData.embedding_512) : null,
        threadData.embedding_768 ? JSON.stringify(threadData.embedding_768) : null,
        threadData.embedding_1024 ? JSON.stringify(threadData.embedding_1024) : null,
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
  embedding_512?: number[] | null;
  embedding_768?: number[] | null;
  embedding_1024?: number[] | null;
  active_embedding_dimension?: 512 | 768 | 1024 | null;
}

export const addChatMessage = async (messageData: NewChatMessageData): Promise<ChatMessage> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO chat_messages (id, thread_id, sender, text_content, timestamp, tts_lang, tts_alignment_data, embedding_512, embedding_768, embedding_1024, active_embedding_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [
          messageData.id,
          messageData.thread_id,
          messageData.sender,
          messageData.text_content,
          now,
          messageData.tts_lang ?? null,
          messageData.tts_alignment_data ? JSON.stringify(messageData.tts_alignment_data) : null,
          messageData.embedding_512 ? JSON.stringify(messageData.embedding_512) : null,
          messageData.embedding_768 ? JSON.stringify(messageData.embedding_768) : null,
          messageData.embedding_1024 ? JSON.stringify(messageData.embedding_1024) : null,
          messageData.active_embedding_dimension ?? null,
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
      'UPDATE chat_threads SET last_activity_at = ? WHERE id = ?',
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
    embedding_512?: number[] | null;
    embedding_768?: number[] | null;
    embedding_1024?: number[] | null;
    active_embedding_dimension?: 512 | 768 | 1024 | null;
  }
): Promise<Thread | null> => {
  if (Object.keys(updates).length === 0) {
    const currentThreadResult = await db.query('SELECT * FROM chat_threads WHERE id = ?', [threadId]);
    return currentThreadResult.rows.length > 0 ? mapDbRowToThread(currentThreadResult.rows[0]) : null;
  }

  const now = new Date().toISOString();
  const fieldsToUpdate: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fieldsToUpdate.push('title = ?');
    values.push(updates.title);
  }
  if (updates.systemPrompt !== undefined) {
    fieldsToUpdate.push('system_prompt = ?');
    values.push(updates.systemPrompt);
  }
  if (updates.embedding_512 !== undefined) {
    fieldsToUpdate.push('embedding_512 = ?');
    values.push(updates.embedding_512 ? JSON.stringify(updates.embedding_512) : null);
  }
  if (updates.embedding_768 !== undefined) {
    fieldsToUpdate.push('embedding_768 = ?');
    values.push(updates.embedding_768 ? JSON.stringify(updates.embedding_768) : null);
  }
  if (updates.embedding_1024 !== undefined) {
    fieldsToUpdate.push('embedding_1024 = ?');
    values.push(updates.embedding_1024 ? JSON.stringify(updates.embedding_1024) : null);
  }
  if (updates.active_embedding_dimension !== undefined) {
    fieldsToUpdate.push('active_embedding_dimension = ?');
    values.push(updates.active_embedding_dimension ?? null);
  }
  
  if (fieldsToUpdate.length === 0) {
    const currentThreadResult = await db.query('SELECT * FROM chat_threads WHERE id = ?', [threadId]);
    return currentThreadResult.rows.length > 0 ? mapDbRowToThread(currentThreadResult.rows[0]) : null;
  }

  fieldsToUpdate.push('last_activity_at = ?');
  values.push(now);
  values.push(threadId);

  const sql = `UPDATE chat_threads SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;

  try {
    await db.query(sql, values);
    const result = await db.query('SELECT * FROM chat_threads WHERE id = ?', [threadId]);
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
      await tx.query('DELETE FROM chat_messages WHERE thread_id = ?', [threadId]);
      await tx.query('DELETE FROM chat_threads WHERE id = ?', [threadId]);
    });
    return true;
  } catch (error) {
    console.error(`Error deleting chat thread ${threadId}:`, error);
    return false;
  }
}; 