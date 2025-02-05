"use server";

import {
  type Project,
} from "@prisma/client";
import { db } from "../../../../db";
import type { ProjectItem } from './ProjectDetailPage';

export interface BoardPiece {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function saveProject(id: string, project: Omit<Project, 'cutlistItems'>, cutlistItems: ProjectItem[], userId: string) {

  await db.project.findFirstOrThrow({
    where: {
      id,
      userId: userId
    }
  })

  const data = {
    title: project.title,
    boardWidth: project.boardWidth,
    boardLength: project.boardLength,
    bladeWidth: project.bladeWidth,
    boardPrice: project.boardPrice,
    cutlistItems: JSON.stringify(cutlistItems),
  }

  await db.project.update({
    data,
    where: {
      id,
    }
  })
}

export function optimizeBoardUsage(boardWidth: number, boardHeight: number, bladeThickness: number, pieces: number[][]): BoardPiece[][] {
  console.log('Starting optimization with:', {
    boardWidth,
    boardHeight,
    bladeThickness,
    pieces
  });

  // Sort pieces by area (largest first) to optimize placement
  const sortedPieces = [...pieces].sort((a, b) => 
    (b[0] * b[1]) - (a[0] * a[1])
  );

  const boards: BoardPiece[][] = [];
  let currentBoard: BoardPiece[] = [];
  boards.push(currentBoard);

  for (const piece of sortedPieces) {
    console.log('Processing piece:', piece);
    let placed = false;

    // Try current board first
    if (placePieceOnBoard(currentBoard, piece, boardWidth, boardHeight, bladeThickness)) {
      placed = true;
    }

    // If not placed, try a new board
    if (!placed) {
      currentBoard = [];
      boards.push(currentBoard);
      placed = placePieceOnBoard(currentBoard, piece, boardWidth, boardHeight, bladeThickness);
      
      if (!placed) {
        console.error('Failed to place piece:', piece);
      }
    }
  }

  // Remove empty boards
  return boards.filter(board => board.length > 0);
}

export function placePieceOnBoard(board: BoardPiece[], piece: number[], boardWidth: number, boardHeight: number, bladeThickness: number) {
  for (let rotation = 0; rotation < 2; rotation++) {
      let w = rotation ? piece[1] : piece[0];
      let h = rotation ? piece[0] : piece[1];
      
      for (let x = 0; x + w + bladeThickness <= boardWidth; x++) {
          for (let y = 0; y + h + bladeThickness <= boardHeight; y++) {
              if (canPlace(board, x, y, w, h, bladeThickness)) {
                  board.push({ x, y, width: w, height: h });
                  return true;
              }
          }
      }
  }
  return false;
}

export function canPlace(board: BoardPiece[], x: number, y: number, w: number, h: number, bladeThickness: number) {
  for (let piece of board) {
      if (!(x + w + bladeThickness <= piece.x || piece.x + piece.width + bladeThickness <= x ||
            y + h + bladeThickness <= piece.y || piece.y + piece.height + bladeThickness <= y)) {
          return false;
      }
  }
  return true;
}

export function calculateBoards(items: ProjectItem[], boardWidth: number, boardHeight: number, boardPrice: number, bladeThickness: number) {
  console.log('Original items:', items);
  
  // Create array of pieces with proper quantity
  const pieces = items.flatMap(item => {
    console.log(`Processing item: width=${item.width}, length=${item.length}, quantity=${item.quantity}`);
    return new Array(Number(item.quantity)).fill([item.width, item.length]);
  });
  
  console.log('Expanded pieces:', pieces);
  const boards = optimizeBoardUsage(boardWidth, boardHeight, bladeThickness, pieces);
  console.log('Resulting boards:', boards);
  
  return {
    boards,
    boardCount: boards.length,
    totalCost: boards.length * boardPrice
  }
}

// export function downloadPDF() {
//   const { jsPDF } = window.jspdf;
//   const boardHeight = parseInt(document.getElementById('boardHeight').value);
//   const boardWidth = parseInt(document.getElementById('boardWidth').value);
  
//   // Get the number of boards from the boardCount element
//   const boardCountElement = document.getElementById('boardCount');
//   const boardsCount = parseInt(boardCountElement.textContent.match(/\d+/)[0]);
  
//   // Initialize PDF in landscape
//   const pdf = new jsPDF({
//       orientation: 'landscape',
//       unit: 'mm',
//       format: 'a4'
//   });
  
//   // A4 landscape dimensions in mm
//   const pageWidth = 297;
//   const pageHeight = 210;
//   const margin = 15; // Increased margin slightly
  
//   // Calculate available space
//   const availableWidth = pageWidth - (2 * margin);
//   const availableHeight = pageHeight - (2 * margin);
  
//   for (let i = 0; i < boardsCount; i++) {
//       if (i > 0) {
//           pdf.addPage('landscape');
//       }
      
//       // Get the specific canvas for this board
//       const canvas = document.getElementById(`cuttingCanvas_${i}`);
      
//       // Calculate scaling to fit A4
//       const scaleX = availableWidth / canvas.width;
//       const scaleY = availableHeight / canvas.height;
//       const scale = Math.min(scaleX, scaleY) * 0.95; // Increased from 0.9 to 0.95
      
//       const scaledWidth = canvas.width * scale;
//       const scaledHeight = canvas.height * scale;
      
//       // Center on page
//       const xOffset = (pageWidth - scaledWidth) / 2;
//       const yOffset = (pageHeight - scaledHeight) / 2;
      
//       // Add to PDF
//       const imgData = canvas.toDataURL('image/png', 1.0);
//       pdf.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight);
//   }
  
//   pdf.save('cutting-diagram.pdf');
// }

