/**
 * @fileoverview Shared constants used across the application.
 */

// Updated list of services that support redirects in the desired order
export const REDIRECT_SERVICES: readonly string[] = [
    'GitHub',
    'ChatGPT',
    'X (Twitter)',
    'Reddit',
    'Twitch',
    'YouTube',
    'Medium',
    'Bluesky',
    'Pixiv',
    'Genius',
];

// NEW: Define default instances for redirects
export const DEFAULT_REDIRECT_INSTANCES: Readonly<Record<string, string>> = {
    "github": 'https://gothub.ducks.party/',
    "chatgpt": 'https://duck.ai',
    "x (twitter)": 'https://xcancel.com',
    "reddit": 'https://redlib.privacyredirect.com/',
    "twitch": 'https://safetwitch.projectsegfau.lt/',
    "youtube": 'https://invidious.adminforge.de/',
    "medium": 'https://scribe.rip',
    "bluesky": 'https://skyview.social/',
    "pixiv": 'https://pixivfe.ducks.party/',
    "genius": 'https://dm.vern.cc/',
    // Ensure all services from REDIRECT_SERVICES are covered, even if with an empty string
}; 