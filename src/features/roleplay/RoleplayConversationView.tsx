import { Component, createSignal, For, Show, createEffect, onCleanup, onMount, Accessor } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Button } from '../../components/ui/button';
// import { Textarea } from '../../components/ui/textarea'; // REMOVED Textarea for user text input
import { Spinner } from '../../components/ui/spinner';
import { Microphone, StopCircle, Play, SpeakerSimpleHigh, SpeakerSimpleSlash, X } from 'phosphor-solid'; // Icons
import { Header } from '../../components/layout/Header';
// @ts-ignore: suppress missing types import
import type { AlignmentData, ChatMessage, RoleplayConversationViewProps } from './types'; // Import types from a separate file
import type { ScenarioOption } from './RoleplaySelectionView'; // Import ScenarioOption

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
    aiWelcomeMessage?: string;
    onSendMessage: (spokenText: string, chatHistory: ChatMessage[]) => Promise<{ aiResponse: string; alignment?: AlignmentData | null; error?: string } | null>;
    onEndRoleplay?: () => void;
    targetLanguage: string;
    onStartRecording: () => Promise<boolean>;
    onStopRecording: () => Promise<string | null>;
    onPlayTTS: (text: string, lang: string, alignmentData?: AlignmentData | null) => Promise<void>;
    onStopTTS: () => void;
    isGlobalVadActive?: Accessor<boolean>;
    isTTSSpeaking?: Accessor<boolean>;
    currentHighlightIndex?: Accessor<number | null>;
    scenario: ScenarioOption;
    onNavigateBack: () => void;
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
    border-radius: 3px; /* Keep for rounded highlight edges */
    display: inline; /* Changed from inline-block */
    transition: background-color 0.2s ease-out, color 0.2s ease-out;
    padding: 0; /* Removed padding */
    margin: 0; /* Removed margin */
    /* line-height: 1.5; */ /* Commented out, let parent control line-height */
    /* Ensure it doesn't add extra space if the content is just a space character */
    /* white-space: pre-wrap; */ /* May or may not be needed, test without first */
  }
  .scarlett-roleplay-word-highlight {
    background-color: hsl(var(--primary) / 0.3); 
  }
`;

export const RoleplayConversationView: Component<RoleplayConversationViewProps> = (props) => {
    const initialWelcomeMessageObject = props.aiWelcomeMessage
        ? {
            id: `ai-initial-welcome-${Date.now()}`,
            sender: 'ai' as const,
            text: props.aiWelcomeMessage,
            timestamp: new Date(),
            alignment: null,
          }
        : null;

    const [chatHistory, setChatHistory] = createSignal<ChatMessage[]>(initialWelcomeMessageObject ? [initialWelcomeMessageObject] : []);
    const [currentAiMessageToDisplay, setCurrentAiMessageToDisplay] = createSignal<ChatMessage | null>(initialWelcomeMessageObject);
    const [isListening, setIsListening] = createSignal(false);
    const [isProcessingUserSpeech, setIsProcessingUserSpeech] = createSignal(false);
    const [isWaitingForLLM, setIsWaitingForLLM] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    // --- DEBUG LOGGING FOR STATE CHANGES ---
    createEffect(() => console.log("[RoleplayConversationView] isListening:", isListening()));
    createEffect(() => console.log("[RoleplayConversationView] isProcessingUserSpeech:", isProcessingUserSpeech()));
    createEffect(() => console.log("[RoleplayConversationView] isWaitingForLLM:", isWaitingForLLM()));
    createEffect(() => console.log("[RoleplayConversationView] errorMessage:", errorMessage()));
    createEffect(() => console.log("[RoleplayConversationView] isTTSSpeaking (prop):", props.isTTSSpeaking ? props.isTTSSpeaking() : 'prop undefined'));
    createEffect(() => console.log("[RoleplayConversationView] Scenario (prop):", props.scenario ? props.scenario.title : 'prop undefined'));

    // ADD THIS: Log full chatHistory on change
    createEffect(() => {
        const history = chatHistory();
        console.log(`[RoleplayConversationView] chatHistory updated. Count: ${history.length}`);
        history.forEach((msg, index) => {
            console.log(`[RoleplayConversationView] chatHistory[${index}]: id=${msg.id}, sender=${msg.sender}, text="${msg.text ? msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '') : 'NULL'}", error=${!!msg.error}`);
        });
    });
    // --- END DEBUG LOGGING ---

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

        // If currentAiMessageToDisplay was initialized with a welcome message, play it.
        if (initialWelcomeMessageObject && props.onPlayTTS) {
            props.onPlayTTS(initialWelcomeMessageObject.text, props.targetLanguage, initialWelcomeMessageObject.alignment);
        } else if (!initialWelcomeMessageObject) { // Only run this if no welcome message was set
            props.onStartRecording().then((success: boolean) => {
                if (success) setIsListening(true);
                else setErrorMessage("VAD failed to start.");
                // Set a different initial message if no welcome message
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

    // Visual status indicator (could be improved)
    const StatusIndicator: Component = () => {
        const ttsSpeaking = () => props.isTTSSpeaking ? props.isTTSSpeaking() : false;
        const statusText = () => {
            if (errorMessage()) return `Error: ${errorMessage()}`;
            if (ttsSpeaking()) return "AI Speaking";
            if (isListening()) return "Listening";
            if (isProcessingUserSpeech()) return "Processing Speech";
            if (isWaitingForLLM()) return "AI Thinking";
            if (currentAiMessageToDisplay()?.text === "Didn't catch any speech.") return "No speech detected";
            return "Ready";
        };

        return (
            <div class={`fixed bottom-4 right-4 text-xs p-2 rounded shadow-md transition-all duration-300 ease-in-out 
                ${errorMessage() ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}
                ${(isListening() || ttsSpeaking()) ? 'opacity-90' : 'opacity-70'}
            `}>
                {statusText()} | L: {isListening().toString().charAt(0)} | P: {isProcessingUserSpeech().toString().charAt(0)} | W: {isWaitingForLLM().toString().charAt(0)} | TTS: {ttsSpeaking().toString().charAt(0)} | Err: {errorMessage() ? 'Y' : 'N'}
            </div>
        );
    };

    return (
        <div class="h-full w-full flex flex-col bg-gradient-to-br from-background to-muted/20 text-foreground font-sans select-none overflow-hidden">
            <Header 
                title={props.scenario?.title ? `Roleplay: ${props.scenario.title}` : "Roleplay Chat"}
                onBackClick={() => { 
                    console.log("%c[RoleplayConversationView] HEADER ONBACKCLICK TRIGGERED!", "color: red; font-weight: bold;"); // ADDED LOG
                    props.onStopTTS?.(); 
                    if (isListening()) props.onStopRecording?.(); // Also stop VAD if active
                    props.onEndRoleplay ? props.onEndRoleplay() : props.onNavigateBack(); // Fallback to onNavigateBack if onEndRoleplay not provided
                }} 
                hideBackButton={false} // Header itself is fine, its internal button is fine for navigation
            /> 
            
            <main class="flex-grow flex flex-col items-center justify-center relative p-4 text-center"> {/* Added text-center */}
                {(() => {
                    console.log("[RoleplayConversationView] MAIN JSX - Evaluating reactive block. currentAiMessageToDisplay() is:", 
                        currentAiMessageToDisplay() ? { 
                            id: currentAiMessageToDisplay()!.id, 
                            text: currentAiMessageToDisplay()!.text?.substring(0,30), 
                            sender: currentAiMessageToDisplay()!.sender 
                        } : null,
                        "isWaitingForLLM() is:", isWaitingForLLM()
                    );
                    return null; // Explicitly return null for JSX
                })()}
                
                {/* --- New Explicit Display Logic --- */}
                <Show when={errorMessage()} keyed>
                    {(errMsg) => (
                        <Motion.div 
                            initial={{opacity: 0, y:20}} animate={{opacity:1, y:0}} transition={{duration: 0.3}}
                            class="text-destructive-foreground text-sm p-3 bg-destructive/80 backdrop-blur-sm rounded-lg shadow-lg w-auto max-w-[90%] text-center z-20"
                        >
                            {errMsg}
                        </Motion.div>
                    )}
                </Show>

                <Show when={!errorMessage() && isWaitingForLLM()} keyed>
                     <div class="text-xl text-muted-foreground animate-pulse">AI is thinking...</div>
                     <div class="absolute inset-0 flex items-center justify-center z-0">
                        <Spinner class="w-12 h-12 text-primary" />
                    </div>
                </Show>

                <Show when={!errorMessage() && !isWaitingForLLM() && currentAiMessageToDisplay()?.text} keyed>
                    {(msg) => (
                        // Render AI's actual text response
                        <div class="text-2xl p-4">{currentAiMessageToDisplay()!.text}</div> // Removed animate-fade-in
                    )}
                </Show>

                <Show when={!errorMessage() && !isWaitingForLLM() && (!currentAiMessageToDisplay() || !currentAiMessageToDisplay()?.text)} keyed>
                    {/* Fallback: e.g., "Listening..." or "Ready" or initial state before any interaction */}
                    <div class="text-xl text-muted-foreground">
                        {currentAiMessageToDisplay()?.text ? currentAiMessageToDisplay()!.text : "Ready to begin roleplay..."}
                    </div>
                </Show>
                {/* --- End New Explicit Display Logic --- */}
            </main>
            
            {/* Mic button removed; VAD handles recording automatically */}
            <StatusIndicator />
            {/* Debug Panel */}
            <div style="position:fixed; bottom:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:4px; border-radius:4px; z-index:999;">
                L:{isListening().toString()} P:{isProcessingUserSpeech().toString()} W:{isWaitingForLLM().toString()} E:{errorMessage() ?? 'none'}
            </div>
        </div>
    );
}; 