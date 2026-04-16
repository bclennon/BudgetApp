# BudgetApp

An Android budgeting app MVP built with Kotlin, Jetpack Compose, and Room.

## Features

- **Pay Periods screen** – Upcoming pay period boxes with date range, due bills, totals, remaining amount, and spending/day. Savings line item appears automatically when spending/day exceeds your target.
- **Bills screen** – Add, edit, and delete recurring bills (name, due day 1–31, amount).
- **Settings screen** – Configure paycheck amount, pay frequency, next payday, and target daily spending.
- **Backup & Sync screen** – Manual JSON backup/restore via the Android file picker (no Google account or API key required).

## Tech Stack

| Layer | Tech |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Architecture | MVVM (ViewModels + StateFlow) |
| Local DB | Room |
| Preferences | Jetpack DataStore |
| Serialization | kotlinx.serialization (JSON) |
| Min SDK | 29 (Android 10) |

## Setup & Run

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- Android SDK 34
- JDK 17

### Steps

1. Clone the repo:
   ```bash
   git clone https://github.com/bclennon/BudgetApp.git
   cd BudgetApp
   ```
2. Open the project root in Android Studio.
3. Wait for Gradle sync to complete (first sync downloads ~200 MB of dependencies).
4. Select a device or emulator running Android 10+ (API 29+).
5. Press **Run ▶** (or `Shift+F10`).

### Run unit tests

```bash
./gradlew test
```

Tests cover:
- **Bill due-date overflow** – e.g. Feb 31 → Mar 3 (non-leap), Apr 31 → May 1.
- **Pay period generation** – weekly, biweekly, semi-monthly (15 & 30), and monthly frequencies.

## Domain rules

### Bill due dates
If a bill's `dayOfMonth` doesn't exist in a given month, the due date overflows into the next month by the number of excess days:
- `Feb 31` (non-leap) → `Mar 3`  (28 + 3)
- `Feb 31` (leap 2024) → `Mar 2`  (29 + 2)
- `Apr 31` → `May 1`              (30 + 1)
- `Dec 31` → `Dec 31`             (no overflow)

### Pay frequencies
| Frequency | Period length |
|---|---|
| Weekly | 7 days |
| Biweekly | 14 days |
| Semi-monthly | ~15 days (fixed days: 15 and 30; 30th overflows if month is shorter) |
| Monthly | Same day next month (with overflow if needed) |

### Savings Option A
If `spendingPerDayRaw > targetSpendingPerDayCents`:
- `savingsTotal = (spendingPerDayRaw − target) × daysInPeriod`
- Displayed spending/day is capped at `targetSpendingPerDayCents`.
- A **Savings** line appears in the pay period card.

## Backup & Sync (via Google Drive or local storage)

The app uses Android's **Storage Access Framework (SAF)** — no Google account or API key needed.

### First-time setup
1. Go to the **Backup** tab.
2. Tap **Create Backup File** to create a new `budget_backup.json` in a location you choose (e.g. Google Drive → My Drive → BudgetApp folder).  
   *Or* tap **Pick Existing Backup File** to select an existing JSON backup.
3. The app saves the file URI and persists read/write permission automatically.

### Sync to backup
Tap **Sync to Backup** — the app exports all bills and settings to JSON and overwrites the selected file.

### Restore from backup
Tap **Restore from Backup** → confirm the dialog. The app reads the JSON, validates `schemaVersion == 1`, and replaces all local data in a single Room transaction.

### Backup file format
```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-04-16T12:00:00Z",
  "settings": {
    "paycheckAmountCents": 300000,
    "frequency": "BIWEEKLY",
    "nextPayday": "2026-04-18",
    "targetSpendingPerDayCents": 3000
  },
  "bills": [
    { "id": 1, "name": "Rent", "dayOfMonth": 1, "amountCents": 150000 },
    { "id": 2, "name": "Electric", "dayOfMonth": 15, "amountCents": 8500 }
  ]
}
```

### Using Google Drive as the backup location
When the system file picker opens, tap the **≡ hamburger menu → Drive** to browse your Google Drive. Navigate to (or create) a `BudgetApp` folder and save/select `budget_backup.json` there. After that, all future syncs go to that same Drive file with one tap.
