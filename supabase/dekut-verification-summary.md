# DeKUT verification ingestion summary

## What was audited

- Existing hostel records live in the listings table.
- The existing owner/caretaker contact field is listings.landlord_phone.
- Existing payment details are stored in listings.mpesa_details.
- The existing agent profile table already has an agents.verified column.
- There was no existing listings verification status field, so the ingestion extends listings with neutral verification columns rather than creating a separate model.

## Files added

- [src/lib/utils/dekut-verification.ts](src/lib/utils/dekut-verification.ts): normalization, parsing, and matching helpers.
- [src/lib/utils/**tests**/dekut-verification.test.ts](src/lib/utils/__tests__/dekut-verification.test.ts): tests for phone normalization and matching.
- [scripts/ingest-dekut-verification.ts](scripts/ingest-dekut-verification.ts): ingests the official DeKUT records and emits an admin review report.
- [supabase/migrations/20260726000000_add_dekut_verification_columns.sql](supabase/migrations/20260726000000_add_dekut_verification_columns.sql): adds verification columns to listings.
- [supabase/dekut-verification-review.json](supabase/dekut-verification-review.json): the generated admin review export for all 93 records.

## Important note

The live Supabase connection from this environment can read the database but the CLI auth path for applying schema changes was not available, so the migration file is ready but the actual ALTER TABLE statement still needs to be applied from a session with Supabase CLI auth or a direct database admin connection.
