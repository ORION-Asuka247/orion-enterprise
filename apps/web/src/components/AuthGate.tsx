
import { useAuth } from "../lib/auth";
import Login from "../pages/Login";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading ORION…</div>;
  if (!user) return <Login />;
  return <>{children}</>;
}
