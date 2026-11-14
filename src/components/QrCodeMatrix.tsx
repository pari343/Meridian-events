import React from 'react';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
}

export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({ value, size = 104 }) => {
  const grid = 21;
  const cells: boolean[] = [];

  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinderZone = (r: number, c: number) => {
    const inTopLeft = r < 7 && c < 7;
    const inTopRight = r < 7 && c >= grid - 7;
    const inBottomLeft = r >= grid - 7 && c < 7;
    return inTopLeft || inTopRight || inBottomLeft;
  };

  const isFinderFilled = (r: number, c: number) => {
    const lr = r >= grid - 7 ? r - (grid - 7) : r;
    const lc = c >= grid - 7 ? c - (grid - 7) : c;
    if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
    if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
    return false;
  };

  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (isFinderZone(r, c)) {
        cells.push(isFinderFilled(r, c));
      } else {
        hash ^= (r * 31 + c * 17) & 0xff;
        hash = Math.imul(hash, 16777619);
        cells.push((hash >>> 28) % 2 === 0);
      }
    }
  }

  const cellSize = size / grid;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Verification matrix for ${value}`}
      className="bg-white p-1.5 border border-slate-200 rounded-md shrink-0"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {cells.map((filled, idx) => {
        if (!filled) return null;
        const r = Math.floor(idx / grid);
        const c = idx % grid;
        return (
          <rect
            key={idx}
            x={c * cellSize}
            y={r * cellSize}
            width={cellSize + 0.15}
            height={cellSize + 0.15}
            fill="#0f172a"
          />
        );
      })}
    </svg>
  );
};
