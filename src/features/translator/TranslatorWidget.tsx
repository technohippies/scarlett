import { Component, Show, For, createSignal, createEffect, on, Accessor, ErrorBoundary } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, ArrowClockwise, PauseCircle, PlayCircle } from 'phosphor-solid';
import { Dynamic } from 'solid-js/web';
import 'virtual:uno.css';
import { cn } from '../../lib/utils';

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
    border-radius: 3px; padding: 0 0.1em; margin: 0 0.02em; display: inline-block;
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

  let rootRef: HTMLDivElement | undefined;
  let wordMapContainerRef: HTMLSpanElement | undefined;

  const isTranslationLoading = () => props.isLoading();
  const isTTSBusy = () => isGeneratingTTS() || isPlayingAudio() || isBrowserTtsActive();

  const handlePopoverOpenChange = (isOpen: boolean) => setIsPopoverOpen(isOpen);

  // Restore processAlignment logic for wordMap
  createEffect(on(
    [
      () => props.translatedText(), 
      // Guard against props.alignment itself being undefined
      () => props.alignment ? props.alignment() : undefined 
    ],
    ([translatedTextValue, alignmentValue]) => {
    console.log(`[WordMap Effect - Restored] Input Translated Text: "${translatedTextValue ? translatedTextValue.substring(0,20) : 'N/A'}...", Alignment present: ${!!alignmentValue}`);
    if (alignmentValue && translatedTextValue && alignmentValue.characters && alignmentValue.character_start_times_seconds && alignmentValue.character_end_times_seconds) {
        const processedWords = processAlignment(translatedTextValue, alignmentValue);
        setWordMap(processedWords);
        console.log('[WordMap Effect - Restored] Set wordMap using processAlignment. Word count:', processedWords.length, 'First 5:', JSON.parse(JSON.stringify(processedWords.slice(0,5))));
    } else if (typeof translatedTextValue === 'string' && translatedTextValue.trim().length > 0) {
        // Fallback: If no alignment, split by space. 
        // This provides basic word segmentation but no timing for highlighting.
        const wordsFromText = translatedTextValue.split(/(\s+)/).filter(s => s.trim().length > 0).map((text, index) => ({
            text,
            index,
            startTime: 0, // No timing info available
            endTime: 0    // No timing info available
        }));
        setWordMap(wordsFromText);
        console.log('[WordMap Effect - Restored] Set wordMap by splitting text (no alignment). Word count:', wordsFromText.length, 'First 5:', JSON.parse(JSON.stringify(wordsFromText.slice(0,5))));
    } else {
        setWordMap([]);
        console.log('[WordMap Effect - Restored] Set wordMap to empty array (no text or invalid alignment).');
    }
  }));

  const processAlignment = (text: string, alignmentData: AlignmentData): WordInfo[] => {
    const words: WordInfo[] = [];
    const textSegments = text.split(/(\s+)/).filter(s => s.trim().length > 0);
    let charIdx = 0;
    let textSegmentIdx = 0;

    while (textSegmentIdx < textSegments.length && charIdx < alignmentData.characters.length) {
        const currentTextSegment = textSegments[textSegmentIdx];
        let segmentStartTime = -1;
        let segmentEndTime = -1;
        let firstCharOfSegmentMatched = false;

        let tempCharIdx = charIdx;
        let searchOffset = 0;
        while(tempCharIdx < alignmentData.characters.length && searchOffset < currentTextSegment.length) {
            if (alignmentData.characters[tempCharIdx] === currentTextSegment[searchOffset]) {
                if (!firstCharOfSegmentMatched) {
                    segmentStartTime = alignmentData.character_start_times_seconds[tempCharIdx];
                    firstCharOfSegmentMatched = true;
                }
                if (searchOffset === currentTextSegment.length - 1) {
                    segmentEndTime = alignmentData.character_end_times_seconds[tempCharIdx];
                    charIdx = tempCharIdx + 1;
                    break; 
                }
                searchOffset++;
            } else if (firstCharOfSegmentMatched) {
                segmentEndTime = alignmentData.character_end_times_seconds[tempCharIdx -1] || segmentStartTime;
                charIdx = tempCharIdx;
                break;
            }
            tempCharIdx++;
            if(tempCharIdx >= alignmentData.characters.length && firstCharOfSegmentMatched && segmentEndTime === -1){
                segmentEndTime = alignmentData.character_end_times_seconds[alignmentData.characters.length -1];
                charIdx = tempCharIdx;
                break;
            }
        }

        if (firstCharOfSegmentMatched && segmentStartTime !== -1 && segmentEndTime !== -1) {
            words.push({
                text: currentTextSegment,
                startTime: segmentStartTime,
                endTime: segmentEndTime,
                index: textSegmentIdx
            });
        } else {
            words.push({ text: currentTextSegment, startTime: 0, endTime: 0, index: textSegmentIdx });
        }
        textSegmentIdx++;
    }
    
    while (textSegmentIdx < textSegments.length) {
        words.push({ text: textSegments[textSegmentIdx], startTime: 0, endTime: 0, index: textSegmentIdx });
        textSegmentIdx++;
    }
    return words;
  };
  
  const determineTextAndLangForTTS = (): { text: string | undefined, lang: string } => {
    const originalText = props.textToTranslate();
    const translatedTextValue = props.translatedText();
    let text: string | undefined;
    let lang: string;

    if (translatedTextValue && translatedTextValue.trim() !== "") {
        text = translatedTextValue;
        lang = props.targetLang ? props.targetLang() || 'en' : 'en';
    } else if (originalText && originalText.trim() !== "") {
        text = originalText;
        // Use sourceLang for original text if available, otherwise fallback
        lang = props.sourceLang ? props.sourceLang() || 'en' : 'en';
    } else {
        text = undefined;
        // Default lang if no text, though it won't be used if text is undefined
        lang = props.targetLang ? props.targetLang() || 'en' : 'en'; 
    }
    return { text, lang };
  };

  const handleTTSAction = async (text: string, lang: string, speed: number) => {
    console.log('[Widget TTS] Requesting TTS for:', `"${text.substring(0,20)}..."`, 'lang:', lang, 'speed:', speed);
    if (!text || !lang) {
        setTtsError("Text or language is missing for TTS request.");
        return;
    }

    if (currentAudio()) {
        currentAudio()!.pause();
        setCurrentAudio(null);
    }
    setIsPlayingAudio(false);
    // Guard against 'browser' not being defined in non-extension environments (like Storybook)
    if (typeof browser !== 'undefined' && browser.tts && typeof browser.tts.stop === 'function') {
        browser.tts.stop();
    }
    setIsBrowserTtsActive(false);
    setAudioDataUrl(null);
    setTtsError(null);
    setCurrentHighlightIndex(null); 
    setIsGeneratingTTS(true);

    try {
        const result = await props.onTTSRequest(text, lang, speed);
        console.log('[Widget TTS] Received result from onTTSRequest:', result);

        if (result?.browserTtsInitiated) {
            setIsBrowserTtsActive(true);
            if (result.error) {
                setTtsError(result.error);
                setIsBrowserTtsActive(false);
            }
        } else if (result?.audioDataUrl) {
            setAudioDataUrl(result.audioDataUrl);
            const audio = new Audio(result.audioDataUrl);
            setCurrentAudio(audio);
            audio.onplay = () => setIsPlayingAudio(true);
            audio.onpause = () => setIsPlayingAudio(false);
            audio.onended = () => {
                setIsPlayingAudio(false);
                setCurrentAudio(null);
                setCurrentHighlightIndex(null);
            };
            audio.onerror = (e) => {
                console.error('[Widget TTS] HTML Audio playback error:', e);
                setTtsError('Error playing audio.');
                setIsPlayingAudio(false);
                setCurrentAudio(null);
            };
            audio.ontimeupdate = () => {
                if (!wordMap() || wordMap().length === 0) return;
                const currentTime = audio.currentTime;
                let activeIndex = -1;
                // console.log(`[Ontimeupdate] CurrentTime: ${currentTime.toFixed(3)}, isBrowserTtsActive: ${isBrowserTtsActive()}`);

                for (const word of wordMap()) {
                    // console.log(`[Ontimeupdate] Checking word: "${word.text}", Start: ${word.startTime.toFixed(3)}, End: ${word.endTime.toFixed(3)}, Index: ${word.index}`);
                    if (currentTime >= word.startTime && currentTime < word.endTime) {
                        activeIndex = word.index;
                        // console.log(`[Ontimeupdate] Match found! activeIndex set to: ${activeIndex}`);
                        break;
                    }
                }

                if (activeIndex !== -1 && currentHighlightIndex() !== activeIndex) {
                    console.log(`[Ontimeupdate] Setting currentHighlightIndex to: ${activeIndex} (was ${currentHighlightIndex()})`);
                    setCurrentHighlightIndex(activeIndex);
                } else if (activeIndex === -1 && currentHighlightIndex() !== null && currentTime >= (wordMap().at(-1)?.endTime || Infinity)) {
                    // If past the last word's end time and highlight is still set, clear it
                    console.log(`[Ontimeupdate] Past end of all words. Clearing highlight. CurrentTime: ${currentTime.toFixed(3)}, LastWordEndTime: ${(wordMap().at(-1)?.endTime || Infinity).toFixed(3)}`);
                    setCurrentHighlightIndex(null);
                } else if (activeIndex !== -1 && currentHighlightIndex() === activeIndex) {
                    // Already highlighting the correct word, do nothing
                } else if (activeIndex === -1 && currentHighlightIndex() !== null) {
                    // No match and highlight is set, but not yet past the end. Potentially in a gap, keep current highlight or clear?
                    // For now, let's be conservative and only clear if explicitly past the end or at the very start before any word.
                     if (currentTime < (wordMap()[0]?.startTime || 0)) {
                        console.log("[Ontimeupdate] Before first word. Clearing highlight.");
                        setCurrentHighlightIndex(null);
                     }
                }
            };
            await audio.play();
        } else if (result?.error) {
            setTtsError(result.error);
        } else {
            setTtsError('TTS generation failed to produce audio or an error.');
        }
    } catch (error: any) {
        console.error('[Widget TTS] Error in handleTTSAction catch block:', error);
        setTtsError(error.message || 'Failed to handle TTS action.');
    } finally {
        setIsGeneratingTTS(false);
    }
  };

  const onPlayButtonClick = () => {
    const { text: textToSpeak, lang: langCodeForTTS } = determineTextAndLangForTTS();

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
            currentAudio()!.play();
        }
    } else if (textToSpeak) {
        handleTTSAction(textToSpeak, langCodeForTTS, currentSpeechSpeed());
    }
  };
  
  const handlePlaySpeed = (speed: number) => {
    setIsPopoverOpen(false);
    setCurrentSpeechSpeed(speed);
    const { text: textToSpeak, lang: langCodeForTTS } = determineTextAndLangForTTS();
    if (textToSpeak) {
        handleTTSAction(textToSpeak, langCodeForTTS, speed);
    }
  };

  const handleRegenerate = () => {
    setIsPopoverOpen(false);
    const { text: textToSpeak, lang: langCodeForTTS } = determineTextAndLangForTTS();
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
            {/* Row 1: Original Text (textToTranslate) - Larger base size, muted */}
            <div class="text-lg text-muted-foreground mb-1 min-h-[1.5em] flex items-center flex-wrap">
                {props.textToTranslate() || "Original text"}
            </div>

            {/* Row 2: Translated Text / Loading State - Larger, prominent, highlightable */}
            <div class="text-2xl font-semibold text-foreground mb-1 min-h-[2em] flex items-center flex-wrap">
                <Show 
                    when={!isTranslationLoading()} 
                    fallback={<span class="text-muted-foreground/80">{isTranslationLoading() ? "Translating..." : (props.translatedText() ? " " : "Enter text for translation output")}</span>}
                >
                    {/* wordMapContainerRef is on the span that will contain the highlightable words */}
                    <span ref={wordMapContainerRef}>
                        {(() => {
                            console.log('[TranslatorWidget Row 2] Before <For>, wordMap() is:', JSON.parse(JSON.stringify(wordMap())));
                            return null; 
                        })()}
                        <Show when={wordMap() && wordMap().length > 0}>
                            <For each={wordMap()}>{(word: WordInfo, index: Accessor<number>) => {
                                if (index() === 0) {
                                    console.log('[TranslatorWidget Row 2] <For> loop, first word object:', JSON.parse(JSON.stringify(word)));
                                    console.log('[TranslatorWidget Row 2] <For> loop, first word.text type:', typeof word.text);
                                    console.log('[TranslatorWidget Row 2] <For> loop, first word.text value:', word.text);
                                }
                                const textToDisplay = (typeof word.text === 'string') ? word.text.replace(/ /g, '\u00A0') : '[INVALID_TEXT]';
                                return (
                                    <span
                                        class="scarlett-word-span"
                                        classList={{ 'scarlett-word-highlight': currentHighlightIndex() === word.index && !isBrowserTtsActive() }}
                                        data-word-index={word.index}
                                    >
                                        {textToDisplay}
                                    </span>
                                );
                            }}
                            </For>
                        </Show>
                    </span>
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
            <div class="mt-auto pt-1 flex items-center gap-2"> 
                <Button
                    variant="ghost"
                    size="icon"
                    class={cn(
                        "p-1.5 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                        (isPlayingAudio() || isBrowserTtsActive()) ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                    title={isBrowserTtsActive() ? "Stop Browser TTS / Replay" : (isPlayingAudio() ? "Pause" : "Play")}
                    onClick={onPlayButtonClick}
                    disabled={isGeneratingTTS() || ( !(props.translatedText() || props.textToTranslate()) && !audioDataUrl() )}
                >
                    <Show when={isGeneratingTTS()}>
                        <Spinner />
                    </Show>
                    <Show when={!isGeneratingTTS()}>
                        {(isPlayingAudio() || isBrowserTtsActive()) ? <PauseCircle size={22} /> : <PlayCircle size={22} />}
                    </Show>
                </Button>
                
                <div class="relative">
                    <Popover placement="top-start" gutter={4} open={isPopoverOpen()} onOpenChange={handlePopoverOpenChange}>
                        <Popover.Trigger 
                            aria-label="More options" 
                            disabled={isGeneratingTTS() || !(props.translatedText() || props.textToTranslate())} 
                            class="inline-flex items-center justify-center whitespace-nowrap rounded-md p-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
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
    </Motion.div>
  );
};

export default TranslatorWidget;