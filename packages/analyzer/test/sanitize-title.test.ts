import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePostTitle, tokenizeForAnalysis } from "../src/keyword-extractor";

test("sanitizePostTitle removes wrappers, clickbait labels, and shorts suffixes", () => {
  const input = "【속보】 [단독] 충격! 미쳤다... BTS 신곡 공개 - YouTube #shorts";
  const sanitized = sanitizePostTitle(input, "youtube_kr");

  assert.equal(sanitized, "BTS 신곡 공개");
});

test("sanitizePostTitle removes youtube-specific '| Shorts' and '- Topic' suffixes", () => {
  const input = "Street Fighter | Shorts - Topic";
  const sanitized = sanitizePostTitle(input, "youtube_us");

  assert.equal(sanitized, "Street Fighter");
});

test("sanitizePostTitle strips Japanese leading clickbait labels", () => {
  const input = "速報: 衝撃! 任天堂 新作 発売";
  const sanitized = sanitizePostTitle(input, "yahoo_japan");

  assert.equal(sanitized, "任天堂 新作 発売");
});

test("sanitizePostTitle strips Chinese leading clickbait labels", () => {
  const input = "【独家】重磅：最新 小米 发布会";
  const sanitized = sanitizePostTitle(input, "tieba");

  assert.equal(sanitized, "小米 发布会");
});

test("sanitizePostTitle keeps non-leading tokens untouched", () => {
  const input = "추석 만화인데 충격 자체가 아님";
  const sanitized = sanitizePostTitle(input, "dcinside");

  assert.equal(sanitized, "추석 만화인데 충격 자체가 아님");
});

test("sanitizePostTitle trims emoji/ellipsis and leading labels", () => {
  const input = "🔥🔥 ... 단독: 테스트 제목 ... 😂";
  const sanitized = sanitizePostTitle(input, "dcinside");

  assert.equal(sanitized, "테스트 제목");
});

test("tokenizeForAnalysis tokenizes sanitized title only", () => {
  const input = "【속보】 충격! 미쳤다 BTS 신곡 공개";
  const tokens = tokenizeForAnalysis(input, "kr", "youtube_kr");

  assert.equal(tokens.includes("충격"), false);
  assert.equal(tokens.includes("미쳤다"), false);
  assert.equal(tokens.includes("속보"), false);
  assert.equal(tokens.includes("bts"), true);
});
