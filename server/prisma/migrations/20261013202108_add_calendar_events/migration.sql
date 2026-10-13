-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'event',
    "start" DATETIME NOT NULL,
    "end" DATETIME,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "courseId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalendarEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CalendarEvent_start_idx" ON "CalendarEvent"("start");

-- CreateIndex
CREATE INDEX "CalendarEvent_courseId_start_idx" ON "CalendarEvent"("courseId", "start");
