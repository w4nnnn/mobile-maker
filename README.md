# Mobile Maker (Capacitor + Vite)

A simplified framework to turn any website into a native Android application using Capacitor.

## ✨ Features

- **Configuration First**: Manage App Name, ID, URL, and colors from a single `app-config.json` file.
- **Automated Build Pipeline**: One command to update config, rebuild web assets, reset Android project, and inject permissions.
- **Factory Reset**: Automatically recreates the native project to apply deep changes (like Package Name/App ID).
- **Auto-Permissions**: Automatically injects standard permissions (`INTERNET`, `RECORD_AUDIO` for Web Speech API).
- **Splash Screen Handling**: Configured to auto-hide after the remote website loads.

## 🚀 Quick Start

### 1. Configure Your App

Open `app-config.json` and set your details:

```json
{
  "appId": "com.yourcompany.appname",
  "appName": "My Awesome App",
  "webUrl": "https://your-website.com/",
  "backgroundColor": "#000000"
}
```

### 2. Build Everything

Run the master build script. This will generate the Android project from scratch based on your config.

```bash
npm run build:android
```

### 3. Run on Device

Deploy to your connected Android device or emulator.

```bash
npx cap run android
```

---

## 🛠 Scripts

| Command | Description |
| :--- | :--- |
| `npm run build:android` | **The Main Command**. Updates config, builds web, resets Android folder, injects permissions, and syncs. |
| `npm start` | Runs the Vite dev server (web preview only). |
| `npm run build` | Builds the web assets to `dist/`. |
| `npx cap open android` | Opens the native project in Android Studio. |

## 📂 Project Structure

- **`app-config.json`**: The input configuration for your app generator.
- **`scripts/recreate-android.js`**: The builder logic that automates the Capacitor workflow.
- **`src/`**: Basic web entry point (minimized to just load the config).
- **`android/`**: The generated native project (do not edit manually if you plan to use the recreate script often).

## 📝 Important Notes

- **App ID Changes**: Changing `appId` in `app-config.json` essentially creates a *new* app on your phone. It will not update the existing one; it will install alongside it.
- **Permissions**: If you need more Android permissions, add them to the `REQUIRED_PERMISSIONS` array in `scripts/recreate-android.js`.
