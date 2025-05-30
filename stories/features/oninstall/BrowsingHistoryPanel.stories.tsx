import { createSignal, Accessor, Setter, Component } from 'solid-js';
import BrowsingHistoryPanel, { type CategoryData, type DomainInfo } from '../../../src/features/oninstall/BrowsingHistoryPanel';
import { action } from '@storybook/addon-actions';

// Mock domain data
const mockDomains: Record<string, DomainInfo[]> = {
  productive: [
    { domain: 'github.com', visitCount: 45, category: 'productive' },
    { domain: 'stackoverflow.com', visitCount: 23, category: 'productive' },
    { domain: 'linear.app', visitCount: 12, category: 'productive' },
    { domain: 'notion.so', visitCount: 8, category: 'productive' },
    { domain: 'figma.com', visitCount: 6, category: 'productive' },
    { domain: 'vercel.com', visitCount: 4, category: 'productive' },
  ],
  neutral: [
    { domain: 'wikipedia.org', visitCount: 18, category: 'neutral' },
    { domain: 'amazon.com', visitCount: 15, category: 'neutral' },
    { domain: 'weather.com', visitCount: 10, category: 'neutral' },
    { domain: 'maps.google.com', visitCount: 7, category: 'neutral' },
    { domain: 'news.google.com', visitCount: 5, category: 'neutral' },
  ],
  entertaining: [
    { domain: 'youtube.com', visitCount: 67, category: 'entertaining' },
    { domain: 'netflix.com', visitCount: 34, category: 'entertaining' },
    { domain: 'reddit.com', visitCount: 28, category: 'entertaining' },
    { domain: 'twitch.tv', visitCount: 19, category: 'entertaining' },
    { domain: 'spotify.com', visitCount: 14, category: 'entertaining' },
  ],
  distracting: [
    { domain: 'facebook.com', visitCount: 42, category: 'distracting' },
    { domain: 'instagram.com', visitCount: 38, category: 'distracting' },
    { domain: 'twitter.com', visitCount: 31, category: 'distracting' },
    { domain: 'tiktok.com', visitCount: 25, category: 'distracting' },
    { domain: 'snapchat.com', visitCount: 16, category: 'distracting' },
  ],
};

// Helper function to create category data
const createCategoryData = (categoryName: string): CategoryData => ({
  category: categoryName,
  domains: mockDomains[categoryName] || [],
});

// Mock messages
const mockMessages = () => ({
  browsingHistoryTitle: { message: 'Understanding Your Digital Habits' },
  browsingHistoryDescription: { message: 'Help Scarlett learn about your interests and workflow' },
});

export default {
  title: 'Features/Oninstall/BrowsingHistoryPanel',
  component: BrowsingHistoryPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Panel for displaying categorized browsing history during onboarding',
      },
    },
  },
  decorators: [
    (Story: Component) => (
      <div class="min-h-screen bg-background p-8">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    categories: {
      description: 'Array of category data with domains and visit counts',
      control: { type: 'object' },
    },
    overallInsight: {
      description: 'LLM-generated analysis of browsing patterns',
      control: { type: 'text' },
    },
    overallInsightProgress: {
      description: 'Progress of insight generation (0-100)',
      control: { type: 'range', min: 0, max: 100 },
    },
    isGeneratingOverallInsight: {
      description: 'Whether insight generation is in progress',
      control: { type: 'boolean' },
    },
    analysisStage: {
      description: 'Current stage of analysis being performed',
      control: { type: 'text' },
    },
  },
};

export const Default = {
  args: {
    categories: [
      createCategoryData('productive'),
      createCategoryData('neutral'),
      createCategoryData('entertaining'),
      createCategoryData('distracting'),
    ],
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
};

export const FetchingHistory = {
  args: {
    categories: [
      { category: 'productive', domains: [] },
      { category: 'neutral', domains: [] },
      { category: 'entertaining', domains: [] },
      { category: 'distracting', domains: [] },
    ],
    isGeneratingOverallInsight: true,
    analysisStage: "Fetching your browser history...",
    overallInsightProgress: 15,
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
};

export const CategorizingDomains = {
  args: {
    categories: [
      createCategoryData('productive'),
      createCategoryData('neutral'),
      createCategoryData('entertaining'),
      createCategoryData('distracting'),
    ],
    isGeneratingOverallInsight: true,
    analysisStage: "Categorizing domains...",
    overallInsightProgress: 45,
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
};

export const GeneratingInsights = {
  args: {
    categories: [
      createCategoryData('productive'),
      createCategoryData('neutral'),
      createCategoryData('entertaining'),
      createCategoryData('distracting'),
    ],
    isGeneratingOverallInsight: true,
    analysisStage: "Generating insights...",
    overallInsightProgress: 85,
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
};

export const WithInsight = {
  args: {
    categories: [
      createCategoryData('productive'),
      createCategoryData('neutral'),
      createCategoryData('entertaining'),
      createCategoryData('distracting'),
    ],
    overallInsight: "You appear to be a developer who balances work and entertainment well. You spend significant time on productive coding platforms like GitHub and Stack Overflow, while enjoying entertainment content on YouTube and Netflix.",
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
};

export const EmptyCategories = {
  args: {
    categories: [
      { category: 'productive', domains: [] },
      { category: 'neutral', domains: [] },
      { category: 'entertaining', domains: [] },
      { category: 'distracting', domains: [] },
    ],
    messages: mockMessages,
    onAnalysisComplete: action('analysis-complete'),
  },
}; 