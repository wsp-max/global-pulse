import type { ScraperResult } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import type { Pool } from "pg";
import { Logger } from "./logger";

export interface PersistScraperResultOutcome {
  persisted: boolean;
  insertedCount: number;
  errorMessage?: string;
}

function toIsoTimestamp(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function clampBodyPreview(value: string | undefined | null, maxLength = 280): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 3)).trim()}...`;
}

let postgresClientReady = true;
let postgresPool: Pool | null = null;

function getPostgresClient(): Pool | null {
  if (!postgresClientReady) {
    return null;
  }

  if (!hasPostgresConfig()) {
    return null;
  }

  try {
    if (!postgresPool) {
      postgresPool = createPostgresPool();
    }
    return postgresPool;
  } catch (error) {
    postgresClientReady = false;
    Logger.warn(
      `PostgreSQL persistence disabled: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

async function persistWithPostgres(
  pool: Pool,
  result: ScraperResult,
): Promise<PersistScraperResultOutcome> {
  const now = new Date().toISOString();
  let insertedCount = 0;
  const sourceMeta = await pool.query<{
    region_id: string;
    type: string;
    news_category: string | null;
  }>(
    `
    select region_id, type, news_category
    from sources
    where id = $1
    limit 1
    `,
    [result.sourceId],
  );
  const source = sourceMeta.rows[0];

  if (!result.success) {
    await pool.query(
      `
      update sources
      set last_error = $1, last_scraped_at = $2
      where id = $3
      `,
      [result.error ?? "unknown error", now, result.sourceId],
    );
    return {
      persisted: true,
      insertedCount: 0,
    };
  }

  if (result.posts.length > 0) {
    const values: Array<string | number | null> = [];
    const tuples: string[] = [];

    for (let index = 0; index < result.posts.length; index += 1) {
      const post = result.posts[index];
      const offset = index * 12;
      tuples.push(
        `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12})`,
      );
      values.push(
        result.sourceId,
        post.externalId,
        post.title,
        clampBodyPreview(post.bodyPreview, 280),
        post.url ?? null,
        post.author ?? null,
        post.viewCount ?? 0,
        post.likeCount ?? 0,
        post.dislikeCount ?? 0,
        post.commentCount ?? 0,
        now,
        toIsoTimestamp(post.postedAt),
      );
    }

    const insertResult = await pool.query(
      `
      insert into raw_posts (
        source_id, external_id, title, body_preview, url, author,
        view_count, like_count, dislike_count, comment_count, collected_at, posted_at
      )
      values ${tuples.join(",")}
      on conflict (source_id, external_id)
      do update
      set
        title = excluded.title,
        body_preview = excluded.body_preview,
        url = excluded.url,
        author = excluded.author,
        view_count = excluded.view_count,
        like_count = excluded.like_count,
        dislike_count = excluded.dislike_count,
        comment_count = excluded.comment_count,
        collected_at = excluded.collected_at,
        posted_at = coalesce(excluded.posted_at, raw_posts.posted_at)
      `,
      values,
    );
    insertedCount = insertResult.rowCount ?? 0;
  }

  const rankedPortalPosts = result.posts
    .filter((post) => Number.isFinite(post.rank) && (post.rank ?? 0) > 0)
    .slice(0, 50);
  if (
    source &&
    source.type === "news" &&
    source.news_category === "portal" &&
    rankedPortalPosts.length > 0
  ) {
    const values: Array<string | number | null> = [];
    const tuples: string[] = [];
    for (let index = 0; index < rankedPortalPosts.length; index += 1) {
      const post = rankedPortalPosts[index]!;
      const offset = index * 7;
      tuples.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7})`);
      values.push(
        result.sourceId,
        source.region_id,
        post.rank ?? index + 1,
        post.title,
        post.url ?? null,
        post.viewCount ?? null,
        now,
      );
    }

    await pool.query(
      `
      insert into portal_ranking_signals (
        source_id, region_id, rank, headline, url, view_count, captured_at
      )
      values ${tuples.join(",")}
      `,
      values,
    );
  }

  await pool.query(
    `
    update sources
    set last_error = null, last_scraped_at = $1
    where id = $2
    `,
    [now, result.sourceId],
  );

  return {
    persisted: true,
    insertedCount,
  };
}

export async function persistScraperResult(result: ScraperResult): Promise<PersistScraperResultOutcome> {
  const postgres = getPostgresClient();
  if (!postgres) {
    Logger.warn(`[${result.sourceId}] PostgreSQL configuration unavailable. Skipping persistence.`);
    return {
      persisted: false,
      insertedCount: 0,
      errorMessage: "postgres_not_configured",
    };
  }

  try {
    return await persistWithPostgres(postgres, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error(
      `[${result.sourceId}] PostgreSQL persistence failed: ${
        errorMessage
      }`,
    );
    return {
      persisted: false,
      insertedCount: 0,
      errorMessage,
    };
  }
}
