import { Redis } from '@upstash/redis';

// Get environment variables
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;

// Create Redis instance
const redis = new Redis({
  url: UPSTASH_REDIS_URL,
  token: UPSTASH_REDIS_TOKEN,
});

// Additional utility functions
export const isRedisConnected = async () => {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
};

// Connection
export const connectToUpstashRedis = async () => {
  try {
    // Test the connection with a simple ping command
    const pong = await redis.ping();
    console.log(`✅ Redis connection via Upstash successful (RESPONSE: ${pong})`);
    return redis;
  } catch (error) {
    console.error('❌ Redis connection via Upstash failed:', error);
    throw error;
  }
};

export { redis };