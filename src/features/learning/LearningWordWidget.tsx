import { Component, Show, createSignal, onCleanup } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Play } from 'phosphor-solid';
import 'virtual:uno.css';

// --- Props Interface ---
export interface LearningWordWidgetProps {
  originalWord: string;
  translatedWord: string;
  sourceLang: string; // Still needed for context, just not displayed inline
  targetLang: string; // Still needed for context and TTS
  onTTSRequest: (text: string, lang: string) => Promise<{ audioDataUrl?: string; error?: string }>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

// --- Constants ---
// Use same base classes as TranslatorWidget for consistency, positioning handled by caller
const WIDGET_BASE_CLASSES = "font-sans bg-background text-foreground rounded-lg shadow-lg p-4 w-auto max-w-sm h-auto max-h-fit text-base flex flex-col gap-1";
const TRANSITION_SETTINGS = { duration: 0.2, easing: "ease-out" } as const;

// --- Component ---
const LearningWordWidget: Component<LearningWordWidgetProps> = (props) => {
  const [isGeneratingTTS, setIsGeneratingTTS] = createSignal(false);
  const [isPlayingAudio, setIsPlayingAudio] = createSignal(false);
  const [currentAudio, setCurrentAudio] = createSignal<HTMLAudioElement | null>(null);

  const isTTSBusy = () => isGeneratingTTS() || isPlayingAudio();

  const showTTSFeature = () => {
      const supportedLangs = ['zh', 'en', 'es', 'fr', 'de', 'ja', 'ko'];
      const targetLangVal = props.targetLang;
      return targetLangVal && supportedLangs.some(lang => targetLangVal.toLowerCase().startsWith(lang));
  };

  const handlePlayAudio = async () => {
    if (isTTSBusy()) return;

    const audio = currentAudio();
    if (audio) {
        // Play existing audio again
        setIsPlayingAudio(true);
        audio.currentTime = 0;
        audio.play().catch(_ => { setIsPlayingAudio(false); });
    } else {
        // Generate new audio
        setIsGeneratingTTS(true);
        setIsPlayingAudio(false);
        setCurrentAudio(null);
        console.log(`[LearningWidget TTS] Requesting: "${props.translatedWord}" lang: ${props.targetLang}`);
        try {
            const result = await props.onTTSRequest(props.translatedWord, props.targetLang);
             console.log("[LearningWidget TTS] Received result:", result ? 'has result' : 'no result');
            if (result && result.audioDataUrl) {
                const newAudio = new Audio(result.audioDataUrl);
                setCurrentAudio(newAudio);
                newAudio.oncanplaythrough = () => {
                    console.log("[LearningWidget TTS] Audio ready.");
                    setIsGeneratingTTS(false);
                    setIsPlayingAudio(true);
                    newAudio.play().catch(_ => {
                        console.error('[LearningWidget TTS] Error playing audio:', _);
                        setIsPlayingAudio(false); setCurrentAudio(null); setIsGeneratingTTS(false);
                    });
                };
                newAudio.onended = () => {
                    console.log("[LearningWidget TTS] Audio ended.");
                    setIsPlayingAudio(false);
                    // Optionally reset currentAudio? setCurrentAudio(null);
                };
                newAudio.onerror = (e) => {
                    console.error('[LearningWidget TTS] Error with audio object:', e);
                    setIsPlayingAudio(false); setIsGeneratingTTS(false); setCurrentAudio(null);
                };
            } else {
                console.error('[LearningWidget TTS] TTS request failed or no audioDataUrl:', result?.error);
                setIsGeneratingTTS(false);
            }
        } catch (error) {
            console.error('[LearningWidget TTS] Error in handlePlayAudio:', error);
            setIsGeneratingTTS(false);
        }
    }
  };

  // Cleanup audio resources
  onCleanup(() => {
      const audio = currentAudio();
      if (audio) {
          // Nullify event handlers to prevent them from firing during/after cleanup
          audio.oncanplaythrough = null;
          audio.onended = null;
          audio.onerror = null;
          audio.ontimeupdate = null; // If you were using this for LearningWordWidget too

          audio.pause();
          if (audio.src) { // Check if src is already set before trying to clear it
            audio.src = ''; // Release resource
          }
          setCurrentAudio(null);
      }
  });

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={TRANSITION_SETTINGS}
      class={WIDGET_BASE_CLASSES} // Use consistent base classes
      onMouseEnter={props.onMouseEnter} 
      onMouseLeave={props.onMouseLeave}
    >
        {/* Row 1: Translated Word (Styled like translation in TranslatorWidget) */}
        <div class="min-h-[1.8em] text-base italic mb-1 flex items-center">
             <span class="text-muted-foreground/90">{props.translatedWord}</span>
        </div>

        {/* Row 2: Original Word (Styled like original in TranslatorWidget) */}
        <div class="text-2xl font-semibold text-foreground mb-1 min-h-[2em] flex items-center">
            {props.originalWord}
        </div>

        {/* Row 3: Empty spacer like pronunciation row (optional, for consistent height) */}
        <div class="min-h-[1.5em] text-base mb-2"></div> 

        {/* Row 4: TTS Controls (No border-t) */}
        <Show when={showTTSFeature()}>
          <div class="mt-auto pt-1"> {/* Container for button */}
            <Button
              variant="outline"
              size="lg" // Match TranslatorWidget button size
              onClick={handlePlayAudio}
              disabled={isTTSBusy()}
              class="w-full flex items-center justify-center" // Ensure full width and center content
            >
              <Show when={isGeneratingTTS()} fallback={
                <Show when={isPlayingAudio()} fallback={<Play weight="regular" class="mr-2 size-4" />}> {/* Match icon size/margin */}
                   <Spinner class="mr-2 size-4" /> {/* Match spinner size/margin */}
                </Show>
              }>
                <Spinner class="mr-2 size-4" /> {/* Match spinner size/margin */}
              </Show>
              {/* Combined text display - ensure text styles match if needed */}
              <span>{ isGeneratingTTS() ? 'Generating...' : (isPlayingAudio() ? 'Playing...' : 'Generate Audio') }</span>
            </Button>
          </div>
        </Show>
    </Motion.div>
  );
};

export default LearningWordWidget;
