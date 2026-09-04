# AI Job Agent

A personal automation tool that scrapes multiple job boards and Telegram channels for QA/testing vacancies, filters out noise, deduplicates against a database, and pushes new matches straight to Telegram — so I don't have to manually refresh ten sites a day during a job search.

## What it does

1. **Collects** vacancies from 9 sources: Talanto, Telegram (12 verified public channels), Habr Career, GeekJob, ITA Jobs, Remote OK, Wellfound, We Work Remotely, Working Nomads.
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
  index.js              # pipeline orchestration: SOURCES list -> collect -> filter -> dedupe -> save -> notify
  debugNewSources.js     # standalone test for sources still being tuned (no Supabase/Telegram side effects)
  parsers/              # one file per source, each exports getXJobs()
  services/
    supabase.js          # DB reads/writes (jobExists, saveJobs, markAsNotified, markAsFailed)
    telegram.js           # sends a formatted Telegram message per new vacancy
    runLog.js              # writes logs/last-run.json + logs/run-history.log after every run
  utils/
    qaFilter.js            # QA/testing keyword filter + exclusion list (applied globally, after collection)
  test*.js                # manual per-source debug scripts (run individually, not an automated suite)
logs/                    # last-run.json (most recent run) + run-history.log (one line per run), gitignored
```

Every run — scheduled or manual — writes a summary to `logs/last-run.json`: per-source raw counts, how many survived the QA filter, dedup counts, saved/notified counts, and where it stopped if it stopped early. Useful for spotting a source going quiet without needing to have watched the terminal when it ran.

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

- [ ] Glassdoor / Monster — considered, not added yet: Glassdoor blocks unauthenticated/automated access hard (heavy bot protection, frequent CAPTCHAs) and is likely to end up like Indeed; Monster's listings render via client-side JS that needs a live Playwright check before committing selectors. Low priority given the effort/payoff so far.
- [x] ~~FlexJobs~~ — added, then dropped: headless Playwright got served a completely blank page (empty `<body>`), same bot-block class as Indeed/Glassdoor. Source kept in `_legacy/flexJobs.disabled.js` in case FlexJobs' block behaves differently later.
- [ ] ~~HeadHunter (hh.ru) parser~~ — decided against, not worth the source quality for this search (stub kept in `_legacy/`)
- [ ] Indeed parser — disabled for now, Indeed's bot-verification flow blocks headless scraping (source code kept locally in `_legacy/`, not in this repo)
- [ ] LinkedIn — intentionally not scraped: LinkedIn actively detects and bans automation, not worth the account risk
- [ ] Scoring/ranking of matches (stack fit, salary, remote/relocation) instead of a flat keyword filter

### Fixed 2026-09-04 (low yield investigation)

Prompted by "too few vacancies arriving" — turned out to be several independent bugs, not one:

- **We Work Remotely** was searching its own site for the literal term `QA`, which returns *zero* results on weworkremotely.com itself (confirmed directly against the site). Switched to searching several broader terms (`QA`, `Test Engineer`, `Quality Assurance`, `SDET`) and merging the results; the shared QA filter still runs on top, so this can't let junk through.
- **Working Nomads** selectors were guessed ahead of time and didn't match the real markup (cards are `a.job-desktop` elements, not wrapped `<li>`s). Fixed against the actual page HTML.
- **FlexJobs** turned out to be a hard bot-block (blank page in headless Playwright) — dropped, see above.
- **Telegram channel list** had grown to 23 usernames, 11 of which were guessed and don't exist (verified each one individually) — every run was opening 11 dead pages for nothing. Trimmed to the 12 verified real channels.
- **Telegram history depth**: the parser only ever read whatever rendered on initial page load (~20 messages) despite a `MESSAGES_PER_CHANNEL = 200` setting that was never actually wired to anything. Added a scroll-and-wait loop so it actually reads back through more history per channel.
- Removed dead code that wasn't wired into the pipeline at all: `normalizeJob.js`, `telegramNotifier.js` (referenced a package — `axios` — not even in `package.json`, so it would've crashed if anything had called it), and the older single-channel Telegram parsers (`telegramQaChillout.js`, `telegramQaJobs.js`) superseded by the unified `telegramWeb.js`. All moved to `_legacy/`.

## Status

Personal project, actively used during my own job search. Not intended as a general-purpose product — sharing it here mainly as a working example of end-to-end automation (scraping, data pipeline, notifications) built and run solo.
