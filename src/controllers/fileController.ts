import { serviceProvider } from '../injections/serviceProvider';
import { dtoProvider } from '../injections/dtoProvider';

export class FileController {
  private fileService;
  
  constructor() {
    // Get services from providers
    this.fileService = serviceProvider.getFileService();
  }

  async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    metadata: any,
    size: number,
    path: string = '/',
  ): Promise<any> {
    try {
      if (!userId || !fileBuffer || !metadata || !size) {
        throw new Error('Missing required parameters');
      }
      
      const file = await this.fileService.uploadFile(
        userId,
        fileBuffer,
        metadata,
        size,
        path,
      );
      
      if (!file || !file.id) {
        throw new Error('File upload returned invalid data');
      }
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(file);
      
      return {
        success: true,
        message: `File "${metadata.name}" uploaded successfully`,
        data: fileDto
      };
    } catch (error) {
      throw error
    }
  }

  async previewFile(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }
      
      const previewData = await this.fileService.previewFile(fileId, userId);
      
      return {
        success: true,
        message: 'File preview generated successfully',
        data: {
          type: previewData.type,
          url: previewData.url,
          name: previewData.name,
          size: previewData.size,
          content: previewData.content
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async downloadFile(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }
      
      const { fileStream, file, metadata } = await this.fileService.downloadFile(fileId, userId);
      
      // Create download DTO with proper content type
      return {
        stream: fileStream,
        name: file.objectName,
        type: metadata['content-type'] || file.mimeType || 'application/octet-stream',
        size: file.size,
        metadata
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Rename a file
   */
  async renameFile(fileId: string, userId: string, newName: string): Promise<any> {
    try {
      if (!fileId || !userId || !newName) {
        throw new Error('File ID, User ID, and new name are required');
      }
      
      // Call the service to rename the file
      await this.fileService.renameFile(fileId, newName);
      
      // Force a refresh of the file to ensure we have the latest data
      const renamedFile = await this.fileService.getFileById(fileId);
      
      if (!renamedFile) {
        throw new Error('Failed to verify file rename - file not found after operation');
      }
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(renamedFile);
      
      return {
        success: true,
        message: 'File renamed successfully',
        data: fileDto
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Duplicate a file
   */
  async duplicateFile(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }
      
      const duplicatedFile = await this.fileService.duplicateFile(fileId);
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(duplicatedFile);
      
      return {
        success: true,
        message: 'File duplicated successfully',
        data: fileDto
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Move a file to trash
   */
  async moveToBin(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }
      
      const movedFile = await this.fileService.moveToBin(fileId);
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(movedFile);
      
      return {
        success: true,
        message: 'File moved to trash successfully',
        data: fileDto
      };
    } catch (error) {
      throw error;
    }
  }

  async restoreFile(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }

      const restoredFile = await this.fileService.restoreFile(fileId);
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(restoredFile);
      
      return {
        success: true,
        message: 'File restored successfully',
        data: fileDto
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteFileForever(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }

      await this.fileService.deleteFileForever(fileId, userId);
      
      return { 
        success: true, 
        message: 'File deleted successfully' 
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Empty bin
   */
  async emptyBin(userId: string): Promise<any> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      await this.fileService.emptyBin(userId);
      
      return {
        success: true,
        message: 'Bin emptied successfully',
      };
    } catch (error) {
      throw error;
    }
  }

  async getFileById(fileId: string, userId: string): Promise<any> {
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }
      
      // Get the original file to check ownership
      const file = await this.fileService.getFileById(fileId);
      
      // Check if file exists
      if (!file) {
        throw new Error('File not found');
      }
      
      // Convert to DTO
      const fileDto = dtoProvider.getFileDto().toFileResponseDto(file);
      
      return {
        success: true,
        message: 'File retrieved successfully',
        data: fileDto
      };
    } catch (error) {
      throw error;
    }
  }

  async getFilesByPath(userId: string, path: string, location: string = 'Drive'): Promise<any> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const files = await this.fileService.getFilesByPath(userId, path, location as any );
      
      const fileDtos = dtoProvider.toFileResponseDtoArray(files);
      
      return {
        success: true,
        message: 'Files retrieved successfully',
        data: fileDtos
      };
    } catch (error) {
      throw error
    }
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId: string): Promise<any> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Get storage stats from service
      const stats = await this.fileService.getStorageStats(userId);
      
      return {
        success: true,
        message: 'Storage stats retrieved successfully',
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get storage stats',
        error: 'Internal Server Error'
      };
    }
  }
}

// Create an instance to use in routes
export const fileControllerInstance = new FileController(); 