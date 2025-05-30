import { Component, For, Show, Accessor } from 'solid-js';
import { Card, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import type { Messages } from '../../types/i18n';

// Domain info interface
export interface DomainInfo {
  domain: string;
  visitCount: number;
  category: string;
}

// Category data interface
export interface CategoryData {
  category: string;
  domains: DomainInfo[];
}

export interface BrowsingHistoryPanelProps {
  categories: CategoryData[];
  overallInsight?: string;
  overallInsightProgress?: number; // 0-100
  isGeneratingOverallInsight?: boolean;
  analysisStage?: string; // "Fetching history..." | "Categorizing domains..." | "Generating insights..."
  messages: Accessor<Messages>;
  onAnalysisComplete?: () => void;
}

const categoryDisplayNames: Record<string, string> = {
  productive: 'Productive',
  entertaining: 'Entertaining', 
  neutral: 'Neutral',
  distracting: 'Distracting'
};

const BrowsingHistoryPanel: Component<BrowsingHistoryPanelProps> = (props) => {
  return (
    <div class="space-y-8 max-w-4xl mx-auto">
      {/* Categories Grid */}
      <div class="grid grid-cols-2 gap-6">
        <For each={props.categories}>
          {(category) => (
            <Card class="p-6">
              <CardTitle class="text-left mb-4">
                {categoryDisplayNames[category.category] || category.category}
              </CardTitle>
              
              {/* Domain List */}
              <div class="space-y-3">
                <Show when={category.domains.length > 0}>
                  <For each={category.domains.slice(0, 5)}>
                    {(domain) => (
                      <div class="flex justify-between items-center py-1">
                        <span class="font-medium">{domain.domain}</span>
                        <span class="text-muted-foreground">
                          {domain.visitCount}
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
                <Show when={category.domains.length === 0}>
                  <div class="text-muted-foreground italic py-4">
                    No sites found
                  </div>
                </Show>
              </div>
            </Card>
          )}
        </For>
      </div>

      {/* Overall Analysis */}
      <Show when={props.overallInsight || props.isGeneratingOverallInsight}>
        <Card class="p-6">
          <div class="space-y-4">
            <Show when={props.isGeneratingOverallInsight}>
              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <span class="font-medium">
                    {props.analysisStage || "Analyzing your browsing patterns..."}
                  </span>
                </div>
                <Show when={props.overallInsightProgress !== undefined}>
                  <Progress value={props.overallInsightProgress!} class="w-full h-2" />
                </Show>
              </div>
            </Show>
            
            <Show when={props.overallInsight}>
              <div class="space-y-3">
                <h3 class="text-xl font-semibold text-left">Analysis</h3>
                <p class="text-muted-foreground leading-relaxed text-left">
                  {props.overallInsight}
                </p>
              </div>
            </Show>
          </div>
        </Card>
      </Show>
    </div>
  );
};

export default BrowsingHistoryPanel; 