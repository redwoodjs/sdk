"use client";

import React from "react";

const Star = () => <span>⭐</span>;

export function Stars({ level }: { level: number }) {
  const renderStars = (l: number) => {
    const stars = []
    for (let i = 0; i < l; i++) {
      stars.push(<Star key={`full-${i}`}  />)
    }
    return stars
  }
  return (
    <div>
      <h3>Stars (Issue #471 Repro)</h3>
      <div id="stars-container">
        {renderStars(level)}
      </div>
    </div>
  );
}

