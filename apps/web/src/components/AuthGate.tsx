
import { useAuth } from "../lib/auth";
import PasswordSetup from "../pages/PasswordSetup";
import Login from "../pages/Login";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, passwordSetup } = useAuth();
  if (loading) return <div className="loading">Loading ORION…</div>;
  if (!user) return <Login />;
  if(passwordSetup)return <PasswordSetup/>;
  return <>{children}</>;
}
