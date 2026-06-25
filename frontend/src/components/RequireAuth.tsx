import { Navigate, Outlet } from 'react-router-dom';
import { getUser } from './Layout';

// Guards protected routes: unauthenticated users are redirected to /login
// instead of rendering pages that would fail to load. `replace` keeps the
// protected URL out of history so browser-back after logout can't return to it.
export default function RequireAuth() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
