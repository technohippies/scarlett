import { Component, Show, For, createSignal, createEffect, on, Accessor } from 'solid-js';
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
  translatedText?: Accessor<string | undefined>;
  sourceLang?: Accessor<string | undefined>;
  targetLang?: Accessor<string | undefined>;
  isLoading: Accessor<boolean>;
  pronunciation?: Accessor<string | undefined>;
  onTTSRequest: (text: string, lang: string, speed: number) => Promise<{ audioDataUrl?: string; error?: string, alignment?: AlignmentData | null }>; 
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
    background-color: transparent;
    transition: background-color 0.15s ease-in-out;
    border-radius: 3px; padding: 0 0.1em; margin: 0 0.02em; display: inline-block;
  }
  .scarlett-word-highlight { background-color: hsla(var(--foreground), 0.15); }
`;

// --- Component ---
const TranslatorWidget: Component<TranslatorWidgetProps> = (props) => {
  createEffect(() => {
    const loggableProps = {
        textToTranslate: props.textToTranslate(),
        translatedText: props.translatedText ? props.translatedText() : undefined,
        isLoading: props.isLoading(),
        sourceLang: props.sourceLang ? props.sourceLang() : undefined,
        targetLang: props.targetLang ? props.targetLang() : undefined,
        pronunciation: props.pronunciation ? props.pronunciation() : undefined,
        alignment: props.alignment ? (props.alignment() ? 'AlignmentData present' : null) : undefined,
        onTTSRequest: '[function]',
        onCloseRequest: '[function]',
    };
    console.log("[TranslatorWidget] Props updated (via accessors):", JSON.parse(JSON.stringify(loggableProps)));
  });

  const [isGeneratingTTS, setIsGeneratingTTS] = createSignal(false);
  const [isAudioReady, setIsAudioReady] = createSignal(false);
  const [isPlayingAudio, setIsPlayingAudio] = createSignal(false);
  const [wordMap, setWordMap] = createSignal<WordInfo[]>([]);
  const [currentHighlightIndex, setCurrentHighlightIndex] = createSignal<number | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = createSignal(false);
  const [currentAudio, setCurrentAudio] = createSignal<HTMLAudioElement | null>(null);
  let highlightInterval: number | null = null;
  let rootRef: HTMLDivElement | undefined;

  const isTranslationLoading = () => props.isLoading();
  const isTTSBusy = () => isGeneratingTTS() || isPlayingAudio();

  const handlePopoverOpenChange = (isOpen: boolean) => setIsPopoverOpen(isOpen);

  // Combined effect for wordMap initialization and updates
  createEffect(on([props.textToTranslate, props.alignment || (() => null)], ([text, alignmentValue]) => {
    console.log(`[WordMap Effect] Input Text: "${text ? text.substring(0,20) : 'N/A'}...", Alignment: ${alignmentValue ? 'Present' : 'Absent'}`);
    if (text && text.trim().length > 0) { 
      if (alignmentValue) {
        const words = processAlignment(text, alignmentValue as AlignmentData);
        setWordMap(words);
        console.log("[WordMap Effect] Set words from alignment data. Word count:", words.length);
      } else {
        const splitBySpace = text.split(/(\s+)/); 
        console.log("[WordMap Effect] Text split by (/s+)/:", splitBySpace);
        
        const filteredWords = splitBySpace.filter(s => s && s.length > 0); 
        console.log("[WordMap Effect] Filtered split parts (non-empty):", filteredWords);

        const plainWords = filteredWords.map((w, i) => ({ text: w, index: i, startTime: 0, endTime: 0 }));
        
        if (plainWords.length === 0 && text.length > 0) { 
            console.log("[WordMap Effect] No spaces found, treating entire text as one word.");
            setWordMap([{ text: text, index: 0, startTime: 0, endTime: 0 }]);
        } else {
            setWordMap(plainWords);
        }
        // Log the actual value *after* setting
        console.log("[WordMap Effect] Set plain words. Current wordMap() state:", JSON.parse(JSON.stringify(wordMap())));
      }
    } else {
      setWordMap([]); 
      console.log("[WordMap Effect] Cleared wordMap due to empty or whitespace-only text.");
    }
  }, { defer: true }));

  createEffect(() => {
      if (!isPlayingAudio()) {
          if (highlightInterval) clearInterval(highlightInterval);
          highlightInterval = null;
          setCurrentHighlightIndex(null);
      }
      return () => { if (highlightInterval) clearInterval(highlightInterval); };
  });

  const processAlignment = (text: string, alignment: AlignmentData): WordInfo[] => {
    console.log(`[Align] Processing text: "${text.substring(0,30)}..." with ${alignment.characters.length} alignment chars.`);
    // Placeholder for actual character-to-word conversion from ElevenLabs data
    const words: WordInfo[] = [];
    const textWords = text.match(/\S+/g) || []; 
    let charProcessedIndex = 0;

    textWords.forEach((wordStr, wordIdx) => {
        let currentWordStartTime = -1;
        let currentWordEndTime = -1;
        let originalTextWordStart = text.indexOf(wordStr, charProcessedIndex); 

        if(originalTextWordStart !== -1){
            let wordStartCharIndexInAlignment = -1;
            let wordEndCharIndexInAlignment = -1;
            let currentTextCharIndex = 0; // Tracks character position in the *original text*
            let alignmentCharCursor = 0; // Tracks character position in *alignment.characters*

            // Attempt to map originalTextWordStart to an alignment character index
            for (let i = 0; i < originalTextWordStart; i++) {
                if (alignmentCharCursor < alignment.characters.length && text[i] === alignment.characters[alignmentCharCursor]) {
                    alignmentCharCursor++;
                } else if (text[i] !== ' ') {
                    // If characters don't match and it's not a space in original text, this implies potential normalization
                    // or a mismatch. For simple cases, we might just advance alignmentCharCursor if original text had a char.
                    // This part is highly dependent on how ElevenLabs normalizes text vs. original.
                    // For now, we assume a rough correspondence for non-space characters.
                    if (alignmentCharCursor < alignment.characters.length && alignment.characters[alignmentCharCursor] !== ' ') {
                        alignmentCharCursor++; 
                    }
                }
            }
            wordStartCharIndexInAlignment = alignmentCharCursor; // Tentative start

            // Now find the end of the word in alignment data
            let charsMatchedInWord = 0;
            for (let k = 0; k < wordStr.length; k++) {
                if (alignmentCharCursor < alignment.characters.length && wordStr[k] === alignment.characters[alignmentCharCursor]) {
                    charsMatchedInWord++;
                    if (k === wordStr.length - 1) { // Last char of the word
                        wordEndCharIndexInAlignment = alignmentCharCursor;
                    }
                    alignmentCharCursor++;
                } else if (wordStr[k] !== ' ') { // Mismatch, not a space
                    break; // Stop if word char doesn't match and it's not a space
                } else { // Space in wordStr, skip in alignment if it's also space or if flexible
                     if(alignmentCharCursor < alignment.characters.length && alignment.characters[alignmentCharCursor] === ' ') alignmentCharCursor++;
                }
            }
            
            if (wordStartCharIndexInAlignment !== -1 && wordEndCharIndexInAlignment !== -1 && charsMatchedInWord > 0) {
                currentWordStartTime = alignment.character_start_times_seconds[wordStartCharIndexInAlignment];
                currentWordEndTime = alignment.character_end_times_seconds[wordEndCharIndexInAlignment];
            }
            charProcessedIndex = originalTextWordStart + wordStr.length; 
        }

        if (currentWordStartTime !== -1 && currentWordEndTime !== -1) {
            words.push({ text: wordStr, startTime: currentWordStartTime, endTime: currentWordEndTime, index: wordIdx });
        } else {
             console.warn(`[Align] Could not find precise timing for word: "${wordStr}". Using fallback.`);
             words.push({ text: wordStr, startTime: 0, endTime: 0, index: wordIdx }); 
        }
        while(charProcessedIndex < text.length && text[charProcessedIndex].match(/\s/)) {
            charProcessedIndex++;
        }
    });
    
    if (words.length === 0 && textWords.length > 0) { 
        console.warn("[Align] Complex alignment logic failed, falling back to simple word split.");
        return textWords.map((w, i) => ({ text: w, startTime: 0, endTime: 0, index: i }));
    }
    console.log("[Align] Word map result:", words.map(w => `${w.text}(${w.startTime.toFixed(2)}-${w.endTime.toFixed(2)})`));
    return words;
  };
  
  const handleTTSAction = async (speed: number = 1.0, isRegeneration: boolean = false) => {
    if (isTTSBusy() && !isRegeneration) return;
    if(isTranslationLoading()) return;

    const currentTextToTranslate = props.textToTranslate();
    const currentSourceLang = (props.sourceLang ? props.sourceLang() : undefined) || 'und';

    console.log(`[Widget TTS] Requesting: "${currentTextToTranslate.substring(0,30)}..." lang: ${currentSourceLang}, speed: ${speed}`);
    setIsGeneratingTTS(true);
    setIsAudioReady(false);
    setCurrentAudio(null);
    setCurrentHighlightIndex(null);
    setIsPlayingAudio(false);
    if (highlightInterval) clearInterval(highlightInterval);

    try {
      const ttsResult = await props.onTTSRequest(currentTextToTranslate, currentSourceLang, speed);
      console.log("[Widget TTS] Received result from onTTSRequest:", ttsResult ? 'has result' : 'no result');

      if (ttsResult && ttsResult.audioDataUrl) {
        const audio = new Audio(ttsResult.audioDataUrl);
        setCurrentAudio(audio);
        audio.oncanplaythrough = () => {
          console.log("[Widget TTS] Audio can play through.");
          setIsAudioReady(true);
          setIsGeneratingTTS(false);
          setIsPlayingAudio(true);
          audio.play().catch(e => {
            console.error('[Widget TTS] Error playing audio:', e);
            setIsPlayingAudio(false); setCurrentAudio(null); setIsGeneratingTTS(false);
          });
        };
        audio.onended = () => { 
            console.log("[Widget TTS] Audio ended.");
            setIsPlayingAudio(false); 
        };
        audio.onerror = (e) => {
          console.error('[Widget TTS] Error with audio object:', e);
          setIsAudioReady(false); setIsPlayingAudio(false); setIsGeneratingTTS(false); setCurrentAudio(null);
        };
        audio.ontimeupdate = () => {
            if (!isPlayingAudio()) return;
            const currentTime = audio.currentTime;
            const currentWords = wordMap();
            let foundIndex = -1;
            for (let i = 0; i < currentWords.length; i++) {
                if (currentWords[i].startTime >= 0 && currentWords[i].endTime > currentWords[i].startTime && 
                    currentTime >= currentWords[i].startTime && currentTime <= currentWords[i].endTime) {
                    foundIndex = currentWords[i].index;
                    break;
                }
            }
            if (currentHighlightIndex() !== foundIndex) { 
                setCurrentHighlightIndex(foundIndex === -1 ? null : foundIndex);
            }
        };

      } else {
        console.error('[Widget TTS] TTS request failed or no audioDataUrl:', ttsResult?.error);
        setIsGeneratingTTS(false); setCurrentAudio(null);
      }
    } catch (error) {
      console.error('[Widget TTS] Error in handleTTSAction:', error);
      setIsGeneratingTTS(false); setCurrentAudio(null);
    }
  };

  const handleGenerate = () => handleTTSAction(1.0);
  const handlePlayAgain = () => {
    const audio = currentAudio();
    if (audio && !isPlayingAudio() && !isGeneratingTTS() && !isTranslationLoading()) {
      setIsPlayingAudio(true);
      audio.currentTime = 0;
      audio.play().catch(e => { setIsPlayingAudio(false); });
    } else if (!audio && !isGeneratingTTS() && !isTranslationLoading()) {
      handleGenerate();
    }
  };
  const handlePlaySpeed = (speed: number) => { setIsPopoverOpen(false); handleTTSAction(speed); };
  const handleRegenerate = () => { setIsPopoverOpen(false); handleTTSAction(1.0, true); };

  const showPronunciation = () => {
    const sourceLangVal = props.sourceLang ? props.sourceLang() : undefined;
    const pronunciationVal = props.pronunciation ? props.pronunciation() : undefined;
    return sourceLangVal?.toLowerCase().startsWith('zh') && pronunciationVal;
  };
  const showTTSFeature = () => {
      const supportedLangs = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko'];
      const sourceLangVal = props.sourceLang ? props.sourceLang() : undefined;
      return sourceLangVal && supportedLangs.some(lang => sourceLangVal!.toLowerCase().startsWith(lang));
  };

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      transition={TRANSITION_SETTINGS} ref={rootRef} class={`${WIDGET_BASE_CLASSES} min-h-[11rem]`} >
        <Dynamic component="style" id={HIGHLIGHT_STYLE_ID}>{HIGHLIGHT_CSS}</Dynamic>

        {/* Row 1: Translated Text */}
        <div class="min-h-[1.8em] text-base italic mb-1 flex items-center">
            <Show when={!props.isLoading() && props.translatedText && props.translatedText()} fallback={
                <span class="text-muted-foreground/80">{props.isLoading() ? "Translating..." : " "}</span> }
            >
                <span class="text-muted-foreground/90">{props.translatedText!()}</span>
            </Show>
        </div>

        {/* Row 2: Original Text (textToTranslate) - for highlighting */}
        <div class="text-2xl font-semibold text-foreground mb-1 min-h-[2em] flex items-center flex-wrap">
            <For each={wordMap()}>
                {(word: WordInfo) => (
                <span class="scarlett-word-span" 
                      classList={{ 'scarlett-word-highlight': currentHighlightIndex() === word.index }} 
                      data-word-index={word.index}>
                    {word.text.replace(/ /g, '\u00A0')} {/* Replace normal spaces with non-breaking spaces for display */}
                </span>
                )}
            </For>
        </div>

        {/* Row 3: Pronunciation */}
        <div class="min-h-[1.5em] text-base text-muted-foreground/80 mb-2 flex items-center">
            <Show when={showPronunciation() && !props.isLoading()}>{props.pronunciation? props.pronunciation() : ''}</Show>
        </div>

        {/* Row 4: TTS Controls - Hidden if main translation is loading */}
        <Show when={showTTSFeature() && !props.isLoading()}>
          <div class="mt-auto pt-1"> {/* mt-auto pushes TTS controls to the bottom */}
            <Show when={isGeneratingTTS()} fallback={
                <Show when={isAudioReady()} fallback={
                    <Button variant="outline" size="lg" onClick={handleGenerate} class="w-full" disabled={isTTSBusy() || props.isLoading()}>Generate Audio</Button> }
                >
                  <div class="flex items-center">
                      <Button variant="outline" size="lg" onClick={handlePlayAgain} disabled={isTTSBusy() || props.isLoading()} class="flex-grow rounded-r-none">
                          {isPlayingAudio() ? "Playing..." : "Play Again"}
                      </Button>
                      <div class="relative">
                        <Popover placement="top" gutter={4} open={isPopoverOpen()} onOpenChange={handlePopoverOpenChange}>
                            <Popover.Trigger aria-label="More options" disabled={isTTSBusy() || props.isLoading()} class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                            </Popover.Trigger>
                            <Show when={isPopoverOpen()}>
                                <Popover.Content class={POPOVER_CONTENT_CLASS} onOpenAutoFocus={(e) => e.preventDefault()}>
                                    <div class="flex flex-col">
                                        <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.85)} disabled={isTTSBusy() || props.isLoading()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.85x </Button>
                                        <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={() => handlePlaySpeed(0.70)} disabled={isTTSBusy() || props.isLoading()}> <Play weight="regular" class="mr-2 size-4" /> Play at 0.70x </Button>
                                        <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onPointerDown={handleRegenerate} disabled={isTTSBusy() || props.isLoading()}> <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate </Button>
                                    </div>
                                </Popover.Content>
                            </Show>
                        </Popover>
                      </div>
                  </div>
                </Show> }
            >
              <Button variant="outline" size="lg" disabled class="w-full"><Spinner class="mr-2" /> Generating...</Button>
            </Show>
          </div>
        </Show>
    </Motion.div>
  );
};

export default TranslatorWidget;