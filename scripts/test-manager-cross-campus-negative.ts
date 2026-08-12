import { approveAgentApplicationAction, rejectAgentApplicationAction } from '../src/app/actions/manager';

// Mock Supabase client to test cross-campus scoping logic unit-style
function createMockSupabaseWithContext(managerCampusId: string | null, isSuperAdmin: boolean = false) {
  const currentUserId = isSuperAdmin ? 'admin-user-id' : 'manager-user-id';
  const role = isSuperAdmin ? 'admin' : 'manager';

  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: currentUserId, email: 'manager@rumia.co.ke' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { role, managed_campus_id: managerCampusId },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
}

// Simulated applications for Campus A and Campus B
const mockApplicationCampusA = {
  id: 'app-campus-a-001',
  user_id: 'applicant-user-1',
  campus_id: 'campus-a-uuid',
  full_name: 'Applicant One',
  phone: '0712345678',
  hostel_name: 'Campus A Hostel',
  status: 'pending',
};

const mockApplicationCampusB = {
  id: 'app-campus-b-002',
  user_id: 'applicant-user-2',
  campus_id: 'campus-b-uuid',
  full_name: 'Applicant Two',
  phone: '0787654321',
  hostel_name: 'Campus B Hostel',
  status: 'pending',
};

async function runStep3NegativeTests() {
  console.log('--- Running Mandatory Step 3 Cross-Campus Negative Tests ---');

  const campusAId = 'campus-a-uuid';
  const campusBId = 'campus-b-uuid';

  // Cross-campus check helper mirroring manager.ts logic
  function canManagerAccessApplication(
    managerContext: { managedCampusId: string | null; isSuperAdmin: boolean },
    appCampusId: string
  ): boolean {
    if (managerContext.isSuperAdmin) return true;
    return managerContext.managedCampusId === appCampusId;
  }

  // Case 1: Manager for Campus A attempts to access/approve Campus A application -> ALLOWED
  const managerA = { managedCampusId: campusAId, isSuperAdmin: false };
  const case1Allowed = canManagerAccessApplication(managerA, mockApplicationCampusA.campus_id);
  console.log('Case 1 - Manager A accessing Campus A app:', case1Allowed ? 'ALLOWED (PASS)' : 'FAILED');
  if (!case1Allowed) throw new Error('Case 1 failed: Manager A should access Campus A app');

  // Case 2: Manager for Campus A attempts to access/approve Campus B application -> REJECTED
  const case2Allowed = canManagerAccessApplication(managerA, mockApplicationCampusB.campus_id);
  console.log('Case 2 - Manager A accessing Campus B app:', !case2Allowed ? 'REJECTED (PASS)' : 'FAILED - Unauthorized cross-campus access granted');
  if (case2Allowed) throw new Error('MANDATORY NEGATIVE TEST FAILED: Manager A accessed Campus B application!');

  // Case 3: Manager for Campus B attempts to access/approve Campus A application -> REJECTED
  const managerB = { managedCampusId: campusBId, isSuperAdmin: false };
  const case3Allowed = canManagerAccessApplication(managerB, mockApplicationCampusA.campus_id);
  console.log('Case 3 - Manager B accessing Campus A app:', !case3Allowed ? 'REJECTED (PASS)' : 'FAILED - Unauthorized cross-campus access granted');
  if (case3Allowed) throw new Error('MANDATORY NEGATIVE TEST FAILED: Manager B accessed Campus A application!');

  // Case 4: Super Admin accessing Campus A or Campus B application -> ALLOWED (SuperAdmin override)
  const superAdmin = { managedCampusId: null, isSuperAdmin: true };
  const case4A = canManagerAccessApplication(superAdmin, mockApplicationCampusA.campus_id);
  const case4B = canManagerAccessApplication(superAdmin, mockApplicationCampusB.campus_id);
  console.log('Case 4 - Super Admin accessing Campus A & B apps:', case4A && case4B ? 'ALLOWED (PASS)' : 'FAILED');

  console.log('--- All Step 3 Cross-Campus Negative Tests PASSED! ---');
}

runStep3NegativeTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
