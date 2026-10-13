-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '',
    "accessMode" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT'
);
INSERT INTO "new_Course" ("accessMode", "category", "description", "id", "level", "status", "tags", "title") SELECT "accessMode", "category", "description", "id", "level", "status", "tags", "title" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

