/**
 * AUDIT LOGGING INTEGRATION TEST
 * 
 * This test validates that audit logs are correctly written to the database.
 * Run with: node __audit_tests__/integration.test.js
 * 
 * REQUIREMENTS:
 * - .env file must be configured with SUPABASE_URL and SUPABASE_KEY
 * - Database must be accessible
 * 
 * IMPORTANT: This folder can be safely deleted after validation.
 */

require('dotenv').config();

// logAuditAction() inserts logs
// supabase is used to directly query/delete rows for verification
const { 
  logAuditAction, 
  AUDIT_ACTIONS, 
  SYSTEM_USER_ID 
} = require('../utils/auditLogger');
const { supabase } = require('../utils/supabaseClient');

// Test metadata prefix to identify test entries
const TEST_PREFIX = '__AUDIT_TEST__';

async function cleanup() {
  console.log('Cleaning up test entries...');
  const { error } = await supabase
    .from('logs')
    .delete()
    .like('description', `${TEST_PREFIX}%`);
  
  if (error) {
    console.error('Cleanup error:', error.message);
  }
}

async function runIntegrationTests() {
  console.log('\n========================================');
  console.log('AUDIT LOGGING INTEGRATION TESTS');
  console.log('========================================\n');

  const results = [];
  
  // ==================== TEST 1: Valid log entry is written ====================
  console.log('Test 1: Valid log entry is written to database');
  try {
    const testDesc = `${TEST_PREFIX} Integration test - valid entry`;
    const result = await logAuditAction({
      userId: 1,
      actionType: AUDIT_ACTIONS.LOGIN,
      description: testDesc,
      metadata: { test: true, status: 'success' }
    });

    if (!result.success) {
      throw new Error(`Insert failed: ${result.error}`);
    }

    // Verify the entry exists
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('description', testDesc)
      .single();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data) throw new Error('Log entry not found');
    if (data.user_id !== 1) throw new Error(`user_id mismatch: expected 1, got ${data.user_id}`);
    if (data.action !== AUDIT_ACTIONS.LOGIN) throw new Error(`action mismatch`);

    console.log('✅ Test 1 PASSED: Log entry correctly written\n');
    results.push({ test: 1, passed: true });
  } catch (e) {
    console.log(`❌ Test 1 FAILED: ${e.message}\n`);
    results.push({ test: 1, passed: false, error: e.message });
  }

  // ==================== TEST 2: SYSTEM_USER_ID works for failed login ====================
  console.log('Test 2: SYSTEM_USER_ID (0) works for system actions');
  try {
    const testDesc = `${TEST_PREFIX} System action test`;
    const result = await logAuditAction({
      userId: SYSTEM_USER_ID,
      actionType: AUDIT_ACTIONS.LOGIN,
      description: testDesc,
      metadata: { status: 'failed', reason: 'user_not_found' }
    });

    if (!result.success) {
      throw new Error(`Insert failed: ${result.error}`);
    }

    // Verify the entry exists with user_id = 0
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('description', testDesc)
      .single();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (data.user_id !== 0) throw new Error(`user_id should be 0, got ${data.user_id}`);

    console.log('✅ Test 2 PASSED: SYSTEM_USER_ID correctly stored as 0\n');
    results.push({ test: 2, passed: true });
  } catch (e) {
    console.log(`❌ Test 2 FAILED: ${e.message}\n`);
    results.push({ test: 2, passed: false, error: e.message });
  }

  // ==================== TEST 3: Metadata is stored correctly ====================
  console.log('Test 3: Metadata JSON is stored correctly');
  try {
    const testDesc = `${TEST_PREFIX} Metadata test`;
    const testMetadata = {
      order_id: 123,
      total_amount: 99.99,
      items_count: 5
    };
    
    await logAuditAction({
      userId: 1,
      actionType: AUDIT_ACTIONS.CREATE_ORDER,
      description: testDesc,
      metadata: testMetadata
    });

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('description', testDesc)
      .single();

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (!data.metadata) throw new Error('Metadata is null');
    if (data.metadata.order_id !== 123) throw new Error('order_id mismatch');
    if (data.metadata.total_amount !== 99.99) throw new Error('total_amount mismatch');
    if (data.metadata.items_count !== 5) throw new Error('items_count mismatch');

    console.log('✅ Test 3 PASSED: Metadata correctly stored and retrieved\n');
    results.push({ test: 3, passed: true });
  } catch (e) {
    console.log(`❌ Test 3 FAILED: ${e.message}\n`);
    results.push({ test: 3, passed: false, error: e.message });
  }

  // ==================== TEST 4: All action types work ====================
  console.log('Test 4: All action types can be logged');
  try {
    const actionTypes = Object.values(AUDIT_ACTIONS);
    
    for (const action of actionTypes) {
      const testDesc = `${TEST_PREFIX} Action type test: ${action}`;
      const result = await logAuditAction({
        userId: 1,
        actionType: action,
        description: testDesc,
        metadata: { action_test: action }
      });

      if (!result.success) {
        throw new Error(`Failed to log action ${action}: ${result.error}`);
      }
    }

    console.log(`✅ Test 4 PASSED: All ${actionTypes.length} action types logged successfully\n`);
    results.push({ test: 4, passed: true });
  } catch (e) {
    console.log(`❌ Test 4 FAILED: ${e.message}\n`);
    results.push({ test: 4, passed: false, error: e.message });
  }

  // ==================== TEST 5: Null userId throws error ====================
  console.log('Test 5: Null userId throws error (not silent fail)');
  try {
    let errorThrown = false;
    try {
      await logAuditAction({
        userId: null,
        actionType: AUDIT_ACTIONS.LOGIN,
        description: `${TEST_PREFIX} Should not appear`
      });
    } catch (e) {
      errorThrown = true;
    }

    if (!errorThrown) {
      throw new Error('Expected error to be thrown but it was not');
    }

    console.log('✅ Test 5 PASSED: Null userId correctly throws error\n');
    results.push({ test: 5, passed: true });
  } catch (e) {
    console.log(`❌ Test 5 FAILED: ${e.message}\n`);
    results.push({ test: 5, passed: false, error: e.message });
  }

  // ==================== TEST 6: One log per action (no duplicates) ====================
  console.log('Test 6: Exactly one log entry per action');
  try {
    const uniqueId = Date.now();
    const testDesc = `${TEST_PREFIX} Unique test ${uniqueId}`;
    
    await logAuditAction({
      userId: 1,
      actionType: AUDIT_ACTIONS.CREATE_PRODUCT,
      description: testDesc,
      metadata: { unique_id: uniqueId }
    });

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('description', testDesc);

    if (error) throw new Error(`Query failed: ${error.message}`);
    if (data.length !== 1) throw new Error(`Expected 1 entry, found ${data.length}`);

    console.log('✅ Test 6 PASSED: Exactly one log entry created\n');
    results.push({ test: 6, passed: true });
  } catch (e) {
    console.log(`❌ Test 6 FAILED: ${e.message}\n`);
    results.push({ test: 6, passed: false, error: e.message });
  }

  // ==================== CLEANUP & SUMMARY ====================
  
  await cleanup();

  console.log('========================================');
  console.log('INTEGRATION TEST SUMMARY');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n❌ SOME INTEGRATION TESTS FAILED');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   Test ${r.test}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ ALL INTEGRATION TESTS PASSED');
    console.log('\nThe Audit Log system is working correctly.');
    console.log('You can safely delete the __audit_tests__ folder.');
    process.exit(0);
  }
}

runIntegrationTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
