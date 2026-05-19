import React from 'react';

type Ctx = any;

const OverviewTab: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const {
    newProduct,
    similarProduct,
    setNewProduct,
    setSimilarProduct,
    saveOverview,
    disableCrudSave,
    saving,
    canCrudPFS,
    toInputValue,
  } = ctx;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Overview</h2>
          <p className="mt-1 text-sm text-gray-500">Isi overview sesuai produk New dan Similar pada RFQ terpilih.</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${'bg-gray-100 text-gray-700'}`}>
          Template
        </div>
      </div>

      <fieldset disabled={!canCrudPFS} className="space-y-6">
        <section className="rounded-lg border border-gray-200">
          <div className="rounded-t-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">New Product</div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Product Name</span>
              <input
                value={toInputValue(newProduct.product_name)}
                onChange={(e) => setNewProduct((p: any) => ({ ...p, product_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Part No</span>
              <input
                value={toInputValue(newProduct.part_no)}
                onChange={(e) => setNewProduct((p: any) => ({ ...p, part_no: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Material Grade</span>
              <input
                value={toInputValue(newProduct.mat_grade)}
                onChange={(e) => setNewProduct((p: any) => ({ ...p, mat_grade: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Line</span>
              <input
                value={toInputValue(newProduct.line)}
                onChange={(e) => setNewProduct((p: any) => ({ ...p, line: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200">
          <div className="rounded-t-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">Similar Product</div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Product Name</span>
              <input
                value={toInputValue(similarProduct.product_name)}
                onChange={(e) => setSimilarProduct((p: any) => ({ ...p, product_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Part No</span>
              <input
                value={toInputValue(similarProduct.part_no)}
                onChange={(e) => setSimilarProduct((p: any) => ({ ...p, part_no: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Material Grade</span>
              <input
                value={toInputValue(similarProduct.mat_grade)}
                onChange={(e) => setSimilarProduct((p: any) => ({ ...p, mat_grade: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-700">Line</span>
              <input
                value={toInputValue(similarProduct.line)}
                onChange={(e) => setSimilarProduct((p: any) => ({ ...p, line: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
        </section>
      </fieldset>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={disableCrudSave}
          onClick={() => saveOverview()}
          className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default OverviewTab;
