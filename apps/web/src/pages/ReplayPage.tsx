import { useEffect, useState } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, LoaderCircle, RotateCcw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReplayData } from "@xiangqi/contracts";
import { api } from "../api";
import { XiangqiBoard } from "../components/XiangqiBoard";

export function ReplayPage() {
  const { token = "" } = useParams();
  const [step, setStep] = useState(0);
  const { data, isLoading, error } = useQuery({ queryKey: ["replay", token], queryFn: () => api<ReplayData>(`/api/replays/${token}`) });
  useEffect(() => setStep(data?.moves.length ?? 0), [data]);
  if (isLoading) return <div className="loading-state"><LoaderCircle className="spin" /><h1>正在载入棋谱</h1></div>;
  if (error || !data) return <div className="empty-state"><h1>无法打开复盘</h1><p>{error?.message ?? "棋谱不存在"}</p><Link className="primary-button" to="/history">返回记录</Link></div>;

  const move = step > 0 ? data.moves[step - 1] : null;
  const fen = move?.fenAfter ?? data.initialFen;
  return (
    <div className="replay-layout">
      <section className="game-board-column">
        <div className="replay-heading"><div><span className="section-label">棋谱复盘 · {data.code}</span><h1>{data.players.find((item) => item.side === "RED")?.nickname ?? "红方"} 对 {data.players.find((item) => item.side === "BLACK")?.nickname ?? "黑方"}</h1></div><span className="step-count">{step} / {data.moves.length}</span></div>
        <XiangqiBoard fen={fen} lastMove={move ? { from: move.from, to: move.to } : null} disabled />
        <div className="replay-controls" aria-label="复盘控制">
          <button className="icon-button" title="回到开局" onClick={() => setStep(0)} disabled={step === 0}><ChevronFirst /></button>
          <button className="icon-button" title="上一步" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ChevronLeft /></button>
          <button className="icon-button" title="下一步" onClick={() => setStep((value) => Math.min(data.moves.length, value + 1))} disabled={step === data.moves.length}><ChevronRight /></button>
          <button className="icon-button" title="前往终局" onClick={() => setStep(data.moves.length)} disabled={step === data.moves.length}><ChevronLast /></button>
        </div>
      </section>
      <aside className="move-panel">
        <div className="game-heading"><div><span className="section-label">着法列表</span><strong>{data.status === "FINISHED" ? data.winner ? `${data.winner === "RED" ? "红方" : "黑方"}胜` : "和棋" : "未结束"}</strong></div><RotateCcw size={20} /></div>
        <ol className="move-list">
          {data.moves.map((item) => <li key={item.ply}><button className={step === item.ply ? "active" : ""} onClick={() => setStep(item.ply)}><span>{item.ply}</span><strong>{item.notation || `${item.from}-${item.to}`}</strong><small>{item.from} → {item.to}</small></button></li>)}
        </ol>
      </aside>
    </div>
  );
}
