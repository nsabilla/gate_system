import api from './axios';

export type UserRole = 'admin' | 'marketing' | 'engineering' | 'accounting' | 'purchasing';

export type UserItem = {
  id: number;
  userid: string;
  name: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
};

export type UpdateMePayload = {
  name?: string;
  email?: string;
  password?: string;
};

export type UserCreatePayload = {
  userid: string;
  name: string;
  email: string;
  role: Exclude<UserRole, 'admin'>;
  password: string;
};

export type UserUpdatePayload = {
  userid?: string;
  name?: string;
  email?: string;
  role?: UserRole;
};

export const getUsers = async (): Promise<UserItem[]> => {
  const res = await api.get('/users', { withCredentials: true });
  return (res.data?.data || []) as UserItem[];
};

export const getUserById = async (id: number): Promise<UserItem | null> => {
  const res = await api.get(`/users/${id}`, { withCredentials: true });
  return (res.data?.data || null) as UserItem | null;
};

export const createUser = async (payload: UserCreatePayload) => {
  return api.post('/users', payload, { withCredentials: true });
};

export const updateUser = async (id: number, payload: UserUpdatePayload) => {
  return api.put(`/users/${id}`, payload, { withCredentials: true });
};

export const deleteUser = async (id: number) => {
  return api.delete(`/users/${id}`, { withCredentials: true });
};

export const updateMe = async (payload: UpdateMePayload) => {
  return api.put('/me', payload, { withCredentials: true });
};
