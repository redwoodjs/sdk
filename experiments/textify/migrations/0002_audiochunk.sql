-- CreateTable
CREATE TABLE "AudioChunk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "chunk" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create a trigger to clean up old entries
CREATE TRIGGER clean_audio_chunks
AFTER INSERT ON AudioChunk
WHEN NEW.sent = true
BEGIN
    DELETE FROM AudioChunk WHERE created_at < DATETIME('now', '-10 minutes');
END;
