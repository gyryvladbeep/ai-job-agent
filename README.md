# AI Job Agent

A personal automation tool that scrapes multiple job boards and Telegram channels for QA/testing vacancies, filters out noise, deduplicates against a database, and pushes new matches straight to Telegram — so I don't have to manually refresh ten sites a day during a job search.

## What it does

1. **Collects** vacancies in parallel from 8 sources: Talanto, Telegram (public channels), Habr Career, GeekJob, ITA Jobs, Remote OK, Wellfound, We Work Remotely.
2. **Filters** results down to QA/testing-relevant roles using a bilingual (RU/EN) keyword matcher, with an exclusion list to keep out adjacent roles (developers, analysts, DevOps, etc.).
3. **Deduplicates** by URL.
4. **Checks Supabase** for vacancies already seen in previous runs.
5. **Saves** new vacancies to Supabase.
6. **Notifies** via a Telegram bot for every genuinely new match.

Runs on a schedule (`src/scheduler.js`, via `node-cron`): every day at **10:00, 15:00, and 20:00 Yerevan time (Asia/Yerevan)**. Keep `npm start` running as a long-lived process (pm2, a systemd service, or Windows Task Scheduler running it at login) and it triggers itself — no manual invocation needed.

Each source is isolated in its own try/catch — if one parser breaks (a site changes its markup), the rest of the pipeline keeps running.

## Tech stack

Node.js, Playwright (scraping), Supabase (Postgres, storage/dedup), `node-telegram-bot-api` (notifications), `telegram` (Telegram client for channel scraping), `dotenv`.

## Project structure

```
index.js               # entry point -> src/index.js
src/
  index.js              # pipeline orchestration (collect -> filter -> dedupe -> save -> notify)
  parsers/              # one file per source, each exports getXJobs()
  services/
    supabase.js          # DB reads/writes (jobExists, saveJobs, markAsNotified, markAsFailed)
    telegram.js           # sends a formatted Telegram message per new vacancy
  utils/
    qaFilter.js            # QA/testing keyword filter + exclusion list
    normalizeJob.js         # cleans scraped text (strips hashtags, trims whitespace, etc.)
    telegramNotifier.js
  test*.js                # manual per-source debug scripts (run individually, not an automated suite)
```

## Setup

```bash
npm install
cp .env.example .env   # fill in your own Supabase + Telegram credentials
npx playwright install  # first run only, downloads browser binaries
npm start               # starts the scheduler (10:00 / 15:00 / 20:00 Yerevan time)
npm run once            # or: run the pipeline a single time immediately, no scheduling
```

Required environment variables (see `.env.example`):

- `SUPABASE_URL`, `SUPABASE_KEY` — Supabase project credentials, used to store seen/new vacancies in a `vacancies` table.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — a bot (from [@BotFather](https://t.me/BotFather)) and the chat/channel it should post new vacancies to.

## Roadmap

- [ ] HeadHunter (hh.ru) parser — currently a stub, not implemented
- [ ] Indeed parser — disabled for now, Indeed's bot-verification flow blocks headless scraping (source code kept locally in `_legacy/`, not in this repo)
- [ ] LinkedIn — intentionally not scraped: LinkedIn actively detects and bans automation, not worth the account risk
- [ ] Scoring/ranking of matches (stack fit, salary, remote/relocation) instead of a flat keyword filter

## Status

Personal project, actively used during my own job search. Not intended as a general-purpose product — sharing it here mainly as a working example of end-to-end automation (scraping, data pipeline, notifications) built and run solo.
