import { createContext, useContext } from "react";

// Real login/register/token state lands here in SAHYOG-04.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
