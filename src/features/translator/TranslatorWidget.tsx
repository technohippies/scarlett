import { Component, Show, For, createSignal, createEffect, on } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, ArrowClockwise } from 'phosphor-solid';
import { Dynamic } from 'solid-js/web';
import 'virtual:uno.css';

// --- Alignment Data Structure (Example based on ElevenLabs) ---
export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}

// --- Props Interface (Update onTTSRequest return type) ---
export interface TranslatorWidgetProps {
  hoveredWord: string;      // The translated word to display prominently
  originalWord: string;     // The original word for reference
  pronunciation?: string;   // Optional pronunciation (e.g., Pinyin)
  sourceLang: string;       // Source language code (e.g., 'en')
  targetLang: string;       // Target language code (e.g., 'zh-CN')
  // Updated return type for onTTSRequest
  onTTSRequest: (text: string, lang: string, speed: number) => Promise<{ audioDataUrl?: string; error?: string }>; 
  // Optional alignment data for highlighting
  alignment?: AlignmentData | null;
  // Add onCloseRequest prop
  onCloseRequest?: () => void;
}

// --- Word Data Structure ---
interface WordInfo {
    text: string;
    startTime: number;
    endTime: number;
    index: number;
}

// --- Constants ---
const WIDGET_BASE_CLASSES = "fixed bottom-0 left-4 z-[2147483647] font-sans bg-background text-foreground rounded-t-lg shadow-lg p-4 w-96 text-base flex flex-col gap-2";
const TRANSITION_SETTINGS = { duration: 0.3, easing: "ease-out" } as const;
const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-[2147483647] w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;
// CSS for highlighting
const HIGHLIGHT_STYLE_ID = "scarlett-word-highlight-styles";
const HIGHLIGHT_CSS = `
  .scarlett-word-span {
    background-color: transparent;
    transition: background-color 0.15s ease-in-out;
    border-radius: 3px; /* Optional: slight rounding */
    padding: 0 0.1em; /* Optional: slight padding */
    margin: 0 0.02em; /* Optional: slight margin */
    display: inline-block; /* Needed for padding/margin */
  }
  .scarlett-word-highlight {
    background-color: hsla(var(--foreground), 0.15); /* Use theme color */
  }
`;

// --- Component ---
const TranslatorWidget: Component<TranslatorWidgetProps> = (props) => {
  // State Signals
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [isAudioReady, setIsAudioReady] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [wordMap, setWordMap] = createSignal<WordInfo[]>([]);
  const [currentHighlightIndex, setCurrentHighlightIndex] = createSignal<number | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const [currentAudio, setCurrentAudio] = createSignal<HTMLAudioElement | null>(null);
  let highlightInterval: number | null = null;
  let rootRef: HTMLDivElement | undefined;

  // <<< Add logging handler for popover state changes >>>
  const handlePopoverOpenChange = (isOpen: boolean) => {
      console.log(`[Widget Popover] onOpenChange called with: ${isOpen}`);
      setIsPopoverOpen(isOpen);
  };

  // --- Effects ---
  // Effect to process alignment data when it arrives (REMOVED auto-play from here)
  createEffect(on(() => props.alignment, (alignmentData) => {
    if (alignmentData && props.hoveredWord) {
      const words = processAlignment(props.hoveredWord, alignmentData);
      setWordMap(words);
      setIsAudioReady(true); 
      setIsGenerating(false);
      // REMOVED: handlePlaySpeed(1.0, true); // Auto-play handled by simulation now
    } else {
      // Clear map but don't affect ready state here
      // setWordMap([]); 
    }
  }));

  // Effect to cleanup interval on unmount or when playback stops
  createEffect(() => {
      if (!isPlaying()) {
          if (highlightInterval) clearInterval(highlightInterval);
          highlightInterval = null;
          setCurrentHighlightIndex(null); // Clear highlight when not playing
      }
      // Cleanup function
      return () => {
          if (highlightInterval) clearInterval(highlightInterval);
      };
  });

  // --- Helper: Process Alignment Data ---
  const processAlignment = (text: string, alignment: AlignmentData): WordInfo[] => {
    const wordInfos: WordInfo[] = [];
    const words = text.match(/\S+/g) || []; // Split by whitespace
    let textIndex = 0;
    let charIndex = 0;

    console.log("[Align] Processing:", text, "Alignment:", alignment);

    words.forEach((word, wordIdx) => {
      const wordStartIndex = text.indexOf(word, textIndex);
      if (wordStartIndex === -1) return; // Should not happen
      const wordEndIndex = wordStartIndex + word.length;
      textIndex = wordEndIndex;

      let wordStartTime = Infinity;
      let wordEndTime = 0;
      let foundChar = false;

      // Find corresponding characters in alignment data
      // This is approximate and assumes alignment characters match text order
      for (let i = charIndex; i < alignment.characters.length; i++) {
        // Simple check: does alignment char roughly match text char?
        // This is brittle - needs refinement based on actual data/normalization
        if (word.includes(alignment.characters[i])) {
           if (i >= charIndex && i < charIndex + word.length) { // Crude check if char belongs to this word
                wordStartTime = Math.min(wordStartTime, alignment.character_start_times_seconds[i]);
                wordEndTime = Math.max(wordEndTime, alignment.character_end_times_seconds[i]);
                foundChar = true;
           } else if (foundChar) {
                // Moved past the characters likely belonging to this word
                break;
           }
        } else if (foundChar) {
            // Character mismatch after finding some matches, assume end of word in alignment data
            break;
        }
        // Always advance charIndex if we checked it
        if (i === alignment.characters.length - 1 || !foundChar || wordEndTime > 0) {
             charIndex = i + 1; // Advance charIndex for next word search
        }
      }

      if (foundChar && isFinite(wordStartTime)) {
        wordInfos.push({
          text: word,
          startTime: wordStartTime,
          endTime: wordEndTime,
          index: wordIdx,
        });
      } else {
         console.warn(`[Align] Could not find timing for word: "${word}"`);
         // Add with dummy times? Or skip?
         wordInfos.push({ text: word, startTime: 0, endTime: 0, index: wordIdx });
      }
    });
    console.log("[Align] Word Map:", wordInfos);
    return wordInfos;
  };

  // --- Handlers ---
  const handleGenerate = async () => {
    console.log(`[Widget handleGenerate] Entry. isGenerating: ${isGenerating()}, isPlaying: ${isPlaying()}`);
    if (isGenerating() || isPlaying()) {
      console.log('[Widget handleGenerate] Exiting early because already generating or playing.');
      return;
    }
    // Use originalWord and sourceLang for TTS request
    console.log(`[Widget] Requesting Audio for originalText: "${props.originalWord}" in lang: ${props.sourceLang}`);
    setIsGenerating(true);
    setIsAudioReady(false);
    setCurrentAudio(null);
    setCurrentHighlightIndex(null);
    setIsPlaying(false);
    if (highlightInterval) clearInterval(highlightInterval);
    
    try {
      // Send props.originalWord and props.sourceLang for TTS
      const ttsResult = await props.onTTSRequest(props.originalWord, props.sourceLang, 1.0);

      if (ttsResult.audioDataUrl) {
        console.log('[Widget] Received audioDataUrl, attempting to play.');
        const audio = new Audio(ttsResult.audioDataUrl);
        setCurrentAudio(audio);

        audio.oncanplaythrough = () => {
          setIsAudioReady(true);
          setIsPlaying(true);
          console.log('[Widget] Audio ready, playing after generation...');
          audio.play().catch(e => {
            console.error('[Widget] Error playing audio post-generation:', e);
            setIsPlaying(false);
            setIsGenerating(false);
            setCurrentAudio(null);
          });
        };
        audio.onended = () => {
          console.log('[Widget] Audio playback finished after generation.');
          setIsPlaying(false);
          setIsGenerating(false);
        };
        audio.onerror = (e) => {
          console.error('[Widget] Error with audio object post-generation:', e);
          setIsAudioReady(false);
          setIsPlaying(false);
          setIsGenerating(false);
          setCurrentAudio(null);
        };
      } else if (ttsResult.error) {
        console.error('[Widget] TTS request failed:', ttsResult.error);
        setIsGenerating(false);
        setCurrentAudio(null);
      }
    } catch (error) {
      console.error('[Widget] Error in handleGenerate calling onTTSRequest:', error);
      setIsGenerating(false);
      setCurrentAudio(null);
    }
    // Simulation block remains commented out
  };

  const handlePlayAgain = () => {
    const audio = currentAudio();
    if (audio && !isPlaying()) {
      console.log('[Widget] Playing stored audio again...');
      setIsPlaying(true);
      audio.currentTime = 0; 
      audio.play().catch(e => {
        console.error('[Widget] Error playing stored audio again:', e);
        setIsPlaying(false);
      });
    } else if (audio && isPlaying()) {
      console.log('[Widget] Audio is already playing. (Play Again clicked)');
    } else if (!audio) {
        console.warn('[Widget] Play Again clicked, but no audio is loaded. Triggering generation.');
        handleGenerate();
    }
  };

  const handlePlaySpeed = async (speed: number) => {
    console.log(`[Widget handlePlaySpeed] Entered. Requested speed: ${speed}x. isGenerating: ${isGenerating()}, isPlaying: ${isPlaying()}`);
    setIsPopoverOpen(false);
    console.log(`[Widget] Requesting regeneration at speed: ${speed}x`);
    
    // Similar logic to handleGenerate, but using the specified speed
    if (isGenerating() || isPlaying()) {
      console.log('[Widget handlePlaySpeed] Ignoring request because already generating or playing.');
      return; // Don't interrupt current generation/playback for speed change for now
    }
    
    setIsGenerating(true);
    setIsAudioReady(false);
    setCurrentAudio(null);
    setCurrentHighlightIndex(null);
    setIsPlaying(false);
    if (highlightInterval) clearInterval(highlightInterval);

    try {
      // Call onTTSRequest with original word, source lang, and *selected speed*
      const ttsResult = await props.onTTSRequest(props.originalWord, props.sourceLang, speed);

      if (ttsResult.audioDataUrl) {
        console.log(`[Widget] Received audioDataUrl for speed ${speed}x, attempting to play.`);
        const audio = new Audio(ttsResult.audioDataUrl);
        setCurrentAudio(audio); // Store the new audio object

        audio.oncanplaythrough = () => {
          setIsAudioReady(true);
          setIsPlaying(true);
          console.log(`[Widget] Audio ready, playing after regeneration at ${speed}x...`);
          audio.play().catch(e => {
            console.error(`[Widget] Error playing audio post-regeneration at ${speed}x:`, e);
            setIsPlaying(false);
            setIsGenerating(false);
            setCurrentAudio(null);
          });
        };
        audio.onended = () => {
          console.log(`[Widget] Audio playback finished after regeneration at ${speed}x.`);
          setIsPlaying(false);
          setIsGenerating(false);
        };
        audio.onerror = (e) => {
          console.error(`[Widget] Error with audio object post-regeneration at ${speed}x:`, e);
          setIsAudioReady(false);
          setIsPlaying(false);
          setIsGenerating(false);
          setCurrentAudio(null);
        };
      } else if (ttsResult.error) {
        console.error(`[Widget] TTS request failed for speed ${speed}x:`, ttsResult.error);
        setIsGenerating(false);
        setCurrentAudio(null);
      }
    } catch (error) {
      console.error(`[Widget] Error in handlePlaySpeed calling onTTSRequest for speed ${speed}x:`, error);
      setIsGenerating(false);
      setCurrentAudio(null);
    }
  };

  const startPlaybackSimulation = (speed: number) => {
    console.log(`[Widget] startPlaybackSimulation called with speed ${speed}x. (For alignment-based highlight)`);
    if (wordMap().length === 0) {
         console.warn("[Widget Sim] No word map available for playback simulation.");
         return;
     }
    setIsPlaying(true);
    setCurrentHighlightIndex(null);
    if (highlightInterval) clearInterval(highlightInterval);

    const words = wordMap();
    let simTime = 0;
    const timeStep = 50;

    highlightInterval = window.setInterval(() => {
        simTime += timeStep / 1000 * speed; 
        let activeWordIndex: number | null = null;
        for (const word of words) {
            if (simTime >= word.startTime && simTime < word.endTime) {
                activeWordIndex = word.index;
                break;
            }
        }
        setCurrentHighlightIndex(activeWordIndex);
        const lastWord = words[words.length - 1];
        if (lastWord && simTime >= lastWord.endTime) {
            console.log("[Widget Sim] Playback simulation finished (alignment).");
            if (highlightInterval) clearInterval(highlightInterval);
            highlightInterval = null;
            setIsPlaying(false);
            setCurrentHighlightIndex(null);
        }
    }, timeStep);
  };

  const handleRegenerate = () => {
    // Regenerate always uses normal speed (calls handleGenerate)
    setIsPopoverOpen(false);
    console.log('[Widget] Regenerating Audio (at normal speed)');
    handleGenerate();
  };

  const allDisabled = () => isPlaying() || isGenerating();

  const showPronunciation = () => {
    // Example: Show Pinyin for Chinese variants
    return props.targetLang.toLowerCase().startsWith('zh') && props.pronunciation;
  };

  const showTTSButton = () => {
      // Example: Enable TTS for specific languages
      const supportedLangs = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko']; // Add more as needed
      return supportedLangs.some(lang => props.targetLang.toLowerCase().startsWith(lang));
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }} // Start transparent and slightly down
      animate={{ opacity: 1, y: 0 }}   // Animate to opaque and original position
      exit={{ opacity: 0, y: 20 }}     // Animate out similarly
      transition={TRANSITION_SETTINGS}
      ref={rootRef}
      class={WIDGET_BASE_CLASSES}
      // Add role for accessibility if appropriate, e.g., role="dialog" aria-modal="true"
      // Consider adding aria-labelledby referencing the main translated word
    >
        {/* Inject CSS */}
        <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>
            {HIGHLIGHT_CSS}
        </Dynamic>

        {/* Row 1: Pronunciation (Defaults to left-aligned) */}
        <Show when={showPronunciation()}>
            <div class="text-base text-muted-foreground/90">
            {props.pronunciation}
            </div>
        </Show>

        {/* Row 2: Original Word (Moved up) */}
        <div class="text-neutral-400 text-lg italic"> {/* Adjusted size */}
            {props.originalWord}
        </div>

        {/* Row 3: Translated Word (with highlight spans) */}
        <div class="flex justify-between items-center gap-2">
            <span class="text-2xl font-semibold text-foreground"> {/* Kept size */}
                <For each={wordMap().length > 0 ? wordMap() : props.hoveredWord.split(/(\s+)/).filter(Boolean).map((w, i) => ({ text: w, index: i, startTime: 0, endTime: 0 })) }>
                  {(word, _) => (
                    <span
                       class="scarlett-word-span"
                       classList={{ 'scarlett-word-highlight': currentHighlightIndex() === word.index }}
                       data-word-index={word.index}
                    >
                      {/* Render space or word */}
                      {word.text.match(/\s+/) ? <>&nbsp;</> : word.text}
                    </span>
                  )}
                </For>
            </span>
        </div>

        {/* Audio Control Area */}
        <Show when={showTTSButton()}>
          <div class="mt-3">
            <Show
              when={isGenerating()}
              fallback={
                <Show
                  when={isAudioReady()}
                  fallback={
                    // Initial State: Generate Audio Button
                    <Button variant="outline" size="lg" onClick={handleGenerate} class="w-full">
                      Generate Audio
                    </Button>
                  }
                >
                  {/* Ready State: Split Button Popover */}
                  <div class="flex items-center"> {/* Split Button Container */}
                      {/* Main Action Button */}
                      <Button
                          variant="outline"
                          size="lg"
                          onClick={handlePlayAgain}
                          disabled={allDisabled()}
                          aria-label={isPlaying() ? "Playing audio..." : `Play audio again for ${props.hoveredWord}`}
                          class="flex-grow rounded-r-none" // Takes space, no right rounding
                      >
                          {isPlaying() ? "Playing..." : "Play Again"}
                      </Button>
                      
                      {/* Relative container for inline popover */}
                      <div class="relative"> 
                        <Popover 
                          placement="top" 
                          gutter={4}
                          // <<< Restore controlled state props >>>
                          open={isPopoverOpen()}
                          // <<< Use logging handler >>>
                          onOpenChange={handlePopoverOpenChange}
                        >
                            <Popover.Trigger
                                aria-label="More options"
                                disabled={allDisabled()}
                                data-popover-trigger="true"
                                onClick={(e) => e.stopPropagation()}
                                // <<< Apply split button classes >>>
                                class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                            </Popover.Trigger>

                            {/* Render Content Inline */}
                            <Show when={isPopoverOpen()}>
                                <Popover.Content 
                                  class={POPOVER_CONTENT_CLASS}
                                  onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <div class="flex flex-col" >
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          class={POPOVER_ITEM_CLASS} 
                                          onPointerDown={() => {
                                            console.log('[Widget Popover Button PointerDown] Play at 0.85x'); 
                                            handlePlaySpeed(0.85);
                                          }}
                                          disabled={allDisabled()}
                                        >
                                            <Play weight="regular" class="mr-2 size-4" /> Play at 0.85x
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          class={POPOVER_ITEM_CLASS} 
                                          onPointerDown={() => {
                                            console.log('[Widget Popover Button PointerDown] Play at 0.70x');
                                            handlePlaySpeed(0.70);
                                          }}
                                          disabled={allDisabled()}
                                        >
                                            <Play weight="regular" class="mr-2 size-4" /> Play at 0.70x
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          class={POPOVER_ITEM_CLASS} 
                                          onPointerDown={() => {
                                            console.log('[Widget Popover Button PointerDown] Regenerate Audio');
                                            handleRegenerate();
                                          }}
                                          disabled={allDisabled()}
                                        >
                                            <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate Audio
                                        </Button>
                                    </div>
                                </Popover.Content>
                            </Show>
                            {/* Portal removed */}
                        </Popover>
                      </div>
                  </div>
                </Show>
              }
            >
              {/* Generating State Button */}
              <Button variant="outline" size="lg" disabled class="w-full">
                <Spinner class="mr-2" /> Generating...
              </Button>
            </Show>
          </div>
        </Show>

    </Motion.div>
  );
};

export default TranslatorWidget; 