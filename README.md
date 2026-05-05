# NodeXtract

**NodeXtract** is an automated, cross-platform direct download link extractor built with Playwright and Electron. It handles complex, multi-step download flows (like those found on datanodes.to) to bypass ads, wait out fake progress bars, and intercept the final raw download URLs for batch exporting into your favorite Download Manager.

## Features
- **Concurrent Extractions**: Extract multiple links simultaneously.
- **Headless Mode**: Run the Playwright browsers silently in the background.
- **Ad & Popup Bypass**: Automatically handles and closes aggressive popups and invisible ad overlays.
- **Retry Mechanisms**: Configurable auto-retry logic for unreliable links.
- **Batch Export**: 1-click "Copy All Links" utility to drop raw URLs directly into IDM or JDownloader.

## For Users

### Installation
Go to the [Releases](https://github.com/nasyx-rakeeb/NodeXtract/releases) page and download the installer for your OS (Windows `.exe`, Mac `.dmg` or Linux `AppImage`).

### Step 1: Extraction
1. Paste your `datanodes.to` links into the text box (one per line). Unsupported links are automatically ignored.
2. Tweak the Settings (Concurrency, Retries, Headless).
3. Click **Start Extraction**.
4. Once links start turning green, click **📋 Copy All Links** to grab the raw final URLs.

### Step 2: Downloading via IDM
Datanodes checks browser tokens before serving files. You **cannot** paste these links directly into your download manager.
1. Make sure you have **Internet Download Manager (IDM)** installed along with the **IDM Integration Module** browser extension.
2. Install a browser extension like **Open Multiple URLs**.
3. Paste the copied links into the "Open Multiple URLs" extension.
4. **Important**: Open them in batches of 8. If you open too many at once, your browser may crash or timeouts may occur.
5. The extension will open the links in new tabs, pass the token verification, and automatically trigger the IDM download interception!

## For Developers

NodeXtract follows a hybrid architecture. The UI is built using React/Electron, while the extraction engine uses Python and Playwright. The engine is compiled into a standalone executable using PyInstaller.

### Requirements
- Node.js (v18+)
- Python (3.9+)

### Project Structure
- `src/`: React UI and Electron main process.
- `engine/`: Python Playwright engine (`extractor.py`) and build scripts.

### Building the Python Engine
Whenever you make changes to the Python logic (e.g., adding a new site handler), you must recompile the standalone binary.
From the root directory, run:
- **Mac/Linux**: `npm run build:engine:mac`
- **Windows**: `npm run build:engine:win`

### Running Locally
To test the UI and IPC bridge locally in development mode:
```bash
npm install
npm start
```

### Packaging for Production
To build a distributable installer (e.g., `.exe` or `.dmg`) for the OS you are currently using:
```bash
npm run package
```
The output files will be placed in the `release/build` directory.
