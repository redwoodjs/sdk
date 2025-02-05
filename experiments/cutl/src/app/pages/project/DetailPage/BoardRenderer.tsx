'use client';

import { useEffect, useRef } from 'react';
import { type BoardPiece } from './functions';

export function BoardRenderer({ 
  boards, 
  boardWidth, 
  boardHeight 
}: {
  boards: BoardPiece[][];
  boardWidth: number;
  boardHeight: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous canvases
    containerRef.current.innerHTML = '';

    // Draw each board on its own canvas
    boards.forEach((board, index) => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(
        (containerRef.current?.clientWidth ?? 0) * 0.95 / boardHeight, // 95% of container width
        400 // maximum scale
      );
      
      canvas.width = boardHeight * scale;
      canvas.height = boardWidth * scale;
      canvas.style.maxWidth = '100%';  // Ensure canvas doesn't overflow
      
      const ctx = canvas.getContext('2d');
      if (!ctx || !containerRef.current) return;

      // Draw board background (rotated)
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw pieces (rotated)
      board.forEach(piece => {
        ctx.fillStyle = '#4a5568';
        ctx.fillRect(
          piece.y * scale,  // Swap x and y
          piece.x * scale,  // Swap x and y
          piece.height * scale,  // Swap width and height
          piece.width * scale   // Swap width and height
        );
        ctx.strokeStyle = '#000';
        ctx.strokeRect(
          piece.y * scale,
          piece.x * scale,
          piece.height * scale,
          piece.width * scale
        );

        // Add dimensions text (rotated)
        ctx.fillStyle = '#ffffff';
        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = `${piece.width}x${piece.height}`;
        ctx.fillText(
          text,
          (piece.y + piece.height/2) * scale,
          (piece.x + piece.width/2) * scale
        );
      });

      containerRef.current.appendChild(canvas);
    });
  }, [boards, boardWidth, boardHeight]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-4 p-4 overflow-auto max-w-full">
      {/* canvas will be appended here */}
    </div>
  );
} 