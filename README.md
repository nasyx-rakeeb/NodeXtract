# NodeXtract

NodeXtract is a desktop app for preparing supported file-host links and managing them in a clean queue.

Paste supported links, run extraction, copy or export the ready links, then open them in your browser.

## What You Can Do

- Paste many supported links at once.
- Track each link as it moves from pending to ready or failed.
- Retry failed links.
- Copy all ready links to the clipboard.
- Export ready links to a `.txt` file.
- Import links from a `.txt` file.
- Use dark mode.
- Let the app check for updates in packaged builds.

## Install

Download the latest build from:

https://github.com/nasyx-rakeeb/NodeXtract/releases

Choose the file for your operating system:

- Windows: `.exe`
- macOS: `.dmg`
- Linux: `.AppImage`

Install it, open NodeXtract, and start from the Extraction page.

## Basic Use

1. Open the **Extraction** page.
2. Paste supported links into the input box, one link per line.
3. Click **Start Extraction**.
4. Wait until links show **Ready** in the queue.
5. Click **Copy Ready** to copy ready links.
6. Open the copied links in your regular browser.

You can also click **Export Ready** to save the ready links as a text file.

## Opening Many Ready Links

If you have many ready links, a browser extension such as **Open Multiple URLs** can help.

Use it like this:

1. Click **Copy Ready** in NodeXtract.
2. Open the extension in your browser.
3. Paste the copied links into the extension.
4. Use the extension's open action.

## Settings

The Settings page includes:

- **Appearance**: choose light or dark mode.
- **Concurrency**: how many links the engine works on at the same time.
- **Max retries**: how many times a failed link should be retried.
- **Headless mode**: run the browser engine off-screen.
- **Development engine**: available only in dev builds; switch between the Python script and packaged binary.

Settings are saved locally and restored when the app opens again.

## Development

Install dependencies:

```bash
npm install
```

Build the Python engine for your platform:

```bash
npm run build:engine:mac
```

or on Windows:

```bash
npm run build:engine:win
```

Start the dev app:

```bash
npm start
```

Create a packaged build:

```bash
npm run package
```

## Project Structure

- `src/main`: Electron main process, IPC, updater, engine process launch.
- `src/renderer`: React UI.
- `engine`: Python Playwright extraction engine.
- `resources/bin`: packaged engine binary output.
- `assets`: app icons and build resources.

## Support and Issues

- GitHub: https://github.com/nasyx-rakeeb/NodeXtract
- Report an issue: https://github.com/nasyx-rakeeb/NodeXtract/issues/new
- GitHub Sponsors: https://github.com/sponsors/nasyx-rakeeb

## Responsible Use

Use NodeXtract only with links, files, and services you are authorized to access. You are responsible for following the terms, policies, and legal requirements that apply to the content and services you use with this app.
