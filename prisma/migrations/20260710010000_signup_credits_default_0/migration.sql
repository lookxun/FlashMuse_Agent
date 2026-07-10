-- Default registration gift credits changed from 1500 to 0.
-- The initial credit_system migration seeded the "default" CreditSetting row with signupCredits=1500;
-- this makes 0 the new default for fresh deploys and resets the existing default row.
ALTER TABLE "CreditSetting" ALTER COLUMN "signupCredits" SET DEFAULT 0;
UPDATE "CreditSetting" SET "signupCredits" = 0 WHERE "id" = 'default' AND "signupCredits" = 1500;
