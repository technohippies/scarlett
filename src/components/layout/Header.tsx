import { Component } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Button } from '../ui/button'; // Assuming button component exists

export interface HeaderProps {
  title: string;
  onBackClick?: () => void; // Make optional if button can be hidden
  hideBackButton?: boolean; // New prop to control visibility
}

export const Header: Component<HeaderProps> = (props) => {
  return (
    <header class="flex items-center p-4 border-b border-border sticky top-0 bg-background z-10">
      {!props.hideBackButton && props.onBackClick && (
        <Button variant="ghost" size="icon" onClick={props.onBackClick} aria-label="Go back">
          <CaretLeft size={20} class="text-neutral-300" />
        </Button>
      )}
      <h1 class={`text-lg font-semibold ${!props.hideBackButton && props.title ? 'ml-2' : ''}`}>{props.title}</h1> {/* Adjust margin based on button and title */}
      {/* Placeholder for potential future elements like progress bar */}
      <div class="ml-auto"></div>
    </header>
  );
}; 