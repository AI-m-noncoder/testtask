import {
  ActionIcon,
  Avatar,
  Group,
  Menu,
  Skeleton,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconPencil,
  IconSelector,
  IconTrash,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { Member, MemberSortField, SortOrder } from '../../api/types';
import { formatDate } from '../../lib/format';
import { RoleBadge, StatusBadge } from './MemberBadges';

interface MembersTableProps {
  members: Member[];
  sortBy: MemberSortField;
  sortOrder: SortOrder;
  onSort: (field: MemberSortField) => void;
  canEdit: (member: Member) => boolean;
  canDelete: (member: Member) => boolean;
  onOpen: (member: Member) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  meId?: string;
  dimmed?: boolean;
}

function SortHeader(props: {
  field: MemberSortField;
  sortBy: MemberSortField;
  sortOrder: SortOrder;
  onSort: (f: MemberSortField) => void;
  children: ReactNode;
}) {
  const active = props.sortBy === props.field;
  const Icon = !active ? IconSelector : props.sortOrder === 'asc' ? IconChevronUp : IconChevronDown;
  return (
    <Table.Th
      aria-sort={active ? (props.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <UnstyledButton onClick={() => props.onSort(props.field)}>
        <Group gap={4} wrap="nowrap">
          <Text fw={600} size="sm">
            {props.children}
          </Text>
          <Icon size={14} stroke={1.5} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function Header(props: Pick<MembersTableProps, 'sortBy' | 'sortOrder' | 'onSort'>) {
  return (
    <Table.Thead>
      <Table.Tr>
        <SortHeader field="name" {...props}>
          Пользователь
        </SortHeader>
        <SortHeader field="role" {...props}>
          Роль
        </SortHeader>
        <Table.Th>Филиал</Table.Th>
        <Table.Th>Статус</Table.Th>
        <SortHeader field="createdAt" {...props}>
          Добавлен
        </SortHeader>
        <Table.Th w={48} />
      </Table.Tr>
    </Table.Thead>
  );
}

export function MembersTable(props: MembersTableProps) {
  const { members, canEdit, canDelete, onOpen, onEdit, onDelete, meId, dimmed } = props;

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table
        highlightOnHover
        verticalSpacing="sm"
        style={{ opacity: dimmed ? 0.6 : 1, transition: 'opacity 150ms' }}
      >
        <Header {...props} />
        <Table.Tbody>
          {members.map((m) => {
            const editable = canEdit(m);
            const deletable = canDelete(m);
            return (
              <Table.Tr key={m.id} onClick={() => onOpen(m)} style={{ cursor: 'pointer' }}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size={36} radius="xl" color="initials" name={m.name} />
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        {m.name}
                        {m.id === meId && (
                          <Text span c="dimmed" size="xs">
                            {' '}
                            (вы)
                          </Text>
                        )}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {m.email}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <RoleBadge role={m.role} />
                </Table.Td>
                <Table.Td>
                  {m.branch ? (
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm">{m.branch.name}</Text>
                      {m.branch.address && (
                        <Text size="xs" c="dimmed" truncate>
                          {m.branch.address}
                        </Text>
                      )}
                    </div>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Без филиала
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusBadge status={m.status} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(m.joinedAt)}</Text>
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  {(editable || deletable) && (
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Действия: ${m.name}`}
                        >
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {editable && (
                          <Menu.Item
                            leftSection={<IconPencil size={16} />}
                            onClick={() => onEdit(m)}
                          >
                            Изменить
                          </Menu.Item>
                        )}
                        {deletable && (
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => onDelete(m)}
                          >
                            Удалить из организации
                          </Menu.Item>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export function MembersTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table verticalSpacing="sm" aria-busy>
        <Header sortBy="name" sortOrder="asc" onSort={() => {}} />
        <Table.Tbody>
          {Array.from({ length: rows }, (_, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Skeleton circle h={36} />
                  <div>
                    <Skeleton h={12} w={140} mb={6} />
                    <Skeleton h={10} w={180} />
                  </div>
                </Group>
              </Table.Td>
              {[90, 110, 80, 90].map((w, j) => (
                <Table.Td key={j}>
                  <Skeleton h={14} w={w} />
                </Table.Td>
              ))}
              <Table.Td />
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
