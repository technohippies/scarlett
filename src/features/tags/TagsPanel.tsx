import { Component, For, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Tag as DbTag } from '../../services/db/types';
import { Tag as TagIcon } from 'phosphor-solid';

interface TagsPanelProps {
  tags: Accessor<DbTag[]>;
}

const TagsPanel: Component<TagsPanelProps> = (props) => {
  return (
    <div class="space-y-4">
      {/* Display existing tags (Simplified) */}
      <div class="flex flex-wrap gap-2">
        <Show when={props.tags().length > 0} fallback={<p class="text-muted-foreground text-sm">No tags have been created yet.</p>}>
          <For each={props.tags()}>{(tag) =>
            <span 
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border cursor-default"
              title={`Tag ID: ${tag.tag_id}`}
            >
                <TagIcon class="w-3 h-3 mr-1" /> 
              {tag.tag_name}
            </span>
          }</For>
        </Show>
      </div>

    </div>
  );
};

export default TagsPanel; 