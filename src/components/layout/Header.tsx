import { Component } from 'solid-js';
import { CaretLeft } from 'phosphor-solid';
import { Button } from '../ui/button'; // Assuming button component exists

export interface HeaderProps {
  title: string;
  onBackClick: () => void;
}

export const Header: Component<HeaderProps> = (props) => {
  return (
    <header class="flex items-center p-4 border-b border-border sticky top-0 bg-background z-10">
      <Button variant="ghost" size="icon" onClick={props.onBackClick} aria-label="Go back">
        <CaretLeft size={20} />
      </Button>
      <h1 class="text-lg font-semibold ml-2">{props.title}</h1>
      {/* Placeholder for potential future elements like progress bar */}
      <div class="ml-auto"></div>
    </header>
  );
}; 