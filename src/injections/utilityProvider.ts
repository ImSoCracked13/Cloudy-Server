import * as cacheHandler from '../utilities/cacheHandler';
import * as fileTracker from '../utilities/fileTracker';
import * as passwordHasher from '../utilities/passwordHasher';
import { emailHandler } from '../utilities/emailHandler';
import * as validator from '../utilities/validator';
import Logger from '../utilities/logger';
import { storageHelper } from '../utilities/storageHelper';
import * as encoder from '../utilities/encoder';

/**
 * Utility Provider for Dependency Injection
 * This class manages utility functions and dependencies
 */
export class UtilityProvider {
  private static instance: UtilityProvider;

  /**
   * Get the singleton instance of UtilityProvider
   */
  public static getInstance(): UtilityProvider {
    if (!UtilityProvider.instance) {
      UtilityProvider.instance = new UtilityProvider();
    }
    return UtilityProvider.instance;
  }

  /**
   * Cache handling utilities
   */
  public getCacheHandler(): typeof cacheHandler {
    return cacheHandler;
  }

  /**
   * File tracking utilities
   */
  public getFileTracker(): typeof fileTracker {
    return fileTracker;
  }

  /**
   * Password utilities
   */
  public getPasswordHasher(): typeof passwordHasher {
    return passwordHasher;
  }

  /**
   * Email sending utilities
   */
  public getEmailHandler(): typeof emailHandler {
    return emailHandler;
  }

  /**
   * Validation utilities
   */
  public getValidator(): typeof validator {
    return validator;
  }

  /**
   * Storage helper utilities
   */
  public getStorageHelper(): typeof storageHelper {
    return storageHelper;
  }

  /**
   * Encoder utilities
   */
  public getEncoder(): typeof encoder {
    return encoder;
  }

  /**
   * Logger utility
   */
  public getLogger(): typeof Logger {
    return Logger;
  }

  /**
   * Reset utilities (useful for testing)
   */
  public resetUtilities(): void {
    // Reset any stateful utilities if needed
  }
}

// Export a singleton instance for easy access
export const utilityProvider = UtilityProvider.getInstance(); 