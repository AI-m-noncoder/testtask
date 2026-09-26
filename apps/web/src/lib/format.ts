const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

const ROLE_COLORS: Record<string, string> = { admin: 'grape', manager: 'blue', employee: 'gray' };
export const roleColor = (key: string) => ROLE_COLORS[key] ?? 'teal';

/** "1 пользователь", "2 пользователя", "5 пользователей" */
export function pluralUsers(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} пользователь`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} пользователя`;
  return `${n} пользователей`;
}
