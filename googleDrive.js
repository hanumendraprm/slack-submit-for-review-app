const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.folderId = null;
  }

  /**
   * Initialize Google Drive service
   */
  async initialize(serviceAccountKey, folderId) {
    try {
      // Parse service account key
      const credentials = typeof serviceAccountKey === 'string' 
        ? JSON.parse(serviceAccountKey) 
        : serviceAccountKey;

      // Create auth client
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      // Create drive client
      this.drive = google.drive({ version: 'v3', auth });
      this.folderId = folderId;

      console.log('📁 Google Drive service initialized');
      console.log(`📁 Target folder ID: ${folderId}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive service:', error);
      throw error;
    }
  }

  /**
   * Get or create subfolder by type
   */
  async getOrCreateSubfolder(folderType) {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive service not initialized');
      }

      // First, try to find existing subfolder
      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and name='${folderType}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create new subfolder if it doesn't exist
      const folderMetadata = {
        name: folderType,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId],
        description: `Resources of type: ${folderType}`
      };

      const createResponse = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name'
      });

      console.log(`📁 Created subfolder: ${folderType} (ID: ${createResponse.data.id})`);
      return createResponse.data.id;
    } catch (error) {
      console.error(`❌ Failed to get/create subfolder ${folderType}:`, error);
      throw error;
    }
  }

  /**
   * Upload file to Google Drive in appropriate subfolder
   */
  async uploadFile(fileBuffer, fileName, assetCode, resourceType, mimeType = null) {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive service not initialized');
      }

      // Get the appropriate subfolder based on resource type
      const subfolderId = await this.getOrCreateSubfolder(resourceType);

      // Create file metadata
      const fileMetadata = {
        name: `${assetCode}_${fileName}`,
        parents: [subfolderId], // Upload to subfolder instead of main folder
        description: `Resource for asset: ${assetCode} (Type: ${resourceType})`
      };

      // Create media
      const media = {
        mimeType: mimeType || this.getMimeType(fileName),
        body: fileBuffer
      };

      // Upload file
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink,webContentLink'
      });

      console.log(`📁 File uploaded to ${resourceType} folder: ${response.data.name} (ID: ${response.data.id})`);
      
      return {
        fileId: response.data.id,
        fileName: response.data.name,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
        folderType: resourceType
      };
    } catch (error) {
      console.error('❌ Failed to upload file to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files for an asset
   */
  async uploadFiles(files, assetCode, resourceType) {
    try {
      const uploadResults = [];
      
      for (const file of files) {
        const result = await this.uploadFile(
          file.buffer,
          file.name,
          assetCode,
          resourceType,
          file.mimetype
        );
        uploadResults.push(result);
      }

      return uploadResults;
    } catch (error) {
      console.error('❌ Failed to upload multiple files:', error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive service not initialized');
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,webViewLink,webContentLink,size,createdTime'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get file from Google Drive:', error);
      throw error;
    }
  }

  /**
   * List files in the target folder
   */
  async listFiles(query = '') {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive service not initialized');
      }

      const response = await this.drive.files.list({
        q: `'${this.folderId}' in parents and trashed=false${query ? ` and ${query}` : ''}`,
        fields: 'files(id,name,webViewLink,webContentLink,size,createdTime)',
        orderBy: 'createdTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ Failed to list files from Google Drive:', error);
      throw error;
    }
  }

  /**
   * Delete file by ID
   */
  async deleteFile(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive service not initialized');
      }

      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`📁 File deleted: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete file from Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create folder for an asset
   */
  async createAssetFolder(assetCode) {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive service not initialized');
      }

      const folderMetadata = {
        name: `Asset_${assetCode}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.folderId],
        description: `Resources for asset: ${assetCode}`
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name,webViewLink'
      });

      console.log(`📁 Asset folder created: ${response.data.name} (ID: ${response.data.id})`);
      
      return {
        folderId: response.data.id,
        folderName: response.data.name,
        webViewLink: response.data.webViewLink
      };
    } catch (error) {
      console.error('❌ Failed to create asset folder:', error);
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    const mimeTypes = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      
      // Videos
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mov': 'video/quicktime',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'webm': 'video/webm',
      'mkv': 'video/x-matroska',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      
      // Archives
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.drive !== null && this.folderId !== null;
  }

  /**
   * Get folder information
   */
  async getFolderInfo() {
    try {
      if (!this.drive || !this.folderId) {
        throw new Error('Google Drive service not initialized');
      }

      const response = await this.drive.files.get({
        fileId: this.folderId,
        fields: 'id,name,webViewLink,createdTime'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Failed to get folder info:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;
