import { createClient } from '@/lib/supabase/server';
import { agentDashboardApi } from '@/lib/api/agent-dashboard';
import { redirect } from 'next/navigation';
import { ArrowLeft, Wallet, CalendarCheck } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0;

export default async function AgentEarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const agent = await agentDashboardApi.getSelf().catch(() => null);

  if (!agent) redirect('/dashboard');

  const { items } = await agentDashboardApi
    .tours('date_desc')
    .catch(() => ({ items: [] }));
  // The earnings table reads the legacy `listings` key.
  const tours = items.map((b) => ({ ...b, listings: b.listing ?? null }));

  const paidTours = tours.filter(
    (t: any) => t.status === 'paid' || t.status === 'completed'
  );
  const pendingTours = tours.filter(
    (t: any) => t.status === 'confirmed' || t.status === 'pending_payment'
  );

  const totalEarned = paidTours.reduce(
    (acc: number, t: any) => acc + (t.amount || 0),
    0
  );
  const pendingAmount = pendingTours.reduce(
    (acc: number, t: any) => acc + (t.amount || 0),
    0
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Tour Earnings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Revenue from your completed and paid tour bookings.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Earned
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              KES {totalEarned.toLocaleString()}
            </h3>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 text-amber-600">
            <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pending
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
              KES {pendingAmount.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Tour Breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">All Tour Bookings</h2>
        {tours.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center">
            <p className="text-sm text-slate-400 font-semibold">
              No tour bookings yet.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden divide-y divide-slate-100">
            {tours.map((tour: any) => (
              <div
                key={tour.id}
                className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {tour.listings?.title || 'Guided Tour'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(tour.preferred_date + 'T00:00:00').toLocaleDateString('en-KE', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    {tour.preferred_time}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {tour.status === 'paid' || tour.status === 'completed' ? (
                    <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      Paid
                    </span>
                  ) : tour.status === 'confirmed' ? (
                    <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      Confirmed
                    </span>
                  ) : (
                    <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      Pending
                    </span>
                  )}
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    KES {(tour.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
