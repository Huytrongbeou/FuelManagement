-- Add import_signature column for business-content hash duplicate detection
ALTER TABLE "import_jobs" ADD COLUMN "import_signature" VARCHAR(64);
