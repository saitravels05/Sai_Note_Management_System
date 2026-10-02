-- Phase 3 Migration: Secure Authentication, User Management, Roles & Permissions

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INVITED';

-- AlterEnum: Auth audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_ACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROLE_CHANGED';

-- AlterTable: user_profiles
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;

-- CreateTable: user_invitations
CREATE TABLE IF NOT EXISTS "user_invitations" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "invited_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_invitations_token_key" ON "user_invitations"("token");
CREATE INDEX IF NOT EXISTS "user_invitations_business_id_email_idx" ON "user_invitations"("business_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_idx" ON "password_reset_tokens"("email");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_business_id_fkey') THEN
        ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_role_id_fkey') THEN
        ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
