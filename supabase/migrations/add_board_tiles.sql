-- Add board_tiles column to room_games table
-- board_tiles stores the server-generated tile layout so all clients see the same board
ALTER TABLE room_games
ADD COLUMN IF NOT EXISTS board_tiles JSONB DEFAULT '[]'::JSONB;
