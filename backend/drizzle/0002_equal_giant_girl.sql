CREATE TABLE IF NOT EXISTS "request_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"encrypted_payload" text NOT NULL,
	"encrypted_result" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer NOT NULL,
	"estimated_ms" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_until" timestamp,
	"error_code" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "request_jobs_user_key_unique" ON "request_jobs" ("user_id","key_hash");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "request_jobs" ADD CONSTRAINT "request_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
