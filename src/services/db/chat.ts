import { getDbInstance } from './init';
import type { Thread, ChatMessage } from '../../features/chat/types';
import type { PGlite } from '@electric-sql/pglite';

// Helper to convert DB row to Thread type (adjust as needed for embedding columns)
const mapDbRowToThread = (row: any): Thread => {
  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    lastActivity: row.last_activity_at,
    messages: [], // Messages will be loaded separately
    // TODO: Add logic to populate metadata_embedding fields based on active_metadata_embedding_dimension
  };
};

// Helper to convert DB row to ChatMessage type (adjust as needed for embedding columns)
const mapDbRowToChatMessage = (row: any): ChatMessage => {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text_content,
    timestamp: row.timestamp,
    ttsLang: row.tts_lang,
    alignmentData: row.tts_alignment_data ? JSON.parse(row.tts_alignment_data) : undefined,
    // TODO: Add logic to populate embedding fields based on active_embedding_dimension
  };
};

export const getAllChatThreads = async (): Promise<Thread[]> => {
  const db: PGlite = await getDbInstance();
  try {
    // const rows: any[] = await db.query(`
    const results = await db.query(`
      SELECT 
        id, 
        title, 
        system_prompt, 
        created_at, 
        last_activity_at
        -- TODO: Select correct metadata_embedding columns based on active_metadata_embedding_dimension
      FROM chat_threads 
      ORDER BY last_activity_at DESC
    `);
    // if (!rows || rows.length === 0) {
    //   return [];
    // }
    // return rows.map(mapDbRowToThread);
    const rows = results.rows; // Assuming 'rows' is the property holding the array
    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map(mapDbRowToThread);
  } catch (error) {
    console.error('[DB ChatService] Error fetching all chat threads:', error);
    throw error; 
  }
};

export const getChatMessagesByThreadId = async (threadId: string): Promise<ChatMessage[]> => {
  const db: PGlite = await getDbInstance();
  try {
    // const rows: any[] = await db.query(`
    const results = await db.query(`
      SELECT 
        id, 
        sender, 
        text_content, 
        timestamp, 
        tts_lang, 
        tts_alignment_data
        -- TODO: Select correct embedding columns based on active_embedding_dimension
      FROM chat_messages 
      WHERE thread_id = ?1 
      ORDER BY timestamp ASC
    `, [threadId]);
    // if (!rows || rows.length === 0) {
    //   return [];
    // }
    // return rows.map(mapDbRowToChatMessage);
    const rows = results.rows; // Assuming 'rows' is the property holding the array
    if (!rows || rows.length === 0) {
      return [];
    }
    return rows.map(mapDbRowToChatMessage);
  } catch (error) {
    console.error(`[DB ChatService] Error fetching messages for thread ${threadId}:`, error);
    throw error;
  }
};

export interface NewChatThreadData {
  id: string; 
  title: string;
  systemPrompt?: string;
}

export const addChatThread = async (threadData: NewChatThreadData): Promise<Thread> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    // await db.run(
    await db.query(
      'INSERT INTO chat_threads (id, title, system_prompt, created_at, last_activity_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      [threadData.id, threadData.title, threadData.systemPrompt || null, now, now] // Ensure systemPrompt is null if undefined
    );
    const newThread: Thread = {
      id: threadData.id,
      title: threadData.title,
      systemPrompt: threadData.systemPrompt || '',
      createdAt: now,
      lastActivity: now,
      messages: [],
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
}

export const addChatMessage = async (messageData: NewChatMessageData): Promise<ChatMessage> => {
  const db: PGlite = await getDbInstance();
  const now = new Date().toISOString();
  try {
    // await db.run(
    await db.query(
      'INSERT INTO chat_messages (id, thread_id, sender, text_content, timestamp, tts_lang, tts_alignment_data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      [
        messageData.id,
        messageData.thread_id,
        messageData.sender,
        messageData.text_content,
        now, 
        messageData.tts_lang || null, // Ensure null if undefined
        messageData.tts_alignment_data ? JSON.stringify(messageData.tts_alignment_data) : null
      ]
    );
    // await db.run(
    await db.query(
      'UPDATE chat_threads SET last_activity_at = ?1 WHERE id = ?2',
      [now, messageData.thread_id]
    );

    const newMessage: ChatMessage = {
      id: messageData.id,
      sender: messageData.sender,
      text: messageData.text_content,
      timestamp: now,
      ttsLang: messageData.tts_lang,
      alignmentData: messageData.tts_alignment_data,
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
    // await db.run(
    await db.query(
      'UPDATE chat_threads SET last_activity_at = ?1 WHERE id = ?2',
      [now, threadId]
    );
  } catch (error) {
    console.error(`[DB ChatService] Error updating last_activity_at for thread ${threadId}:`, error);
    throw error;
  }
}; 