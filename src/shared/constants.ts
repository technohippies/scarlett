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
    'YouTube Music',
    'Medium',
    'Bluesky',
    'Pixiv',
    'Soundcloud',
    'Genius',
];

// Placeholder mapping of services to their known alternative frontend instances
export const REDIRECT_INSTANCE_LISTS: Readonly<Record<string, readonly string[]>> = {
    Reddit: [
        'libreddit.kavin.rocks', 
        'libreddit.strongthany.cc',
        'reddit.invak.id',
    ],
    Medium: [
        'scribe.rip',
        'medium.hostux.net',
    ],
    'X (Twitter)': [
        'nitter.net',
        'nitter.it',
        'nitter.privacydev.net',
    ],
    YouTube: [
        'yewtu.be',
        'invidious.kavin.rocks',
        'vid.puffyan.us',
    ],
    'YouTube Music': [],
    Imgur: [
        'rimgo.kavin.rocks',
        'i.bcow.xyz',
    ],
    // Default list if a service is not explicitly listed (can be empty)
    Default: [],
    // Add lists for other services here
    GitHub: [], 
    ChatGPT: [],
    Twitch: [],
    Bluesky: [],
    Pixiv: [],
    Soundcloud: [],
    Genius: [],
}; 