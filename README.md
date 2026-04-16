# Budget App

A browser-based personal budgeting app. Track pay periods, bills, and daily spending — all stored locally in your browser.

## Features

- **Pay Periods** — Auto-generates 6 upcoming pay periods showing bills due, remaining balance, and daily spending allowance
- **Bills** — Add, edit, and delete recurring bills (name, due day, amount)
- **Settings** — Configure paycheck amount, pay frequency, next payday, and target daily spending
- **Backup & Sync** — Export/import your data as a `budget_backup.json` file for safekeeping or migration

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- npm (bundled with Node)

### Google OAuth setup (required for sign-in)

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create a project (or use an existing one).
2. Navigate to **APIs & Services → Credentials** and click **Create Credentials → OAuth 2.0 Client ID**.
3. Choose **Web application**, give it a name, and add your app's origin to **Authorised JavaScript origins** (e.g. `http://localhost:5173` for local dev, plus your production URL).
4. Copy the generated **Client ID**.
5. Copy `.env.example` to `.env.local` and paste your Client ID:

```bash
cp .env.example .env.local
# then edit .env.local and set VITE_GOOGLE_CLIENT_ID=<your-client-id>
```

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for production

```bash
npm run build
```

The compiled site is output to `dist/` and can be served by any static file host (GitHub Pages, Netlify, Vercel, etc.).  
Make sure to set the `VITE_GOOGLE_CLIENT_ID` environment variable in your host's settings before deploying.

### Run tests

```bash
npm test
```

## Data & Privacy

All data is stored in your browser's `localStorage`. Nothing is sent to any server.

Use **Backup & Sync → Download Backup** to save a copy of your data, and **Restore from Backup** to load it on another device or browser.

## Pay Period Rules

- **Bill overflow** — if a bill's due day doesn't exist in a month (e.g. day 31 in April), the due date overflows into the next month by the excess days.
- **Semi-monthly** — paydays are the 15th and the 30th (with overflow for short months).
- **Savings** — when projected daily spending exceeds the target, the surplus is shown as a savings line item.
