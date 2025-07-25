// Lazy imports to avoid heavy startup time
// import { Tiktoken } from 'js-tiktoken/lite';
// import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';
import { markdownV1 } from './markdown';

interface JsonExtractionParams {
  /** The URL to extract data from */
  url: string;
  /** Optional delay in milliseconds before extraction */
  waitTime?: number;
  /** Response type: 'json' for structured data, 'text' for natural language */
  responseType?: 'json' | 'text';
  /** Either a prompt for natural language extraction OR a JSON schema for structured extraction */
  prompt?: string;
  /** JSON schema for structured data extraction (alternative to prompt) */
  response_format?: {
    type: 'json_schema';
    json_schema: Record<string, any>;
  };
  /** Additional instructions for the AI */
  instructions?: string;
}

interface JsonExtractionMetadata {
  url: string;
  timestamp: string;
  model: string;
  responseType: 'json' | 'text';
  extractionType: 'prompt' | 'schema';
  fieldsExtracted?: number;
  inputTokens?: number;
  outputTokens?: number;
  originalContentTokens?: number;
  finalContentTokens?: number;
  contentTruncated?: boolean;
  // Performance metrics
  inferenceTimeMs?: number;
  modelUsed?: 'gemini' | 'cloudflare';
  fallbackReason?: string;
}

interface JsonExtractionSuccess {
  success: true;
  data: {
    /** Extracted structured data (for JSON responses) */
    extracted?: Record<string, any>;
    /** Natural language text (for text responses) */
    text?: string;
    metadata: JsonExtractionMetadata;
  };
  creditsCost: number;
}

interface JsonExtractionFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type JsonExtractionResult = JsonExtractionSuccess | JsonExtractionFailure;

const CREDIT_COST = 2; // Higher cost due to AI usage
const DEFAULT_CLOUDFLARE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Context window limits for different models
const CLOUDFLARE_MODEL_CONTEXT_LIMIT = 24000; // Total context window for Cloudflare
const GEMINI_MODEL_CONTEXT_LIMIT = 1048576; // 1M tokens for Gemini 2.5 Flash
const MAX_OUTPUT_TOKENS = 4096; // Reserve for output
const SYSTEM_PROMPT_BUFFER = 500; // Reserve for system prompt

// Calculate max input tokens for each model
const CLOUDFLARE_MAX_INPUT_TOKENS = CLOUDFLARE_MODEL_CONTEXT_LIMIT - MAX_OUTPUT_TOKENS - SYSTEM_PROMPT_BUFFER;
const GEMINI_MAX_INPUT_TOKENS = GEMINI_MODEL_CONTEXT_LIMIT - MAX_OUTPUT_TOKENS - SYSTEM_PROMPT_BUFFER;

// Timeout constants
const GEMINI_TIMEOUT_MS = 45000; // 45 seconds timeout for Gemini API
const CLOUDFLARE_TIMEOUT_MS = 30000; // 30 seconds timeout for Cloudflare AI

/**
 * Convert OpenAI/Cloudflare response_format to Gemini JSON schema format
 */
function convertToGeminiSchema(response_format?: {
  type: 'json_schema';
  json_schema: Record<string, any>;
}): Record<string, any> | undefined {
  if (!response_format?.json_schema) return undefined;

  const originalSchema = response_format.json_schema;

  // If the schema already has a proper structure with "type", use it directly
  if (originalSchema.type && originalSchema.properties) {
    return originalSchema;
  }

  // Handle the case where the schema is improperly formatted with arrays as property values
  // This fixes the common mistake where users define arrays directly instead of using JSON schema format
  if (typeof originalSchema === 'object' && !originalSchema.type) {
    const properties: Record<string, any> = {};

    for (const [key, value] of Object.entries(originalSchema)) {
      if (Array.isArray(value) && value.length > 0) {
        // Convert array example to proper array schema
        const firstItem = value[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          // Convert object example to schema
          const itemProperties: Record<string, any> = {};
          for (const [itemKey, itemValue] of Object.entries(firstItem)) {
            if (typeof itemValue === 'string') {
              // Handle type strings like "string", "number", etc.
              itemProperties[itemKey] = { type: itemValue };
            } else {
              // Default to string type for other values
              itemProperties[itemKey] = { type: 'string' };
            }
          }

          properties[key] = {
            type: 'array',
            items: {
              type: 'object',
              properties: itemProperties,
              required: Object.keys(itemProperties),
            },
          };
        } else {
          // Handle primitive array
          properties[key] = {
            type: 'array',
            items: { type: typeof firstItem === 'string' ? firstItem : 'string' },
          };
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested object
        const nestedProperties: Record<string, any> = {};
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (typeof nestedValue === 'string') {
            nestedProperties[nestedKey] = { type: nestedValue };
          } else {
            nestedProperties[nestedKey] = { type: 'string' };
          }
        }

        properties[key] = {
          type: 'object',
          properties: nestedProperties,
          required: Object.keys(nestedProperties),
        };
      } else if (typeof value === 'string') {
        // Handle direct type specification
        properties[key] = { type: value };
      } else {
        // Default fallback
        properties[key] = { type: 'string' };
      }
    }

    return {
      type: 'object',
      properties,
      required: Object.keys(properties),
    };
  }

  // Fallback: return as-is if we can't determine the structure
  return originalSchema;
}

/**
 * Call Gemini 2.5 Flash API for JSON extraction
 */
async function callGeminiAPI(
  env: CloudflareBindings,
  systemPrompt: string,
  userPrompt: string,
  responseType: 'json' | 'text',
  geminiSchema?: Record<string, any>,
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  inferenceTimeMs: number;
}> {
  const startTime = Date.now();

  try {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }

    // Correct Gemini API URL format
    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

    // Prepare the request body according to Gemini API specification
    const requestBody: any = {
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1, // Low temperature for consistent extraction
      },
    };

    // Configure response format
    if (responseType === 'json') {
      requestBody.generationConfig.responseMimeType = 'application/json';

      if (geminiSchema) {
        // Use structured schema for better control
        requestBody.generationConfig.responseSchema = geminiSchema;
      }
    }
    // For text responses, don't specify JSON format

    console.log('🔥 Calling Gemini 2.5 Flash API...', {
      url: url.replace(env.GEMINI_API_KEY, '[REDACTED]'),
      bodySize: JSON.stringify(requestBody).length,
      responseType,
      hasSchema: !!geminiSchema,
    });

    if (geminiSchema) {
      console.log('📋 Gemini Schema:', JSON.stringify(geminiSchema, null, 2));
    }

    // Add timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: Use query parameter instead of header for API key
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const inferenceTimeMs = Date.now() - startTime;

    console.log('📡 Gemini API response received:', {
      status: response.status,
      statusText: response.statusText,
      inferenceTimeMs,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as any;

    console.log(`⚡ Gemini inference completed in ${inferenceTimeMs}ms`);

    // Extract the response content
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No candidates in Gemini response');
    }

    const candidate = result.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('No content in Gemini response');
    }

    const textResponse = candidate.content.parts[0].text;

    // Extract token usage if available
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    if (result.usageMetadata) {
      inputTokens = result.usageMetadata.promptTokenCount;
      outputTokens = result.usageMetadata.candidatesTokenCount;
    }

    console.log('✅ Gemini API response received:', {
      responseLength: textResponse?.length || 0,
      inputTokens,
      outputTokens,
      inferenceTimeMs,
    });

    return {
      success: true,
      data: textResponse,
      inputTokens,
      outputTokens,
      inferenceTimeMs,
    };
  } catch (error) {
    const inferenceTimeMs = Date.now() - startTime;

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('❌ Gemini API timeout after', GEMINI_TIMEOUT_MS, 'ms');
        return {
          success: false,
          error: `Gemini API timeout after ${GEMINI_TIMEOUT_MS}ms`,
          inferenceTimeMs,
        };
      }
    }

    console.error('❌ Gemini API call failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      inferenceTimeMs,
    };
  }
}

/**
 * Call Cloudflare Workers AI as fallback
 */
async function callCloudflareAI(
  env: CloudflareBindings,
  systemPrompt: string,
  userPrompt: string,
  responseType: 'json' | 'text',
  response_format?: { type: 'json_schema'; json_schema: Record<string, any> },
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  inferenceTimeMs: number;
}> {
  const startTime = Date.now();

  try {
    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    // Prepare AI request options
    const aiOptions: any = {
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.1,
    };

    // Only enforce JSON mode for JSON responses
    if (responseType === 'json') {
      if (response_format) {
        // Use the schema directly
        aiOptions.response_format = response_format;
      } else {
        // Force JSON mode for prompt-based JSON requests
        aiOptions.response_format = {
          type: 'json_object',
        };
      }
    }

    console.log('🔄 Falling back to Cloudflare Workers AI...');

    // Add timeout for Cloudflare AI as well
    const aiPromise = env.AI.run(DEFAULT_CLOUDFLARE_MODEL, aiOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Cloudflare AI timeout after ${CLOUDFLARE_TIMEOUT_MS}ms`)),
        CLOUDFLARE_TIMEOUT_MS,
      ),
    );

    const aiResult = await Promise.race([aiPromise, timeoutPromise]);

    const inferenceTimeMs = Date.now() - startTime;

    console.log(`⚡ Cloudflare AI inference completed in ${inferenceTimeMs}ms`);

    let textResponse: string | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    // Handle multiple possible response formats
    if (typeof aiResult === 'object' && aiResult !== null) {
      // Modern OpenAI-compatible format
      if ('choices' in aiResult && Array.isArray((aiResult as any).choices)) {
        const choices = (aiResult as any).choices;
        if (choices.length > 0 && choices[0].message?.content) {
          textResponse = choices[0].message.content;

          if ('usage' in aiResult) {
            const usage = (aiResult as any).usage;
            inputTokens = usage?.prompt_tokens || usage?.input_tokens;
            outputTokens = usage?.completion_tokens || usage?.output_tokens;
          }
        }
      }
      // Legacy Workers AI format
      else if ('response' in aiResult) {
        const raw = (aiResult as any).response;
        textResponse = typeof raw === 'string' ? raw : JSON.stringify(raw);

        if ('usage' in aiResult) {
          const usage = (aiResult as any).usage;
          inputTokens = usage?.prompt_tokens;
          outputTokens = usage?.completion_tokens;
        }
      }
    } else if (typeof aiResult === 'string') {
      textResponse = aiResult;
    }

    if (!textResponse) {
      throw new Error('No valid response from Cloudflare AI');
    }

    return {
      success: true,
      data: textResponse,
      inputTokens,
      outputTokens,
      inferenceTimeMs,
    };
  } catch (error) {
    const inferenceTimeMs = Date.now() - startTime;
    console.error('❌ Cloudflare AI call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      inferenceTimeMs,
    };
  }
}

/**
 * Count tokens in text using tiktoken for accurate token counting (lazy-loaded)
 * Uses cl100k_base encoding which is used by GPT-3.5/4 and similar models
 */
async function countTokens(text: string): Promise<number> {
  try {
    // Lazy import to avoid heavy startup parsing
    const [{ Tiktoken }, cl100k_base] = await Promise.all([
      import('js-tiktoken/lite'),
      import('js-tiktoken/ranks/cl100k_base'),
    ]);

    const encoder = new Tiktoken(cl100k_base.default);
    const tokens = encoder.encode(text);
    // Note: js-tiktoken lite doesn't have a free() method, it's garbage collected
    return tokens.length;
  } catch (error) {
    console.warn('Token counting failed, using character-based estimate:', error);
    // Fallback: rough estimate of 4 characters per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Truncate content to fit within token limits while preserving structure
 * Prioritizes keeping the most important content at the beginning
 */
async function truncateContent(
  content: string,
  maxTokens: number,
): Promise<{ truncated: string; originalTokens: number; finalTokens: number }> {
  const originalTokens = await countTokens(content);

  if (originalTokens <= maxTokens) {
    return {
      truncated: content,
      originalTokens,
      finalTokens: originalTokens,
    };
  }

  console.log(`Content exceeds token limit. Original: ${originalTokens}, Max: ${maxTokens}`);

  // Split content into sections to preserve structure
  const sections = content.split('\n\n');
  let truncated = '';
  let currentTokens = 0;

  // Add sections until we approach the token limit
  for (const section of sections) {
    const sectionTokens = await countTokens(section);

    // If adding this section would exceed the limit
    if (currentTokens + sectionTokens > maxTokens) {
      // If we haven't added any sections yet, truncate this section
      if (truncated === '') {
        // Character-based truncation as a fallback
        const avgCharsPerToken = section.length / sectionTokens;
        const maxChars = Math.floor(maxTokens * avgCharsPerToken * 0.9); // 90% safety margin
        truncated = `${section.substring(0, maxChars)}\n\n[Content truncated due to length...]`;
        break;
      } else {
        // Add truncation notice
        truncated += '\n\n[Content truncated due to length...]';
        break;
      }
    }

    truncated += (truncated ? '\n\n' : '') + section;
    currentTokens += sectionTokens;
  }

  const finalTokens = await countTokens(truncated);

  console.log(`Content truncated: ${originalTokens} → ${finalTokens} tokens`);

  return {
    truncated,
    originalTokens,
    finalTokens,
  };
}

/**
 * AI-powered content extraction from web pages
 *
 * Supports two response modes:
 * - 'json': Returns structured data as JSON object (default)
 * - 'text': Returns natural language analysis as plain text
 *
 * Uses Gemini 2.5 Flash as primary model with Cloudflare AI as fallback
 * Automatically truncates content to fit within the model's context window
 */
export async function jsonExtractionV1(
  env: CloudflareBindings,
  params: JsonExtractionParams,
): Promise<JsonExtractionResult> {
  try {
    // Validate that we have either prompt or response_format
    if (!params.prompt && !params.response_format) {
      throw new Error('Either prompt or response_format must be provided');
    }

    console.log('🤖 Starting AI-powered JSON extraction:', {
      url: params.url,
      hasPrompt: !!params.prompt,
      hasSchema: !!params.response_format,
      waitTime: params.waitTime,
    });

    /* ════════════════ Step 1: Extract structured page content using markdown ════════════════ */
    console.log('�� Converting page to structured markdown for better AI processing...');

    // Use the battle-tested markdown processor for superior content extraction
    const markdownResult = await markdownV1(env, {
      url: params.url,
      waitTime: params.waitTime || 0,
    });

    if (!markdownResult.success) {
      throw new Error(`Failed to extract page content: ${markdownResult.error.message}`);
    }

    const { markdown, metadata } = markdownResult.data;

    // Extract additional structured data that markdown doesn't capture
    const additionalData = await runWithBrowser(env, async (page) => {
      // Minimal browser usage just for structured data extraction
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        // Only allow essential requests for structured data
        const resourceType = req.resourceType();
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(resourceType);
        shouldAbort ? req.abort() : req.continue();
      });

      // Use retry helper for better resilience against network failures
      await pageGotoWithRetry(page, params.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      return page.evaluate(() => {
        const title = document.title || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

        // Extract JSON-LD structured data
        const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
        const structuredData: any[] = [];

        jsonLdElements.forEach((element) => {
          try {
            const data = JSON.parse(element.textContent || '');
            structuredData.push(data);
          } catch {
            // Ignore invalid JSON-LD
          }
        });

        return {
          title,
          metaDescription,
          structuredData,
          url: window.location.href,
        };
      });
    });

    console.log('📄 Extracted structured content:', {
      wordCount: metadata.wordCount,
      markdownLength: markdown.length,
      structuredDataCount: additionalData.structuredData.length,
      hasTitle: !!additionalData.title,
      hasMetaDescription: !!additionalData.metaDescription,
    });

    /* ════════════════ Step 2: Prepare AI request ════════════════ */
    const responseType = params.responseType || 'json';
    const extractionType = params.response_format ? 'schema' : 'prompt';

    // Build the structured content string for AI (using markdown for better context)
    const rawContentForAI = `
Page Title: ${additionalData.title}
Meta Description: ${additionalData.metaDescription}
Page URL: ${additionalData.url}
Word Count: ${metadata.wordCount}

${
  additionalData.structuredData.length > 0
    ? `Structured Data (JSON-LD): ${JSON.stringify(additionalData.structuredData, null, 2)}\n`
    : ''
}

Page Content (Structured Markdown):
${markdown}
    `.trim();

    // Determine max tokens based on primary model (Gemini has much higher limits)
    const maxInputTokens = GEMINI_MAX_INPUT_TOKENS;

    // Truncate content to fit within model's context window
    const {
      truncated: contentForAI,
      originalTokens,
      finalTokens,
    } = await truncateContent(rawContentForAI, maxInputTokens);

    if (originalTokens > finalTokens) {
      console.log(`⚠️  Content truncated for AI processing: ${originalTokens} → ${finalTokens} tokens`);
    }

    // Prepare AI messages with response type awareness
    let systemPrompt: string;
    let userPrompt: string;
    let geminiSchema: Record<string, any> | undefined;

    if (responseType === 'text') {
      // Text response mode - natural language output
      systemPrompt = `You are a helpful content analysis assistant. Your task is to analyze webpage content (formatted as structured markdown with preserved headings, links, and hierarchy) and provide clear, natural language responses to user questions.

Guidelines:
- Provide comprehensive, well-structured natural language responses
- Use the markdown structure to better understand content organization
- Be informative and detailed in your analysis
- Write in a clear, professional tone
- Do NOT format your response as JSON or use code blocks
- Respond with plain text that directly addresses the user's request`;

      userPrompt = `${params.prompt}\n\n${
        params.instructions ? `Additional instructions: ${params.instructions}\n\n` : ''
      }Please analyze the following webpage content and provide a detailed, informative response:\n\nWebpage Content:\n${contentForAI}`;
    } else {
      // JSON response mode - structured data output
      if (extractionType === 'schema') {
        geminiSchema = convertToGeminiSchema(params.response_format);

        systemPrompt =
          'You are a data extraction assistant. Extract structured data from the provided webpage content (formatted as structured markdown) according to the specified JSON schema. The markdown preserves headings, links, lists, and content hierarchy. Return ONLY valid JSON that matches the schema - no explanations, no markdown code blocks, just the raw JSON object or array.';

        userPrompt = `${
          params.instructions || 'Extract data according to the provided schema.'
        }\n\nWebpage Content:\n${contentForAI}`;
      } else {
        systemPrompt =
          "You are a data extraction assistant. Extract structured information from the provided webpage content (formatted as structured markdown with preserved headings, links, and hierarchy) based on the user's request. You MUST respond with ONLY valid JSON format - no explanations, no markdown code blocks, no additional formatting or text. The response should be a properly formatted JSON object that directly answers the user's question.";

        userPrompt = `${params.prompt}\n\n${
          params.instructions ? `Additional instructions: ${params.instructions}\n\n` : ''
        }Please analyze the following webpage content (provided as structured markdown with preserved headings, links, and hierarchy) and respond with a well-structured JSON object that provides detailed, actionable information. Use descriptive field names and break down information into multiple logical fields when appropriate (e.g., separate fields for title, description, key_features, contact_info, etc.). Take advantage of the markdown structure (headings, lists, links) to better understand content organization. Format your response as valid JSON only:\n\nWebpage Content:\n${contentForAI}`;
      }
    }

    /* ════════════════ Step 3: Try Gemini 2.5 Flash first ════════════════ */
    console.log('🔥 Attempting Gemini 2.5 Flash inference...');

    const geminiResult = await callGeminiAPI(env, systemPrompt, userPrompt, responseType, geminiSchema);

    let aiResult: any;
    let modelUsed: 'gemini' | 'cloudflare' = 'gemini';
    let fallbackReason: string | undefined;
    let inferenceTimeMs = geminiResult.inferenceTimeMs;
    let tokenUsage = {
      input: geminiResult.inputTokens,
      output: geminiResult.outputTokens,
    };

    if (geminiResult.success) {
      console.log('✅ Gemini 2.5 Flash successful!');
      aiResult = { response: geminiResult.data };
    } else {
      console.log('❌ Gemini 2.5 Flash failed, falling back to Cloudflare AI...');
      fallbackReason = `Gemini failed: ${geminiResult.error}`;
      modelUsed = 'cloudflare';

      // Truncate content for Cloudflare if it was originally truncated for Gemini
      let cloudflareContent = contentForAI;
      if (finalTokens > CLOUDFLARE_MAX_INPUT_TOKENS) {
        const cloudflareResult = await truncateContent(rawContentForAI, CLOUDFLARE_MAX_INPUT_TOKENS);
        cloudflareContent = cloudflareResult.truncated;
        console.log(
          `⚠️  Further truncated content for Cloudflare: ${finalTokens} → ${cloudflareResult.finalTokens} tokens`,
        );
      }

      // Update prompts with potentially truncated content
      if (responseType === 'text') {
        userPrompt = `${params.prompt}\n\n${
          params.instructions ? `Additional instructions: ${params.instructions}\n\n` : ''
        }Please analyze the following webpage content and provide a detailed, informative response:\n\nWebpage Content:\n${cloudflareContent}`;
      } else {
        if (extractionType === 'schema') {
          userPrompt = `${
            params.instructions || 'Extract data according to the provided schema.'
          }\n\nWebpage Content:\n${cloudflareContent}`;
        } else {
          userPrompt = `${params.prompt}\n\n${
            params.instructions ? `Additional instructions: ${params.instructions}\n\n` : ''
          }Please analyze the following webpage content (provided as structured markdown with preserved headings, links, and hierarchy) and respond with a well-structured JSON object that provides detailed, actionable information. Use descriptive field names and break down information into multiple logical fields when appropriate (e.g., separate fields for title, description, key_features, contact_info, etc.). Take advantage of the markdown structure (headings, lists, links) to better understand content organization. Format your response as valid JSON only:\n\nWebpage Content:\n${cloudflareContent}`;
        }
      }

      const cloudflareResult = await callCloudflareAI(
        env,
        systemPrompt,
        userPrompt,
        responseType,
        params.response_format,
      );

      if (!cloudflareResult.success) {
        throw new Error(
          `Both Gemini and Cloudflare AI failed. Gemini: ${geminiResult.error}, Cloudflare: ${cloudflareResult.error}`,
        );
      }

      inferenceTimeMs += cloudflareResult.inferenceTimeMs; // Add both inference times
      tokenUsage = {
        input: cloudflareResult.inputTokens,
        output: cloudflareResult.outputTokens,
      };
      aiResult = { response: cloudflareResult.data };
    }

    console.log('🤖 AI extraction result:', {
      success: !!aiResult,
      modelUsed,
      inferenceTimeMs,
      fallbackReason,
      inputTokens: tokenUsage.input,
      outputTokens: tokenUsage.output,
    });

    // Parse AI response - simplified since we now handle this in the API functions
    let textResponse: string | undefined;

    if (typeof aiResult === 'object' && aiResult !== null && 'response' in aiResult) {
      textResponse = aiResult.response;
    } else {
      throw new TypeError('Unexpected response format from AI model');
    }

    // Handle response based on response type
    let finalTextResponse: string | undefined;
    let finalJsonData: Record<string, any> | undefined;

    if (responseType === 'text') {
      // For text responses, keep as plain text
      if (textResponse && typeof textResponse === 'string') {
        finalTextResponse = textResponse.trim();
        console.log('✅ Successfully extracted text response:', {
          length: finalTextResponse.length,
          preview: finalTextResponse.substring(0, 200) + (finalTextResponse.length > 200 ? '...' : ''),
          inputTokens: tokenUsage.input,
          outputTokens: tokenUsage.output,
        });
      } else {
        throw new Error('Failed to extract valid text response from AI model');
      }
    } else {
      // For JSON responses, parse as JSON (existing logic)
      if (textResponse && typeof textResponse === 'string') {
        console.log('🔍 Raw AI response info:', {
          totalLength: textResponse.length,
          first200: textResponse.substring(0, 200),
          last100: textResponse.substring(Math.max(0, textResponse.length - 100)),
          endsWithBrace: textResponse.trim().endsWith('}'),
          startsWithBrace: textResponse.trim().startsWith('{'),
        });

        try {
          // Since we enforce JSON mode, response should be valid JSON
          finalJsonData = JSON.parse(textResponse);
        } catch (parseError) {
          // JSON mode failed - try multiple cleanup strategies
          console.log('JSON mode parsing failed, attempting cleanup strategies...');
          console.log('Parse error:', parseError);
          console.log('Raw response (first 500 chars):', textResponse.substring(0, 500));

          let cleanedResponse: string;
          let parsed = false;

          // Strategy 1: Remove markdown code blocks
          try {
            cleanedResponse = textResponse
              .replace(/^```json\s*/i, '')
              .replace(/^```\s*/, '')
              .replace(/\s*```\s*$/, '')
              .trim();

            finalJsonData = JSON.parse(cleanedResponse);
            parsed = true;
            console.log('✅ Successfully parsed after removing markdown code blocks');
          } catch {
            // Strategy 2: Extract outermost JSON object with proper boundary detection
            try {
              const jsonStart = textResponse.indexOf('{');
              if (jsonStart !== -1) {
                // Count braces to find the complete outermost object
                let braceCount = 0;
                let jsonEnd = -1;
                let inString = false;
                let escapeNext = false;

                for (let i = jsonStart; i < textResponse.length; i++) {
                  const char = textResponse[i];

                  if (escapeNext) {
                    escapeNext = false;
                    continue;
                  }

                  if (char === '\\') {
                    escapeNext = true;
                    continue;
                  }

                  if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                  }

                  if (!inString) {
                    if (char === '{') {
                      braceCount++;
                    } else if (char === '}') {
                      braceCount--;
                      if (braceCount === 0) {
                        jsonEnd = i;
                        break;
                      }
                    }
                  }
                }

                if (jsonEnd !== -1) {
                  cleanedResponse = textResponse.substring(jsonStart, jsonEnd + 1);
                  finalJsonData = JSON.parse(cleanedResponse);
                  parsed = true;
                  console.log('✅ Successfully parsed after smart boundary detection');
                }
              }
            } catch {
              // Strategy 3: Fallback regex for simpler cases
              try {
                const jsonMatch = textResponse.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
                if (jsonMatch) {
                  finalJsonData = JSON.parse(jsonMatch[0]);
                  parsed = true;
                  console.log('✅ Successfully parsed with fallback regex');
                }
              } catch {
                // All strategies failed
              }
            }
          }

          if (!parsed) {
            throw new Error(
              `AI JSON mode failed after all cleanup attempts. Raw response: ${textResponse.substring(0, 500)}`,
            );
          }
        }
      }

      if (!finalJsonData) {
        throw new Error('Failed to extract valid JSON response from AI model');
      }

      // Validate that we got an object
      if (typeof finalJsonData !== 'object' || finalJsonData === null) {
        throw new Error('AI did not return a valid JSON object');
      }

      console.log('✅ Successfully extracted JSON data:', {
        fieldCount: Object.keys(finalJsonData).length,
        fields: Object.keys(finalJsonData),
        extractedSample: Object.keys(finalJsonData)
          .slice(0, 3)
          .reduce((acc, key) => {
            acc[key] = finalJsonData![key];
            return acc;
          }, {} as Record<string, any>),
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
      });
    }

    /* ════════════════ Step 4: Return structured response ════════════════ */
    const responseData: any = {
      metadata: {
        url: params.url,
        timestamp: new Date().toISOString(),
        model: modelUsed === 'gemini' ? GEMINI_MODEL : DEFAULT_CLOUDFLARE_MODEL,
        responseType,
        extractionType,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
        originalContentTokens: originalTokens,
        finalContentTokens: finalTokens,
        contentTruncated: originalTokens > finalTokens,
        inferenceTimeMs,
        modelUsed,
        fallbackReason,
      },
    };

    if (responseType === 'text') {
      responseData.text = finalTextResponse;
    } else {
      responseData.extracted = finalJsonData;
      responseData.metadata.fieldsExtracted = Object.keys(finalJsonData!).length;
    }

    return {
      success: true,
      data: responseData,
      creditsCost: CREDIT_COST,
    };
  } catch (error) {
    console.error('jsonExtractionV1 error:', error);
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : String(error) },
      creditsCost: 0,
    };
  }
}
