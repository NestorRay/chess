import { CalendarClock, ChevronRight, History, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { GameSummary } from "@xiangqi/contracts";
import { api } from "../api";

const reasons: Record<string, string> = { CHECKMATE: "将死", STALEMATE: "困毙", RESIGNATION: "认输", DRAW_AGREEMENT: "协议和棋", RULE_DRAW: "规则和棋" };

export function HistoryPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["history"], queryFn: () => api<GameSummary[]>("/api/history") });
  return (
    <section className="history-page">
      <div className="page-title"><div><span className="section-label">棋谱档案</span><h1>对局记录</h1></div><History size={28} /></div>
      {isLoading && <div className="loading-inline"><LoaderCircle className="spin" />正在读取棋谱</div>}
      {error && <p className="inline-alert">{error.message}</p>}
      {data?.length === 0 && <div className="empty-state compact"><CalendarClock size={32} /><h2>还没有对局记录</h2><Link className="primary-button" to="/">开始第一局</Link></div>}
      <div className="history-list">
        {data?.map((game) => {
          const outcome = game.status !== "FINISHED" ? (game.status === "WAITING" ? "等待加入" : "进行中")
            : !game.winner ? "和棋" : game.winner === game.playerSide ? "胜" : "负";
          const destination = game.replayToken
            ? `/replay/${game.replayToken}`
            : `/game/${game.id}?code=${game.code}&nickname=${encodeURIComponent(game.nickname)}`;
          return (
            <Link className="history-row" key={game.id} to={destination}>
              <span className={`result-badge result-${outcome}`}>{outcome}</span>
              <span className="history-main"><strong>对阵 {game.opponent ?? "等待对手"}</strong><small>{game.code} · 你执{game.playerSide === "RED" ? "红" : "黑"}{game.resultReason ? ` · ${reasons[game.resultReason]}` : ""}</small></span>
              <time>{new Date(game.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
              <ChevronRight size={19} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
