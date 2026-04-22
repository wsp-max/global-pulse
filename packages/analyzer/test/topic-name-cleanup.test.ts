import assert from "node:assert/strict";
import test from "node:test";
import { resolveMeaningfulTopicNames } from "@global-pulse/shared";

test("resolveMeaningfulTopicNames upgrades legacy short labels into neutral issue titles", () => {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: "드래곤볼",
    nameEn: "Dragon Ball",
    summaryKo: "드래곤볼 신작 게임 공개 이후 팬덤에서 복귀 기대와 캐릭터 라인업 추측이 언급된다.",
    summaryEn:
      "Conversation about a new Dragon Ball game reveal surged after the trailer landed. Fans are debating the roster and the scale of the comeback.",
    sampleTitles: ["드래곤볼 신작 게임 공개 분석"],
    keywords: ["dragon ball", "game reveal"],
    entities: [{ text: "Dragon Ball", type: "work" }],
  });

  assert.equal(resolved.nameKo, "드래곤볼 신작 게임 공개");
  assert.equal(resolved.nameEn, "New Dragon Ball game reveal");
  assert.equal(resolved.upgradedKo, true);
  assert.equal(resolved.upgradedEn, true);
});

test("resolveMeaningfulTopicNames drops related-issue suffixes when evidence is weak", () => {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: "드래곤볼",
    nameEn: "Dragon Ball",
    summaryKo: null,
    summaryEn: null,
    keywords: ["fandom", "returning cast"],
    entities: [{ text: "Dragon Ball", type: "work" }],
  });

  assert.equal(resolved.nameKo, "Dragon Ball returning cast");
  assert.equal(resolved.nameEn, "Dragon Ball returning cast");
  assert.equal(resolved.upgradedKo, true);
  assert.equal(resolved.upgradedEn, true);
});

test("resolveMeaningfulTopicNames prefers representative title over generic related labels", () => {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: "Nct wish 관련 이슈",
    nameEn: "Nct wish related issue",
    summaryKo: "현재 게시글에서는 ode · nct · provided 키워드가 함께 언급된다.",
    summaryEn: "Current posts mention the keywords ode · nct · provided together.",
    sampleTitles: ["NCT WISH 엔시티 위시 'Ode to Love' MV"],
    keywords: ["ode", "nct", "provided"],
  });

  assert.equal(resolved.nameKo, "NCT WISH Ode to Love MV");
  assert.equal(resolved.nameEn, "NCT WISH Ode to Love MV");
  assert.equal(resolved.upgradedKo, true);
  assert.equal(resolved.upgradedEn, true);
});
