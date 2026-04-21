import assert from "node:assert/strict";
import test from "node:test";
import { resolveMeaningfulTopicNames } from "@global-pulse/shared";

test("resolveMeaningfulTopicNames upgrades legacy short labels into neutral issue titles", () => {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: "\ub4dc\ub798\uace4\ubcfc",
    nameEn: "Dragon Ball",
    summaryKo: "\ub4dc\ub798\uace4\ubcfc \uc2e0\uc791 \uac8c\uc784 \uacf5\uac1c \uc774\ud6c4 \ud32c\ub364\uc5d0\uc11c \ubcf5\uadc0 \uae30\ub300\uc640 \uce90\ub9ad\ud130 \ub77c\uc778\uc5c5 \ucd94\uce21\uc774 \uc5b8\uae09\ub41c\ub2e4.",
    summaryEn:
      "Conversation about a new Dragon Ball game reveal surged after the trailer landed. Fans are debating the roster and the scale of the comeback.",
    sampleTitles: ["\ub4dc\ub798\uace4\ubcfc \uc2e0\uc791 \uac8c\uc784 \uacf5\uac1c \ubd84\uc11d"],
    keywords: ["dragon ball", "game reveal"],
    entities: [{ text: "Dragon Ball", type: "work" }],
  });

  assert.equal(resolved.nameKo, "\ub4dc\ub798\uace4\ubcfc \uc2e0\uc791 \uac8c\uc784 \uacf5\uac1c");
  assert.equal(resolved.nameEn, "New Dragon Ball game reveal");
  assert.equal(resolved.upgradedKo, true);
  assert.equal(resolved.upgradedEn, true);
});

test("resolveMeaningfulTopicNames stops at conservative generic labels when evidence is weak", () => {
  const resolved = resolveMeaningfulTopicNames({
    nameKo: "\ub4dc\ub798\uace4\ubcfc",
    nameEn: "Dragon Ball",
    summaryKo: null,
    summaryEn: null,
    keywords: ["fandom", "returning cast"],
    entities: [{ text: "Dragon Ball", type: "work" }],
  });

  assert.equal(resolved.nameKo, "Dragon Ball \uad00\ub828 \uc774\uc288");
  assert.equal(resolved.nameEn, "Dragon Ball related issue");
  assert.equal(resolved.upgradedKo, true);
  assert.equal(resolved.upgradedEn, true);
});
