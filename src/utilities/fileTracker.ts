import { configProvider } from '../injections/configProvider';
import { utilityProvider } from '../injections/utilityProvider';

const redis = configProvider.getRedisClient();

type FileOperation = 'create' | 'update' | 'delete' | 'move' | 'empty_bin';
type FileLocation = 'drive' | 'bin';

/**
 * Track file operations for analytics
 */
export async function trackFileOperation(ownerId: string, operation: FileOperation, fileId: string): Promise<void> {
  try {
    const now = Date.now();
    
    // Add to operation history list with timestamp
    await redis.lpush(`user:${ownerId}:file_operations`, JSON.stringify({
      operation,
      fileId,
      timestamp: now
    }));
    
    // Trim list to keep only last 100 operations
    await redis.ltrim(`user:${ownerId}:file_operations`, 0, 99);
    
    // Increment counter for this operation type
    await redis.hincrby(`user:${ownerId}:file_stats`, operation, 1);
    
    // Update last operation timestamp
    await redis.hset(`user:${ownerId}:file_stats`, { lastOperation: now.toString() });
  } catch (error) {
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error('Error tracking file operation:', error);
    } else {
      utilityProvider.getLogger().error('Error tracking file operation: Empty error object');
    }
  }
}

/**
 * Invalidate file caches for a user
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
        // Delete each key individually since Upstash Redis doesn't support del with multiple keys
        for (const key of keys) {
          await redis.del(key);
        }
        console.log(`Cache invalidation complete for user ${ownerId}. Deleted ${keys.length} keys.`);
      } else {
        console.log(`No cache keys found for pattern ${pattern}`);
      }
    } catch (keysError) {
      // Handle keys operation error separately
      if (keysError && Object.keys(keysError).length > 0) {
        utilityProvider.getLogger().error(`Error getting keys for pattern ${pattern}:`, keysError);
      } else {
        utilityProvider.getLogger().error(`Error getting keys for pattern ${pattern}: Empty error object`);
      }
    }
    
    // Also invalidate any storage stats caches
    await redis.del(`user:${ownerId}:storage_stats`);
  } catch (error) {
    // Only log detailed error if available
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
    // Only log detailed error if available
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
    // Only log detailed error if available
    if (error && Object.keys(error).length > 0) {
      utilityProvider.getLogger().error(`Error incrementing file stat ${statName}:`, error);
    } else {
      utilityProvider.getLogger().error(`Error incrementing file stat ${statName}: Empty error object`);
    }
  }
}
