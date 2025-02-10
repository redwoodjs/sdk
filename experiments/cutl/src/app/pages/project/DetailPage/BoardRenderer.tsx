'use client';

import { useEffect, useRef, useMemo } from 'react';

export function BoardRenderer({ boards, boardWidth, boardHeight }) {
  const containerRef = useRef(null);

  // Generate a unique color for each distinct rectangle size
  const getColorForSize = useMemo(() => {
    const colorMap = new Map();
    const generateColor = () => `hsl(${Math.random() * 360}, 70%, 60%)`;
    return (width, height) => {
      const key = `${width}x${height}`;
      if (!colorMap.has(key)) {
        colorMap.set(key, generateColor());
      }
      return colorMap.get(key);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !boards || boards.length === 0) return;

    // Clear previous canvas elements
    containerRef.current.innerHTML = '';

    boards.forEach((board) => {
      if (!board || !board.usedRects) return;

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

      // Draw cut panels with colors assigned by size
      board.usedRects.forEach(rect => {
        if (!rect) return;

        const x = rect.x * scaleFactor;
        const y = rect.y * scaleFactor;
        const width = rect.width * scaleFactor;
        const height = rect.height * scaleFactor;

        ctx.fillStyle = getColorForSize(rect.width, rect.height);
        ctx.fillRect(x, y, width, height);
        
        ctx.strokeStyle = '#000'; // Panel outline
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        
        // Set text properties
        ctx.fillStyle = '#000';
        ctx.font = `${48 * scaleFactor}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw width label on the top edge
        ctx.fillText(`${rect.width}`, x + width / 2, y + 48 * scaleFactor);

        // Rotate and draw height label on the left edge
        ctx.save();
        ctx.translate(x + 48 * scaleFactor, y + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${rect.height}`, 0, 0);
        ctx.restore();
      });

      // Append canvas to the container
      containerRef.current.appendChild(canvas);
    });
  }, [boards, boardWidth, boardHeight, getColorForSize]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-4 p-4 overflow-auto max-w-full">
      {/* Canvases will be appended here dynamically */}
    </div>
  );
}
