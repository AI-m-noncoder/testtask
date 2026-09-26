import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

import { createTheme, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ApiError, setUnauthorizedHandler } from './api/client';
import { router } from './router';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry only transient failures; 4xx answers won't change on retry
      retry: (count, error) =>
        count < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
  },
});

setUnauthorizedHandler(() => {
  queryClient.clear();
  const redirect = window.location.pathname + window.location.search;
  void router.navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <ModalsProvider labels={{ confirm: 'Подтвердить', cancel: 'Отмена' }}>
          <Notifications position="top-right" />
          <RouterProvider router={router} />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
