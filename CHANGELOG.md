# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-05

### Added
- **NodeXtract App**: Initial production release.
- **Datanodes Handler**: Robust automation logic to bypass "Preparing File" progress bars and ad overlays on datanodes.to.
- **Concurrency & Retries**: Added UI settings to control concurrent Playwright execution limits and network retry counts.
- **Headless Mode**: Toggle to hide chromium browser instances to preserve system resources.
- **One-Click Export**: Added "Copy All Links" utility to instantly send successfully extracted raw URLs to the clipboard for IDM/JDownloader integration.
- **Cross-Platform Build Pipeline**: Added npm and batch scripts for compiling the Playwright Python binary seamlessly on macOS, Windows, and Linux.
