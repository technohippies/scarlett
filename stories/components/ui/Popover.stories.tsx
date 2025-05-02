import { Popover } from '@kobalte/core/popover';
import { Button } from '../../../src/components/ui/button';
import { Play, ArrowClockwise } from 'phosphor-solid';
import { createSignal } from 'solid-js'; // Import createSignal
import 'virtual:uno.css';

// --- Constants for Styling (copied from TranslatorWidget for consistency) ---
const POPOVER_CONTENT_CLASS = "z-[2147483647] w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in data-[expanded]:fade-in-0 data-[expanded]:zoom-in-95";
// Base item class - we will likely adjust this
const POPOVER_ITEM_CLASS = "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

export default {
  title: 'Components/UI/Popover', // Categorize under UI
  component: Popover,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Define argTypes if needed for Popover props
  },
};

// Story to test the action menu layout and interaction
export const ActionMenu = {
  render: () => {
    // State for simulation within the story
    const [isPlaying, setIsPlaying] = createSignal(false);
    const [isGeneratingSlow, setIsGeneratingSlow] = createSignal(false);

    // Simulation Handlers
    const handlePlayAgainSim = () => {
        if (isPlaying() || isGeneratingSlow()) return;
        console.log('[Story Sim] Playing 1x');
        setIsPlaying(true);
        setTimeout(() => { setIsPlaying(false); console.log('[Story Sim] Playback 1x End'); }, 1000);
    };
    const handlePlaySpeedSim = (speed: number) => {
        if (isPlaying() || isGeneratingSlow()) return;
        console.log(`[Story Sim] Playing ${speed}x`);
        setIsPlaying(true);
        setTimeout(() => { setIsPlaying(false); console.log(`[Story Sim] Playback ${speed}x End`); }, 1000 / speed);
    };
    const handleRegenerateSim = () => {
        if (isPlaying() || isGeneratingSlow()) return;
        console.log('[Story Sim] Regenerating...');
        setIsGeneratingSlow(true);
        setTimeout(() => { setIsGeneratingSlow(false); console.log('[Story Sim] Regenerate End'); }, 1500);
    };

    const REFINED_ITEM_CLASS = `${POPOVER_ITEM_CLASS} justify-start`;
    const allDisabled = () => isPlaying() || isGeneratingSlow(); // Helper for disabling

    return (
        <div class="flex items-center"> 
            {/* Main Action Button (No right rounding) */}
            <Button 
                variant="outline" 
                size="lg" 
                class="flex-grow rounded-r-none"
                onClick={handlePlayAgainSim}
                disabled={allDisabled()}
            >
                {isPlaying() ? "Playing..." : "Play Again"}
            </Button>

            {/* Popover Section */}
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
                        <Button variant="ghost" size="sm" class={REFINED_ITEM_CLASS} onClick={() => handlePlaySpeedSim(0.75)} disabled={allDisabled()}>
                            <Play weight="regular" class="mr-2 size-4" /> Play at 0.75x
                        </Button>
                        <Button variant="ghost" size="sm" class={REFINED_ITEM_CLASS} onClick={() => handlePlaySpeedSim(0.50)} disabled={allDisabled()}>
                            <Play weight="regular" class="mr-2 size-4" /> Play at 0.5x
                        </Button>
                        <Button variant="ghost" size="sm" class={REFINED_ITEM_CLASS} onClick={handleRegenerateSim} disabled={allDisabled()}>
                            <ArrowClockwise weight="regular" class="mr-2 size-4" /> Regenerate Audio
                        </Button>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover>
        </div>
    );
  },
  args: {},
}; 