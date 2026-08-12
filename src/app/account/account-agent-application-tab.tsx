'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Loader2, Building2, User, Phone, FileText, LayoutDashboard } from 'lucide-react';
import { submitAgentApplicationAction, getMyAgentApplicationsAction } from '@/app/actions/agent-application';
import { BrandedLoader } from '@/components/ui/branded-loader';
import Link from 'next/link';
import type { Campus } from '@/types';

interface AccountAgentApplicationTabProps {
  onBackToOverview: () => void;
  userProfile?: {
    full_name: string | null;
    phone: string | null;
    home_campus_id?: string | null;
  };
  campuses: Campus[];
  hasAgent?: boolean;
}

interface ApplicationRecord {
  id: string;
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
  campuses?: { name: string; slug: string } | { name: string; slug: string }[] | null;
}

export function AccountAgentApplicationTab({
  onBackToOverview,
  userProfile,
  campuses,
  hasAgent = false,
}: AccountAgentApplicationTabProps) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form State
  const [fullName, setFullName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [idNumber, setIdNumber] = useState('');
  const [campusId, setCampusId] = useState(userProfile?.home_campus_id || (campuses[0]?.id ?? ''));
  const [hostelName, setHostelName] = useState('');
  const [relationship, setRelationship] = useState('Hostel Owner');
  const [ownerContact, setOwnerContact] = useState('');

  useEffect(() => {
    async function loadApps() {
      try {
        const apps = await getMyAgentApplicationsAction();
        setApplications(apps as ApplicationRecord[]);
      } catch {
        // ignore
      } finally {
        setLoadingApps(false);
      }
    }
    loadApps();
  }, []);

  const hasPendingApp = applications.some((app) => app.status === 'pending');
  const hasApprovedApp = applications.some((app) => app.status === 'approved');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await submitAgentApplicationAction({
        campus_id: campusId,
        full_name: fullName,
        phone,
        id_number: idNumber,
        hostel_name: hostelName,
        relationship_to_hostel: relationship,
        owner_contact: ownerContact,
      });

      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setSubmitted(true);
        const updated = await getMyAgentApplicationsAction();
        setApplications(updated as ApplicationRecord[]);
      }
    } catch {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToOverview}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          title="Back to Overview"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {hasAgent ? 'Agent Status' : 'Apply to become an Agent'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {hasAgent
              ? 'You are already a registered Rumia agent.'
              : 'Submit your application to manage hostels and receive student leads.'}
          </p>
        </div>
      </div>

      {/* Already an agent */}
      {hasAgent && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-semibold text-emerald-900">You are an approved Rumia Agent</p>
          </div>
          <p className="text-sm text-emerald-800">
            You can now create hostel listings and receive student leads. Head to your agent dashboard to get started.
          </p>
          <p className="text-xs text-emerald-700">
            Tip: tap the dashboard icon at the top right of the screen to switch to your agent dashboard at any time.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Go to Agent Dashboard
          </Link>
        </div>
      )}

      {/* Not yet an agent — show application flow */}
      {!hasAgent && (
        <>
          {loadingApps ? (
            <div className="flex items-center justify-center py-10" role="status" aria-live="polite" aria-busy="true">
              <BrandedLoader size={72} text="Checking your application status..." className="p-0" />
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Your Applications</h2>
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm">
                      {app.hostel_name} (
                      {Array.isArray(app.campuses)
                        ? app.campuses[0]?.name || 'Campus'
                        : app.campuses?.name || 'Campus'}
                      )
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        app.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : app.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {app.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                      {app.status === 'approved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {app.status === 'rejected' && <AlertCircle className="h-3.5 w-3.5" />}
                      {app.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                    <span>Role: {app.relationship_to_hostel}</span>
                  </div>
                  {app.status === 'rejected' && app.rejection_reason && (
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-800">
                      <strong>Reason:</strong> {app.rejection_reason}
                    </div>
                  )}
                  {app.status === 'approved' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2">
                      <p className="text-sm font-semibold text-emerald-900">Your application was approved!</p>
                      <p className="text-xs text-emerald-800">
                        You can now access the agent dashboard to create hostel listings and receive student leads.
                        Look for the dashboard icon at the top right of the screen to switch to your agent view.
                      </p>
                      <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Open Agent Dashboard
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Post-submit confirmation */}
          {submitted && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="font-semibold text-emerald-900">Application submitted!</p>
              </div>
              <p className="text-sm text-emerald-800">
                Your application is under review. Once approved by the system, you will gain access to the agent dashboard where you can create hostel listings and start receiving student leads.
              </p>
            </div>
          )}

          {/* Show form only if no pending/approved app and not just submitted */}
          {!submitted && !hasPendingApp && !hasApprovedApp && (
            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Agent Application Form
              </h2>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" /> Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone Number (M-Pesa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-slate-400" /> National ID / Passport *
                  </label>
                  <input
                    type="text"
                    required
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" /> Campus *
                  </label>
                  <select
                    required
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.short_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Hostel / Property Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    placeholder="e.g. Sunrise Heights Hostel"
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Relationship to Hostel *
                  </label>
                  <select
                    required
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="Hostel Owner">Hostel Owner</option>
                    <option value="Caretaker / Manager">Caretaker / Manager</option>
                    <option value="Student Agent">Student Agent / Marketer</option>
                    <option value="Leasing Partner">Leasing Partner</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Landlord / Owner Contact (Optional)
                </label>
                <input
                  type="text"
                  value={ownerContact}
                  onChange={(e) => setOwnerContact(e.target.value)}
                  placeholder="e.g. 0722000111 (if you are caretaker/agent)"
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting Application...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          )}

          {hasPendingApp && !submitted && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
              <p className="font-medium">Application Under Review</p>
              <p className="text-xs text-amber-700 mt-1">
                Your application is pending review. Once approved, you will gain access to the agent dashboard to create hostel listings and receive student leads.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
