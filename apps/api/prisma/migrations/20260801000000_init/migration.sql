CREATE TYPE "Side" AS ENUM ('RED', 'BLACK');
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');
CREATE TYPE "ResultReason" AS ENUM ('CHECKMATE', 'STALEMATE', 'RESIGNATION', 'DRAW_AGREEMENT', 'RULE_DRAW');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestIdentity" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "nickname" TEXT,
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "guestIdentityId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "replayToken" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'WAITING',
    "initialFen" TEXT NOT NULL,
    "currentFen" TEXT NOT NULL,
    "turn" "Side" NOT NULL DEFAULT 'RED',
    "ply" INTEGER NOT NULL DEFAULT 0,
    "winner" "Side",
    "resultReason" "ResultReason",
    "drawOfferedBy" "Side",
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "nickname" TEXT NOT NULL,
    "userId" TEXT,
    "guestIdentityId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "fenAfter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "GuestIdentity_tokenHash_key" ON "GuestIdentity"("tokenHash");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE UNIQUE INDEX "Game_code_key" ON "Game"("code");
CREATE UNIQUE INDEX "Game_replayToken_key" ON "Game"("replayToken");
CREATE UNIQUE INDEX "GameParticipant_gameId_side_key" ON "GameParticipant"("gameId", "side");
CREATE UNIQUE INDEX "GameParticipant_gameId_guestIdentityId_key" ON "GameParticipant"("gameId", "guestIdentityId");
CREATE INDEX "GameParticipant_userId_idx" ON "GameParticipant"("userId");
CREATE UNIQUE INDEX "Move_gameId_ply_key" ON "Move"("gameId", "ply");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_guestIdentityId_fkey" FOREIGN KEY ("guestIdentityId") REFERENCES "GuestIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_guestIdentityId_fkey" FOREIGN KEY ("guestIdentityId") REFERENCES "GuestIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Move" ADD CONSTRAINT "Move_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
