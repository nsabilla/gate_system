import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  updateMe,
  updateUser,
  type UserItem,
  type UserRole,
} from '../api/users';

const Users = () => {
  const { user, logout, refreshMe } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [createForm, setCreateForm] = useState({
    userid: '',
    name: '',
    email: '',
    role: 'marketing' as UserRole,
    password: '',
  });

  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    userid: '',
    name: '',
    email: '',
    role: 'marketing' as UserRole,
  });

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const roleOptions = useMemo(
    () => ['marketing', 'engineering', 'accounting', 'purchasing'],
    []
  );

  const setFlash = (nextMessage: string, nextError = '') => {
    setMessage(nextMessage);
    setError(nextError);
  };

  const loadUsers = async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    try {
      const rows = await getUsers();
      setUsers(rows);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal memuat data users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: '',
      password: '',
    });
  }, [user]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const submitUpdateMe = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlash('', '');

    const payload: Record<string, string> = {};
    if (profileForm.name.trim()) payload.name = profileForm.name.trim();
    if (profileForm.email.trim()) payload.email = profileForm.email.trim();
    if (profileForm.password.trim()) payload.password = profileForm.password;

    if (Object.keys(payload).length === 0) {
      setError('Isi minimal satu field untuk update profile');
      return;
    }

    try {
      await updateMe(payload);
      await refreshMe();
      setProfileForm((prev) => ({ ...prev, password: '', email: '' }));
      setFlash('Profile berhasil diupdate');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal update profile');
    }
  };

  const submitCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setFlash('', '');
    try {
      await createUser({
        userid: createForm.userid.trim(),
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role as 'marketing' | 'engineering' | 'accounting' | 'purchasing',
        password: createForm.password,
      });
      setCreateForm({ userid: '', name: '', email: '', role: 'marketing', password: '' });
      await loadUsers();
      setFlash('User baru berhasil dibuat');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal membuat user');
    }
  };

  const openEditUser = async (id: number) => {
    setFlash('', '');
    try {
      const item = await getUserById(id);
      if (!item) {
        setError('User tidak ditemukan');
        return;
      }
      setEditTarget(item);
      setEditForm({
        userid: String(item.userid || ''),
        name: String(item.name || ''),
        email: String(item.email || ''),
        role: String(item.role || 'marketing') as UserRole,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal mengambil detail user');
    }
  };

  const submitEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setFlash('', '');
    try {
      await updateUser(editTarget.id, {
        userid: editForm.userid.trim(),
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      });
      setEditTarget(null);
      await loadUsers();
      setFlash('User berhasil diupdate');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal update user');
    }
  };

  const onDeleteUser = async (id: number) => {
    if (!confirm('Yakin hapus user ini?')) return;
    setFlash('', '');
    try {
      await deleteUser(id);
      await loadUsers();
      setFlash('User berhasil dihapus');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal hapus user');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-gray-800">User Management</h1>
        <p className="text-sm text-gray-500">Fitur backend yang tercover di halaman ini: GET/PUT /me, GET/POST /users, GET/PUT/DELETE /users/:id</p>
      </div>

      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-800">My Profile</h2>
          <form onSubmit={submitUpdateMe} className="space-y-3">
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="New Email (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={profileForm.password}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="New Password (optional)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Update Profile
              </button>
              <button type="button" onClick={logout} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Logout
              </button>
            </div>
          </form>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-base font-semibold text-gray-800">Create User</h2>
            <form onSubmit={submitCreateUser} className="grid gap-3 md:grid-cols-2">
              <input value={createForm.userid} onChange={(e) => setCreateForm((p) => ({ ...p, userid: e.target.value }))} placeholder="UserID" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
              <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
              <input value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
              <input type="password" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
              <select value={createForm.role} onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as UserRole }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2">
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 md:col-span-2">
                Save User
              </button>
            </form>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-800">Users List</h2>
          {loadingUsers ? (
            <div className="text-sm text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-gray-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2">ID</th>
                    <th className="py-2">UserID</th>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td className="py-2">{u.id}</td>
                      <td className="py-2">{u.userid}</td>
                      <td className="py-2">{u.name}</td>
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button onClick={() => openEditUser(u.id)} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">Edit</button>
                          <button onClick={() => onDeleteUser(u.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isAdmin && editTarget && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-gray-800">Edit User #{editTarget.id}</h2>
          <form onSubmit={submitEditUser} className="grid gap-3 md:grid-cols-2">
            <input value={editForm.userid} onChange={(e) => setEditForm((p) => ({ ...p, userid: e.target.value }))} placeholder="UserID" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <input value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
            <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as UserRole }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Update User</button>
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Users;
