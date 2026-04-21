import { SOURCES } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type CommunitySource = (typeof SOURCES)[number] & { type: "community" | "sns" };

interface VerifyResult {
  sourceId: string;
  regionId: string;
  type: "community" | "sns";
  url: string;
  status: number | null;
  itemCount: number;
  ok: boolean;
  reason: string;
}

const logger = getLogger("verify-community-feeds");
const REQUEST_TIMEOUT_MS = Math.max(Number(process.env.VERIFY_COMMUNITY_TIMEOUT_MS ?? 15_000), 5_000);
const MAX_CONCURRENCY = Math.max(1, Math.min(Number(process.env.VERIFY_COMMUNITY_CONCURRENCY ?? 4), 12));
const USER_AGENT = "GlobalPulseBot/1.0 community-monitor (+mailto:ops@globalpulse.dev)";

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function parseListArg(...flags: string[]): string[] {
  const values = flags.flatMap((flag) => {
    const raw = parseArg(flag);
    if (!raw) {
      return [];
    }
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });

  return [...new Set(values)];
}

function toAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function countRssItems(text: string): number {
  const itemMatches = text.match(/<item[\s>]/gi)?.length ?? 0;
  const entryMatches = text.match(/<entry[\s>]/gi)?.length ?? 0;
  return Math.max(itemMatches, entryMatches);
}

function countHtmlAnchors(text: string): number {
  return text.match(/<a[\s>]/gi)?.length ?? 0;
}

function countJsonItems(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    return 0;
  }

  const asRecord = payload as Record<string, unknown>;
  const redditChildren = (asRecord.data as { children?: unknown[] } | undefined)?.children;
  if (Array.isArray(redditChildren)) {
    return redditChildren.length;
  }

  if (Array.isArray(asRecord.items)) {
    return asRecord.items.length;
  }
  if (Array.isArray(asRecord.data)) {
    return asRecord.data.length;
  }
  if (Array.isArray(asRecord.results)) {
    return asRecord.results.length;
  }
  return 0;
}

async function probeSource(source: CommunitySource): Promise<VerifyResult> {
  const signal = toAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(source.scrapeUrl, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, application/rss+xml, application/atom+xml, text/html,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        sourceId: source.id,
        regionId: source.regionId,
        type: source.type,
        url: source.scrapeUrl,
        status: response.status,
        itemCount: 0,
        ok: false,
        reason: `http_${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const raw = await response.text();

    let itemCount = 0;
    if (contentType.includes("json") || source.scrapeUrl.endsWith(".json") || source.scrapeUrl.includes("/json")) {
      try {
        itemCount = countJsonItems(JSON.parse(raw));
      } catch {
        itemCount = 0;
      }
    } else if (
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      source.scrapeUrl.includes("rss") ||
      source.scrapeUrl.endsWith(".xml")
    ) {
      itemCount = countRssItems(raw);
    } else {
      itemCount = countHtmlAnchors(raw);
    }

    const ok = itemCount >= 5;
    return {
      sourceId: source.id,
      regionId: source.regionId,
      type: source.type,
      url: source.scrapeUrl,
      status: response.status,
      itemCount,
      ok,
      reason: ok ? "ok" : "insufficient_items",
    };
  } catch (error) {
    return {
      sourceId: source.id,
      regionId: source.regionId,
      type: source.type,
      url: source.scrapeUrl,
      status: null,
      itemCount: 0,
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runWorkers(queue: CommunitySource[], results: VerifyResult[]): Promise<void> {
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) {
      return;
    }
    results.push(await probeSource(source));
  }
}

async function applyActivation(results: VerifyResult[]): Promise<void> {
  if (!hasPostgresConfig()) {
    throw new Error("Cannot apply activation: PostgreSQL configuration is missing.");
  }

  const okSourceIds = results.filter((result) => result.ok).map((result) => result.sourceId);
  const targetSourceIds = results.map((result) => result.sourceId);
  if (targetSourceIds.length === 0) {
    return;
  }

  const pool = createPostgresPool();
  await pool.query(
    `
    update sources
    set is_active = (id = any($2::text[]))
    where id = any($1::text[])
    `,
    [targetSourceIds, okSourceIds],
  );
}

async function main(): Promise<void> {
  const regionFilter = parseArg("--region");
  const sourceIds = parseListArg("--source", "--sources");
  const apply = process.argv.includes("--apply");

  const sources = SOURCES.filter((source) => {
    if (source.type !== "community" && source.type !== "sns") {
      return false;
    }
    if (regionFilter && source.regionId !== regionFilter) {
      return false;
    }
    if (sourceIds.length > 0 && !sourceIds.includes(source.id)) {
      return false;
    }
    return true;
  }) as CommunitySource[];

  const queue = [...sources];
  const results: VerifyResult[] = [];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length || 1) }, () =>
    runWorkers(queue, results),
  );
  await Promise.all(workers);

  const sorted = [...results].sort((a, b) => a.regionId.localeCompare(b.regionId) || a.sourceId.localeCompare(b.sourceId));

  if (apply) {
    await applyActivation(sorted);
  }

  const summary = {
    total: sorted.length,
    region: regionFilter ?? "all",
    sources: sourceIds,
    connected: sorted.filter((result) => result.ok).length,
    degraded: sorted.filter((result) => !result.ok).length,
    activated: apply ? sorted.filter((result) => result.ok).length : 0,
    timestamp: new Date().toISOString(),
  };

  logger.info(
    `community_feed_verification total=${summary.total} connected=${summary.connected} degraded=${summary.degraded} apply=${apply}`,
  );
  process.stdout.write(`${JSON.stringify({ summary, results: sorted }, null, 2)}\n`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
