-- CreateTable
CREATE TABLE "QuizGrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "gradedById" TEXT,
    "gradedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizGrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizGrade_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizGrade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuizGrade_lessonId_idx" ON "QuizGrade"("lessonId");

-- CreateIndex
CREATE INDEX "QuizGrade_userId_gradedAt_idx" ON "QuizGrade"("userId", "gradedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizGrade_userId_lessonId_key" ON "QuizGrade"("userId", "lessonId");
