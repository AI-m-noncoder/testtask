import { Badge } from '@mantine/core';
import type { Member } from '../../api/types';
import { roleColor } from '../../lib/format';

export const RoleBadge = ({ role }: { role: Member['role'] }) => (
  <Badge color={roleColor(role.key)} variant="light">
    {role.name}
  </Badge>
);

export const StatusBadge = ({ status }: { status: Member['status'] }) =>
  status === 'invited' ? (
    <Badge color="yellow" variant="outline">
      Приглашён
    </Badge>
  ) : (
    <Badge color="green" variant="dot">
      Активен
    </Badge>
  );
