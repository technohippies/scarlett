import { Component, Show, For, createSignal, createEffect, Accessor, ErrorBoundary } from 'solid-js';
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

// --- Props Interface ---
export interface TranslatorWidgetProps {
  textToTranslate: Accessor<string>;
  translatedText: Accessor<string>;
  sourceLang: Accessor<string | undefined>;
  targetLang: Accessor<string | undefined>;
  isLoading: Accessor<boolean>;
  pronunciation?: Accessor<string | undefined>;
  onTTSRequest: (text: string, lang: string, speed: number) => Promise<{ audioDataUrl?: string; error?: string, alignment?: AlignmentData | null, browserTtsInitiated?: boolean }>;
  alignment?: Accessor<AlignmentData | null | undefined>; 
  onCloseRequest?: () => void;
  userNativeLanguage: Accessor<string | undefined>;
  userLearningLanguage: Accessor<string | undefined>;
}

// --- Word Data Structure ---
interface WordInfo {
    text: string;
    startTime: number;
    endTime: number;
    index: number;
}

// --- Constants ---
const WIDGET_BASE_CLASSES = "fixed bottom-0 left-4 z-[2147483647] font-sans bg-background text-foreground rounded-t-lg shadow-lg p-4 w-96 text-base flex flex-col gap-1"; 
const TRANSITION_SETTINGS = { duration: 0.3, easing: "ease-out" } as const;
const POPOVER_CONTENT_CLASS = "absolute right-0 bottom-full mb-2 z-[2147483647] w-56 rounded-md bg-popover p-1 text-popover-foreground shadow-md outline-none";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;
const HIGHLIGHT_STYLE_ID = "scarlett-word-highlight-styles";
const HIGHLIGHT_CSS = `
  .scarlett-word-span {
    /* Base styles for all words, Motion.span will handle transitions for its own props like scale */
    background-color: transparent; /* Start transparent, classList will apply highlight color */
    border-radius: 3px; 
    /* padding: 0 0.1em; */ /* REMOVED to prevent awkward spacing */
    /* margin: 0 0.02em; */  /* REMOVED to prevent awkward spacing */
    display: inline-block; /* Still needed for individual background/highlight */
    /* The transition for background-color is implicitly handled by classList change if Motion.span doesn't override it. */
    /* Or, if we want Motion to handle it, remove transition from here and add to Motion.span's transition prop. */
    /* For now, let's assume CSS handles background, Motion handles scale. */
    transition: background-color 0.2s ease-out; 
  }
  .scarlett-word-highlight { 
    background-color: hsl(240, 5%, 25%); /* Lighter version of the background for highlight */
  }
`;

// --- Component ---
const TranslatorWidget: Component<TranslatorWidgetProps> = (props) => {
  createEffect(() => {
    const loggableProps = {
        textToTranslate: props.textToTranslate(),
        translatedText: props.translatedText(),
        isLoading: props.isLoading(),
        sourceLang: props.sourceLang ? props.sourceLang() : undefined,
        targetLang: props.targetLang ? props.targetLang() : undefined,
        pronunciation: props.pronunciation ? props.pronunciation() : undefined,
        alignment: props.alignment ? (props.alignment() ? 'AlignmentData present' : null) : undefined,
    };
    console.log("[TranslatorWidget] Props updated (via accessors):", JSON.parse(JSON.stringify(loggableProps)));
  });

  const [isGeneratingTTS, setIsGeneratingTTS] = createSignal(false);
  const [isPlayingAudio, setIsPlayingAudio] = createSignal(false);
  const [isBrowserTtsActive, setIsBrowserTtsActive] = createSignal(false);
  const [ttsError, setTtsError] = createSignal<string | null>(null);
  const [currentAudio, setCurrentAudio] = createSignal<HTMLAudioElement | null>(null);
  const [wordMap, setWordMap] = createSignal<WordInfo[]>([]);
  const [currentHighlightIndex, setCurrentHighlightIndex] = createSignal<number | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const [currentSpeechSpeed, setCurrentSpeechSpeed] = createSignal<number>(1.0);
  const [audioDataUrl, setAudioDataUrl] = createSignal<string | null>(null);
  const [ttsTarget, setTtsTarget] = createSignal<'original' | 'translated'>('original');
  const [animationFrameId, setAnimationFrameId] = createSignal<number | null>(null);

  let rootRef: HTMLDivElement | undefined;
  let wordMapContainerRef: HTMLSpanElement | undefined;

  // Effect to set smart default for TTS target
  createEffect(() => {
    const nativeLang = props.userNativeLanguage ? props.userNativeLanguage() : undefined;
    const learningLang = props.userLearningLanguage ? props.userLearningLanguage() : undefined;
    const pageLang = props.sourceLang ? props.sourceLang() : undefined; // Language of the text on the page

    if (nativeLang && learningLang && pageLang && pageLang !== 'auto') {
      if (pageLang.startsWith(learningLang)) {
        setTtsTarget('original');
      } else if (pageLang.startsWith(nativeLang)) {
        setTtsTarget('translated');
      } else {
        setTtsTarget('original'); 
      }
    } else {
      setTtsTarget('original'); 
    }
    // Logging moved to after potential setTtsTarget calls to reflect the final state for the effect run
    console.log(`[TranslatorWidget SmartTTS] Native: ${nativeLang}, Learning: ${learningLang}, Page: ${pageLang}. TTS Target set to: ${ttsTarget()}`);
  });

  const isTranslationLoading = () => props.isLoading();
  const isTTSBusy = () => isGeneratingTTS() || isPlayingAudio() || isBrowserTtsActive();

  const handlePopoverOpenChange = (isOpen: boolean) => setIsPopoverOpen(isOpen);

  const updateHighlightLoop = () => {
    const audio = currentAudio();
    if (!audio || audio.paused || audio.ended || !wordMap() || wordMap().length === 0) {
      if (animationFrameId()) {
        cancelAnimationFrame(animationFrameId()!);
        setAnimationFrameId(null);
      }
      // If audio stopped and highlight is still there (e.g. due to abrupt stop), clear it.
      // However, onended/onpause should also handle this.
      // Let's ensure highlight is cleared if loop stops and audio isn't playing.
      if (!isPlayingAudio() && currentHighlightIndex() !== null) {
          // console.log("[HighlightLoop] Audio stopped/ended & not playing, clearing highlight.");
          // setCurrentHighlightIndex(null); // This might be too aggressive if pause is temporary
      }
      return;
    }

    const currentTime = audio.currentTime;
    let activeIndex = -1;

    for (const word of wordMap()) {
      if (currentTime >= word.startTime && currentTime < word.endTime) {
        activeIndex = word.index;
        break;
      }
    }

    if (activeIndex !== -1 && currentHighlightIndex() !== activeIndex) {
      // console.log(`[HighlightLoop] Setting currentHighlightIndex to: ${activeIndex} (was ${currentHighlightIndex()})`);
      setCurrentHighlightIndex(activeIndex);
    } else if (activeIndex === -1 && currentHighlightIndex() !== null) {
      // Check if past the end or before the start
      const map = wordMap();
      if (map.length > 0) {
        if (currentTime >= (map.at(-1)?.endTime || Infinity)) {
          // console.log(`[HighlightLoop] Past end of all words. Clearing highlight. CurrentTime: ${currentTime.toFixed(3)}, LastWordEndTime: ${(map.at(-1)?.endTime || Infinity).toFixed(3)}`);
          setCurrentHighlightIndex(null);
        } else if (currentTime < (map[0]?.startTime || 0)) {
          // console.log("[HighlightLoop] Before first word. Clearing highlight.");
          setCurrentHighlightIndex(null);
        }
      }
    }
    setAnimationFrameId(requestAnimationFrame(updateHighlightLoop));
  };

  const processAlignment = (text: string, alignmentData: AlignmentData, lang: string): WordInfo[] => {
    console.log(`[processAlignment] lang: ${lang}, text: "${text.substring(0,20)}", alignment chars: ${alignmentData && alignmentData.characters ? alignmentData.characters.length : 'N/A'}`);
    const words: WordInfo[] = [];

    if (alignmentData && alignmentData.characters && alignmentData.character_start_times_seconds && alignmentData.character_end_times_seconds &&
        alignmentData.characters.length === alignmentData.character_start_times_seconds.length &&
        alignmentData.characters.length === alignmentData.character_end_times_seconds.length) {
        
        console.log('[processAlignment] Using character-by-character strategy based on provided alignment.');
        for (let i = 0; i < alignmentData.characters.length; i++) {
            // Note: We are including spaces if they have timings. 
            // If pure whitespace characters with zero duration should be skipped, add: 
            // if (alignmentData.characters[i].trim() === '' && alignmentData.character_start_times_seconds[i] === alignmentData.character_end_times_seconds[i]) continue;
            words.push({
                text: alignmentData.characters[i],
                startTime: alignmentData.character_start_times_seconds[i],
                endTime: alignmentData.character_end_times_seconds[i],
                index: i 
            });
        }
        if (words.length > 0) {
             console.log('[processAlignment Char] Processed characters. Count:', words.length, 'First char info:', JSON.parse(JSON.stringify(words[0])));
        } else {
            console.log('[processAlignment Char] No characters found in alignment data (or all were skipped).');
        }
    } else { 
        console.warn('[processAlignment] Character alignment data missing, incomplete, or mismatched lengths. Falling back to splitting input text by character (no timing). Text:', text);
        // Fallback: If no valid character alignment, split the input text by character for basic display
        for (let i = 0; i < text.length; i++) {
            words.push({
                text: text[i],
                startTime: 0, 
                endTime: 0,   
                index: i
            });
        }
        if (words.length > 0) {
            console.log('[processAlignment FallbackChar] Processed text by character split. Count:', words.length, 'First char:', JSON.parse(JSON.stringify(words[0])));
        }
    }
    return words;
  };
  
  const determineTextAndLangForTTS = (): { text: string | undefined, lang: string, actualTarget: 'original' | 'translated' } => {
    const originalText = props.textToTranslate();
    const translatedTextValue = props.translatedText();
    const sLang = props.sourceLang ? props.sourceLang() || 'en' : 'en';
    const tLang = props.targetLang ? props.targetLang() || 'en' : 'en';
    const currentTarget = ttsTarget(); // 'original' or 'translated'

    let text: string | undefined;
    let lang: string;
    let actualTarget = currentTarget; // Track which text is actually chosen

    if (currentTarget === 'original') {
      if (originalText && originalText.trim() !== "") {
        text = originalText;
        lang = sLang;
      } else if (translatedTextValue && translatedTextValue.trim() !== "") { // Fallback to translated if original is empty
        text = translatedTextValue;
        lang = tLang;
        actualTarget = 'translated'; // Indicate fallback
        console.log('[TranslatorWidget TTS] Original preferred but empty, fell back to translated.');
      } else {
        text = undefined;
        lang = sLang; // Default to source lang even if text is undefined
      }
    } else { // currentTarget === 'translated'
      if (translatedTextValue && translatedTextValue.trim() !== "") {
        text = translatedTextValue;
        lang = tLang;
      } else if (originalText && originalText.trim() !== "") { // Fallback to original if translated is empty
        text = originalText;
        lang = sLang;
        actualTarget = 'original'; // Indicate fallback
        console.log('[TranslatorWidget TTS] Translated preferred but empty, fell back to original.');
      } else {
        text = undefined;
        lang = tLang; // Default to target lang
      }
    }
    console.log(`[TranslatorWidget determineTTS] Preferred: ${currentTarget}, Actual: ${actualTarget}, Text: "${text ? text.substring(0,15) : 'N/A'}...", Lang: ${lang}`);
    return { text, lang, actualTarget };
  };

  const handleTTSAction = async (text: string, lang: string, speed: number) => {
    console.log('[Widget TTS] Requesting TTS for:', `"${text.substring(0,20)}..."`, 'lang:', lang, 'speed:', speed);
    if (!text || !lang) {
        setTtsError("Text or language is missing for TTS request.");
        setWordMap([]); // Clear wordMap on error
        return;
    }

    if (currentAudio()) {
        currentAudio()!.pause();
        setCurrentAudio(null);
    }
    setIsPlayingAudio(false);
    if (typeof browser !== 'undefined' && browser.tts && typeof browser.tts.stop === 'function') {
        browser.tts.stop();
    }
    setIsBrowserTtsActive(false);
    setAudioDataUrl(null);
    setTtsError(null);
    setCurrentHighlightIndex(null); 
    setWordMap([]); // Clear wordMap initially before new TTS
    setIsGeneratingTTS(true);

    try {
        const result = await props.onTTSRequest(text, lang, speed);
        console.log('[Widget TTS] Received result from onTTSRequest:', result);

        if (result?.browserTtsInitiated) {
            setIsBrowserTtsActive(true);
            // For browser TTS, we don't get alignment, so split the text for basic word display
            const wordsFromText = text.split(/(\s+)/).filter(s => s.trim().length > 0).map((t, idx) => ({ text: t, index: idx, startTime: 0, endTime: 0 }));
            setWordMap(wordsFromText);
            if (result.error) {
                setTtsError(result.error);
                setIsBrowserTtsActive(false);
                setWordMap([]); // Clear on error
            }
        } else if (result?.audioDataUrl) {
            setAudioDataUrl(result.audioDataUrl);
            // Process wordMap with alignment if available, for the *actually spoken text*
            if (result.alignment) {
                const processedWords = processAlignment(text, result.alignment, lang);
                setWordMap(processedWords);
            } else {
                // Fallback: If no alignment, split the spoken text by space.
                const wordsFromText = text.split(/(\s+)/).filter(s => s.trim().length > 0).map((t, idx) => ({ text: t, index: idx, startTime: 0, endTime: 0 }));
                setWordMap(wordsFromText);
            }

            const audio = new Audio(result.audioDataUrl);
            setCurrentAudio(audio);
            audio.onplay = () => {
                setIsPlayingAudio(true);
                if (animationFrameId()) {
                    cancelAnimationFrame(animationFrameId()!);
                }
                setAnimationFrameId(requestAnimationFrame(updateHighlightLoop));
            };
            audio.onpause = () => {
                setIsPlayingAudio(false);
                if (animationFrameId()) {
                    cancelAnimationFrame(animationFrameId()!);
                    setAnimationFrameId(null);
                }
                // If paused by user action, we might want to keep the current highlight.
                // If paused because it ended, onended will clear it.
            };
            audio.onended = () => {
                setIsPlayingAudio(false);
                setCurrentHighlightIndex(null); // Clear highlight on end
                if (animationFrameId()) {
                    cancelAnimationFrame(animationFrameId()!);
                    setAnimationFrameId(null);
                }
            };
            audio.onerror = (e) => {
                console.error('[Widget TTS] HTML Audio playback error:', e);
                setTtsError('Error playing audio.');
                setIsPlayingAudio(false);
                // setCurrentAudio(null); // Keep audio for potential re-attempts or error inspection if needed
                if (animationFrameId()) {
                    cancelAnimationFrame(animationFrameId()!);
                    setAnimationFrameId(null);
                }
            };
            audio.ontimeupdate = () => {
                // This can be removed or used for other less frequent updates if needed.
                // For now, the requestAnimationFrame loop handles highlighting.
                // console.log(`[Ontimeupdate] CurrentTime: ${audio.currentTime.toFixed(3)}, isBrowserTtsActive: ${isBrowserTtsActive()}`);
            };
            await audio.play();
        } else if (result?.error) {
            setTtsError(result.error);
            setWordMap([]); // Clear on error
        } else {
            setTtsError('TTS generation failed to produce audio or an error.');
            setWordMap([]); // Clear on failure
        }
    } catch (error: any) {
        console.error('[Widget TTS] Error in handleTTSAction catch block:', error);
        setTtsError(error.message || 'Failed to handle TTS action.');
        setWordMap([]); // Clear on catch
    } finally {
        setIsGeneratingTTS(false);
    }
  };

  const onPlayButtonClick = () => {
    const { text: textToSpeak, lang: langCodeForTTS, actualTarget } = determineTextAndLangForTTS();

    if (isBrowserTtsActive()) {
        if (typeof browser !== 'undefined' && browser.tts && typeof browser.tts.stop === 'function') {
            browser.tts.stop();
        }
        setIsBrowserTtsActive(false);
        if (textToSpeak) {
            handleTTSAction(textToSpeak, langCodeForTTS, currentSpeechSpeed());
        }
    } else if (currentAudio() && audioDataUrl()) {
        if (isPlayingAudio()) {
            currentAudio()!.pause();
        } else {
            currentAudio()!.currentTime = 0; // Reset to start for replaying
            currentAudio()!.play();
        }
    } else if (textToSpeak) {
        handleTTSAction(textToSpeak, langCodeForTTS, currentSpeechSpeed());
    }
  };
  
  const handlePlaySpeed = (speed: number) => {
    setIsPopoverOpen(false);
    setCurrentSpeechSpeed(speed);
    const { text: textToSpeak, lang: langCodeForTTS, actualTarget } = determineTextAndLangForTTS();
    if (textToSpeak) {
        handleTTSAction(textToSpeak, langCodeForTTS, speed);
    }
  };

  const handleRegenerate = () => {
    setIsPopoverOpen(false);
    const { text: textToSpeak, lang: langCodeForTTS, actualTarget } = determineTextAndLangForTTS();
    if (textToSpeak) {
        handleTTSAction(textToSpeak, langCodeForTTS, currentSpeechSpeed());
    }
  };

  const showPronunciation = () => {
    const sLang = props.sourceLang ? props.sourceLang() || 'en' : 'en';
    const pVal = props.pronunciation ? props.pronunciation() : undefined;
    return sLang?.toLowerCase().startsWith('zh') && pVal;
  };
  const showTTSFeature = () => {
    const supportedLangs = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'it', 'ru', 'nl', 'pl', 'sv', 'da', 'fi', 'no', 'tr', 'ar', 'hi', 'id', 'vi', 'th', 'el', 'cs', 'hu', 'ro', 'sk', 'uk', 'ms', 'he'];
    const sLang = props.sourceLang ? props.sourceLang() || 'en' : 'en';
    return sLang && (sLang === 'auto' || supportedLangs.some(lang => sLang.toLowerCase().startsWith(lang)));
  };

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      transition={TRANSITION_SETTINGS} ref={rootRef} class={`${WIDGET_BASE_CLASSES} min-h-[11rem]`} >
        <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>

        <ErrorBoundary fallback={(err, reset) => (
            <div>
                <p class="text-destructive">Error rendering widget section:</p>
                <pre class="text-xs text-destructive/80">{err.toString()}</pre>
                <Button size="sm" onClick={reset} class="mt-2">Try to reset</Button>
            </div>
        )}>
            {/* Row 1: Original Text (textToTranslate) */}
            <div class="text-lg py-2 mb-1 flex items-center flex-wrap">
                <Show when={ttsTarget() === 'original' && wordMap().length > 0 && !isTranslationLoading() } 
                    fallback={props.textToTranslate() || "Original text"}>
                    {/* Render original text with highlighting if it's the TTS target */}
                    <For each={wordMap()}>{(word: WordInfo, index: Accessor<number>) => (
                        <span
                            class="scarlett-word-span"
                            classList={{ 'scarlett-word-highlight': currentHighlightIndex() === word.index && !isBrowserTtsActive() }}
                            data-word-index={word.index}
                        >
                            {word.text.replace(/ /g, '\u00A0')}
                        </span>
                    )}
                    </For>
                </Show>
            </div>

            {/* Row 2: Translated Text / Loading State */}
            <div class="text-lg py-2 mb-1 flex items-center flex-wrap">
                <Show 
                    when={!isTranslationLoading()} 
                    fallback={<span class="text-muted-foreground/80">{isTranslationLoading() ? "Translating..." : (props.translatedText() ? " " : "Enter text for translation output")}</span>}
                >
                    <Show when={ttsTarget() === 'translated' && wordMap().length > 0}
                        fallback={props.translatedText() || ""} // Show plain translated text if not target or no wordMap
                    >
                        {/* Render translated text with highlighting if it's the TTS target */}
                        <span ref={wordMapContainerRef}>
                            <For each={wordMap()}>{(word: WordInfo, index: Accessor<number>) => (
                                <span
                                    class="scarlett-word-span"
                                    classList={{ 'scarlett-word-highlight': currentHighlightIndex() === word.index && !isBrowserTtsActive() }}
                                    data-word-index={word.index}
                                >
                                    {word.text.replace(/ /g, '\u00A0')}
                                </span>
                            )}
                            </For>
                        </span>
                    </Show>
                </Show>
            </div>

            {/* Row 3: Pronunciation */}
            <div class="min-h-[1.5em] text-base text-muted-foreground/80 mb-2 flex items-center">
                <Show when={showPronunciation() && !isTranslationLoading()}>{props.pronunciation ? props.pronunciation() : ''}</Show>
            </div>

        </ErrorBoundary>

        {/* TTS Error Display */}
        <Show when={ttsError()}>
            <p class="text-xs text-destructive mb-1">{ttsError()}</p>
        </Show>

        {/* Row 4: TTS Controls */}
        <Show when={showTTSFeature()}> 
            <div class="mt-auto pt-1"> {/* Full width container for the button area */} 
              <Show when={isGeneratingTTS()}
                fallback={
                  <Show when={audioDataUrl()} /* Audio has been generated / is ready */
                    fallback={ /* No audio generated yet -> "Generate Audio" button */
                      <Button variant="outline" size="lg" onClick={onPlayButtonClick} class="w-full"
                        disabled={isGeneratingTTS() || isTranslationLoading() || !(props.translatedText() || props.textToTranslate())}
                      >
                        Generate Audio
                      </Button>
                    }
                  >
                    {/* Audio is ready -> "Play Again/Playing..." button with popover */} 
                    <div class="flex items-center">
                      <Button variant="outline" size="lg" onClick={onPlayButtonClick}
                        class="flex-grow rounded-r-none" 
                        disabled={isGeneratingTTS() || isTranslationLoading()} 
                      >
                        <Show when={isPlayingAudio()} fallback="Play Again">
                           Playing...
                        </Show>
                      </Button>
                      {/* Popover for speed/regenerate */} 
                      <div class="relative">
                        <Popover placement="top-end" gutter={4} open={isPopoverOpen()} onOpenChange={handlePopoverOpenChange}>
                          <Popover.Trigger
                            aria-label="More options"
                            disabled={isGeneratingTTS() || isTranslationLoading()} 
                            class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                          </Popover.Trigger>
                          <Show when={isPopoverOpen()}>
                            <Popover.Content class={POPOVER_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
                              <div class="flex flex-col">
                                <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.85)} disabled={isTTSBusy()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.85x </Button>
                                <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.70)} disabled={isTTSBusy()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.70x </Button>
                                <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={handleRegenerate} disabled={isTTSBusy()}> <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate </Button>
                              </div>
                            </Popover.Content>
                          </Show>
                        </Popover>
                      </div>
                    </div>
                  </Show>
                }
              >
                {/* Generating TTS -> Spinner button */} 
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