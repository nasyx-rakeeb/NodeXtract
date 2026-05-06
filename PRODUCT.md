# Product Documentation: NodeXtract

## 1. The Problem: Why was NodeXtract created?

File hosting services like **Datanodes** are heavily fortified with anti-automation mechanisms. For end-users attempting to download files, the experience is intentionally designed to be slow, tedious, and highly monetized. 

When a user clicks a standard Datanodes link, they are forced through a hostile user experience:
- **Ad Gateways**: Multiple invisible, full-screen popups that open scam or ad pages on the first 2-3 clicks.
- **Artificial Delays**: Fake progress bars forcing the user to wait 10-15 seconds before the real download button appears.
- **Session Tokens**: Download links are deeply tied to the user's active browser session and IP address, meaning direct links cannot easily be scraped via basic HTTP requests (like `cURL` or `Python Requests`).
- **CAPTCHAs / Bot Protection**: Cloudflare and standard bot-checks constantly block automated traffic.

For a user trying to download dozens or hundreds of files, manually clicking through this maze for every single link is physically exhausting and incredibly time-consuming.

## 2. The Solution: What is NodeXtract?

**NodeXtract** is a premium, cross-platform desktop automation utility designed to completely eliminate the friction of downloading from Datanodes. 

Instead of treating extraction like a simple web-scraping task, NodeXtract uses a "stealth browser" approach. It spins up invisible instances of the Chromium browser, mimics human behavior, safely absorbs all the malicious popups, waits out the timers, and securely negotiates the session tokens on the user's behalf. 

**It turns a 15-minute manual clicking chore into a 1-click automated background process.**

## 3. How It Works (The Architecture)

NodeXtract is built on a modern, hybrid architecture designed for performance and reliability:

### A. The Frontend (React + Electron)
The user interface is built using React and packaged as a native desktop application via Electron. 
- **Minimalist Design**: Inspired by enterprise developer tools (like Vercel and Linear), providing a stark, distraction-free environment.
- **State Management**: Tracks the real-time status of dozens of links simultaneously (Pending, Opening, Intercepting, Success, Failed).
- **Configuration**: Allows the user to dictate the Concurrency (how many browsers run at once), Retry logic, and Headless modes.

### B. The Backend Engine (Python + Playwright)
When the user clicks "Start Extraction", the Electron app boots up a compiled Python executable bundled inside the app. 
- **Playwright Automation**: The engine uses Playwright to physically drive hidden Chromium browsers.
- **Ad-Block Routing**: The Python script is programmed to intercept and instantly abort any network requests heading to known ad networks or popup domains, saving massive amounts of bandwidth and memory.
- **DOM Observation**: It intelligently waits for specific HTML elements (like the hidden `download_token` buttons) to appear, rather than relying on unreliable static sleep timers.
- **Network Interception**: Once the final file is requested, the engine intercepts the raw `.mkv` or `.zip` network payload, steals the direct URL, and aborts the actual download, returning the raw link back to the React UI.

## 4. The "Open Multiple URLs" Handoff

Because Datanodes uses strict session verification, raw links cannot be blindly pasted into a tool like Internet Download Manager (IDM). The server will reject the connection if it doesn't recognize the browser that generated the link.

NodeXtract solves this with a highly optimized handoff workflow:
1. The user copies the final raw links from NodeXtract.
2. They use a browser extension ("Open Multiple URLs") to open the links in their actual daily browser.
3. The browser instantly completes the token handshake with the Datanodes server.
4. **IDM's browser extension** seamlessly intercepts the validated connection and takes over the download at maximum bandwidth.

## 5. Summary

NodeXtract is not just a scraper; it is a **Browser Automation Engine** wrapped in a sleek, billion-dollar-company UI. It respects the user's time, CPU, and bandwidth, bridging the gap between highly-defended file hosts and enterprise download managers.
