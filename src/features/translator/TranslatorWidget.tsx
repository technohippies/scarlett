import { Component, Show, createSignal } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Popover } from '@kobalte/core/popover';
import { Play, ArrowClockwise } from 'phosphor-solid';
import 'virtual:uno.css'; // Ensure UnoCSS is processed

// --- Props Interface ---
export interface TranslatorWidgetProps {
  hoveredWord: string;      // The translated word to display prominently
  originalWord: string;     // The original word for reference
  pronunciation?: string;   // Optional pronunciation (e.g., Pinyin)
  sourceLang: string;       // Source language code (e.g., 'en')
  targetLang: string;       // Target language code (e.g., 'zh-CN')
  onTTSRequest: (text: string, lang: string, speed: number) => void; // Add speed param
  // Optional: Add an onClose callback if needed for manual closing
  // onClose?: () => void;
}

// --- Constants ---
const WIDGET_BASE_CLASSES = "fixed bottom-0 left-4 z-[2147483647] font-sans bg-background text-foreground rounded-t-lg shadow-lg p-4 w-96 text-base flex flex-col gap-2";
const TRANSITION_SETTINGS = { duration: 0.3, easing: "ease-out" } as const;
const POPOVER_CONTENT_CLASS = "z-[2147483647] w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95";
const POPOVER_ITEM_CLASS_BASE = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
// Refined item class for left alignment
const POPOVER_ITEM_CLASS = `${POPOVER_ITEM_CLASS_BASE} justify-start`;

// --- Component ---
const TranslatorWidget: Component<TranslatorWidgetProps> = (props) => {
  // State Signals
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [isAudioReady, setIsAudioReady] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);

  const showPronunciation = () => {
    // Example: Show Pinyin for Chinese variants
    return props.targetLang.toLowerCase().startsWith('zh') && props.pronunciation;
  };

  const showTTSButton = () => {
      // Example: Enable TTS for specific languages
      const supportedLangs = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko']; // Add more as needed
      return supportedLangs.some(lang => props.targetLang.toLowerCase().startsWith(lang));
  };

  const handleGenerate = () => {
    if (isGenerating() || isPlaying()) return;
    console.log('[Widget] Requesting Audio at 1x');
    setIsGenerating(true);
    setIsAudioReady(false);
    setIsPlaying(false);
    props.onTTSRequest(props.hoveredWord, props.targetLang, 1.0);

    // Simulation Block
    setTimeout(() => {
      console.log('[Widget] Simulating Audio Ready (1x)');
      setIsGenerating(false);
      setIsAudioReady(true);
      setIsPlaying(true); // Auto-play
      setTimeout(() => {
        console.log('[Widget] Simulating Playback End');
        setIsPlaying(false);
      }, 1000);
    }, 1500);
    // End Simulation Block
  };

  const handlePlayAgain = (e?: MouseEvent) => {
    // Prevent popover from closing immediately if triggered via button inside popover trigger
    // e?.stopPropagation(); 
    if (isPlaying()) return;
    console.log(`[Widget] Playing Again at 1x`);
    setIsPlaying(true);
    // TODO: Play 1x audio
    setTimeout(() => {
      console.log('[Widget] Simulating Playback End (1x)');
      setIsPlaying(false);
    }, 1000);
  };

  const handlePlaySpeed = (speed: number) => {
      if (isPlaying()) return;
      console.log(`[Widget] Playing at ${speed}x`);
      setIsPlaying(true);
      // TODO: Play audio at specified speed
      setTimeout(() => {
          console.log(`[Widget] Simulating Playback End (${speed}x)`);
          setIsPlaying(false);
      }, 1000 / speed);
  };

  const handleRegenerate = () => {
      console.log('[Widget] Regenerating Audio');
      handleGenerate(); // Just re-trigger the generation process
  };

  const allDisabled = () => isPlaying() || isGenerating(); // Helper for disabling

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }} // Start transparent and slightly down
      animate={{ opacity: 1, y: 0 }}   // Animate to opaque and original position
      exit={{ opacity: 0, y: 20 }}     // Animate out similarly
      transition={TRANSITION_SETTINGS}
      class={WIDGET_BASE_CLASSES}
      // Add role for accessibility if appropriate, e.g., role="dialog" aria-modal="true"
      // Consider adding aria-labelledby referencing the main translated word
    >
        {/* Row 1: Pronunciation (Defaults to left-aligned) */}
        <Show when={showPronunciation()}>
            <div class="text-base text-muted-foreground/90">
            {props.pronunciation}
            </div>
        </Show>

        {/* Row 2: Translated Word (Removed adjacent icon button) */}
        <div class="flex justify-between items-center gap-2">
            <span class="text-2xl font-semibold text-foreground">
                {props.hoveredWord}
            </span>
        </div>

        {/* Row 3: Original Word (Corrected: text-md, no quotes) */}
        <div class="text-neutral-400 text-md font-medium italic">
            {props.originalWord}
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
                      
                      {/* Popover Trigger Button */}
                      <Popover placement="top" gutter={4}>
                          <Popover.Trigger
                              aria-label="More options"
                              disabled={allDisabled()}
                              class="inline-flex items-center justify-center whitespace-nowrap rounded-l-none rounded-r-md border-l-0 w-11 h-11 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="m6 9 6 6 6-6" /></svg>
                          </Popover.Trigger>
                          <Popover.Portal>
                              <Popover.Content class={POPOVER_CONTENT_CLASS}>
                                  <div class="flex flex-col">
                                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onClick={() => handlePlaySpeed(0.75)} disabled={allDisabled()}>
                                          <Play weight="regular" class="mr-2 size-4" /> Play at 0.75x
                                      </Button>
                                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onClick={() => handlePlaySpeed(0.50)} disabled={allDisabled()}>
                                          <Play weight="regular" class="mr-2 size-4" /> Play at 0.5x
                                      </Button>
                                      <Button variant="ghost" size="sm" class={POPOVER_ITEM_CLASS} onClick={handleRegenerate} disabled={allDisabled()}>
                                          <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate Audio
                                      </Button>
                                  </div>
                              </Popover.Content>
                          </Popover.Portal>
                      </Popover>
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