-- CreateTable
CREATE TABLE "LessonFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonFeedback_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LessonFeedback_lessonId_idx" ON "LessonFeedback"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonFeedback_userId_lessonId_key" ON "LessonFeedback"("userId", "lessonId");
