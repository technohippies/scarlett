import { Component } from 'solid-js';
import { TextField, TextFieldInput } from '../../components/ui/text-field'; // Assuming path
import { Button } from '../../components/ui/button'; // Assuming path

interface TextInputControlsProps {
  userInput: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  isDisabled?: boolean;
}

export const TextInputControls: Component<TextInputControlsProps> = (props) => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      props.onSendMessage();
    }
  };

  return (
    <div class="flex items-center space-x-2">
      <TextField class="w-full">
        <TextFieldInput
          type="text"
          placeholder="Type your message..."
          value={props.userInput}
          onInput={(e) => props.onInputChange(e.currentTarget.value)}
          onKeyPress={handleKeyPress}
          disabled={props.isDisabled}
          class="text-md md:text-base h-10"
        />
      </TextField>
      <Button 
        onClick={props.onSendMessage} 
        class="h-10 px-4 w-24"
        disabled={props.isDisabled || !props.userInput.trim()}
      >
        Send
        {/* SVG icon for send can be added here */}
      </Button>
    </div>
  );
}; 