'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Inbox,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  Check,
  Phone,
  MapPin,
  CalendarDays,
  MessageSquareText,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  updateHostelRequestStatusAction,
} from '@/app/actions/hostel-requests';
import {
  getHostelRequestStatus,
  HOSTEL_REQUEST_STATUSES,
  budgetLabel,
  genderLabel,
  roomTypeLabel,
  furnishingLabel,
} from '@/lib/constants/hostel-requests';
import { buildHostelRequestWhatsAppMessage } from '@/lib/utils/hostel-request-message';
import type { HostelRequestWithCampus, HostelRequestStatus } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { CopyButton } from '@/components/ui/copy-button';

interface HostelRequestsClientProps {
  initialRequests: HostelRequestWithCampus[];
  waitingCount: number;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}

export function HostelRequestsClient({
  initialRequests,
  waitingCount,
}: HostelRequestsClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'waiting'>('all');
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const selected = useMemo(
    () => requests.find((r) => r.id === expandedId) ?? null,
    [requests, expandedId],
  );

  const visibleRequests = useMemo(
    () => (filter === 'waiting' ? requests.filter((r) => r.status === 'waiting') : requests),
    [requests, filter],
  );

  const whatsappMessage = useMemo(
    () =>
      selected
        ? buildHostelRequestWhatsAppMessage({
            studentName: selected.student_name,
            preferredZone: selected.preferred_zone,
            budgetRange: selected.budget_range,
            gender: selected.gender,
            roomType: selected.room_type,
            furnishing: selected.furnishing,
            moveInDate: selected.move_in_date,
            phone: selected.phone,
            additionalRequirements: selected.additional_requirements,
            fee: selected.fee,
          })
        : '',
    [selected],
  );

  const handleStatusChange = useCallback(
    async (id: string, status: HostelRequestStatus) => {
      setStatusUpdating(id);
      const res = await updateHostelRequestStatusAction(id, status);
      setStatusUpdating(null);

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, updated_at: new Date().toISOString() } : r,
        ),
      );
      toast.success(`Status updated to "${getHostelRequestStatus(status).label}".`);
    },
    [],
  );

  return (
    <div className="space-y-6">
      {/* Filter + count summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors',
            filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
          )}
        >
          All ({requests.length})
        </button>
        <button
          onClick={() => setFilter('waiting')}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors',
            filter === 'waiting'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
          )}
        >
          Waiting ({waitingCount})
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center space-y-2">
          <Inbox className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No hostel requests yet</p>
          <p className="text-xs text-slate-500">
            When a student submits a &quot;Find Me a Hostel&quot; request it will
            appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRequests.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
              No waiting requests. You&apos;re all caught up!
            </div>
          )}

          {visibleRequests.map((request) => {
            const status = getHostelRequestStatus(request.status);
            const expanded = expandedId === request.id;
            return (
              <div
                key={request.id}
                className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden"
              >
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : request.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center gap-3"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                      status.badgeClass,
                    )}
                  >
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {request.student_name}
                      </p>
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold',
                          status.badgeClass,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {request.phone} • {request.preferred_zone || 'Any area'} •{' '}
                      {budgetLabel(request.budget_range)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {request.campuses?.name || 'Unknown campus'} •{' '}
                      {formatDate(request.created_at, 'd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                      KSh {request.fee.toLocaleString()}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-transform',
                        expanded && 'rotate-180',
                      )}
                    />
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-5">
                    <DetailRow label="Student name" value={request.student_name} />
                    <DetailRow label="Phone" value={request.phone} />
                    <DetailRow
                      label="Campus"
                      value={request.campuses?.name || 'Unknown'}
                    />
                    <DetailRow
                      label="Preferred zone"
                      value={request.preferred_zone || 'Any area'}
                    />
                    <DetailRow
                      label="Budget"
                      value={`${budgetLabel(request.budget_range)}/month`}
                    />
                    <DetailRow label="Gender" value={genderLabel(request.gender)} />
                    <DetailRow
                      label="Room type"
                      value={roomTypeLabel(request.room_type)}
                    />
                    <DetailRow
                      label="Furnishing"
                      value={furnishingLabel(request.furnishing)}
                    />
                    <DetailRow
                      label="Move-in date"
                      value={
                        request.move_in_date
                          ? formatDate(request.move_in_date, 'd MMM yyyy')
                          : 'Flexible'
                      }
                    />
                    <DetailRow
                      label="Additional requirements"
                      value={
                        request.additional_requirements?.trim() || 'None'
                      }
                    />
                    <DetailRow
                      label="Request date"
                      value={formatDate(request.created_at, 'd MMM yyyy, HH:mm')}
                    />
                    <DetailRow
                      label="Request status"
                      value={
                        <span
                          className={cn(
                            'inline-flex px-2 py-0.5 rounded-full border text-[11px] font-bold',
                            status.badgeClass,
                          )}
                        >
                          {status.label}
                        </span>
                      }
                    />
                    <DetailRow label="Request fee" value={`KSh ${request.fee.toLocaleString()}`} />

                    {/* WhatsApp message + copy */}
                    <div className="pt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-emerald-600" />
                        <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                          WhatsApp Message
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                        {whatsappMessage}
                      </div>
                      <CopyButton
                        textToCopy={whatsappMessage}
                        label="Copy WhatsApp Message"
                        successMessage="WhatsApp message copied. Paste it to the student."
                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 border-transparent text-white font-bold [&>span]:text-white [&>svg]:text-white"
                      />
                    </div>

                    {/* Status workflow */}
                    <div className="pt-1 space-y-2">
                      <p className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Update status
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {HOSTEL_REQUEST_STATUSES.filter(
                          (s) => s.value !== request.status,
                        ).map((s) => (
                          <button
                            key={s.value}
                            onClick={() => handleStatusChange(request.id, s.value)}
                            disabled={statusUpdating === request.id}
className={cn(
                                'px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-50',
                                s.badgeClass,
                                'hover:brightness-95',
                              )}
                            >
                              {s.label}
                            </button>
                        ))}
                        {statusUpdating === request.id && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Updating…
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Follow the flow: Contact student → help them find a
                        suitable hostel → update the status as it progresses.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}