# AI Job Agent

A personal automation tool that scrapes multiple job boards and Telegram channels for QA/testing vacancies, filters out noise, deduplicates against a database, and pushes new matches straight to Telegram — so I don't have to manually refresh ten sites a day during a job search.

## What it does

1. **Collects** vacancies from 10 sources: Talanto, Telegram (12 verified public channels), Habr Career, GeekJob, ITA Jobs, Remote OK, Wellfound, Working Nomads, Ministry of Testing, and direct company career boards (Elastic, MongoDB, Twilio, Grafana Labs, GitLab, SmartBear, Canonical, Confluent, Zapier via their public Greenhouse/Ashby APIs).
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
- [x] ~~We Work Remotely~~ — added, then dropped 2026-09-07: started serving a Cloudflare "Performing security verification" challenge page to headless Playwright (it didn't do this when the source was first added days earlier — bot protection was switched on in between). Same class of block as Indeed/Glassdoor/FlexJobs. Source kept in `_legacy/weWorkRemotely.disabled.js`.
- [x] ~~Himalayas~~ — added 2026-09-07, dropped 2026-09-09: every single automated run hit a Cloudflare "Performing security verification" challenge page (confirmed via debug HTML/screenshot on multiple separate runs, not a one-off) — same class of block as WWR/FlexJobs/Indeed/Glassdoor. A manual browser session clears the challenge after a few seconds (real browser fingerprint), but plain headless Playwright does not, and I'm not building a stealth-browser bypass for it. Source kept in `_legacy/himalayas.disabled.js`.
- [ ] ~~HeadHunter (hh.ru) parser~~ — decided against, not worth the source quality for this search (stub kept in `_legacy/`)
- [ ] Indeed parser — disabled for now, Indeed's bot-verification flow blocks headless scraping (source code kept locally in `_legacy/`, not in this repo)
- [ ] LinkedIn — intentionally not scraped: LinkedIn actively detects and bans automation, not worth the account risk
- [ ] Scoring/ranking of matches (stack fit, salary, remote/relocation) instead of a flat keyword filter
- [ ] GeekJob — couldn't find a working QA-specific search/category URL (`?qs=QA` and `/vacancies/qa` both dead ends); currently pages through the general `/vacancies` firehose instead. Revisit if GeekJob's actual search UI reveals the real query param.

### Added 2026-09-18 (5 approved improvements from a 10-idea brainstorm)

User picked 5 of 10 proposed improvements, with explicit scoping comments on two of them -- implemented exactly as scoped, nothing broader:

- **Direct company career-page monitoring** (new source, 10th): added `src/parsers/companyBoards.js`, querying 9 companies' own public ATS APIs directly (Greenhouse: Elastic, MongoDB, Twilio, Grafana Labs, GitLab, SmartBear, Canonical; Ashby: Confluent, Zapier) -- plain `fetch` + JSON, no Playwright/browser needed at all for these, since both ATS platforms expose stable public JSON endpoints. Every slug verified individually against the real API before being added (a few guesses 404'd and were dropped: HashiCorp, Postman, Doist on both platforms, Atlassian). This is the "hidden job market" tactic discussed in coaching -- bypasses aggregator noise and ATS keyword-matching entirely.
- **Telegram inline-button status tracking**: each notification now carries "Applied / Skipped / Interview" buttons. `src/services/telegramListener.js` runs inside the existing `scheduler.js` process (no second process to keep alive) with its own polling bot instance (separate from the send-only one in `telegram.js` -- two Telegram clients on one token only conflict if both poll, and only the listener does), writes the chosen status to Supabase via a new `setVacancyStatus()`, and edits the message to remove the buttons and show what was recorded. This is the first real application-funnel data (applied -> interview) the whole campaign has had.
- **Dead/expired vacancy check before notifying**: `src/utils/isVacancyLive.js` does a best-effort fetch + closed-posting-phrase check (RU+EN) right before sending each notification. Fail-open by design: any check failure (timeout, block, network) is treated as "still live" -- this can only suppress a real dead link, never block a genuine new posting. Vacancies caught this way are saved with a new `expired` status via `markAsExpired()` rather than being silently dropped.
- **Relocation/visa signal tag** -- explicitly scoped by the user as "a postscript, don't disrupt the main flow": `src/utils/relocationTag.js` only appends a line to the notification when a real signal is found in the title/description (RU+EN keyword list), never a "no relocation" line on the other 95% of vacancies, and doesn't touch the QA filter, scoring, or dedupe.
- **Recruiter LinkedIn-search link** -- also explicitly scoped as a postscript: `src/utils/recruiterSearchLink.js` appends a ready-made LinkedIn people-search URL (company + "QA recruiter") to every notification. Pure URL templating, no LinkedIn automation/scraping of any kind -- the user opens it himself from his phone, since his laptop's IP is blocked on LinkedIn from an earlier login from Russia.

Declined and intentionally not built: match-scoring against the resume (user's call -- volume matters more than ranking for him right now), LinkedIn email-alert ingestion (his LinkedIn access itself is constrained, not worth the added complexity), description-level QA filtering, a weekly digest, and auto-drafted cover-letter openers.

### Fixed 2026-09-18 (deep health check -- 9 days of run history reviewed)

Prompted by "the bot still collects too few vacancies" -- this time went through 9 days of `logs/run-history.log` (09-09 through 09-18) instead of a single run, to see the actual pattern rather than one data point:

- **Confirmed the 09-09 Working Nomads fix is real and holding**: 51 raw jobs collected every single run since, vs. 0 before.
- **Wellfound was silently 100% dead for the entire 9-day window**: 45-51 "collected" every day, 0 new every single day. Root cause: `?query=QA%20Engineer` on `/jobs` doesn't filter anything -- the site shows "0 results" and quietly falls back to a generic trending-jobs feed (Sales, Product, Design, unrelated engineering roles). The parser doesn't know this and happily scrapes the fallback content -- QA_FILTER then correctly kills all of it (none of those titles are QA), so nothing ever gets through. This was invisible in the logs before this round because `bySource` only ever showed raw collection counts, which looked perfectly healthy. Confirmed against the real site via a live browser check and a second fetch, and found the actual working category URL: `wellfound.com/role/r/qa-engineer` (verified real QA listings: "QA Engineer" @ Sigma360, PocketSuite, KoiReader, etc.). Switched the parser to that URL.
- **GeekJob was still 0 raw every day, and had never had any debug capture at all** -- every other parser dumps a screenshot + HTML on "0 rows found", GeekJob just silently returned an empty array. Couldn't get live evidence of what's actually happening from this environment (no route to geekjob.ru from here), so added the same debug-dump pattern used everywhere else instead of guessing at a fix. Next run that still returns 0 will leave `geekjob-page1-debug.png/html` behind to diagnose from.
- **Added `qaFilteredBySource` to the run log** -- the missing signal that let Wellfound's 100% failure rate hide for over a week. Previously the log only showed raw collection (`bySource`) and final new-after-dedup (`newBySource`); a source could collect 50 raw jobs and pass 0 through the QA-title filter and it would look identical to "just no new postings today." Now every run records, per source, how many of its raw jobs actually passed the QA filter -- a source sitting at 0 there for days is now visible immediately instead of needing a manual multi-day log review to notice.
- **Remote OK reviewed but left as-is**: its QA category page is real but heavily diluted with unrelated "VERIFIED" spam listings (confirmed via live browser check 2026-09-09) -- genuine QA postings do appear occasionally (contributed 1 new job on 09-10), so it's a low-signal source rather than a broken one. Not worth dropping, not worth extra engineering right now.

### Fixed 2026-09-09 (Working Nomads still 0, Himalayas still 0)

Both had been "fixed" in the 09-07 round but neither was verified against a live run afterward -- this round is that verification, done properly against real debug artifacts instead of guessing:

- **Working Nomads**: the 09-07 fix corrected the row selector (`a.job-desktop`) and the href extraction, but the *title* extraction was still broken -- confirmed from `workingnomads-empty-extract.html`, the real job title lives in `<h4 class="ng-binding">`, which was never in the title-selector fallback list (`h2`, `h3`, `.title`, `[class*='title']`, nested `a`). Every row failed at the title step before href was ever reached, so all rows were silently skipped even though the row selector itself was matching correctly. Added `h4` to the list.
- **Himalayas**: confirmed via debug screenshot that the site serves a Cloudflare "Performing security verification" interstitial to headless Playwright on every run, no exceptions -- this is why it always returned exactly 0 with no error. Dropped rather than chasing a stealth-browser bypass, consistent with how WWR/FlexJobs were handled. See Roadmap.
- Confirmed today's "0 new vacancies" run (12:10 run, 5 hours after a 07:19 run that found 10 new) was correct dedupe behavior, not a bug: 293 unique postings survived the QA filter, all 293 already existed in Supabase from the earlier run that same morning. `stoppedAt: "dedupe"` in `logs/last-run.json` is the confirming signal for this case going forward.

### Fixed 2026-09-07 (round 2 -- Monday, only 7 notifications, all Talanto)

The 2026-09-04 fixes were real but incomplete -- two more issues only showed up under a live scheduled run:

- **We Work Remotely** went from "0 results, searches broken" (09-04) to fully Cloudflare-blocked (09-07) -- the site turned on bot protection in the intervening days. Dropped, see Roadmap above.
- **Working Nomads** was still returning 0 with *no* debug artifact at all -- meaning the row selector (`a.job-desktop`) matched something, but every single row then failed to extract a title/URL, a case the 09-04 debug dumps didn't cover (they only fired on "selector found 0 rows" or an outright exception). Added a third debug dump for exactly this "rows found, nothing extracted" case, so the next run that hits it leaves a screenshot + HTML behind instead of silently returning empty.
- **Habr Career** and **GeekJob** were both only ever reading page 1 -- confirmed by reading their code, not guessed. Habr Career's two QA category pages (`testirovshik`, `testirovschik_mobilnyh_prilozheniy`) are well-scoped but were never paginated past the first page; now pages through `?page=N` until a page adds no new links. GeekJob had no working QA-specific URL to begin with (was hitting the bare homepage + unfiltered `/vacancies` firehose) -- couldn't find a real search endpoint (see Roadmap), so at minimum made the existing firehose actually page through instead of reading page 1 forever.
- Added **per-source counts for the final "new" stage** (`newBySource` in the run log), not just raw collection counts. The old log could tell you Telegram collected 521 raw postings, but not how many of those survived the QA filter *and* were new *and* actually source Telegram vs. Talanto vs. anything else -- which is exactly the question "why did only Talanto notifications arrive today" needs answered.
- Added two new sources: **Himalayas** (`himalayas.app/jobs/quality-assurance` -- confirmed real, server-rendered QA listings; single page only, since Himalayas' `robots.txt` explicitly disallows crawling `?page=` on `/jobs`) and **Ministry of Testing** (`ministryoftesting.com/jobs` -- a QA/testing-specific community job board, so everything on it is already testing-relevant by construction, unlike the general boards).

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
