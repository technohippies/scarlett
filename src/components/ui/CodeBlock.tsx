import { Component, createSignal, createEffect, onMount } from 'solid-js';
import { CopySimple, Check } from 'phosphor-solid';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import 'highlight.js/styles/atom-one-dark.css';
import { Label } from './label';

// Mock cn utility for Tailwind class merging
const cn = (...classes: (string | undefined | false)[]) => 
  classes.filter(Boolean).join(' ');

// Mock Button component (replace with your actual Button component)
const Button: Component<{
  variant?: 'ghost';
  size?: 'icon';
  class?: string;
  onClick: () => void;
  'aria-label': string;
  children: any;
}> = (props) => {
  return (
    <button
      class={cn(
        'transition-colors focus:outline-none',
        props.variant === 'ghost' && 'bg-transparent',
        props.size === 'icon' && 'p-0',
        props.class
      )}
      onClick={props.onClick}
      aria-label={props['aria-label']}
    >
      {props.children}
    </button>
  );
};

// Register the language
hljs.registerLanguage('bash', bash);

interface CodeBlockProps {
  code: string;
  language?: string;
  class?: string;
  label?: string;
}

export const CodeBlock: Component<CodeBlockProps> = (props) => {
  const [isCopied, setIsCopied] = createSignal(false);
  let codeElement: HTMLElement | undefined;

  // Effect to highlight code when props.code changes
  createEffect(() => {
    if (codeElement) {
      props.code; // Depend on props.code
      hljs.highlightElement(codeElement);
    }
  });

  onMount(() => {
    if (codeElement) {
      hljs.highlightElement(codeElement);
    }
  });

  const copyToClipboard = async () => {
    if (!navigator.clipboard) {
      console.warn('Clipboard API not available');
      return;
    }
    try {
      await navigator.clipboard.writeText(props.code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Determine if the code is single-line (no newline characters)
  const isSingleLine = () => !props.code.includes('\n');

  return (
    <div class={cn('space-y-1.5', props.class)}>
      {props.label && (
        <Label class="font-medium text-muted-foreground">{props.label}</Label>
      )}
      <div
        class={cn(
          'flex font-mono text-md bg-neutral-800 rounded-lg',
          isSingleLine()
            ? 'items-center px-4 py-2'
            : 'items-start p-4 justify-between'
        )}
      >
        <pre
          class={cn(
            'overflow-x-auto whitespace-pre-wrap break-words text-neutral-100 bg-transparent text-left',
            'm-0 p-0 flex-grow'
          )}
        >
          <code
            ref={codeElement}
            style="background: transparent !important; color: inherit; padding: 0 !important;"
            class={cn(
              props.language ? `language-${props.language}` : 'language-bash'
            )}
          >
            {props.code}
          </code>
        </pre>
        <Button
          variant="ghost"
          size="icon"
          class={cn(
            'ml-2 flex-shrink-0',
            'text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-100',
            'rounded-md',
            'h-8 w-8',
            'inline-flex items-center justify-center',
            'cursor-pointer'
          )}
          onClick={copyToClipboard}
          aria-label="Copy code to clipboard"
        >
          {isCopied() ? (
            <Check class="h-5 w-5 text-emerald-400" />
          ) : (
            <CopySimple class="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};