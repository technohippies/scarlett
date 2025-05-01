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