#!/usr/bin/env python3
"""A small localhost app for inspecting the browser's User-Agent header."""

from __future__ import annotations

import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


HOST = "127.0.0.1"
PORT = 8000

PAGE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>User-Agent Inspector</title>
  <style>
    :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
    body { max-width: 760px; margin: 3rem auto; padding: 0 1rem; }
    h1 { margin-bottom: .25rem; }
    .muted { color: GrayText; }
    #results { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: .75rem; margin: 1.5rem 0; }
    .card { border: 1px solid GrayText; border-radius: 8px; padding: 1rem; }
    .label { display: block; color: GrayText; font-size: .85rem; }
    .value { overflow-wrap: anywhere; font-weight: 600; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 1rem; border: 1px solid GrayText; border-radius: 8px; }
    #error { color: #c33; }
  </style>
</head>
<body>
  <h1>User-Agent Inspector</h1>
  <p class="muted">Details detected from the User-Agent header sent by this browser.</p>
  <p id="error" role="alert"></p>
  <section id="results" aria-live="polite"></section>
  <h2>Raw User-Agent</h2>
  <pre id="raw">Loading…</pre>
  <p class="muted">User-Agent values are self-reported by the browser and can be reduced, changed, or spoofed.</p>
  <script>
    async function load() {
      const error = document.getElementById("error");
      try {
        const response = await fetch("/api");
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        const labels = [
          ["Browser", data.browser],
          ["Browser version", data.browser_version],
          ["Operating system", data.operating_system],
          ["Device", data.device],
          ["Engine", data.engine],
          ["Architecture hint", data.architecture],
          ["Mobile", data.is_mobile ? "Yes" : "No"],
          ["Bot/crawler hint", data.is_bot ? "Yes" : "No"]
        ];
        const results = document.getElementById("results");
        results.replaceChildren(...labels.map(([label, value]) => {
          const card = document.createElement("div");
          card.className = "card";
          const labelNode = document.createElement("span");
          labelNode.className = "label";
          labelNode.textContent = label;
          const valueNode = document.createElement("span");
          valueNode.className = "value";
          valueNode.textContent = value;
          card.append(labelNode, valueNode);
          return card;
        }));
        document.getElementById("raw").textContent = data.user_agent || "(empty)";
      } catch (e) {
        error.textContent = `Could not read User-Agent details: ${e.message}`;
      }
    }
    load();
  </script>
</body>
</html>
"""


def _first_match(pattern: str, user_agent: str, group: int = 1) -> str | None:
    match = re.search(pattern, user_agent, re.IGNORECASE)
    return match.group(group) if match else None


def _browser(user_agent: str) -> tuple[str, str]:
    # Check Chromium-based alternatives before Chrome, which they also identify as.
    patterns = (
        (r"(?:EdgA?|EdgiOS|Edg)/([\d.]+)", "Microsoft Edge"),
        (r"(?:OPR)/([\d.]+)", "Opera"),
        (r"(?:SamsungBrowser)/([\d.]+)", "Samsung Internet"),
        (r"(?:UCBrowser|UCWEB)/([\d.]+)", "UC Browser"),
        (r"(?:YaBrowser)/([\d.]+)", "Yandex Browser"),
        (r"(?:CriOS)/([\d.]+)", "Google Chrome"),
        (r"(?:FxiOS)/([\d.]+)", "Mozilla Firefox"),
        (r"(?:Firefox)/([\d.]+)", "Mozilla Firefox"),
        (r"(?:Chrome|Chromium)/([\d.]+)", "Google Chrome"),
        (r"(?:Version)/([\d.]+).*Safari", "Safari"),
        (r"(?:MSIE )([\d.]+)", "Internet Explorer"),
        (r"(?:Trident/.*rv:)([\d.]+)", "Internet Explorer"),
    )
    for pattern, name in patterns:
        version = _first_match(pattern, user_agent)
        if version:
            return name, version
    return "Unknown", "Unknown"


def _operating_system(user_agent: str) -> str:
    windows_versions = (
        (r"Windows NT 10\.0", "Windows 10/11"),
        (r"Windows NT 6\.3", "Windows 8.1"),
        (r"Windows NT 6\.2", "Windows 8"),
        (r"Windows NT 6\.1", "Windows 7"),
    )
    for pattern, name in windows_versions:
        if re.search(pattern, user_agent, re.IGNORECASE):
            return name

    checks = (
        (r"Windows Phone(?: OS)? ([\d.]+)", "Windows Phone"),
        (r"Android[ /-]([\d.]+)", "Android"),
        (r"(?:iPhone|iPad|iPod).*?OS ([\d_]+)", "iOS"),
        (r"Mac OS X ([\d_]+)", "macOS"),
        (r"CrOS [^ ]+ ([\d.]+)", "ChromeOS"),
    )
    for pattern, name in checks:
        version = _first_match(pattern, user_agent)
        if version:
            return f"{name} {version.replace('_', '.')}".strip()
    if "Android" in user_agent:
        return "Android (version unknown)"
    if "Windows" in user_agent:
        return "Windows (version unknown)"
    if "Macintosh" in user_agent or "Mac OS" in user_agent:
        return "macOS (version unknown)"
    if "Linux" in user_agent or "X11" in user_agent:
        return "Linux"
    return "Unknown"


def _device(user_agent: str) -> tuple[str, bool]:
    if re.search(r"iPad|Tablet|Kindle|Silk/", user_agent, re.IGNORECASE):
        return "Tablet", True
    if re.search(r"iPhone|iPod|Android|Mobile|Windows Phone", user_agent, re.IGNORECASE):
        return "Mobile", True
    if re.search(r"Macintosh|Windows|Linux|X11|CrOS", user_agent, re.IGNORECASE):
        return "Desktop", False
    return "Unknown", False


def _engine(user_agent: str) -> str:
    if "Trident/" in user_agent:
        return "Trident"
    if "AppleWebKit/" in user_agent:
        if re.search(r"(?:Chrome|Chromium|Edg|OPR)/", user_agent):
            return "Blink (Chromium)"
        return "WebKit"
    if "Gecko/" in user_agent and "like Gecko" not in user_agent:
        return "Gecko"
    return "Unknown"


def inspect_user_agent(user_agent: str) -> dict[str, Any]:
    browser, browser_version = _browser(user_agent)
    device, is_mobile = _device(user_agent)
    if re.search(r"(?:x86_64|Win64|WOW64|x64|amd64)", user_agent, re.IGNORECASE):
        architecture = "64-bit (hint)"
    elif re.search(r"(?:i[3-6]86|x86)", user_agent, re.IGNORECASE):
        architecture = "32-bit (hint)"
    else:
        architecture = "Not exposed"
    return {
        "user_agent": user_agent,
        "browser": browser,
        "browser_version": browser_version,
        "operating_system": _operating_system(user_agent),
        "device": device,
        "engine": _engine(user_agent),
        "architecture": architecture,
        "is_mobile": is_mobile,
        "is_bot": bool(re.search(r"bot|crawler|spider|slurp|headless", user_agent, re.IGNORECASE)),
    }


class UserAgentHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/":
            body = PAGE.encode("utf-8")
            content_type = "text/html; charset=utf-8"
        elif self.path == "/api":
            user_agent = self.headers.get("User-Agent", "")
            body = json.dumps(inspect_user_agent(user_agent)).encode("utf-8")
            content_type = "application/json; charset=utf-8"
        else:
            self.send_error(404, "Not found")
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"User-Agent Inspector running at http://{HOST}:{PORT}/")
    print("Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), UserAgentHandler).serve_forever()
