import type { z } from 'zod';

import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import type { screenshotInputSchema } from '@/routes/web/web.routes';

import { performWebSearch } from '@/routes/web/web.search-handler';

import { contentV2 as contentV2Impl } from './web-v2/content';
import { linksV2 as linksV2Impl } from './web-v2/links';
import { markdownV2 as markdownV2Impl } from './web-v2/markdown';
import { pdfV2 as pdfV2Impl } from './web-v2/pdf';
import { scrapeV2 as scrapeV2Impl } from './web-v2/scrape';
// v2 operation modules
import { screenshotV2 as screenshotV2Impl } from './web-v2/screenshot';
// import { Env } from 'hono';

// export interface Env {
//   // Cloudflare API credentials
//   CLOUDFLARE_ACCESS_TOKEN: string;
//   CLOUDFLARE_ACCOUNT_ID: string;

//   // Database and other dependencies
//   D1_DB: D1Database;
//   NODE_ENV?: string;
// }

// Credit costs configuration - matches frontend actions.ts
const CREDIT_COSTS = {
  screenshot: 1,
  markdown: 1,
  json_extraction: 1,
  scrape_content: 1,
  scrape_elements: 1,
  scrape_links: 1,
  web_search: 1,
  pdf: 1,
} as const;

// Type definitions for API responses
interface CloudflareApiResponse {
  success: boolean;
  result?: any;
  errors?: any;
}

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

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
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
    };
  }> {
    try {
      const { type, limit = 20, offset = 0 } = params;

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
          files = await this.listPermanentFiles(type, limit, offset);
        } catch (sqlError) {
          console.error('Error querying SQLite:', sqlError);
        }
      }

      return {
        success: true,
        data: {
          sqliteStatus,
          files,
          totalFiles,
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

  /**
   * Take a screenshot of a webpage using Cloudflare Browser Rendering API
   * Enhanced with permanent URL storage in R2 and SQLite
   */
  async screenshot(params: z.infer<typeof screenshotInputSchema>): Promise<{
    success: boolean;
    data: {
      image: string;
      permanentUrl?: string;
      fileId?: string;
      metadata: {
        width: number;
        height: number;
        format: string;
        size: number;
        url: string;
        timestamp: string;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      const payload: Record<string, any> = {
        url: params.url,
        screenshotOptions: params.screenshotOptions || {},
        viewport: params.viewport,
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 45000,
        },
      };

      if (params.waitTime && params.waitTime > 0) {
        payload.waitFor = params.waitTime;
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
      }

      // Check content type to handle different response formats
      const contentType = response.headers.get('content-type');
      let imageBuffer: Buffer;
      let base64Image: string;

      if (contentType?.includes('application/json')) {
        // Handle JSON response
        const jsonData = (await response.json()) as CloudflareApiResponse;

        if (!jsonData.success) {
          throw new Error(`Screenshot failed: ${JSON.stringify(jsonData.errors)}`);
        }

        // If JSON response contains base64 image
        if (jsonData.result) {
          base64Image = String(jsonData.result);
          imageBuffer = Buffer.from(base64Image, 'base64');
        } else {
          throw new Error('No image data in response');
        }
      } else {
        // Handle binary response (image data)
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        base64Image = imageBuffer.toString('base64');
      }

      const format = params.screenshotOptions?.type ?? 'png';
      const metadata = {
        width: params.viewport?.width ?? 1280,
        height: params.viewport?.height ?? 800,
        format,
        size: imageBuffer.length,
        url: params.url,
        timestamp: new Date().toISOString(),
      };

      // Create permanent URL if user is initialized and SQLite is available
      let permanentUrl: string | undefined;
      let fileId: string | undefined;

      console.log('🔍 Screenshot permanent URL check:', {
        userId: this.userId,
        sqlEnabled: this.sqlEnabled,
        hasR2Bucket: !!this.env.R2_BUCKET,
        cdnDomain: this.env.CDN_DOMAIN,
        cdnPreviewDomain: this.env.CDN_PREVIEW_DOMAIN,
        nodeEnv: this.env.NODE_ENV,
      });

      if (this.userId && this.sqlEnabled) {
        try {
          console.log('📤 Attempting to store screenshot in R2 and create permanent URL...');
          const storageResult = await this.storeFileAndCreatePermanentUrl(
            imageBuffer,
            params.url,
            'screenshot',
            metadata,
            format,
          );
          permanentUrl = storageResult.permanentUrl;
          fileId = storageResult.fileId;
          console.log('✅ Screenshot stored successfully:', {
            fileId,
            permanentUrl,
            r2Key: storageResult.r2Key,
            filename: storageResult.filename,
          });
        } catch (storageError) {
          console.error('❌ Failed to create permanent URL for screenshot:', storageError);
          // Continue without permanent URL - don't fail the entire operation
        }
      } else if (this.userId && !this.sqlEnabled) {
        console.warn('⚠️ SQLite not available - permanent URLs disabled for this session');
      } else if (!this.userId) {
        console.warn('⚠️ User ID not initialized - permanent URLs disabled');
      } else {
        console.warn('⚠️ Unknown state for permanent URL creation');
      }

      return {
        success: true,
        data: {
          image: base64Image,
          permanentUrl,
          fileId,
          metadata,
        },
        creditsCost: CREDIT_COSTS.screenshot,
      };
    } catch (error) {
      console.error('Screenshot error:', error);
      throw new Error(`Failed to capture screenshot: ${error}`);
    }
  }

  /**
   * Extract markdown content from a webpage
   */
  async extractMarkdown(params: { url: string; waitTime?: number }): Promise<{
    success: boolean;
    data: {
      markdown: string;
      metadata: {
        title?: string;
        description?: string;
        url: string;
        timestamp: string;
        wordCount: number;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: params.url }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Markdown extraction failed: ${response.status} ${errorText}`);
      }

      // Handle JSON response
      const jsonData = (await response.json()) as CloudflareApiResponse;

      if (!jsonData.success) {
        throw new Error(`Markdown extraction failed: ${JSON.stringify(jsonData.errors)}`);
      }

      const markdownContent = String(jsonData.result || '');

      return {
        success: true,
        data: {
          markdown: markdownContent,
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            wordCount: markdownContent.split(/\s+/).length,
            title: undefined,
            description: undefined,
          },
        },
        creditsCost: CREDIT_COSTS.markdown,
      };
    } catch (error) {
      console.error('Markdown extraction error:', error);
      throw new Error(`Failed to extract markdown: ${error}`);
    }
  }

  /**
   * Extract structured JSON data from a webpage
   */
  async extractJson(params: {
    url: string;
    schema?: Record<string, any>;
    waitTime?: number;
    instructions?: string;
  }): Promise<{
    success: boolean;
    data: {
      extracted: Record<string, any>;
      metadata: {
        url: string;
        timestamp: string;
        fieldsExtracted: number;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      // Construct the payload similar to frontend
      const payload: Record<string, any> = {
        url: params.url,
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 45000,
        },
      };

      // Add prompt if provided (using instructions as prompt)
      if (params.instructions) {
        payload.prompt = params.instructions;
      }

      // Add waitTime if provided
      if (params.waitTime && params.waitTime > 0) {
        payload.waitForTimeout = params.waitTime;
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JSON extraction failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as CloudflareApiResponse;

      if (!data.success || !data.result) {
        throw new Error('JSON extraction failed: No result in response');
      }

      const extractedData = data.result as Record<string, any>;

      return {
        success: true,
        data: {
          extracted: extractedData,
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            fieldsExtracted: Object.keys(extractedData || {}).length,
          },
        },
        creditsCost: CREDIT_COSTS.json_extraction,
      };
    } catch (error) {
      console.error('JSON extraction error:', error);
      throw new Error(`Failed to extract JSON data: ${error}`);
    }
  }

  /**
   * Get raw HTML content from a webpage
   */
  async getContent(params: { url: string; waitTime?: number }): Promise<{
    success: boolean;
    data: {
      content: string;
      metadata: {
        title?: string;
        description?: string;
        url: string;
        timestamp: string;
        contentType: string;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: params.url }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTML content fetch failed: ${response.status} ${errorText}`);
      }

      // Check content type to determine response format
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        // Handle JSON response
        const jsonData = (await response.json()) as CloudflareApiResponse;

        if (!jsonData.success) {
          throw new Error(`HTML content fetch failed: ${JSON.stringify(jsonData.errors)}`);
        }

        // Return the HTML content from result property - matching schema
        return {
          success: true,
          data: {
            content: String(jsonData.result || ''),
            metadata: {
              url: params.url,
              timestamp: new Date().toISOString(),
              contentType: 'text/html',
              title: undefined,
              description: undefined,
            },
          },
          creditsCost: CREDIT_COSTS.scrape_content,
        };
      } else {
        // Direct HTML response
        const htmlContent = await response.text();
        return {
          success: true,
          data: {
            content: htmlContent,
            metadata: {
              url: params.url,
              timestamp: new Date().toISOString(),
              contentType: 'text/html',
              title: undefined,
              description: undefined,
            },
          },
          creditsCost: CREDIT_COSTS.scrape_content,
        };
      }
    } catch (error) {
      console.error('Content extraction error:', error);
      throw new Error(`Failed to extract content: ${error}`);
    }
  }

  /**
   * Scrape specific elements from a webpage
   */
  async scrapeElements(params: {
    url: string;
    elements: Array<{
      selector: string;
      attributes?: string[];
    }>;
    waitTime?: number;
    headers?: Record<string, string>;
  }): Promise<{
    success: boolean;
    data: {
      elements: Array<{
        selector: string;
        data: Record<string, any>;
      }>;
      metadata: {
        url: string;
        timestamp: string;
        elementsFound: number;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      // Construct the payload with only supported parameters (matching frontend)
      const payload: Record<string, any> = {
        url: params.url,
        elements: params.elements,
        gotoOptions: {
          waitUntil: 'networkidle0',
          timeout: 45000,
        },
      };

      // Add optional parameters if provided
      if (params.waitTime && params.waitTime > 0) {
        payload.waitForTimeout = params.waitTime;
      }

      if (params.headers && Object.keys(params.headers).length > 0) {
        payload.setExtraHTTPHeaders = params.headers;
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/scrape`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Scrape failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as CloudflareApiResponse;

      if (!data.success || !data.result) {
        throw new Error('Scrape failed: No result in response');
      }

      // Transform the result to match schema expectations
      const elementsArray = Array.isArray(data.result) ? data.result : [];
      const transformedElements = elementsArray.map((element: any) => ({
        selector: String(element.selector || ''),
        data: (element.data || element) as Record<string, any>,
      }));

      return {
        success: true,
        data: {
          elements: transformedElements,
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            elementsFound: transformedElements.length,
          },
        },
        creditsCost: CREDIT_COSTS.scrape_elements,
      };
    } catch (error) {
      console.error('Element scraping error:', error);
      throw new Error(`Failed to scrape elements: ${error}`);
    }
  }

  /**
   * Extract all links from a webpage
   */
  async extractLinks(params: { url: string; includeExternal?: boolean; waitTime?: number }): Promise<{
    success: boolean;
    data: {
      links: Array<{
        url: string;
        text: string;
        type: 'internal' | 'external';
      }>;
      metadata: {
        url: string;
        timestamp: string;
        totalLinks: number;
        internalLinks: number;
        externalLinks: number;
      };
    };
    creditsCost: number;
  }> {
    const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = this.env;

    try {
      const payload = {
        url: params.url,
        visibleLinksOnly: false, // Match frontend default
      };

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/links`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Links retrieval failed: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as CloudflareApiResponse;

      if (!data.success || !data.result) {
        throw new Error('Links retrieval failed: No result in response');
      }

      const links = Array.isArray(data.result) ? data.result : [];

      return {
        success: true,
        data: {
          links: links.map((link: any) => ({
            url: String(link.url || link.href || ''),
            text: String(link.text || link.title || ''),
            type: (link.internal ? 'internal' : 'external') as 'internal' | 'external',
          })),
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            totalLinks: links.length,
            internalLinks: links.filter((l: any) => l.internal).length,
            externalLinks: links.filter((l: any) => !l.internal).length,
          },
        },
        creditsCost: CREDIT_COSTS.scrape_links,
      };
    } catch (error) {
      console.error('Link extraction error:', error);
      throw new Error(`Failed to extract links: ${error}`);
    }
  }

  /**
   * Perform web search using multiple search engines
   */
  async search(
    params: {
      query: string;
      limit?: number;
    },
    clientIp?: string,
  ) {
    try {
      const searchResult = await performWebSearch({
        query: params.query,
        limit: params.limit || 10,
        clientIp,
      });

      return {
        success: true,
        data: {
          results: searchResult.results,
          metadata: {
            query: params.query,
            totalResults: searchResult.totalResults,
            searchTime: searchResult.searchTime,
            sources: searchResult.sources,
            timestamp: new Date().toISOString(),
          },
        },
        creditsCost: CREDIT_COSTS.web_search,
      };
    } catch (error) {
      console.error('Web search error:', error);
      throw new Error(`Failed to perform search: ${error}`);
    }
  }

  /**
   * Simple HTML to Markdown conversion
   * Note: This is a basic implementation. For production, consider using a library like turndown
   */
  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
        let counter = 1;
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`);
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up multiple newlines
      .trim();
  }

  /**
   * Simple JSON extraction from HTML
   * Note: This is a basic implementation. For production, consider using AI or more sophisticated parsing
   */
  private extractJsonFromHtml(html: string, schema: Record<string, any>): Record<string, any> {
    const extracted: Record<string, any> = {};

    // Basic extraction based on common patterns
    for (const [key, type] of Object.entries(schema)) {
      if (typeof type === 'string' && type === 'string') {
        // Try to extract text content
        if (key.toLowerCase().includes('title')) {
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
          if (titleMatch) {
            extracted[key] = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          }
        } else if (key.toLowerCase().includes('description')) {
          const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
          if (descMatch) {
            extracted[key] = descMatch[1].trim();
          }
        }
      }
    }

    return extracted;
  }

  /**
   * Parse elements from HTML
   */
  private parseElementsFromHtml(
    html: string,
    selectors: Array<{ selector: string; attributes?: string[] }>,
  ): Array<any> {
    const elements: Array<any> = [];

    // Basic HTML parsing - in production, use a proper DOM parser
    for (const { selector, attributes } of selectors) {
      // Simple implementation for common selectors
      if (selector.startsWith('.')) {
        const className = selector.slice(1);
        const regex = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)</[^>]*>`, 'gi');

        const matches = html.matchAll(regex);
        for (const match of matches) {
          elements.push({
            selector,
            content: match[1].replace(/<[^>]*>/g, '').trim(),
            attributes: attributes || [],
          });
        }
      }
    }

    return elements;
  }

  /**
   * Extract links from HTML
   */
  private extractLinksFromHtml(
    html: string,
    baseUrl: string,
    includeExternal: boolean,
  ): Array<{ url: string; text: string; internal: boolean }> {
    const links: Array<{ url: string; text: string; internal: boolean }> = [];
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
    const baseDomain = new URL(baseUrl).hostname;

    const matches = html.matchAll(linkRegex);
    for (const match of matches) {
      const url = match[1];
      const text = match[2].replace(/<[^>]*>/g, '').trim();

      if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
        continue;
      }

      let fullUrl: string;
      let isInternal: boolean;

      try {
        if (url.startsWith('http')) {
          fullUrl = url;
          isInternal = new URL(url).hostname === baseDomain;
        } else {
          fullUrl = new URL(url, baseUrl).toString();
          isInternal = true;
        }

        if (!includeExternal && !isInternal) {
          continue;
        }

        links.push({
          url: fullUrl,
          text,
          internal: isInternal,
        });
      } catch {
        // Skip invalid URLs
        continue;
      }
    }

    return links;
  }

  /**
   * HTTP handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const body = (await request.json()) as any;

      switch (path) {
        case '/screenshot': {
          const screenshotResult = await this.screenshot(body);
          return new Response(JSON.stringify(screenshotResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/markdown': {
          const markdownResult = await this.extractMarkdown(body);
          return new Response(JSON.stringify(markdownResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/extract-json': {
          const jsonResult = await this.extractJson(body);
          return new Response(JSON.stringify(jsonResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/content': {
          const contentResult = await this.getContent(body);
          return new Response(JSON.stringify(contentResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/scrape': {
          const scrapeResult = await this.scrapeElements(body);
          return new Response(JSON.stringify(scrapeResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/links': {
          const linksResult = await this.extractLinks(body);
          return new Response(JSON.stringify(linksResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/search': {
          const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
          const searchResult = await this.search(body, clientIp);
          return new Response(JSON.stringify(searchResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/debug/files': {
          // Debug endpoint to list stored files and SQLite status
          const debugResult = await this.debugListFiles(body);
          return new Response(JSON.stringify(debugResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/debug/delete': {
          // Debug endpoint to delete a file from permanent_files and optionally R2
          const deleteResult = await this.debugDeleteFile(body);
          return new Response(JSON.stringify(deleteResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // -------------------- V2 endpoints (browser-based) --------------------
        case '/v2/screenshot': {
          const screenshotResult = await this.screenshotV2(body);
          return new Response(JSON.stringify(screenshotResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/v2/markdown': {
          const markdownResult = await this.markdownV2(body);
          return new Response(JSON.stringify(markdownResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/v2/content': {
          const contentResult = await this.contentV2(body);
          return new Response(JSON.stringify(contentResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/v2/links': {
          const linksResult = await this.linksV2(body);
          return new Response(JSON.stringify(linksResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/v2/scrape': {
          const scrapeResult = await this.scrapeV2(body);
          return new Response(JSON.stringify(scrapeResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        case '/v2/pdf': {
          const pdfResult = await this.pdfV2(body);
          return new Response(JSON.stringify(pdfResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('WebDurableObject error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  v2 – Browser-based screenshot                                          */
  /* ------------------------------------------------------------------------ */

  async screenshotV2(params: Parameters<typeof screenshotV2Impl>[1]) {
    return screenshotV2Impl(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v2 – Browser-based markdown extraction                                 */
  /* ------------------------------------------------------------------------ */

  async markdownV2(params: Parameters<typeof markdownV2Impl>[1]) {
    return markdownV2Impl(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v2 – Browser-based HTML content extraction                              */
  /* ------------------------------------------------------------------------ */

  async contentV2(params: Parameters<typeof contentV2Impl>[1]) {
    return contentV2Impl(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v2 – Browser-based Link extraction                                      */
  /* ------------------------------------------------------------------------ */

  async linksV2(params: Parameters<typeof linksV2Impl>[1]) {
    return linksV2Impl(this.env, params);
  }

  /* ------------------------------------------------------------------------ */
  /*  v2 – Browser-based Element scraping                                     */
  /* ------------------------------------------------------------------------ */

  async scrapeV2(params: Parameters<typeof scrapeV2Impl>[1]) {
    return scrapeV2Impl(this.env, params);
  }

  async pdfV2(params: Parameters<typeof pdfV2Impl>[1]) {
    return pdfV2Impl(this.env, params);
  }
}
