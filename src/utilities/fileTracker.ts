import { configProvider } from '../injections/configProvider';
import { utilityProvider } from '../injections/utilityProvider';

const redis = configProvider.getRedisClient();

type FileLocation = 'drive' | 'bin';

/**
 * Invalidate file caches
 */
export async function invalidateOwnerCache(ownerId: string, location?: FileLocation): Promise<void> {
  try {
    // Normalize location to lowercase if provided
    let normalizedLocation: string | undefined = undefined;
    if (location) {
      // Handle both capitalized and lowercase versions (Drive/drive, Bin/bin)
      normalizedLocation = location.toLowerCase();
    }
    
    // Get all cache keys for this owner
    const pattern = normalizedLocation 
      ? `files:${ownerId}:${normalizedLocation}:*` 
      : `files:${ownerId}:*`;
    
    // Log the cache invalidation
    console.log(`Invalidating cache with pattern: ${pattern}`);
    
    // Delete keys matching pattern
    try {
      const keys = await redis.keys(pattern);
      
      if (keys && keys.length > 0) {
        console.log(`Deleting ${keys.length} cache keys for user ${ownerId}`);
        for (const key of keys) {
          await redis.del(key);
        }
        utilityProvider.getLogger().info(`Cache invalidation complete for user ${ownerId}. Deleted ${keys.length} keys.`);
      } else {
        utilityProvider.getLogger().info(`No cache keys found for pattern ${pattern}`);
      }
    } catch (keysError) {
      if (keysError && Object.keys(keysError).length > 0) {
        utilityProvider.getLogger().error(`Error getting keys for pattern ${pattern}:`, keysError);
      } else {
        utilityProvider.getLogger().error(`Error getting keys for pattern ${pattern}: Empty error object`);
      }
    }
    
    // Also invalidate any storage stats caches
    await redis.del(`user:${ownerId}:storage_stats`);
  } catch (error) {
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error('Error invalidating owner cache:', error);
    } else {
      utilityProvider.getLogger().error('Error invalidating owner cache: Empty error object');
    }
  }
}


/**
 * Increment a user statistic
 */
export async function incrementUserStat(userId: string, statName: string, by: number = 1): Promise<void> {
  try {
    await redis.hincrby(`user:${userId}:stats`, statName, by);
  } catch (error) {
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Error incrementing user stat ${statName}:`, error);
    } else {
      utilityProvider.getLogger().error(`Error incrementing user stat ${statName}: Empty error object`);
    }
  }
}

/**
 * Increment a file statistic
 */
export async function incrementFileStat(fileId: string, statName: string, by: number = 1): Promise<void> {
  try {
    await redis.hincrby(`file:${fileId}:stats`, statName, by);
  } catch (error) {
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Error incrementing file stat ${statName}:`, error);
    } else {
      utilityProvider.getLogger().error(`Error incrementing file stat ${statName}: Empty error object`);
    }
  }
}
