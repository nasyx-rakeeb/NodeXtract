# NodeXtract

**The professional, high-performance link resolver for Datanodes.**

NodeXtract is a minimalist desktop utility designed to automate the tedious process of resolving `datanodes.to` links. Built with Electron and a custom Playwright engine, it bypasses ad-gateways, negotiates security tokens, and provides raw direct links ready for high-speed download managers.

---

## ⚡️ Key Features

- **Parallel Processing**: Resolve multiple links simultaneously with configurable concurrency.
- **Stealth Engine**: Runs headless browser contexts to bypass ad-overlays and popups silently.
- **Smart Retries**: Automatic error handling and retry logic for unreliable server responses.
- **Enterprise UI**: A clean, distraction-free interface built for both casual and power users.
- **Direct Export**: 1-click clipboard synchronization for seamless batch downloading.

---

## 📥 Installation

1. Navigate to the **[Latest Releases](https://github.com/nasyx-rakeeb/NodeXtract/releases)**.
2. Download the installer for your platform:
   - **Windows**: `.exe` installer
   - **macOS**: `.dmg` package
   - **Linux**: `.AppImage` executable
3. Run the installer and launch **NodeXtract**.

---

## 🚀 The Optimal Workflow

Because Datanodes uses advanced session verification, you cannot simply paste extracted links directly into a download manager (like IDM) without a browser handshake. Follow this workflow for a 100% success rate:

### 1. Extraction
1. Paste your list of `datanodes.to` URLs into the **Extraction** tab.
2. Click **Start Extraction**.
3. Watch the real-time terminal log as the engine negotiates the links.
4. Once completed, click **Copy All Links**.

### 2. Browser Handshake (Required)
1. Install the **Internet Download Manager (IDM)** and its browser extension.
2. Install the **"Open Multiple URLs"** extension in your browser.
3. Open the extension, paste your links, and click **Open**.
4. **Tip**: Open links in groups of 5-8 to ensure smooth token negotiation.
5. Your browser will instantly verify the session, and IDM will automatically intercept the download!

---

## 🛠 Development

NodeXtract utilizes a hybrid architecture: a **React/Electron** frontend communicating via IPC with a **Python/Playwright** backend.

### Setup
```bash
# Install dependencies
npm install

# Build the Python engine (Platform specific)
npm run build:engine:mac  # or :win

# Launch development environment
npm start
```

### Production Build
```bash
# Generate platform-specific installers
npm run package
```

---

## 💖 Support the Project

If NodeXtract has saved you time and frustration, consider supporting further development.

- **[GitHub Sponsors](https://github.com/sponsors/nasyx-rakeeb)**

---

**Disclaimer**: NodeXtract is a tool designed for automation. Users are responsible for adhering to the terms of service of the file hosts they interact with.
