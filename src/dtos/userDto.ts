/**
 * User response DTO interface
 */
export interface UserResponseDto {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isVerified: boolean;
  authProvider: 'google' | 'local';
  googleId?: string | null;
  storageUsed: number;
  storageLimit: number;
  formattedStorageUsed: string;
  formattedStorageLimit: string;
  storagePercentage: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * User session DTO interface
 */
export interface UserSessionDto {
  id: string;
  email: string;
  username: string;
  role: string;
}

/**
 * User authentication result DTO interface
 */
export interface UserAuthResultDto {
  user: UserResponseDto;
  token: string;
}

/**
 * Convert User model to UserResponseDto
 */
export function toUserResponseDto(user: any): UserResponseDto {
  const storageUsed = Number(user.storageUsed);
  const storageLimit = Number(user.storageLimit);
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;
  
  // Extract first and last name from username if they don't exist
  const nameParts = user.username.split(' ');
  const firstName = nameParts.length > 0 ? nameParts[0] : undefined;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

  // Ensure authProvider is one of the valid types
  const authProvider = (user.authProvider === 'google' || user.authProvider === 'local') 
    ? user.authProvider 
    : 'local';

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: firstName,
    lastName: lastName,
    role: user.role,
    isVerified: user.isVerified,
    authProvider: authProvider,
    googleId: user.googleId,
    storageUsed: storageUsed,
    storageLimit: storageLimit,
    formattedStorageUsed: storageUsed.toString(),
    formattedStorageLimit: storageLimit.toString(),
    storagePercentage: parseFloat(storagePercentage.toFixed(2)),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

/**
 * Convert array of User models to UserResponseDto array
 */
export function toUserResponseDtoArray(users: any[]): UserResponseDto[] {
  return users.map(toUserResponseDto);
}

/**
 * Convert User model to UserSessionDto
 */
export function toUserSessionDto(user: any): UserSessionDto {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role
  };
}

/**
 * Convert User and token to UserAuthResultDto
 */
export function toUserAuthResultDto(user: any, token: string): UserAuthResultDto {
  return {
    user: toUserResponseDto(user),
    token
  };
} 