import type { Buffer } from 'node:buffer';

import { DurableObject } from 'cloudflare:workers';
import { createHash } from 'node:crypto';

import { contentV1 } from '@/lib/v1/content';
import { jsonExtractionV1 } from '@/lib/v1/json-extraction';
import { linksV1 } from '@/lib/v1/links';
import { markdownV1 } from '@/lib/v1/markdown';
import { pdfV1 } from '@/lib/v1/pdf';
import { scrapeV1 } from '@/lib/v1/scrape';
import { screenshotV1 } from '@/lib/v1/screenshot';
import { searchV1 } from '@/lib/v1/search';

// Database record interfaces
interface FileRecord {
  id: string;
  type: 'screenshot' | 'pdf';
  url: string;
  filename: string;
  r2_key: string;
  public_url: string;
  metadata: string; // JSON string
  created_at: string;
  expires_at?: string;
}

export class WebDurableObject extends DurableObject<CloudflareBindings> {
  private userId: string;
  protected env: CloudflareBindings;
  private sql: SqlStorage | null = null;
  private sqlEnabled: boolean = false;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.env = env;
    this.userId = '';

    // Check if SQLite is available
    try {
      this.sql = ctx.storage.sql;
      console.log('✅ SQLite storage API accessible - testing database operations...');

      // Start with SQLite disabled, enable only if initialization succeeds
      this.sqlEnabled = false;
      this.initializeDatabase();

      // Check if initialization was successful
      if (this.sqlEnabled === false) {
        console.error('❌ Database initialization failed - permanent URLs disabled');
        this.sql = null;
      } else {
        console.log('✅ Database initialization completed successfully - permanent URLs enabled');
      }
    } catch (error) {
      console.warn('⚠️ SQLite not available for this Durable Object instance:', error);
      this.sql = null;
      this.sqlEnabled = false;
    }
  }

  /**
   * Initialize SQLite database tables for permanent URL storage
   * Only runs if SQLite is enabled
   */
  private initializeDatabase(): void {
    if (!this.sql) {
      console.error('❌ No SQL storage available');
      this.sqlEnabled = false;
      return;
    }

    try {
      console.log('🔍 Testing basic SQL operations...');

      // Test basic SQL access first
      try {
        console.log('🧪 Testing PRAGMA query...');
        const cursor = this.sql.exec(`PRAGMA table_list`);
        const tables = [...cursor].map((row: any) => row.name);
        console.log('📋 Existing tables:', tables);

        if (!tables.includes('permanent_files')) {
          console.log('🔧 Creating permanent_files table...');

          // Create table for storing file metadata and permanent URLs
          this.sql.exec(`
            CREATE TABLE IF NOT EXISTS permanent_files (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL CHECK (type IN ('screenshot', 'pdf')),
              url TEXT NOT NULL,
              filename TEXT NOT NULL,
              r2_key TEXT NOT NULL UNIQUE,
              public_url TEXT NOT NULL,
              metadata TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              expires_at TEXT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_permanent_files_type ON permanent_files(type);
            CREATE INDEX IF NOT EXISTS idx_permanent_files_created_at ON permanent_files(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_permanent_files_expires_at ON permanent_files(expires_at);
          `);

          console.log('✅ permanent_files table created successfully');
        } else {
          console.log('✅ permanent_files table already exists');
        }

        // If we get here, SQL is working
        console.log('🎉 SQLite operations successful - enabling permanent URLs');
        this.sqlEnabled = true;
      } catch (sqlError) {
        console.error('❌ SQL operations failed:', sqlError);
        throw sqlError; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      console.error('💡 This likely means the Durable Object was not created with SQLite support');
      this.sqlEnabled = false;
      this.sql = null;
    }
  }

  /**
   * Generate a secure hash for user directory without exposing user ID
   */
  private generateUserHash(userId: string): string {
    return createHash('sha256').update(`weblinq_user_${userId}_salt_2025`).digest('hex').substring(0, 16); // Use first 16 chars for shorter paths
  }

  /**
   * Generate R2 key for file storage
   */
  private generateR2Key(type: 'screenshot' | 'pdf', userId: string, filename: string): string {
    const userHash = this.generateUserHash(userId);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${type}s/${userHash}/${date}/${filename}`;
  }

  /**
   * Generate unique filename with timestamp
   */
  private generateFilename(url: string, type: 'screenshot' | 'pdf', format?: string): string {
    const timestamp = Date.now();
    const domain = new URL(url).hostname.replace(/[^a-z0-9]/gi, '_');
    const extension = type === 'pdf' ? 'pdf' : format || 'png';
    return `${domain}_${timestamp}.${extension}`;
  }

  /**
   * Store file in R2 bucket and save metadata to SQLite
   * Falls back gracefully if SQLite is not available
   */
  async storeFileAndCreatePermanentUrl(
    data: Uint8Array | Buffer,
    url: string,
    type: 'screenshot' | 'pdf',
    metadata: Record<string, any> = {},
    format?: string,
  ): Promise<{
    fileId: string;
    permanentUrl: string;
    r2Key: string;
    filename: string;
  }> {
    if (!this.userId) {
      throw new Error('User ID not initialized');
    }

    if (!this.sqlEnabled || !this.sql) {
      throw new Error(
        'SQLite storage not available for this Durable Object instance. Create a new user session to enable permanent URLs.',
      );
    }

    // Generate unique identifiers
    const fileId = createHash('sha256')
      .update(`${this.userId}_${type}_${url}_${Date.now()}`)
      .digest('hex')
      .substring(0, 12);

    const filename = this.generateFilename(url, type, format);
    const r2Key = this.generateR2Key(type, this.userId, filename);

    try {
      console.log('📁 Uploading to R2 bucket:', { r2Key, dataSize: data.length, type, format });

      // Upload to R2 bucket
      const r2Object = await this.env.R2_BUCKET.put(r2Key, data, {
        httpMetadata: {
          contentType: type === 'pdf' ? 'application/pdf' : `image/${format || 'png'}`,
        },
        customMetadata: {
          originalUrl: url,
          userId: this.userId,
          type,
          createdAt: new Date().toISOString(),
        },
      });

      if (!r2Object) {
        throw new Error('Failed to upload file to R2');
      }

      console.log('✅ R2 upload successful:', { key: r2Object.key, size: r2Object.size });

      // Generate public URL using custom CDN domain
      const isProduction = this.env.NODE_ENV === 'production';
      const cdnDomain = isProduction ? this.env.CDN_DOMAIN : this.env.CDN_PREVIEW_DOMAIN;
      const publicUrl = `https://${cdnDomain}/${r2Key}`;

      console.log('🌐 Generated public URL:', { publicUrl, isProduction, cdnDomain });

      // Store metadata in SQLite
      console.log('💾 Storing metadata in SQLite...');
      this.sql.exec(
        `INSERT INTO permanent_files (id, type, url, filename, r2_key, public_url, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        fileId,
        type,
        url,
        filename,
        r2Key,
        publicUrl,
        JSON.stringify(metadata),
      );

      console.log('✅ SQLite metadata stored successfully');

      return {
        fileId,
        permanentUrl: publicUrl,
        r2Key,
        filename,
      };
    } catch (error) {
      console.error(`Failed to store ${type}:`, error);
      throw new Error(`Failed to create permanent URL for ${type}: ${error}`);
    }
  }

  /**
   * Retrieve permanent URL by file ID
   * Returns null if SQLite is not available
   */
  private async getPermanentUrl(fileId: string): Promise<FileRecord | null> {
    if (!this.sqlEnabled || !this.sql) {
      return null;
    }

    const cursor = this.sql.exec(`SELECT * FROM permanent_files WHERE id = ? LIMIT 1`, fileId);

    const result = cursor.next();
    if (result.done) {
      return null;
    }

    const row = result.value as any;
    return {
      id: row.id,
      type: row.type,
      url: row.url,
      filename: row.filename,
      r2_key: row.r2_key,
      public_url: row.public_url,
      metadata: row.metadata,
      created_at: row.created_at,
      expires_at: row.expires_at,
    };
  }

  /**
   * List user's permanent files with pagination
   * Returns empty array if SQLite is not available
   */
  private async listPermanentFiles(
    type?: 'screenshot' | 'pdf',
    limit: number = 50,
    offset: number = 0,
    sortBy: 'created_at' | 'filename' = 'created_at',
    order: 'asc' | 'desc' = 'desc',
  ): Promise<FileRecord[]> {
    if (!this.sqlEnabled || !this.sql) {
      return [];
    }

    let query = `SELECT * FROM permanent_files`;
    const params: any[] = [];

    if (type) {
      query += ` WHERE type = ?`;
      params.push(type);
    }

    // Validate sortBy and order to prevent SQL injection
    const validSortColumns = ['created_at', 'filename'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortDirection} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const cursor = this.sql.exec(query, ...params);
    const results: FileRecord[] = [];

    for (const row of cursor) {
      results.push({
        id: (row as any).id,
        type: (row as any).type,
        url: (row as any).url,
        filename: (row as any).filename,
        r2_key: (row as any).r2_key,
        public_url: (row as any).public_url,
        metadata: (row as any).metadata,
        created_at: (row as any).created_at,
        expires_at: (row as any).expires_at,
      });
    }

    return results;
  }

  /**
   * Initialize the Durable Object with user-specific context
   */
  async initializeUser(userId: string): Promise<void> {
    this.userId = userId;
  }

  /**
   * Debug endpoint to check SQLite status and list stored files
   */
  async debugListFiles(
    params: {
      type?: 'screenshot' | 'pdf';
      limit?: number;
      offset?: number;
      sortBy?: 'created_at' | 'filename';
      order?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    success: boolean;
    data: {
      sqliteStatus: {
        enabled: boolean;
        available: boolean;
        userId: string;
      };
      files: FileRecord[];
      totalFiles: number;
      hasMore: boolean;
    };
  }> {
    try {
      const { type, limit = 20, offset = 0, sortBy = 'created_at', order = 'desc' } = params;

      // Get SQLite status
      const sqliteStatus = {
        enabled: this.sqlEnabled,
        available: !!this.sql,
        userId: this.userId,
      };

      // Get files if SQLite is available
      let files: FileRecord[] = [];
      let totalFiles = 0;

      if (this.sqlEnabled && this.sql) {
        try {
          // Get total count
          const countQuery = type
            ? `SELECT COUNT(*) as count FROM permanent_files WHERE type = ?`
            : `SELECT COUNT(*) as count FROM permanent_files`;
          const countParams = type ? [type] : [];
          const countCursor = this.sql.exec(countQuery, ...countParams);
          const countResult = countCursor.next();
          totalFiles = countResult.done ? 0 : (countResult.value as any).count;

          // Get files
          files = await this.listPermanentFiles(type, limit, offset, sortBy, order);
        } catch (sqlError) {
          console.error('Error querying SQLite:', sqlError);
        }
      }

      const hasMore = offset + files.length < totalFiles;

      return {
        success: true,
        data: {
          sqliteStatus,
          files,
          totalFiles,
          hasMore,
        },
      };
    } catch (error) {
      console.error('Debug list files error:', error);
      return {
        success: false,
        data: {
          sqliteStatus: {
            enabled: false,
            available: false,
            userId: this.userId || 'not-initialized',
          },
          files: [],
          totalFiles: 0,
          hasMore: false,
        },
      };
    }
  }

  /**
   * Debug endpoint to delete a file record from permanent_files table
   * Also optionally delete the file from R2 storage
   */
  async debugDeleteFile(params: { fileId: string; deleteFromR2?: boolean }): Promise<{
    success: boolean;
    data: {
      fileId: string;
      wasFound: boolean;
      deletedFromDatabase: boolean;
      deletedFromR2: boolean;
      deletedFile?: FileRecord;
      error?: string;
    };
  }> {
    try {
      const { fileId, deleteFromR2 = false } = params;

      if (!this.sqlEnabled || !this.sql) {
        return {
          success: false,
          data: {
            fileId,
            wasFound: false,
            deletedFromDatabase: false,
            deletedFromR2: false,
            error: 'SQLite not available for this Durable Object instance',
          },
        };
      }

      console.log('🗑️ Debug delete file request:', { fileId, deleteFromR2 });

      // First, get the file record before deletion
      let fileRecord: FileRecord | null = null;
      try {
        const selectCursor = this.sql.exec(`SELECT * FROM permanent_files WHERE id = ? LIMIT 1`, fileId);
        const selectResult = selectCursor.next();

        if (!selectResult.done) {
          const row = selectResult.value as any;
          fileRecord = {
            id: row.id,
            type: row.type,
            url: row.url,
            filename: row.filename,
            r2_key: row.r2_key,
            public_url: row.public_url,
            metadata: row.metadata,
            created_at: row.created_at,
            expires_at: row.expires_at,
          };
          console.log('📄 Found file record:', {
            id: fileRecord.id,
            type: fileRecord.type,
            filename: fileRecord.filename,
            r2_key: fileRecord.r2_key,
          });
        }
      } catch (selectError) {
        console.error('❌ Error selecting file record:', selectError);
        return {
          success: false,
          data: {
            fileId,
            wasFound: false,
            deletedFromDatabase: false,
            deletedFromR2: false,
            error: `Failed to query file record: ${selectError}`,
          },
        };
      }

      if (!fileRecord) {
        console.log('❌ File not found in database:', fileId);
        return {
          success: true,
          data: {
            fileId,
            wasFound: false,
            deletedFromDatabase: false,
            deletedFromR2: false,
            error: 'File not found in database',
          },
        };
      }

      // Delete from database
      let deletedFromDatabase = false;
      try {
        this.sql.exec(`DELETE FROM permanent_files WHERE id = ?`, fileId);
        deletedFromDatabase = true;
        console.log('✅ Deleted file record from database:', fileId);
      } catch (deleteError) {
        console.error('❌ Error deleting from database:', deleteError);
        return {
          success: false,
          data: {
            fileId,
            wasFound: true,
            deletedFromDatabase: false,
            deletedFromR2: false,
            deletedFile: fileRecord,
            error: `Failed to delete from database: ${deleteError}`,
          },
        };
      }

      // Optionally delete from R2
      let deletedFromR2 = false;
      if (deleteFromR2 && fileRecord.r2_key) {
        try {
          console.log('🗑️ Attempting to delete from R2:', fileRecord.r2_key);
          await this.env.R2_BUCKET.delete(fileRecord.r2_key);
          deletedFromR2 = true;
          console.log('✅ Deleted file from R2:', fileRecord.r2_key);
        } catch (r2Error) {
          console.error('❌ Error deleting from R2:', r2Error);
          // Don't fail the entire operation if R2 deletion fails
          console.warn('⚠️ Database deletion succeeded, but R2 deletion failed');
        }
      }

      return {
        success: true,
        data: {
          fileId,
          wasFound: true,
          deletedFromDatabase,
          deletedFromR2,
          deletedFile: fileRecord,
        },
      };
    } catch (error) {
      console.error('❌ Debug delete file error:', error);
      return {
        success: false,
        data: {
          fileId: params.fileId,
          wasFound: false,
          deletedFromDatabase: false,
          deletedFromR2: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based screenshot                                          */
  /* ------------------------------------------------------------------------ */

  async screenshotV1(params: Parameters<typeof screenshotV1>[1]) {
    return screenshotV1(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based markdown extraction                                 */
  /* ------------------------------------------------------------------------ */

  async markdownV1(params: Parameters<typeof markdownV1>[1]) {
    return markdownV1(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based HTML content extraction                              */
  /* ------------------------------------------------------------------------ */

  async contentV1(params: Parameters<typeof contentV1>[1]) {
    return contentV1(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based Link extraction                                      */
  /* ------------------------------------------------------------------------ */

  async linksV1(params: Parameters<typeof linksV1>[1]) {
    return linksV1(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based Element scraping                                     */
  /* ------------------------------------------------------------------------ */

  async scrapeV1(params: Parameters<typeof scrapeV1>[1]) {
    return scrapeV1(this.env, params);
  }

  async pdfV1(params: Parameters<typeof pdfV1>[1]) {
    return pdfV1(this.env, params);
  }

  async searchV1(params: Parameters<typeof searchV1>[1]) {
    return searchV1(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – AI-powered JSON extraction                                        */
  /* ------------------------------------------------------------------------ */

  async jsonExtractionV1(params: Parameters<typeof jsonExtractionV1>[1]) {
    return jsonExtractionV1(this.env, params);
  }
}
