-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "roles" TEXT NOT NULL DEFAULT 'STUDENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("avatarUrl", "createdAt", "email", "id", "locale", "name", "passwordHash", "role") SELECT "avatarUrl", "createdAt", "email", "id", "locale", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Backfill: the column default above fills every existing row with
-- 'STUDENT', which is only correct for users whose single role was
-- already STUDENT. Reconcile `roles` with the pre-existing `role`
-- value for every row so no one ends up with an inconsistent role list.
UPDATE "User" SET "roles" = "role" WHERE "roles" = 'STUDENT' AND "role" != 'STUDENT';

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
