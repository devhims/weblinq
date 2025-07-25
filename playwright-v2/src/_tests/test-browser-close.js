#!/usr/bin/env node

/**
 * Test script to compare browser.close() vs session reuse behavior
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:8787';

async function getSessionStats() {
  const response = await fetch(`${BASE_URL}/api/web/stats`);
  const data = await response.json();
  return {
    total: data.sessions.total,
    available: data.sessions.available,
    busy: data.sessions.busy,
    sessionIds: data.sessions.details.map((s) => s.sessionId),
    sessionAges: data.sessions.details.map((s) => ({
      id: s.sessionId,
      age: s.ageMinutes,
    })),
  };
}

async function testMarkdownOperation() {
  const startTime = Date.now();
  const response = await fetch(`${BASE_URL}/api/web/extract-markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com', waitTime: 100 }),
  });
  const endTime = Date.now();
  const result = await response.json();
  return {
    success: result.success,
    duration: endTime - startTime,
    wordCount: result.data?.metadata?.wordCount || 0,
  };
}

async function runTest() {
  console.log('🧪 Browser.close() vs Session Reuse Test');
  console.log('=========================================\n');

  // Get initial state
  console.log('📊 Initial State:');
  const initialStats = await getSessionStats();
  console.log(
    `   Sessions: ${initialStats.total} total, ${initialStats.available} available`,
  );
  console.log(
    `   Session IDs: ${initialStats.sessionIds.slice(0, 2).join(', ')}...`,
  );
  console.log(
    `   Ages: ${initialStats.sessionAges
      .map((s) => `${s.age}min`)
      .join(', ')}\n`,
  );

  // Test multiple operations
  console.log('🔄 Running 3 operations with current settings...');
  const results = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`\n   Operation ${i}:`);
    const operationResult = await testMarkdownOperation();
    results.push(operationResult);
    console.log(
      `   ✅ ${operationResult.success ? 'Success' : 'Failed'} - ${
        operationResult.duration
      }ms (${operationResult.wordCount} words)`,
    );

    // Check sessions after each operation
    const stats = await getSessionStats();
    console.log(
      `   📊 Sessions: ${stats.total} total, ${stats.available} available`,
    );

    // Brief pause between operations
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Final state
  console.log('\n📊 Final State:');
  const finalStats = await getSessionStats();
  console.log(
    `   Sessions: ${finalStats.total} total, ${finalStats.available} available`,
  );
  console.log(
    `   Session IDs: ${finalStats.sessionIds.slice(0, 2).join(', ')}...`,
  );
  console.log(
    `   Ages: ${finalStats.sessionAges.map((s) => `${s.age}min`).join(', ')}`,
  );

  // Analysis
  console.log('\n📈 Analysis:');
  console.log(
    `   Session count change: ${initialStats.total} → ${finalStats.total} (${
      finalStats.total - initialStats.total >= 0 ? '+' : ''
    }${finalStats.total - initialStats.total})`,
  );
  console.log(
    `   Average duration: ${Math.round(
      results.reduce((sum, r) => sum + r.duration, 0) / results.length,
    )}ms`,
  );
  console.log(
    `   All operations successful: ${results.every((r) => r.success)}`,
  );

  const sessionIdsChanged = !initialStats.sessionIds
    .slice(0, 2)
    .every((id) => finalStats.sessionIds.includes(id));
  console.log(`   Session IDs changed: ${sessionIdsChanged ? 'Yes' : 'No'}`);

  if (finalStats.total > initialStats.total) {
    console.log(
      '   🔍 Behavior: New sessions created, suggesting browser.close() is working',
    );
  } else if (sessionIdsChanged) {
    console.log(
      '   🔍 Behavior: Session IDs changed, sessions were closed and new ones created',
    );
  } else {
    console.log(
      '   🔍 Behavior: Same sessions reused, browser.close() may not be working or delayed',
    );
  }
}

runTest().catch(console.error);
