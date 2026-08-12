# Rumia

## DeKUT verification ingestion note

The current Rumia schema already uses the listings table for hostel records and the existing landlord_phone field for owner/caretaker phone numbers. Before adding any verification data, the ingestion path should extend the existing listings table with verification columns rather than creating a parallel hostel/verification model.

Existing fields to reuse:

- listings.landlord_phone for owner/caretaker phone numbers
- listings.mpesa_details for payment details already captured by the listing form
- agents.verified for agent verification state

The DeKUT ingestion should preserve existing listing data and only add neutral verification flags such as verified, verified_source, verified_date, discrepancy_review_needed, official_record_no_listing, shared_contact_detected, and manual_review_needed.
