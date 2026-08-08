
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthGate from "./components/AuthGate";
import { AuthProvider } from "./lib/auth";
import { TenantProvider } from "./lib/tenant";
import "./styles/app.css";
import "./styles/orion-theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate>
        <TenantProvider>
          <App />
        </TenantProvider>
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
);
