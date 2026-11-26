import { HOT_SCORE_TIME_DIVISOR_SECONDS, REDDIT_EPOCH_SECONDS, hotScore } from './hot-score';

describe('hotScore', () => {
  const createdAt = new Date('2026-11-01T12:00:00Z');

  it('ranks more votes higher at the same creation time', () => {
    expect(hotScore(10, createdAt)).toBeGreaterThan(hotScore(5, createdAt));
    expect(hotScore(5, createdAt)).toBeGreaterThan(hotScore(1, createdAt));
  });

  it('ranks newer requests higher at equal votes', () => {
    const newer = new Date(createdAt.getTime() + 60 * 60 * 1000);
    expect(hotScore(3, newer)).toBeGreaterThan(hotScore(3, createdAt));
  });

  it('handles 0 votes without throwing and scores only on age', () => {
    expect(() => hotScore(0, createdAt)).not.toThrow();
    const expected =
      (createdAt.getTime() / 1000 - REDDIT_EPOCH_SECONDS) / HOT_SCORE_TIME_DIVISOR_SECONDS;
    expect(hotScore(0, createdAt)).toBeCloseTo(expected, 10);
    expect(hotScore(1, createdAt)).toBeCloseTo(expected, 10); // log10(1) = 0
  });

  it('lets a 10x vote lead offset 12.5 hours of age', () => {
    const later = new Date(createdAt.getTime() + HOT_SCORE_TIME_DIVISOR_SECONDS * 1000);
    expect(hotScore(100, createdAt)).toBeCloseTo(hotScore(10, later), 10);
  });
});
