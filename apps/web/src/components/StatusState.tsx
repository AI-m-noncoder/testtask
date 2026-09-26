import { Button, EmptyState } from '@mantine/core';
import {
  IconAlertTriangle,
  IconLock,
  IconPlugConnectedX,
  IconSearchOff,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';

const ICONS = {
  error: IconAlertTriangle,
  forbidden: IconLock,
  disabled: IconPlugConnectedX,
  notFound: IconSearchOff,
};

interface StatusStateProps {
  kind: keyof typeof ICONS;
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}

/** Full-area message for error / no-access / not-found situations */
export function StatusState({ kind, title, description, onRetry, action }: StatusStateProps) {
  const Icon = ICONS[kind];
  return (
    <EmptyState
      py="xl"
      color={kind === 'error' ? 'red' : 'gray'}
      icon={<Icon size={28} stroke={1.5} />}
      title={title}
      description={description}
    >
      {(onRetry || action) && (
        <EmptyState.Actions>
          {onRetry && (
            <Button variant="light" onClick={onRetry}>
              Повторить
            </Button>
          )}
          {action}
        </EmptyState.Actions>
      )}
    </EmptyState>
  );
}
