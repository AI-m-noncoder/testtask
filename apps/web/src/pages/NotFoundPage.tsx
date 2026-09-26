import { Button } from '@mantine/core';
import { Link } from 'react-router';
import { StatusState } from '../components/StatusState';

export function NotFoundPage() {
  return (
    <StatusState
      kind="notFound"
      title="Страница не найдена"
      action={
        <Button component={Link} to="/orgs" variant="light">
          К организациям
        </Button>
      }
    />
  );
}
