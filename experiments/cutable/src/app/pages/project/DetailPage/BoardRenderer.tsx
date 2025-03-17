"use client";

import { useEffect, useRef, useMemo } from "react";

export function BoardRenderer({
  boards,
  boardWidth,
  boardHeight,
}: {
  boards: any;
  boardWidth: any;
  boardHeight: any;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevBoardsRef = useRef<any[]>([]);
  // Generate a unique color for each distinct rectangle size
  const getColorForSize = useMemo(() => {
    const colorMap = new Map();
    const generateColor = () => `hsl(${Math.random() * 360}, 70%, 60%)`;
    return (width: number, height: number) => {
      const key = `${width}x${height}`;
      if (!colorMap.has(key)) {
        colorMap.set(key, generateColor());
      }
      return colorMap.get(key);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !boards || boards.length === 0) return;

    // Prevent unnecessary re-renders
    if (JSON.stringify(boards) === JSON.stringify(prevBoardsRef.current)) {
      return;
    }
    prevBoardsRef.current = boards; // Store previous boards

    containerRef.current.innerHTML = ""; // Clear previous canvas

    boards.forEach((board: any) => {
      if (!board || !board.usedRects) return;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const scaleFactor = 550 / boardHeight;
      canvas.width = boardHeight * scaleFactor;
      canvas.height = boardWidth * scaleFactor;
      canvas.style.border = "1px solid #ccc";

      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw panels first
      board.usedRects.forEach((rect: any) => {
        const x = rect.y * scaleFactor;
        const y = rect.x * scaleFactor;
        const width = rect.height * scaleFactor;
        const height = rect.width * scaleFactor;

        ctx.fillStyle = getColorForSize(rect.width, rect.height);
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Adjust font size to fit inside small panels
        const fontSize = Math.min(48 * scaleFactor, width * 0.3, height * 0.3);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = "#000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Place height text in the center
        ctx.fillText(`${rect.height}`, x + width / 2, y + fontSize);

        // Rotate and place width text
        ctx.save();
        ctx.translate(x + fontSize, y + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${rect.width}`, 0, 0);
        ctx.restore();
      });

      // Draw free spaces
      board.freeRects.forEach((rect: any) => {
        const x = rect.y * scaleFactor;
        const y = rect.x * scaleFactor;
        const width = rect.height * scaleFactor;
        const height = rect.width * scaleFactor;

        ctx.fillStyle = "rgba(200, 200, 200, 0.5)"; // Light gray for free spaces
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = "#999";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Adjust font size for free space labels
        const fontSize = Math.min(48 * scaleFactor, width * 0.3, height * 0.3);
        ctx.font = `${fontSize}px Arial`;
        ctx.fillStyle = "#555";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Ensure text is inside the free space
        ctx.fillText(`${rect.height}`, x + width / 2, y + fontSize);

        // Rotate and place width text
        ctx.save();
        ctx.translate(x + fontSize, y + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${rect.width}`, 0, 0);
        ctx.restore();
      });

      if (containerRef.current) {
        containerRef.current.appendChild(canvas);
      }
    });
  }, [boards, boardWidth, boardHeight]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap gap-4 p-4 overflow-auto max-w-full"
    >
      Loading...
    </div>
  );
}
