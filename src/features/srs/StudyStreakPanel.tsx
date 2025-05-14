import { Component, Show, Accessor } from 'solid-js';
import { Spinner } from '../../components/ui/spinner';
import { Flame } from 'phosphor-solid';
import type { Messages } from '../../types/i18n';

export interface StudyStreakPanelProps {
  currentStreak: Accessor<number | undefined>;
  isLoading: Accessor<boolean>;
  messages?: Messages | undefined;
  class?: string; // Allow passing additional classes
}

export const StudyStreakPanel: Component<StudyStreakPanelProps> = (props) => {
  const i18n = () => {
    const msgs = props.messages;
    return {
      get: (key: string, fallback: string) => msgs?.[key]?.message || fallback,
    };
  };

  return (
    <div class={`bg-card p-3 rounded-lg shadow-md text-card-foreground flex items-center justify-start w-full ${props.class ?? ''}`}>
      <Show
        when={!props.isLoading()}
        fallback={<div class="flex justify-start items-center h-10"><Spinner class="h-5 w-5 text-muted-foreground" /></div>}
      >
        <div class="flex items-center gap-2">
          <Flame weight="fill" class="text-orange-500" size={24} />
          <span class="text-lg font-semibold">
            {i18n().get('newTabPageStreakTitle', 'Streak')}:
          </span>
          <span class="text-lg font-semibold text-primary">
            {props.currentStreak() ?? 0}
          </span>
        </div>
      </Show>
    </div>
  );
}; 