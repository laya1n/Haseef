// src/routes/Protected.tsx
import { Navigate } from "react-router-dom";

export default function Protected({ children }: { children: JSX.Element }) {
  const authed = !!localStorage.getItem("haseef_auth");
  return authed ? children : <Navigate to="/login" replace />;
}
