import {
  Avatar,
  Button,
  Divider,
  Drawer,
  getDefaultZIndex,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../api/client';
import { useMember } from '../../api/queries';
import type { Member } from '../../api/types';
import { StatusState } from '../../components/StatusState';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { RoleBadge, StatusBadge } from './MemberBadges';

interface MemberDrawerProps {
  orgId: string;
  userId: string | null;
  onClose: () => void;
  canEdit: (member: Member) => boolean;
  canDelete: (member: Member) => boolean;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <Text size="xs" c="dimmed" mb={4}>
      {label}
    </Text>
    {children}
  </div>
);

/** Member details, loaded from GET /users/:userId so they're fresh even if the list is stale */
export function MemberDrawer({
  orgId,
  userId,
  onClose,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: MemberDrawerProps) {
  const member = useMember(orgId, userId);

  return (
    <Drawer
      opened={userId !== null}
      onClose={onClose}
      position="right"
      title="Информация о пользователе"
      size="md"
      // One layer below modals: edit and delete confirmation open on top of the drawer
      zIndex={getDefaultZIndex('modal') - 1}
    >
      {member.isPending && (
        <Stack>
          <Group>
            <Skeleton circle h={64} />
            <div>
              <Skeleton h={18} w={180} mb={8} />
              <Skeleton h={12} w={220} />
            </div>
          </Group>
          <Skeleton h={120} />
        </Stack>
      )}

      {member.isError &&
        (member.error instanceof ApiError && member.error.code === 'NOT_FOUND' ? (
          <StatusState
            kind="notFound"
            title="Пользователь не найден"
            description="Возможно, его уже удалили из организации."
          />
        ) : (
          <StatusState
            kind="error"
            title="Не удалось загрузить данные"
            description={errorMessage(member.error)}
            onRetry={() => member.refetch()}
          />
        ))}

      {member.data && (
        <Stack gap="lg">
          <Group wrap="nowrap">
            <Avatar size={64} radius="xl" color="initials" name={member.data.name} />
            <div style={{ minWidth: 0 }}>
              <Title order={3} style={{ wordBreak: 'break-word' }}>
                {member.data.name}
              </Title>
              <Text c="dimmed" style={{ wordBreak: 'break-all' }}>
                {member.data.email}
              </Text>
            </div>
          </Group>

          <Divider />

          <SimpleGrid cols={2} spacing="lg">
            <Field label="Роль">
              <RoleBadge role={member.data.role} />
            </Field>
            <Field label="Статус">
              <StatusBadge status={member.data.status} />
            </Field>
            <Field label="Филиал">
              {member.data.branch ? (
                <>
                  <Text size="sm">{member.data.branch.name}</Text>
                  {member.data.branch.address && (
                    <Text size="xs" c="dimmed">
                      {member.data.branch.address}
                    </Text>
                  )}
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Без филиала
                </Text>
              )}
            </Field>
            <Field label="Добавлен в организацию">
              <Text size="sm">{formatDateTime(member.data.joinedAt)}</Text>
            </Field>
            <Field label="Последнее изменение">
              <Text size="sm">{formatDateTime(member.data.updatedAt)}</Text>
            </Field>
          </SimpleGrid>

          {member.data.status === 'invited' && (
            <Text size="sm" c="dimmed">
              Аккаунт создан при добавлении в организацию, но человек ещё не задал пароль и не
              входил в систему.
            </Text>
          )}

          {(canEdit(member.data) || canDelete(member.data)) && (
            <>
              <Divider />
              <Group>
                {canEdit(member.data) && (
                  <Button
                    leftSection={<IconPencil size={16} />}
                    variant="light"
                    onClick={() => onEdit(member.data)}
                  >
                    Изменить
                  </Button>
                )}
                {canDelete(member.data) && (
                  <Button
                    leftSection={<IconTrash size={16} />}
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(member.data)}
                  >
                    Удалить из организации
                  </Button>
                )}
              </Group>
            </>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
