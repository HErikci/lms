ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;

CREATE TABLE "GuardianLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "phone" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastNotificationAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuardianLink_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuardianLink_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GuardianLink_studentId_guardianId_key" ON "GuardianLink"("studentId", "guardianId");
CREATE INDEX "GuardianLink_guardianId_idx" ON "GuardianLink"("guardianId");

CREATE TABLE "GuardianNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "providerMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "GuardianNotification_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "GuardianLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GuardianNotification_linkId_createdAt_idx" ON "GuardianNotification"("linkId", "createdAt");
