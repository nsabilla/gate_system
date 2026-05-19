import React from 'react';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';

export type ConfirmAction =
  | { type: 'delete-product'; productId: number; productLabel: string }
  | { type: 'delete-rfq'; rfqId: number; rfqNo: string }
  | {
      type: 'move-activity';
      rfqId: number;
      code: string;
      targetDate: string;
      remarks: string;
      activityLabel: string;
    };

export type ResultModal = {
  status: 'success' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
};

const getConfirmContent = (confirmAction: ConfirmAction) => {
  if (confirmAction.type === 'delete-product') {
    return {
      title: 'Konfirmasi Hapus Product',
      description: `Product ${confirmAction.productLabel} akan dihapus dari RFQ ini. Lanjutkan?`,
      actionLabel: 'Ya, Hapus Product',
    };
  }

  if (confirmAction.type === 'delete-rfq') {
    return {
      title: 'Konfirmasi Hapus RFQ',
      description: `RFQ ${confirmAction.rfqNo} beserta seluruh detailnya akan dihapus permanen. Lanjutkan?`,
      actionLabel: 'Ya, Hapus RFQ',
    };
  }

  return {
    title: 'Konfirmasi Move Activity',
    description: `Status akan dipindahkan ke activity ${confirmAction.activityLabel}. Pastikan data target date dan remarks sudah benar.`,
    actionLabel: 'Ya, Simpan Perubahan',
  };
};

type ConfirmActionModalProps = {
  confirmAction: ConfirmAction | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  confirmAction,
  loading,
  onClose,
  onConfirm,
}) => {
  if (!confirmAction) return null;

  const content = getConfirmContent(confirmAction);

  return (
    <div className="rfq-modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="rfq-modal-card w-full max-w-lg overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-2xl">
        <div className="rfq-modal-header px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-800">{content.title}</div>
              <div className="mt-1 text-sm text-slate-600">{content.description}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            disabled={loading}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Memproses...' : content.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

type ActionResultModalProps = {
  resultModal: ResultModal | null;
  onClose: () => void;
};

export const ActionResultModal: React.FC<ActionResultModalProps> = ({ resultModal, onClose }) => {
  if (!resultModal) return null;
  const actionLabel = resultModal.actionLabel || 'Oke, Mengerti';

  return (
    <div className="rfq-modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <div className="rfq-result-card w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-full p-2 ${
                resultModal.status === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {resultModal.status === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </div>

            <div className="flex-1">
              <div className="text-base font-semibold text-slate-800">{resultModal.title}</div>
              <div className="mt-1 text-sm text-slate-600">{resultModal.message}</div>
            </div>

            <button
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={onClose}
              aria-label="Tutup hasil"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 text-right sm:px-6">
          <button
            className="rounded-xl bg-[#0D79BD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a66a1]"
            onClick={onClose}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
