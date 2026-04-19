import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNewsBodyPreview } from "../src/scrapers/news/feed-sanitizer";

test("sanitizeNewsBodyPreview clamps to 280 chars", () => {
  const input = "a".repeat(400);
  const output = sanitizeNewsBodyPreview(input, 280);

  assert.ok(output);
  assert.ok((output ?? "").length <= 280);
  assert.equal(output?.endsWith("…"), true);
});
