import fs from "node:fs/promises";
import path from "node:path";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import { getLogger } from "@global-pulse/shared/server-logger";

type SourcePolicyType = "disable-now" | "disable-until-fixed" | "keep-active-observe";

interface SourcePolicyRow {
  sourceId: string;
  policy: SourcePolicyType;
  reason: string;
  alternatives: string[];
}

interface SourceStateRow {
  id: string;
  is_active: boolean;
  region_id: string;
  type: "community" | "sns" | "news";
}

const logger = getLogger("apply-source-policy");

const POLICY_ROWS: readonly SourcePolicyRow[] = [
  {
    sourceId: "naver_news_ranking",
    policy: "disable-now",
    reason: "robots_disallow",
    alternatives: ["daum_news_ranking", "yonhap_kr", "kbs_news_rss", "ytn_rss"],
  },
  {
    sourceId: "punch_rss",
    policy: "disable-now",
    reason: "http_403",
    alternatives: ["thisday_rss"],
  },
  {
    sourceId: "iol_rss",
    policy: "disable-now",
    reason: "http_403",
    alternatives: ["news24_rss"],
  },
  {
    sourceId: "reddit_russia",
    policy: "disable-now",
    reason: "reddit_403",
    alternatives: ["reddit_russian", "reddit_ukraine", "habr"],
  },
  {
    sourceId: "reuters_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["ap_rss", "cnn_rss", "npr_rss"],
  },
  {
    sourceId: "reuters_uk_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["bbc_rss", "guardian_rss", "euronews_rss"],
  },
  {
    sourceId: "reuters_mideast_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["aljazeera_rss", "bbc_arabic_rss"],
  },
  {
    sourceId: "nikkei_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["yomiuri_rss", "asahi_rss", "mainichi_rss"],
  },
  {
    sourceId: "kompas_rss",
    policy: "disable-until-fixed",
    reason: "http_404",
    alternatives: ["antara_rss", "detik_rss"],
  },
  {
    sourceId: "pti_rss",
    policy: "disable-until-fixed",
    reason: "empty_rss",
    alternatives: ["thehindu_rss", "timesofindia_rss", "ndtv_rss"],
  },
  {
    sourceId: "joongang_rss",
    policy: "disable-until-fixed",
    reason: "empty_rss",
    alternatives: ["chosun_rss", "hankyoreh_rss", "yonhap_kr"],
  },
  {
    sourceId: "cbc_rss",
    policy: "keep-active-observe",
    reason: "timeout",
    alternatives: ["globeandmail_rss"],
  },
  {
    sourceId: "yandex_news_trending",
    policy: "keep-active-observe",
    reason: "timeout",
    alternatives: ["mail_ru_news", "tass_rss", "meduza_rss"],
  },
] as const;

function parseArg(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
}

function toMarkdown(rows: readonly SourcePolicyRow[]): string {
  const lines: string[] = [];
  lines.push("# Source Policy Plan");
  lines.push("");
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- targets: ${rows.length}`);
  lines.push("");
  lines.push("| Source ID | Policy | Reason | Alternatives |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(`| ${row.sourceId} | ${row.policy} | ${row.reason} | ${row.alternatives.join(", ")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function applySourcePolicies(): Promise<SourceStateRow[]> {
  if (!hasPostgresConfig()) {
    throw new Error(
      "PostgreSQL configuration missing. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.",
    );
  }

  const pool = createPostgresPool();
  const disableIds = POLICY_ROWS.filter((row) => row.policy !== "keep-active-observe").map((row) => row.sourceId);
  const observeIds = POLICY_ROWS.filter((row) => row.policy === "keep-active-observe").map((row) => row.sourceId);
  const targetIds = POLICY_ROWS.map((row) => row.sourceId);

  await pool.query(
    `
    update sources
    set is_active = false
    where id = any($1::text[])
    `,
    [disableIds],
  );

  await pool.query(
    `
    update sources
    set is_active = true
    where id = any($1::text[])
    `,
    [observeIds],
  );

  const { rows } = await pool.query<SourceStateRow>(
    `
    select id, is_active, region_id, type
    from sources
    where id = any($1::text[])
    order by region_id asc, id asc
    `,
    [targetIds],
  );

  return rows;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const confirm = process.argv.includes("--confirm");
  const printOnly = process.argv.includes("--print");
  const format = parseArg("--format") === "json" ? "json" : "md";
  const outPath = path.resolve(
    parseArg("--out") ??
      path.join("docs", "source-notes", `source-policy-plan.${format === "json" ? "json" : "md"}`),
  );

  if (apply && !confirm) {
    throw new Error("Refusing source policy update without --confirm.");
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    apply,
    rows: POLICY_ROWS,
  };

  if (printOnly) {
    process.stdout.write(
      format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : `${toMarkdown(POLICY_ROWS)}\n`,
    );
  } else {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(
      outPath,
      format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : `${toMarkdown(POLICY_ROWS)}\n`,
      "utf8",
    );
    logger.info(`Source policy plan written: ${outPath.replace(/\\/g, "/")}`);
  }

  if (!apply) {
    return;
  }

  const states = await applySourcePolicies();
  const summary = {
    total: states.length,
    active: states.filter((row) => row.is_active).length,
    disabled: states.filter((row) => !row.is_active).length,
  };

  logger.info(
    `Source policy applied: total=${summary.total} active=${summary.active} disabled=${summary.disabled}`,
  );
  process.stdout.write(`${JSON.stringify({ summary, states }, null, 2)}\n`);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
