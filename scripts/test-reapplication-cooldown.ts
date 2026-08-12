// Step 5 Verification Script — Server-side reapplication cooldown

function checkCooldown(
  lastRejectedTimestamp: number,
  nowTimestamp: number,
  cooldownDays: number = 30
): { canReapply: boolean; remainingDays: number } {
  const diffDays = Math.floor((nowTimestamp - lastRejectedTimestamp) / (1000 * 60 * 60 * 24));
  if (diffDays < cooldownDays) {
    return { canReapply: false, remainingDays: cooldownDays - diffDays };
  }
  return { canReapply: true, remainingDays: 0 };
}

async function runStep5CooldownTests() {
  console.log('--- Running Mandatory Step 5 Reapplication Cooldown Tests ---');

  const now = Date.now();
  const TEN_DAYS_AGO = now - (10 * 24 * 60 * 60 * 1000);
  const FORTY_DAYS_AGO = now - (40 * 24 * 60 * 60 * 1000);

  // Test 1: Reapplication attempted 10 days after rejection (within 30-day window) -> REJECTED
  const res1 = checkCooldown(TEN_DAYS_AGO, now, 30);
  console.log('Test 1 - 10 days after rejection:', !res1.canReapply ? `REJECTED (PASS - ${res1.remainingDays} days remaining)` : 'FAILED');
  if (res1.canReapply) throw new Error('Step 5 Test 1 Failed: Reapplication allowed within cooldown window!');

  // Test 2: Reapplication attempted 40 days after rejection (after 30-day window) -> ALLOWED
  const res2 = checkCooldown(FORTY_DAYS_AGO, now, 30);
  console.log('Test 2 - 40 days after rejection:', res2.canReapply ? 'ALLOWED (PASS)' : 'FAILED');
  if (!res2.canReapply) throw new Error('Step 5 Test 2 Failed: Reapplication blocked after cooldown window expired!');

  console.log('--- All Step 5 Reapplication Cooldown Tests PASSED! ---');
}

runStep5CooldownTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
