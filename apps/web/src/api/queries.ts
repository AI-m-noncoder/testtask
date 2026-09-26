import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Branch,
  CreateMemberInput,
  Me,
  Member,
  MembersQuery,
  MyOrganization,
  Page,
  RoleOption,
  UpdateMemberInput,
} from './types';

export const queryKeys = {
  me: ['me'] as const,
  myOrganizations: ['me', 'organizations'] as const,
  members: (orgId: string) => ['organizations', orgId, 'members'] as const,
  membersList: (orgId: string, query: MembersQuery) =>
    ['organizations', orgId, 'members', 'list', query] as const,
  member: (orgId: string, userId: string) =>
    ['organizations', orgId, 'members', 'detail', userId] as const,
  roles: (orgId: string) => ['organizations', orgId, 'roles'] as const,
  branches: (orgId: string) => ['organizations', orgId, 'branches'] as const,
};

export const useMe = () => useQuery({ queryKey: queryKeys.me, queryFn: () => api<Me>('/me') });

export const useMyOrganizations = () =>
  useQuery({
    queryKey: queryKeys.myOrganizations,
    queryFn: () => api<MyOrganization[]>('/me/organizations'),
  });

export const useMembers = (orgId: string, query: MembersQuery, enabled = true) =>
  useQuery({
    queryKey: queryKeys.membersList(orgId, query),
    queryFn: () => api<Page<Member>>(`/organizations/${orgId}/users`, { query }),
    // Keep the current page visible while the next page / filter result loads
    placeholderData: keepPreviousData,
    enabled,
  });

export const useMember = (orgId: string, userId: string | null) =>
  useQuery({
    queryKey: queryKeys.member(orgId, userId ?? ''),
    queryFn: () => api<Member>(`/organizations/${orgId}/users/${userId}`),
    enabled: userId !== null,
  });

export const useRoles = (orgId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.roles(orgId),
    queryFn: () => api<RoleOption[]>(`/organizations/${orgId}/roles`),
    staleTime: 5 * 60_000,
    enabled,
  });

export const useBranches = (orgId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.branches(orgId),
    queryFn: () => api<Branch[]>(`/organizations/${orgId}/branches`),
    staleTime: 5 * 60_000,
    enabled,
  });

/** After any change: refresh the list/details, and the current user's own permissions (they may have changed their own role) */
function useInvalidateMembers(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations }),
      queryClient.invalidateQueries({ queryKey: queryKeys.roles(orgId) }),
    ]);
}

export function useCreateMember(orgId: string) {
  const invalidate = useInvalidateMembers(orgId);
  return useMutation({
    mutationFn: (input: CreateMemberInput) =>
      api<Member>(`/organizations/${orgId}/users`, { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateMember(orgId: string) {
  const invalidate = useInvalidateMembers(orgId);
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateMemberInput }) =>
      api<Member>(`/organizations/${orgId}/users/${userId}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteMember(orgId: string) {
  const invalidate = useInvalidateMembers(orgId);
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`/organizations/${orgId}/users/${userId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
