'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Search, Loader2, Building2, Phone, User, FileText, AlertCircle } from 'lucide-react';
import { approveAgentApplicationAction, rejectAgentApplicationAction } from '@/app/actions/manager';

interface ApplicationItem {
  id: string;
  user_id: string;
  campus_id: string;
  full_name: string;
  phone: string;
  id_number: string;
  hostel_name: string;
  relationship_to_hostel: string;
  owner_contact: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  campuses?: { name: string; slug: string } | null;
}

interface ApplicationsTableClientProps {
  initialApplications: ApplicationItem[];
}

export function ApplicationsTableClient({ initialApplications }: ApplicationsTableClientProps) {
  const [applications, setApplications] = useState<ApplicationItem[]>(initialApplications);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeApp, setActiveApp] = useState<ApplicationItem | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredApps = applications.filter((app) => {
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    const matchesSearch =
      searchQuery === '' ||
      app.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.hostel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.phone.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const handleApprove = async (app: ApplicationItem) => {
    setLoadingId(app.id);
    setErrorMsg(null);
    try {
      const res = await approveAgentApplicationAction(app.id);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setApplications((prev) =>
          prev.map((item) =>
            item.id === app.id ? { ...item, status: 'approved' } : item
          )
        );
        setActiveApp(null);
        setActionType(null);
      }
    } catch {
      setErrorMsg('Failed to approve application.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (app: ApplicationItem) => {
    if (!rejectReason.trim()) {
      setErrorMsg('Please enter a reason for rejecting this application.');
      return;
    }
    setLoadingId(app.id);
    setErrorMsg(null);
    try {
      const res = await rejectAgentApplicationAction(app.id, rejectReason);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setApplications((prev) =>
          prev.map((item) =>
            item.id === app.id
              ? { ...item, status: 'rejected', rejection_reason: rejectReason }
              : item
          )
        );
        setActiveApp(null);
        setActionType(null);
        setRejectReason('');
      }
    } catch {
      setErrorMsg('Failed to reject application.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applicants, hostels, phone numbers..."
            className="w-full h-9 pl-9 pr-3 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
                filterStatus === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm">
          No agent applications found matching your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 hover:border-slate-300 transition-all space-y-3 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{app.full_name}</h3>
                    <span className="text-xs text-slate-500">ID: {app.id_number}</span>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">{app.hostel_name}</span> •{' '}
                    <span>{app.campuses?.name || 'Campus'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      app.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : app.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {app.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                    {app.status === 'approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {app.status === 'rejected' && <XCircle className="h-3.5 w-3.5" />}
                    {app.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                <p>
                  <strong>Role:</strong> {app.relationship_to_hostel}
                </p>
                <p>
                  <strong>Applicant Phone:</strong> {app.phone}
                </p>
                {app.owner_contact && (
                  <p>
                    <strong>Owner Phone:</strong> {app.owner_contact}
                  </p>
                )}
                <p className="text-slate-400">
                  Submitted {new Date(app.created_at).toLocaleDateString()}
                </p>
              </div>

              {app.status === 'rejected' && app.rejection_reason && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-800">
                  <strong>Rejection Reason:</strong> {app.rejection_reason}
                </div>
              )}

              {/* Action buttons for pending applications */}
              {app.status === 'pending' && (
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setActiveApp(app);
                      setActionType('reject');
                      setErrorMsg(null);
                    }}
                    disabled={loadingId === app.id}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => {
                      setActiveApp(app);
                      setActionType('approve');
                      setErrorMsg(null);
                    }}
                    disabled={loadingId === app.id}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {loadingId === app.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Approve as Agent
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {activeApp && actionType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {actionType === 'approve'
                ? `Approve ${activeApp.full_name}?`
                : `Reject Application for ${activeApp.full_name}?`}
            </h3>

            {actionType === 'approve' ? (
              <p className="text-xs text-slate-600 leading-relaxed">
                Approving this application will promote <strong>{activeApp.full_name}</strong> to an official Agent for <strong>{activeApp.hostel_name}</strong>. Their account role will become <span className="font-semibold text-slate-900">agent</span>.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Please provide a clear reason for declining this application. This will be visible to the applicant.
                </p>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Could not verify property ownership with landlord."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setActiveApp(null);
                  setActionType(null);
                  setRejectReason('');
                  setErrorMsg(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  actionType === 'approve'
                    ? handleApprove(activeApp)
                    : handleReject(activeApp)
                }
                disabled={loadingId === activeApp.id}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {loadingId === activeApp.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm {actionType === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
