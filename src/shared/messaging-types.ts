import type { AlignmentData } from "../features/translator/TranslatorWidget";

/**
 * Payload sent from the background script to the content script
 * to display the translator widget with the translation result.
 */
export interface DisplayTranslationPayload {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  pronunciation?: string;
  contextText?: string; // Optional context from where the text was selected
}

/**
 * Payload sent from the content script (TranslatorWidget)
 * to the background script to request TTS audio generation.
 */
export interface GenerateTTSPayload {
  text: string;
  lang: string;
  speed: number;
}

/**
 * Payload sent from the background script to the content script
 * to update the widget with word alignment data after TTS generation.
 */
export interface UpdateAlignmentPayload {
  alignment: AlignmentData | null;
  // TODO: Consider adding an identifier if multiple widgets could exist
  // or if the request/response needs explicit linking.
  // widgetId?: string;
} 