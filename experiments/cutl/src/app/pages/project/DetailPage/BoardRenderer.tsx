'use client';

import { useEffect, useRef } from 'react';

export function BoardRenderer({ boards, boardWidth, boardHeight }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !boards || boards.length === 0) return;

    // Clear previous canvas elements
    containerRef.current.innerHTML = '';

    boards.forEach((board, index) => {
      if (!board || !board.usedRects) return; // Ensure bin has usedRects

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas dimensions
      const scaleFactor = 400 / boardWidth;
      canvas.width = boardWidth * scaleFactor;
      canvas.height = boardHeight * scaleFactor;
      canvas.style.border = '1px solid #ccc';

      // Draw board background
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw cut panels
      board.usedRects.forEach(rect => {
        if (!rect) return;

        const x = rect.x * scaleFactor;
        const y = rect.y * scaleFactor;
        const width = rect.width * scaleFactor;
        const height = rect.height * scaleFactor;

        ctx.fillStyle = '#6c757d'; // Panel color
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#000'; // Panel outline
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        
        // Add text to indicate size
        ctx.fillStyle = '#000';
        ctx.font = `${10 * scaleFactor}px Arial`;
        ctx.fillText(`${rect.width} x ${rect.height}`, x + 5, y + 15);
      });

      // Append canvas to the container
      containerRef.current.appendChild(canvas);
    });
  }, [boards, boardWidth, boardHeight]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-4 p-4 overflow-auto max-w-full">
      {/* Canvases will be appended here dynamically */}
    </div>
  );
}
