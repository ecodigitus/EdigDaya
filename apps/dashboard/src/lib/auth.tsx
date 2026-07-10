import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setToken, setUnauthorizedHandler } from "./api";

export type Role = "pengurus" | "anggota";

export type Session = {
  sub: string;
  role: Role;
  koperasi_ref: string;
  anggota_ref?: string;
  nama?: string;
  exp: number;
};

export type LoginPayload =
  | { role: "pengurus"; koperasi_ref: string }
  | { role: "anggota"; anggota_ref: string };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<Session>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
    let alive = true;
    (async () => {
      try {
        const r = await api<{ session: Session | null }>("/api/auth/me");
        if (alive) setSession(r.session);
      } catch {
        if (alive) setSession(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = async (payload: LoginPayload): Promise<Session> => {
    const r = await api<{ token: string; session: Session }>("/api/auth/login", {
      method: "POST",
      body: payload,
    });
    setToken(r.token);
    setSession(r.session);
    return r.session;
  };

  const logout = () => {
    setToken(null);
    setSession(null);
  };

  return <Ctx.Provider value={{ session, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
