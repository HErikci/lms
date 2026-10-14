ALTER TABLE "Exam" ADD COLUMN "learningObjectives" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Exam" ADD COLUMN "requiresCourseCompletion" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ExamAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "examId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deadlineAt" DATETIME,
  "submittedAt" DATETIME,
  "snapshot" TEXT NOT NULL,
  "answers" TEXT NOT NULL DEFAULT '{}',
  "result" TEXT,
  CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamAttempt_examId_userId_number_key" ON "ExamAttempt"("examId", "userId", "number");
CREATE INDEX "ExamAttempt_userId_examId_startedAt_idx" ON "ExamAttempt"("userId", "examId", "startedAt");
CREATE UNIQUE INDEX "ExamAttempt_one_active" ON "ExamAttempt"("examId", "userId") WHERE "status" = 'IN_PROGRESS';
