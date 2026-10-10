import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { ChatSession, Message } from '@/types';

export const useChatSessions = () => {
  return useQuery({
    queryKey: ['chatSessions'],
    queryFn: () => apiGet<ChatSession[]>('/chat'),
  });
};

export const useChatSession = (id: string) => {
  return useQuery({
    queryKey: ['chatSessions', id],
    queryFn: () => apiGet<ChatSession>(`/chat/${id}`),
    enabled: !!id,
  });
};

export const useChatMessages = (id: string) => {
  return useQuery({
    queryKey: ['chatMessages', id],
    queryFn: () => apiGet<Message[]>(`/chat/${id}/messages`),
    enabled: !!id,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; documentIds: string[] }) => apiPost<ChatSession>('/chat', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: string }) => {
      const result = await apiPost<{ userMessage: Message; assistantMessage: Message } | { jobId: string }>(
        `/chat/${id}/messages`,
        { question }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }
      );
      if (!('jobId' in result)) return result;
      for (let attempt = 0; attempt < 600; attempt++) {
        const job = await apiGet<{ status: string; errorCode?: string; result: { userMessage: Message; assistantMessage: Message } }>(`/jobs/${result.jobId}`);
        if (job.status === 'completed') return job.result;
        if (job.status === 'failed') throw new Error(`Request failed (${job.errorCode || 'JOB_FAILED'}). Please retry.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Request is still queued. Refresh the chat later to check the result.');
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', variables.id] });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/chat/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      queryClient.removeQueries({ queryKey: ['chatSessions', id] });
      queryClient.removeQueries({ queryKey: ['chatMessages', id] });
    },
  });
};
