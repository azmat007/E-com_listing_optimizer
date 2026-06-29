# AI Listing Optimizer

Generate platform-ready product listings for Amazon, Noon, Carrefour and MicroLess using Groq AI.

## Features

- Multi-platform listing generation: Amazon, Noon, Carrefour, MicroLess
- Rich outputs: title, bullets, description
- AI image generation via Pollinations.ai
- Fee-aware recommended prices per platform
- Local SQLite history with CSV / JSON / HTML export
- Copy-friendly UI for quick edits

## Run

Clone the repo and install dependencies:
```bash
git clone https://github.com/azmat007/E-com_listing_optimizer.git
cd E-com_listing_optimizer
npm install
```

Start the app:
```bash
npm run dev
```
Then open `http://localhost:3000`

Build for production:
```bash
npm run build
npm run start
```

## Environment

Set `GROQ_API_KEY` in `.env` for AI generation.
