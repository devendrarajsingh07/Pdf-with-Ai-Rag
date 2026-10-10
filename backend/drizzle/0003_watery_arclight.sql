CREATE UNIQUE INDEX IF NOT EXISTS "request_jobs_active_resource_unique" ON "request_jobs" ("resource_id") WHERE "status" = 'processing';
