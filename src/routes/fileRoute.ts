import { controllerProvider } from '../injections/controllerProvider';
import { middlewareProvider } from '../injections/middlewareProvider';

/**
 * Setup file routes
 */
export const fileRoute = (app: any) => {
  // Get middleware from provider
  const safeBypasser = middlewareProvider.getSafeBypasser();
  const infoReminder = middlewareProvider.getInfoReminder();
  
  // Get controller
  const fileController = controllerProvider.getFileController();
  
  // Apply security and cookie middleware
  app = safeBypasser.applySecurityMiddleware(app);
  app = infoReminder.applyCookie(app);
  
  /**
   * Helper function to verify JWT authentication for file operations
   */
  const verifyAuth = async (context: any) => {
    // Try to get token from cookie
    let token = context.cookies?.jwt;

    // Try authorization header to get token if no tokens stored in cookies
    if (!token) {
      const headerValue = 
        // Request headers map
        context.request?.headers?.get('Authorization') ||
        // Elysia native headers
        context.header?.Authorization;
      
      if (headerValue) {
        const [type, value] = headerValue.split(' ');
        if (type === 'Bearer' && value) {
          token = value;
          // Store the token in cookie for future requests
          context.set.cookie = {
            jwt: value,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60, // an hour for file operations
            path: '/'
          };
        }
      }
    }

    try {
      // Verify the token using Elysia's JWT
      const payload = await context.jwt.verify(token);
      if (!payload || !payload.id) {
        console.warn('Invalid token payload');
        context.set.status = 401;
        return {
          success: false,
          message: 'Invalid authentication token',
          error: 'Unauthorized'
        };
      }

      // Log successful authentication
      console.log('Auth successful for user:', payload.id);
      
      // Add user data to context
      context.id = payload.id;
      context.email = payload.email;
      
      return null; // Auth passed
    } catch (error) {
      console.warn('Token verification failed:', error);
      context.set.status = 401;
      return {
        success: false,
        message: 'Invalid authentication token',
        error: 'Unauthorized'
      };
    }
  };
  
  return app
    // Get all files (root endpoint)
    .get('/', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // Extract user data from context
        const userId = context.id;
        const { query } = context;
        
        // Handle query parameters
        const parentId = query.parentId || null;
        const isBin = query.isBin === 'true';
        const location = isBin ? 'Bin' : 'Drive';
        
        // Use existing getFilesByPath method to get files
        // Find its path first, otherwise use root path
        let path = '/';
        if (parentId) {
          const folder = await fileController.getFileById(parentId, userId);
          if (folder && folder.data) {
            path = folder.data.objectPath || '/';
          }
        }
        
        const result = await fileController.getFilesByPath(userId, path, location);
        return result;
      } catch (error) {
        console.error('Error getting files:', error);
        throw error;
      }
    })
    
    // Get file by ID
    .get('/:fileId', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const userId = context.id;

        return await fileController.getFileById(context.params.fileId, userId);
      } catch (error) {
        console.error('Error getting file by ID:', error);
      }
    })
    
    // Upload file
    .post('/upload', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // Extract data from body based on content type
        const { body, headers } = context;
        const userId = context.id;
        let fileBuffer, metadata, size, path;
        
        const contentType = headers['content-type'] || '';
        
        if (contentType.includes('multipart/form-data')) {
          // Handle multipart form data
          try {
            const formData = body;
            const file = formData.file;
            
            if (!file) {
              throw new Error('File is missing in formData');
            }
            
            // Convert arrayBuffer to Buffer properly
            const arrayBuffer = await file.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
              
            path = formData.path || '/';           
            
            size = file.size;
            metadata = {
              name: file.name,
              type: file.type,
              mime_type: file.type
            };
          } catch (error) {
            throw new Error('Error processing multipart form data');
          }
        } else {
          // Handle JSON request
          ({ fileBuffer, metadata, size, path } = body);
          
          // Convert fileBuffer from array or other formats to Buffer
          if (fileBuffer && !Buffer.isBuffer(fileBuffer)) {
            if (Array.isArray(fileBuffer)) {
              fileBuffer = Buffer.from(fileBuffer);
            } else if (typeof fileBuffer === 'string') {
              // Handle base64 string
              fileBuffer = Buffer.from(fileBuffer, 'base64');
            } else if (fileBuffer instanceof ArrayBuffer) {
              // Handle ArrayBuffer
              fileBuffer = Buffer.from(new Uint8Array(fileBuffer));
            } else if (ArrayBuffer.isView(fileBuffer)) {
              // Handle TypedArray
              fileBuffer = Buffer.from(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
            }
          }
        }
        
        // Validate required fields
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
          throw new Error('Missing or invalid file data');
        }
        
        if (!metadata) {
          throw new Error('Missing file metadata');
        }
        
        if (!size || size <= 0) {
          size = fileBuffer.length; // Use buffer length as fallback
        }
        
        // Process the upload
        const result = await fileController.uploadFile(
          userId,
          fileBuffer,
          metadata,
          size,
          path || '/',
        );
        
        console.log('Upload result:', result);
        
        return result;
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    })

    // Preview file
    .get('/:fileId/preview', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const result = await fileController.previewFile(context.params.fileId, context.id);
        
        console.log('Preview result:', result);
        
        return result;
      } catch (error: unknown) {
        console.error('Error getting file preview:', error);
      }
    })
  
    // Download file
    .get('/:fileId/download', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const { stream, name, type, size, metadata } = await fileController.downloadFile(context.params.fileId, context.id);
        
        console.log(`Downloading file: ${name}, type: ${type}, size: ${size} for user ${context.id}`);
        
        // Set response headers using Elysia's context.headers
        context.headers = {
          'Content-Type': type,
          'Content-Length': size.toString(),
          'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`
        };
        
        // Add any additional metadata headers
        if (metadata) {
          Object.entries(metadata).forEach(([key, value]) => {
            if (typeof value === 'string') {
              context.headers[key] = value;
            }
          });
        }
        
        // Return the stream directly
        return stream;
      } catch (error) {
        console.error('Error downloading file:', error);
      }
    })

    // Rename file
    .put('/:fileId/rename', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const { newName } = context.body;
        
        const result = await fileController.renameFile(context.params.fileId, context.id, newName);

        console.log('Renamed file:', result);

        return result;
        
      } catch (error) {
        console.error('Error renaming file:', error);
      }
    })
    
    // Duplicate file
    .post('/:fileId/duplicate', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const result = await fileController.duplicateFile(context.params.fileId, context.id)

        console.log('Duplicated file:', result);

        return result;

      } catch (error) {
        console.error('Error duplicating file:', error);
      }
    })

    // Move file to bin
    .put('/:fileId/bin', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const result = await fileController.moveToBin(context.params.fileId, context.id);
        
        console.log('Moved file to bin:', result);

        return result;
      } catch (error) {
        console.error('Error moving file to bin:', error);
      }
    })

    // Restore file from bin
    .post('/:fileId/restore', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const result = await fileController.restoreFile(context.params.fileId, context.id);
      
        console.log('Restored file:', result);

      return result;
      } catch (error) {
        console.error('Error restoring file:', error); 
      }
    })

    // Delete file permanently
    .delete('/:fileId', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        console.log(`Permanently deleting file ${context.params.fileId}`);
        
        const result = await fileController.deleteFileForever(context.params.fileId, context.id);

        return result;
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    })

        // Empty bin
    .post('/empty-bin', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        const result = await fileController.emptyBin(context.id);
        console.log('Emptied bin:', result);
        return result;

      } catch (error) {
        console.error('Error emptying bin:', error);
      }
    })

    // Get storage stats
    .get('/stats', async (context: any) => {
      try {
        // Verify authentication
        const authError = await verifyAuth(context);
        if (authError) return authError;
        
        // Extract user data from context
        const userId = context.id;
        
        // Get storage stats from controller
        const result = await fileController.getStorageStats(userId);
        console.log('Got storage stats:', result);
        return result;

      } catch (error) {
        console.error('Error getting storage stats:', error);
      }
    })
};