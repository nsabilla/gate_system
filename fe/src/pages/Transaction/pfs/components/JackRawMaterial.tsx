import React from 'react';

type Ctx = any;

const JackRawMaterial: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const {
    jackRawMaterialRows,
    addJackRawMaterialRow,
    deleteJackRawMaterialRow,
    updateJackRawMaterialRow,
    jackRawMaterialTotal,
  } = ctx;

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          <span className="text-blue-600">Jack: </span>Raw Material
        </h2>
        <button
          type="button"
          onClick={addJackRawMaterialRow}
          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
        >
          Add Row
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Masukkan data raw material yang diperlukan untuk produksi produk baru. Data ini menjadi referensi Accounting pada form Raw Material.
      </p>
      <div className="space-y-3">
        {jackRawMaterialRows.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
            Belum ada data Raw Material. Klik <b>Add Row</b> untuk menambah.
          </div>
        )}
        {jackRawMaterialRows.map((row: any, idx: number) => (
          <div key={idx} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Raw Material #{idx + 1}</span>
              <button
                type="button"
                onClick={() => deleteJackRawMaterialRow(idx)}
                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-gray-500">Part Name</span>
                <input
                  value={row.part_name}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'part_name', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Material</span>
                <input
                  value={row.material}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'material', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Size t (mm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={row.size_t_mm}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'size_t_mm', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Size L (mm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={row.size_l_mm}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'size_l_mm', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Size W (mm)</span>
                <input
                  type="number"
                  step="0.01"
                  value={row.size_w_mm}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'size_w_mm', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Qty/Unit</span>
                <input
                  type="number"
                  value={row.qty_unit}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'qty_unit', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Qty/Pcs</span>
                <input
                  type="number"
                  value={row.qty_pcs}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'qty_pcs', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">wt/unit (kg)</span>
                <input
                  type="number"
                  step="0.001"
                  value={row.weight_unit_kg}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'weight_unit_kg', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-gray-500">Remarks</span>
                <input
                  value={row.remarks}
                  onChange={(e) => updateJackRawMaterialRow(idx, 'remarks', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

            </div>
          </div>
        ))}
      </div>

      {jackRawMaterialRows.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Total wt/unit (kg)</span>
          <span className="text-sm font-bold text-blue-700">{jackRawMaterialTotal.toLocaleString('id-ID', { minimumFractionDigits: 3 })}</span>
        </div>
      )}
    </div>
  );
};

export default JackRawMaterial;
