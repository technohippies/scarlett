import { RoleplayConversationView, RoleplayConversationViewProps, ChatMessage, AlignmentData } from '../../../src/features/roleplay/RoleplayConversationView';
import type { Meta, StoryObj } from '@storybook/html';
import { createSignal, Component, Accessor } from 'solid-js';
import { action } from '@storybook/addon-actions';

const meta: Meta<RoleplayConversationViewProps> = {
  title: 'Features/Roleplay/RoleplayConversationView',
  component: RoleplayConversationView as Component<RoleplayConversationViewProps>,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    aiWelcomeMessage: { control: 'text' },
    onSendMessage: { action: 'onSendMessage' },
    onEndRoleplay: { action: 'onEndRoleplay' },
    targetLanguage: { control: 'text' },
    onStartRecording: { action: 'onStartRecording' },
    onStopRecording: { action: 'onStopRecording' },
    onPlayTTS: { action: 'onPlayTTS' },
    onStopTTS: { action: 'onStopTTS' },
    isTTSSpeaking: { control: 'boolean' }, // Control via Storybook args
    currentHighlightIndex: { control: 'number'}, // Control via Storybook args
  },
};

export default meta;
type Story = StoryObj<RoleplayConversationViewProps>;

// --- Mock Implementations for Story --- 

const [isRecordingStory, setIsRecordingStory] = createSignal(false);
const [isTTSSpeakingStory, setIsTTSSpeakingStory] = createSignal(false);
const [currentHighlightIndexStory, setCurrentHighlightIndexStory] = createSignal<number | null>(null);
let ttsInterval: any;

const mockOnStartRecording = async () => {
  console.log("Story: onStartRecording called");
  setIsRecordingStory(true);
  return true;
};

const mockOnStopRecording = async () => {
  console.log("Story: onStopRecording called");
  setIsRecordingStory(false);
  // Simulate STT processing delay and return a mock sentence
  await new Promise(resolve => setTimeout(resolve, 1000));
  const mockSpokenText = "This is a simulated voice input from the user talking about their day.";
  console.log("Story: STT result - ", mockSpokenText);
  return mockSpokenText;
};

const mockOnPlayTTS = async (text: string, lang: string, alignment?: AlignmentData | null) => {
  console.log(`Story: onPlayTTS called with text: "${text.substring(0,30)}...", lang: ${lang}`);
  setIsTTSSpeakingStory(true);
  setCurrentHighlightIndexStory(null);
  if (ttsInterval) clearInterval(ttsInterval);

  let effectiveAlignment = alignment;
  if (!effectiveAlignment && text) {
    // If no alignment is provided, create a simple one based on characters for demonstration
    const chars = Array.from(text);
    effectiveAlignment = {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1), // Simple timing
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.1),
    };
    console.log("Story: mockOnPlayTTS generated simple alignment for highlighting.");
  }

  if (effectiveAlignment && effectiveAlignment.characters && effectiveAlignment.character_start_times_seconds) {
    // Simulate highlighting based on alignment data
    let charIndex = 0;
    const playAligned = () => {
      if (charIndex < effectiveAlignment!.characters.length) {
        setCurrentHighlightIndexStory(charIndex);
        const charStartTime = effectiveAlignment!.character_start_times_seconds[charIndex];
        const nextCharStartTime = (charIndex + 1 < effectiveAlignment!.characters.length) ? effectiveAlignment!.character_start_times_seconds[charIndex + 1] : charStartTime + 0.1; // Default duration if last char
        const duration = (nextCharStartTime - charStartTime) * 1000; // in ms
        
        charIndex++;
        ttsInterval = setTimeout(playAligned, Math.max(50, duration)); // Ensure minimum 50ms per char for visibility
      } else {
        console.log("Story: TTS finished playing (simulated)");
        setIsTTSSpeakingStory(false);
        setCurrentHighlightIndexStory(null);
        clearInterval(ttsInterval);
      }
    };
    playAligned();
  } else {
    // No alignment, just simulate speaking duration
    ttsInterval = setTimeout(() => {
      console.log("Story: TTS finished playing (simulated, no alignment / no text)");
      setIsTTSSpeakingStory(false);
      setCurrentHighlightIndexStory(null);
    }, text ? text.length * 50 : 500); // Rough estimate, ensure it runs if text is empty
  }
  // In a real scenario, this would involve an actual audio playback
};

const mockOnStopTTS = () => {
  console.log("Story: onStopTTS called");
  if (ttsInterval) clearInterval(ttsInterval);
  setIsTTSSpeakingStory(false);
  setCurrentHighlightIndexStory(null);
};

const mockLLMResponder = async (spokenText: string, _chatHistory: ChatMessage[]) => {
  console.log("Story (LLM Responder): Received spoken text - ", spokenText);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate LLM processing time
  
  if (spokenText.toLowerCase().includes("error test please")) {
    return {
        aiResponse: "Simulating an error response from the LLM as requested.",
        alignment: null,
        error: "Simulated LLM Error: Could not process the request."
    }
  }

  const aiResponseText = `Okay, you mentioned: "${spokenText.substring(0, 50)}...". That's interesting! Let's talk more about that. How does that make you feel? I am an AI.`;
  // Simulate alignment data for the AI response
  const chars = Array.from(aiResponseText);
  const alignment: AlignmentData = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.08), // Simulate start times
    character_end_times_seconds: chars.map((_, i) => i * 0.08 + 0.08), // Simulate end times
  };
  return {
    aiResponse: aiResponseText,
    alignment: alignment,
    error: undefined
  };
};

// --- Stories --- 

export const DefaultVoiceInteraction: Story = {
  args: {
    aiWelcomeMessage: "Hello! Click the microphone to start speaking. I will try to respond to what you say.",
    onSendMessage: mockLLMResponder,
    onEndRoleplay: () => console.log("Story: onEndRoleplay triggered"),
    targetLanguage: 'en-US',
    onStartRecording: mockOnStartRecording,
    onStopRecording: mockOnStopRecording,
    onPlayTTS: mockOnPlayTTS,
    onStopTTS: mockOnStopTTS,
    // These are controlled by signals within the story for demonstration
    // In a real app, these would be driven by the actual VAD/TTS services
    isTTSSpeaking: () => isTTSSpeakingStory(), 
    currentHighlightIndex: () => currentHighlightIndexStory(),
  },
};

export const AiErrorResponse: Story = {
    args: {
      aiWelcomeMessage: "Let's test how I handle AI errors. Try saying 'error test please'.",
      onSendMessage: mockLLMResponder, // This mock will return an error object
      onEndRoleplay: () => console.log("Story: onEndRoleplay triggered"),
      targetLanguage: 'en-US',
      onStartRecording: mockOnStartRecording,
      onStopRecording: mockOnStopRecording,
      onPlayTTS: mockOnPlayTTS,
      onStopTTS: mockOnStopTTS,
      isTTSSpeaking: () => isTTSSpeakingStory(), 
      currentHighlightIndex: () => currentHighlightIndexStory(),
    },
  };

export const AiShowsWelcomeMessageAndHighlights: Story = {
  args: {
    aiWelcomeMessage: "Hello there! I am your AI assistant for this roleplay scenario. Let\'s begin when you\'re ready.",
    onSendMessage: mockLLMResponder, // Use shared mock
    onEndRoleplay: () => action("onEndRoleplayTriggered")(), // Keep this simple action call if preferred, or make a mock
    targetLanguage: 'en-US',
    onStartRecording: mockOnStartRecording, // Use shared mock
    onStopRecording: mockOnStopRecording, // Use shared mock
    onPlayTTS: mockOnPlayTTS, // Uses the enhanced mock
    onStopTTS: mockOnStopTTS, // Use shared mock
    isTTSSpeaking: () => isTTSSpeakingStory(),
    currentHighlightIndex: () => currentHighlightIndexStory(),
    scenario: { 
      id: 'welcome-scenario', 
      title: 'Welcome Scenario', 
      description: 'A scenario to test initial AI message display and highlighting.', 
      character: 'Helpful AI', 
      setting: 'Virtual Greeting Room' 
    },
    onNavigateBack: () => action('onNavigateBackTriggered')(), // Keep simple action call
  },
  // The component should automatically play TTS for the welcome message on mount.
  // No play function needed here for that part.
}; 