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

# honc-phala-server

## Overview
A fully gated AI Q&A service on Cloudflare Workers, combining token-based authentication, per-user quota management, retrieval-augmented generation (RAG), and Venice.ai integration. Users purchase API tokens via your website/Farcaster Frame, then use those tokens to make AI requests through the extension.

## Architecture Flow

### 1. Token Purchase Flow (Website/Farcaster Frame)
```
User → Website/Frame → Wallet Connection → Token Purchase → API Key Generation → Extension Storage
```

### 2. API Request Flow (Chrome Extension)
```
Extension → API Request (with API key) → Auth Check → Quota Check → RAG Search → Venice.ai → Response
```

### 3. Authentication & Authorization
- **Authentication**: API key-based (no wallet required in extension)
- **Authorization**: Token balance verification per request
- **Quota Management**: Per-user token deduction via Durable Objects

## Table of Contents
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Implementation Plan](#implementation-plan)
- [Testing](#testing)
- [Deployment](#deployment)

## Project Structure
```
.
├── README.md               # Project overview and rollout plan
├── wrangler.jsonc          # Cloudflare Worker configuration & bindings (NOT .toml)
├── package.json            # npm dependencies & scripts
├── tsconfig.json           # TypeScript configuration
├── .env.sample             # Sample environment variables
├── src/
│   ├── index.ts            # Hono app entrypoint & middleware setup
│   ├── routes/             # HTTP route handlers
│   │   ├── ask.ts          # POST /ask → RAG + Venice.ai
│   │   ├── history.ts      # GET /history → user conversation history
│   │   ├── quota.ts        # GET /quota → token balance & usage
│   │   └── purchase.ts     # POST /purchase → handle token purchases
│   ├── durable/
│   │   └── UserSession.ts  # Durable Object for per-user quotas & history
│   ├── workflows/          # Cloudflare Workflows for complex operations
│   │   └── TokenPurchase.ts # Handle payment verification & token allocation
│   └── lib/                # Helper modules
│       ├── auth.ts         # API key verification & user lookup
│       ├── rag.ts          # RAG logic (Workers AI & Vectorize)
│       ├── venice.ts       # Venice.ai client
│       └── database.ts     # D1 database operations
├── migrations/             # D1 database migrations
│   └── 0001_initial.sql    # User accounts & token balances
├── scripts/
│   └── ingest-data.ts      # Data chunking & embedding script
└── tests/                  # Unit & integration tests
    ├── ask.spec.ts
    ├── durable.spec.ts
    └── auth.spec.ts
```

## Prerequisites
- Node.js >=18
- npm or pnpm
- Wrangler CLI (`npm install -g wrangler`)
- A Cloudflare account with:
  - Workers & Durable Objects enabled
  - D1 database
  - Vectorize index
  - Workers AI access
- Environment variables (set via Wrangler secrets):
  - `VENICE_API_KEY`
  - `JWT_SECRET` (for API key signing)


## Database Schema
```sql
-- User accounts with API keys and token balances
CREATE TABLE user_accounts (
  id INTEGER PRIMARY KEY,
  wallet_address TEXT UNIQUE,
  api_key TEXT UNIQUE NOT NULL,
  token_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY,
  api_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key) REFERENCES user_accounts(api_key)
);
```

## Implementation Plan
_Build incrementally and test after each major step._

### Step 1: Scaffold Worker & Basic Routes
- Initialize Hono app in `src/index.ts`.
- Add health-check route (`GET /ping → 200 OK`).
- Configure `wrangler.jsonc` with proper bindings.
- Test locally with `wrangler dev` and `curl`.

### Step 2: Database Setup
- Create D1 database and configure binding.
- Write migration scripts for user accounts and usage tracking.
- Implement basic database operations in `lib/database.ts`.

### Step 3: API Key Authentication
- Implement API key generation and verification in `lib/auth.ts`.
- Add auth middleware to protect routes.
- Create `/purchase` endpoint for token purchases.
- Test with valid/invalid API keys.

### Step 4: Durable Object for User State
- Create `src/durable/UserSession.ts` for real-time quota tracking.
- Implement token deduction and usage history.
- Bind DO in `wrangler.jsonc`.
- Write tests for quota enforcement.

### Step 5: RAG Implementation
- Set up Vectorize index for document embeddings.
- Develop `scripts/ingest-data.ts` for data ingestion.
- Implement RAG search in `lib/rag.ts` using Workers AI.

### Step 6: Venice.ai Integration
- Implement Venice.ai client in `lib/venice.ts`.
- Handle API rate limiting and error responses.
- Add response streaming if needed.

### Step 7: Core `/ask` Endpoint
- In `src/routes/ask.ts`:
  1. Authenticate API key
  2. Check token balance via Durable Object
  3. Perform RAG search
  4. Call Venice.ai with context
  5. Deduct tokens and log usage
  6. Return response

### Step 8: User Management Endpoints
- Implement `/quota` for balance checking.
- Implement `/history` for conversation history.
- Add `/purchase` for token top-ups.

### Step 9: Workflows for Complex Operations
- Use Cloudflare Workflows for payment processing.
- Handle retries and error recovery.
- Implement email notifications for purchases.

### Step 10: Testing & Deployment
- Write comprehensive tests for all endpoints.
- Set up CI/CD pipeline.
- Deploy to Cloudflare Workers.

## Configuration Example

### wrangler.jsonc
```jsonc
{
  "name": "honc-phala-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "vars": {
    "ENVIRONMENT": "production"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "honc-database",
      "database_id": "your-database-id"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "USER_SESSION",
        "class_name": "UserSession"
      }
    ]
  },
  "vectorize": [
    {
      "binding": "VECTORIZE_INDEX",
      "index_name": "honc-docs"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "workflows": [
    {
      "binding": "TOKEN_PURCHASE_WORKFLOW",
      "name": "token-purchase",
      "class_name": "TokenPurchaseWorkflow"
    }
  ]
}
```

## API Endpoints

### Authentication Required
All endpoints except `/ping` require `Authorization: Bearer <api_key>` header.

### Endpoints
- `GET /ping` - Health check
- `POST /ask` - Submit question for AI processing
- `GET /quota` - Check token balance and usage
- `GET /history` - Retrieve conversation history
- `POST /purchase` - Purchase additional tokens (webhook from payment processor)

## Testing
```bash
# Run all tests
npm test

# Test specific endpoint
curl -X POST http://localhost:8787/ask \
  -H "Authorization: Bearer sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Cloudflare Workers?"}'
```

## Deployment
```bash
# Set secrets
npx wrangler secret put VENICE_API_KEY
npx wrangler secret put JWT_SECRET

# Deploy
npx wrangler deploy

# Check logs
npx wrangler tail
```

## Token Economics
- Users purchase token bundles on your website/Farcaster Frame
- Each API request deducts tokens based on:
  - Base cost per request
  - Additional cost per token generated by Venice.ai
- Real-time balance tracking via Durable Objects
- Usage analytics stored in D1 database

## Security Considerations
- API keys are JWT-signed and include user identification
- Rate limiting per API key via Durable Objects
- Input validation and sanitization
- Secure secret management via Wrangler secrets
- CORS configuration for extension requests

> This architecture provides a scalable, cost-effective way to monetize AI services while maintaining excellent UX for Chrome extension users!
