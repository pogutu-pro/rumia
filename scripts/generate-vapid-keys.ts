/**
 * Generate VAPID key pair for web push notifications.
 *
 * Run once: npx tsx scripts/generate-vapid-keys.ts
 *
 * Outputs the keys to stdout. Copy them into your .env.local:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
 *   VAPID_PRIVATE_KEY=<private>
 *
 * Never commit these values to version control.
 */

import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

console.log("\nVAPID Key Pair Generated\n");
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log(
  "\nAdd the above two lines to your .env.local file. Do NOT commit them.\n"
);
