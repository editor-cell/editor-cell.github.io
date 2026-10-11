/**
 * The order of the front page. The newest issue comes first, its readings by rank
 * (1 = most important, in the largest box); then the older issues, newest first, each by
 * rank; then readings that belong to no issue, newest first. With no issue numbers at all
 * this is simply newest first, as before.
 */
export type Ordered = { date: string; issue?: number; rank?: number };

export const ISSUE_SIZE = 9;

export function frontOrder<T extends Ordered>(stories: readonly T[]): T[] {
  const byDate = (a: T, b: T) => b.date.localeCompare(a.date);
  return [...stories].sort((a, b) => {
    const ai = a.issue ?? -Infinity;
    const bi = b.issue ?? -Infinity;
    if (ai !== bi) return bi - ai;
    if (a.issue === undefined) return byDate(a, b);
    const ar = a.rank ?? Infinity;
    const br = b.rank ?? Infinity;
    return ar !== br ? ar - br : byDate(a, b);
  });
}
