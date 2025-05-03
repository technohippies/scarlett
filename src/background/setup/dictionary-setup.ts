import { parse } from 'csv-parse/browser/esm/sync'; // Using a browser-compatible sync parser

// Define the structure for a dictionary entry
interface DictionaryEntry {
  translation: string;
  definition: string; // Keep the definition from the CSV
}

// Main map to hold all loaded dictionaries, keyed by language code (e.g., 'zh')
const dictionaries = new Map<string, Map<string, DictionaryEntry>>();

// List of supported dictionary languages based on folder structure
const SUPPORTED_LANGUAGES = ['zh', 'vi', 'ja', 'ko']; // Add more as needed

/**
 * Parses CSV text content into a dictionary map.
 * Assumes CSV format: english_word,native_translation,definition_native
 * Skips the header row.
 * Converts english_word (key) to lowercase.
 */
function parseCsvToMap(csvText: string): Map<string, DictionaryEntry> {
    const map = new Map<string, DictionaryEntry>();
    try {
        // Use csv-parse to handle potential complexities (quotes, commas in fields)
        // `sync` parsing is acceptable here as it runs once at startup in the background.
        const records: string[][] = parse(csvText, {
            columns: false, // Treat rows as arrays
            skip_empty_lines: true,
            from_line: 2 // Skip header row (line 1)
        });

        for (const record of records) {
            // Basic validation: ensure we have at least 2 columns (word, translation)
            if (record && record.length >= 2) {
                const englishWord = record[0]?.trim().toLowerCase();
                const nativeTranslation = record[1]?.trim();
                const definition = record[2]?.trim() || ''; // Definition is optional

                if (englishWord && nativeTranslation) {
                    map.set(englishWord, { translation: nativeTranslation, definition });
                } else {
                    console.warn('[Dictionary Setup] Skipping invalid CSV record:', record);
                }
            } else {
                 console.warn('[Dictionary Setup] Skipping short/empty CSV record:', record);
            }
        }
    } catch (error) {
        console.error('[Dictionary Setup] Error parsing CSV:', error);
        // Return empty map on error to avoid partial loads?
        return new Map();
    }
    return map;
}


/**
 * Loads dictionary CSV files for supported languages from the public folder.
 * Populates the main `dictionaries` map.
 */
export async function loadDictionaries(): Promise<void> {
    console.log('[Dictionary Setup] Starting dictionary loading...');
    dictionaries.clear(); // Clear any previous data if reloaded

    for (const lang of SUPPORTED_LANGUAGES) {
        const csvPath = `/dictionaries/${lang}/dictionary.csv`;
        const csvUrl = chrome.runtime.getURL(csvPath);
        console.log(`[Dictionary Setup] Attempting to load dictionary for '${lang}' from ${csvUrl}`);

        try {
            const response = await fetch(csvUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${csvUrl}`);
            }
            const csvText = await response.text();
            const langMap = parseCsvToMap(csvText);

            if (langMap.size > 0) {
                 dictionaries.set(lang, langMap);
                 console.log(`[Dictionary Setup] Successfully loaded ${langMap.size} entries for '${lang}'.`);
            } else {
                 console.warn(`[Dictionary Setup] Parsed map for '${lang}' is empty. Check CSV content or parsing logic.`);
            }

        } catch (error) {
            console.error(`[Dictionary Setup] Failed to load or parse dictionary for '${lang}' from ${csvPath}:`, error);
            // Continue loading other languages even if one fails
        }
    }

    console.log(`[Dictionary Setup] Dictionary loading finished. Loaded languages: ${Array.from(dictionaries.keys()).join(', ')}`);
}

/**
 * Retrieves a dictionary entry for a given language and English word.
 * Performs a case-insensitive lookup.
 */
export function getDictionaryEntry(language: string, englishWord: string): DictionaryEntry | undefined {
    const langMap = dictionaries.get(language);
    if (!langMap) {
        return undefined; // Language dictionary not loaded
    }
    return langMap.get(englishWord.toLowerCase());
}

// Optional: Load dictionaries immediately when the module is loaded?
// Or rely on explicit call from background.ts
// loadDictionaries(); // Consider implications of top-level await if this were async 