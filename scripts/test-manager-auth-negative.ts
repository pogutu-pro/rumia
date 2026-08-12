import { getManagerUserContext } from '../src/lib/utils/manager';

// Mock Supabase client for testing getManagerUserContext unit logic
function createMockSupabase(role: string | null, managedCampusId: string | null = null) {
  return {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: role ? { role, managed_campus_id: managedCampusId } : null,
              error: null,
            }),
          }),
        }),
      };
    },
  } as any;
}

async function runNegativeTests() {
  console.log('--- Running Mandatory Negative Authorization Tests (Step 2) ---');

  // Test 1: Student role
  const studentClient = createMockSupabase('student');
  const studentResult = await getManagerUserContext(studentClient, 'test-student-id');
  console.log('Test 1 - Student role attempt:', studentResult === null ? 'REJECTED (PASS)' : 'FAILED - Got context');
  if (studentResult !== null) {
    throw new Error('MANDATORY NEGATIVE TEST FAILED: Student role was granted manager context!');
  }

  // Test 2: Agent role
  const agentClient = createMockSupabase('agent');
  const agentResult = await getManagerUserContext(agentClient, 'test-agent-id');
  console.log('Test 2 - Agent role attempt:', agentResult === null ? 'REJECTED (PASS)' : 'FAILED - Got context');
  if (agentResult !== null) {
    throw new Error('MANDATORY NEGATIVE TEST FAILED: Agent role was granted manager context!');
  }

  // Test 3: Null / non-existent profile
  const nullClient = createMockSupabase(null);
  const nullResult = await getManagerUserContext(nullClient, 'non-existent-id');
  console.log('Test 3 - Non-existent user attempt:', nullResult === null ? 'REJECTED (PASS)' : 'FAILED - Got context');
  if (nullResult !== null) {
    throw new Error('MANDATORY NEGATIVE TEST FAILED: Non-existent profile was granted manager context!');
  }

  // Positive sanity checks
  // Test 4: Manager role
  const managerClient = createMockSupabase('manager', 'campus-123');
  const managerResult = await getManagerUserContext(managerClient, 'test-manager-id');
  console.log('Test 4 - Manager role attempt:', managerResult?.role === 'manager' && managerResult.managedCampusId === 'campus-123' ? 'ALLOWED (PASS)' : 'FAILED');

  // Test 5: Admin / SuperAdmin role
  const adminClient = createMockSupabase('admin');
  const adminResult = await getManagerUserContext(adminClient, 'test-admin-id');
  console.log('Test 5 - Admin role attempt:', adminResult?.isSuperAdmin === true ? 'ALLOWED (PASS)' : 'FAILED');

  console.log('--- All Step 2 Negative Authorization Tests PASSED! ---');
}

runNegativeTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
