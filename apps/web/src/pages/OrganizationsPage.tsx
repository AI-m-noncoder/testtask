import { Badge, Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconBuilding, IconMapPin } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useMyOrganizations } from '../api/queries';
import { StatusState } from '../components/StatusState';
import { errorMessage } from '../lib/errors';
import { moduleLabel, roleColor } from '../lib/format';

export function OrganizationsPage() {
  const organizations = useMyOrganizations();

  return (
    <Stack>
      <Title order={2}>Выберите организацию</Title>

      {organizations.isPending && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={260} />
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
              {org.description && (
                <Text size="sm" c="dimmed" mt="xs">
                  {org.description}
                </Text>
              )}

              <Text size="xs" fw={600} tt="uppercase" c="dimmed" mt="md" mb={6}>
                Филиалы · {org.branches.length}
              </Text>
              <Stack gap={6}>
                {org.branches.map((b) => (
                  <Group key={b.id} gap={8} wrap="nowrap" align="flex-start">
                    <IconMapPin size={16} stroke={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm">{b.name}</Text>
                      {b.address && (
                        <Text size="xs" c="dimmed">
                          {b.address}
                        </Text>
                      )}
                    </div>
                  </Group>
                ))}
              </Stack>

              <Text size="xs" fw={600} tt="uppercase" c="dimmed" mt="md" mb={6}>
                Модули
              </Text>
              <Group gap={6}>
                {org.modules.map((m) => (
                  <Badge key={m} variant="outline" color="gray" size="sm" tt="none">
                    {moduleLabel(m)}
                  </Badge>
                ))}
              </Group>
              {!org.modules.includes('users') && (
                <Text size="xs" c="orange" mt="sm">
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
