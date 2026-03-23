export const RATING_KEYS = [
  "rating_호감",
  "rating_신뢰",
  "rating_매너",
  "rating_매력",
] as const;

export type RatingKey = (typeof RATING_KEYS)[number];

export type FourCategoryRatingRow = Partial<Record<RatingKey, number | null | undefined>>;

export function avgOfDefined(values: (number | null | undefined)[]): number | null {
  const defined = values.filter((value): value is number => typeof value === "number");
  if (defined.length === 0) return null;
  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

export function hasAnyCategoryRating(row: FourCategoryRatingRow) {
  return RATING_KEYS.some((key) => {
    const value = row[key];
    return typeof value === "number" && value >= 1 && value <= 5;
  });
}

export function computeOverallCategoryAverage(rows: FourCategoryRatingRow[]) {
  const rowAverages = rows
    .map((row) => avgOfDefined(RATING_KEYS.map((key) => row[key] ?? null)))
    .filter((value): value is number => value !== null);

  if (rowAverages.length === 0) return null;

  const overall = rowAverages.reduce((sum, value) => sum + value, 0) / rowAverages.length;
  return Math.round(overall * 10) / 10;
}
