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

Format your response as:
1. One concise summary sentence about their overall browsing patterns
2. 2 bullet points with short specific insights or recommendations

Example format:
Wow, you spent a lot of time on social media! 
• Consider a private search engine! Stop feeding your data to Baidu!
• Use a private email like Proton, stop using Gmail.
• Try ddocs.new instead of Google Docs - private, encrypted, works offline.
• You don't seem to be using a VPN, try Sentinel.co dVPN to circumvent censorship. 

Please be concise and direct. Do not include markdown.`;
} 