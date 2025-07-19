#!/usr/bin/env node

/**
 * Simple test script for WebLinQ Playwright V2 API
 * Run this against a deployed or local development instance
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

async function testEndpoint(endpoint, description, options = {}) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`   URL: ${BASE_URL}${endpoint}`);

  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Duration: ${duration}ms`);

    if (response.ok) {
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log(`   ✅ Success`);
        if (options.showData) {
          console.log(`   Data:`, JSON.stringify(data, null, 2));
        } else if (data.success !== undefined) {
          console.log(`   Success: ${data.success}`);
          if (data.data?.metadata) {
            console.log(`   Metadata:`, data.data.metadata);
          }
          if (data.creditsCost !== undefined) {
            console.log(`   Credits Cost: ${data.creditsCost}`);
          }
        }
      } else {
        // Handle binary responses (like images)
        const blob = await response.blob();
        console.log(`   ✅ Success (Binary)`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Size: ${blob.size} bytes`);
      }
    } else {
      console.log(`   ❌ Failed`);
      const errorText = await response.text();
      console.log(`   Error:`, errorText);
    }
  } catch (error) {
    console.log(`   💥 Exception: ${error.message}`);
  }
}

async function testSessionReuse() {
  console.log('\n🔄 Testing Session Reuse Performance');

  const tests = [
    { url: 'https://example.com', name: 'First Request' },
    { url: 'https://httpbin.org/html', name: 'Second Request' },
    { url: 'https://example.com', name: 'Third Request (same as first)' },
  ];

  const times = [];

  for (const test of tests) {
    const startTime = Date.now();

    try {
      const response = await fetch(`${BASE_URL}/api/web/extract-markdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: test.url, waitTime: 500 }),
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      times.push(duration);

      if (response.ok) {
        const data = await response.json();
        console.log(
          `   ✅ ${test.name}: ${duration}ms (${
            data.data?.metadata?.wordCount || 0
          } words)`,
        );
      } else {
        console.log(`   ❌ ${test.name}: ${duration}ms (failed)`);
      }
    } catch (error) {
      console.log(`   💥 ${test.name}: Failed - ${error.message}`);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Performance Analysis:');
  console.log(`   First request: ${times[0]}ms (cold start)`);
  console.log(`   Second request: ${times[1]}ms`);
  console.log(`   Third request: ${times[2]}ms`);

  if (times.length >= 2) {
    const improvement = (((times[0] - times[1]) / times[0]) * 100).toFixed(1);
    console.log(`   Session reuse improvement: ${improvement}% faster`);
  }
}

async function runTests() {
  console.log('🚀 WebLinQ Playwright V2 API Tests');
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}`);

  // Test 1: Root endpoint
  await testEndpoint('/', 'Root endpoint information', { showData: true });

  // Test 2: Health check
  await testEndpoint('/api/web/health', 'Health check', { showData: true });

  // Test 3: Markdown extraction
  await testEndpoint(
    '/api/web/extract-markdown',
    'Markdown extraction - Example.com',
    {
      method: 'POST',
      body: {
        url: 'https://example.com',
        waitTime: 1000,
      },
    },
  );

  // Test 4: Screenshot (base64)
  await testEndpoint(
    '/api/web/screenshot',
    'Screenshot - Example.com (base64)',
    {
      method: 'POST',
      body: {
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        waitTime: 1000,
        base64: true,
      },
    },
  );

  // Test 5: Screenshot (binary)
  await testEndpoint(
    '/api/web/screenshot',
    'Screenshot - Example.com (binary)',
    {
      method: 'POST',
      body: {
        url: 'https://example.com',
        viewport: { width: 800, height: 600 },
        base64: false,
      },
    },
  );

  // Test 6: Invalid URL
  await testEndpoint('/api/web/extract-markdown', 'Invalid URL test', {
    method: 'POST',
    body: {
      url: 'not-a-url',
    },
  });

  // Test 7: Session reuse performance
  await testSessionReuse();

  console.log('\n✨ Tests completed!');
  console.log(`🕒 Finished at: ${new Date().toISOString()}`);
}

// Check if this file is being run directly
const isMain =
  process.argv[1] === __filename ||
  import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  runTests().catch(console.error);
}

export { testEndpoint, runTests, testSessionReuse };
