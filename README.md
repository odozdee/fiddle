# Fiddle

A violin practice app. Upload sheet music for page-by-page practice tips, or compare a recording of your playing with a YouTube reference.

## Features

- PDF previews with practice tips beside each page
- Cancel tip generation, finish early, or resume the remaining pages
- Recording comparison for pacing and pitch patterns, with violin lessons shown alongside the feedback
- Supabase accounts and saved sessions for scores, tips, recordings, and feedback

Recording comparison works without a PDF. Scores can be up to 15 MB, and recordings must be between 2 and 60 seconds.

## How it works

PyMuPDF renders the PDF pages. Audiveris recognizes the notation and exports MusicXML, which music21 parses into notes, rhythms, and measures. The Claude API uses that data and the original page image to generate practice tips.

For recordings, yt-dlp and FFmpeg retrieve the selected YouTube excerpt. librosa aligns the recordings and compares their duration and pitch patterns.

The frontend uses Next.js and React. The backend uses Python and FastAPI. Supabase handles authentication, database records, and private file storage.

## Run locally

Use Ubuntu or WSL with Python 3.12, Node.js LTS, FFmpeg, and Audiveris with its required Java runtime. The backend currently expects Audiveris at `/opt/audiveris/bin/Audiveris`. Change `AUDIVERIS` in `backend/score_processor.py` if it is installed elsewhere.

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm ci
```

Create a root `.env` file:

```dotenv
ANTHROPIC_API_KEY=your_claude_api_key
```

Create a root `.env.local` file for Supabase:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

In Supabase, enable email authentication and set the Site URL to `http://localhost:3000`. Add `/account` and `/reset-password` on that host to the allowed redirect URLs.

Saved history requires the `practice_sessions`, `practice_pages`, and `practice_recordings` tables, plus a private `fiddle-practice` Storage bucket. Configure row-level security so each user can access their own records and files.

Start the backend:

```bash
source .venv/bin/activate
python -m uvicorn backend.main:app --reload
```

In a second terminal, start the frontend from the repository root:

```bash
npm run dev
```

Open http://localhost:3000. The backend runs at http://127.0.0.1:8000.

Keep `.env` and `.env.local` out of Git. Use the Supabase publishable key in the frontend.
