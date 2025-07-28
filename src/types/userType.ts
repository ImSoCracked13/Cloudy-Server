export type AuthProvider = 'local' | 'google';

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  password: string | null;
  googleId: string | null;
  authProvider: AuthProvider;
  role: string;
  isVerified: boolean;
  verificationToken: string | null;
  verificationExpires: Date | null;
  storageUsed: number;
  storageLimit: number;
  lastStorageUpdate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type User = LocalUser;

export interface GoogleUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  accessToken: string;
}