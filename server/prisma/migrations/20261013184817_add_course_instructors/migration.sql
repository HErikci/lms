-- CreateTable
CREATE TABLE "CourseInstructor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseInstructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CourseInstructor_courseId_position_idx" ON "CourseInstructor"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CourseInstructor_courseId_userId_key" ON "CourseInstructor"("courseId", "userId");

-- Backfill: each existing course keeps its single instructor at position 1
INSERT INTO "CourseInstructor" ("id","courseId","userId","position","createdAt") SELECT lower(hex(randomblob(12))), "id", "instructorId", 1, CURRENT_TIMESTAMP FROM "Course";
