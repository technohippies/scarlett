# Scarlett Supercoach - Browser Extension

[中文 (Chinese)](./README.zh.md)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
<!-- Add other badges later: build status, version, etc. -->

A browser extension designed to enhance language learning and productivity, featuring the AI assistant Scarlett Supercoach.

**Note:** This project is under active development.

## Features

*   **Vocabulary Learning:** Identify and translate words on web pages like Babel's Toucan.
*   **Flashcards:** Create and review flashcards using spaced repetition (SRS) powered by `ts-fsrs` for Anki-like scheduling.
*   **Web Clipping:** Clip text to generate flashcards and cloze (fill-in-blank) exercises with optional language translation.
*   **Bookmarking:** Bookmark with semantic embeddings that give your browser-based AI an understanding of your interests.
*   **Focus Mode:** Block distracting websites during study sessions and replace distracting sites (social media, etc.) with the flashcards you are learning.
*   **AI Integration:**
    *   Leverage Large Language Models (LLMs) for various tasks like flashcard generation, translation, and summarization.
    *   Integrates with local model providers like **Jan.ai**, **Ollama**, and **LM Studio**, allowing you to run and manage your preferred models.
    *   Supports flexible configuration, allowing you to mix and match different providers for LLM inference, embedding generation, Text-to-Speech (TTS), and text extraction (Reader).
    *   Utilizes **PGLite** (PostgreSQL in WASM) with `pgvector` support for efficient local AI functionality directly within the browser.

## Installation

### From Source

1.  Clone the repository:
    ```bash
    git clone https://github.com/technohippies/supercoach.git
    cd supercoach
    ```
2.  Install dependencies and build the extension:
    ```bash
    bun install
    bun run build
    ```
3.  Load the unpacked extension into your browser (Supports **Chrome/Edge** and **Firefox**. Safari support is TBD):
    *   **Chrome/Edge:** Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `supercoach/.output/chrome-mv3` directory.
    *   **Firefox:** Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select the `supercoach/.output/firefox-mv2/manifest.json` file.

### From Store (Coming Soon)

Links to Chrome Web Store, Firefox Add-ons, etc., will be added here once published.

## Usage

*(Instructions on how to use the core features will be added here soon.)*

## Development

For contributing or working on the extension locally:

1.  Clone the repository (if you haven't already):
    ```bash
    git clone https://github.com/technohippies/supercoach.git
    cd supercoach
    ```
2.  Install dependencies:
    ```bash
    bun install
    ```
3.  Start the development server:
    ```bash
    bun run dev
    ```

## Technology Stack

This extension leverages several key technologies:

*   **WXT:** Provides an excellent Developer Experience (DX) for building robust browser extensions.
*   **SolidJS:** Chosen for its high performance (~10KB runtime), fine-grained reactivity, and lack of a virtual DOM, resulting in a fast and responsive UI without browser lag.
*   **UnoCSS:** An atomic CSS engine offering significant performance advantages over alternatives like Tailwind CSS.
*   **PGLite:** Enables running PostgreSQL directly in the browser via WebAssembly, including `pgvector` support for local AI features.
*   **ts-fsrs:** Implements the FSRS spaced repetition algorithm for effective flashcard scheduling.
*   **Storybook:** Used extensively to develop, document, and test UI components in isolation, ensuring design consistency. 
*   **Local LLM Providers:** Special thanks to the teams behind **Jan.ai**, **Ollama**, and **LM Studio** for enabling powerful local AI capabilities.

## Licensing

This project utilizes a **dual-licensing** model:

1.  **Source Code:** The source code for this extension is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. The full text of this license can be found in the [LICENSE](./LICENSE) file in the root directory.

2.  **Character Assets:** All assets pertaining to the character **"Scarlett Supercoach"**, including images, likenesses, and potentially related descriptions located within the `public/images/scarlett-supercoach/` directory, are **explicitly excluded** from the AGPLv3 license. These assets are protected intellectual property registered on Story Protocol:
    [https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285](https://portal.story.foundation/assets/0xf30F18A457d90726ea1f7457242259fd7ec6F285)
    A commercial use license can be minted via the link above (cost: 42 $IP). The specific terms are detailed in the [public/images/scarlett-supercoach/LICENSE](./public/images/scarlett-supercoach/LICENSE) file.

**Important:** Use of the source code under the AGPLv3 license **does not** grant any rights to use the "Scarlett Supercoach" character assets found in `public/images/scarlett-supercoach/`. Any use of these assets must comply with the terms specified in their respective license file or obtained via Story Protocol.

## Contributing
