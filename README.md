This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

### Chats Dashboard
A comprehensive analytics dashboard for monitoring customer frustration and confusion levels:

- **Primary Metric**: Frustration Level (0-100 scale) with color-coded severity system
- **Classification System**: Low (Green), Moderate (Yellow), High (Orange), Critical (Red)
- **Trend Analysis**: Interactive line chart showing frustration scores over time with threshold zones
- **Filtering Options**: Date range, channel (App, Web, WhatsApp, etc.), customer segment, and language filters
- **Insights Section**: Main issue identification and top frustration drivers with impact percentages
- **Risk Assessment**: Real-time risk level indicators and trend analysis

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Daily SMTP Email Automation

The project includes a scheduled daily email route at `app/api/cron/daily-email/route.ts`.

### What it sends

- Prospects totals by service
- Chats metrics from the dashboard chat analysis API
- Agents response-time metrics and rankings
- Agent hours when available

Ops data is intentionally excluded from this email.

### Schedule

`vercel.json` schedules the route to run daily at `15 20 * * *` UTC, which is **11:15 PM** East Africa Time (`Africa/Nairobi`, UTC+3, no DST).

The report **date** (which day’s blob data to load) is **“today” in `REPORT_DATE_TIMEZONE`** (default `Africa/Nairobi`), so a late-evening EAT cron does not jump ahead to the next calendar day the way `Asia/Dubai` (UTC+4) would. Set `REPORT_DATE_TIMEZONE=Asia/Dubai` only if you intentionally want the business day in Dubai. Override any time with `?date=YYYY-MM-DD`.

### Required environment variables

Set these in your deployment environment:

```bash
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true
DAILY_REPORT_RECIPIENTS=sahar.sabbagh@maids.cc
CRON_SECRET=
REPORT_DATE_TIMEZONE=Africa/Nairobi
```

Optional:

```bash
APP_BASE_URL=
REPORT_DATE_TIMEZONE=Asia/Dubai
```

`APP_BASE_URL` is optional: the cron response JSON includes an `origin` field for debugging; report data is read directly from storage (no internal HTTP to `/api/dates`).

### Manual testing

Preview the generated payload and HTML without sending an email:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/daily-email?date=2026-03-08&dryRun=true"
```

Send the email manually for a specific date:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/daily-email?date=2026-03-08"
```

Override recipients for a one-off test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/daily-email?date=2026-03-08&to=sahar.sabbagh@maids.cc"
```
