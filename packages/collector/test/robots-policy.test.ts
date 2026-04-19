import assert from "node:assert/strict";
import test from "node:test";
import { __resetRobotsCacheForTest, guardNewsRequest } from "../src/scrapers/news/robots";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  __resetRobotsCacheForTest();
  globalThis.fetch = originalFetch;
});

test("guardNewsRequest blocks disallowed path from robots.txt fixture", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/robots.txt")) {
      return new Response(
        [
          "User-agent: *",
          "Disallow: /private",
          "Allow: /public",
          "Crawl-delay: 0",
        ].join("\n"),
        { status: 200 },
      );
    }
    return new Response("ok", { status: 200 });
  };

  await assert.rejects(
    () => guardNewsRequest("https://example.com/private/topic", 1),
    /robots_disallow/u,
  );
});
