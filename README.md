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
