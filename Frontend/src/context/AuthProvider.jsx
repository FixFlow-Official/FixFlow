import { useEffect, useState } from "react";
import { getCurrentUserRequest, refreshAccessTokenRequest } from "../services/api.js";
import AuthContext from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const data = await getCurrentUserRequest();

        if (!cancelled) {
          setUser(data.user);
        }

        const token = await refreshAccessTokenRequest();
        if (!cancelled) {
          setAccessToken(token);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, accessToken, setAccessToken, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}
