import { 
    defineContentScript, 
    createShadowRootUi, 
    type ShadowRootContentScriptUiOptions, 
    type ShadowRootContentScriptUi, 
} from '#imports'; // Use WXT's auto-imports
import { defineExtensionMessaging } from '@webext-core/messaging'; // Correct import for messaging
import type { BackgroundProtocolMap } from '../src/shared/messaging-types';

// Features
import LearningWordWidget from '../src/features/learning/LearningWordWidget';

// Services & Types
import { userConfigurationStorage } from '../src/services/storage/storage';
import type { UserConfiguration } from '../src/services/storage/types';
import type { LearningWordData, RequestActiveLearningWordsResponse } from '../src/shared/messaging-types';

// Utils
// import { getHighlightTargetElement } from './utils/page-analyzer'; // This was causing issues, comment out for now

// Define message sender type based on WXT
const messageSender = defineExtensionMessaging<BackgroundProtocolMap>();

// --- Constants & IDs ---
const LEARNING_HIGHLIGHT_STYLE_ID = 'scarlett-learning-highlight-styles';

// --- Import Component and Types --- Use relative paths
import TranslatorWidget from '../src/features/translator/TranslatorWidget';
import type { AlignmentData } from '../src/features/translator/TranslatorWidget';
import { extractReadableMarkdown } from '../src/lib/html-processor'; // Import the extraction function
import Defuddle from 'defuddle'; // Use default export from Defuddle
import type {
    DisplayTranslationPayload, // Expect payload from background for displaying
    UpdateAlignmentPayload, // Payload from background with alignment
    ExtractMarkdownRequest, // Import new message type
    ExtractMarkdownResponse, // Import new message type
    GetPageContentResponse, // <-- Import the response type
} from '../src/shared/messaging-types.ts';

// --- Messaging Setup --- 

// Define messaging protocol for Content Script Handlers
// (Messages the content script LISTENS FOR from the background)
interface ContentScriptProtocolMap {
    displayTranslationWidget(data: DisplayTranslationPayload): void;
    updateWidgetAlignment(data: UpdateAlignmentPayload): void;
    hideTranslationWidget(): void;
    requestSelectedText(): { success: boolean; text?: string | null }; // Response sent back
    extractMarkdownFromHtml(data: ExtractMarkdownRequest): Promise<ExtractMarkdownResponse>; // Add new handler
    getPageContent(): Promise<GetPageContentResponse>; // Added this line
}

// Instance for LISTENING to messages FROM background (typed with CS protocol)
const messageListener = defineExtensionMessaging<ContentScriptProtocolMap>();

// --- Content Script Definition ---
export default defineContentScript({
    matches: ['<all_urls>'], // Run on all URLs
    runAt: 'document_idle',
    cssInjectionMode: 'ui', // Let WXT handle CSS injection

    async main(ctx) {
        // Only run in top-level frame to avoid duplicate processing in iframes
        if (window.top !== window.self) {
            console.log('[Scarlett CS] Not top-level frame, skipping content script.');
            return;
        }
        console.log('[Scarlett CS] Main function running in top-level frame.');
        console.log('[Scarlett CS] Main function started.');
        // --- Song Detection Setup ---
        let currentTrack = '';
        let currentArtist = '';
        let currentAlbum: string | null = null;

        let pendingSongTimerId: number | null = null;
        let pendingSongData: { trackName: string; artistName: string; albumName: string | null } | null = null;
        const SONG_QUALIFICATION_DELAY_MS = 15000; // 15 seconds

        async function handleSongDetection() {
          // console.debug('[Scarlett CS][SongDetection] handleSongDetection() called by interval.'); // Keep for now
          if (!navigator.mediaSession) {
            // console.debug('[Scarlett CS][SongDetection] MediaSession API not available or null inside handleSongDetection.');
            return;
          }

          const metadata = navigator.mediaSession.metadata;
          const playbackState = navigator.mediaSession.playbackState;
          // console.debug('[Scarlett CS][SongDetection] state:', playbackState, 'metadata:', metadata); // Keep for now

          // If metadata exists, and either playbackState is 'playing' OR new metadata is different from current
          if (metadata && (playbackState === 'playing' || (metadata.title && metadata.artist))) {
            const trackName = metadata.title || '';
            const artistName = metadata.artist || '';
            const albumName = metadata.album || null;

            if (
              trackName &&
              artistName &&
              (trackName !== currentTrack || // If it's different from the last *sent* song
                artistName !== currentArtist ||
                albumName !== currentAlbum) &&
              (trackName !== pendingSongData?.trackName || // And also different from any currently pending song
                artistName !== pendingSongData?.artistName ||
                albumName !== pendingSongData?.albumName)
            ) {
              // NEW SONG CANDIDATE DETECTED
              // console.log('[Scarlett CS][SongDetection] New song candidate:', trackName, 'by', artistName, '(state:', playbackState, ')');

              if (pendingSongTimerId) {
                clearTimeout(pendingSongTimerId);
                // console.log('[Scarlett CS][SongDetection] Cleared pending timer for previous candidate:', pendingSongData?.trackName);
              }

              pendingSongData = { trackName, artistName, albumName };

              pendingSongTimerId = window.setTimeout(async () => {
                if (pendingSongData && pendingSongData.trackName === trackName && pendingSongData.artistName === artistName) {
                  console.log('[Scarlett CS][SongDetection] Song qualified after delay:', trackName, 'by', artistName);
                  currentTrack = trackName; // Update last *sent* song details
                  currentArtist = artistName;
                  currentAlbum = albumName;
                  try {
                    await messageSender.sendMessage('songDetected', { trackName, artistName, albumName });
                    console.debug('[Scarlett CS][SongDetection] Sent songDetected message to background for qualified song.');
                  } catch (error) {
                    console.error('[Scarlett CS][SongDetection] Error sending songDetected for qualified song:', error);
                  }
                } else {
                  // console.log('[Scarlett CS][SongDetection] Timer fired, but pending song data mismatch or null. Current pending:', pendingSongData, 'Track at timer start:', trackName);
                }
                pendingSongTimerId = null;
                // Do not clear pendingSongData here, let the next detection cycle handle it or overwrite it.
              }, SONG_QUALIFICATION_DELAY_MS);
              // console.log(`[Scarlett CS][SongDetection] Timer set for ${trackName} (${SONG_QUALIFICATION_DELAY_MS / 1000}s)`);

            } else if (trackName && artistName && 
                (trackName === currentTrack && artistName === currentArtist && albumName === currentAlbum)) {
              // Song is exactly the same as the one already processed and sent. Clear any pending timers for this exact song if one somehow exists.
              if (pendingSongTimerId && pendingSongData?.trackName === trackName && pendingSongData?.artistName === artistName) {
                // console.log('[Scarlett CS][SongDetection] Song is same as current & pending. Clearing its pending timer as it must have been processed.');
                clearTimeout(pendingSongTimerId);
                pendingSongTimerId = null;
                // pendingSongData = null; // Keep pendingSongData to avoid re-triggering a new timer for it immediately if state is flapping
              }
              // console.debug('[Scarlett CS][SongDetection] Song is the same as current *sent* song. State:', playbackState, '. No new timer action.');
            }
          } else {
            // console.debug('[Scarlett CS][SongDetection] No new song detected or not playing. State:', playbackState, 'Metadata:', metadata);
          }
        }

        function setupSongDetection() {
          // console.debug('[Scarlett CS][SongDetection] setupSongDetection() called.'); // Keep for now
          if (!navigator.mediaSession) {
            // console.debug('[Scarlett CS][SongDetection] MediaSession API not available in setupSongDetection.');
            return;
          }
          // Initial detection
          // console.debug('[Scarlett CS][SongDetection] Calling initial handleSongDetection from setup.');
          handleSongDetection();
          // Polling fallback every 5 seconds
          // console.debug('[Scarlett CS][SongDetection] Setting up polling interval for handleSongDetection.'); // Keep for now
          setInterval(() => {
            // console.debug('[Scarlett CS][SongDetection] Polling interval fired. Calling handleSongDetection...'); // Keep for now
            handleSongDetection();
          }, 5000); // Check every 5 seconds
        }

        // Restore the original setup call
        setTimeout(setupSongDetection, 500);

        // --- Timer for Page Visit Processing ---
        let pageVisitTimerId: number | null = null;
        const PAGE_VISIT_DELAY = 3000; // 3 seconds

        const schedulePageProcessing = () => {
            if (pageVisitTimerId) {
                clearTimeout(pageVisitTimerId);
            }
            console.log(`[Scarlett CS] Scheduling page processing in ${PAGE_VISIT_DELAY / 1000}s...`);
            pageVisitTimerId = window.setTimeout(async () => {
                console.log('[Scarlett CS] Page visit timer fired. Processing page...');
                try {
                    const url = window.location.href;
                    const title = document.title;
                    // Use separateMarkdown to get markdown content alongside HTML
                    const defuddle = new Defuddle(document, { markdown: true, separateMarkdown: true, url });
                    const defuddleResult = defuddle.parse();
                    console.log('[Scarlett CS] Defuddle parse full output:', defuddleResult);
                    // Prefer markdown conversion if available
                    const markdownContent = defuddleResult.contentMarkdown ?? defuddleResult.content;
                    console.log(`[Scarlett CS] Defuddle extracted markdown (length: ${markdownContent?.length}) for URL: ${url.substring(0, 100)}`);
                    messageSender.sendMessage('processPageVisit', {
                        url,
                        title: defuddleResult.title || title,
                        markdownContent,
                        defuddleMetadata: defuddleResult
                    });
                } catch (error) {
                    console.error('[Scarlett CS] Defuddle extraction failed:', error);
                }
            }, PAGE_VISIT_DELAY);
        };

        const cancelPageProcessing = () => {
            if (pageVisitTimerId) {
                console.log(`[Scarlett CS] Cancelling scheduled page processing (navigation).`);
                clearTimeout(pageVisitTimerId);
                pageVisitTimerId = null;
            }
        };
        
        // --- CSS and Tooltip Setup for Learning Words (definitions remain the same) ---
        const LEARNING_HIGHLIGHT_CSS = `
          .scarlett-learning-highlight {
            background-color: rgba(255, 235, 59, 0.3); /* Light yellow */
            border-bottom: 1px dashed rgba(255, 193, 7, 0.7); /* Amber dash */
            cursor: help;
            border-radius: 3px;
            padding: 0 0.1em;
            margin: 0 0.02em;
          }
        `;

        // --- NEW: State for Learning Word Widget ---
        let currentLearningWordWidgetUi: ShadowRootContentScriptUi<() => void | null> | null = null;
        let currentLearningWordWidgetData: LearningWordData | null = null; // Track which word is displayed
        let learningWidgetHideTimeoutId: number | null = null;
        const LEARNING_WIDGET_HIDE_DELAY = 300; // ms
        const LEARNING_WIDGET_NAME = 'scarlett-learning-word-widget';
        // --- END NEW State ---

        const injectHighlightStyles = () => {
            if (document.getElementById(LEARNING_HIGHLIGHT_STYLE_ID)) return;
            const styleElement = document.createElement('style');
            styleElement.id = LEARNING_HIGHLIGHT_STYLE_ID;
            styleElement.textContent = LEARNING_HIGHLIGHT_CSS;
            document.head.appendChild(styleElement);
        };

        // --- NEW: Learning Word Widget Management ---
        const hideLearningWordWidget = async () => {
            if (learningWidgetHideTimeoutId) {
                clearTimeout(learningWidgetHideTimeoutId);
                learningWidgetHideTimeoutId = null;
            }
            const uiToRemove = currentLearningWordWidgetUi;
            if (!uiToRemove) return;
            
            console.log('[Scarlett CS] Hiding LearningWordWidget for:', currentLearningWordWidgetData?.sourceText);
            currentLearningWordWidgetUi = null;
            currentLearningWordWidgetData = null;
            
            try {
                await uiToRemove.remove();
                console.log('[Scarlett CS] LearningWordWidget UI removed.');
            } catch (error) {
                console.error('[Scarlett CS] Error removing LearningWordWidget UI:', error);
            }
        };
        
        const handleLearningWordTTSRequest = async (text: string, lang: string): Promise<{ audioDataUrl?: string; error?: string }> => {
            console.log(`[Scarlett CS Learning TTS] Request to BG: Text='${text.substring(0,30)}...', Lang='${lang}'`);
            try {
                // Using same message as TranslatorWidget for now, assuming background handles it based on text/lang
                const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed: 1.0 }) as { success: boolean, audioDataUrl?: string, error?: string };
                console.log('[Scarlett CS Learning TTS] Response from BG:', response);
                if (response && response.success && response.audioDataUrl) {
                    return { audioDataUrl: response.audioDataUrl }; 
                } else {
                    return { error: response?.error || 'Unknown TTS error from BG.' };
                }
            } catch (error) {
                console.error('[Scarlett CS Learning TTS] Error sending/processing TTS request:', error);
                return { error: error instanceof Error ? error.message : 'Failed TTS request.' };
            }
        };

        const showLearningWordWidget = async (anchorElement: HTMLElement) => {
            // Determine what to show in the widget based on the data attributes of the anchor
            const pageWord = anchorElement.dataset.originalWordDisplay || '';
            const counterpartWord = anchorElement.dataset.translatedWord || '';
            const pageWordLang = anchorElement.dataset.sourceLang || '?'; // This sourceLang is relative to the found word on page
            const counterpartWordLang = anchorElement.dataset.targetLang || '?';

            if (currentLearningWordWidgetUi && currentLearningWordWidgetData?.sourceText === pageWord && currentLearningWordWidgetData?.translatedText === counterpartWord) {
                 // Simple check to see if widget is already showing for this exact pair
                return;
            }
            if (currentLearningWordWidgetUi) {
                await hideLearningWordWidget();
            }

            console.log('[Scarlett CS] Showing LearningWordWidget for page word:', pageWord, `(${pageWordLang})`, '-> counterpart:', counterpartWord, `(${counterpartWordLang})`);
            
            // This data is for tracking what the widget is *currently for*, can be simplified
            currentLearningWordWidgetData = { 
                sourceText: pageWord, 
                translatedText: counterpartWord,
                sourceLang: pageWordLang,
                targetLang: counterpartWordLang
            };

            const rect = anchorElement.getBoundingClientRect();
            const topPos = window.scrollY + rect.bottom + 5;
            const leftPos = window.scrollX + rect.left; 

            const options: ShadowRootContentScriptUiOptions<() => void> = {
                name: LEARNING_WIDGET_NAME,
                position: 'inline',
                onMount: (container: HTMLElement): (() => void) => {
                    container.style.position = 'absolute';
                    container.style.top = `${topPos}px`;
                    container.style.left = `${leftPos}px`;
                    container.style.zIndex = '2147483647';
                    container.style.width = '24rem';
                    container.style.height = 'auto';
                    container.style.maxHeight = 'max-content';
                    container.style.borderRadius = '0.5rem';
                    container.style.overflow = 'hidden';
                    
                    container.addEventListener('mouseenter', () => {
                        if (learningWidgetHideTimeoutId) {
                            clearTimeout(learningWidgetHideTimeoutId);
                            learningWidgetHideTimeoutId = null;
                        }
                    });
                    container.addEventListener('mouseleave', () => {
                         if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                         learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                    });
                    
                    let unmountSolid: (() => void) | null = null;
                    try {
                        unmountSolid = render(() => 
                            LearningWordWidget({
                                originalWord: pageWord,         // Word that was on the page
                                translatedWord: counterpartWord,  // Its counterpart
                                sourceLang: pageWordLang,       // Language of the word on the page
                                targetLang: counterpartWordLang,    // Language of its counterpart
                                onTTSRequest: handleLearningWordTTSRequest, // This might need lang adjustment too
                                onMouseEnter: () => {
                                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                                    learningWidgetHideTimeoutId = null;
                                },
                                onMouseLeave: () => {
                                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                                     learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                                }
                            }), 
                            container
                        );
                        return unmountSolid || (() => {});
                    } catch (renderError) {
                        console.error('[Scarlett CS] Error rendering LearningWordWidget:', renderError);
                        container.textContent = "Error displaying word info.";
                        return () => {};
                    }
                },
                onRemove: (unmountSolid) => {
                    if (unmountSolid) {
                         try { unmountSolid(); } catch (e) { console.error('Error unmounting LW Widget:', e); }
                    }
                }
            };

            try {
                const ui = await createShadowRootUi(ctx, options);
                currentLearningWordWidgetUi = ui;
                ui.mount();
                console.log('[Scarlett CS] Mounted LearningWordWidget.');
            } catch (error) {
                console.error('[Scarlett CS] Error creating/mounting LearningWordWidget UI:', error);
                currentLearningWordWidgetUi = null;
                currentLearningWordWidgetData = null;
            }
        };
        // --- END NEW Widget Management ---

        const getHighlightTargetElement = (): HTMLElement => {
            // --- RETAINED: More specific content selectors ---
            const selectors = [
                'article',              // General article tag
                '.mw-parser-output',    // Wikipedia main content area
                '.post-content',        // Common blog post content class
                '.entry-content',       // Another common blog content class
                '.article-body',        // Common news article body class
                '#main-content',        // Common main content ID
                '#content',             // Common content ID
                'main',                 // General main tag
                '.page-content',        // Another possible content class
                '.prose',               // Tailwind prose class often used for articles
            ];
            // --- END RETAINED ---
            for (const selector of selectors) {
                const element = document.querySelector(selector) as HTMLElement | null;
                // --- ADDED: Check for reasonable text length ---
                if (element && element.textContent && element.textContent.trim().length > 500) { 
                    console.log(`[Scarlett CS Highlight] Using target element: ${selector}`);
                    return element;
                }
                 // --- END ADDED ---
            }
            console.log('[Scarlett CS Highlight] No specific main content element found, falling back to document.body.');
            return document.body;
        };

        // --- REFACTORED: Two-pass highlighting ---
        interface ReplacementInfo {
            node: Text;
            start: number;
            end: number;
            wordInfo: LearningWordData;
            foundAs: 'source' | 'translated';
            originalPart: string; // Store the exact text found (case preserved)
        }

        const highlightLearningWordsOnPage = (learningWords: LearningWordData[]) => {
            if (!learningWords || learningWords.length === 0) {
                console.log('[Scarlett CS] No learning words provided for highlighting.');
                return;
            }

            const sourceTextMap = new Map<string, LearningWordData>();
            const translatedTextMap = new Map<string, LearningWordData>();
            const replacementsMade = new Map<string, number>(); // Track counts per word

            learningWords.forEach(word => {
                sourceTextMap.set(word.sourceText.toLowerCase(), word);
                if (word.translatedText) {
                    translatedTextMap.set(word.translatedText.toLowerCase(), word);
                }
            });

            console.log('[Scarlett CS] Starting highlight. Source map size:', sourceTextMap.size, 'Translated map size:', translatedTextMap.size);

            const targetElement = getHighlightTargetElement();
            console.log('[Scarlett CS Highlight] Using target element:', targetElement.tagName + (targetElement.id ? `#${targetElement.id}` : '') + (targetElement.className ? `.${targetElement.className.split(' ').join('.')}`: ''));

            const walker = document.createTreeWalker(
                targetElement,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node: Node) => {
                        // Skip nodes within script/style/already highlighted elements
                        if (node.parentElement?.closest('script, style, .scarlett-learning-highlight, .scarlett-translator-widget, .scarlett-lw-widget') || !node.nodeValue?.trim()) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                },
                // false // Types seem wrong here, TS expects NodeFilter | null, not boolean
            );

            const replacementsToMake: ReplacementInfo[] = [];
            const wordRegex = /(\b[a-zA-Z'-]+(?:\s+[a-zA-Z'-]+)*\b)|([\u4e00-\u9fff]+)|([^\s\w]+)/g; // More robust regex for words and CJK characters + punctuation


            // --- Pass 1: Collect replacements ---
            let currentNode: Node | null;
            while (currentNode = walker.nextNode()) {
                const textNode = currentNode as Text;
                const textContent = textNode.nodeValue || '';
                let match;

                 // Reset regex lastIndex for each new node
                wordRegex.lastIndex = 0; 

                while ((match = wordRegex.exec(textContent)) !== null) {
                    const part = match[0]; // The matched text (word, CJK, or punctuation)
                    const start = match.index;
                    const end = start + part.length;
                    const lowerCasePart = part.toLowerCase();

                    let wordInfo: LearningWordData | undefined;
                    let foundAs: 'source' | 'translated' | null = null;

                    if (sourceTextMap.has(lowerCasePart)) {
                        wordInfo = sourceTextMap.get(lowerCasePart);
                        foundAs = 'source';
                    } else if (translatedTextMap.has(lowerCasePart)) { // Also check for translated words if needed
                        wordInfo = translatedTextMap.get(lowerCasePart);
                        foundAs = 'translated';
                    }

                    if (wordInfo && foundAs) {
                        replacementsToMake.push({
                            node: textNode,
                            start: start,
                            end: end,
                            wordInfo: wordInfo,
                            foundAs: foundAs,
                            originalPart: part // Store the original case
                        });
                    }
                }
            }

            // --- Pass 2: Apply replacements in reverse ---
            console.log(`[Scarlett CS Highlight] Found ${replacementsToMake.length} potential highlight locations.`);
            // Sort in reverse order of start index within the *same node* primarily,
            // then by node order (though node order shouldn't matter much if indices are correct)
            replacementsToMake.sort((a, b) => {
                 if (a.node === b.node) {
                    return b.start - a.start; // Reverse order within the same node
                 }
                 // For different nodes, DOM order comparison is complex.
                 // Reverse start order is generally safe enough if nodes aren't nested weirdly.
                 // A more robust comparison (compareDocumentPosition) might be needed if issues persist.
                 const position = a.node.compareDocumentPosition(b.node);
                 if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                     return 1; // a follows b
                 } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                     return -1; // a precedes b
                 }
                 return 0; // Same node (should be handled above, but fallback)
            }).reverse(); // Apply replacements from end of document backwards


            // Now apply the changes
            replacementsToMake.forEach(replacement => {
                const { node, start, end, wordInfo, foundAs, originalPart } = replacement;

                // Check if node still exists and has a parent (it might have been removed/replaced)
                if (!node.parentNode || !document.contains(node)) {
                    console.warn('[Scarlett CS Highlight] Skipping replacement as node is no longer in DOM:', node.nodeValue?.substring(0, 30));
                    return;
                }
                // Also check if the expected text is still there
                 if (node.nodeValue?.substring(start, end) !== originalPart) {
                    console.warn(`[Scarlett CS Highlight] Skipping replacement as text content mismatch. Expected: "${originalPart}", Found: "${node.nodeValue?.substring(start, end)}" at [${start}-${end}] in node:`, node.nodeValue?.substring(0, 50));
                    return;
                 }


                try {
                    const range = document.createRange();
                    range.setStart(node, start);
                    range.setEnd(node, end);

                    const span = document.createElement('span');
                    span.className = 'scarlett-learning-highlight';

                    // Store original word (what was actually on the page)
                    span.dataset.originalWordDisplay = originalPart;

                    if (foundAs === 'source') {
                        // Found source word (e.g., "tea"), display translated (e.g., "茶")
                        span.textContent = wordInfo.translatedText || originalPart; // Fallback to original if no translation
                        span.dataset.translatedWord = wordInfo.translatedText || '';
                        span.dataset.sourceLang = wordInfo.sourceLang;
                        span.dataset.targetLang = wordInfo.targetLang;
                        span.dataset.originalWord = wordInfo.sourceText; // The 'dictionary' word
                    } else { // foundAs === 'translated'
                        // Found target word (e.g., "茶"), display source (e.g., "tea")
                        span.textContent = wordInfo.sourceText;
                        span.dataset.translatedWord = wordInfo.translatedText || ''; // Store original translated word
                        span.dataset.sourceLang = wordInfo.sourceLang;
                        span.dataset.targetLang = wordInfo.targetLang;
                        span.dataset.originalWord = wordInfo.translatedText || ''; // The 'dictionary' word (which was the target lang)
                    }

                    // Add event listeners directly here if needed, or rely on delegation
                    span.addEventListener('click', (event) => {
                        event.stopPropagation(); // Prevent page clicks if any
                        showLearningWordWidget(span);
                    });
                     span.addEventListener('mouseenter', () => {
                        // Optional: Could pre-fetch TTS or show minimal tooltip
                    });
                     span.addEventListener('mouseleave', () => {
                        // Optional: Hide minimal tooltip if shown
                    });


                    range.deleteContents(); // Remove the original text
                    range.insertNode(span); // Insert the styled span

                    // Update count
                    const lowerCaseOriginal = wordInfo.sourceText.toLowerCase(); // Count based on dictionary word
                    replacementsMade.set(lowerCaseOriginal, (replacementsMade.get(lowerCaseOriginal) || 0) + 1);

                } catch (error) {
                    console.error('[Scarlett CS Highlight] Error applying replacement:', error, 'for word:', originalPart, 'Node:', node);
                }
            });


            console.log('[Scarlett CS] Finished replacing/highlighting learning words.', replacementsMade);
        };
        // --- END REFACTORED ---

        const fetchAndHighlightLearningWords = async () => {
            console.log('[Scarlett CS] Requesting active learning words from background...');
            try {
                injectHighlightStyles(); 

                // Get user's source and target languages
                const userConfig: UserConfiguration | null = await userConfigurationStorage.getValue();
                const sourceLanguage = userConfig?.nativeLanguage;
                const targetLanguage = userConfig?.targetLanguage;

                if (!sourceLanguage || !targetLanguage) {
                    console.warn('[Scarlett CS] Native or target language not set in config. Skipping learning word highlighting.');
                    return;
                }

                console.log(`[Scarlett CS] Fetching words for ${sourceLanguage} -> ${targetLanguage}`);
                const response = await messageSender.sendMessage(
                    'REQUEST_ACTIVE_LEARNING_WORDS', 
                    { sourceLanguage, targetLanguage } // Pass the languages
                ) as RequestActiveLearningWordsResponse;

                if (response && response.success && response.words && response.words.length > 0) {
                    console.log(`[Scarlett CS] Received ${response.words.length} learning words. Starting highlighting...`);
                    highlightLearningWordsOnPage(response.words);
                } else if (response && !response.success) {
                    console.error('[Scarlett CS] Failed to fetch learning words:', response.error);
                } else {
                    console.log('[Scarlett CS] No active learning words to highlight or empty response.');
                }
            } catch (error) {
                console.error('[Scarlett CS] Error requesting/processing active learning words:', error);
            }
        };
        

        window.requestIdleCallback(fetchAndHighlightLearningWords, { timeout: 1000 });
        
        window.setTimeout(schedulePageProcessing, 500); 
        window.addEventListener('beforeunload', cancelPageProcessing);

        interface WidgetData {
          textToTranslate: string;
          translatedText: string; 
          sourceLang: string; 
          targetLang: string;
          isLoading: boolean;
          pronunciation?: string; 
        }

        const [isVisible, setIsVisible] = createSignal(false);
        const [widgetProps, setWidgetProps] = createSignal<WidgetData>({
            textToTranslate: '',    
            translatedText: '',     
            sourceLang: 'en',
            targetLang: 'en',
            isLoading: false,       
            pronunciation: undefined, 
        });
        const [alignmentData, setAlignmentData] = createSignal<AlignmentData | null>(null);

        let currentWidgetUi: ShadowRootContentScriptUi<() => void> | null = null;
        let currentWidgetName: string | null = null;
        let globalClickListener: ((event: MouseEvent) => void) | null = null;
        let currentTranslationOriginalText: string | null = null;

        const hideWidget = async (options: {isPartOfUpdate?: boolean} = {}) => {
            console.log('[Scarlett CS hideWidget] Attempting to hide. currentWidgetUi present:', !!currentWidgetUi, 'Options:', options);
            if (!currentWidgetUi) return;
            console.log('[Scarlett CS hideWidget] Hiding widget:', currentWidgetName);

            const uiToRemove = currentWidgetUi;
            const widgetNameToClear = currentWidgetName;

            currentWidgetUi = null;
            if (!options.isPartOfUpdate) {
                currentWidgetName = null;
                currentTranslationOriginalText = null; 
                setIsVisible(false); 
                setAlignmentData(null); 
            }

            if (globalClickListener) {
                document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = null;
                console.log('[Scarlett CS hideWidget] Removed global click listener.');
            }
            try {
                console.log('[Scarlett CS hideWidget] Calling uiToRemove.remove() for', widgetNameToClear);
                uiToRemove.remove();
                console.log(`[Scarlett CS hideWidget] Widget UI removed (${widgetNameToClear}).`);
            } catch (error) {
                console.error(`[Scarlett CS hideWidget] Error removing widget UI (${widgetNameToClear}):`, error);
            }
        };

        const handleTTSRequest = async (text: string, lang: string, speed: number): Promise<{ audioDataUrl?: string; error?: string; alignment?: AlignmentData | null }> => {
            console.log(`[Scarlett CS TTS] Request to BG: Text='${text.substring(0,30)}...', Lang='${lang}', Speed=${speed}`);
            try {
                // Always send to background. Background will handle vendor logic (now forced to ElevenLabs for debug).
                const response = await messageSender.sendMessage('REQUEST_TTS_FROM_WIDGET', { text, lang, speed }) as {
                    success: boolean;
                    audioDataUrl?: string;
                    alignmentData?: AlignmentData | null; // Expect alignmentData from background
                    error?: string;
                    useBrowserTTS?: boolean; // Background might still send this if it couldn't use ElevenLabs
                };
                console.log('[Scarlett CS TTS] Response from BG:', response);

                if (response && response.success && response.audioDataUrl) {
                    setAlignmentData(response.alignmentData || null); // Update signal
                    return { audioDataUrl: response.audioDataUrl, alignment: response.alignmentData };
                } else if (response && response.useBrowserTTS) {
                    // This case should ideally not happen if background is forced to ElevenLabs and EL fails.
                    // If it does, it means the background explicitly told us to try browser TTS.
                    // However, per user request, we are removing direct browser.tts calls from content script.
                    console.warn('[Scarlett CS TTS] Background suggested browser TTS, but direct browser TTS is disabled in content script.');
                    setAlignmentData(null); // Clear signal
                    return { error: response.error || 'Browser TTS suggested by background, but not enabled here.', alignment: null };
                } else {
                    setAlignmentData(null); // Clear signal
                    return { error: response?.error || 'Unknown TTS error from background.', alignment: null };
                }
            } catch (error) {
                console.error('[Scarlett CS TTS] Error sending/processing TTS request to background:', error);
                setAlignmentData(null); // Clear signal in case of error
                return { error: error instanceof Error ? error.message : 'Failed to send TTS request to background.', alignment: null };
            }
        };

        messageListener.onMessage('displayTranslationWidget', async (message: { data: DisplayTranslationPayload }) => {
            const { originalText, translatedText, sourceLang, targetLang, pronunciation, isLoading } = message.data;
            console.log(`[Scarlett CS displayTranslationWidget] Received. isLoading: ${isLoading}, CurrentOrig: "${currentTranslationOriginalText ? currentTranslationOriginalText.substring(0,10): 'null'}", NewOrig: "${originalText ? originalText.substring(0,10): 'null'}"`);
            console.log(`[Scarlett CS displayTranslationWidget] currentWidgetUi present: ${!!currentWidgetUi}, isVisible(): ${isVisible()}`);

            // Fetch user configuration here, outside of onMount
            const userConfig = await userConfigurationStorage.getValue();

            if (currentTranslationOriginalText !== originalText || !currentWidgetUi || !isVisible()) {
                console.log('[Scarlett CS displayTranslationWidget] New interaction or widget not fully active/different text. Will hide and recreate/show.');
                await hideWidget(); 
                currentTranslationOriginalText = originalText; 

                setWidgetProps({
                    textToTranslate: originalText || '',
                    translatedText: isLoading ? '' : (translatedText || ''),
                    sourceLang: sourceLang,
                    targetLang: targetLang,
                    pronunciation: isLoading ? undefined : (pronunciation || undefined),
                    isLoading: isLoading,
                });
                setAlignmentData(null);
                setIsVisible(true);
                console.log(`[Scarlett CS displayTranslationWidget] isVisible signal set to true. widgetPropsisLoading: ${widgetProps().isLoading}`);

                console.log('[Scarlett CS displayTranslationWidget] Creating new ShadowRoot UI...');
                const widgetName = 'scarlett-translator-widget';
                currentWidgetName = widgetName;
                const options: ShadowRootContentScriptUiOptions<() => void> = {
                    name: widgetName,
                    position: 'inline', 
                    anchor: undefined,
                    onMount: (containerElement) => { 
                        console.log('[Scarlett CS onMount] CALLED. WXT Container tagName:', containerElement.tagName);
                        
                        if (currentWidgetUi?.shadowHost) {
                            const host = currentWidgetUi.shadowHost as HTMLElement;
                            host.style.position = 'fixed';
                            host.style.bottom = '0rem';
                            host.style.left = '1rem';
                            host.style.zIndex = '2147483647';
                            host.style.fontFamily = 'sans-serif';
                        }
                        console.log('[Scarlett CS onMount] Host styled. Rendering Solid component into SHADOW ROOT...');
                        
                        let unmountSolid: (() => void) | null = null;
                        if (currentWidgetUi?.shadow) { 
                            try {
                                // userConfig is now available from the outer scope
                                unmountSolid = render(() => {
                                    return TranslatorWidget({
                                        textToTranslate: () => widgetProps().textToTranslate,
                                        translatedText: () => widgetProps().translatedText,
                                        isLoading: () => widgetProps().isLoading,
                                        pronunciation: () => widgetProps().pronunciation,
                                        sourceLang: () => widgetProps().sourceLang,
                                        targetLang: () => widgetProps().targetLang,
                                        alignment: () => alignmentData(), 
                                        onTTSRequest: handleTTSRequest,
                                        onCloseRequest: () => { console.log("[Scarlett CS onCloseRequest] User requested close."); hideWidget(); },
                                        userNativeLanguage: () => userConfig?.nativeLanguage || undefined,
                                        userLearningLanguage: () => userConfig?.targetLanguage || undefined
                                    });
                                }, currentWidgetUi.shadow 
                                );
                                console.log('[Scarlett CS onMount] Solid component RENDERED into shadowRoot.');
                            } catch (renderError) {
                                console.error('[Scarlett CS onMount] Error during Solid render into shadowRoot:', renderError);
                                if (currentWidgetUi?.shadow.firstChild) { 
                                     while(currentWidgetUi.shadow.firstChild) currentWidgetUi.shadow.removeChild(currentWidgetUi.shadow.firstChild);
                                }
                                currentWidgetUi.shadow.textContent = "Error displaying translation.";
                            }
                        } else {
                            console.error('[Scarlett CS onMount] currentWidgetUi.shadow is not available for rendering! currentWidgetUi:', currentWidgetUi);
                        }
                        return unmountSolid || (() => {});
                    },
                    onRemove: (unmountSolid) => {
                        console.log(`[Scarlett CS onRemove] CALLED for ${currentWidgetName}.`);
                        if (unmountSolid) unmountSolid();
                    }
                };
                console.log('[Scarlett CS displayTranslationWidget] Options prepared. Calling createShadowRootUi...');
                try {
                    const ui = await createShadowRootUi(ctx, options);
                    console.log('[Scarlett CS displayTranslationWidget] createShadowRootUi SUCCEEDED. UI object:', ui);
                    currentWidgetUi = ui;
                    
                    console.log('[Scarlett CS displayTranslationWidget] About to call ui.mount(). This will trigger onMount. Current currentWidgetUi:', currentWidgetUi);
                    ui.mount();
                    console.log(`[Scarlett CS displayTranslationWidget] Mounted ${widgetName}. currentWidgetUi after mount:`, currentWidgetUi);
                } catch (createUiError) {
                    console.error("[Scarlett CS displayTranslationWidget] FAILED to createShadowRootUi or mount:", createUiError);
                    currentWidgetUi = null; 
                    setIsVisible(false);
                    currentTranslationOriginalText = null;
                    return; 
                }

                if (globalClickListener) document.removeEventListener('click', globalClickListener, { capture: true });
                globalClickListener = (event: MouseEvent) => {
                    const hostElement = currentWidgetUi?.shadowHost; 
                    if (isVisible() && hostElement && !event.composedPath().includes(hostElement)) {
                        console.log(`[Scarlett CS GlobalClick] Click outside ${currentWidgetName}. Hiding.`);
                        hideWidget(); 
                    }
                };
                document.addEventListener('click', globalClickListener, { capture: true });
                console.log('[Scarlett CS displayTranslationWidget] Global click listener ADDED.');
            } else {
                console.log('[Scarlett CS displayTranslationWidget] Updating EXISTING widget with new props.');
                setWidgetProps({
                    textToTranslate: originalText || '', 
                    translatedText: translatedText || '',
                    sourceLang: sourceLang, targetLang: targetLang,
                    pronunciation: pronunciation || undefined,
                    isLoading: isLoading, 
                });
                console.log(`[Scarlett CS displayTranslationWidget] Props updated for existing widget. isVisible(): ${isVisible()}, widgetPropsisLoading: ${widgetProps().isLoading}`);
            }
        });

        messageListener.onMessage('updateWidgetAlignment', (message: { data: UpdateAlignmentPayload }) => {
            console.log('[Scarlett CS updateWidgetAlignment] Received. isVisible():', isVisible(), "currentWidgetUi present:", !!currentWidgetUi);
            if (isVisible() && currentWidgetUi) {
                setAlignmentData(message.data.alignment);
                console.log('[Scarlett CS updateWidgetAlignment] Alignment data signal updated.');
            } else {
                console.warn('[Scarlett CS updateWidgetAlignment] Received alignment but widget not visible/mounted.');
            }
        });

        messageListener.onMessage('hideTranslationWidget', async () => {
             console.log('[Scarlett CS hideTranslationWidget] Received request from BG.');
             await hideWidget();
        });
        
        messageListener.onMessage('requestSelectedText', () => {
            console.log('[Scarlett CS] Received requestSelectedText request.');
            try {
                const selectedText = window.getSelection()?.toString();
                console.log(`[Scarlett CS requestSelectedText] Selected text: "${selectedText?.substring(0, 50)}..."`);
                return { success: true, text: selectedText };
            } catch (error) {
                 console.error('[Scarlett CS requestSelectedText] Error getting selected text:', error);
                 return { 
                     success: false, 
                     error: error instanceof Error ? error.message : 'Unknown error getting selected text.' 
                 };
            }
        });
        
        messageListener.onMessage('extractMarkdownFromHtml', async ({ data }) => {
            console.log(`[Scarlett CS] Received extractMarkdownFromHtml request (Base URL: ${data.baseUrl})`);
            try {
                // Provide window.location.href as fallback for baseUrl
                const { markdown, title } = await extractReadableMarkdown(data.htmlContent, data.baseUrl || window.location.href);
                console.log(`[Scarlett CS extractMarkdownFromHtml] Extraction complete. Markdown length: ${markdown?.length}, Title: ${title}`);
                return { success: true, markdown: markdown || '', title: title || '' };
            } catch (error) {
                console.error('[Scarlett CS extractMarkdownFromHtml] Error extracting markdown:', error);
                return { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error extracting markdown.',
                    markdown: '',
                    title: ''
                };
            }
        });

        messageListener.onMessage('getPageContent', async () => {
            console.log('[Scarlett CS] Received getPageContent request.');
            try {
                const htmlContent = document.documentElement.outerHTML;
                if (!htmlContent) {
                     console.warn('[Scarlett CS getPageContent] document.documentElement.outerHTML was empty.');
                     return { success: false, error: 'Could not retrieve page HTML.' };
                }
                console.log(`[Scarlett CS getPageContent] Returning HTML content (length: ${htmlContent.length})`);
                // Ensure structure matches GetPageContentResponse
                return { success: true, htmlContent: htmlContent }; 
            } catch (error) {
                console.error('[Scarlett CS getPageContent] Error getting page HTML:', error);
                return { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Unknown error retrieving page HTML.' 
                };
            }
        });

        document.body.addEventListener('mouseover', (event) => {
            const target = event.target as HTMLElement;
            if (target.classList.contains('scarlett-learning-highlight')) {
                if (learningWidgetHideTimeoutId) {
                    clearTimeout(learningWidgetHideTimeoutId);
                    learningWidgetHideTimeoutId = null;
                }
                
                // Remove unused variables
                // const sourceTextFromDataset = target.dataset.originalWord || ''; // This is the "dictionary" source
                // const wordIsFromSourceMap = target.dataset.originalWordDisplay === target.dataset.originalWord && target.dataset.translatedWord !== target.dataset.originalWord;
                // const wordIsFromTranslatedMap = target.dataset.originalWordDisplay === target.dataset.translatedWord && target.dataset.originalWord !== target.dataset.originalWordDisplay;

                // The data attributes on the span are now the primary source of truth for the widget
                const displaySourceText = target.dataset.originalWordDisplay || '';
                const displayTranslatedText = target.dataset.translatedWord || '';

                // For showLearningWordWidget, we just pass the anchor element.
                // The widget will read its own data from the anchor's dataset.
                if (displaySourceText && displayTranslatedText) {
                    // Construct a temporary LearningWordData for the showLearningWordWidget logic
                    // This is slightly redundant as the widget itself will re-read from dataset,
                    // but useful for the initial display logic and currentLearningWordWidgetData tracking.
                    // const tempDataForWidget: LearningWordData = {
                    //     sourceText: displaySourceText,     // Word as it appeared on the page
                    //     translatedText: displayTranslatedText, // Its counterpart
                    //     sourceLang: displaySourceLang,     // Language of word on page
                    //     targetLang: displayTargetLang      // Language of its counterpart
                    // };
                    showLearningWordWidget(target); // Pass only the anchor element
                }
            }
        });

        document.body.addEventListener('mouseout', (event) => {
            const target = event.target as HTMLElement;
            const relatedTarget = event.relatedTarget as Node | null;
            
            if (target.classList.contains('scarlett-learning-highlight')) {
                const widgetHost = currentLearningWordWidgetUi?.shadowHost;
                 if (!relatedTarget || (widgetHost && !widgetHost.contains(relatedTarget) && relatedTarget !== widgetHost)) {
                    if (learningWidgetHideTimeoutId) clearTimeout(learningWidgetHideTimeoutId);
                    learningWidgetHideTimeoutId = window.setTimeout(hideLearningWordWidget, LEARNING_WIDGET_HIDE_DELAY);
                 }
            }
        });

        console.log('[Scarlett CS] Main function setup complete. Listening for messages.');
    },
});