# LinguaLearn AI – Breaking Language Barriers in Education

Production‑ready Next.js app to translate, listen, and practice study material using Hugging Face Inference API.

## Quick start

1) Install deps

```
npm install
```

2) Create .env.local

```
HUGGING_FACE_API_KEY=xxxxx
# Optional tuning
DAILY_REQUEST_LIMIT=200
MAX_UPLOAD_SIZE_MB=5
CHUNK_CHAR_LIMIT=3000
# Optional Redis for shared rate limiting/cache
REDIS_URL=redis://default:<password>@<host>:<port>
```

3) Run dev server

```
npm run dev
```

Open http://localhost:3000 and click "Open App".

## Features

- Workspace (/app)
  - Paste or upload notes (.txt, .md, .docx, .pdf)
  - Target language selector
  - Translate, Listen (TTS), Practice (quiz), History tabs
  - Save/Copy/Clear with toast notifications
- Hugging Face AI models
  - Translation: facebook/m2m100_418M
  - Text‑to‑Speech: facebook/mms-tts (MP3)
  - Quiz: google/flan-t5-large
- Production protections
  - Daily rate limiting (per user or per IP)
  - Robust chunking for long texts, preserving formatting
  - Safe file parsing (.docx via mammoth, .pdf via pdf-parse)
  - Caching + retries for HF calls (LRU in‑memory; optional Redis)
- Accessibility and polished UI with Tailwind + shadcn/ui

## Environment variables

- HUGGING_FACE_API_KEY (required) – single key used for all HF calls
- DAILY_REQUEST_LIMIT (optional, default 200) – per‑identifier per day
- MAX_UPLOAD_SIZE_MB (optional, default 5) – max upload size for /api/translate multipart
- CHUNK_CHAR_LIMIT (optional, default 3000) – chunk size in characters
- REDIS_URL (optional) – enables shared rate limiting + cache; otherwise in‑memory fallback

See .env.example for a template.

## API Endpoints

- POST /api/translate
  - Body: JSON { text, target | targetLang } or multipart/form‑data with fields:
    - file (.txt/.md/.docx/.pdf) and target/targetLang, or
    - text and target/targetLang
  - Behavior: server‑side chunking (paragraph/sentence), serial translation with m2m100, reassembly with separators
  - Response: { translation, translated, warnings?: string[], chunks: number }
  - Errors: 400 (validation), 413 (file too large), 429 (daily limit), 500

- POST /api/tts
  - Body: { text, lang | targetLang | target }
  - Behavior: calls mms‑tts with Accept: audio/mpeg
  - Response: { audio: base64Mp3, audioBase64: base64Mp3, mime: "audio/mpeg" }
  - Note: If HF fails, returns 500 with error; frontend falls back to browser TTS

- POST /api/quiz
  - Body: { text, targetLang | target | lang, difficulty? }
  - Behavior: prompts flan‑t5‑large to return a JSON array of exactly 4 MCQs; robust JSON extraction
  - Response: { questions: [...], quiz: { mcq: [...], short: [...] } }

## Rate limiting

- Daily per identifier (user id if available via x-user-id header, else IP from x-forwarded-for)
- Key format: rate:{identifier}:{YYYY-MM-DD}
- Returns 429 with message: "Daily request limit reached. Try again tomorrow."
- Uses Redis if REDIS_URL is set; otherwise in‑memory fixed window

## Chunking

- Splits by blank‑line paragraphs, then sentences, avoiding mid‑word cuts
- Limit configurable via CHUNK_CHAR_LIMIT (default 3000 chars)
- Preserves layout by rejoining with \n\n between chunks

## File uploads

- Supported: .txt, .md (treated as text), .docx (mammoth), .pdf (pdf-parse)
- Max size: MAX_UPLOAD_SIZE_MB (default 5MB). Exceeding returns 413

## Caching + retry

- In‑memory LRU cache (ttl 6h) for HF calls
- Exponential backoff retry for 429/5xx up to 3 attempts
- Optional Redis for shared counters and cache (no hard requirement)

## Frontend integration

- Client helpers (src/lib/api.ts)
  - translateText(text, targetLang)
  - ttsSynthesize(text, targetLang)
  - generateQuiz(text, targetLang)
- Workspace (/app) shows toasts and supports history via localStorage

## Testing

- Vitest setup

```
npm run test
# watch
npm run test:watch
```

Included sample tests:
- src/tests/chunk.test.ts – chunking behavior
- src/tests/rate-limit.test.ts – daily limiter basics
- src/tests/hf.test.ts – HF client caching, audio handling, retry

## Security notes

- Never log API keys or full user content
- Validate inputs and enforce limits
- Do not expose HUGGING_FACE_API_KEY to the client; all HF calls are server‑side

## Deployment

- Vercel ready. Set environment variables in project settings
- If using Redis, set REDIS_URL in the environment

## License

MIT