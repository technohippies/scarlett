import { defineConfig } from "wxt";
// import UnoCSS from 'unocss/vite'; // Remove manual UnoCSS import
import path from "node:path";
import { copyPgliteAssets } from './modules/pglite-assets'; // Import the new Vite plugin function

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Use the Solid module provided by WXT instead of manually adding plugins
  modules: [
    '@wxt-dev/module-solid',
    '@wxt-dev/unocss',
    // '@wxt-dev/auto-icons', // This was removed in your manual edit, keeping it removed unless told otherwise
  ],
  // The 'entrypoints' object is removed as it's not a valid top-level config property.
  // WXT auto-discovers entrypoints from the 'entrypoints/' directory.
  vite: () => ({ // Keep vite as a function
    plugins: [
      copyPgliteAssets() // Add the custom Vite plugin here
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Keep optimizeDeps if needed, PGlite usually requires this
    optimizeDeps: { 
      exclude: ['@electric-sql/pglite'],
    },
  }),
  manifest: {
    default_locale: "en", // Keep default locale
    // Add placeholders for localized name and description
    name: "__MSG_extName__",
    description: "__MSG_extDescription__", 
    background: {
      service_worker: "background.ts",
    },
    // Define the browser action (popup) (can be omitted if defined in entrypoints above)
    action: {
      default_popup: "popup.html", // Points to the entrypoint
      default_title: "Scarlett Supercoach"
    },
    permissions: [
      "storage",
      "tabs",
      "notifications",
      "scripting",
      "activeTab",
      "declarativeNetRequest",
      "declarativeNetRequestFeedback",
      "webNavigation",
      "contextMenus",
      "tts" // Added tts permission
    ],
    // --- Add Optional Host Permissions ---
    optional_host_permissions: [
      // Common local LLM endpoints
      "http://localhost:11434/*", // Ollama default
      "http://localhost:1234/*", // LM Studio default
      "http://localhost:8080/*", // Llama.cpp server default
      "http://127.0.0.1/*",     // Allow other loopback ports (Corrected pattern)
      // Add any other specific local endpoints you might support
    ],
    optional_permissions: [
      "history",
    ],
    // --- Add Chrome URL Overrides for New Tab --- 
    chrome_url_overrides: {
        "newtab": "newtab.html"
    },
    // --- End Chrome URL Overrides ---
    web_accessible_resources: [
      {
        matches: ["<all_urls>"],
        resources: [
            "pglite.wasm",
            "pglite.data",
            "vector.tar.gz"
        ],
      },
      {
        matches: ["<all_urls>"], // For VAD library assets
        resources: [
            "vad-assets/vad.worklet.bundle.min.js",
            "vad-assets/silero_vad_v5.onnx",
            "vad-assets/ort-wasm.wasm",
            "vad-assets/ort-wasm-simd.wasm",
            "vad-assets/ort-wasm-threaded.wasm",
            "vad-assets/ort-wasm-simd-threaded.wasm",
            "vad-assets/ort-wasm.js",
            "vad-assets/ort-wasm-simd.js",
            "vad-assets/ort-wasm-threaded.js",
            "vad-assets/ort-wasm-simd-threaded.js"
        ]
      },
      // Expose in-browser ONNX embedding model files (using correct directory name)
      {
        matches: ["<all_urls>"],
        resources: [
          "models/all-MiniLM-L6-v2/*"
        ]
      }
    ],
    // Add back other manifest sections like side_panel, action, commands if needed
    content_security_policy: { // Keep CSP for WASM
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';",
    },
  },
  webExt: { // Keep startUrls if desired for development
    startUrls: ["https://en.wikipedia.org/wiki/Love"],
  },
});
