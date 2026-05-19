import React from 'react';

type Ctx = any;

const DrawingTab: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const {
    drawings,
    handleSelectDrawing,
    saveDrawing,
    uploadingDrawing,
    selectedDrawingFile,
    canCrudPFS,
    selectedRFQId,
    isRFQApproved,
    handleDeleteDrawing,
    outHouseAttachments,
    handleSelectOutHouseAttachment,
    saveOutHouseAttachment,
    uploadingOutHouseAttachment,
    selectedOutHouseFile,
    handleDeleteOutHouseAttachment,
  } = ctx;

  return (
    <div className="flex flex-col gap-8">
      {/* SECTION 1: DRAWING DOCUMENT */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Drawing Document</h3>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 group hover:border-blue-400/50 hover:bg-blue-50/20 transition-all">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,.pdf"
              onChange={handleSelectDrawing}
              disabled={!canCrudPFS || uploadingDrawing}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm border border-slate-100 mb-4 group-hover:scale-110 transition-transform">
              <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="mb-1 text-base font-bold text-slate-800">Pilih File Drawing</h3>
            <p className="mb-4 text-xs text-slate-500 text-center max-w-xs">Tarik & lepas file atau klik untuk menelusuri (PNG, JPG, SVG, PDF)</p>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-blue-600 border border-blue-100 shadow-sm uppercase tracking-tighter">Max size: 10MB</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 pt-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">File Terpilih</span>
              <p className="text-sm font-medium text-slate-700">{selectedDrawingFile ? selectedDrawingFile.name : 'Belum ada file dipilih'}</p>
            </div>
            <button
              type="button"
              disabled={!canCrudPFS || !selectedRFQId || !isRFQApproved || !selectedDrawingFile || uploadingDrawing}
              onClick={saveDrawing}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              {uploadingDrawing ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Uploading...
                </>
              ) : 'Upload Drawing'}
            </button>
          </div>

          {/* LIST DRAWINGS */}
          {drawings && drawings.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daftar Dokumen</span>
              {drawings.map((d: any) => (
                <div key={d.id} className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-blue-100 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-slate-100 text-blue-500 shadow-sm">
                       <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{d.original_name}</div>
                      <div className="text-[10px] font-medium text-slate-500 uppercase">{d.mime_type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={d.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">View</a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDrawing(d.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: VENDOR PRICE */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between rounded-lg bg-slate-100/80 px-4 py-3 border border-slate-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Vendor Price / Out House Purchasing</h3>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih Lampiran (.xls, .doc)</span>
              <input
                type="file"
                accept=".xls,.xlsx,.doc,.docx"
                onChange={handleSelectOutHouseAttachment}
                disabled={!canCrudPFS || uploadingOutHouseAttachment}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/30 px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              type="button"
              disabled={!canCrudPFS || !selectedRFQId || !isRFQApproved || !selectedOutHouseFile || uploadingOutHouseAttachment}
              onClick={saveOutHouseAttachment}
              className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-900 active:scale-95 disabled:opacity-50"
            >
              {uploadingOutHouseAttachment ? 'Uploading...' : 'Upload Attachment'}
            </button>
          </div>

          <div className="mt-8 space-y-3">
            {outHouseAttachments && outHouseAttachments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                <p className="text-xs font-medium text-slate-400">Belum ada lampiran Out House Purchasing yang diupload.</p>
              </div>
            ) : (
              outHouseAttachments?.map((f: any) => (
                <div key={f.id} className="group flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{f.original_name}</div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase">{f.mime_type}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={f.url} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">Download</a>
                    <button
                      type="button"
                      onClick={() => handleDeleteOutHouseAttachment(f.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawingTab;