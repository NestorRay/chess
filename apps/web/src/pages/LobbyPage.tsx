import { useState, type FormEvent } from "react";
import { ArrowRight, Plus, Swords } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

interface CreatedGame { id: string; code: string; replayToken: string }

export function LobbyPage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => localStorage.getItem("xiangqi:nickname") ?? "");
  const [code, setCode] = useState("");
  const createGame = useMutation({
    mutationFn: () => api<CreatedGame>("/api/games", { method: "POST", body: JSON.stringify({ nickname }) }),
    onSuccess: (game) => enter(game.id, game.code),
  });

  const remember = () => localStorage.setItem("xiangqi:nickname", nickname.trim());
  const enter = (gameId: string, gameCode: string) => {
    remember();
    localStorage.setItem(`xiangqi:game:${gameId}`, JSON.stringify({ code: gameCode, nickname: nickname.trim() }));
    navigate(`/game/${gameId}?code=${gameCode}&nickname=${encodeURIComponent(nickname.trim())}`);
  };
  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!nickname.trim() || code.length !== 6) return;
    remember();
    navigate(`/game/join?code=${code}&nickname=${encodeURIComponent(nickname.trim())}`);
  };

  return (
    <div className="lobby-layout">
      <section className="lobby-intro">
        <div className="eyebrow"><Swords size={17} />实时双人对局</div>
        <h1>楚河棋局</h1>
        <p>创建一盘棋，或输入朋友发来的六位对局码。规则校验、胜负判断与棋谱保存均由服务器完成。</p>
        <div className="rule-strip" aria-label="对局能力">
          <span>双端实时同步</span><span>完整象棋规则</span><span>自动保存复盘</span>
        </div>
      </section>

      <section className="lobby-panel" aria-labelledby="start-title">
        <h2 id="start-title">开始对局</h2>
        <label className="field-label">你的昵称
          <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} placeholder="例如：棋友小王" autoComplete="nickname" />
        </label>
        <button className="primary-button full" disabled={!nickname.trim() || createGame.isPending} onClick={() => createGame.mutate()}>
          <Plus size={19} />{createGame.isPending ? "正在创建" : "创建新对局"}
        </button>
        {createGame.error && <p className="form-error">{createGame.error.message}</p>}
        <div className="divider"><span>或者加入已有对局</span></div>
        <form onSubmit={join} className="join-form">
          <label className="field-label">六位对局码
            <input
              className="code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^23456789A-HJ-NP-Z]/g, "").slice(0, 6))}
              placeholder="Q7M4KR"
              inputMode="text"
              autoCapitalize="characters"
            />
          </label>
          <button className="secondary-button full" disabled={!nickname.trim() || code.length !== 6}>
            加入对局<ArrowRight size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}
