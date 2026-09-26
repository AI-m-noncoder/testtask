import { Navigate, Outlet, useLocation } from 'react-router';
import { tokenStorage } from '../api/client';

/** Sends unauthenticated visitors to /login, remembering where they were going */
export function RequireAuth() {
  const location = useLocation();
  if (!tokenStorage.get()) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}
