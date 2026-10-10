import axios from 'axios';

export function getApiErrorMessage(error: any, fallback = 'An error occurred') {
  if (axios.isAxiosError(error) && !error.response) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? 'The API took too long to respond. Please try again.'
      : 'Cannot connect to the API. Check that the backend is running and the frontend origin is allowed.';
  }
  return error?.response?.data?.error?.message
    || error?.response?.data?.message
    || error?.message
    || fallback;
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Unwrap Express's { success: true, data: T } envelope */
function unwrap<T>(responseData: any): T {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data as T;
  }
  return responseData as T;
}

export const apiGet = async <T>(url: string, config = {}): Promise<T> => {
  const response = await api.get(url, config);
  return unwrap<T>(response.data);
};

export const apiPost = async <T>(url: string, data?: any, config = {}): Promise<T> => {
  const response = await api.post(url, data, config);
  return unwrap<T>(response.data);
};

export const apiPatch = async <T>(url: string, data?: any, config = {}): Promise<T> => {
  const response = await api.patch(url, data, config);
  return unwrap<T>(response.data);
};

export const apiDelete = async <T>(url: string, config = {}): Promise<T> => {
  const response = await api.delete(url, config);
  return unwrap<T>(response.data);
};
