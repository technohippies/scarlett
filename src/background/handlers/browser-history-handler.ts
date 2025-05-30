import { browser } from 'wxt/browser';

export interface HistoryDomain {
  domain: string;
  visitCount: number;
  category: string;
  lastVisit: number;
}

export interface CategorizedHistory {
  productive: HistoryDomain[];
  entertaining: HistoryDomain[];
  neutral: HistoryDomain[];
  distracting: HistoryDomain[];
}

// Domain categorization based on popular sites
const DOMAIN_CATEGORIES: Record<string, string> = {
  // Productive
  'github.com': 'productive',
  'stackoverflow.com': 'productive',
  'developer.mozilla.org': 'productive',
  'docs.google.com': 'productive',
  'linear.app': 'productive',
  'notion.so': 'productive',
  'figma.com': 'productive',
  'vercel.com': 'productive',
  'netlify.com': 'productive',
  'aws.amazon.com': 'productive',
  
  // Entertaining
  'youtube.com': 'entertaining',
  'netflix.com': 'entertaining',
  'twitch.tv': 'entertaining',
  'spotify.com': 'entertaining',
  'reddit.com': 'entertaining',
  'hulu.com': 'entertaining',
  'primevideo.com': 'entertaining',
  'disneyplus.com': 'entertaining',
  
  // Distracting
  'facebook.com': 'distracting',
  'instagram.com': 'distracting',
  'twitter.com': 'distracting',
  'x.com': 'distracting',
  'tiktok.com': 'distracting',
  'snapchat.com': 'distracting',
  'linkedin.com': 'distracting',
  
  // Neutral (defaults)
  'wikipedia.org': 'neutral',
  'amazon.com': 'neutral',
  'google.com': 'neutral',
  'bing.com': 'neutral',
  'weather.com': 'neutral',
  'maps.google.com': 'neutral',
  'news.google.com': 'neutral',
};

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Filter out non-website URLs
    if (urlObj.protocol === 'chrome-extension:' || 
        urlObj.protocol === 'moz-extension:' || 
        urlObj.protocol === 'file:' || 
        urlObj.protocol === 'about:' ||
        urlObj.protocol === 'chrome:' ||
        urlObj.protocol === 'edge:' ||
        urlObj.protocol === 'safari:' ||
        urlObj.hostname === 'localhost' ||
        urlObj.hostname === '127.0.0.1' ||
        urlObj.hostname.endsWith('.local')) {
      return '';
    }
    
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function categorizeDomain(domain: string): string {
  // Direct match
  if (DOMAIN_CATEGORIES[domain]) {
    return DOMAIN_CATEGORIES[domain];
  }
  
  // Check for subdomain matches
  for (const [knownDomain, category] of Object.entries(DOMAIN_CATEGORIES)) {
    if (domain.endsWith('.' + knownDomain) || domain === knownDomain) {
      return category;
    }
  }
  
  // Default to neutral
  return 'neutral';
}

export async function fetchBrowserHistory(daysBack: number = 30): Promise<CategorizedHistory> {
  try {
    // Check if we have history permission
    const hasPermission = await browser.permissions.contains({
      permissions: ['history']
    });
    
    if (!hasPermission) {
      throw new Error('History permission not granted');
    }

    // Calculate time range (last 30 days)
    const endTime = Date.now();
    const startTime = endTime - (daysBack * 24 * 60 * 60 * 1000);

    // Fetch history items
    const historyItems = await browser.history.search({
      text: '',
      startTime,
      endTime,
      maxResults: 10000 // Get plenty of results
    });

    // Process and categorize domains
    const domainVisits: Record<string, { count: number; lastVisit: number; category: string }> = {};

    for (const item of historyItems) {
      if (!item.url) continue;
      
      const domain = extractDomain(item.url);
      if (!domain) continue;

      const category = categorizeDomain(domain);
      const lastVisit = item.lastVisitTime || 0;

      if (!domainVisits[domain]) {
        domainVisits[domain] = {
          count: 0,
          lastVisit,
          category
        };
      }

      domainVisits[domain].count += item.visitCount || 1;
      domainVisits[domain].lastVisit = Math.max(domainVisits[domain].lastVisit, lastVisit);
    }

    // Convert to categorized arrays and sort by visit count
    const categorized: CategorizedHistory = {
      productive: [],
      entertaining: [],
      neutral: [],
      distracting: []
    };

    for (const [domain, data] of Object.entries(domainVisits)) {
      const historyDomain: HistoryDomain = {
        domain,
        visitCount: data.count,
        category: data.category,
        lastVisit: data.lastVisit
      };

      categorized[data.category as keyof CategorizedHistory].push(historyDomain);
    }

    // Sort each category by visit count (descending)
    for (const category of Object.keys(categorized) as Array<keyof CategorizedHistory>) {
      categorized[category].sort((a, b) => b.visitCount - a.visitCount);
    }

    console.log('[Browser History] Successfully categorized history:', {
      productive: categorized.productive.length,
      entertaining: categorized.entertaining.length,
      neutral: categorized.neutral.length,
      distracting: categorized.distracting.length
    });

    return categorized;

  } catch (error) {
    console.error('[Browser History] Failed to fetch history:', error);
    throw error;
  }
}

export async function requestHistoryPermission(): Promise<boolean> {
  try {
    const granted = await browser.permissions.request({
      permissions: ['history']
    });
    console.log('[Browser History] Permission request result:', granted);
    return granted;
  } catch (error) {
    console.error('[Browser History] Permission request failed:', error);
    return false;
  }
} 