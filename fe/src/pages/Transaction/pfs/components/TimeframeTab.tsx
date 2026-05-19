import React from 'react';

type Ctx = any;

const TimeframeTab: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const {
    canViewPFS,
    moveCode,
    setMoveCode,
    moveTargetDate,
    setMoveTargetDate,
    moveRemarks,
    setMoveRemarks,
    moveActivity,
    saving,
    selectedRFQId,
    activityOptions,
    currentPIC,
    disableApproveSave,
    timeline,
    fetchTimeFrame,
    formatDateTimeInAppTZ,
  } = ctx;

  return (
    <div className="space-y-5">
      <fieldset disabled={!canViewPFS}>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">Time Frame</h3>
            <div className="text-sm text-gray-500">Manage activity status and approval timeline</div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="text-gray-700">Status Activity</span>
                <select
                  value={moveCode || ''}
                  onChange={(e) => setMoveCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Status</option>
                  {Array.isArray(activityOptions) && activityOptions.map((s: any) => (
                    <option key={s.code_act || s.code} value={s.code_act || s.code}>{s.descr || s.label || s.code}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">PIC</span>
                <input value={currentPIC || ''} readOnly className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Target Date</span>
                <input
                  type="date"
                  value={moveTargetDate || ''}
                  onChange={(e) => setMoveTargetDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Remark</span>
                <input
                  value={moveRemarks || ''}
                  onChange={(e) => setMoveRemarks(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disableApproveSave}
                onClick={moveActivity}
                className="rounded-lg bg-[#0D79BD] px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => fetchTimeFrame && selectedRFQId && fetchTimeFrame(selectedRFQId)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </fieldset>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h4 className="mb-3 text-sm font-semibold text-gray-800">Timeline</h4>
        <div className="space-y-3">
          {Array.isArray(timeline) && timeline.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">Belum ada timeline.</div>
          )}
          {Array.isArray(timeline) && timeline.map((t: any, idx: number) => (
            <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <div className="text-sm font-medium text-gray-700">{t.activity_name || t.status || t.code}</div>
                <div className="text-xs text-gray-500">{t.actor_name || t.user || ''} • {t.notes || ''}</div>
              </div>
              <div className="text-xs text-gray-500">{(formatDateTimeInAppTZ && t.updated_at) ? formatDateTimeInAppTZ(t.updated_at) : String(t.updated_at || '')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimeframeTab;
