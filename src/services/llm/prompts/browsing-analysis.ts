// src/services/llm/prompts/browsing-analysis.ts

export interface BrowsingCategoryData {
  name: string;
  siteCount: number;
  topSites: Array<{ domain: string; visits: number }>;
}

export interface BrowsingAnalysisData {
  totalSites: number;
  categories: BrowsingCategoryData[];
}

export function getBrowsingPatternAnalysisPrompt(browsingData: BrowsingAnalysisData): string {
  return `Analyze the following browsing patterns and provide insights about the user's digital habits:

Total sites visited: ${browsingData.totalSites}

Categories breakdown:
${browsingData.categories.map(cat => 
  `${cat.name}: ${cat.siteCount} sites${cat.topSites.length > 0 ? 
    ` (top sites: ${cat.topSites.map(s => `${s.domain} (${s.visits} visits)`).join(', ')})` : ''}`
).join('\n')}

IMPORTANT: Your response must be EXACTLY 2 sentences maximum. No more, no less.

Format your response as exactly 2 sentences:
1. One sentence summarizing their overall browsing patterns
2. One sentence with a specific insight or recommendation

Example format:
You spent most of your time on social media and entertainment sites. Consider using a private email like Proton instead of feeding your data to Google.

Please be concise and direct, do not say "this user", address them as "you". Do not include markdown, bullet points, or any formatting.`;
} 