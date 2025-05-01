// src/services/llm/types.ts

// Basic configuration for any LLM provider
export interface LLMConfig {
  provider: string; // e.g., 'ollama', 'jan'
  model: string; // Model ID
  baseUrl: string; // Base URL of the LLM server
  apiKey?: string; // Optional API key
  stream?: boolean; // Optional flag for streaming responses
  extraParams?: Record<string, any>; // Optional extra parameters for the API call
}

// Information about a specific model provided by an LLM service
export interface ModelInfo {
  id: string; // Unique identifier for the model
  provider: string; // Provider ID ('ollama', 'jan')
  name?: string; // User-friendly name (optional, can be same as id)
  size?: number; // Model size in bytes (optional)
  modified_at?: string; // Last modified timestamp (optional)
  // Add other provider-specific fields if needed
}

// --- Chat Types --- 

// Represents a single message in a chat conversation
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Common structure for non-streaming chat responses (OpenAI compatible)
export interface LLMChatResponse {
  id: string;
  object: string; // e.g., 'chat.completion'
  created: number; // Unix timestamp
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
    logprobs?: any; // Optional log probabilities
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string; // Optional system fingerprint
}

// Jan-specific response type if it differs significantly (currently assuming matches LLMChatResponse)
// If Jan's non-streaming response is different, define it here.
// For now, we can alias it or just use LLMChatResponse.
export type JanChatResponse = LLMChatResponse;

// Define the structure for parts yielded by a streaming chat response
export type StreamedChatResponsePart = 
  | { type: 'content'; content: string } 
  | { type: 'error'; error: string };

// --- Embedding Types (OpenAI compatible) --- 

export type EmbeddingInput = string | string[];

export interface Embedding {
  object: 'embedding';
  embedding: number[]; // The actual vector embedding
  index: number;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponse {
  object: 'list'; // Always 'list' for embedding responses
  data: Embedding[];
  model: string; // Model used for embedding
  usage?: EmbeddingUsage; // Usage statistics (optional)
}

// Represents the standard interface for an LLM provider
export interface LLMProvider {
  listModels: (config: Pick<LLMConfig, 'baseUrl' | 'apiKey'>) => Promise<ModelInfo[]>;
  // Chat can be non-streaming or streaming
  // Updated signature: Accepts ChatMessage[], yields StreamedChatResponsePart
  chat: (
    messages: ChatMessage[], 
    config: LLMConfig
  ) => Promise<LLMChatResponse> | AsyncGenerator<StreamedChatResponsePart>; // Yield structured parts
  embed: (text: EmbeddingInput, config: LLMConfig) => Promise<EmbeddingResponse>;
  // Add other methods like tts, etc., if needed
  // tts?: (...) => Promise<any>;
} 