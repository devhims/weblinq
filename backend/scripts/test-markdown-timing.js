#!/usr/bin/env node

/**
 * Markdown Extraction Performance Test Script
 *
 * This script tests the markdown extraction endpoint against the SFSPCA website
 * to identify performance bottlenecks and timing issues.
 *
 * Usage: node test-markdown-timing.js [API_KEY]
 */

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import https from 'node:https';

// Configuration
const BASE_URL = 'https://api.weblinq.dev/v1';
const TEST_URL = 'https://www.sfspca.org/';
const API_KEY = process.argv[2] || process.env.WEBLINQ_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: API key is required');
  console.error('Usage: node test-markdown-timing.js [API_KEY]');
  console.error('Or set WEBLINQ_API_KEY environment variable');
  process.exit(1);
}

/**
 * Make HTTP request with timing
 */
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const requestStart = Date.now();

    const req = https.request(options, (res) => {
      const responseStart = Date.now();
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const responseEnd = Date.now();

        try {
          const result = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: result,
            timings: {
              requestStart,
              responseStart,
              responseEnd,
              totalTime: responseEnd - requestStart,
              networkTime: responseStart - requestStart,
              dataTransferTime: responseEnd - responseStart,
            },
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse JSON response: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Set timeout to 60 seconds
    req.setTimeout(60000);

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

/**
 * Test markdown extraction
 */
async function testMarkdownExtraction() {
  console.log('🚀 Starting Markdown Extraction Performance Test');
  console.log(`📍 Target URL: ${TEST_URL}`);
  console.log(`🔗 API Endpoint: ${BASE_URL}/web/markdown`);
  console.log(`⏰ Test started at: ${new Date().toISOString()}`);
  console.log('─'.repeat(80));

  const testStart = Date.now();

  try {
    // Prepare request
    const requestBody = JSON.stringify({
      url: TEST_URL,
      waitTime: 0,
    });

    const options = {
      hostname: 'api.weblinq.dev',
      port: 443,
      path: '/v1/web/markdown',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        Authorization: `Bearer ${API_KEY}`,
        'User-Agent': 'WebLinq-Performance-Test/1.0',
      },
    };

    console.log('📤 Sending request...');
    const response = await makeRequest(options, requestBody);

    const testEnd = Date.now();
    const totalTestTime = testEnd - testStart;

    console.log('─'.repeat(80));
    console.log('📊 PERFORMANCE RESULTS');
    console.log('─'.repeat(80));

    // Network timing
    console.log(`🌐 Network Timing:`);
    console.log(`  - Request to first byte: ${response.timings.networkTime}ms`);
    console.log(`  - Data transfer time: ${response.timings.dataTransferTime}ms`);
    console.log(`  - Total network time: ${response.timings.totalTime}ms`);
    console.log('');

    // Response analysis
    console.log(`📋 Response Analysis:`);
    console.log(`  - Status Code: ${response.statusCode}`);
    console.log(`  - Success: ${response.data.success ? '✅' : '❌'}`);

    if (response.data.success) {
      const metadata = response.data.data.metadata;
      console.log(`  - Word Count: ${metadata.wordCount}`);
      console.log(`  - Markdown Length: ${response.data.data.markdown.length} characters`);
      console.log(`  - Credits Cost: ${response.data.creditsCost}`);

      // Server-side timing (if available)
      if (metadata.timings) {
        console.log('');
        console.log(`⚡ Server-Side Timing Breakdown:`);
        console.log(`  - Total Duration: ${metadata.timings.totalDuration}ms`);
        console.log(
          `  - Browser Setup: ${metadata.timings.browserSetup}ms (${(
            (metadata.timings.browserSetup / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );
        console.log(
          `  - Page Navigation: ${metadata.timings.pageNavigation}ms (${(
            (metadata.timings.pageNavigation / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );
        console.log(
          `  - Content Extraction: ${metadata.timings.contentExtraction}ms (${(
            (metadata.timings.contentExtraction / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );
        console.log(
          `  - HTML Sanitization: ${metadata.timings.htmlSanitization}ms (${(
            (metadata.timings.htmlSanitization / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );
        console.log(
          `  - Markdown Conversion: ${metadata.timings.markdownConversion}ms (${(
            (metadata.timings.markdownConversion / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );
        console.log(
          `  - Response Assembly: ${metadata.timings.responseAssembly}ms (${(
            (metadata.timings.responseAssembly / metadata.timings.totalDuration) *
            100
          ).toFixed(1)}%)`,
        );

        // Identify bottlenecks
        const timings = metadata.timings;
        const bottlenecks = [
          { name: 'Browser Setup', time: timings.browserSetup },
          { name: 'Page Navigation', time: timings.pageNavigation },
          { name: 'Content Extraction', time: timings.contentExtraction },
          { name: 'HTML Sanitization', time: timings.htmlSanitization },
          { name: 'Markdown Conversion', time: timings.markdownConversion },
        ].sort((a, b) => b.time - a.time);

        console.log('');
        console.log(`🔍 Performance Bottlenecks (Top 3):`);
        bottlenecks.slice(0, 3).forEach((bottleneck, index) => {
          const percentage = ((bottleneck.time / timings.totalDuration) * 100).toFixed(1);
          console.log(`  ${index + 1}. ${bottleneck.name}: ${bottleneck.time}ms (${percentage}%)`);
        });
      }
    } else {
      console.log(`  - Error: ${response.data.error?.message || 'Unknown error'}`);
    }

    console.log('');
    console.log(`🏁 Total Test Time: ${totalTestTime}ms`);
    console.log(`⏰ Test completed at: ${new Date().toISOString()}`);

    // Performance assessment
    console.log('');
    console.log('🎯 Performance Assessment:');
    const serverTime = response.data.success ? response.data.data.metadata.timings?.totalDuration : 0;

    if (serverTime > 15000) {
      console.log('  ❌ SLOW: Server processing > 15 seconds');
    } else if (serverTime > 10000) {
      console.log('  ⚠️  MODERATE: Server processing > 10 seconds');
    } else if (serverTime > 5000) {
      console.log('  ✅ ACCEPTABLE: Server processing > 5 seconds');
    } else {
      console.log('  🚀 FAST: Server processing < 5 seconds');
    }

    if (response.timings.totalTime > 20000) {
      console.log('  ❌ SLOW: Total request time > 20 seconds');
    } else if (response.timings.totalTime > 15000) {
      console.log('  ⚠️  MODERATE: Total request time > 15 seconds');
    } else {
      console.log('  ✅ GOOD: Total request time < 15 seconds');
    }

    console.log('─'.repeat(80));

    // Save detailed results to file
    const resultData = {
      timestamp: new Date().toISOString(),
      testUrl: TEST_URL,
      networkTiming: response.timings,
      serverTiming: response.data.success ? response.data.data.metadata.timings : null,
      response: {
        statusCode: response.statusCode,
        success: response.data.success,
        wordCount: response.data.success ? response.data.data.metadata.wordCount : null,
        markdownLength: response.data.success ? response.data.data.markdown.length : null,
        error: response.data.error?.message || null,
      },
    };

    const filename = `markdown-test-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(resultData, null, 2));
    console.log(`📄 Detailed results saved to: ${filename}`);
  } catch (error) {
    const testEnd = Date.now();
    const totalTestTime = testEnd - testStart;

    console.log('─'.repeat(80));
    console.log('❌ TEST FAILED');
    console.log('─'.repeat(80));
    console.log(`Error: ${error.message}`);
    console.log(`Total test time: ${totalTestTime}ms`);
    console.log(`Test failed at: ${new Date().toISOString()}`);

    process.exit(1);
  }
}

// Run the test
testMarkdownExtraction().catch(console.error);
