# BudgetApp — Android

Native Android app (Kotlin + Jetpack Compose) that works in tandem with the BudgetApp website.
Both apps authenticate with the same Google account and read/write data from the same Google
Spreadsheet, so a user sees the same data whether they use the web app or the Android app.

## How data sharing works

The web app stores all data in a Google Spreadsheet (one per user) with four sheet tabs:
`Bills`, `Settings`, `PeriodOverrides`, `CreditCards`. Each tab stores a JSON blob in cell `A1`.
The Android app reads and writes the same spreadsheet using the same Google Sheets REST API,
so both apps always share identical data.

## Prerequisites

- Android Studio Ladybug (2024.2.1) or newer
- JDK 11+
- An existing Firebase project (the same one used by the web app)

## Setup

### 1. Register the Android app in Firebase

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Go to **Project Settings → Your apps → Add app → Android**.
3. Enter the package name: `com.example.budgetapp`
4. Enter a nickname (e.g. "BudgetApp Android").
5. Enter your **debug SHA-1 certificate fingerprint**:
   ```sh
   # On macOS/Linux:
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey \
     -storepass android -keypass android | grep SHA1
   # On Windows:
   keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey \
     -storepass android -keypass android
   ```
6. Click **Register app**.
7. Download the generated `google-services.json` and copy it to `android/app/google-services.json`.

> **Important:** The `google-services.json` file contains secret API keys.
> It is already listed in `.gitignore`. Never commit it to source control.

### 2. Enable Google Sign-In in Firebase

1. In Firebase Console, go to **Authentication → Sign-in method**.
2. Enable **Google** as a sign-in provider.
3. Save.

### 3. Get the Web Client ID

The Android app needs the **web OAuth client ID** to obtain an access token for the Sheets API.

1. In Firebase Console → **Project Settings → Your apps**, find the web app.
2. The web client ID looks like `123456789-xxxx.apps.googleusercontent.com`.
   It is the `client_id` for the entry with `"client_type": 3` in `google-services.json`.
3. The `google-services` Gradle plugin automatically generates
   `R.string.default_web_client_id` from this value, which `MainActivity` reads automatically.
   No manual changes are required once `google-services.json` is in place.

### 4. Build and run

```sh
cd android
./gradlew assembleDebug          # build APK
./gradlew installDebug           # install on connected device/emulator
./gradlew test                   # run unit tests
```

Or open the `android/` directory in Android Studio and click **Run**.

> **Note:** The `gradle-wrapper.jar` binary is not included in the repository.
> Android Studio generates it automatically when you open the project, or you can run:
> ```sh
> cd android
> gradle wrapper --gradle-version 8.9
> ```

## Project structure

```
android/
├── app/
│   ├── google-services.json         ← YOU MUST ADD THIS (see Setup)
│   ├── google-services.json.example ← template showing the expected structure
│   └── src/main/java/com/example/budgetapp/
│       ├── MainActivity.kt           ← entry point; handles sign-in flow
│       ├── BudgetApplication.kt      ← initialises Firebase
│       ├── auth/
│       │   └── AuthManager.kt        ← Google Sign-In + Firebase Auth + token retrieval
│       ├── data/
│       │   └── SheetsRepository.kt   ← reads/writes Google Sheets (mirrors sheetsStorage.ts)
│       ├── domain/
│       │   ├── Models.kt             ← data classes (mirrors models.ts)
│       │   ├── BillDueDateResolver.kt ← (mirrors billDueDateResolver.ts)
│       │   ├── PayPeriodGenerator.kt  ← (mirrors payPeriodGenerator.ts)
│       │   └── BillImporter.kt        ← (mirrors billImporter.ts)
│       └── ui/
│           ├── AppViewModel.kt       ← central state; orchestrates data load/save
│           ├── AppNavigation.kt      ← Compose navigation graph
│           └── screens/
│               ├── SignInScreen.kt
│               ├── PayPeriodsScreen.kt
│               ├── BillsScreen.kt
│               ├── CreditCardsScreen.kt
│               ├── SettingsScreen.kt
│               ├── ArchivedPeriodsScreen.kt
│               └── BackupSyncScreen.kt
└── app/src/test/                     ← unit tests for domain logic
```

## Technical notes

| Web app | Android app |
|---------|-------------|
| `signInWithPopup` (Firebase JS SDK) | `GoogleSignInClient.signInIntent` → Activity Result API |
| `credential.accessToken` from popup | `GoogleAuthUtil.getToken()` with OAuth2 scopes |
| `localStorage` / `sessionStorage` | `SharedPreferences` |
| React state + Context | `ViewModel` + `StateFlow` |
| Vite + TypeScript | Kotlin + Jetpack Compose |

### Token refresh

The web app calls `requestSheetsToken()` to re-obtain an access token via a new popup.
On Android, `GoogleAuthUtil.getToken()` handles silent token refresh automatically. The
`AppViewModel` calls `authManager.getSheetsAccessToken()` before each API operation.

### Same Firebase project

The Android app uses the **same Firebase project** as the web app — only a second app entry
(Android) is registered in Firebase Console. No changes are needed to Firebase Auth settings,
Firestore rules, or any other Firebase configuration.

### Package name

The default package name is `com.example.budgetapp`. Before publishing to Google Play, change
it in `app/build.gradle.kts` (`applicationId`) and update the Firebase Console registration to match.
