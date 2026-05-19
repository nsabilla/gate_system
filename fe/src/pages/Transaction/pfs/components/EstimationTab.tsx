import React from 'react';

type Ctx = any;

const EstimationTab: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const {
    pfsType,
    canCrudPFS,
    technicalSpec,
    setTechnicalSpec,
    cutQtyInput,
    setCutQtyInput,
    parseCutQtyWithRM,
    toInputValue,
    parseNumberOrNull,
    saveEstimation,
    disableCrudSave,
    saving,
  } = ctx;

  const inputClass = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition-all";
  const labelClass = "text-[10px] font-black uppercase tracking-tight text-slate-500 mb-1";

  return (
    <div className="flex flex-col gap-6">

      <fieldset disabled={!canCrudPFS} className="flex flex-col gap-6">
        {pfsType === 'forging' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-4 mb-6">
              <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Technical Specification</h3>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col">
                <span className={labelClass}>Product Weight (kg)</span>
                <input
                  value={toInputValue(technicalSpec.prod_w)}
                  onChange={(e) => {
                    const newProdW = parseNumberOrNull(e.target.value);
                    setTechnicalSpec((prev: any) => {
                      const yieldPct = prev.yield_pct;
                      let newRmW = prev.rm_w;
                      if (newProdW != null && yieldPct != null && yieldPct > 0) {
                        newRmW = Math.ceil((newProdW / (yieldPct / 100)) * 1000) / 1000;
                      }
                      return { ...prev, prod_w: newProdW, rm_w: newRmW };
                    });
                  }}
                  type="number"
                  step="0.001"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col">
                <span className={`${labelClass} text-blue-600`}>RM Weight (kg)</span>
                <input
                  value={toInputValue(technicalSpec.rm_w)}
                  readOnly
                  type="text"
                  title="Auto-calculated: Product Weight / (Yield% / 100)"
                  className={`${inputClass} bg-blue-50/30 border-blue-100 font-bold text-blue-900 cursor-default`}
                />
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>Material Grade</span>
                <input
                  value={toInputValue(technicalSpec.mat_grade)}
                  onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, mat_grade: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. S45C"
                />
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>Dia (ø)</span>
                <input
                  value={toInputValue(technicalSpec.dia)}
                  onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, dia: parseNumberOrNull(e.target.value) }))}
                  type="number"
                  step="0.01"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>Length (mm)</span>
                <input
                  value={toInputValue(technicalSpec.length_mm)}
                  onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, length_mm: parseNumberOrNull(e.target.value) }))}
                  type="number"
                  step="0.01"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col">
                <span className={`${labelClass} text-orange-600`}>Yield (%)</span>
                <input
                  value={toInputValue(technicalSpec.yield_pct)}
                  onChange={(e) => {
                    const newYieldPct = parseNumberOrNull(e.target.value);
                    setTechnicalSpec((prev: any) => {
                      const prodW = prev.prod_w;
                      let newRmW = prev.rm_w;
                      if (prodW != null && newYieldPct != null && newYieldPct > 0) {
                        newRmW = Math.ceil((prodW / (newYieldPct / 100)) * 1000) / 1000;
                      }
                      return { ...prev, yield_pct: newYieldPct, rm_w: newRmW };
                    });
                  }}
                  type="number"
                  step="0.01"
                  className={`${inputClass} border-orange-100 bg-orange-50/10`}
                />
              </div>

              <div className="flex flex-col">
                <span className={labelClass}>Cut Qty</span>
                <input
                  value={cutQtyInput}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setCutQtyInput(nextValue);
                    const parsed = parseCutQtyWithRM(nextValue);
                    setTechnicalSpec((prev: any) => ({ ...prev, cut_qty: parsed.cutQty }));
                  }}
                  type="text"
                  placeholder="Ex: 59 / 5800"
                  className={inputClass}
                />
              </div>

              {pfsType !== 'jack' && (
                <div className="flex flex-col">
                  <span className={labelClass}>RM + Rem</span>
                  <input
                    value={toInputValue(technicalSpec.rm_plus_rem)}
                    onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, rm_plus_rem: parseNumberOrNull(e.target.value) }))}
                    type="number"
                    step="0.01"
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-1">
              <span className={labelClass}>Spec Remark</span>
              <textarea
                value={toInputValue(technicalSpec.remark)}
                onChange={(e) => setTechnicalSpec((prev: any) => ({ ...prev, remark: e.target.value }))}
                rows={2}
                placeholder="Additional technical notes..."
                className={`${inputClass} resize-none p-3`}
              />
            </div>
          </div>
        )}

        {/* ACTION BUTTON */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={disableCrudSave || saving}
            onClick={() => saveEstimation()}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Save Estimation
              </>
            )}
          </button>
        </div>
      </fieldset>
    </div>
  );
};

export default EstimationTab;