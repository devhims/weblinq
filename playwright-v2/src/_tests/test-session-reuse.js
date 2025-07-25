#!/usr/bin/env node

/**
 * Session Reuse Performance Test for WebLinQ Playwright V2
 * This script demonstrates the performance benefits of session reuse
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

async function performSingleTest(testName, url, waitTime = 500) {
  console.log(`\n🧪 ${testName}`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/web/extract-markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, waitTime }),
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.ok) {
      const data = await response.json();
      const wordCount = data.data?.metadata?.wordCount || 0;
      console.log(`   ✅ Success: ${duration}ms (${wordCount} words)`);
      return { success: true, duration, wordCount };
    } else {
      console.log(`   ❌ Failed: ${duration}ms`);
      return { success: false, duration };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   💥 Exception: ${duration}ms - ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}

async function testSessionReuse() {
  console.log('🔄 Session Reuse Performance Test');
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`🕒 Started at: ${new Date().toISOString()}\n`);

  const testUrls = [
    'https://example.com',
    'https://httpbin.org/html',
    'https://jsonplaceholder.typicode.com/',
  ];

  const results = [];

  // First round - Cold start
  console.log('═══ Round 1: Cold Start ═══');
  for (let i = 0; i < testUrls.length; i++) {
    const result = await performSingleTest(`Test ${i + 1} (Cold)`, testUrls[i]);
    results.push({ ...result, round: 1, testIndex: i });

    // Wait a bit between tests to see logging
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Second round - Session reuse
  console.log('\n═══ Round 2: Session Reuse ═══');
  for (let i = 0; i < testUrls.length; i++) {
    const result = await performSingleTest(
      `Test ${i + 1} (Reuse)`,
      testUrls[i],
    );
    results.push({ ...result, round: 2, testIndex: i });

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Third round - Verify persistence
  console.log('\n═══ Round 3: Persistence Check ═══');
  for (let i = 0; i < testUrls.length; i++) {
    const result = await performSingleTest(
      `Test ${i + 1} (Persist)`,
      testUrls[i],
    );
    results.push({ ...result, round: 3, testIndex: i });

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Analyze results
  console.log('\n📊 Performance Analysis');
  console.log('════════════════════════════════════════');

  for (let i = 0; i < testUrls.length; i++) {
    const round1 = results.find((r) => r.round === 1 && r.testIndex === i);
    const round2 = results.find((r) => r.round === 2 && r.testIndex === i);
    const round3 = results.find((r) => r.round === 3 && r.testIndex === i);

    console.log(`\n🌐 URL ${i + 1}: ${testUrls[i]}`);

    if (round1?.success) {
      console.log(`   Cold Start:  ${round1.duration}ms`);
    }
    if (round2?.success) {
      console.log(`   First Reuse: ${round2.duration}ms`);
      if (round1?.success) {
        const improvement = (
          ((round1.duration - round2.duration) / round1.duration) *
          100
        ).toFixed(1);
        console.log(`   Improvement: ${improvement}%`);
      }
    }
    if (round3?.success) {
      console.log(`   Second Reuse: ${round3.duration}ms`);
    }
  }

  // Overall statistics
  const successfulResults = results.filter((r) => r.success);
  const round1Times = successfulResults
    .filter((r) => r.round === 1)
    .map((r) => r.duration);
  const round2Times = successfulResults
    .filter((r) => r.round === 2)
    .map((r) => r.duration);
  const round3Times = successfulResults
    .filter((r) => r.round === 3)
    .map((r) => r.duration);

  const avg = (arr) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  console.log('\n🎯 Overall Statistics');
  console.log('════════════════════════');
  console.log(`Cold Start Average:    ${avg(round1Times).toFixed(0)}ms`);
  console.log(`First Reuse Average:   ${avg(round2Times).toFixed(0)}ms`);
  console.log(`Second Reuse Average:  ${avg(round3Times).toFixed(0)}ms`);

  if (round1Times.length > 0 && round2Times.length > 0) {
    const overallImprovement = (
      ((avg(round1Times) - avg(round2Times)) / avg(round1Times)) *
      100
    ).toFixed(1);
    console.log(`Overall Improvement:   ${overallImprovement}%`);
  }

  console.log(`\n🕒 Completed at: ${new Date().toISOString()}`);
}

// Check if this file is being run directly
const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  testSessionReuse().catch(console.error);
}

export { testSessionReuse, performSingleTest };
