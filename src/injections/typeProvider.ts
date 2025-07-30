import { File, FileLocation, FileLocations,} from '../types/fileType';
import { User, LocalUser, GoogleUser, AuthProvider } from '../types/userType';

// Define basic interfaces for API responses
export interface PaginatedResponse  {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  code: number;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Define JWT related interfaces
export interface JWTPayload {
  sub: string;
  email: string;
  name?: string;
  role?: string;
  exp: number;
  iat: number;
}

export interface JWTPayloadSpec {
  id: string;
  email: string;
  role: string;
  username?: string;
  exp?: number;
  iat?: number;
}

export interface DecodedToken {
  payload: JWTPayloadSpec;
  iat: number;
  exp: number;
}

// Export type definitions directly for TypeScript compatibility
export type { 
  File, 
  FileLocation, 
  User,
  LocalUser,
  GoogleUser,
  AuthProvider,
};

/**
 * Type Provider for Dependency Injection
 */
export class TypeProvider {
  private static instance: TypeProvider;

  private constructor() {}

  /**
   * Get the singleton instance of TypeProvider
   */
  public static getInstance(): TypeProvider {
    if (!TypeProvider.instance) {
      TypeProvider.instance = new TypeProvider();
    }
    return TypeProvider.instance;
  }

  /**
   * Get ApiResponse type
   */
  public getApiResponseType() {
    return { type: 'ApiResponse' };
  }

  /**
   * Get PaginatedResponse type
   */
  public getPaginatedResponseType() {
    return { type: 'PaginatedResponse' };
  }

  /**
   * Get ErrorResponse type
   */
  public getErrorResponseType() {
    return { type: 'ErrorResponse' };
  }

  /**
   * Get ValidationError type
   */
  public getValidationErrorType() {
    return { type: 'ValidationError' };
  }

  /**
   * Get FileMetadata type
   */
  public getFileMetadataType() {
    return { type: 'FileMetadata' };
  }

  /**
   * Get File type
   */
  public getFileType() {
    return { type: 'File' };
  }

  /**
   * Get FileSearchFilters type
   */
  public getFileSearchFiltersType() {
    return { type: 'FileSearchFilters' };
  }

  /**
   * Get FileLocation type
   */
  public getFileLocationType() {
    return { type: 'FileLocation' };
  }

  /**
   * Get FileLocations constant
   */
  public getFileLocationsConstant() {
    return FileLocations;
  }

  /**
   * Get PreviewType type
   */
  public getPreviewType() {
    return { type: 'PreviewType' };
  }

  /**
   * Get FilePreviewResult type
   */
  public getFilePreviewResultType() {
    return { type: 'FilePreviewResult' };
  }

  /**
   * Get StorageStats type
   */
  public getStorageStatsType() {
    return { type: 'StorageStats' };
  }

  /**
   * Get StorageQuota type
   */
  public getStorageQuotaType() {
    return { type: 'StorageQuota' };
  }

  /**
   * Get StorageUsage type
   */
  public getStorageUsageType() {
    return { type: 'StorageUsage' };
  }

  /**
   * Get BucketConfig type
   */
  public getBucketConfigType() {
    return { type: 'BucketConfig' };
  }

  /**
   * Get StorageObject type
   */
  public getStorageObjectType() {
    return { type: 'StorageObject' };
  }

  /**
   * Get JWTPayload type
   */
  public getJWTPayloadType() {
    return { type: 'JWTPayload' };
  }

  /**
   * Get JWTPayloadSpec type
   */
  public getJWTPayloadSpecType() {
    return { type: 'JWTPayloadSpec' };
  }

  /**
   * Get DecodedToken type
   */
  public getDecodedTokenType() {
    return { type: 'DecodedToken' };
  }

  /**
   * Get AuthProvider type
   */
  public getAuthProviderType() {
    return { type: 'AuthProvider' };
  }

  /**
   * Get User type
   */
  public getUserType() {
    return { type: 'User' };
  }

  /**
   * Get LocalUser type
   */
  public getLocalUserType() {
    return { type: 'LocalUser' };
  }

  /**
   * Get GoogleUser type
   */
  public getGoogleUserType() {
    return { type: 'GoogleUser' };
  }

  /**
   * Get UserSession type
   */
  public getUserSessionType() {
    return { type: 'UserSession' };
  }

  /**
   * Get UserRegistrationDto type
   */
  public getUserRegistrationDtoType() {
    return { type: 'UserRegistrationDto' };
  }

  /**
   * Get UserResponseDto type
   */
  public getUserResponseDtoType() {
    return { type: 'UserResponseDto' };
  }

  /**
   * Reset types (useful for testing)
   */
  public resetTypes(): void {
    // Reset any stateful types if needed
  }
}

// Export a singleton instance for easy access
export const typeProvider = TypeProvider.getInstance(); 