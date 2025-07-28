import { 
  UserResponseDto, 
  UserSessionDto, 
  UserAuthResultDto, 
  toUserResponseDto,
  toUserSessionDto,
  toUserAuthResultDto
} from '../dtos/userDto';

import { 
  FileResponseDto, 
  FileDownloadDto, 
  FilePreviewDto,
  FileUploadDto,
  FileSearchDto,
  FolderCreateDto,
  StorageStatsDto,
  toFileResponseDto,
  toFileDownloadDto,
  toFilePreviewDto
} from '../dtos/fileDto';

// Export type definitions directly for TypeScript compatibility
export type { 
  UserResponseDto, 
  UserSessionDto, 
  UserAuthResultDto,
  FileResponseDto,
  FileDownloadDto,
  FilePreviewDto,
  FileUploadDto,
  FileSearchDto,
  FolderCreateDto,
  StorageStatsDto
};

/**
 * DTO Provider for Dependency Injection
 * This class manages DTOs and conversion functions
 */
export class DtoProvider {
  private static instance: DtoProvider;

  private constructor() {}

  /**
   * Get the singleton instance of DtoProvider
   */
  public static getInstance(): DtoProvider {
    if (!DtoProvider.instance) {
      DtoProvider.instance = new DtoProvider();
    }
    return DtoProvider.instance;
  }

  /**
   * Get user DTO types and conversion functions
   */
  public getUserDto() {
    return {
      UserResponseDto: { type: 'UserResponseDto' },
      UserSessionDto: { type: 'UserSessionDto' },
      UserAuthResultDto: { type: 'UserAuthResultDto' },
      AuthProvider: { type: 'AuthProvider' },
      toUserResponseDto,
      toUserSessionDto,
      toUserAuthResultDto
    };
  }

  /**
   * Get file DTO types and conversion functions
   */
  public getFileDto() {
    return {
      FileResponseDto: { type: 'FileResponseDto' },
      FileDownloadDto: { type: 'FileDownloadDto' },
      FilePreviewDto: { type: 'FilePreviewDto' },
      toFileResponseDto,
      toFileDownloadDto,
      toFilePreviewDto
    };
  }

  /**
   * Get user response DTO type
   */
  public getUserResponseDtoType() {
    return { type: 'UserResponseDto' };
  }

  /**
   * Get user session DTO type
   */
  public getUserSessionDtoType() {
    return { type: 'UserSessionDto' };
  }

  /**
   * Get user auth result DTO type
   */
  public getUserAuthResultDtoType() {
    return { type: 'UserAuthResultDto' };
  }

  /**
   * Get auth provider enum
   */
  public getAuthProviderEnum() {
    return { type: 'AuthProvider' };
  }

  /**
   * Get file response DTO type
   */
  public getFileResponseDtoType() {
    return { type: 'FileResponseDto' };
  }

  /**
   * Get file download DTO type
   */
  public getFileDownloadDtoType() {
    return { type: 'FileDownloadDto' };
  }

  /**
   * Get file preview DTO type
   */
  public getFilePreviewDtoType() {
    return { type: 'FilePreviewDto' };
  }

  /**
   * Convert user to user response DTO
   */
  public toUserResponseDto(user: any): UserResponseDto {
    return toUserResponseDto(user);
  }

  /**
   * Convert user to user session DTO
   */
  public toUserSessionDto(user: any): UserSessionDto {
    return toUserSessionDto(user);
  }

  /**
   * Convert user to user auth result DTO
   */
  public toUserAuthResultDto(user: any, token: string): UserAuthResultDto {
    return toUserAuthResultDto(user, token);
  }

  /**
   * Convert file to file response DTO
   */
  public toFileResponseDto(file: any): FileResponseDto {
    return toFileResponseDto(file);
  }

  /**
   * Convert file to file download DTO
   */
  public toFileDownloadDto(file: any, stream: NodeJS.ReadableStream): FileDownloadDto {
    return toFileDownloadDto(file, stream);
  }

  /**
   * Convert file to file preview DTO
   */
  public toFilePreviewDto(file: any, previewData: any): FilePreviewDto {
    return toFilePreviewDto(file, previewData);
  }

  /**
   * Convert array of files to file response DTOs
   */
  public toFileResponseDtoArray(files: any[]): FileResponseDto[] {
    return files.map(file => this.toFileResponseDto(file));
  }
}

// Export a singleton instance for easy access
export const dtoProvider = DtoProvider.getInstance(); 