import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Document, DocumentAnalysis } from '@/types';

export const useDocuments = () => {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => apiGet<Document[]>('/documents'),
    refetchInterval: (query) => query.state.data?.some(
      document => document.status === 'processing' || document.status === 'pending'
    ) ? 3000 : false,
  });
};

export const useDocument = (id: string) => {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => apiGet<Document>(`/documents/${id}`),
    enabled: !!id,
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => {
      return apiPost<Document>('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': crypto.randomUUID() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/documents/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.removeQueries({ queryKey: ['documents', id] });
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });
};

export const useReindexDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/documents/${id}/reindex`, undefined, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      queryClient.invalidateQueries({ queryKey: ['documents', id, 'status'] });
    },
  });
};

export const useDocumentStatus = (id: string) => {
  return useQuery({
    queryKey: ['documents', id, 'status'],
    queryFn: () => apiGet<{ status: Document['status']; errorMessage?: string | null; pageCount?: number | null; analysis?: DocumentAnalysis | null }>(`/documents/${id}/status`),
    enabled: !!id,
    refetchInterval: (data) => {
      const status = data?.state?.data?.status;
      if (status === 'processing' || status === 'pending') {
         return 3000;
      }
      return false;
    },
  });
};
