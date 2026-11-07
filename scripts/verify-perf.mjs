#!/usr/bin/env node
/**
 * Measures Core Web Vitals on the built site under throttled conditions —
 * Lighthouse's "slow 4G" profile plus 4x CPU throttling — and fails if LCP or
 * CLS misses the Phase 2 targets (LCP < 2.5 s, CLS < 0.1).
 *
 *   pnpm build:fixture && pnpm verify:perf
 *
 * Field numbers on real phones will differ; this is a regression guard, not a
 * promise about a specific device.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createReporter, goto, launchBrowser, startStaticServer } from "./lib/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "site", "out");
const PORT = 8125;

if (!fs.existsSync(OUT)) {
  console.error("site/out does not exist — run pnpm build (or pnpm build:fixture) first.");
  process.exit(1);
}

// Lighthouse's mobile "slow 4G": 1.6 Mbps down, 750 kbps up, 150 ms RTT.
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

const OBSERVER = `(() => {
  window.__vitals = { lcp: 0, cls: 0, lcpElement: "" };
  /**
   * A CLS number without the element that moved is a number nobody can act on, so the
   * worst shift keeps its source node and the run prints it.
   */
  const noteShift = (value, entry) => {
    if (value <= (window.__vitals.worstShift?.value ?? 0)) return;
    const source = entry.sources && entry.sources[0] && entry.sources[0].node;
    window.__vitals.worstShift = {
      value: Number(value.toFixed(4)),
      node: source ? source.tagName + "." + (source.className || "").toString().slice(0, 32) : "unknown",
    };
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__vitals.lcp = entry.startTime;
        window.__vitals.lcpElement = entry.element ? entry.element.tagName + "." + (entry.element.className || "").toString().slice(0, 24) : "";
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__vitals.cls += entry.value;
        noteShift(entry.value, entry);
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (error) {
    window.__vitals.error = String(error);
  }
})()`;

const PAGES = [
  { url: "/", name: "home" },
  { url: "/8-12/adventure/the-first-lantern/", name: "story" },
  { url: "/classics/", name: "index" },
  // The wall is the site's heaviest client surface: every card is in the DOM, and the
  // search/filter toolbar is hydration-only. Measured like any other page, so a
  // regression in the wall cannot hide behind a good homepage score (ADR-0009).
  { url: "/browse/", name: "browse" },
];

const reporter = createReporter();
const server = await startStaticServer(OUT, PORT);
const { cdp, close } = await launchBrowser({ workspace: ROOT, port: 8126, debuggingPort: 9334 });

try {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVER });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);

  // Warm the connection to the origin the way a real first visit would not be:
  // no pre-warming, each page is a genuine cold-ish load on a throttled link.
  for (const page of PAGES) {
    await goto(cdp, server.origin, page.url, { settle: 0 });
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const vitals = await cdp.evaluate("JSON.parse(JSON.stringify(window.__vitals ?? {}))");
    const weight = await cdp.evaluate(`(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const bytes = resources.reduce((total, entry) => total + (entry.transferSize || 0), 0);
      return { transferKB: Math.round((bytes + (nav?.transferSize || 0)) / 1024), requests: resources.length };
    })()`);

    const lcp = Math.round(vitals.lcp ?? 0);
    const cls = Number((vitals.cls ?? 0).toFixed(4));
    if (vitals.worstShift) {
      console.log("    worst shift " + vitals.worstShift.value + " on " + vitals.worstShift.node);
    }
    reporter.check(
      `${page.name}: LCP ${lcp} ms on slow 4G (target < 2500)`,
      lcp > 0 && lcp < 2500,
      `element=${vitals.lcpElement || "unknown"} · ${weight.transferKB} KB over ${weight.requests} requests`,
    );
    reporter.check(`${page.name}: CLS ${cls} (target < 0.1)`, cls < 0.1);
  }
} finally {
  close();
  server.close();
}

reporter.finish();
