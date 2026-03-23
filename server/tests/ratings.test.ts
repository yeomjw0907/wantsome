import test from "node:test";
import assert from "node:assert/strict";
import {
  computeOverallCategoryAverage,
  hasAnyCategoryRating,
} from "@/lib/ratings";

test("category rating helper detects at least one valid rating", () => {
  assert.equal(
    hasAnyCategoryRating({
      "rating_호감": 4,
      "rating_신뢰": null,
      "rating_매너": undefined,
      "rating_매력": null,
    }),
    true,
  );

  assert.equal(
    hasAnyCategoryRating({
      "rating_호감": 0,
      "rating_신뢰": null,
      "rating_매너": undefined,
      "rating_매력": null,
    }),
    false,
  );
});

test("overall category average matches row-average aggregation", () => {
  const overall = computeOverallCategoryAverage([
    {
      "rating_호감": 4,
      "rating_신뢰": 4,
      "rating_매너": 2,
      "rating_매력": 2,
    },
    {
      "rating_호감": 5,
      "rating_신뢰": 5,
      "rating_매너": 5,
      "rating_매력": 5,
    },
  ]);

  assert.equal(overall, 4);
});
