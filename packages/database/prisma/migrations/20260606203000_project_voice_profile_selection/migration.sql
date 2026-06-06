ALTER TABLE "Project"
ADD COLUMN "voiceProfileId" TEXT;

ALTER TABLE "Project"
ADD CONSTRAINT "Project_voiceProfileId_fkey"
FOREIGN KEY ("voiceProfileId") REFERENCES "VoiceProfile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
