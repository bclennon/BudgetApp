# Budget App

A personal budgeting app. Track pay periods, bills, and daily spending — data is stored in your Google account via Firebase and available on any device.

## Features

- **Google Sign-In** — Secure authentication via your Google account
- **Cloud Storage** — Bills and settings are saved to Firestore and sync across all your devices/browsers
- **Pay Periods** — Auto-generates 6 upcoming pay periods showing bills due, remaining balance, and daily spending allowance
- **Bills** — Add, edit, and delete recurring bills (name, due day, amount)
- **Settings** — Configure paycheck amount, pay frequency, next payday, and target daily spending
- **Backup & Sync** — Export/import your data as a `budget_backup.json` file for safekeeping or migration

## Firebase Setup (required)

The app uses [Firebase](https://firebase.google.com/) for authentication and cloud storage. You need to create a Firebase project and configure it before running the app.

### 1. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. In **Authentication → Sign-in method**, enable the **Google** provider.
3. In **Firestore Database**, click **Create database** (start in production mode).
4. In **Firestore Database → Rules**, replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. In **Project Settings → General → Your apps**, register a **Web app** and copy the Firebase config values.

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Firebase config:

```bash
cp .env.example .env.local
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=...
```

### 3. GitHub Pages deployment

Add the four Firebase variables as **repository secrets** (Settings → Secrets and variables → Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Also add your GitHub Pages domain (e.g. `https://username.github.io`) to the **Authorized domains** list in Firebase → Authentication → Settings.

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

Data is stored in **Cloud Firestore** under your Google account UID, protected by security rules that allow only you to access your data. A copy is also cached in `localStorage` for fast initial load.

Use **Backup & Sync → Download Backup** to save a local copy of your data, and **Restore from Backup** to load it.

## Pay Period Rules

- **Bill overflow** — if a bill's due day doesn't exist in a month (e.g. day 31 in April), the due date overflows into the next month by the excess days.
- **Semi-monthly** — paydays are the 15th and the 30th (with overflow for short months).
- **Savings** — when projected daily spending exceeds the target, the surplus is shown as a savings line item.

