import { AppShell, Button, Container, Group, Select, Skeleton, Text, Title } from '@mantine/core';
import { IconLogout, IconUsersGroup } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useParams } from 'react-router';
import { tokenStorage } from '../api/client';
import { useMe, useMyOrganizations } from '../api/queries';

export function AppLayout() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const organizations = useMyOrganizations();

  const logout = () => {
    tokenStorage.clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group gap="md" wrap="nowrap" miw={0}>
              <Group
                gap={6}
                wrap="nowrap"
                renderRoot={(props) => <Link to="/orgs" {...props} />}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <IconUsersGroup size={22} />
                <Title order={4} visibleFrom="sm">
                  B2B Platform
                </Title>
              </Group>
              {orgId && organizations.data && (
                <Select
                  aria-label="Организация"
                  w={{ base: 170, sm: 260 }}
                  value={orgId}
                  allowDeselect={false}
                  data={organizations.data.map((o) => ({ value: o.id, label: o.name }))}
                  onChange={(id) => id && navigate(`/orgs/${id}/users`)}
                />
              )}
            </Group>
            <Group gap="sm" wrap="nowrap">
              {me.isPending ? (
                <Skeleton h={16} w={120} />
              ) : (
                <Text size="sm" c="dimmed" visibleFrom="sm" truncate>
                  {me.data?.name}
                </Text>
              )}
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                leftSection={<IconLogout size={16} />}
                onClick={logout}
              >
                Выйти
              </Button>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={{ base: 0, sm: 'md' }}>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
