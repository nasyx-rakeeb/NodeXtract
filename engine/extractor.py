import asyncio
import urllib.parse
import json
import sys
import os

# Force Playwright to use the persistent global system cache
# This prevents it from looking inside the ephemeral PyInstaller bundle folder
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "0"

import argparse
import subprocess
from playwright.async_api import async_playwright

class Logger:
    @staticmethod
    def emit(event_type, **kwargs):
        event = {"type": event_type}
        event.update(kwargs)
        sys.stdout.write(json.dumps(event) + "\n")
        sys.stdout.flush()

    @staticmethod
    def log(message, level="info"):
        Logger.emit("log", message=message, level=level)

    @staticmethod
    def progress(link, status, attempt=None):
        kwargs = {"link": link, "status": status}
        if attempt is not None:
            kwargs["attempt"] = attempt
        Logger.emit("progress", **kwargs)

    @staticmethod
    def result(link, status, download_url=None, error=None):
        kwargs = {"link": link, "status": status}
        if download_url:
            kwargs["download_url"] = download_url
        if error:
            kwargs["error"] = error
        Logger.emit("result", **kwargs)


class HostLinkHandler:
    BUTTON_CONTINUE = "button:has-text('Continue to Download')"
    BUTTON_FREE = "button:has-text('Free Download')"
    BUTTON_START = "button:has-text('Start Download')"

    def __init__(self, browser):
        self.browser = browser

    async def process(self, link, seen):
        page = await self.browser.new_page()
        download_url = None

        async def handle_response(response):
            nonlocal download_url
            if "download" in response.url and response.request.method == "POST":
                try:
                    data = await response.json()
                    if "url" in data:
                        download_url = data["url"]
                except Exception:
                    pass

        page.on("response", lambda r: asyncio.create_task(handle_response(r)))

        try:
            Logger.log(f"[OPEN] {link}")
            Logger.progress(link, "opening")

            await page.goto(link, wait_until="domcontentloaded")
            page.on("popup", lambda p: asyncio.create_task(p.close()))

            Logger.progress(link, "verifying")
            await page.wait_for_selector(self.BUTTON_CONTINUE, timeout=40000, state="visible")
            await page.click(self.BUTTON_CONTINUE)
            await asyncio.sleep(2)

            for p in page.context.pages:
                if p != page:
                    await p.close()

            try:
                if await page.locator(self.BUTTON_CONTINUE).is_visible():
                    await page.click(self.BUTTON_CONTINUE)
                    await asyncio.sleep(2)
            except Exception:
                pass

            Logger.progress(link, "waiting_free")
            await page.wait_for_selector(self.BUTTON_FREE, timeout=20000)
            await page.click(self.BUTTON_FREE)
            await asyncio.sleep(2)

            for p in page.context.pages:
                if p != page:
                    await p.close()

            await page.wait_for_selector(self.BUTTON_FREE, timeout=20000)
            await page.click(self.BUTTON_FREE)

            Logger.progress(link, "waiting_start")
            await page.wait_for_selector(self.BUTTON_START, timeout=40000)
            await page.click(self.BUTTON_START)

            Logger.progress(link, "intercepting")
            await asyncio.sleep(5)

            if download_url:
                clean_url = urllib.parse.unquote(download_url)
                if clean_url not in seen:
                    seen.add(clean_url)
                    Logger.log(f"[OK] {clean_url}")
                    Logger.result(link, "success", download_url=clean_url)
                    return True

            Logger.log("[FAIL] No URL captured", level="error")
            Logger.result(link, "failed", error="No URL captured")
            return False

        except Exception as e:
            Logger.log(f"[ERROR] {link} -> {e}", level="error")
            Logger.result(link, "failed", error=str(e))
            return False

        finally:
            await page.close()


class ExtractorEngine:
    def __init__(self, concurrency, max_retries, headless):
        self.concurrency = concurrency
        self.max_retries = max_retries
        self.headless = headless
        self.seen = set()

    @staticmethod
    def ensure_browsers_installed():
        try:
            Logger.log("Checking browser dependencies (may take a minute on first run)...")
            from playwright._impl._driver import compute_driver_executable, get_driver_env
            driver_executable, cli_js = compute_driver_executable()
            env = get_driver_env()
            subprocess.check_call([driver_executable, cli_js, "install", "chromium"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            Logger.log("Browser dependencies verified.")
        except Exception as e:
            Logger.log(f"Failed to verify browsers: {e}", level="warning")

    async def worker(self, browser, queue):
        handler = HostLinkHandler(browser)
        while True:
            link = await queue.get()
            if link is None:
                break

            success = False
            for attempt in range(1, self.max_retries + 2):
                Logger.log(f"[TRY {attempt}] {link}")
                Logger.progress(link, f"attempt_{attempt}", attempt=attempt)

                success = await handler.process(link, self.seen)
                if success:
                    break

                wait_time = attempt * 2
                Logger.log(f"[RETRY WAIT] {wait_time}s")
                await asyncio.sleep(wait_time)

            if not success:
                Logger.log(f"[GAVE UP] {link}", level="error")

            queue.task_done()

    async def run(self, links):
        self.ensure_browsers_installed()
        
        queue = asyncio.Queue()
        for link in links:
            queue.put_nowait(link)

        Logger.log("Starting Playwright...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            tasks = [asyncio.create_task(self.worker(browser, queue)) for _ in range(self.concurrency)]
            
            await queue.join()
            for _ in tasks:
                queue.put_nowait(None)
            await asyncio.gather(*tasks)
            await browser.close()
                
        Logger.log("DONE \u2192 Extraction finished")
        Logger.emit("done")


def main():
    parser = argparse.ArgumentParser(description="Extract download links.")
    parser.add_argument("--input", type=str, help="Path to JSON file containing array of URLs")
    parser.add_argument("--concurrency", type=int, default=5, help="Number of concurrent downloads")
    parser.add_argument("--retries", type=int, default=3, help="Max retries per link")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    args = parser.parse_args()

    links = []
    if args.input:
        try:
            with open(args.input, "r", encoding="utf-8") as f:
                links = json.load(f)
        except Exception as e:
            Logger.log(f"Failed to read input file: {e}", level="error")
            return
    else:
        try:
            with open("links.txt", "r", encoding="utf-8") as f:
                links = [l.strip() for l in f if l.strip()]
        except FileNotFoundError:
            Logger.log("No input provided and links.txt not found.", level="error")
            return

    engine = ExtractorEngine(args.concurrency, args.retries, args.headless)
    asyncio.run(engine.run(links))


if __name__ == "__main__":
    main()
