# NodeXtract Product Notes

This file explains what the app is, how it works, and what future changes should respect.

## Product Goal

NodeXtract is a desktop utility for preparing supported file-host links.

The app should make a repetitive workflow easier:

1. User pastes supported source links.
2. App processes them in a visible queue.
3. App marks links as ready or failed.
4. User copies or exports ready links.
5. User opens ready links in their regular browser.

The app should feel simple for normal users and predictable for developers.

## Main Screens

### Extraction

Primary working screen.

It should show:

- Link input box.
- Start, stop, import, retry, copy, and export actions.
- Queue metrics: queued, active, ready, failed.
- Engine log.
- Queue table with source URL, status, and result.

Expected behavior:

- Ignore unsupported links before extraction starts.
- Remove duplicate supported links before extraction starts.
- Show a clear message when input was cleaned.
- Keep source URLs readable in the queue table.
- Autoscroll the queue when new links become ready.

### Settings

User preferences and engine controls.

Current settings:

- Theme: light or dark.
- Concurrency.
- Max retries.
- Headless mode.
- Development engine mode in dev builds only.

Settings must persist across app restarts.

### Guide

User-facing workflow help.

The guide should be explicit and practical. It should explain:

- What a ready link is.
- Why ready links should be opened in the user's regular browser.
- How to use Copy Ready and Export Ready.
- The Open Multiple URLs browser extension tip.

Avoid vague wording. Use the same button names shown in the UI.

### About

Project information.

It should include:

- Short app description.
- Useful capability summary.
- Responsible use disclaimer.
- GitHub link.
- GitHub Issues link.
- GitHub Sponsors link.

## Architecture

NodeXtract has three major parts.

### Electron Main Process

Location: `src/main`

Responsibilities:

- Create the app window.
- Maximize the window on startup.
- Start and stop the engine process.
- Import and export text files.
- Handle auto updates.
- Open external links in the user's browser.

### React Renderer

Location: `src/renderer`

Responsibilities:

- Render the app UI.
- Store user settings and session data in local storage.
- Validate and clean input links.
- Display queue status, logs, and result links.
- Send extraction requests to the main process through IPC.

### Python Engine

Location: `engine`

Responsibilities:

- Run Playwright.
- Process supported links.
- Emit JSON events for logs, progress, results, and completion.

The renderer should not parse raw engine text when structured events are available.

## Development Engine Modes

In development builds, Settings can choose between:

- **Script**: run `engine/extractor.py` through Python.
- **Binary**: run the built executable from `resources/bin`.

Packaged builds always use the binary.

This helps test production-like behavior without packaging the full app.

## Release Checklist

Before a release:

1. Run the app locally.
2. Test extraction with valid, invalid, and duplicate input.
3. Check dark mode and light mode.
4. Check import, Copy Ready, Export Ready, and Retry Failed.
5. Build the engine for the target platform.
6. Run `npm run build`.
7. Run `npm run package`.
8. Update version, commit, push, tag, and push the tag.

## Responsible Use

NodeXtract is an automation utility. Users must only use it with links, files, and services they are authorized to access. Users are responsible for following any applicable service terms, content rights, and local laws.
