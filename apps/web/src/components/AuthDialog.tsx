import { useState, type FormEvent } from "react";
import { LogIn, UserPlus, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@xiangqi/contracts";
import { api } from "../api";

export function AuthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api<AuthUser>(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["history"] });
      onClose();
    },
  });

  if (!open) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="icon-button dialog-close" onClick={onClose} title="关闭"><X size={20} /></button>
        <div className="segmented-control">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>注册</button>
        </div>
        <h2 id="auth-title">{mode === "login" ? "登录账号" : "创建账号"}</h2>
        <form className="stack-form" onSubmit={submit}>
          <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} autoFocus required /></label>
          <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
          {mutation.error && <p className="form-error">{mutation.error.message}</p>}
          <button className="primary-button" disabled={mutation.isPending}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mutation.isPending ? "请稍候" : mode === "login" ? "登录" : "注册并归档游客对局"}
          </button>
        </form>
      </section>
    </div>
  );
}
