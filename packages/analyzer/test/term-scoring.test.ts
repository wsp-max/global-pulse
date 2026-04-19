import assert from "node:assert/strict";
import test from "node:test";
import { buildIdfFromDocumentTokens } from "../src/keyword-extractor";

test("buildIdfFromDocumentTokens assigns lower idf to frequent terms", () => {
  const snapshot = buildIdfFromDocumentTokens([
    ["조회", "영상", "street", "fighter"],
    ["조회", "영상", "street", "fighter"],
    ["조회", "영상", "street", "fighter", "tournament"],
    ["조회", "영상", "street", "fighter", "capcom"],
    ["조회", "영상", "economy", "inflation"],
  ]);

  const commonIdf = snapshot.idfByTerm.get("조회") ?? 0;
  const rareIdf = snapshot.idfByTerm.get("inflation") ?? 0;

  assert.ok(rareIdf > commonIdf);
});

test("buildIdfFromDocumentTokens marks top 2 percent low-idf terms as generic", () => {
  const snapshot = buildIdfFromDocumentTokens([
    ["조회", "영상", "street", "fighter"],
    ["조회", "영상", "street", "fighter"],
    ["조회", "영상", "street", "fighter", "tournament"],
    ["조회", "영상", "street", "fighter", "capcom"],
    ["조회", "영상", "economy", "inflation"],
  ]);

  const genericTerms = snapshot.genericTerms;
  assert.equal(genericTerms.size >= 1, true);
  assert.equal(genericTerms.has("조회") || genericTerms.has("영상"), true);
  assert.equal(genericTerms.has("inflation"), false);
});

test("buildIdfFromDocumentTokens ignores empty documents in total docs", () => {
  const snapshot = buildIdfFromDocumentTokens([[], ["alpha", "beta"], []]);
  assert.equal(snapshot.totalDocs, 1);
  assert.equal(snapshot.idfByTerm.has("alpha"), true);
  assert.equal(snapshot.idfByTerm.has("beta"), true);
});
