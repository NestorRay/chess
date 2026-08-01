import { useState } from "react";
import { History, LogIn, LogOut } from "lucide-react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@xiangqi/contracts";
import { api } from "./api";
import { AuthDialog } from "./components/AuthDialog";
import { GamePage } from "./pages/GamePage";
import { HistoryPage } from "./pages/HistoryPage";
import { LobbyPage } from "./pages/LobbyPage";
import { ReplayPage } from "./pages/ReplayPage";

export function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: AuthUser | null }>("/api/auth/me"),
  });
  const logout = useMutation({
    mutationFn: () => api("/api/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="返回对局大厅">
          <span className="brand-mark">楚</span>
          <span><strong>楚河棋局</strong><small>在线中国象棋</small></span>
        </Link>
        <nav className="top-actions" aria-label="主导航">
          <Link className="icon-text-button ghost" to="/history"><History size={18} />对局记录</Link>
          {data?.user ? (
            <button className="icon-text-button ghost" onClick={() => logout.mutate()} title="退出登录">
              <LogOut size={18} />{data.user.username}
            </button>
          ) : (
            <button className="icon-text-button ghost" onClick={() => setAuthOpen(true)}>
              <LogIn size={18} />登录
            </button>
          )}
        </nav>
      </header>
      <main className="page-frame">
        <Routes>
          <Route path="/" element={<LobbyPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/replay/:token" element={<ReplayPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
