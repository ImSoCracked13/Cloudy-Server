import { configProvider } from '../injections/configProvider';
import { utilityProvider } from '@/injections/utilityProvider';

// Get Redis client from configProvider
const redis = configProvider.getRedisClient();

// Flag to track Redis availability
let isRedisAvailable = true;

// Check if Redis is available
async function checkRedisAvailability(): Promise<boolean> {
  if (!redis) return false;
  
  try {
    await redis.ping();
    if (!isRedisAvailable) {
      console.log('Redis connection restored');
      isRedisAvailable = true;
    }
    return true;
  } catch (error) {
    if (isRedisAvailable) {
      console.error('Redis connection lost:', error);
      isRedisAvailable = false;
    }
    return false;
  }
}

// Cache expiration times in seconds
export const CACHE_TTL = {
  SEARCH: 60, // 1 minute
  FILE_LIST: 300, // 5 minutes
  OWNER_FILES: 600, // 10 minutes
  USER: 900 // 15 minutes
};

/**
 * Get a value from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!await checkRedisAvailability()) return null;
  
  try {
    const cachedValue = await redis.get(key);
    
    // Upstash Redis returns null for non-existent keys
    if (cachedValue === null || cachedValue === undefined) {
      return null;
    }
    
    try {
      // Handle different types of responses
      if (typeof cachedValue === 'string') {
        return JSON.parse(cachedValue) as T;
      } else {
        // If it's already an object, return it directly
        return cachedValue as unknown as T;
      }
    } catch (parseError) {
      // If parsing fails, log it but don't throw
      utilityProvider.getLogger().warn(`Failed to parse Redis cache value for key ${key}:`, parseError);
      return null;
    }
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Redis cache error in get(${key}):`, error);
    } else {
      utilityProvider.getLogger().error(`Redis cache error in get(${key}): Empty error object`);
    }
    return null;
  }
}

/**
 * Set a value in cache
 */
export async function setInCache<T>(key: string, value: T, expiry: number): Promise<void> {
  if (!await checkRedisAvailability()) return;
  
  try {
    // Handle null or undefined values
    if (value === null || value === undefined) {
      await redis.del(key);
      return;
    }
    
    // Upstash Redis uses a different syntax for setting with expiry
    await redis.set(key, JSON.stringify(value), { ex: expiry });
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Redis cache error in set(${key}):`, error);
    } else {
      utilityProvider.getLogger().error(`Redis cache error in set(${key}): Empty error object`);
    }
  }
}

/**
 * Delete a key from cache
 */
export async function deleteFromCache(key: string): Promise<void> {
  if (!await checkRedisAvailability()) return;
  
  try {
    await redis.del(key);
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Redis cache error in delete(${key}):`, error);
    } else {
      utilityProvider.getLogger().error(`Redis cache error in delete(${key}): Empty error object`);
    }
  }
}

/**
 * Add to a sorted set with score
 */
export async function addToSortedSet(key: string, score: number, member: string): Promise<void> {
  if (!await checkRedisAvailability()) return;
  
  try {
    // Convert member to string if it's not already
    const memberStr = typeof member === 'string' ? member : String(member);
    
    // Validate inputs to prevent Redis errors
    if (!key || key.trim() === '') {
      utilityProvider.getLogger().warn('Invalid key provided to addToSortedSet');
      return;
    }
    
    if (!memberStr || memberStr.trim() === '') {
      utilityProvider.getLogger().warn('Invalid member provided to addToSortedSet');
      return;
    }
    
    // Ensure score is a valid number
    if (isNaN(score)) {
      utilityProvider.getLogger().warn('Invalid score provided to addToSortedSet');
      return;
    }
    
    // Upstash Redis uses a different syntax for zadd
    await redis.zadd(key, { score, member: memberStr });
  } catch (error) {
    // Just silently fail for sorted sets to avoid console spam
    if (process.env.DEBUG_REDIS === 'true') {
      // Only log detailed error if available
      if (error && Object.keys(error).length > 0) {
        utilityProvider.getLogger().error(`Redis cache error in addToSortedSet(${key}):`, error);
      } else {
        utilityProvider.getLogger().error(`Redis cache error in addToSortedSet(${key}): Empty error object`);
      }
    }
  }
}

/**
 * Increment a hash field
 */
export async function incrementHashField(key: string, field: string, by: number = 1): Promise<void> {
  if (!await checkRedisAvailability()) return;
  
  try {
    await redis.hincrby(key, field, by);
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Redis cache error in incrementHashField(${key}, ${field}):`, error);
    } else {
      utilityProvider.getLogger().error(`Redis cache error in incrementHashField(${key}, ${field}): Empty error object`);
    }
  }
}

/**
 * Set a hash field
 */
export async function setHashField(key: string, field: string, value: string): Promise<void> {
  if (!await checkRedisAvailability()) return;
  
  try {
    await redis.hset(key, { [field]: value });
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Redis cache error in setHashField(${key}, ${field}):`, error);
    } else {
      utilityProvider.getLogger().error(`Redis cache error in setHashField(${key}, ${field}): Empty error object`);
    }
  }
}

// Export all functions as a single object for easier importing
export const cacheHandler = {
  getFromCache,
  setInCache,
  deleteFromCache,
  addToSortedSet,
  incrementHashField,
  setHashField,
}; 