import { Badge, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useMyOrganizations } from '../api/queries';
import { StatusState } from '../components/StatusState';
import { errorMessage } from '../lib/errors';
import { roleColor } from '../lib/format';

export function OrganizationsPage() {
  const organizations = useMyOrganizations();

  return (
    <Stack>
      <Title order={2}>Выберите организацию</Title>

      {organizations.isPending && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={96} />
          ))}
        </SimpleGrid>
      )}

      {organizations.isError && (
        <StatusState
          kind="error"
          title="Не удалось загрузить организации"
          description={errorMessage(organizations.error)}
          onRetry={() => organizations.refetch()}
        />
      )}

      {organizations.data?.length === 0 && (
        <StatusState
          kind="notFound"
          title="Вы пока не состоите ни в одной организации"
          description="Попросите администратора организации добавить вас."
        />
      )}

      {organizations.data && organizations.data.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {organizations.data.map((org) => (
            <Card
              key={org.id}
              component={Link}
              to={`/orgs/${org.id}/users`}
              withBorder
              padding="lg"
              style={{ textDecoration: 'none' }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap="sm" wrap="nowrap" miw={0}>
                  <IconBuilding size={22} stroke={1.5} />
                  <Text fw={600} truncate>
                    {org.name}
                  </Text>
                </Group>
                <Badge color={roleColor(org.role.key)} variant="light">
                  {org.role.name}
                </Badge>
              </Group>
              {!org.modules.includes('users') && (
                <Text size="xs" c="dimmed" mt="sm">
                  Модуль «Пользователи» не подключён
                </Text>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
