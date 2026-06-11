-- Normalize agent phone numbers to Kenyan international format (+254)
-- Handles numbers like 0114845619 -> +254114845619

UPDATE agents
SET
  phone = CASE
    WHEN phone ~ '^0' THEN '+254' || substring(phone from 2)
    WHEN phone ~ '^[0-9]' AND phone NOT LIKE '+%' AND phone NOT LIKE '254%' THEN '+254' || phone
    ELSE phone
  END,
  whatsapp = CASE
    WHEN whatsapp ~ '^0' THEN '+254' || substring(whatsapp from 2)
    WHEN whatsapp ~ '^[0-9]' AND whatsapp NOT LIKE '+%' AND whatsapp NOT LIKE '254%' THEN '+254' || whatsapp
    ELSE whatsapp
  END
WHERE
  (phone ~ '^[0-9]' AND phone NOT LIKE '+%' AND phone NOT LIKE '254%')
  OR (whatsapp ~ '^[0-9]' AND whatsapp NOT LIKE '+%' AND whatsapp NOT LIKE '254%');
