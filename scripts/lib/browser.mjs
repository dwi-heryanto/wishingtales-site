/**
 * Shared harness for the browser-based checks: a static file server for the
 * exported site, a headless Chrome launched with the DevTools protocol, and a
 * tiny check reporter. Used by verify-reader.mjs and verify-perf.mjs.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  console.error("No Chrome found. Set CHROME_PATH to a Chromium-based browser.");
  process.exit(1);
}

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

export async function startStaticServer(outDir, port) {
  const origin = `http://127.0.0.1:${port}`;
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(new URL(request.url, origin).pathname);
    const files = [path.join(outDir, url), path.join(outDir, url, "index.html"), path.join(outDir, url + ".html")];
    const file = files.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }

    // Cloudflare Pages serves text assets brotli/gzip compressed. Without this
    // the measurements would be roughly three times the real transfer size.
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const body = fs.readFileSync(file);
    const wantsGzip = /\bgzip\b/.test(request.headers["accept-encoding"] ?? "");
    if (wantsGzip && COMPRESSIBLE.test(type)) {
      const compressed = zlib.gzipSync(body, { level: 6 });
      response.writeHead(200, {
        "content-type": type,
        "content-encoding": "gzip",
        "content-length": compressed.length,
      });
      response.end(compressed);
      return;
    }
    response.writeHead(200, { "content-type": type, "content-length": body.length });
    response.end(body);
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { origin, close: () => server.close() };
}

export class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = reject;
    });
    const cdp = new Cdp(socket);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.pending.has(message.id)) {
        const { resolve, reject } = cdp.pending.get(message.id);
        cdp.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    };
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "evaluation failed");
    }
    return result.result?.value;
  }
}

export async function launchBrowser({ workspace, port = 9333, debuggingPort = 9333 }) {
  let lastError;
  /*
   * A cold GitHub runner occasionally starts Chrome too slowly, or a previous test leaves a
   * profile that the next one cannot lock. The failure is "did not expose a debugging
   * target", which then fails verify-reader/adult/pagination after the build has passed.
   * Three attempts with a fresh profile and port cost nothing when the first works.
   */
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await launchBrowserOnce({ workspace, port, debuggingPort: debuggingPort + attempt * 10 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

async function launchBrowserOnce({ workspace, port, debuggingPort }) {
  const chromePath = findChrome();
  const profile = path.join(workspace, ".cache", `chrome-${port}-${debuggingPort}`);
  fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      // Containers often have a tiny /dev/shm, which is a classic headless-Chrome start
      // failure; this makes it use /tmp instead.
      "--disable-dev-shm-usage",
      "--disable-crash-reporter",
      "--disable-breakpad",
      `--crash-dumps-dir=${path.join(workspace, ".cache", "chrome-crash")}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      `--remote-debugging-port=${debuggingPort}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  chrome.stderr.on("data", () => {});

  try {
    let target = null;
    for (let attempt = 0; attempt < 80 && !target; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        const list = await (await fetch(`http://127.0.0.1:${debuggingPort}/json/list`)).json();
        target = list.find((entry) => entry.type === "page");
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error("headless Chrome did not expose a debugging target on port " + debuggingPort);

    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");

    return {
      cdp,
      close: () => chrome.kill("SIGKILL"),
    };
  } catch (error) {
    chrome.kill("SIGKILL");
    throw error;
  }
}

/** Navigates and waits for the load event plus a short settle. */
export async function goto(cdp, origin, url, { settle = 250 } = {}) {
  await cdp.send("Page.navigate", { url: origin + url });
  await waitFor(async () => await cdp.evaluate("document.readyState === 'complete'"));
  if (settle) await new Promise((resolve) => setTimeout(resolve, settle));
}

export async function waitFor(predicate, timeout = 4000, interval = 60) {
  const started = Date.now();
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() - started > timeout) return false;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

export function createReporter() {
  const results = [];
  return {
    check(name, ok, detail = "") {
      results.push({ name, ok, detail });
      console.log((ok ? "  ✔ " : "  ✘ ") + name + (detail ? " — " + detail : ""));
    },
    finish() {
      const failed = results.filter((result) => !result.ok);
      console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
      if (failed.length > 0) {
        console.error("\nFailed:");
        for (const result of failed) console.error("  ✘ " + result.name + (result.detail ? " — " + result.detail : ""));
        process.exit(1);
      }
      process.exit(0);
    },
  };
}
