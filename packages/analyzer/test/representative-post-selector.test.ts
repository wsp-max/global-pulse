import test from "node:test";
import assert from "node:assert/strict";
import { selectRepresentativeExcerpts } from "../src/representative-post-selector";

test("selectRepresentativeExcerpts returns top posts capped at 3", () => {
  const posts = [
    { id: "1", sourceId: "a", title: "A", bodyPreview: "Alpha.", viewCount: 100, likeCount: 10, dislikeCount: 0, commentCount: 5 },
    { id: "2", sourceId: "b", title: "B", bodyPreview: "Beta.", viewCount: 2000, likeCount: 100, dislikeCount: 1, commentCount: 30 },
    { id: "3", sourceId: "c", title: "C", bodyPreview: "Gamma.", viewCount: 50, likeCount: 2, dislikeCount: 0, commentCount: 1 },
    { id: "4", sourceId: "d", title: "D", bodyPreview: "Delta.", viewCount: 500, likeCount: 40, dislikeCount: 0, commentCount: 12 },
  ];

  const selected = selectRepresentativeExcerpts(posts);
  assert.equal(selected.length, 3);
  assert.equal(selected[0]?.title, "B");
});
