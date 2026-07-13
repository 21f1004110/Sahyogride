import { createContext, useContext, useMemo, useState } from "react";

import * as authApi from "../api/auth";
import { TOKEN_STORAGE_KEY } from "../api/client";

const USER_STORAGE_KEY = "sahyogride_user";

const AuthContext = createContext(null);

function readStoredUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  function persist(token, user) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    setUser(user);
  }

  async function register(fields) {
    const data = await authApi.register(fields);
    persist(data.token, data.user);
    return data.user;
  }

  async function login(fields) {
    const data = await authApi.login(fields);
    persist(data.token, data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, register, login, logout }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
