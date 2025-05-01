import { defineConfig } from "wxt";
// import UnoCSS from 'unocss/vite'; // Remove manual UnoCSS import
import path from "node:path";
// import { copyPgliteAssets } from './modules/pglite-assets'; // Import the new Vite plugin function

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Use the Solid module provided by WXT instead of manually adding plugins
  modules: [
    '@wxt-dev/module-solid',
    '@wxt-dev/unocss', // Add this
  ],
  vite: () => ({ // Keep vite as a function
    plugins: [
      // Remove manual UnoCSS plugin
      // UnoCSS() as any, 
      // copyPgliteAssets() // Add the custom Vite plugin here
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
      default_icon: { // Define the icon sizes here
        16: "/icon/16.png",
        32: "/icon/32.png",
        48: "/icon/48.png",
        128: "/icon/128.png"
      },
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
      "contextMenus"
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
    web_accessible_resources: [
      {
        matches: ["<all_urls>"], // Or restrict further if needed
        resources: [
            "postgres.wasm",
            "postgres.data",
            "vector.tar.gz", // Ensure this is copied correctly by the plugin
            "blockpage.html",
            "content-scripts/content.css",
            "assets/uno-bundle.css"
        ],
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
