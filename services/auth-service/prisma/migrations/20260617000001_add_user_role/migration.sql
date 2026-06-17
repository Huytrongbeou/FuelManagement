-- AlterTable: add role column with safe default
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'staff';

-- Promote known admin account
UPDATE "users" SET "role" = 'admin' WHERE "username" = 'admin';
