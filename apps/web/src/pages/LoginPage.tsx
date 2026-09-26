import {
  Alert,
  Anchor,
  Button,
  Center,
  Code,
  Paper,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { api, tokenStorage } from '../api/client';
import { errorMessage } from '../lib/errors';

const DEMO_ACCOUNTS = [
  {
    email: 'ivan@example.com',
    roles: 'Альфа — админ, Бета — менеджер, Гамма — сотрудник, Дельта — модуль отключён',
  },
  { email: 'maria@example.com', roles: 'Бета — админ' },
  { email: 'oleg@example.com', roles: 'Гамма — админ' },
  { email: 'elena@example.com', roles: 'Альфа — сотрудник' },
];

/** Only same-app paths, so ?redirect= can't send the user to another site */
const safeRedirect = (value: string | null) =>
  value?.startsWith('/') && !value.startsWith('//') ? value : '/orgs';

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Введите email'),
      password: (v) => (v ? null : 'Введите пароль'),
    },
  });

  const login = useMutation({
    mutationFn: (values: typeof form.values) =>
      api<{ accessToken: string }>('/auth/login', { method: 'POST', body: values }),
    onSuccess: ({ accessToken }) => {
      tokenStorage.set(accessToken);
      queryClient.clear();
      navigate(safeRedirect(params.get('redirect')), { replace: true });
    },
  });

  if (tokenStorage.get()) return <Navigate to="/orgs" replace />;

  return (
    <Center mih="100vh" p="md">
      <Stack w="100%" maw={420}>
        <Paper withBorder p="xl" shadow="sm">
          <form onSubmit={form.onSubmit((values) => login.mutate(values))}>
            <Stack>
              <Title order={2}>Вход</Title>
              {login.isError && <Alert color="red">{errorMessage(login.error)}</Alert>}
              <TextInput
                label="Email"
                type="email"
                autoComplete="username"
                autoFocus
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Пароль"
                autoComplete="current-password"
                {...form.getInputProps('password')}
              />
              <Button type="submit" loading={login.isPending} fullWidth>
                Войти
              </Button>
            </Stack>
          </form>
        </Paper>

        <Paper withBorder p="md">
          <Text size="sm" fw={500} mb="xs">
            Демо-аккаунты, пароль <Code>password</Code>
          </Text>
          <Table fz="xs" verticalSpacing={4}>
            <Table.Tbody>
              {DEMO_ACCOUNTS.map((a) => (
                <Table.Tr key={a.email}>
                  <Table.Td>
                    <Anchor
                      component="button"
                      type="button"
                      fz="xs"
                      onClick={() => form.setValues({ email: a.email, password: 'password' })}
                    >
                      {a.email}
                    </Anchor>
                  </Table.Td>
                  <Table.Td c="dimmed">{a.roles}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </Center>
  );
}
