import { Alert, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { ApiError } from '../../api/client';
import { useCreateMember, useUpdateMember } from '../../api/queries';
import type { Branch, Member, RoleOption } from '../../api/types';
import { errorField, errorMessage } from '../../lib/errors';

export type MemberFormMode = { type: 'create' } | { type: 'edit'; member: Member };

interface MemberFormModalProps {
  opened: boolean;
  onClose: () => void;
  orgId: string;
  mode: MemberFormMode;
  roles: RoleOption[];
  branches: Branch[];
}

export function MemberFormModal({ opened, onClose, mode, ...rest }: MemberFormModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode.type === 'create' ? 'Добавить пользователя' : 'Изменить пользователя'}
      centered
    >
      {/* Keyed so the form starts fresh for each member / each opening */}
      <MemberForm
        key={mode.type === 'edit' ? mode.member.id : 'create'}
        mode={mode}
        onDone={onClose}
        {...rest}
      />
    </Modal>
  );
}

const NO_BRANCH = '';

function MemberForm({
  orgId,
  mode,
  roles,
  branches,
  onDone,
}: Omit<MemberFormModalProps, 'opened' | 'onClose'> & { onDone: () => void }) {
  const create = useCreateMember(orgId);
  const update = useUpdateMember(orgId);
  const mutation = mode.type === 'create' ? create : update;
  const editing = mode.type === 'edit' ? mode.member : null;

  // Only roles the current user may assign; lowest one as the default for new members
  const assignable = roles.filter((r) => r.assignable);
  const defaultRole = [...assignable].sort((a, b) => a.level - b.level)[0];

  const form = useForm({
    initialValues: {
      email: '',
      name: '',
      roleId: editing?.role.id ?? defaultRole?.id ?? '',
      branchId: editing?.branch?.id ?? NO_BRANCH,
    },
    validate: {
      email: (v) =>
        editing || /^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Введите корректный email',
      roleId: (v) => (v ? null : 'Выберите роль'),
    },
  });

  const showError = (error: unknown) => {
    const message = errorMessage(error);
    const field =
      error instanceof ApiError && error.code === 'ALREADY_MEMBER' ? 'email' : errorField(error);
    if (field && field in form.values) form.setFieldError(field, message);
    else form.setErrors({ form: message });
  };

  const submit = form.onSubmit((values) => {
    form.clearErrors();
    if (!editing) {
      create.mutate(
        {
          email: values.email.trim(),
          name: values.name.trim() || undefined,
          roleId: values.roleId,
          branchId: values.branchId || undefined,
        },
        {
          onSuccess: (member) => {
            notifications.show({
              color: 'green',
              message:
                member.status === 'invited'
                  ? `${member.name} приглашён(а) в организацию`
                  : `${member.name} добавлен(а) в организацию`,
            });
            onDone();
          },
          onError: showError,
        },
      );
      return;
    }

    // Send only what changed
    const input = {
      ...(values.roleId !== editing.role.id && { roleId: values.roleId }),
      ...(values.branchId !== (editing.branch?.id ?? NO_BRANCH) && {
        branchId: values.branchId || null,
      }),
    };
    if (Object.keys(input).length === 0) return onDone();

    update.mutate(
      { userId: editing.id, input },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Изменения сохранены' });
          onDone();
        },
        onError: showError,
      },
    );
  });

  // The current role stays visible even if it can't be assigned by this user
  const roleOptions = roles
    .filter((r) => r.assignable || r.id === editing?.role.id)
    .map((r) => ({ value: r.id, label: r.name, disabled: !r.assignable }));

  return (
    <form onSubmit={submit}>
      <Stack>
        {form.errors.form && <Alert color="red">{form.errors.form}</Alert>}

        {editing ? (
          <div>
            <Text fw={500}>{editing.name}</Text>
            <Text size="sm" c="dimmed">
              {editing.email}
            </Text>
          </div>
        ) : (
          <>
            <TextInput
              label="Email"
              type="email"
              withAsterisk
              data-autofocus
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Имя"
              description="Нужно, только если у человека ещё нет аккаунта. Имя существующего аккаунта не меняется."
              {...form.getInputProps('name')}
            />
          </>
        )}

        <Select
          label="Роль"
          withAsterisk
          allowDeselect={false}
          data={roleOptions}
          description={
            roles.some((r) => !r.assignable) ? 'Можно назначить только роль ниже своей' : undefined
          }
          {...form.getInputProps('roleId')}
        />
        <Select
          label="Филиал"
          allowDeselect={false}
          data={[
            { value: NO_BRANCH, label: 'Без филиала' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
          {...form.getInputProps('branchId')}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onDone}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
