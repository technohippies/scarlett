import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../../src/components/ui/accordion';

export default {
  title: 'Components/UI/Accordion',
  component: Accordion,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    multiple: {
      control: 'boolean',
      description: 'Allow multiple items to be open at once',
    },
    collapsible: {
      control: 'boolean',
      description: 'Allow all items to be collapsed',
    },
  },
  args: {
    multiple: false,
    collapsible: true,
  },
};

// Basic accordion example
export const Default = {
  render: (args: any) => (
    <Accordion multiple={args.multiple} collapsible={args.collapsible} class="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>
          Yes. It adheres to the WAI-ARIA design pattern and supports keyboard navigation.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes. It comes with default styles that matches the other components' aesthetic.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Is it animated?</AccordionTrigger>
        <AccordionContent>
          Yes. It's animated by default with smooth expand/collapse transitions.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// Thinking model specific example
export const ThinkingModel = {
  render: (args: any) => (
    <div class="w-full max-w-2xl space-y-4">
      {/* Assistant Message with Thinking */}
      <div class="space-y-2">
        <div class="text-sm text-muted-foreground">Assistant</div>
        <Accordion multiple={args.multiple} collapsible={args.collapsible} class="w-full">
          <AccordionItem value="thinking">
            <AccordionTrigger class="text-left text-sm font-normal text-muted-foreground">
              Thought for 3 seconds
            </AccordionTrigger>
            <AccordionContent>
              <div class="text-sm font-mono bg-muted/50 p-3 rounded border-l-2 border-muted-foreground/20">
                I need to analyze this mathematical problem step by step. Let me break down the equation:
                <br /><br />
                First, I'll identify what we're solving for...
                <br />
                Then I'll apply the quadratic formula...
                <br />
                The discriminant is positive, so we'll have two real solutions...
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div class="bg-background p-4 rounded border">
          <p>The equation x² - 5x + 6 = 0 has two solutions: x = 2 and x = 3.</p>
          <p class="mt-2 text-sm text-muted-foreground">
            I solved this by factoring: (x - 2)(x - 3) = 0, which gives us x = 2 or x = 3.
          </p>
        </div>
      </div>
    </div>
  ),
};

// Multiple items open
export const Multiple = {
  args: {
    multiple: true,
  },
  render: (args: any) => (
    <Accordion multiple={args.multiple} collapsible={args.collapsible} class="w-full">
      <AccordionItem value="features">
        <AccordionTrigger>Features</AccordionTrigger>
        <AccordionContent>
          Fully customizable, accessible, and animated accordion component.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="installation">
        <AccordionTrigger>Installation</AccordionTrigger>
        <AccordionContent>
          Install via npm: <code class="bg-muted px-1 rounded">npm install @kobalte/core</code>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="usage">
        <AccordionTrigger>Usage</AccordionTrigger>
        <AccordionContent>
          Import the components and use them in your SolidJS application.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// Non-collapsible (always one open)
export const NonCollapsible = {
  args: {
    collapsible: false,
  },
  render: (args: any) => (
    <Accordion multiple={args.multiple} collapsible={args.collapsible} class="w-full">
      <AccordionItem value="step-1">
        <AccordionTrigger>Step 1: Setup</AccordionTrigger>
        <AccordionContent>
          Configure your development environment and install dependencies.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="step-2">
        <AccordionTrigger>Step 2: Implementation</AccordionTrigger>
        <AccordionContent>
          Write your code following the established patterns and conventions.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="step-3">
        <AccordionTrigger>Step 3: Testing</AccordionTrigger>
        <AccordionContent>
          Test your implementation thoroughly before deployment.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// Long content example
export const LongContent = {
  render: (args: any) => (
    <Accordion multiple={args.multiple} collapsible={args.collapsible} class="w-full">
      <AccordionItem value="detailed-thinking">
        <AccordionTrigger>Detailed reasoning process</AccordionTrigger>
        <AccordionContent>
          <div class="text-sm space-y-2 font-mono bg-muted/30 p-3 rounded">
            <p>Let me think through this complex problem step by step...</p>
            <p>First, I need to understand the context and requirements:</p>
            <ul class="ml-4 space-y-1">
              <li>• The user is asking about implementing a UI component</li>
              <li>• They want to handle thinking models like DeepSeek R1</li>
              <li>• The goal is to show/hide thinking content elegantly</li>
            </ul>
            <p>Now, considering the implementation options:</p>
            <p>An accordion makes perfect sense because it provides:</p>
            <ul class="ml-4 space-y-1">
              <li>• Collapsible content areas</li>
              <li>• Smooth animations</li>
              <li>• Accessible keyboard navigation</li>
              <li>• Familiar UX patterns</li>
            </ul>
            <p>The OpenAI approach they mentioned involves streaming the thinking content first, then showing the final response. An accordion allows users to view the thinking process on demand while keeping the interface clean by default.</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
