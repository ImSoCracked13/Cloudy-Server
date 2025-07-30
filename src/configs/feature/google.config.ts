import { OAuth2Client } from 'google-auth-library';

// Create OAuth2 client with environment variables
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * Google user information interface
 */
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

/**
 * Simplified Google user data for our application
 */
export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  accessToken: string;
}

/**
 * Verify a Google ID token
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload) {
      console.error('No payload in Google token');
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email!,
      firstName: payload.given_name!,
      lastName: payload.family_name!,
      avatar: payload.picture,
      accessToken: token
    };
  } catch (error) {
    console.error('Google token verification failed', error);
    return null;
  }
}


export default {
  googleClient,
  verifyGoogleToken,
}; 