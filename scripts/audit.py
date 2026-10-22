"""Browser audit for the built site: console errors, failed requests, horizontal overflow,
basic interactions, and screenshots. Usage:

    python scripts/audit.py [--base http://127.0.0.1:8791/frontier-prep/] [--shots docs/screenshots/]

Exits 1 on any console error, failed request to our own origin, or overflow.
"""
import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

PAGES = ["index.html", "roadmap.html", "practice.html", "questions.html", "resources.html", "companies.html", "feed.html", "jobs.html"]
WIDTHS = [390, 1024, 1440]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8791/frontier-prep/")
    parser.add_argument("--shots", default=None)
    parser.add_argument("--browser", default="chromium")
    args = parser.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    failures: list[str] = []
    report: dict = {"base": base, "pages": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge") if args.browser == "msedge" else p.chromium.launch()
        for page_name in PAGES:
            console_errors: list[str] = []
            failed_requests: list[str] = []
            page_report: dict = {}
            for width in WIDTHS:
                for theme in ("light", "dark"):
                    context = browser.new_context(viewport={"width": width, "height": 900}, color_scheme="dark", reduced_motion="reduce")
                    page = context.new_page()
                    page.on("console", lambda msg, errs=console_errors: errs.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
                    page.on("pageerror", lambda err, errs=console_errors: errs.append(f"pageerror: {err}"))
                    page.on("requestfailed", lambda req, fails=failed_requests: fails.append(f"{req.url} {req.failure}") if req.url.startswith(base) else None)
                    page.on("response", lambda res, fails=failed_requests: fails.append(f"{res.url} {res.status}") if res.url.startswith(base) and res.status >= 400 else None)
                    if theme == "dark":
                        page.add_init_script("localStorage.setItem('frontier-prep.v1.theme', JSON.stringify('dark'))")
                    else:
                        page.add_init_script("localStorage.removeItem('frontier-prep.v1.theme')")
                    page.goto(base + page_name, wait_until="networkidle")
                    page.wait_for_timeout(300)
                    metrics = page.evaluate(
                        """() => ({
                            theme: document.documentElement.dataset.theme,
                            bg: getComputedStyle(document.body).backgroundColor,
                            bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
                            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
                            scrollWidth: document.documentElement.scrollWidth,
                            clientWidth: document.documentElement.clientWidth,
                            h1: document.querySelector('h1')?.textContent?.trim() || null,
                            cards: document.querySelectorAll('.card, .item').length,
                            emptyBoxes: document.querySelectorAll('.empty').length,
                            smallControls: [...document.querySelectorAll('button, select, input:not([type=checkbox]):not(.sr-only)')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).length,
                        })"""
                    )
                    key = f"{width}-{theme}"
                    page_report[key] = metrics
                    if metrics["overflow"]:
                        failures.append(f"{page_name} {key}: horizontal overflow {metrics['scrollWidth']} > {metrics['clientWidth']}")
                    if theme == "light" and metrics["theme"] != "light":
                        failures.append(f"{page_name} {key}: first paint theme is {metrics['theme']} (OS dark emulated)")
                    if theme == "dark" and metrics["theme"] != "dark":
                        failures.append(f"{page_name} {key}: stored dark theme not applied")
                    if width == 390 and metrics["bodyFont"] < 17:
                        failures.append(f"{page_name} {key}: body font {metrics['bodyFont']}px < 17")
                    if metrics["smallControls"]:
                        failures.append(f"{page_name} {key}: {metrics['smallControls']} controls under 40px tall")
                    if shots and width in (390, 1440):
                        page.screenshot(path=str(shots / f"{page_name.replace('.html', '')}-{width}-{theme}.png"), full_page=False)
                    context.close()
            # Interactions on a desktop light context.
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            page.on("pageerror", lambda err, errs=console_errors: errs.append(f"pageerror: {err}"))
            page.goto(base + page_name, wait_until="networkidle")
            page.wait_for_timeout(200)
            interactions = {}
            if page_name == "practice.html":
                page.click("#draw")
                interactions["prompt"] = page.inner_text("#prompt")[:80]
                page.click("#start")
                page.wait_for_timeout(1500)
                interactions["timer"] = page.inner_text("#timer")
                page.click("#log")
                interactions["history_rows"] = page.locator("#history tbody tr").count()
            if page_name == "questions.html":
                page.select_option("#company", "anthropic")
                page.wait_for_timeout(200)
                interactions["anthropic_count"] = page.inner_text("#count")
                page.locator("#list input[type=checkbox]").first.check()
                interactions["practiced"] = page.inner_text("#count")
            if page_name == "resources.html":
                page.fill("#q", "karpathy")
                page.wait_for_timeout(400)
                interactions["search"] = page.inner_text("#count")
                page.click("[data-view=discovered]")
                page.wait_for_timeout(200)
                interactions["discovered_items"] = page.locator("#disc-list .item").count()
            if page_name == "roadmap.html":
                page.locator("#phases input[type=checkbox]").first.check()
                page.reload(wait_until="networkidle")
                interactions["persisted"] = page.locator("#phases input[type=checkbox]").first.is_checked()
            if page_name == "feed.html":
                interactions["source_rows"] = page.locator("#sources tbody tr").count()
                interactions["items"] = page.locator("#list .item").count()
            if page_name == "jobs.html":
                interactions["india_roles"] = page.locator("#list .item").count()
                page.select_option("#loc", "")
                page.wait_for_timeout(200)
                interactions["all_roles"] = page.locator("#list .item").count()
            if page_name == "index.html":
                page.keyboard.press("t")
                interactions["theme_after_t"] = page.evaluate("document.documentElement.dataset.theme")
            page_report["interactions"] = interactions
            context.close()
            page_report["console_errors"] = console_errors
            page_report["failed_requests"] = failed_requests
            for e in console_errors:
                failures.append(f"{page_name}: {e}")
            for f in failed_requests:
                failures.append(f"{page_name}: request {f}")
            report["pages"][page_name] = page_report
        browser.close()

    report["failures"] = failures
    Path("docs").mkdir(exist_ok=True)
    Path("docs/audit-report.json").write_text(json.dumps(report, indent=2))
    for name, pr in report["pages"].items():
        light = pr["1440-light"]
        print(f"{name:16} h1={light['h1']!r:60} cards={light['cards']:4} empty={light['emptyBoxes']} interactions={pr['interactions']}")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print("  ", f)
        return 1
    print("\nno failures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
