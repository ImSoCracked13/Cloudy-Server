import { z } from 'zod';

// File upload DTO schema
export const FileUploadZodSchema = z.object({
  file: z.any(), // This will be validated in the middleware
  path: z.string().optional(),
  overwriteIfExists: z.boolean().optional().default(false)
});

// File move DTO schema
export const FileMoveDtoSchema = z.object({
  fileId: z.string().uuid(),
  newPath: z.string().optional(),
  newLocation: z.enum(['Drive', 'Bin'])
});

// Response DTO types
export type FileUploadZodDto = z.infer<typeof FileUploadZodSchema>;
export type FileMoveDto = z.infer<typeof FileMoveDtoSchema>;

/**
 * DTO for file response returned to client
 */
export interface FileResponseDto {
  id: string;
  name: string;
  path: string;
  type: string;
  mimeType: string | null;
  size: number;
  isFolder: boolean;
  location: 'Drive' | 'Bin';
  lastModified: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for file upload request
 */
export interface FileUploadDto {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
  path?: string;
  overwriteIfExists?: boolean;
}

/**
 * DTO for file download response
 */
export interface FileDownloadDto {
  stream: NodeJS.ReadableStream;
  name: string;
  type: string | null;
  size: number;
}

/**
 * DTO for file search request
 */
export interface FileSearchDto {
  query: string;
  location?: 'Drive' | 'Bin';
  types?: string[];
  isFolder?: boolean;
}

/**
 * DTO for folder creation request
 */
export interface FolderCreateDto {
  name: string;
  path?: string;
}

/**
 * DTO for storage stats response
 */
export interface StorageStatsDto {
  used: number;
  limit: number;
  available: number;
  usedPercentage: number;
  fileCount: number;
  formattedUsed: string;
  formattedLimit: string;
  formattedAvailable: string;
}

/**
 * File preview DTO
 */
export interface FilePreviewDto {
  file: FileResponseDto;
  preview: {
    type: 'image' | 'text' | 'pdf' | 'audio' | 'video' | 'other';
    url?: string;
    content?: string;
    thumbnail?: string;
  };
}

/**
 * Convert File model to FileResponseDto
 */
export function toFileResponseDto(file: any): FileResponseDto {
  return {
    id: file.id,
    name: file.objectName,
    path: file.objectPath,
    type: file.objectType,
    mimeType: file.mimeType,
    size: file.size,
    isFolder: file.isFolder,
    location: file.location,
    lastModified: file.lastModified instanceof Date 
      ? file.lastModified.toISOString() 
      : typeof file.lastModified === 'string' 
        ? file.lastModified 
        : new Date().toISOString(),
    createdAt: file.createdAt instanceof Date 
      ? file.createdAt.toISOString() 
      : typeof file.createdAt === 'string' 
        ? file.createdAt 
        : new Date().toISOString(),
    metadata: file.metadata || undefined
  };
}

/**
 * Convert array of File models to FileResponseDto array
 */
export function toFileResponseDtoArray(files: any[]): FileResponseDto[] {
  return files.map(toFileResponseDto);
}

/**
 * Convert a file and stream to FileDownloadDto
 */
export function toFileDownloadDto(file: any, stream: NodeJS.ReadableStream): FileDownloadDto {
  return {
    stream,
    name: file.objectName,
    type: file.mimeType,
    size: file.size
  };
}

/**
 * Convert a file and preview data to FilePreviewDto
 */
export function toFilePreviewDto(file: any, previewData: any): FilePreviewDto {
  const fileDto = toFileResponseDto(file);
  
  return {
    file: fileDto,
    preview: previewData
  };
} 