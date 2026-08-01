import { useEffect, useMemo, useState } from "react";
import type { Side } from "@xiangqi/contracts";

interface Piece {
  symbol: string;
  coordinate: string;
  side: Side;
}

const labels: Record<string, string> = {
  K: "帅", A: "仕", B: "相", N: "马", R: "车", C: "炮", P: "兵",
  k: "将", a: "士", b: "象", n: "马", r: "车", c: "炮", p: "卒",
};

export function XiangqiBoard({
  fen,
  perspective = "RED",
  legalMoves = [],
  disabled = false,
  lastMove,
  onMove,
}: {
  fen: string;
  perspective?: Side;
  legalMoves?: string[];
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove?: (from: string, to: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const pieces = useMemo(() => parseFen(fen), [fen]);
  const moveSources = useMemo(() => new Set(legalMoves.map((move) => move.slice(0, 2))), [legalMoves]);
  const targets = useMemo(
    () => new Set(legalMoves.filter((move) => move.startsWith(selected ?? "--")).map((move) => move.slice(2, 4))),
    [legalMoves, selected],
  );

  useEffect(() => setSelected(null), [fen]);

  const position = (coordinate: string) => {
    const file = coordinate.charCodeAt(0) - 97;
    const rank = Number(coordinate[1]);
    return perspective === "RED" ? { x: file, y: 9 - rank } : { x: 8 - file, y: rank };
  };

  const activate = (coordinate: string) => {
    if (disabled) return;
    if (selected && targets.has(coordinate)) {
      onMove?.(selected, coordinate);
      setSelected(null);
      return;
    }
    setSelected(moveSources.has(coordinate) ? coordinate : null);
  };

  const highlightCoordinates = new Set([lastMove?.from, lastMove?.to].filter(Boolean));

  return (
    <div className="board-wrap" data-testid="xiangqi-board">
      <svg className="xiangqi-board" viewBox="-0.65 -0.65 9.3 10.3" role="grid" aria-label="中国象棋棋盘">
        <rect className="board-surface" x="-0.62" y="-0.62" width="9.24" height="10.24" rx="0.12" />
        <g className="board-lines">
          {Array.from({ length: 10 }, (_, y) => <line key={`h${y}`} x1="0" y1={y} x2="8" y2={y} />)}
          {Array.from({ length: 9 }, (_, x) => x === 0 || x === 8 ? (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="9" />
          ) : (
            <g key={`v${x}`}><line x1={x} y1="0" x2={x} y2="4" /><line x1={x} y1="5" x2={x} y2="9" /></g>
          ))}
          <line x1="3" y1="0" x2="5" y2="2" /><line x1="5" y1="0" x2="3" y2="2" />
          <line x1="3" y1="7" x2="5" y2="9" /><line x1="5" y1="7" x2="3" y2="9" />
        </g>
        <text className="river-label" x="2" y="4.68" textAnchor="middle">楚 河</text>
        <text className="river-label" x="6" y="4.68" textAnchor="middle">汉 界</text>

        {Array.from({ length: 90 }, (_, index) => {
          const file = index % 9;
          const rank = Math.floor(index / 9);
          const coordinate = `${String.fromCharCode(97 + file)}${rank}`;
          const { x, y } = position(coordinate);
          const target = targets.has(coordinate);
          const source = moveSources.has(coordinate);
          return (
            <g
              key={coordinate}
              className={`board-hit ${source ? "selectable" : ""}`}
              role="gridcell"
              tabIndex={!disabled && (source || target) ? 0 : -1}
              aria-label={`${coordinate}${target ? " 可落子" : ""}`}
              onClick={() => activate(coordinate)}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && activate(coordinate)}
            >
              <circle cx={x} cy={y} r="0.43" fill="transparent" />
              {highlightCoordinates.has(coordinate) && <circle className="last-move" cx={x} cy={y} r="0.32" />}
              {target && <circle className="legal-target" cx={x} cy={y} r="0.13" />}
            </g>
          );
        })}

        {pieces.map((piece) => {
          const { x, y } = position(piece.coordinate);
          const active = selected === piece.coordinate;
          return (
            <g
              key={piece.coordinate}
              className={`piece ${piece.side.toLowerCase()} ${active ? "selected" : ""}`}
              role="button"
              tabIndex={!disabled && moveSources.has(piece.coordinate) ? 0 : -1}
              aria-label={`${piece.coordinate} ${labels[piece.symbol]}`}
              onClick={() => activate(piece.coordinate)}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && activate(piece.coordinate)}
            >
              <circle className="piece-shadow" cx={x + 0.035} cy={y + 0.055} r="0.405" />
              <circle className="piece-disc" cx={x} cy={y} r="0.39" />
              <circle className="piece-ring" cx={x} cy={y} r="0.315" />
              <text x={x} y={y + 0.015} textAnchor="middle" dominantBaseline="central">{labels[piece.symbol]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function parseFen(fen: string): Piece[] {
  const placement = fen.split(" ")[0] ?? "";
  const rows = placement.split("/");
  const pieces: Piece[] = [];
  rows.forEach((row, rowIndex) => {
    let file = 0;
    for (const symbol of row) {
      if (/\d/.test(symbol)) {
        file += Number(symbol);
      } else {
        const rank = 9 - rowIndex;
        pieces.push({
          symbol,
          coordinate: `${String.fromCharCode(97 + file)}${rank}`,
          side: symbol === symbol.toUpperCase() ? "RED" : "BLACK",
        });
        file += 1;
      }
    }
  });
  return pieces;
}
