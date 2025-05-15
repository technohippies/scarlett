import { Component, createSignal, For, Show, createEffect, onCleanup, onMount, Accessor } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
// import { Textarea } from '../../components/ui/textarea'; // REMOVED Textarea for user text input
import { Spinner } from '../../components/ui/spinner';
import { Microphone, StopCircle, Play, SpeakerSimpleHigh, SpeakerSimpleSlash, X } from 'phosphor-solid'; // Icons
import { Header } from '../../components/layout/Header';
import type { AlignmentData, ChatMessage, RoleplayConversationViewProps } from './types'; // Import types from a separate file

// Re-usable alignment data structure (similar to TranslatorWidget)
export interface AlignmentData {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
}

export interface ChatMessage {
    id: string; // Unique ID for each message
    sender: 'user' | 'ai';
    text: string; // For user, this will be STT result. For AI, LLM response.
    alignment?: AlignmentData | null; // For AI messages, for word highlighting
    timestamp: Date;
    error?: boolean; // Flag if AI message generation resulted in an error
}

export interface RoleplayConversationViewProps {
    aiWelcomeMessage?: string; // Optional initial message from AI
    onSendMessage: (spokenText: string, chatHistory: ChatMessage[]) => Promise<{ aiResponse: string; alignment?: AlignmentData | null; error?: string } | null>;
    onEndRoleplay?: () => void;
    targetLanguage: string; // e.g., 'fr-FR', for context and potential TTS
    // userNativeLanguage: string; // For UI elements, if needed
    // onVadStatusChange?: (isActive: boolean) => void; // If VAD control is external
    onStartRecording: () => Promise<boolean>; // Returns success/permission
    onStopRecording: () => Promise<string | null>; // Returns STT result or null on error
    onPlayTTS: (text: string, lang: string, alignmentData?: AlignmentData | null) => Promise<void>; // Handles playback and highlighting
    onStopTTS: () => void;
    isGlobalVadActive?: Accessor<boolean>; // If VAD state is managed globally
    isTTSSpeaking?: Accessor<boolean>; // If TTS is currently active
    currentHighlightIndex?: Accessor<number | null>; // Added to sync highlighting
}

// Centered loading animation
const ThreeDotsLoadingCentered: Component = () => (
    <div class="absolute inset-0 flex items-center justify-center z-10">
        <div class="flex space-x-2 p-5 bg-muted/80 backdrop-blur-sm rounded-lg shadow-xl">
            <div class="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div class="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div class="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
        </div>
    </div>
);

// Similar to TranslatorWidget's highlight CSS
const HIGHLIGHT_STYLE_ID = "scarlett-roleplay-highlight-styles";
const HIGHLIGHT_CSS = `
  .scarlett-roleplay-word-span {
    background-color: transparent;
    border-radius: 3px;
    display: inline-block;
    transition: background-color 0.2s ease-out, color 0.2s ease-out;
    padding: 0.05em 0.1em;
    margin: 0 0.02em;
    line-height: 1.5;
  }
  .scarlett-roleplay-word-highlight {
    background-color: hsl(var(--primary) / 0.3); 
  }
`;

export const RoleplayConversationView: Component<RoleplayConversationViewProps> = (props) => {
    const [chatHistory, setChatHistory] = createSignal<ChatMessage[]>([]);
    const [currentAiMessageToDisplay, setCurrentAiMessageToDisplay] = createSignal<ChatMessage | null>(null);
    const [isListening, setIsListening] = createSignal(false);
    const [isProcessingUserSpeech, setIsProcessingUserSpeech] = createSignal(false);
    const [isWaitingForLLM, setIsWaitingForLLM] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    let chatAreaRef: HTMLDivElement | undefined;

    // Automatic listening based on TTS status
    createEffect(() => {
        const ttsSpeaking = props.isTTSSpeaking ? props.isTTSSpeaking() : false;
        if (!ttsSpeaking && !isProcessingUserSpeech() && !isWaitingForLLM() && !errorMessage()) {
            props.onStartRecording().then((success: boolean) => {
                if (success) setIsListening(true);
                else setErrorMessage("VAD failed to start automatically.");
            }).catch((err: any) => {
                console.error("Error auto-starting VAD:", err);
                setErrorMessage("Error with voice activity detection.");
            });
        } else if (ttsSpeaking || errorMessage()) {
            if (isListening()) {
                props.onStopRecording(); // Ensure recording stops if AI speaks or error occurs
                setIsListening(false);
            }
        }
    });

    // This function is intended to be triggered by the VAD system after speech is fully processed by STT.
    // The `props.onStopRecording` should ideally return the STT result or handle its own VAD stop.
    // For now, this is effectively the main logic loop per user utterance.
    const handleUserSpeechProcessed = async (spokenText: string | null) => {
        setIsListening(false); 
        setIsProcessingUserSpeech(false); 

        if (spokenText && spokenText.trim() !== "") {
            const newUserMessage: ChatMessage = {
                id: `user-${Date.now()}`,
                sender: 'user',
                text: spokenText,
                timestamp: new Date(),
            };
            const currentHistory = [...chatHistory(), newUserMessage];
            setChatHistory(currentHistory);
            
            setIsWaitingForLLM(true);
            setCurrentAiMessageToDisplay({
                id: 'ai-waiting-llm',
                sender: 'ai',
                text: "", 
                timestamp: new Date(),
            });

            try {
                const response = await props.onSendMessage(spokenText, currentHistory);
                setIsWaitingForLLM(false);

                if (response) {
                    const newAiMessage: ChatMessage = {
                        id: `ai-response-${Date.now()}`,
                        sender: 'ai',
                        text: response.aiResponse,
                        alignment: response.alignment,
                        timestamp: new Date(),
                        error: !!response.error
                    };
                    setChatHistory(prev => [...prev, newAiMessage]);
                    setCurrentAiMessageToDisplay(newAiMessage);

                    if (response.error) {
                        setErrorMessage(response.error);
                    } else if (props.onPlayTTS) {
                        props.onPlayTTS(response.aiResponse, props.targetLanguage, response.alignment);
                    }
                } else {
                    throw new Error("No response from AI.");
                }
            } catch (error: any) {
                console.error("Error during LLM interaction flow:", error);
                const llmErrorMsg = error.message || "An error occurred with the AI.";
                setErrorMessage(llmErrorMsg);
                setCurrentAiMessageToDisplay({ id: 'ai-llm-error', sender: 'ai', text: llmErrorMsg, timestamp: new Date(), error: true });
                setIsWaitingForLLM(false);
            }
        } else if (spokenText === "") {
             setCurrentAiMessageToDisplay({
                id: 'ai-no-speech-detected',
                sender: 'ai',
                text: "Didn't catch any speech.",
                timestamp: new Date(),
            });
        } else {
            const sttErrorMsg = "Sorry, I couldn't understand that.";
            setErrorMessage(sttErrorMsg);
            setCurrentAiMessageToDisplay({ id: 'ai-stt-error', sender: 'ai', text: sttErrorMsg, timestamp: new Date(), error: true });
        }
    };

    // onMount: Initialize and play welcome message if any
    onMount(() => {
        // Expose handleUserSpeechProcessed globally for VAD to call (TEMPORARY for external trigger)
        (window as any).triggerUserSpeechProcessed = handleUserSpeechProcessed; 

        if (!document.getElementById(HIGHLIGHT_STYLE_ID)) {
            const styleElement = document.createElement('style');
            styleElement.id = HIGHLIGHT_STYLE_ID;
            styleElement.textContent = HIGHLIGHT_CSS;
            document.head.appendChild(styleElement);
        }

        if (props.aiWelcomeMessage) {
            const welcomeMsg: ChatMessage = {
                id: `ai-initial-welcome-${Date.now()}`,
                sender: 'ai',
                text: props.aiWelcomeMessage,
                timestamp: new Date(),
                alignment: null, 
            };
            setChatHistory([welcomeMsg]);
            setCurrentAiMessageToDisplay(welcomeMsg);
            if (props.onPlayTTS) {
                props.onPlayTTS(props.aiWelcomeMessage, props.targetLanguage, null);
            }
        } else {
            props.onStartRecording().then((success: boolean) => {
                if (success) setIsListening(true);
                else setErrorMessage("VAD failed to start.");
                setCurrentAiMessageToDisplay({
                    id: 'ai-ready-to-listen',
                    sender: 'ai',
                    text: isListening() ? "Listening..." : "Ready. Speak when you are.",
                    timestamp: new Date(),
                });
            }).catch((err: any) => {
                 console.error("Error starting VAD on mount:", err);
                 setErrorMessage("Error with voice activity detection.");
            });
        }
    });

    createEffect(() => {
        // Scroll to bottom when new messages are added
        if (chatAreaRef) {
            chatAreaRef.scrollTop = chatAreaRef.scrollHeight;
        }
    });

    const handleMicClick = async () => {
        if (props.isTTSSpeaking && props.isTTSSpeaking()) {
            props.onStopTTS?.(); // Stop TTS if it's speaking
            // Potentially wait a brief moment for TTS to fully stop before starting recording
            await new Promise(r => setTimeout(r, 150)); 
        }

        if (isListening()) {
            setIsListening(false);
            setIsProcessingUserSpeech(true);
            setErrorMessage(null);
            setCurrentAiMessageToDisplay({
                id: 'ai-processing-stt',
                sender: 'ai',
                text: "Processing your speech...",
                timestamp: new Date(),
            });

            try {
                const spokenText = await props.onStopRecording();
                setIsProcessingUserSpeech(false);

                if (spokenText && spokenText.trim() !== "") {
                    const newUserMessage: ChatMessage = {
                        id: `user-${Date.now()}`,
                        sender: 'user',
                        text: spokenText,
                        timestamp: new Date(),
                    };
                    const currentHistory = [...chatHistory(), newUserMessage];
                    setChatHistory(currentHistory);
                    
                    setIsWaitingForLLM(true);
                    setCurrentAiMessageToDisplay({
                        id: 'ai-waiting-llm',
                        sender: 'ai',
                        text: "Thinking...", // Placeholder while LLM responds
                        timestamp: new Date(),
                    });
                    const response = await props.onSendMessage(spokenText, currentHistory);
                    setIsWaitingForLLM(false);

                    if (response) {
                        const newAiMessage: ChatMessage = {
                            id: `ai-response-${Date.now()}`,
                            sender: 'ai',
                            text: response.aiResponse,
                            alignment: response.alignment,
                            timestamp: new Date(),
                            error: !!response.error
                        };
                        setChatHistory(prev => [...prev, newAiMessage]);
                        setCurrentAiMessageToDisplay(newAiMessage);

                        if (response.error) {
                            setErrorMessage(response.error);
                        } else if (props.onPlayTTS) {
                            // Play AI response with TTS
                            props.onPlayTTS(response.aiResponse, props.targetLanguage, response.alignment);
                        }
                    } else {
                        throw new Error("No response from AI.");
                    }
                } else if (spokenText === "") {
                    setCurrentAiMessageToDisplay({
                        id: 'ai-no-speech',
                        sender: 'ai',
                        text: "I didn't catch that. Please try speaking again.",
                        timestamp: new Date(),
                    });
                } else {
                    const sttErrorMsg = "Sorry, I couldn't understand that. Please try again.";
                    setErrorMessage(sttErrorMsg);
                    setCurrentAiMessageToDisplay({ id: 'ai-stt-error', sender: 'ai', text: sttErrorMsg, timestamp: new Date(), error: true });
                }
            } catch (error: any) {
                console.error("Error during voice interaction flow:", error);
                const processingErrorMsg = error.message || "An error occurred processing your speech.";
                setErrorMessage(processingErrorMsg);
                setCurrentAiMessageToDisplay({ id: 'ai-flow-error', sender: 'ai', text: processingErrorMsg, timestamp: new Date(), error: true });
                setIsProcessingUserSpeech(false);
                setIsWaitingForLLM(false);
            }
        } else {
            // Start listening
            setErrorMessage(null);
            setCurrentAiMessageToDisplay({
                id: 'ai-listening',
                sender: 'ai',
                text: "Listening...",
                timestamp: new Date(),
            });
            try {
                const success = await props.onStartRecording();
                if (success) {
                    setIsListening(true);
                } else {
                    const micPermError = "Could not start recording. Check microphone permissions.";
                    setErrorMessage(micPermError);
                    setCurrentAiMessageToDisplay({ id: 'ai-mic-denied', sender: 'ai', text: micPermError, timestamp: new Date(), error: true });
                }
            } catch (error: any) {
                const micStartError = "Error starting recording: " + error.message;
                setErrorMessage(micStartError);
                setCurrentAiMessageToDisplay({ id: 'ai-mic-error', sender: 'ai', text: micStartError, timestamp: new Date(), error: true });
            }
        }
    };

    // For rendering AI messages with potential highlighting
    const AiResponseDisplay: Component = () => {
        const message = currentAiMessageToDisplay();
        if (!message || (!message.text && isWaitingForLLM())) return null;
        if (!message.text) return null;

        const wordMap = () => {
            if (!message.alignment?.characters || message.alignment.characters.length === 0) {
                return [{ text: message.text as string, index: 0, isSpokenSegment: false }]; 
            }
            return message.alignment.characters.map((char: string, idx: number) => ({
                text: char,
                index: idx,
                isSpokenSegment: true 
            }));
        };

        // Animate presence of the container, and then animate text content change (or use key for re-render animation)
        return (
            <Motion.div 
                key={message.id} // Use message ID to ensure re-animation on new message
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.35, easing: "ease-out" }}
                class="text-center text-2xl md:text-3xl font-medium leading-relaxed p-4 flex-grow flex items-center justify-center w-full max-w-prose mx-auto"
            >
                <div> {/* Inner div for text content to prevent flexbox from shrinking it weirdly */}
                    <Show when={message.text}>
                        <For each={wordMap()}>{(word, _index) => (
                            <span
                                class="scarlett-roleplay-word-span"
                                classList={{ 'scarlett-roleplay-word-highlight': props.currentHighlightIndex && props.currentHighlightIndex() === word.index && word.isSpokenSegment }}
                                data-word-index={word.index}
                            >
                                {word.text.replace(/\n/g, '<br />')}
                            </span>
                        )}
                        </For>
                    </Show>
                </div>
            </Motion.div>
        );
    };

    const getMicButtonIcon = () => {
        if (isListening()) return <StopCircle size={36} weight="fill" class="text-red-500" />;
        if (isProcessingUserSpeech() || isWaitingForLLM()) return <Spinner class="w-9 h-9 text-primary" />;
        return <Microphone size={36} weight="regular" class="text-primary" />;
    };
    
    const isMicButtonDisabled = () => {
      if (props.isTTSSpeaking && props.isTTSSpeaking() && !isListening()) return true; 
      if ((isProcessingUserSpeech() || isWaitingForLLM()) && !isListening()) return true;
      return false; 
    };

    // Visual status indicator (could be improved)
    const StatusIndicator: Component = () => {
        let statusText = "";
        if (errorMessage()) statusText = "Error"; // Prioritize error
        else if (props.isTTSSpeaking && props.isTTSSpeaking()) statusText = "AI Speaking";
        else if (isListening()) statusText = "Listening";
        else if (isProcessingUserSpeech()) statusText = "Processing Speech";
        else if (isWaitingForLLM()) statusText = "AI Thinking";
        else if (currentAiMessageToDisplay()?.text === "Didn't catch any speech.") statusText = "No speech detected";
        else statusText = "Ready"; // Default idle state

        return (
            <Show when={statusText !== "Ready" || errorMessage()}> {/* Show indicator unless truly idle and no error */}
                <div class={`fixed bottom-4 right-4 text-xs p-2 rounded shadow-md transition-all duration-300 ease-in-out 
                    ${errorMessage() ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}
                    ${(isListening() || (props.isTTSSpeaking && props.isTTSSpeaking())) ? 'opacity-90' : 'opacity-70'}
                `}>
                    {statusText}
                </div>
            </Show>
        );
    };

    return (
        <div class="h-full w-full flex flex-col bg-gradient-to-br from-background to-muted/20 text-foreground font-sans select-none overflow-hidden">
            <Header 
                onBackClick={() => { 
                    props.onStopTTS?.(); 
                    if (isListening()) props.onStopRecording?.(); // Also stop VAD if active
                    props.onEndRoleplay(); 
                }} 
                hideBackButton={false} // Header itself is fine, its internal button is fine for navigation
            /> 
            
            <main class="flex-grow flex flex-col items-center justify-center relative p-4">
                <AiResponseDisplay />

                <Show when={(isProcessingUserSpeech() || isWaitingForLLM()) && (!currentAiMessageToDisplay() || !currentAiMessageToDisplay()?.text)}>
                    <div class="absolute inset-0 flex items-center justify-center z-0"> {/* Ensure spinner is behind text if text appears */}
                        <Spinner class="w-12 h-12 text-primary" />
                    </div>
                </Show>
                
                <Show when={errorMessage() && !(isProcessingUserSpeech() || isWaitingForLLM())}>
                    <Motion.div 
                        initial={{opacity: 0, y:20}} animate={{opacity:1, y:0}} transition={{duration: 0.3}}
                        class="absolute bottom-12 left-1/2 -translate-x-1/2 text-destructive-foreground text-sm p-3 bg-destructive/80 backdrop-blur-sm rounded-lg shadow-lg w-auto max-w-[90%] text-center z-20"
                    >
                        {errorMessage()}
                    </Motion.div>
                </Show>
            </main>
            
            <StatusIndicator />
            {/* Footer and main microphone button are intentionally removed */}
        </div>
    );
}; 