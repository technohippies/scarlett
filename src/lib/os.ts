// Define an interface extending Navigator to include the experimental userAgentData
interface NavigatorWithUAData extends Navigator {
  userAgentData?: {
    platform: string;
    // Potentially add other userAgentData properties if needed in the future
    // brands?: Array<{ brand: string; version: string }>;
    // mobile?: boolean;
  };
}

export type OperatingSystem = 'linux' | 'macos' | 'windows' | 'unknown';

/**
 * Detects the current operating system.
 * Prefers `navigator.userAgentData` if available, otherwise falls back to `navigator.platform`.
 * 
 * @returns The detected operating system ('linux', 'macos', 'windows', 'unknown').
 */
export function getOS(): OperatingSystem {
  const nav = navigator as NavigatorWithUAData;

  // Modern approach: User-Agent Client Hints API
  if (nav.userAgentData && nav.userAgentData.platform) {
    const platform = nav.userAgentData.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux'; 
    // Add other specific checks if needed (e.g., 'android', 'ios')
  }

  // Fallback: navigator.platform (less reliable, might be deprecated)
  if (nav.platform) { // Use the typed nav here too
    const platform = nav.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos'; // Covers 'MacIntel', 'MacPPC', etc.
    if (platform.includes('linux')) return 'linux';
  }

  return 'unknown'; // Fallback if detection fails
}

// Helper function to get OS
export const getOperatingSystem = (): 'windows' | 'macos' | 'linux' | 'unknown' => {
  // Ensure running in a browser environment
  if (typeof navigator === 'undefined') {
    console.warn("[getOperatingSystem] Cannot detect OS: 'navigator' is undefined.");
    return 'unknown'; 
  }

  const platform = navigator.platform?.toLowerCase() || '';
  const userAgent = navigator.userAgent?.toLowerCase() || '';
  const brands = (navigator as any).userAgentData?.brands; // Use 'any' for broader compatibility

  // --- More Reliable Method: User-Agent Client Hints (if available) ---
  if ((navigator as any).userAgentData?.platform) {
    const platformData = (navigator as any).userAgentData.platform.toLowerCase();
    console.debug(`[getOperatingSystem] Detected via userAgentData.platform: ${platformData}`);
    if (platformData.includes('win')) return 'windows';
    if (platformData.includes('mac')) return 'macos';
    if (platformData.includes('linux')) return 'linux';
    // Add other OS checks here if needed (e.g., 'android', 'ios')
  } else {
     console.debug("[getOperatingSystem] 'navigator.userAgentData.platform' not available.");
  }

  // --- Fallback Methods ---

  // Check common platform strings
  if (platform.startsWith('win')) return 'windows';
  if (platform.startsWith('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';

  // Check userAgent strings (less reliable but common)
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os x')) return 'macos';
  if (userAgent.includes('linux')) return 'linux';
   // Check for specific browser brands that might indicate OS (less common for desktop)
  if (Array.isArray(brands)) {
      if (brands.some(b => b.brand.toLowerCase().includes('edge'))) {
          // Check userAgent/platform again for Windows as Edge runs elsewhere
          if (userAgent.includes('win') || platform.startsWith('win')) return 'windows';
      }
      // Add more brand-specific checks if necessary
  }


  console.warn(`[getOperatingSystem] OS detection fallback used. Platform: '${platform}', UserAgent: '${userAgent.substring(0, 50)}...'`);
  // Final fallback based on less specific platform checks
  if (platform.includes('win')) return 'windows'; // broader check
  if (platform.includes('mac')) return 'macos'; // broader check


  console.warn('[getOperatingSystem] Could not reliably determine OS.');
  return 'unknown';
}; 