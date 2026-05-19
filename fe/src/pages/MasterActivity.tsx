import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatDateTimeInAppTZ } from '../utils/datetime';

type ActivityRow = {
  id: number;
  code_act: string;
  descr: string;
  addby?: string | null;
  updateby?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const MasterActivity: React.FC = () => {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [codeAct, setCodeAct] = useState('');
  const [descr, setDescr] = useState('');

  const title = useMemo(() => (editing ? 'Edit Activity' : 'Add Activity'), [editing]);

  const openAdd = () => {
    setEditing(null);
    setCodeAct('');
    setDescr('');
    setModalOpen(true);
  };

  const openEdit = (r: ActivityRow) => {
    setEditing(r);
    setCodeAct(String(r.code_act ?? ''));
    setDescr(String(r.descr ?? ''));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSaving(false);
  };

  const fetchRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/rfq-activities/master', { withCredentials: true });
      const data = (res.data?.data as any[]) || [];
      const normalized: ActivityRow[] = data
        .map((r) => ({
          id: Number(r?.id),
          code_act: String(r?.code_act ?? ''),
          descr: String(r?.descr ?? ''),
          addby: r?.addby ?? null,
          updateby: r?.updateby ?? null,
          created_at: r?.created_at ?? null,
          updated_at: r?.updated_at ?? null,
        }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0);
      setRows(normalized);
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.data?.message || 'Gagal memuat master activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const c = codeAct.trim();
    const d = descr.trim();
    if (!c || !d) {
      setError('code_act dan descr wajib diisi');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(
          `/rfq-activities/master/${editing.id}`,
          { code_act: c, descr: d },
          { withCredentials: true }
        );
      } else {
        await api.post('/rfq-activities/master', { code_act: c, descr: d }, { withCredentials: true });
      }
      closeModal();
      await fetchRows();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal menyimpan activity');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: ActivityRow) => {
    const ok = window.confirm(`Hapus activity ${r.code_act} - ${r.descr}?`);
    if (!ok) return;

    setError('');
    try {
      await api.delete(`/rfq-activities/master/${r.id}`, { withCredentials: true });
      await fetchRows();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Gagal menghapus activity');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-gray-800">Master Activity</div>
         
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchRows()}
            className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 ring-1 ring-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-left font-medium">Code</th>
                <th className="px-5 py-4 text-left font-medium">Description</th>
                <th className="px-5 py-4 text-left font-medium">Add By</th>
                <th className="px-5 py-4 text-left font-medium">Update By</th>
                <th className="px-5 py-4 text-left font-medium">Created</th>
                <th className="px-5 py-4 text-left font-medium">Updated</th>
                <th className="px-5 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-4 font-semibold text-gray-800">{r.code_act}</td>
                    <td className="px-5 py-4 text-gray-700">{r.descr}</td>
                    <td className="px-5 py-4 text-gray-600">{r.addby || '-'}</td>
                    <td className="px-5 py-4 text-gray-600">{r.updateby || '-'}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDateTimeInAppTZ(r.created_at)}</td>
                    <td className="px-5 py-4 text-gray-600">{formatDateTimeInAppTZ(r.updated_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-800">{title}</div>
                {editing && <div className="text-xs text-gray-500">ID: {editing.id}</div>}
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">Code</div>
                  <input
                    value={codeAct}
                    onChange={(e) => setCodeAct(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="0, 1, 2, ..."
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">Description</div>
                  <input
                    value={descr}
                    onChange={(e) => setDescr(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Business Approach"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterActivity;
