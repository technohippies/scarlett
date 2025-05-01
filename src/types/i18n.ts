// src/types/i18n.ts

// Define a shared type for the structure of messages.json files
export type Messages = {
  [key: string]: { message: string; description?: string };
}; 