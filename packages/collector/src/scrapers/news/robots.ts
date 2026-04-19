const ROBOTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MIN_DELAY_MS = 60_000;
const TIER1_MIN_DELAY_MS = 30_000;

export const NEWS_BOT_USER_AGENT = "GlobalPulseBot/1.0 news-research (+mailto:ops@globalpulse.dev)";

interface RobotsRuleSet {
  disallow: string[];
  allow: string[];
  crawlDelaySec?: number;
}

interface RobotsPolicy {
  fetchedAt: number;
  byAgent: Map<string, RobotsRuleSet>;
}

const robotsCache = new Map<string, RobotsPolicy>();
const hostThrottle = new Map<string, number>();

function getEmptyRuleSet(): RobotsRuleSet {
  return {
    disallow: [],
    allow: [],
  };
}

function stripComment(line: string): string {
  const index = line.indexOf("#");
  if (index < 0) {
    return line.trim();
  }
  return line.slice(0, index).trim();
}

export function parseRobotsTxt(content: string): Map<string, RobotsRuleSet> {
  const byAgent = new Map<string, RobotsRuleSet>();
  let activeAgents: string[] = [];

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = stripComment(rawLine);
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (!value) {
      continue;
    }

    if (field === "user-agent") {
      activeAgents = [value.toLowerCase()];
      if (!byAgent.has(activeAgents[0]!)) {
        byAgent.set(activeAgents[0]!, getEmptyRuleSet());
      }
      continue;
    }

    if (activeAgents.length === 0) {
      continue;
    }

    for (const agent of activeAgents) {
      const ruleSet = byAgent.get(agent) ?? getEmptyRuleSet();
      if (field === "disallow") {
        ruleSet.disallow.push(value);
      } else if (field === "allow") {
        ruleSet.allow.push(value);
      } else if (field === "crawl-delay") {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed >= 0) {
          ruleSet.crawlDelaySec = parsed;
        }
      }
      byAgent.set(agent, ruleSet);
    }
  }

  return byAgent;
}

async function loadPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = robotsCache.get(origin);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < ROBOTS_CACHE_TTL_MS) {
    return cached;
  }

  try {
    const response = await fetch(`${origin}/robots.txt`, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": NEWS_BOT_USER_AGENT,
        Accept: "text/plain,text/*;q=0.9,*/*;q=0.5",
      },
    });

    if (!response.ok) {
      const fallback: RobotsPolicy = { fetchedAt: now, byAgent: new Map() };
      robotsCache.set(origin, fallback);
      return fallback;
    }

    const text = await response.text();
    const policy: RobotsPolicy = {
      fetchedAt: now,
      byAgent: parseRobotsTxt(text),
    };
    robotsCache.set(origin, policy);
    return policy;
  } catch {
    const fallback: RobotsPolicy = { fetchedAt: now, byAgent: new Map() };
    robotsCache.set(origin, fallback);
    return fallback;
  }
}

function bestRuleSet(byAgent: Map<string, RobotsRuleSet>, userAgent: string): RobotsRuleSet | null {
  const normalized = userAgent.toLowerCase();
  let best: RobotsRuleSet | null = null;
  let bestLength = -1;

  for (const [agent, rules] of byAgent.entries()) {
    if (agent === "*") {
      if (best === null) {
        best = rules;
      }
      continue;
    }

    if (normalized.includes(agent) && agent.length > bestLength) {
      best = rules;
      bestLength = agent.length;
    }
  }

  return best ?? byAgent.get("*") ?? null;
}

function isPathAllowed(pathname: string, rules: RobotsRuleSet | null): boolean {
  if (!rules) {
    return true;
  }

  let bestDisallowLength = -1;
  for (const disallow of rules.disallow) {
    if (!disallow) {
      continue;
    }
    if (pathname.startsWith(disallow) && disallow.length > bestDisallowLength) {
      bestDisallowLength = disallow.length;
    }
  }

  if (bestDisallowLength < 0) {
    return true;
  }

  let bestAllowLength = -1;
  for (const allow of rules.allow) {
    if (!allow) {
      continue;
    }
    if (pathname.startsWith(allow) && allow.length > bestAllowLength) {
      bestAllowLength = allow.length;
    }
  }

  return bestAllowLength >= bestDisallowLength;
}

async function throttleHost(origin: string, minDelayMs: number): Promise<void> {
  const now = Date.now();
  const nextAllowedAt = hostThrottle.get(origin) ?? now;
  const waitMs = Math.max(0, nextAllowedAt - now);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  hostThrottle.set(origin, Date.now() + minDelayMs);
}

export async function guardNewsRequest(targetUrl: string, trustTier: number | undefined): Promise<void> {
  const parsed = new URL(targetUrl);
  const policy = await loadPolicy(parsed.origin);
  const rules = bestRuleSet(policy.byAgent, NEWS_BOT_USER_AGENT);
  const allowed = isPathAllowed(parsed.pathname, rules);

  if (!allowed) {
    throw new Error(`robots_disallow: ${parsed.pathname}`);
  }

  const tierMinDelay = trustTier === 1 ? TIER1_MIN_DELAY_MS : DEFAULT_MIN_DELAY_MS;
  const crawlDelayMs = rules?.crawlDelaySec ? Math.ceil(rules.crawlDelaySec * 1000) : 0;
  const minDelayMs = Math.max(tierMinDelay, crawlDelayMs);
  await throttleHost(parsed.origin, minDelayMs);
}

export function __resetRobotsCacheForTest(): void {
  robotsCache.clear();
  hostThrottle.clear();
}
