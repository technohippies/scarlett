import { Component } from 'solid-js';
import { TextField, TextFieldInput } from '../../components/ui/text-field'; // Assuming path
import { Button } from '../../components/ui/button'; // Assuming path
import { PaperPlaneTilt } from 'phosphor-solid';
import type { Messages } from '../../types/i18n';

interface TextInputControlsProps {
  userInput: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  isDisabled?: boolean;
  messages?: Messages;
}

export const TextInputControls: Component<TextInputControlsProps> = (props) => {
  // Localization helper
  const getLocalizedString = (key: string, fallback: string) => {
    return props.messages?.[key]?.message || fallback;
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Only send if not disabled and has content
      if (!props.isDisabled && props.userInput.trim()) {
        props.onSendMessage();
      }
    }
  };

  return (
    <div class="flex items-center space-x-2">
      <TextField class="w-full">
        <TextFieldInput
          type="text"
          placeholder={getLocalizedString('chatPageInputPlaceholder', 'Ask anything...')}
          value={props.userInput}
          onInput={(e) => props.onInputChange(e.currentTarget.value)}
          onKeyPress={handleKeyPress}
          class="text-md md:text-base h-10"
        />
      </TextField>
      <Button 
        onClick={props.onSendMessage} 
        class="h-10 w-10 p-0"
        disabled={props.isDisabled || !props.userInput.trim()}
        aria-label="Send message"
      >
        <PaperPlaneTilt weight="fill" class="size-4" />
      </Button>
    </div>
  );
}; 