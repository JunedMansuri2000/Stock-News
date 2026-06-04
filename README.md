# Stock News

Real-time Indian stock market news aggregated from [NewsAPI](https://newsapi.org/) and [MoneyControl RSS](https://www.moneycontrol.com/), built with Next.js 14, Prisma, and Tailwind CSS.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in your NewsAPI key (get one free at https://newsapi.org/register)
cp .env.example .env.local

# 3. Create the database and generate Prisma client
npm run db:push

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite: `file:./dev.db` · PostgreSQL: `postgresql://...` |
| `NEWSAPI_KEY` | ✅ | Get free at https://newsapi.org/register |

## Triggering a Sync

### Manual (UI)
Go to `/news` → click **Sync Now**.

### API
```bash
curl -X POST http://localhost:3000/api/news/sync
```

### Cron options (pick one)

**VPS / Linux crontab** — every 10 minutes:
```
*/10 * * * * curl -s -X POST http://localhost:3000/api/news/sync >> /var/log/news-sync.log 2>&1
```

**Vercel** — already configured in `vercel.json`. Requires Pro plan.

**GitHub Actions** — already configured in `.github/workflows/news-sync.yml`.  
Set `APP_URL` and `SYNC_SECRET` in repo → Settings → Secrets.

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/news/sync` | Trigger an immediate sync. Returns `409` if already running. |
| `GET` | `/api/news/sync/status` | Last sync info + total article count. |
| `GET` | `/api/news?page=1&limit=20` | Paginated article list. |

## Database

Switch from SQLite to PostgreSQL for production — change one line in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // ← was "sqlite"
  url      = env("DATABASE_URL")
}
```

Then run `npm run db:migrate`.

## Project Structure

```
src/
  lib/
    prisma.ts               # Prisma client singleton
    news-sync-service.ts    # All sync business logic (NewsSyncService)
  app/
    page.tsx                # Dashboard with widgets
    news/page.tsx           # News list + Sync Now button
    api/
      news/route.ts                # GET /api/news
      news/sync/route.ts           # POST /api/news/sync
      news/sync/status/route.ts    # GET /api/news/sync/status
  components/
    SyncButton.tsx          # Client — calls API, shows loading/result, refreshes page
    DashboardWidgets.tsx    # Client — polls /api/news/sync/status every 15 s
    NewsCard.tsx            # Server-safe article card

prisma/schema.prisma        # Article + SyncLog tables
vercel.json                 # Vercel Cron config
.github/workflows/          # GitHub Actions cron
```
