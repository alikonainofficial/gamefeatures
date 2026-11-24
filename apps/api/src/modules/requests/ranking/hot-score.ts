/**
 * Reddit's "hot" ranking (upvote-only here, so the sign is never negative in practice).
 *
 * score = sign(votes) * log10(max(|votes|, 1)) + (createdAtSeconds - REDDIT_EPOCH_SECONDS) / 45000
 *
 * The vote term grows logarithmically (the first 10 votes count as much as the next 90),
 * and the time term adds 1 point every 12.5 hours, so newer posts overtake older ones
 * unless the older one has ~10x the votes. Age "decays" a post only relative to newer ones;
 * a stored score never changes on its own.
 */

/** 2005-12-08T07:46:43Z, the epoch from Reddit's original implementation. */
export const REDDIT_EPOCH_SECONDS = 1134028003;

/** Seconds of age that are worth one order of magnitude of votes (12.5 hours). */
export const HOT_SCORE_TIME_DIVISOR_SECONDS = 45000;

export function hotScore(voteCount: number, createdAt: Date): number {
  const order = Math.log10(Math.max(Math.abs(voteCount), 1));
  const sign = voteCount > 0 ? 1 : voteCount < 0 ? -1 : 0;
  const seconds = createdAt.getTime() / 1000 - REDDIT_EPOCH_SECONDS;
  return sign * order + seconds / HOT_SCORE_TIME_DIVISOR_SECONDS;
}
