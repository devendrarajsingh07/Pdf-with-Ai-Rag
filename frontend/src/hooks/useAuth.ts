import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { User } from '@/types';

export const useMe = () => {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<User>('/auth/me'),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => apiPost<{ user: User }>('/auth/login', data, { timeout: 15000 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) => apiPost<User>('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => apiPatch<Pick<User, 'id' | 'email' | 'name'>>('/users/me', data),
    onSuccess: (profile) => {
      queryClient.setQueryData<User>(['me'], previous => previous ? { ...previous, ...profile } : previous);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.clear();
      window.location.href = '/login';
    },
  });
};
