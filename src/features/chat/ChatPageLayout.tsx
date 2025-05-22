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
      threads={state.threads}
      currentThreadId={state.currentThreadId}
      onNavigateBack={props.onNavigateBack}
      onSelectThread={(id) => actions.selectThread(id)}
      isSpeechModeActive={state.isSpeechMode}
      onToggleMode={() => actions.toggleSpeech()}
      messages={state.messages}
      userInput={state.userInput}
      onInputChange={(text) => actions.setInput(text)}
      onSendText={() => actions.sendText()}
      isIdle={!state.isLoading}
    />
  );
}; 