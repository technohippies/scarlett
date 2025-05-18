import { Component, createSignal, For, Show, createEffect, onCleanup, onMount, Accessor } from 'solid-js';
import { Motion } from 'solid-motionone';
// import { Textarea } from '../../components/ui/textarea'; // REMOVED Textarea for user text input
import { Spinner } from '../../components/ui/spinner';
import { Header } from '../../components/layout/Header';
// @ts-ignore: suppress missing types import
import type { AlignmentData, ChatMessage, RoleplayConversationViewProps } from './types'; // Import types from a separate file
import type { ScenarioOption } from './RoleplaySelectionView'; // Import ScenarioOption

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
    ttsWordMap?: { text: string; startTime: number; endTime: number; index: number }[];
    scenario: ScenarioOption;
    onNavigateBack: () => void;
    activeSpokenMessageId?: Accessor<string | null>;
}

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
    const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
    const [currentAiMessageToDisplay, setCurrentAiMessageToDisplay] = createSignal<ChatMessage | null>(null);
    const [isListening, setIsListening] = createSignal(false);
    const [isProcessingUserSpeech, setIsProcessingUserSpeech] = createSignal(false);
    const [isWaitingForLLM, setIsWaitingForLLM] = createSignal(false);
    const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

    let chatAreaRef: HTMLDivElement | undefined;

    // Automatic listening based on TTS status
    createEffect(() => {
        const currentScenario = props.scenario; // Capture prop for consistent use in this effect run
        const ttsIsSpeaking = props.isTTSSpeaking ? props.isTTSSpeaking() : false;
        const processingSpeech = isProcessingUserSpeech();
        const waitingLlm = isWaitingForLLM();
        const currentError = errorMessage();

        // Log all relevant states at the beginning of the effect
        console.log(`[RoleplayConversationView] Auto-listen effect. Scenario: ${currentScenario?.title || 'None'}, TTS: ${ttsIsSpeaking}, ProcSpeech: ${processingSpeech}, WaitLLM: ${waitingLlm}, Err: ${currentError || 'None'}, Listening: ${isListening()}`);

        if (!currentScenario) {
            console.log("[RoleplayConversationView] Auto-listen effect: No current scenario. Ensuring VAD is stopped if it was listening.");
            if (isListening()) {
                props.onStopRecording();
                setIsListening(false); // Update local listening state
            }
            return; // IMPORTANT: Early exit if no scenario
        }

        // Scenario is valid, proceed with logic
        if (!ttsIsSpeaking && !processingSpeech && !waitingLlm && !currentError) {
            // Only attempt to start if not already listening to avoid redundant calls
            if (!isListening()) {
                console.log("[RoleplayConversationView] Auto-listen: Conditions met & not already listening. Attempting to start recording.");
                props.onStartRecording().then((success) => {
                    if (success) {
                        console.log("[RoleplayConversationView] Auto-listen: VAD started successfully.");
                        setIsListening(true);
                    } else {
                        console.warn("[RoleplayConversationView] Auto-listen: VAD failed to start.");
                        setIsListening(false);
                        // setErrorMessage("Voice input failed to start. Please check microphone permissions.");
                    }
                });
            } else {
                console.log("[RoleplayConversationView] Auto-listen: Conditions met but already listening. No action needed.");
            }
        } else {
            // Conditions for starting are not met (e.g., TTS speaking, processing, error)
            // Ensure VAD is stopped if it was listening
            if (isListening()) {
                console.log("[RoleplayConversationView] Auto-listen: Conditions NOT met for starting. Ensuring VAD is stopped.");
                props.onStopRecording();
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
                timestamp: new Date(), // Use Date object
            };
            const currentMessageList = [...chatMessages(), newUserMessage];
            setChatMessages(currentMessageList);
            
            setIsWaitingForLLM(true);
            setCurrentAiMessageToDisplay({
                id: 'ai-waiting-llm',
                sender: 'ai',
                text: "", 
                timestamp: new Date(), // Use Date object
                isLoading: true,
            });

            try {
                // Pass currentMessageList (which is ChatMessage[]) to onSendMessage
                const response = await props.onSendMessage(spokenText, currentMessageList);
                setIsWaitingForLLM(false);

                if (response) {
                    const newAiMessage: ChatMessage = {
                        id: `ai-response-${Date.now()}`,
                        text: response.aiResponse,
                        sender: 'ai',
                        timestamp: new Date(), // Use Date object
                        isLoading: false,
                        alignmentData: response.alignment,
                        ttsLang: response.ttsLangForAiResponse,
                        error: !!response.error 
                    };
                    setChatMessages(prev => [...prev, newAiMessage]);
                    setCurrentAiMessageToDisplay(newAiMessage);

                    if (response.error) {
                        setErrorMessage(response.error);
                        // Update displayed AI message to show error text
                        setCurrentAiMessageToDisplay(prev => prev ? {...prev, text: response.error || "Error generating response", error: true, isLoading: false } : null);
                    } else if (props.onPlayTTS && newAiMessage.text) {
                        // Use the ttsLang from the newAiMessage, fallback to general targetLanguage
                        props.onPlayTTS(newAiMessage.id, newAiMessage.text, newAiMessage.ttsLang || props.targetLanguage, newAiMessage.alignmentData);
                    }
                } else {
                    setErrorMessage("No response from AI.");
                    setCurrentAiMessageToDisplay({ id: 'ai-no-response', sender:'ai', text: "No response from AI.", timestamp: new Date(), error: true, isLoading: false });
                    // throw new Error("No response from AI."); // Optionally throw
                }
            } catch (error: any) {
                console.error("Error during LLM interaction flow:", error);
                const llmErrorMsg = error.message || "An error occurred with the AI.";
                setErrorMessage(llmErrorMsg);
                setCurrentAiMessageToDisplay({ 
                    id: 'ai-llm-error', 
                    sender: 'ai', 
                    text: llmErrorMsg, 
                    timestamp: new Date(), // Use Date object
                    error: true, 
                    isLoading: false 
                });
                setIsWaitingForLLM(false);
            }
        } else if (spokenText === "") {
             setCurrentAiMessageToDisplay({
                id: 'ai-no-speech-detected',
                sender: 'ai',
                text: "Didn't catch any speech.",
                timestamp: new Date(), // Use Date object
                isLoading: false,
            });
        } else { // spokenText is null (STT error)
            const sttErrorMsg = "Sorry, I couldn't understand that.";
            setErrorMessage(sttErrorMsg);
            setCurrentAiMessageToDisplay({ 
                id: 'ai-stt-error', 
                sender: 'ai', 
                text: sttErrorMsg, 
                timestamp: new Date(), // Use Date object
                error: true, 
                isLoading: false 
            });
        }
    };

    // onMount: Initialize and play welcome message if any
    onMount(() => {
        console.log("[RoleplayConversationView] ONMOUNT - Setting window.triggerUserSpeechProcessed");
        (window as any).triggerUserSpeechProcessed = handleUserSpeechProcessed;

        if (!document.getElementById(HIGHLIGHT_STYLE_ID)) {
            const styleElement = document.createElement('style');
            styleElement.id = HIGHLIGHT_STYLE_ID;
            styleElement.textContent = HIGHLIGHT_CSS;
            document.head.appendChild(styleElement);
        }

        console.log("[RoleplayConversationView] ONMOUNT: Attempting initial VAD start (no welcome message configured).");
        props.onStartRecording().then((success: boolean) => {
            if (success) {
                 console.log("[RoleplayConversationView] ONMOUNT: Initial VAD started successfully.");
                setIsListening(true);
            } else {
                console.warn("[RoleplayConversationView] ONMOUNT: Initial VAD failed to start.");
                setErrorMessage("VAD failed to start.");
            }
            setCurrentAiMessageToDisplay({
                id: 'ai-ready-to-listen',
                sender: 'ai',
                text: isListening() ? "Listening..." : "Ready. Speak when you are.",
                timestamp: new Date(),
            });
        }).catch((err: any) => {
             console.error("[RoleplayConversationView] ONMOUNT: Error starting initial VAD:", err);
             setErrorMessage("Error with voice activity detection.");
        });
    });

    onCleanup(() => {
        console.log("%c[RoleplayConversationView] ONCLEANUP - Clearing window.triggerUserSpeechProcessed and stopping VAD if active.", "color: blue; font-weight: bold;");
        // Clear the global handler only if it's the one set by this instance
        if ((window as any).triggerUserSpeechProcessed === handleUserSpeechProcessed) {
            (window as any).triggerUserSpeechProcessed = null;
        }
        // Explicitly stop recording if this component instance was listening
        if (isListening()) {
            console.log("[RoleplayConversationView] ONCLEANUP: VAD was listening, calling onStopRecording.");
            props.onStopRecording?.();
            setIsListening(false); // Ensure local state is also updated
        }
    });

    createEffect(() => {
        // Scroll to bottom when new messages are added
        if (chatMessages() && chatAreaRef) {
            chatAreaRef.scrollTop = chatAreaRef.scrollHeight;
        }
    });

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
                        <div class="text-2xl p-4">
                            <Show 
                                when={props.activeSpokenMessageId && props.activeSpokenMessageId() === currentAiMessageToDisplay()?.id && props.ttsWordMap && props.ttsWordMap.length > 0}
                                fallback={currentAiMessageToDisplay()!.text}
                            >
                                <For each={props.ttsWordMap}>{(word, _index) => (
                                    <span
                                        class="scarlett-roleplay-word-span"
                                        classList={{ 'scarlett-roleplay-word-highlight': props.currentHighlightIndex && props.currentHighlightIndex() === word.index }}
                                    >
                                        {word.text.replace(/ /g, '\u00A0')}
                                    </span>
                                )}</For>
                            </Show>
                        </div>
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
            {/* Debug Panel */}
            {/*
            <StatusIndicator />
            <div style="position:fixed; bottom:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:4px; border-radius:4px; z-index:999;">
                L:{isListening().toString()} P:{isProcessingUserSpeech().toString()} W:{isWaitingForLLM().toString()} E:{errorMessage() ?? 'none'}
            </div>
            */}
        </div>
    );
}; 