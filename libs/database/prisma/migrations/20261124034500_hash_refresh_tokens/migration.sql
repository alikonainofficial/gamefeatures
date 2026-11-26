-- Refresh tokens are now stored as a SHA-256 hash instead of the raw JWT.
-- Existing plaintext tokens can't be converted, so every session is invalidated once
-- (users sign in again). This also makes the NOT NULL column safe to add.
DELETE FROM "RefreshToken";

-- DropIndex
DROP INDEX "RefreshToken_token_idx";

-- DropIndex
DROP INDEX "RefreshToken_token_key";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "token",
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
