import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

/* ================= HELPER ================= */

// existing helper (TIDAK DIHAPUS)
const isComplete = (obj: Record<string, string>) =>
  Object.values(obj).every((v) => v.trim() !== '');

// tambahan helper khusus numeric (AMAN)
const isCompleteProduct = (p: any) =>
  isComplete({
    customer: String(p.customer ?? ''),
    partName: String(p.partName ?? ''),
    partNo: String(p.partNo ?? ''),
    model: String(p.model ?? ''),
    material: String(p.material ?? ''),
    deliveryCondition: String(p.deliveryCondition ?? ''),
    volumeMonth: String(p.volumeMonth ?? ''),
    productWeight: String(p.productWeight ?? ''),
  });

const emptyProduct = {
  customer: '',
  partName: '',
  partNo: '',
  model: '',
  volumeMonth: '',
  material: '',
  productWeight: '',
  deliveryCondition: '',
};

const emptyRemarks = {
  forg: '',
  comp: '',
  mach: '',
  asse: '',
  doc: '',
};

const emptyTechFiles = {
  doc: null as File | null,
};

/* ================= INPUT COMPONENT ================= */
const InputField = ({ label, required, type = 'text', value, onChange }: any) => (
  <label className="space-y-1 text-sm">
    <span className="text-gray-700">
      {label}
      {required && <span className="ml-1 text-red-500">*</span>}
    </span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    />
  </label>
);

const TextAreaField = ({ label, value, onChange, placeholder }: any) => (
  <label className="space-y-1 text-sm">
    <span className="text-gray-700">{label}</span>
    <textarea
      rows={3}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none"
    />
  </label>
);

const FileField = ({ label, onChange }: any) => (
  <label className="space-y-1 text-sm">
    <span className="text-gray-700">{label}</span>
    <input
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
      onChange={onChange}
      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
    />
  </label>
);

/* ================= MAIN ================= */
const CreateRFQ: React.FC = () => {
  const navigate = useNavigate();

  const [np, setNp] = useState({ ...emptyProduct });
  const [sp, setSp] = useState({ ...emptyProduct });

  const [npRemarks, setNpRemarks] = useState({ ...emptyRemarks });
  const [spRemarks, setSpRemarks] = useState({ ...emptyRemarks });

  const [npFiles, setNpFiles] = useState({ ...emptyTechFiles });
  const [spFiles, setSpFiles] = useState({ ...emptyTechFiles });

  const [pfsType, setPfsType] = useState('FG'); // Default to Forging
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    console.group('🚀 CREATE RFQ SUBMIT');

    const newComplete = isCompleteProduct(np);
    const similarFilled = sp.partName.trim() !== '';
    const similarComplete = similarFilled && isCompleteProduct(sp);

    console.log('NP complete:', newComplete);
    console.log('SP filled:', similarFilled, 'complete:', similarComplete);

    if (!newComplete) {
      console.warn('❌ New Product validation failed', np);
      setError('Semua field New Product wajib diisi');
      console.groupEnd();
      return;
    }

    if (similarFilled && !similarComplete) {
      console.warn('❌ Similar Product validation failed', sp);
      setError('Semua field Similar Product wajib diisi');
      console.groupEnd();
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      /* ===== RFQ TYPE ===== */
      formData.append('pfs_type', pfsType);

      /* ===== NEW PRODUCT ===== */
      formData.append('np_customer', np.customer);
      formData.append('np_part_name', np.partName);
      formData.append('np_part_no', np.partNo);
      formData.append('np_model', np.model);
      formData.append('np_volume_month', np.volumeMonth);
      formData.append('np_material', np.material);
      formData.append('np_product_weight', np.productWeight);
      formData.append('np_delivery_condition', np.deliveryCondition);

      formData.append('np_remark_forg', npRemarks.forg);
      formData.append('np_remark_comp', npRemarks.comp);
      formData.append('np_remark_mach', npRemarks.mach);
      formData.append('np_remark_asse', npRemarks.asse);
      formData.append('np_remark_doc', npRemarks.doc);

      if (npFiles.doc) formData.append('np_technical_document_doc', npFiles.doc);

      /* ===== SIMILAR PRODUCT ===== */
      if (similarFilled) {
        formData.append('sp_customer', sp.customer);
        formData.append('sp_part_name', sp.partName);
        formData.append('sp_part_no', sp.partNo);
        formData.append('sp_model', sp.model);
        formData.append('sp_volume_month', sp.volumeMonth);
        formData.append('sp_material', sp.material);
        formData.append('sp_product_weight', sp.productWeight);
        formData.append('sp_delivery_condition', sp.deliveryCondition);

        formData.append('sp_remark_forg', spRemarks.forg);
        formData.append('sp_remark_comp', spRemarks.comp);
        formData.append('sp_remark_mach', spRemarks.mach);
        formData.append('sp_remark_asse', spRemarks.asse);
        formData.append('sp_remark_doc', spRemarks.doc);

        if (spFiles.doc) formData.append('sp_technical_document_doc', spFiles.doc);
      }

      console.log('📦 Sending FormData to backend');

      const res = await api.post('/rfqs', formData, {
        withCredentials: true,
         headers: { 'Content-Type': 'multipart/form-data' }, // sengaja tidak dipaksa
      });

      if (res?.data?.status !== true) {
        throw new Error(res?.data?.message || 'Gagal membuat RFQ');
      }

      console.log('✅ RFQ created successfully');
      const rfqId = Number(res?.data?.rfq_id ?? 0);

      if (Number.isFinite(rfqId) && rfqId > 0) {
        navigate(`/main/manage-rfq/${rfqId}`);
        return;
      }

      setSuccess(true);

      setNp({ ...emptyProduct });
      setSp({ ...emptyProduct });
      setNpRemarks({ ...emptyRemarks });
      setSpRemarks({ ...emptyRemarks });
      setNpFiles({ ...emptyTechFiles });
      setSpFiles({ ...emptyTechFiles });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('🔥 CREATE RFQ ERROR', err);
      setError(
        err?.response?.data?.message ||
        'Gagal membuat RFQ. Silakan periksa kembali data.'
      );
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  };

  /* ================= UI ================= */
  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8">
        

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            RFQ berhasil dibuat dan disimpan sebagai <b>Draft</b>.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10 rounded-xl border border-gray-200 bg-white p-6">

          {/* ================= RFQ TYPE SELECTION ================= */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Pilih Jenis RFQ</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { id: 'FG', label: 'Forging', icon: '⚒️', desc: 'Production Forging Parts' },
                { id: 'TLS', label: 'Toolset', icon: '🔧', desc: 'Tooling & Sets' },
                { id: 'JCK', label: 'Jack', icon: '🚜', desc: 'Jack & Lifting Equipment' },
              ].map((type) => (
                <div
                  key={type.id}
                  onClick={() => setPfsType(type.id)}
                  className={`cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-md ${
                    pfsType === type.id
                      ? 'border-[#0D79BD] bg-blue-50 ring-1 ring-[#0D79BD]'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="mb-2 text-2xl">{type.icon}</div>
                  <div className={`font-bold ${pfsType === type.id ? 'text-[#0D79BD]' : 'text-gray-700'}`}>
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500">{type.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ================= NEW PRODUCT ================= */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              New Product <span className="text-red-500">*</span>
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField label="Customer" required value={np.customer}
                onChange={(e: any) => setNp({ ...np, customer: e.target.value })} />

              <InputField label="Part Name" required value={np.partName}
                onChange={(e: any) => setNp({ ...np, partName: e.target.value })} />

              <InputField label="Part No" required value={np.partNo}
                onChange={(e: any) => setNp({ ...np, partNo: e.target.value })} />

              <InputField label="Model" required value={np.model}
                onChange={(e: any) => setNp({ ...np, model: e.target.value })} />

              <InputField label="Volume / Month" required type="number"
                value={np.volumeMonth}
                onChange={(e: any) => setNp({ ...np, volumeMonth: e.target.value })} />

              <InputField label="Material" required value={np.material}
                onChange={(e: any) => setNp({ ...np, material: e.target.value })} />

              <InputField label="Product Weight (kg)" required type="number"
                value={np.productWeight}
                onChange={(e: any) => setNp({ ...np, productWeight: e.target.value })} />

              <InputField label="Delivery Condition" required
                value={np.deliveryCondition}
                onChange={(e: any) =>
                  setNp({ ...np, deliveryCondition: e.target.value })
                } />
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextAreaField
                  label="Remark Forging"
                  placeholder="(optional)"
                  value={npRemarks.forg}
                  onChange={(e: any) => setNpRemarks({ ...npRemarks, forg: e.target.value })}
                />
                <TextAreaField
                  label="Remark Component"
                  placeholder="(optional)"
                  value={npRemarks.comp}
                  onChange={(e: any) => setNpRemarks({ ...npRemarks, comp: e.target.value })}
                />
                <TextAreaField
                  label="Remark Machining"
                  placeholder="(optional)"
                  value={npRemarks.mach}
                  onChange={(e: any) => setNpRemarks({ ...npRemarks, mach: e.target.value })}
                />
                <TextAreaField
                  label="Remark Assembly"
                  placeholder="(optional)"
                  value={npRemarks.asse}
                  onChange={(e: any) => setNpRemarks({ ...npRemarks, asse: e.target.value })}
                />
                <TextAreaField
                  label="Remark Document"
                  placeholder="(optional)"
                  value={npRemarks.doc}
                  onChange={(e: any) => setNpRemarks({ ...npRemarks, doc: e.target.value })}
                />
              </div>
            </div>

            {/* ✅ TECHNICAL DOCUMENTS (NEW PRODUCT) */}
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <FileField
                label="Technical Document (New Product)"
                onChange={(e: any) => setNpFiles({ ...npFiles, doc: e.target.files?.[0] || null })}
              />
            </div>
          </section>

          {/* ================= SIMILAR PRODUCT ================= */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              Similar Product
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <InputField label="Customer" value={sp.customer}
                onChange={(e: any) => setSp({ ...sp, customer: e.target.value })} />

              <InputField label="Part Name" value={sp.partName}
                onChange={(e: any) => setSp({ ...sp, partName: e.target.value })} />

              <InputField label="Part No" value={sp.partNo}
                onChange={(e: any) => setSp({ ...sp, partNo: e.target.value })} />

              <InputField label="Model" value={sp.model}
                onChange={(e: any) => setSp({ ...sp, model: e.target.value })} />

              <InputField label="Volume / Month" type="number"
                value={sp.volumeMonth}
                onChange={(e: any) => setSp({ ...sp, volumeMonth: e.target.value })} />

              <InputField label="Material" value={sp.material}
                onChange={(e: any) => setSp({ ...sp, material: e.target.value })} />

              <InputField label="Product Weight (kg)" type="number"
                value={sp.productWeight}
                onChange={(e: any) => setSp({ ...sp, productWeight: e.target.value })} />

              <InputField label="Delivery Condition"
                value={sp.deliveryCondition}
                onChange={(e: any) => setSp({ ...sp, deliveryCondition: e.target.value })} />
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextAreaField
                  label="Remark Forging"
                  placeholder="(optional)"
                  value={spRemarks.forg}
                  onChange={(e: any) => setSpRemarks({ ...spRemarks, forg: e.target.value })}
                />
                <TextAreaField
                  label="Remark Component"
                  placeholder="(optional)"
                  value={spRemarks.comp}
                  onChange={(e: any) => setSpRemarks({ ...spRemarks, comp: e.target.value })}
                />
                <TextAreaField
                  label="Remark Machining"
                  placeholder="(optional)"
                  value={spRemarks.mach}
                  onChange={(e: any) => setSpRemarks({ ...spRemarks, mach: e.target.value })}
                />
                <TextAreaField
                  label="Remark Assembly"
                  placeholder="(optional)"
                  value={spRemarks.asse}
                  onChange={(e: any) => setSpRemarks({ ...spRemarks, asse: e.target.value })}
                />
                <TextAreaField
                  label="Remark Document"
                  placeholder="(optional)"
                  value={spRemarks.doc}
                  onChange={(e: any) => setSpRemarks({ ...spRemarks, doc: e.target.value })}
                />
              </div>
            </div>

            {/* ✅ TECHNICAL DOCUMENTS (SIMILAR PRODUCT) */}
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <FileField
                label="Technical Document (Similar Product)"
                onChange={(e: any) => setSpFiles({ ...spFiles, doc: e.target.files?.[0] || null })}
              />
            </div>
          </section>

          {/* ACTION */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg border px-5 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#0D79BD] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0B6BA8] disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Submit RFQ'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CreateRFQ;
