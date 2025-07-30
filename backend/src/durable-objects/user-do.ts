import type { Buffer } from 'node:buffer';

import { DurableObject } from 'cloudflare:workers';
import { createHash } from 'node:crypto';

import { deductCredits, getUserCredits } from '@/db/queries';
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

/**
 * Credit costs for different web operations
 */
export const CREDIT_COSTS = {
  SCREENSHOT: 1,
  MARKDOWN: 1,
  JSON_EXTRACTION: 2, // Higher cost due to AI processing
  CONTENT: 1,
  SCRAPE: 1,
  LINKS: 1,
  SEARCH: 1,
  PDF: 1,
} as const;

export type WebOperation = keyof typeof CREDIT_COSTS;

/**
 * Result wrapper that includes credit information
 */
export interface CreditAwareResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  creditsCost: number;
  creditsRemaining: number;
}

export class WebDurableObject extends DurableObject<CloudflareBindings> {
  private userId: string;
  protected env: CloudflareBindings;
  private sql: SqlStorage | null = null;

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    this.env = env;
    this.userId = '';

    // Check if SQLite is available (production only)
    try {
      this.sql = ctx.storage.sql;
      console.log('✅ SQLite storage API accessible');
    } catch (error) {
      console.warn('⚠️ SQLite not available for this Durable Object instance:', error);
      this.sql = null;
    }

    // Load user ID from persistent storage if available
    this.loadUserIdFromStorage();
  }

  /**
   * Load user ID from persistent storage
   * Called during constructor to restore user context after DO wakeup
   */
  private async loadUserIdFromStorage(): Promise<void> {
    try {
      const storedUserId = await this.ctx.storage.get<string>('userId');
      if (storedUserId) {
        this.userId = storedUserId;
        console.log(`🔄 Restored user context from storage: ${storedUserId}`);
      } else {
        console.log('💤 No user ID found in storage - awaiting initialization');
      }
    } catch (error) {
      console.error('❌ Failed to load user ID from storage:', error);
      // Don't throw - this is a non-critical failure during startup
    }
  }

  /**
   * Combined initialization method called during user signup
   * This replaces the separate initializeUser and initializeDatabase calls
   */
  async initializeUserAndDatabase(userId: string): Promise<void> {
    console.log(`🔧 Starting combined initialization for user ${userId}...`);

    // Set user context
    this.userId = userId;
    console.log(`✅ User context set for ${userId}`);

    // Persist user ID in Durable Object storage for future wakeups
    await this.ctx.storage.put('userId', userId);
    console.log(`💾 User ID persisted to storage for ${userId}`);

    // Initialize database only in production where SQLite is available
    const isProduction = this.env.NODE_ENV === 'production';
    if (this.sql && isProduction) {
      this.initializeDatabase();
      console.log(`✅ Database initialization completed for user ${userId} (production)`);
    } else {
      console.log(`ℹ️ Skipping database initialization for user ${userId} (development or SQLite unavailable)`);
    }

    console.log(`🎉 Combined initialization completed successfully for user ${userId}`);
  }

  /**
   * Initialize SQLite database tables for permanent URL storage
   * Only runs if SQLite is enabled
   */
  private initializeDatabase(): void {
    if (!this.sql) {
      console.error('❌ No SQL storage available');
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
      } catch (sqlError) {
        console.error('❌ SQL operations failed:', sqlError);
        throw sqlError; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      console.error('💡 This likely means the Durable Object was not created with SQLite support');
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

    if (!this.sql) {
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

      // Combine the original metadata with R2 information for richer data
      const enrichedMetadata = {
        ...metadata, // Original operation metadata (screenshot dimensions, etc.)
        r2Size: r2Object.size, // Actual R2 file size
        r2Uploaded: r2Object.uploaded?.toISOString() || new Date().toISOString(), // R2 upload timestamp
        r2Key: r2Object.key,
        r2Checksum: r2Object.checksums?.md5,
      };

      // Use R2 upload time or current time for created_at
      const createdAt = r2Object.uploaded?.toISOString() || new Date().toISOString();

      this.sql.exec(
        `INSERT INTO permanent_files (id, type, url, filename, r2_key, public_url, metadata, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        fileId,
        type,
        url,
        filename,
        r2Key,
        publicUrl,
        JSON.stringify(enrichedMetadata),
        createdAt,
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
    if (!this.sql) {
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
    if (!this.sql) {
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
   * This is now primarily a fallback for edge cases since initialization
   * happens during user signup via initializeUserAndDatabase
   */
  async initializeUser(userId: string): Promise<void> {
    // Only set the user context if not already set
    if (!this.userId) {
      this.userId = userId;
      console.log(`⚠️ Late initialization: setting user context for ${userId}`);

      // Store in persistent storage for future wakeups
      await this.ctx.storage.put('userId', userId);
      console.log(`💾 User ID persisted to storage during late initialization: ${userId}`);
    } else if (this.userId !== userId) {
      console.warn(`❌ User ID mismatch: expected ${this.userId}, got ${userId}`);
      throw new Error(`Invalid user context: expected ${this.userId}, got ${userId}`);
    }
    // If userId matches, no action needed - already properly initialized
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
        available: !!this.sql,
        userId: this.userId,
      };

      // Get files if SQLite is available
      let files: FileRecord[] = [];
      let totalFiles = 0;

      if (this.sql) {
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

      if (!this.sql) {
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

  async screenshotV1(params: Parameters<typeof screenshotV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'SCREENSHOT',
      () => screenshotV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        viewport: params.viewport,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based markdown extraction                                 */
  /* ------------------------------------------------------------------------ */

  async markdownV1(params: Parameters<typeof markdownV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'MARKDOWN',
      () => markdownV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based HTML content extraction                              */
  /* ------------------------------------------------------------------------ */

  async contentV1(params: Parameters<typeof contentV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'CONTENT',
      () => contentV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based Link extraction                                      */
  /* ------------------------------------------------------------------------ */

  async linksV1(params: Parameters<typeof linksV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'LINKS',
      () => linksV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        includeExternal: params.includeExternal,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – Browser-based Element scraping                                     */
  /* ------------------------------------------------------------------------ */

  async scrapeV1(params: Parameters<typeof scrapeV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'SCRAPE',
      () => scrapeV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        elements: params.elements?.length || 0,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  async pdfV1(params: Parameters<typeof pdfV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'PDF',
      () => pdfV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        base64: params.base64,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  async searchV1(params: Parameters<typeof searchV1>[1], userId: string): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'SEARCH',
      () => searchV1(this.env, params),
      {
        query: params.query,
        userId: this.userId,
        limit: params.limit,
      },
      userId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /*  v1 – AI-powered JSON extraction                                        */
  /* ------------------------------------------------------------------------ */

  async jsonExtractionV1(
    params: Parameters<typeof jsonExtractionV1>[1],
    userId: string,
  ): Promise<CreditAwareResult<any>> {
    return this.executeWithCredits(
      'JSON_EXTRACTION',
      () => jsonExtractionV1(this.env, params),
      {
        url: params.url,
        userId: this.userId,
        prompt: params.prompt?.length || 0,
        responseType: params.responseType,
        waitTime: params.waitTime,
      },
      userId,
    );
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  private async checkCredits(
    operation: WebOperation,
    requestUserId?: string,
  ): Promise<{ hasCredits: boolean; balance: number; cost: number }> {
    const cost = CREDIT_COSTS[operation];

    try {
      const credits = await getUserCredits(this.env, requestUserId || this.userId);
      return {
        hasCredits: credits.balance >= cost,
        balance: credits.balance,
        cost,
      };
    } catch (error) {
      console.error(`❌ Failed to check credits for user ${this.userId}:`, error);
      throw new Error('Failed to check credit balance');
    }
  }

  /**
   * Deduct credits for an operation using waitUntil (non-blocking)
   * This method should be called after a successful operation
   */
  private async deductCreditsAsync(
    operation: WebOperation,
    metadata?: Record<string, any>,
    requestUserId?: string,
  ): Promise<void> {
    const cost = CREDIT_COSTS[operation];

    try {
      await deductCredits(this.env, requestUserId || this.userId, cost, operation.toLowerCase(), {
        operation,
        cost,
        timestamp: new Date().toISOString(),
        ...metadata,
      });
      console.log(`✅ Deducted ${cost} credits for ${operation} operation (user: ${this.userId})`);
    } catch (error) {
      console.error(`❌ Failed to deduct credits for ${operation} operation (user: ${this.userId}):`, error);
      // Don't throw here - credit deduction errors shouldn't break the user experience
      // The operation was already successful, we just log the error
    }
  }

  /**
   * Execute a web operation with credit checking and deduction
   * Includes user ID verification and database initialization
   */
  private async executeWithCredits<T>(
    operation: WebOperation,
    operationFn: () => Promise<T>,
    metadata?: Record<string, any>,
    requestUserId?: string,
  ): Promise<CreditAwareResult<T>> {
    const isProduction = this.env.NODE_ENV === 'production';
    // 1. Verify user ID matches to prevent cross-user access
    if (requestUserId && isProduction && (!this.userId || this.userId !== requestUserId)) {
      console.error(`❌ User ID mismatch in ${operation}: expected ${this.userId}, got ${requestUserId}`);
      return {
        success: false,
        error: 'Invalid user context',
        creditsCost: 0,
        creditsRemaining: 0,
      };
    }

    // 2. Ensure database is initialized in production if SQLite is available

    if (this.sql && isProduction) {
      try {
        this.initializeDatabase();
        console.log(`✅ Database tables initialized for ${operation} operation`);
      } catch (error) {
        console.warn(`⚠️ Failed to initialize database for ${operation}:`, error);
        // Continue without database - permanent URLs will be disabled
      }
    }

    // 3. Check credits
    const creditCheck = await this.checkCredits(operation, requestUserId);

    if (!creditCheck.hasCredits) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditCheck.cost}, Available: ${creditCheck.balance}`,
        creditsCost: creditCheck.cost,
        creditsRemaining: creditCheck.balance,
      };
    }

    try {
      // 4. Execute the operation
      const result = await operationFn();

      // Check if the result is already in the expected format (has success property)
      // This handles v1 functions that return { success, data, error } format
      if (typeof result === 'object' && result !== null && 'success' in result) {
        const typedResult = result as any;

        if (typedResult.success) {
          // 5. Deduct credits in background for successful operations
          this.ctx.waitUntil(this.deductCreditsAsync(operation, metadata, requestUserId));

          return {
            success: true,
            data: typedResult.data,
            creditsCost: creditCheck.cost,
            creditsRemaining: creditCheck.balance - creditCheck.cost,
          };
        } else {
          // Operation failed - don't deduct credits
          return {
            success: false,
            error: typedResult.error?.message || typedResult.error || 'Operation failed',
            creditsCost: 0,
            creditsRemaining: creditCheck.balance,
          };
        }
      }

      // For functions that return raw data (no success wrapper)
      // 5. Deduct credits in background (non-blocking)
      this.ctx.waitUntil(this.deductCreditsAsync(operation, metadata));

      return {
        success: true,
        data: result,
        creditsCost: creditCheck.cost,
        creditsRemaining: creditCheck.balance - creditCheck.cost,
      };
    } catch (error) {
      // If operation fails, don't deduct credits
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
        creditsCost: 0,
        creditsRemaining: creditCheck.balance,
      };
    }
  }
}
