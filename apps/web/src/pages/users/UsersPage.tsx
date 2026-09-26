import {
  Button,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconUserPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import {
  useBranches,
  useDeleteMember,
  useMe,
  useMembers,
  useMyOrganizations,
  useRoles,
} from '../../api/queries';
import type { Member, MemberSortField, MyOrganization } from '../../api/types';
import { StatusState } from '../../components/StatusState';
import { can, canManageLevel, Permission } from '../../lib/access';
import { errorMessage } from '../../lib/errors';
import { pluralUsers } from '../../lib/format';
import { MemberDrawer } from './MemberDrawer';
import { type MemberFormMode, MemberFormModal } from './MemberFormModal';
import { MembersFilters } from './MembersFilters';
import { MembersTable, MembersTableSkeleton } from './MembersTable';
import { PAGE_SIZES, useMembersParams } from './useMembersParams';

const backToOrgs = (
  <Button component={Link} to="/orgs" variant="light">
    К списку организаций
  </Button>
);

/**
 * Checks access from /me/organizations before calling the users API, so the page
 * explains *why* there is no access. The API enforces the same rules regardless.
 */
export function UsersPage() {
  const { orgId = '' } = useParams();
  const organizations = useMyOrganizations();
  const org = organizations.data?.find((o) => o.id === orgId);

  if (organizations.isPending) {
    return (
      <Stack>
        <Skeleton h={36} w={240} />
        <MembersTableSkeleton />
      </Stack>
    );
  }
  if (organizations.isError) {
    return (
      <StatusState
        kind="error"
        title="Не удалось загрузить данные"
        description={errorMessage(organizations.error)}
        onRetry={() => organizations.refetch()}
      />
    );
  }
  if (!org) {
    return (
      <StatusState
        kind="notFound"
        title="Организация не найдена"
        description="Такой организации нет или вы в ней не состоите."
        action={backToOrgs}
      />
    );
  }
  if (!org.modules.includes('users')) {
    return (
      <StatusState
        kind="disabled"
        title="Модуль «Пользователи» не подключён"
        description={`Организация «${org.name}» не подключила этот модуль.`}
        action={backToOrgs}
      />
    );
  }
  if (!can(org, Permission.UsersRead)) {
    return (
      <StatusState
        kind="forbidden"
        title="Нет доступа к пользователям"
        description={`Ваша роль в организации «${org.name}» — ${org.role.name}. Она не позволяет просматривать пользователей.`}
        action={backToOrgs}
      />
    );
  }

  // Keyed: switching organization resets modal / drawer state
  return <MembersView key={org.id} org={org} />;
}

function MembersView({ org }: { org: MyOrganization }) {
  const navigate = useNavigate();
  const me = useMe();
  const {
    query,
    update,
    hasFilters,
    resetFilters,
    searchInput,
    setSearchInput,
    selectedMemberId,
    setSelectedMember,
  } = useMembersParams();
  const members = useMembers(org.id, query);
  const roles = useRoles(org.id);
  const branches = useBranches(org.id);
  const deleteMember = useDeleteMember(org.id);

  const [formOpened, setFormOpened] = useState(false);
  const [formMode, setFormMode] = useState<MemberFormMode>({ type: 'create' });

  // What the UI offers mirrors the API rules: permission + role hierarchy
  const canCreate = can(org, Permission.UsersCreate);
  const canEdit = (m: Member) =>
    can(org, Permission.UsersUpdate) && canManageLevel(org.role.level, m.role.level);
  const canDelete = (m: Member) =>
    can(org, Permission.UsersDelete) && canManageLevel(org.role.level, m.role.level);

  const openCreate = () => {
    setFormMode({ type: 'create' });
    setFormOpened(true);
  };
  const openEdit = (member: Member) => {
    setFormMode({ type: 'edit', member });
    setFormOpened(true);
  };

  const confirmDelete = (member: Member) => {
    const isMe = member.id === me.data?.id;
    modals.openConfirmModal({
      title: isMe ? 'Покинуть организацию?' : 'Удалить из организации?',
      centered: true,
      children: (
        <Text size="sm">
          {isMe
            ? `Вы потеряете доступ к организации «${org.name}».`
            : `${member.name} потеряет доступ к организации «${org.name}».`}{' '}
          Аккаунт и доступ к другим организациям сохранятся. Добавить человека обратно можно по
          email.
        </Text>
      ),
      labels: { confirm: isMe ? 'Покинуть' : 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        // Close the details first so they don't refetch a member that's about to be gone
        if (selectedMemberId === member.id) setSelectedMember(null);
        deleteMember.mutate(member.id, {
          onSuccess: () => {
            notifications.show({
              color: 'green',
              message: `${member.name} удалён(а) из организации`,
            });
            if (isMe) navigate('/orgs');
          },
          onError: (error) =>
            notifications.show({
              color: 'red',
              title: 'Не удалось удалить',
              message: errorMessage(error),
            }),
        });
      },
    });
  };

  const onSort = (field: MemberSortField) =>
    update({
      sortBy: field,
      sortOrder: query.sortBy === field && query.sortOrder === 'asc' ? 'desc' : 'asc',
    });

  // Deleting the last row of the last page would leave an empty page: step back
  const data = members.data;
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && query.page > 1) {
      update({ page: Math.ceil(data.total / query.pageSize) });
    }
  }, [data, query.page, query.pageSize, update]);

  const pages = data ? Math.max(1, Math.ceil(data.total / query.pageSize)) : 1;
  const from = data ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = data ? Math.min(query.page * query.pageSize, data.total) : 0;

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Пользователи</Title>
          <Text c="dimmed" size="sm">
            {org.name}
            {data && !hasFilters && ` · ${pluralUsers(data.total)}`}
          </Text>
        </div>
        {canCreate && (
          <Button
            leftSection={<IconUserPlus size={18} />}
            onClick={openCreate}
            disabled={!roles.data}
          >
            Добавить пользователя
          </Button>
        )}
      </Group>

      <MembersFilters
        query={query}
        search={searchInput}
        onSearchChange={setSearchInput}
        roles={roles.data ?? []}
        branches={branches.data ?? []}
        hasFilters={hasFilters}
        onChange={update}
        onReset={resetFilters}
      />

      <Paper withBorder>
        {members.isPending ? (
          <MembersTableSkeleton />
        ) : members.isError ? (
          <MembersError error={members.error} onRetry={() => members.refetch()} />
        ) : data!.total === 0 ? (
          hasFilters ? (
            <StatusState
              kind="notFound"
              title="Никого не найдено"
              description="Попробуйте изменить запрос или сбросить фильтры."
              action={
                <Button variant="light" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <StatusState
              kind="notFound"
              title="В организации пока нет пользователей"
              action={
                canCreate && (
                  <Button leftSection={<IconUserPlus size={18} />} onClick={openCreate}>
                    Добавить первого
                  </Button>
                )
              }
            />
          )
        ) : (
          <MembersTable
            members={data!.items}
            sortBy={query.sortBy}
            sortOrder={query.sortOrder}
            onSort={onSort}
            canEdit={canEdit}
            canDelete={canDelete}
            onOpen={(m) => setSelectedMember(m.id)}
            onEdit={openEdit}
            onDelete={confirmDelete}
            meId={me.data?.id}
            dimmed={members.isPlaceholderData}
          />
        )}
      </Paper>

      {data && data.total > 0 && (
        <Group justify="space-between" gap="sm">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {from}–{to} из {data.total}
            </Text>
            <Select
              aria-label="Строк на странице"
              size="xs"
              w={80}
              allowDeselect={false}
              data={PAGE_SIZES.map(String)}
              value={String(query.pageSize)}
              onChange={(v) => v && update({ pageSize: Number(v) })}
            />
          </Group>
          <Pagination
            total={pages}
            value={Math.min(query.page, pages)}
            onChange={(page) => update({ page })}
            size="sm"
          />
        </Group>
      )}

      <MemberFormModal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        orgId={org.id}
        mode={formMode}
        roles={roles.data ?? []}
        branches={branches.data ?? []}
      />

      <MemberDrawer
        orgId={org.id}
        userId={selectedMemberId}
        onClose={() => setSelectedMember(null)}
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />
    </Stack>
  );
}

/** API-level denials can still happen (e.g. access revoked while the page was open) */
function MembersError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  if (error instanceof ApiError && error.code === 'NOT_FOUND') {
    return (
      <StatusState
        kind="notFound"
        title="Нет доступа к организации"
        description={errorMessage(error)}
        action={backToOrgs}
      />
    );
  }
  if (
    error instanceof ApiError &&
    (error.code === 'FORBIDDEN' || error.code === 'MODULE_DISABLED')
  ) {
    return (
      <StatusState
        kind="forbidden"
        title="Нет доступа"
        description={errorMessage(error)}
        action={backToOrgs}
      />
    );
  }
  return (
    <StatusState
      kind="error"
      title="Не удалось загрузить пользователей"
      description={errorMessage(error)}
      onRetry={onRetry}
    />
  );
}
