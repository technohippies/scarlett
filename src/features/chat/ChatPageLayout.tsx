import { Component } from 'solid-js';
import { useChat } from './chatStore';
import { ChatPageLayoutView } from './ChatPageLayoutView';

interface ChatPageLayoutProps {
  onNavigateBack: () => void;
}

export const ChatPageLayout: Component<ChatPageLayoutProps> = (props) => {
  const [state, actions] = useChat();
  return (
    <ChatPageLayoutView
      threads={state.threads.filter(t => t.id !== state.pendingThreadId)}
      currentThreadId={state.currentThreadId}
      threadSystemPrompt={
        state.threads.find(t => t.id === state.currentThreadId)?.scenarioDescription
      }
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(id) => actions.selectThread(id)}
      isSpeechModeActive={state.isSpeechMode}
      onToggleMode={() => actions.toggleSpeech()}
      onCreateThread={() => actions.createNewThread()}
      onGenerateRoleplay={() => actions.generateRoleplay()}
      onDeleteThread={(id) => actions.deleteThread(id)}
      messages={state.messages}
      userInput={state.userInput}
      onInputChange={(text) => actions.setInput(text)}
      onSendText={() => actions.sendText()}
      isIdle={!state.isLoading}
      isRoleplayLoading={state.isRoleplayLoading}
      isVADListening={state.isVADListening}
      isSpeaking={state.isGlobalTTSSpeaking}
      audioLevel={state.audioLevel}
      isVoiceConversationActive={state.isVoiceConversationActive}
      onStartVoiceConversation={() => actions.startVoiceConversation()}
      onStartVAD={() => actions.startVAD()}
      onStopVAD={() => actions.stopVAD()}
    />
  );
}; 