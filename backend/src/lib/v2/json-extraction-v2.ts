// Lazy imports to avoid heavy startup time
// import { Tiktoken } from 'js-tiktoken/lite';
// import cl100k_base from 'js-tiktoken/ranks/cl100k_base';

interface JsonExtractionV2Params {
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

interface JsonExtractionV2Metadata {
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
  engine: 'playwright-v2';
}

interface JsonExtractionV2Success {
  success: true;
  data: {
    /** Extracted structured data (for JSON responses) */
    extracted?: Record<string, any>;
    /** Natural language text (for text responses) */
    text?: string;
    metadata: JsonExtractionV2Metadata;
  };
}

interface JsonExtractionV2Failure {
  success: false;
  error: { message: string };
}

export type JsonExtractionV2Result = JsonExtractionV2Success | JsonExtractionV2Failure;

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as any;

// Context window limits for the model
const MODEL_CONTEXT_LIMIT = 24000; // Total context window
const MAX_OUTPUT_TOKENS = 4096; // Reserve for output
const SYSTEM_PROMPT_BUFFER = 500; // Reserve for system prompt
const MAX_INPUT_TOKENS = MODEL_CONTEXT_LIMIT - MAX_OUTPUT_TOKENS - SYSTEM_PROMPT_BUFFER; // ~19,400 tokens

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
 * AI-powered content extraction from web pages using Playwright V2
 *
 * Supports two response modes:
 * - 'json': Returns structured data as JSON object (default)
 * - 'text': Returns natural language analysis as plain text
 *
 * Uses markdown processing for superior content understanding and AI analysis
 * Automatically truncates content to fit within the model's context window
 */
export async function jsonExtractionV2(
  playwrightPoolDO: any,
  env: CloudflareBindings,
  params: JsonExtractionV2Params,
): Promise<JsonExtractionV2Result> {
  try {
    // Validate that we have either prompt or response_format
    if (!params.prompt && !params.response_format) {
      throw new Error('Either prompt or response_format must be provided');
    }

    console.log('🤖 Starting AI-powered JSON extraction V2:', {
      url: params.url,
      hasPrompt: !!params.prompt,
      hasSchema: !!params.response_format,
      waitTime: params.waitTime,
      engine: 'playwright-v2',
    });

    /* ════════════════ Step 1: Extract structured page content using markdown V2 ════════════════ */
    console.log('📄 Converting page to structured markdown using Playwright V2...');

    // Use the PlaywrightPoolDO to get markdown content
    const markdownResult = await playwrightPoolDO.extractMarkdown({
      url: params.url,
      waitTime: params.waitTime || 0,
    });

    if (!markdownResult.success) {
      throw new Error(`Failed to extract page content: ${markdownResult.error.message}`);
    }

    const { markdown, metadata } = markdownResult.data;

    // Extract additional structured data using PlaywrightPoolDO
    console.log('🔍 Extracting additional structured data with Playwright V2...');
    const additionalDataResult = await playwrightPoolDO.extractStructuredData({
      url: params.url,
      waitTime: params.waitTime || 0,
    });

    if (!additionalDataResult.success) {
      console.warn('⚠️ Failed to extract additional structured data, continuing with markdown only');
    }

    const additionalData = additionalDataResult.success
      ? additionalDataResult.data
      : {
          title: metadata.title || '',
          metaDescription: metadata.description || '',
          structuredData: [],
          url: params.url,
        };

    console.log('📄 Extracted structured content V2:', {
      wordCount: metadata.wordCount,
      markdownLength: markdown.length,
      structuredDataCount: additionalData.structuredData?.length || 0,
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
  additionalData.structuredData && additionalData.structuredData.length > 0
    ? `Structured Data (JSON-LD): ${JSON.stringify(additionalData.structuredData, null, 2)}\n`
    : ''
}

Page Content (Structured Markdown):
${markdown}
    `.trim();

    // Truncate content to fit within model's context window
    const {
      truncated: contentForAI,
      originalTokens,
      finalTokens,
    } = await truncateContent(rawContentForAI, MAX_INPUT_TOKENS);

    if (originalTokens > finalTokens) {
      console.log(`⚠️ Content truncated for AI processing: ${originalTokens} → ${finalTokens} tokens`);
    }

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

    console.log('🧠 Calling Workers AI for extraction V2...');

    /* ════════════════ Step 3: Call Workers AI ════════════════ */
    const aiResult = await env.AI.run(DEFAULT_MODEL, aiOptions);

    console.log('🤖 AI extraction result V2:', {
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
        console.log('✅ Successfully extracted text response V2:', {
          length: finalTextResponse.length,
          preview: finalTextResponse.substring(0, 200) + (finalTextResponse.length > 200 ? '...' : ''),
          inputTokens: tokenUsage.input,
          outputTokens: tokenUsage.output,
        });
      } else if (extractedData && typeof extractedData === 'object') {
        // If we got JSON but expected text, convert to string
        finalTextResponse = JSON.stringify(extractedData, null, 2);
        console.log('✅ Converted JSON response to text format V2');
      } else {
        throw new Error('Failed to extract valid text response from AI model');
      }
    } else {
      // For JSON responses, parse as JSON (existing logic)
      if (textResponse && typeof textResponse === 'string') {
        console.log('🔍 Raw AI response info V2:', {
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

      console.log('✅ Successfully extracted JSON data V2:', {
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
        originalContentTokens: originalTokens,
        finalContentTokens: finalTokens,
        contentTruncated: originalTokens > finalTokens,
        engine: 'playwright-v2',
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
    };
  } catch (error) {
    console.error('jsonExtractionV2 error:', error);
    return {
      success: false,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}
