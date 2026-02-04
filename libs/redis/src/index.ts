import Redis from 'ioredis';

export const createRedisClient = (url?: string): Redis => {
  const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  redis.on('connect', () => {
    console.log('Redis connected');
  });

  return redis;
};

export { Redis };
export default Redis;
