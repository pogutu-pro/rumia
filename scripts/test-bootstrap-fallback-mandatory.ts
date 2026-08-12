// Step 4 Mandatory Test Case — Bootstrap fallback for unmanaged campuses

const unmanagedCampusApp = {
  id: 'app-unmanaged-001',
  campus_id: 'campus-unmanaged-uuid',
  full_name: 'Unmanaged Campus Applicant',
  hostel_name: 'New Campus Hostel',
};

function canViewOrActionApplication(
  userContext: { managedCampusId: string | null; isSuperAdmin: boolean },
  targetAppCampusId: string
): boolean {
  if (userContext.isSuperAdmin) return true;
  if (!userContext.managedCampusId) return false;
  return userContext.managedCampusId === targetAppCampusId;
}

async function runStep4BootstrapTests() {
  console.log('--- Running Mandatory Step 4 Bootstrap Fallback Tests ---');

  const managerCampusA = { managedCampusId: 'campus-a-uuid', isSuperAdmin: false };
  const superAdmin = { managedCampusId: null, isSuperAdmin: true };

  // Test 1: Super Admin attempts to access unmanaged campus application -> ALLOWED (Not invisible to super admin)
  const superAdminCanAccess = canViewOrActionApplication(superAdmin, unmanagedCampusApp.campus_id);
  console.log('Test 1 - Super Admin accessing unmanaged campus app:', superAdminCanAccess ? 'ALLOWED (PASS)' : 'FAILED - Invisible to super admin');
  if (!superAdminCanAccess) throw new Error('MANDATORY TEST FAILED: Unmanaged campus app is invisible to super admin!');

  // Test 2: Manager of Campus A attempts to access unmanaged campus application -> REJECTED
  const managerACanAccess = canViewOrActionApplication(managerCampusA, unmanagedCampusApp.campus_id);
  console.log('Test 2 - Manager of Campus A accessing unmanaged campus app:', !managerACanAccess ? 'REJECTED (PASS)' : 'FAILED - Manager A accessed unmanaged campus');
  if (managerACanAccess) throw new Error('MANDATORY TEST FAILED: Manager of Campus A accessed unmanaged campus app!');

  console.log('--- All Step 4 Bootstrap Fallback Tests PASSED! ---');
}

runStep4BootstrapTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
