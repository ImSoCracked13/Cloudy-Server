import { randomBytes } from 'crypto';

/**
* Generate a secure custom email verification token with crypto, this is different from the JWT token
*/
export async function generateVerificationToken(): Promise<string> {
    try {
        return randomBytes(32).toString('hex');
    } catch (error) {
        console.error('Error generating verification token:', error);
    // Fallback to a simpler method if crypto fails
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

export default {
    generateVerificationToken
};