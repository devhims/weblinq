import type { z } from 'zod';

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
const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any;

/**
 * AI-powered content extraction from web pages
 *
 * Supports two response modes:
 * - 'json': Returns structured data as JSON object (default)
 * - 'text': Returns natural language analysis as plain text
 *
 * Uses markdown processing for superior content understanding and AI analysis
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
    console.log('📄 Converting page to structured markdown for better AI processing...');

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
    const contentForAI = `
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

    // Prepare AI messages with response type awareness
    let systemPrompt: string;
    let userPrompt: string;

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
        systemPrompt =
          'You are a data extraction assistant. Extract structured data from the provided webpage content (formatted as structured markdown) according to the specified JSON schema. The markdown preserves headings, links, lists, and content hierarchy. Return ONLY valid JSON that matches the schema - no explanations, no markdown code blocks (```), no formatting, just the raw JSON object starting with { and ending with }.';

        userPrompt = `${
          params.instructions || 'Extract data according to the provided schema.'
        }\n\nWebpage Content:\n${contentForAI}`;
      } else {
        systemPrompt =
          "You are a data extraction assistant. Extract structured information from the provided webpage content (formatted as structured markdown with preserved headings, links, and hierarchy) based on the user's request. You MUST respond with ONLY valid JSON format - no explanations, no markdown code blocks (```), no additional formatting or text. The response should be a properly formatted JSON object that directly answers the user's question, starting with { and ending with }.";

        userPrompt = `${params.prompt}\n\n${
          params.instructions ? `Additional instructions: ${params.instructions}\n\n` : ''
        }Please analyze the following webpage content (provided as structured markdown with preserved headings, links, and hierarchy) and respond with a well-structured JSON object that provides detailed, actionable information. Use descriptive field names and break down information into multiple logical fields when appropriate (e.g., separate fields for title, description, key_features, contact_info, etc.). Take advantage of the markdown structure (headings, lists, links) to better understand content organization. Format your response as valid JSON only:\n\nWebpage Content:\n${contentForAI}`;
      }
    }

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
      max_tokens: 4096, // Increased limit to handle larger responses
      temperature: 0.1, // Low temperature for consistent extraction
    };

    // Only enforce JSON mode for JSON responses
    if (responseType === 'json') {
      if (params.response_format) {
        // Use the schema directly
        aiOptions.response_format = params.response_format;
      } else {
        // Force JSON mode for prompt-based JSON requests
        aiOptions.response_format = {
          type: 'json_object',
        };
      }
    }
    // For text responses, don't enforce JSON mode - let the AI respond naturally

    console.log('🧠 Calling Workers AI for extraction...');

    /* ════════════════ Step 3: Call Workers AI ════════════════ */
    const aiResult = await env.AI.run(DEFAULT_MODEL, aiOptions);

    console.log('🤖 AI extraction result:', {
      success: !!aiResult,
      resultType: typeof aiResult,
      hasResponse: !!(aiResult as any)?.response,
    });

    // Parse AI response with improved compatibility and performance
    let extractedData: Record<string, any> | undefined;
    const tokenUsage: { input?: number; output?: number } = {};

    // Handle multiple possible response formats (future-proof for OpenAI compatibility)
    let textResponse: string | undefined;
    let responseSuccess = true;

    if (typeof aiResult === 'object' && aiResult !== null) {
      // Modern OpenAI-compatible format: { choices: [{ message: { content } }], usage }
      if ('choices' in aiResult && Array.isArray((aiResult as any).choices)) {
        const choices = (aiResult as any).choices;
        if (choices.length > 0 && choices[0].message?.content) {
          textResponse = choices[0].message.content;

          // Extract token usage from OpenAI-compatible format
          if ('usage' in aiResult) {
            const usage = (aiResult as any).usage;
            tokenUsage.input = usage?.prompt_tokens || usage?.input_tokens;
            tokenUsage.output = usage?.completion_tokens || usage?.output_tokens;
          }
        } else {
          responseSuccess = false;
          textResponse = 'No content in AI response';
        }
      }
      // Legacy Workers AI format: { response, usage }
      else if ('response' in aiResult) {
        const raw = (aiResult as any).response;

        if (typeof raw === 'string') {
          textResponse = raw; // old format → continue to JSON.parse
        } else {
          extractedData = raw as Record<string, any>; // new format → done
        }

        // usage accounting unchanged
        if ('usage' in aiResult) {
          const usage = (aiResult as any).usage;
          tokenUsage.input = usage?.prompt_tokens;
          tokenUsage.output = usage?.completion_tokens;
        }
      }
      // Direct object response (less common)
      else {
        extractedData = aiResult as Record<string, any>;
        responseSuccess = true;
      }
    } else if (typeof aiResult === 'string') {
      textResponse = aiResult;
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
      } else if (extractedData && typeof extractedData === 'object') {
        // If we got JSON but expected text, convert to string
        finalTextResponse = JSON.stringify(extractedData, null, 2);
        console.log('✅ Converted JSON response to text format');
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
      } else if (extractedData && typeof extractedData === 'object') {
        finalJsonData = extractedData;
      }

      if (!responseSuccess || !finalJsonData) {
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
        model: DEFAULT_MODEL,
        responseType,
        extractionType,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
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
