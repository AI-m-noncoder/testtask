import { Button, Group, Select, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import type { Branch, MembersQuery, RoleOption } from '../../api/types';

interface MembersFiltersProps {
  query: MembersQuery;
  search: string;
  onSearchChange: (value: string) => void;
  roles: RoleOption[];
  branches: Branch[];
  hasFilters: boolean;
  onChange: (patch: Partial<MembersQuery>) => void;
  onReset: () => void;
}

export function MembersFilters(props: MembersFiltersProps) {
  const { query, search, onSearchChange, roles, branches, hasFilters, onChange, onReset } = props;

  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
      <TextInput
        aria-label="Поиск"
        placeholder="Поиск по имени или email"
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <IconX
              size={14}
              style={{ cursor: 'pointer' }}
              onClick={() => onSearchChange('')}
              aria-label="Очистить поиск"
            />
          ) : null
        }
        value={search}
        onChange={(e) => onSearchChange(e.currentTarget.value)}
        style={{ flex: '1 1 240px' }}
      />
      <Select
        aria-label="Роль"
        placeholder="Все роли"
        clearable
        data={roles.map((r) => ({ value: r.id, label: r.name }))}
        value={query.roleId ?? null}
        onChange={(v) => onChange({ roleId: v ?? undefined })}
        w={{ base: '100%', xs: 170 }}
      />
      <Select
        aria-label="Филиал"
        placeholder="Все филиалы"
        clearable
        data={[
          { value: 'none', label: 'Без филиала' },
          ...branches.map((b) => ({ value: b.id, label: b.name })),
        ]}
        value={query.branchId ?? null}
        onChange={(v) => onChange({ branchId: v ?? undefined })}
        w={{ base: '100%', xs: 180 }}
      />
      <Select
        aria-label="Статус"
        placeholder="Любой статус"
        clearable
        data={[
          { value: 'active', label: 'Активные' },
          { value: 'invited', label: 'Приглашённые' },
        ]}
        value={query.status ?? null}
        onChange={(v) => onChange({ status: (v as MembersQuery['status']) ?? undefined })}
        w={{ base: '100%', xs: 170 }}
      />
      {hasFilters && (
        <Button variant="subtle" color="gray" onClick={onReset}>
          Сбросить
        </Button>
      )}
    </Group>
  );
}
