-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('VIDEO_FINAL', 'VIDEO_VARIANT', 'VIDEO_CLIP', 'IMAGE_POSTER', 'IMAGE_STILL', 'AUDIO_NARRATION', 'AUDIO_TRACK', 'POEM_TEXT', 'CAPTION_TEXT');

-- CreateEnum
CREATE TYPE "Placement" AS ENUM ('FEED', 'STORY', 'REEL', 'SHORT', 'CAROUSEL', 'HIGHLIGHT', 'SPOTLIGHT', 'LONG_FORM', 'COMMUNITY_POST');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('COMMENT', 'REPLY_TO_COMMENT', 'MENTION', 'DM', 'QUOTE', 'STORY_REPLY');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'AUTO_APPROVED', 'APPROVED', 'SENT', 'EDITED_SENT', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContactTier" AS ENUM ('COLD', 'WARM', 'LOYAL', 'VIP', 'MUTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('RAW', 'HOOK', 'SCRIPT', 'PRODUCING', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "PlatformType" ADD VALUE 'SNAPCHAT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoReplySettings" JSONB,
ADD COLUMN     "voicePersonaId" TEXT;

-- AlterTable
ALTER TABLE "calendar_entries" ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "coverFrameSec" DOUBLE PRECISION,
ADD COLUMN     "perPlatform" JSONB,
ADD COLUMN     "placement" "Placement" NOT NULL DEFAULT 'FEED',
ADD COLUMN     "platformPostIds" JSONB,
ADD COLUMN     "platforms" "PlatformType"[],
ADD COLUMN     "repurposedFrom" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "trackId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "platforms" ADD COLUMN     "grantedScopes" TEXT[],
ADD COLUMN     "manualMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "analytics" ADD COLUMN     "saves" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watchTimeSec" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "projectId" TEXT,
    "episode" INTEGER,
    "title" TEXT,
    "archetype" TEXT,
    "mode" TEXT,
    "gcsUri" TEXT NOT NULL,
    "publicUrl" TEXT,
    "durationSec" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "bpm" DOUBLE PRECISION,
    "trackId" TEXT,
    "poemText" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "pineconeIds" TEXT[],
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_variants" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "durationSec" INTEGER,
    "gcsUri" TEXT NOT NULL,
    "gradedFor" TEXT,
    "coverFrameSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gcsUri" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "bpm" DOUBLE PRECISION,
    "musicalKey" TEXT,
    "energy" DOUBLE PRECISION,
    "peakAt" DOUBLE PRECISION[],
    "durationSec" INTEGER NOT NULL,
    "mood" TEXT,
    "licensed" BOOLEAN NOT NULL DEFAULT false,
    "pineconeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highlight_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "title" TEXT NOT NULL,
    "coverAssetId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "assetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "highlight_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "tier" "ContactTier" NOT NULL DEFAULT 'COLD',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalEngagements" INTEGER NOT NULL DEFAULT 0,
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "calendarEntryId" TEXT,
    "platform" "PlatformType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "parentExternalId" TEXT,
    "type" "EngagementType" NOT NULL DEFAULT 'COMMENT',
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "sentiment" DOUBLE PRECISION,
    "intent" TEXT,
    "pineconeId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "platform" "PlatformType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "threadId" TEXT,
    "sentiment" DOUBLE PRECISION,
    "pineconeId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_replies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "commentId" TEXT,
    "dmId" TEXT,
    "platform" "PlatformType" NOT NULL,
    "draftText" TEXT NOT NULL,
    "finalText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "groundingRefs" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_arcs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archetypeMode" TEXT,
    "description" TEXT,
    "targetEpisodes" INTEGER,
    "bibleRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "story_arcs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyArcId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "voiceMemoGcsUri" TEXT,
    "imageRefs" TEXT[],
    "assetId" TEXT,
    "hooks" JSONB,
    "platforms" "PlatformType"[],
    "status" "IdeaStatus" NOT NULL DEFAULT 'RAW',
    "pineconeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspirations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "platform" "PlatformType",
    "mediaGcsUri" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "pineconeId" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspirations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_userId_kind_idx" ON "assets"("userId", "kind");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- CreateIndex
CREATE INDEX "asset_variants_assetId_idx" ON "asset_variants"("assetId");

-- CreateIndex
CREATE INDEX "tracks_userId_idx" ON "tracks"("userId");

-- CreateIndex
CREATE INDEX "highlight_collections_userId_platform_idx" ON "highlight_collections"("userId", "platform");

-- CreateIndex
CREATE INDEX "contacts_userId_tier_idx" ON "contacts"("userId", "tier");

-- CreateIndex
CREATE INDEX "contacts_lastSeenAt_idx" ON "contacts"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_platform_externalId_key" ON "contacts"("userId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "comments_userId_receivedAt_idx" ON "comments"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "comments_contactId_idx" ON "comments"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "comments_platform_externalId_key" ON "comments"("platform", "externalId");

-- CreateIndex
CREATE INDEX "direct_messages_userId_sentAt_idx" ON "direct_messages"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "direct_messages_contactId_sentAt_idx" ON "direct_messages"("contactId", "sentAt");

-- CreateIndex
CREATE INDEX "direct_messages_threadId_idx" ON "direct_messages"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "direct_messages_platform_externalId_key" ON "direct_messages"("platform", "externalId");

-- CreateIndex
CREATE INDEX "draft_replies_userId_status_idx" ON "draft_replies"("userId", "status");

-- CreateIndex
CREATE INDEX "draft_replies_scheduledFor_idx" ON "draft_replies"("scheduledFor");

-- CreateIndex
CREATE INDEX "story_arcs_userId_idx" ON "story_arcs"("userId");

-- CreateIndex
CREATE INDEX "ideas_userId_status_idx" ON "ideas"("userId", "status");

-- CreateIndex
CREATE INDEX "inspirations_userId_idx" ON "inspirations"("userId");

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "asset_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_variants" ADD CONSTRAINT "asset_variants_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlight_collections" ADD CONSTRAINT "highlight_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_replies" ADD CONSTRAINT "draft_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_replies" ADD CONSTRAINT "draft_replies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_replies" ADD CONSTRAINT "draft_replies_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_replies" ADD CONSTRAINT "draft_replies_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "direct_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_arcs" ADD CONSTRAINT "story_arcs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_storyArcId_fkey" FOREIGN KEY ("storyArcId") REFERENCES "story_arcs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspirations" ADD CONSTRAINT "inspirations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

