import { createBrowserRouter, Navigate } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrganizationsPage } from './pages/OrganizationsPage';
import { UsersPage } from './pages/users/UsersPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/orgs" replace /> },
          { path: 'orgs', element: <OrganizationsPage /> },
          { path: 'orgs/:orgId/users', element: <UsersPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
