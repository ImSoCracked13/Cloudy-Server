import { compareSync, hashSync, genSaltSync } from 'bcryptjs';
import { utilityProvider } from '../injections/utilityProvider';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcryptjs
 */
export function hashPassword(password: string): string {
  try {
    const salt = genSaltSync(SALT_ROUNDS);
    return hashSync(password, salt);
  } catch (error) {
    utilityProvider.getLogger().error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(plainPassword: string, hashedPassword: string): boolean {
  try {
    return compareSync(plainPassword, hashedPassword);
  } catch (error) {
    utilityProvider.getLogger().error('Error verifying password:', error);
    return false;
  }
} 