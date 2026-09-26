import { ApiError } from '../api/client';

const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Нет соединения с сервером. Проверьте подключение и попробуйте ещё раз.',
  UNAUTHORIZED: 'Сессия истекла. Войдите снова.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  MODULE_DISABLED: 'Модуль «Пользователи» не подключён в этой организации.',
  NOT_FOUND: 'Не найдено. Возможно, данные уже изменились — обновите страницу.',
  ALREADY_MEMBER: 'Этот человек уже состоит в организации.',
  LAST_ADMIN: 'В организации должен остаться хотя бы один активный администратор.',
  ROLE_TOO_HIGH: 'Можно назначать роли и управлять пользователями только ниже своей роли.',
  CONFLICT:
    'Данные изменились одновременно с вашим действием. Обновите страницу и попробуйте снова.',
};

// Validation errors carry an English message from the API; translate the ones users can hit
const VALIDATION_MESSAGES: Record<string, string> = {
  'Branch not found': 'Филиал не найден — возможно, его удалили.',
  'Role not found': 'Роль не найдена — возможно, её удалили.',
  'Name is required for a person without an account':
    'У этого человека ещё нет аккаунта — укажите имя.',
  'Invalid email or password': 'Неверный email или пароль.',
};

/** Human-readable Russian text for any error thrown by the API client */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR' || error.code === 'UNAUTHORIZED') {
      const known = VALIDATION_MESSAGES[error.message];
      if (known) return known;
    }
    if (error.code === 'VALIDATION_ERROR') return 'Проверьте введённые данные.';
    if (MESSAGES[error.code]) return MESSAGES[error.code];
    if (error.status >= 500) return 'Ошибка на сервере. Попробуйте позже.';
  }
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

/** Which form field a validation error refers to ("email must be an email" → "email") */
export function errorField(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return null;
  if (error.message.startsWith('Name is required')) return 'name';
  const [first] = Array.isArray(error.details) ? (error.details as string[]) : [];
  return first?.split(' ')[0] ?? null;
}
