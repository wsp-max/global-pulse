import { NEWS_SOURCES } from "@global-pulse/shared";
import { getLogger } from "@global-pulse/shared/server-logger";

const logger = getLogger("verify-news-feeds");
const REQUEST_TIMEOUT_MS = Number(process.env.VERIFY_NEWS_FEEDS_TIMEOUT_MS ?? 12_000);
const MAX_CONCURRENCY = Math.max(1, Math.min(Number(process.env.VERIFY_NEWS_FEEDS_CONCURRENCY ?? 4), 12));

interface FeedProbeResult {
  sourceId: string;
  regionId: string;
  feedKind: string;
  status: number | null;
  ok: boolean;
  shouldActivate: boolean;
  message: string;
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

  if (!signal) {
    timeoutController.signal.addEventListener("abort", () => clearTimeout(timeout), { once: true });
    return timeoutController.signal;
  }

  const merged = new AbortController();
  const abort = () => merged.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeoutController.signal.addEventListener("abort", abort, { once: true });
  merged.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      timeoutController.signal.removeEventListener("abort", abort);
    },
    { once: true },
  );
  return merged.signal;
}

async function probeUrl(url: string): Promise<{ status: number | null; ok: boolean; message: string }> {
  const signal = withTimeout(undefined, REQUEST_TIMEOUT_MS);

  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent": "GlobalPulseBot/1.0 news-research (+mailto:ops@globalpulse.dev)",
        Accept: "application/rss+xml, application/atom+xml, application/json, text/html;q=0.9,*/*;q=0.8",
      },
    });
    if (head.ok || [401, 403, 405].includes(head.status)) {
      if (head.ok) {
        return { status: head.status, ok: true, message: "HEAD ok" };
      }
      const getResp = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: withTimeout(undefined, REQUEST_TIMEOUT_MS),
        headers: {
          "User-Agent": "GlobalPulseBot/1.0 news-research (+mailto:ops@globalpulse.dev)",
          Accept: "application/rss+xml, application/atom+xml, application/json, text/html;q=0.9,*/*;q=0.8",
        },
      });
      return {
        status: getResp.status,
        ok: getResp.ok,
        message: getResp.ok ? "GET fallback ok" : "GET fallback failed",
      };
    }

    return {
      status: head.status,
      ok: false,
      message: `HEAD failed (${head.status})`,
    };
  } catch (error) {
    return {
      status: null,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runWorker(queue: Array<(typeof NEWS_SOURCES)[number]>, results: FeedProbeResult[]): Promise<void> {
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) {
      return;
    }

    const probe = await probeUrl(source.scrapeUrl);
    results.push({
      sourceId: source.id,
      regionId: source.regionId,
      feedKind: source.feedKind ?? "unknown",
      status: probe.status,
      ok: probe.ok,
      shouldActivate: probe.ok && source.isActive !== false,
      message: probe.message,
    });
  }
}

async function main(): Promise<void> {
  const queue = [...NEWS_SOURCES];
  const results: FeedProbeResult[] = [];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, () =>
    runWorker(queue, results),
  );
  await Promise.all(workers);

  const sorted = [...results].sort((a, b) => {
    return a.regionId.localeCompare(b.regionId) || a.sourceId.localeCompare(b.sourceId);
  });

  const summary = {
    total: sorted.length,
    reachable: sorted.filter((result) => result.ok).length,
    shouldActivate: sorted.filter((result) => result.shouldActivate).length,
    timestamp: new Date().toISOString(),
  };

  logger.info(`news_feed_verification total=${summary.total} reachable=${summary.reachable}`);
  process.stdout.write(`${JSON.stringify({ summary, results: sorted }, null, 2)}\n`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
