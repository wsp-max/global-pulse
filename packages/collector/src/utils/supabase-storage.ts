import type { ScraperResult } from "@global-pulse/shared";
import { createPostgresPool, hasPostgresConfig } from "@global-pulse/shared/postgres";
import type { Pool } from "pg";
import { Logger } from "./logger";

function toIsoTimestamp(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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

async function persistWithPostgres(pool: Pool, result: ScraperResult): Promise<void> {
  const now = new Date().toISOString();

  if (!result.success) {
    await pool.query(
      `
      update sources
      set last_error = $1, last_scraped_at = $2
      where id = $3
      `,
      [result.error ?? "unknown error", now, result.sourceId],
    );
    return;
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
        post.bodyPreview ?? null,
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

    await pool.query(
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
  }

  await pool.query(
    `
    update sources
    set last_error = null, last_scraped_at = $1
    where id = $2
    `,
    [now, result.sourceId],
  );
}

export async function persistScraperResult(result: ScraperResult): Promise<void> {
  const postgres = getPostgresClient();
  if (!postgres) {
    Logger.warn(`[${result.sourceId}] PostgreSQL configuration unavailable. Skipping persistence.`);
    return;
  }

  try {
    await persistWithPostgres(postgres, result);
  } catch (error) {
    Logger.error(
      `[${result.sourceId}] PostgreSQL persistence failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
