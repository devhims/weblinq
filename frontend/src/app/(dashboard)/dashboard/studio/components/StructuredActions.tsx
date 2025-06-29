'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Braces, MessageSquareText, Lightbulb, Code2, FileText, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudioParams } from '../hooks/useStudioParams';

export function JsonActions() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { action } = useStudioParams();

  // Determine response type based on the selected action
  const responseType = action === 'text' ? 'text' : 'json';
  const [useSchema, setUseSchema] = useState(() => {
    // Check if there's already a schema in URL params
    return searchParams.has('jsonSchema');
  });
  const [jsonPrompt, setJsonPrompt] = useState(() => {
    const savedPrompt = searchParams.get('jsonPrompt');
    if (savedPrompt) return savedPrompt;

    return responseType === 'text'
      ? 'Summarize the main points and key information from this webpage.'
      : 'Extract the main sections, links, and important data from this webpage.';
  });
  const [jsonSchema, setJsonSchema] = useState(
    searchParams.get('jsonSchema') ||
      `{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Main page title"
    },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "heading": {"type": "string"},
          "content": {"type": "string"}
        }
      }
    },
    "links": {
      "type": "array",
      "items": {
        "type": "object", 
        "properties": {
          "text": {"type": "string"},
          "url": {"type": "string"}
        }
      }
    }
  },
  "required": ["title"]
}`,
  );
  const [showSchemaExample, setShowSchemaExample] = useState(false);

  // Update URL params when state changes
  const updateSearchParams = (updates: Record<string, any>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === false) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Reset schema usage when in text mode and update default prompt
  useEffect(() => {
    if (responseType === 'text') {
      setUseSchema(false);
      // Only update prompt if it's still the default for the other mode
      if (jsonPrompt === 'Extract the main sections, links, and important data from this webpage.') {
        setJsonPrompt('Summarize the main points and key information from this webpage.');
      }
    } else {
      // JSON mode - update prompt if it's still the text default
      if (jsonPrompt === 'Summarize the main points and key information from this webpage.') {
        setJsonPrompt('Extract the main sections, links, and important data from this webpage.');
      }
    }
  }, [responseType, jsonPrompt]);

  const loadSchemaExample = (type: string) => {
    const examples = {
      ecommerce: `{
  "type": "object",
  "properties": {
    "products": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "price": {"type": "string"},
          "description": {"type": "string"},
          "image_url": {"type": "string"},
          "availability": {"type": "string"}
        },
        "required": ["name", "price"]
      }
    },
    "categories": {
      "type": "array",
      "items": {"type": "string"}
    }
  }
}`,
      blog: `{
  "type": "object",
  "properties": {
    "title": {"type": "string"},
    "author": {"type": "string"},
    "date": {"type": "string"},
    "tags": {
      "type": "array",
      "items": {"type": "string"}
    },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "heading": {"type": "string"},
          "content": {"type": "string"}
        }
      }
    }
  },
  "required": ["title"]
}`,
      company: `{
  "type": "object", 
  "properties": {
    "company_name": {"type": "string"},
    "services": {
      "type": "array",
      "items": {"type": "string"}
    },
    "contact_info": {
      "type": "object",
      "properties": {
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "address": {"type": "string"}
      }
    },
    "team_members": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "role": {"type": "string"}
        }
      }
    }
  }
}`,
    };
    setJsonSchema(examples[type as keyof typeof examples] || examples.ecommerce);
  };

  useEffect(() => {
    const updates: Record<string, any> = {
      jsonPrompt,
    };

    // Only include schema if we're in JSON mode and schema is enabled
    if (responseType === 'json' && useSchema) {
      updates.jsonSchema = jsonSchema;
    }

    updateSearchParams(updates);
  }, [jsonPrompt, responseType, useSchema, jsonSchema]);

  return (
    <div className="space-y-4 mb-4">
      {/* Prompt Input (always shown for both text and JSON modes) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="jsonPrompt" className="text-sm sm:text-base font-medium">
            {responseType === 'json' ? 'Extraction Prompt' : 'Analysis Prompt'}
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  {responseType === 'json'
                    ? 'Describe what data you want to extract in natural language'
                    : 'Ask the AI to analyze, summarize, or explain the webpage content'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          id="jsonPrompt"
          value={jsonPrompt}
          onChange={(e) => setJsonPrompt(e.target.value)}
          placeholder={
            responseType === 'json'
              ? 'E.g., "Extract product names, prices, and descriptions from this e-commerce page"'
              : 'E.g., "Summarize the key points of this article and explain the main arguments"'
          }
          className="h-20 text-sm p-3 resize-none"
          rows={3}
        />
        <div className="text-xs text-muted-foreground">
          {responseType === 'json' ? (
            <span>
              <strong>Examples:</strong> "Get all product info", "Extract navigation menu items with URLs", "List team
              members and their roles"
            </span>
          ) : (
            <span>
              <strong>Examples:</strong> "What are the main services offered?", "Summarize this company's approach",
              "Explain the key features mentioned"
            </span>
          )}
        </div>
      </div>

      {/* Schema Toggle (only for JSON mode) */}
      {responseType === 'json' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useSchema"
              checked={useSchema}
              onChange={(e) => setUseSchema(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="useSchema" className="text-sm font-medium">
              Also use JSON Schema for precise structure
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="text-xs">
                    When enabled, the AI will use both your prompt AND the schema to extract data with exact structure
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* JSON Schema Input (only when schema is enabled) */}
      {responseType === 'json' && useSchema && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="jsonSchema" className="text-sm sm:text-base font-medium">
                JSON Schema
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Define the exact structure of JSON you want extracted. The AI will follow this schema precisely.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSchemaExample(!showSchemaExample)}
                className="text-xs"
              >
                {showSchemaExample ? (
                  <ChevronDown className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                Examples
              </Button>
            </div>
          </div>

          {showSchemaExample && (
            <div className="bg-muted/30 p-3 rounded-md border">
              <p className="text-xs font-medium mb-2">Quick Start Templates:</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => loadSchemaExample('ecommerce')} className="text-xs">
                  E-commerce
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadSchemaExample('blog')} className="text-xs">
                  Blog/Article
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadSchemaExample('company')} className="text-xs">
                  Company Info
                </Button>
              </div>
            </div>
          )}

          <Textarea
            id="jsonSchema"
            value={jsonSchema}
            onChange={(e) => setJsonSchema(e.target.value)}
            placeholder='{"type": "object", "properties": {"title": {"type": "string"}}}'
            className="h-40 text-xs font-mono p-3 resize-none"
            rows={8}
          />
          <div className="text-xs text-muted-foreground">
            <span>
              <strong>Format:</strong> Standard JSON Schema format. Use "type", "properties", "required" fields to
              define structure.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default JsonActions;
