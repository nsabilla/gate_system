import React, { useEffect, useState } from 'react';
import { getFeasibilityCost, upsertFeasibilityCost } from '../../../api/feasibility';
import type { FeasibilityStdCostData, FeasibilityStdCostMaterial, FeasibilityStdCostPurchased, FeasibilityStdCostProcess, FeasibilityStdCostDies, FeasibilityStdCostOther } from '../../../api/feasibility';
import { toErrorMessage } from '../pfs/pfsFormatters';

interface FeasibilityTabProps {
  rfqId: number;
  costType?: 'std' | 'act' | 'sim';
}

const MATERIAL_DESCRIPTION_OPTIONS = [
  'Specification',
  'Source',
  'Basic Price',
  'Import Duty',
  'Inclaring',
  'Inventory Cost',
  'Material Price',
  'Product Weight',
  'Mat\'l Weight',
  'Rejection',
  'Material Cost',
  'Scrap Cost'
];

const FeasibilityStdCostTab: React.FC<FeasibilityTabProps> = ({ rfqId, costType = 'std' }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  const typeLabel = costType === 'std' ? 'Std Cost' : costType === 'act' ? 'Act Cost' : 'Similar Part';

  const [formData, setFormData] = useState<FeasibilityStdCostData>({
    pfs_list: '',
    raw_material: '',
    process: '',
    exchange_rate: '',
    rejection_rate: 0,
    materials: [],
    purchased_items: [],
    process_costs: [],
    dies_costs: [],
    other_costs: [],
    mfg_cost: 0,
    selling_price: 0,
    gpm_pct: 0,
    uc: 0,
    ucm_pct: 0,
    note: ''
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getFeasibilityCost(rfqId, costType);
      if (data) {
        setFormData({
          id: data.id,
          pfs_list: data.pfs_list || '',
          raw_material: data.raw_material || '',
          process: data.process || '',
          exchange_rate: data.exchange_rate || '',
          rejection_rate: data.rejection_rate || 0,
          mfg_cost: data.mfg_cost || 0,
          selling_price: data.selling_price || 0,
          gpm_pct: data.gpm_pct || 0,
          uc: data.uc || 0,
          ucm_pct: data.ucm_pct || 0,
          note: data.note || '',
          materials: data.materials || [],
          purchased_items: data.purchased_items || [],
          process_costs: data.process_costs || [],
          dies_costs: data.dies_costs || [],
          other_costs: data.other_costs || []
        });
      } else {
        // Reset if no data
        setFormData({
          pfs_list: '',
          raw_material: '',
          process: '',
          exchange_rate: '',
          rejection_rate: 0,
          mfg_cost: 0,
          selling_price: 0,
          gpm_pct: 0,
          uc: 0,
          ucm_pct: 0,
          note: '',
          materials: [],
          purchased_items: [],
          process_costs: [],
          dies_costs: [],
          other_costs: []
        });
      }
    } catch (err) {
      setError(toErrorMessage(err, `Gagal memuat data ${typeLabel}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rfqId) {
      loadData();
    }
  }, [rfqId, costType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMaterialChange = (index: number, field: keyof FeasibilityStdCostMaterial, value: string | number) => {
    setFormData(prev => {
      const newMaterials = [...prev.materials];
      newMaterials[index] = {
        ...newMaterials[index],
        [field]: value
      };

      // Auto-calculate logic
      const updated = [...newMaterials];
      const basicPriceRow = updated.find(m => m.description === 'Basic Price');
      const basicPrice = parseFloat(basicPriceRow?.amount || '0') || 0;

      const productWeightRow = updated.find(m => m.description === 'Product Weight');
      const productWeight = parseFloat(productWeightRow?.amount || '0') || 0;

      const matlWeightRow = updated.find(m => m.description === 'Mat\'l Weight');
      const matlWeight = parseFloat(matlWeightRow?.amount || '0') || 0;

      const rejectionRow = updated.find(m => m.description === 'Rejection');
      const rejectionRate = parseFloat(rejectionRow?.rate || '0') || 0;

      updated.forEach((m, idx) => {
        if (m.description === 'Import Duty' || m.description === 'Inclaring') {
          if (field === 'rate' && idx === index) {
            const rate = parseFloat(String(value)) || 0;
            updated[idx].amount = String(basicPrice * (rate / 100));
          }
        }

        if (m.description === 'Inventory Cost') {
          const rate = parseFloat(updated[idx].rate || '0') || 0;
          updated[idx].amount = (basicPrice * (rate / 100 / 12)).toFixed(2);
        }

        if (m.description === 'Material Price') {
          const dutyAmt = parseFloat(updated.find(row => row.description === 'Import Duty')?.amount || '0') || 0;
          const inclaringAmt = parseFloat(updated.find(row => row.description === 'Inclaring')?.amount || '0') || 0;
          const inventoryAmt = parseFloat(updated.find(row => row.description === 'Inventory Cost')?.amount || '0') || 0;
          updated[idx].amount = (basicPrice + dutyAmt + inclaringAmt + inventoryAmt).toFixed(2);
        }

        if (m.description === 'Material Cost') {
          const matPrice = parseFloat(updated.find(row => row.description === 'Material Price')?.amount || '0') || 0;
          const amt = matPrice * (1 + (rejectionRate / 100));
          updated[idx].amount = amt.toFixed(2);
          updated[idx].subtotal = amt * matlWeight;
        }

        if (m.description === 'Scrap Cost') {
          const rate = parseFloat(updated[idx].rate || '0') || 0;
          const amt = -(rate * (1 - 0.1)) * 0.95;
          updated[idx].amount = amt.toFixed(2);
          updated[idx].subtotal = amt * (matlWeight - productWeight);
        }
      });

      return { ...prev, materials: updated };
    });
  };

  const handleAddMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials: [
        ...prev.materials,
        { description: '', rate: '', amount: '', uom: '', note: '', subtotal: 0 }
      ]
    }));
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData(prev => {
      const newMaterials = [...prev.materials];
      newMaterials.splice(index, 1);
      return { ...prev, materials: newMaterials };
    });
  };

  const handlePurchasedChange = (index: number, field: keyof FeasibilityStdCostPurchased, value: string | number) => {
    setFormData(prev => {
      const newPurchased = [...prev.purchased_items];
      newPurchased[index] = {
        ...newPurchased[index],
        [field]: value
      };

      // Auto-calculate subtotal when qty or cost changes
      if (field === 'qty' || field === 'cost') {
        const qty = Number(newPurchased[index].qty) || 0;
        const cost = Number(newPurchased[index].cost) || 0;
        newPurchased[index].subtotal = qty * cost;
      }

      return { ...prev, purchased_items: newPurchased }
    });
  };

  const handleAddPurchased = () => {
    setFormData(prev => ({
      ...prev,
      purchased_items: [
        ...prev.purchased_items,
        { description: '', qty: 1, cost: 0, subtotal: 0 }
      ]
    }));
  };

  const handleRemovePurchased = (index: number) => {
    setFormData(prev => {
      const newPurchased = [...prev.purchased_items];
      newPurchased.splice(index, 1);
      return { ...prev, purchased_items: newPurchased };
    });
  };

  const purchasedSubtotalSum = formData.purchased_items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const rejectionSubtotal = purchasedSubtotalSum * ((Number(formData.rejection_rate) || 0) / 100);
  const grandTotalPurchased = purchasedSubtotalSum + rejectionSubtotal;

  const handleProcessChange = (index: number, field: keyof FeasibilityStdCostProcess, value: string | number) => {
    setFormData(prev => {
      const newProcess = [...prev.process_costs];
      newProcess[index] = {
        ...newProcess[index],
        [field]: value
      };

      if (field === 'ct_sec' || field === 'rate') {
        const ct = Number(newProcess[index].ct_sec) || 0;
        const rate = Number(newProcess[index].rate) || 0;
        newProcess[index].subtotal = ct * rate;
      }

      return { ...prev, process_costs: newProcess };
    });
  };

  const handleAddProcess = () => {
    setFormData(prev => ({
      ...prev,
      process_costs: [
        ...prev.process_costs,
        { description: '', location: '', ct_sec: 0, rate: 0, subtotal: 0 }
      ]
    }));
  };

  const handleRemoveProcess = (index: number) => {
    setFormData(prev => {
      const newProcess = [...prev.process_costs];
      newProcess.splice(index, 1);
      return { ...prev, process_costs: newProcess };
    });
  };

  const handleDiesChange = (index: number, field: keyof FeasibilityStdCostDies, value: string | number) => {
    setFormData(prev => {
      const newDies = [...prev.dies_costs];
      newDies[index] = {
        ...newDies[index],
        [field]: value
      };

      if (field === 'cost_mio') {
        newDies[index].subtotal = Number(newDies[index].cost_mio) || 0;
      }

      return { ...prev, dies_costs: newDies };
    });
  };

  const handleAddDies = () => {
    setFormData(prev => ({
      ...prev,
      dies_costs: [
        ...prev.dies_costs,
        { description: '', lt_val: 0, cost_mio: 0, subtotal: 0 }
      ]
    }));
  };

  const handleRemoveDies = (index: number) => {
    setFormData(prev => {
      const newDies = [...prev.dies_costs];
      newDies.splice(index, 1);
      return { ...prev, dies_costs: newDies };
    });
  };

  const handleOtherChange = (index: number, field: keyof FeasibilityStdCostOther, value: string | number) => {
    setFormData(prev => {
      const newOther = [...prev.other_costs];
      newOther[index] = {
        ...newOther[index],
        [field]: value
      };

      if (field === 'cost_val' || field === 'lt_val') {
        const cost = Number(newOther[index].cost_val) || 0;
        const lt = Number(newOther[index].lt_val) || 1;
        newOther[index].subtotal = lt !== 0 ? cost / lt : 0;
      }

      return { ...prev, other_costs: newOther };
    });
  };

  const handleAddOther = () => {
    setFormData(prev => ({
      ...prev,
      other_costs: [
        ...prev.other_costs,
        { description: '', lt_val: 1, cost_val: 0, subtotal: 0 }
      ]
    }));
  };

  const handleRemoveOther = (index: number) => {
    setFormData(prev => {
      const newOther = [...prev.other_costs];
      newOther.splice(index, 1);
      return { ...prev, other_costs: newOther };
    });
  };

  const materialSubtotalSum = formData.materials.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const processSubtotalSum = formData.process_costs.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const diesSubtotalSum = formData.dies_costs.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const otherSubtotalSum = formData.other_costs.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

  const totalMFGCost = materialSubtotalSum + grandTotalPurchased + processSubtotalSum + diesSubtotalSum + otherSubtotalSum;

  // Auto-calculate GPM whenever Selling Price or MFG Cost changes
  useEffect(() => {
    const sp = Number(formData.selling_price) || 0;
    const gpm = sp !== 0 ? ((sp - totalMFGCost) / sp) * 100 : 0;
    setFormData(prev => ({
      ...prev,
      mfg_cost: totalMFGCost,
      gpm_pct: gpm
    }));
  }, [totalMFGCost, formData.selling_price]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await upsertFeasibilityCost(rfqId, costType, formData);
      setMessage(`Data ${typeLabel} berhasil disimpan`);
    } catch (err) {
      setError(toErrorMessage(err, `Gagal menyimpan data ${typeLabel}`));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">{`Memuat data ${typeLabel}...`}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {message && (
        <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r-lg shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <p className="font-medium">Berhasil</p>
          <p className="text-sm">{message}</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* PFS List Header */}
        <div className="mb-8 flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">PFS List</label>
          <select
            name="pfs_list"
            value={formData.pfs_list}
            onChange={handleChange}
            className="w-64 px-4 py-2 rounded-lg border border-slate-200 bg-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">-- Pilih --</option>
            <option value="pfs_1">PFS 1</option>
            <option value="pfs_2">PFS 2</option>
          </select>
        </div>

        {/* CONDITION */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
            CONDITION
          </div>
          <div className="space-y-4 max-w-3xl">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Raw Material</label>
              <input
                type="text"
                name="raw_material"
                value={formData.raw_material}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Process</label>
              <input
                type="text"
                name="process"
                value={formData.process}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Exchange Rate (IDR/USD)</label>
              <input
                type="text"
                name="exchange_rate"
                value={formData.exchange_rate}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* MATERIAL COST */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
            MATERIAL COST
          </div>

          <div className="space-y-4">
            {formData.materials.map((mat, idx) => (
              <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 relative">
                <div className="flex-1 grid grid-cols-12 gap-4">
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Description</label>
                    <select
                      value={mat.description}
                      onChange={(e) => handleMaterialChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="">-- Pilih Description --</option>
                      {MATERIAL_DESCRIPTION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Rate (%)</label>
                    <input
                      type="text"
                      value={mat.rate || ''}
                      onChange={(e) => handleMaterialChange(idx, 'rate', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Amount/Price</label>
                    <input
                      type="text"
                      value={mat.amount}
                      onChange={(e) => handleMaterialChange(idx, 'amount', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">UoM</label>
                    <input
                      type="text"
                      value={mat.uom}
                      onChange={(e) => handleMaterialChange(idx, 'uom', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Note</label>
                    <input
                      type="text"
                      value={mat.note || ''}
                      onChange={(e) => handleMaterialChange(idx, 'note', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Subtotal</label>
                    <input
                      type="number"
                      value={mat.subtotal}
                      onChange={(e) => handleMaterialChange(idx, 'subtotal', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right font-medium"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMaterial(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddMaterial}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* PURCHASED COST */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex justify-between items-center">
            <span>PURCHASED COST</span>
            <div className="text-right flex items-center gap-4">
              <span className="text-sm font-normal text-slate-500">Grand Total:</span>
              <span className="text-xl font-bold text-blue-700">{Math.round(grandTotalPurchased).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-4">
            {formData.purchased_items.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 relative">
                <div className="flex-1 grid grid-cols-12 gap-4">
                  <div className="col-span-5 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Desc.</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handlePurchasedChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Qty</label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => handlePurchasedChange(idx, 'qty', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Cost</label>
                    <input
                      type="number"
                      value={item.cost}
                      onChange={(e) => handlePurchasedChange(idx, 'cost', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Subtotal</label>
                    <input
                      type="text"

                      value={Math.round(item.subtotal || 0).toLocaleString('id-ID')}
                      className="w-full px-3 py-2 bg-slate-50 rounded border border-slate-200 text-slate-500 outline-none text-right font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePurchased(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Rejection Row */}
            <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5 text-sm font-medium text-slate-700 text-right pr-4">
                  Rejection
                </div>
                <div className="col-span-2 relative">
                  <input
                    type="number"
                    value={formData.rejection_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, rejection_rate: Number(e.target.value) || 0 }))}
                    className="w-full pl-3 pr-8 py-2 bg-white rounded border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none text-right text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                </div>
                <div className="col-span-1"></div>
                <div className="col-span-4"></div>
              </div>
              <div className="w-48 pr-11">
                <input
                  type="text"
                  readOnly
                  value={Math.round(rejectionSubtotal).toLocaleString('id-ID')}
                  className="w-full px-3 py-2 bg-transparent text-slate-700 outline-none text-right font-medium"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddPurchased}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* PROCESS COST */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex justify-between items-center">
            <span>PROCESS COST</span>
            <div className="text-right flex items-center gap-4">
              <span className="text-sm font-normal text-slate-500">Total:</span>
              <span className="text-xl font-bold text-blue-700">{Math.round(processSubtotalSum).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-4">
            {formData.process_costs.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 relative">
                <div className="flex-1 grid grid-cols-12 gap-4">
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500">Desc.</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleProcessChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500">Location</label>
                    <input
                      type="text"
                      value={item.location}
                      onChange={(e) => handleProcessChange(idx, 'location', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">CT (sec.)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.ct_sec}
                      onChange={(e) => handleProcessChange(idx, 'ct_sec', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500">Rate</label>
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => handleProcessChange(idx, 'rate', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500">Subtotal</label>
                    <input
                      type="text"
                      readOnly
                      value={Math.round(item.subtotal || 0).toLocaleString('id-ID')}
                      className="w-full px-3 py-2 bg-slate-50 rounded border border-slate-200 text-slate-500 outline-none text-right font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveProcess(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddProcess}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* DIES COST */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex justify-between items-center">
            <span>DIES COST</span>
            <div className="text-right flex items-center gap-4">
              <span className="text-sm font-normal text-slate-500">Total:</span>
              <span className="text-xl font-bold text-blue-700">{Math.round(diesSubtotalSum).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-4">
            {formData.dies_costs.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 relative">
                <div className="flex-1 grid grid-cols-12 gap-4">
                  <div className="col-span-5 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Desc.</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleDiesChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">L/T (Val 6yrs)</label>
                    <input
                      type="number"
                      value={item.lt_val}
                      onChange={(e) => handleDiesChange(idx, 'lt_val', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Cost (Mio)</label>
                    <input
                      type="number"
                      value={item.cost_mio}
                      onChange={(e) => handleDiesChange(idx, 'cost_mio', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Subtotal</label>
                    <input
                      type="text"
                      readOnly
                      value={Math.round(item.subtotal || 0).toLocaleString('id-ID')}
                      className="w-full px-3 py-2 bg-slate-50 rounded border border-slate-200 text-slate-500 outline-none text-right font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDies(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddDies}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* OTHER COST */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex justify-between items-center">
            <span>OTHER COST</span>
            <div className="text-right flex items-center gap-4">
              <span className="text-sm font-normal text-slate-500">Total:</span>
              <span className="text-xl font-bold text-blue-700">{Math.round(otherSubtotalSum).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="space-y-4">
            {formData.other_costs.map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start border-b border-slate-100 pb-4 relative">
                <div className="flex-1 grid grid-cols-12 gap-4">
                  <div className="col-span-5 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Desc.</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleOtherChange(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">L/T</label>
                    <input
                      type="number"
                      value={item.lt_val}
                      onChange={(e) => handleOtherChange(idx, 'lt_val', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Cost</label>
                    <input
                      type="number"
                      value={item.cost_val}
                      onChange={(e) => handleOtherChange(idx, 'cost_val', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Subtotal</label>
                    <input
                      type="number"
                      value={item.subtotal}
                      onChange={(e) => handleOtherChange(idx, 'subtotal', Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-100 rounded border border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right font-medium"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveOther(idx)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove Row"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddOther}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded transition-colors"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="mb-8">
          <div className="bg-slate-800 px-4 py-3 text-sm font-bold text-white uppercase tracking-wider mb-6 rounded-t-lg flex justify-between items-center">
            <span>COST SUMMARY</span>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-6 bg-slate-50 p-8 rounded-b-lg border border-slate-200">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-tight">MFG Cost</label>
              <div className="px-4 py-3 bg-emerald-100 border border-emerald-200 rounded-lg text-xl font-black text-emerald-800 text-right">
                {Math.round(totalMFGCost).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-tight">Selling Price</label>
              <input
                type="number"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white rounded-lg border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-xl font-bold text-blue-700 text-right transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 uppercase tracking-tight">GPM (%)</label>
              <div className={`
                px-4 py-3 rounded-lg text-xl font-black text-right border
                ${Number(formData.gpm_pct) >= 20 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  Number(formData.gpm_pct) >= 10 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-red-50 text-red-700 border-red-200'}
              `}>
                {Number(formData.gpm_pct).toFixed(2)}%
              </div>
            </div>

            <div className="space-y-1 text-right pt-6">
              <div className="flex justify-end gap-8">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase block">UC</label>
                  <input
                    type="number"
                    name="uc"
                    value={formData.uc}
                    onChange={handleChange}
                    className="w-32 px-3 py-2 bg-white rounded border border-slate-200 text-right font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase block">UCM (%)</label>
                  <input
                    type="number"
                    name="ucm_pct"
                    value={formData.ucm_pct}
                    onChange={handleChange}
                    className="w-32 px-3 py-2 bg-white rounded border border-slate-200 text-right font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NOTE */}
        <div className="mb-8">
          <div className="bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
            <span>Note</span>
          </div>
          <textarea
            name="note"
            value={formData.note}
            onChange={handleChange}
            placeholder="Tambahkan catatan di sini..."
            className="w-full px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] transition-all"
          />
        </div>

        <div className="pt-8 border-t border-slate-100 flex justify-end items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className={`
              px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all flex items-center gap-2
              ${saving ? 'opacity-70 cursor-not-allowed' : ''}
            `}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Simpan {typeLabel}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FeasibilityStdCostTab;
