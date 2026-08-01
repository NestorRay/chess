import { useEffect, useMemo, useRef } from "react";
import { Copy, Flag, Handshake, Home, LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { GameState, Side } from "@xiangqi/contracts";
import { api } from "../api";
import { XiangqiBoard } from "../components/XiangqiBoard";
import { gameSocket } from "../socket";
import { useGameStore } from "../store";

const reasonLabels: Record<string, string> = {
  CHECKMATE: "将死", STALEMATE: "困毙", RESIGNATION: "认输", DRAW_AGREEMENT: "和棋", RULE_DRAW: "规则和棋",
};

export function GamePage() {
  const { gameId = "join" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { game, connection, message, setGame, setConnection, setMessage, reset } = useGameStore();
  const gameIdRef = useRef<string | null>(null);
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(`xiangqi:game:${gameId}`) ?? "null") as { code: string; nickname: string } | null; }
    catch { return null; }
  }, [gameId]);
  const code = (params.get("code") ?? saved?.code ?? "").toUpperCase();
  const nickname = params.get("nickname") ?? saved?.nickname ?? localStorage.getItem("xiangqi:nickname") ?? "";

  useEffect(() => {
    if (!code || !nickname) return;
    reset();
    let active = true;
    const onConnect = () => {
      setConnection("connected");
      gameSocket.emit("game:join", { code, nickname });
    };
    const onDisconnect = () => setConnection("disconnected");
    const onState = (state: GameState) => {
      if (!active) return;
      gameIdRef.current = state.id;
      setGame(state);
      setMessage(null);
      localStorage.setItem(`xiangqi:game:${state.id}`, JSON.stringify({ code: state.code, nickname }));
      if (gameId === "join") navigate(`/game/${state.id}?code=${state.code}&nickname=${encodeURIComponent(nickname)}`, { replace: true });
    };
    const onError = ({ message: nextMessage }: { message: string }) => setMessage(nextMessage);
    const onRejected = ({ reason }: { reason: string }) => {
      setMessage(reason);
      // 局面序号冲突被拒后，主动拉取服务端最新局面，避免玩家手动刷新
      const id = gameIdRef.current;
      if (!id) return;
      void api<GameState>(`/api/games/${id}`).then((state) => {
        if (!active) return;
        setGame(state);
      }).catch(() => { /* 拉取失败时保留 rejected 提示 */ });
    };

    gameSocket.on("connect", onConnect);
    gameSocket.on("disconnect", onDisconnect);
    gameSocket.on("game:state", onState);
    gameSocket.on("move:accepted", onState);
    gameSocket.on("game:ended", onState);
    gameSocket.on("game:error", onError);
    gameSocket.on("move:rejected", onRejected);
    setConnection("connecting");
    void api("/api/auth/me").then(() => {
      if (gameSocket.connected) onConnect(); else gameSocket.connect();
    }).catch((error: Error) => setMessage(error.message));

    return () => {
      active = false;
      gameSocket.off("connect", onConnect);
      gameSocket.off("disconnect", onDisconnect);
      gameSocket.off("game:state", onState);
      gameSocket.off("move:accepted", onState);
      gameSocket.off("game:ended", onState);
      gameSocket.off("game:error", onError);
      gameSocket.off("move:rejected", onRejected);
      gameSocket.disconnect();
    };
  }, [code, gameId, navigate, nickname, reset, setConnection, setGame, setMessage]);

  if (!code || !nickname) {
    return <div className="empty-state"><h1>无法恢复对局</h1><p>缺少对局码或昵称，请从大厅重新加入。</p><Link className="primary-button" to="/"><Home size={18} />返回大厅</Link></div>;
  }

  if (!game) {
    return <div className="loading-state"><LoaderCircle className="spin" size={28} /><h1>正在进入对局 {code}</h1><p>{message ?? "连接服务器并同步棋盘"}</p></div>;
  }

  const player = game.players.find((item) => item.side === game.playerSide);
  const opponent = game.players.find((item) => item.side !== game.playerSide);
  const resultText = game.status === "FINISHED"
    ? game.winner ? `${sideLabel(game.winner)}胜 · ${reasonLabels[game.resultReason ?? ""] ?? "对局结束"}` : "双方和棋"
    : game.status === "WAITING" ? "等待另一位棋手加入" : game.turn === game.playerSide ? "轮到你落子" : "等待对方落子";
  const incomingDraw = game.drawOfferedBy && game.drawOfferedBy !== game.playerSide;

  return (
    <div className="game-layout">
      <section className="game-board-column">
        <div className="opponent-row">
          <PlayerBadge side={opponent?.side ?? opposite(game.playerSide)} name={opponent?.nickname ?? "等待加入"} connected={opponent?.connected ?? false} />
          <span className={`turn-indicator ${game.turn === opponent?.side && game.status === "ACTIVE" ? "active" : ""}`}>{game.turn === opponent?.side ? "思考中" : ""}</span>
        </div>
        <XiangqiBoard
          fen={game.fen}
          perspective={game.playerSide}
          legalMoves={game.legalMoves}
          disabled={game.status !== "ACTIVE" || game.turn !== game.playerSide}
          onMove={(from, to) => gameSocket.emit("move:submit", { gameId: game.id, from, to, expectedPly: game.ply })}
        />
        <div className="opponent-row self">
          <PlayerBadge side={game.playerSide} name={`${player?.nickname ?? nickname}（你）`} connected={connection === "connected"} />
          <span className={`turn-indicator ${game.turn === game.playerSide && game.status === "ACTIVE" ? "active" : ""}`}>{game.turn === game.playerSide ? "请落子" : ""}</span>
        </div>
      </section>

      <aside className="game-sidebar">
        <div className="game-heading">
          <div><span className="section-label">对局码</span><strong className="game-code">{game.code}</strong></div>
          <button className="icon-button" title="复制对局码" onClick={() => navigator.clipboard.writeText(game.code)}><Copy size={19} /></button>
        </div>
        <div className={`connection-line ${connection}`}>
          {connection === "connected" ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connection === "connected" ? "实时连接正常" : "正在重新连接"}
        </div>
        <div className={`game-status status-${game.status.toLowerCase()}`}>
          <span>{game.inCheck && game.status === "ACTIVE" ? "将军" : game.status === "FINISHED" ? "终局" : "当前状态"}</span>
          <strong>{resultText}</strong>
          <small>第 {game.ply + 1} 手 · {sideLabel(game.turn)}行棋</small>
        </div>
        {message && <p className="inline-alert">{message}</p>}
        {incomingDraw && (
          <div className="draw-request">
            <strong>对方请求和棋</strong>
            <div><button className="small-button" onClick={() => gameSocket.emit("game:draw-respond", { gameId: game.id, accept: true })}>接受</button><button className="small-button ghost" onClick={() => gameSocket.emit("game:draw-respond", { gameId: game.id, accept: false })}>拒绝</button></div>
          </div>
        )}
        {game.status === "ACTIVE" && !incomingDraw && (
          <div className="command-row">
            <button className="secondary-button" disabled={game.drawOfferedBy === game.playerSide} onClick={() => gameSocket.emit("game:draw-offer", { gameId: game.id })}><Handshake size={17} />{game.drawOfferedBy ? "已请求和棋" : "请求和棋"}</button>
            <button className="danger-button" onClick={() => window.confirm("确定认输并结束本局吗？") && gameSocket.emit("game:resign", { gameId: game.id })}><Flag size={17} />认输</button>
          </div>
        )}
        {game.replayToken && <Link className="primary-button full" to={`/replay/${game.replayToken}`}>查看本局复盘</Link>}
        <Link className="text-link" to="/history">查看全部对局记录</Link>
      </aside>
    </div>
  );
}

function PlayerBadge({ side, name, connected }: { side: Side; name: string; connected: boolean }) {
  return <div className="player-badge"><span className={`side-token ${side.toLowerCase()}`}>{side === "RED" ? "帅" : "将"}</span><span><strong>{name}</strong><small>{sideLabel(side)} · {connected ? "在线" : "离线"}</small></span></div>;
}

function sideLabel(side: Side) { return side === "RED" ? "红方" : "黑方"; }
function opposite(side: Side): Side { return side === "RED" ? "BLACK" : "RED"; }
