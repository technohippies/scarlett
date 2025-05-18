import { Component, For, Show } from 'solid-js';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';

export interface ScenarioOption {
    id: string | number;
    title: string;
    description: string;
    // Potentially add other details like estimated time, difficulty, key vocab hints, etc.
}

export interface RoleplaySelectionViewProps {
    scenarios: ScenarioOption[];
    onScenarioSelect: (scenarioId: string | number) => void;
    isLoading?: boolean;
    // userNativeLanguage: string; // To ensure descriptions are in this lang, though content comes from LLM
    onGenerateNewSet?: () => void; // Optional: If user wants to refresh options
    onJustChatSelect: () => void; // Added new prop
    titleText?: string;
}

// New Minimal Loading State Component
const MinimalLoadingState: Component = () => (
    <div class="flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
        <Spinner class="mb-4 w-10 h-10" />
        <p class="text-lg text-muted-foreground">Generating Roleplays...</p>
    </div>
);

export const RoleplaySelectionView: Component<RoleplaySelectionViewProps> = (props) => {
    const defaultTitle = "Choose Your Roleplay Scenario";

    return (
        <div class="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto font-sans flex flex-col items-center"> {/* Added flex for centering Just Chat */}
            <Show when={!props.isLoading} fallback={<MinimalLoadingState />}>
                <Card class="bg-background/80 backdrop-blur-sm border-border/20 shadow-xl w-full"> {/* Added w-full */}
                    <CardHeader class="text-center pb-4">
                        <CardTitle class="text-2xl md:text-3xl font-semibold text-primary">
                            {props.titleText || defaultTitle}
                        </CardTitle>
                        <Show when={props.scenarios.length > 0}>
                            <CardDescription class="mt-2 text-base text-muted-foreground">
                                Select a scenario below to start your conversation practice.
                            </CardDescription>
                        </Show>
                    </CardHeader>
                    <CardContent class="pt-2 pb-4">
                        <Show when={props.scenarios.length > 0} fallback={
                            <div class="text-center py-8">
                                <p class="text-muted-foreground">No LLM-generated scenarios available yet.</p>
                                <Show when={props.onGenerateNewSet}>
                                    <Button onClick={() => props.onGenerateNewSet && props.onGenerateNewSet()} variant="outline" class="mt-4">
                                        Generate Scenarios
                                    </Button>
                                </Show>
                            </div>
                        }>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Changed lg:grid-cols-3 to md:grid-cols-2 for 2 scenarios */}
                                <For each={props.scenarios}>{(scenario) => (
                                    <Card 
                                        class="hover:shadow-primary/20 hover:border-primary/40 transition-all duration-200 ease-in-out cursor-pointer flex flex-col h-full bg-muted/30 border-border/10 hover:bg-muted/50"
                                        onClick={() => props.onScenarioSelect(scenario.id)}
                                        tabIndex={0}
                                        onKeyPress={(e) => e.key === 'Enter' && props.onScenarioSelect(scenario.id)}
                                    >
                                        <CardHeader>
                                            <CardTitle class="text-lg font-medium text-foreground">{scenario.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent class="flex-grow">
                                            <p class="text-sm text-muted-foreground leading-relaxed">{scenario.description}</p>
                                        </CardContent>
                                        <CardFooter class="mt-auto pt-3">
                                            <Button variant="outline" class="w-full text-primary border-primary/50 hover:bg-primary/10 hover:text-primary">
                                                Start This Roleplay
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )}</For>
                            </div>
                        </Show>
                    </CardContent>
                    <Show when={props.onGenerateNewSet && props.scenarios.length > 0}>
                        <CardFooter class="pt-4 flex justify-center border-t border-border/10">
                            <Button onClick={() => props.onGenerateNewSet && props.onGenerateNewSet()} variant="ghost" class="text-sm text-muted-foreground">
                                Generate More Scenarios
                            </Button>
                        </CardFooter>
                    </Show>
                </Card>
            </Show>

            {/* "Just Chat" Button - Always visible and centered */}
            <div class="mt-8 w-full flex justify-center">
                <Button 
                    variant="default" // Or perhaps a more prominent variant if available, e.g., "primary"
                    size="lg" 
                    class="px-8 py-3 text-lg shadow-md" // Simplified classes: Adjust padding/text-size as needed for "XL" feel
                    onClick={() => props.onJustChatSelect()}
                >
                    Just Chat
                </Button>
            </div>
        </div>
    );
}; 