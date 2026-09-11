import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Building2,
  MessageCircle,
  Plus,
  Wallet,
  Eye,
  CalendarCheck,
  ArrowRight,
  User,
  CreditCard,
  AlertCircle,
  Sparkles,
  Hotel,
  Bed,
} from 'lucide-react';
import Link from 'next/link';
import { RoleGuideBanner } from '@/components/dashboard/role-guide-banner';
import { SuspensionBanner } from './suspension-banner';

export const revalidate = 0;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  let { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (agentError) {
    console.error('Error finding agent:', agentError);
  }

  if (!agent) {
    const displayName =
      user.user_metadata?.full_name || user.user_metadata?.name || null;
    const agentName = displayName || 'New Agent';
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        user_id: user.id,
        name: agentName,
        phone: '+254114845619',
        whatsapp: '+254114845619',
        commission_balance: 0,
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to auto-create agent profile:', createError);
      return (
        <div className="bg-white p-8 rounded-2xl border border-rose-100 text-center text-rose-600 max-w-md mx-auto mt-12">
          <h2 className="font-bold text-xl mb-2">Agent Access Error</h2>
          <p className="text-sm text-slate-600">
            Could not find or create an agent profile associated with this
            account. Please contact administrator Paul.
          </p>
        </div>
      );
    }
    agent = newAgent;
  }

  const { data: agentPayments } = await supabase
    .from('agents')
    .select('pochi_la_biashara_number, expected_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const hasPochi =
    agentPayments?.pochi_la_biashara_number &&
    agentPayments.pochi_la_biashara_number.trim() !== '' &&
    agentPayments?.expected_name &&
    agentPayments.expected_name.trim() !== '';

  const { data: listings } = await supabase
    .from('listings')
    .select('id, is_active')
    .eq('agent_id', agent.id);

  const activeListingsCount =
    listings?.filter((l: any) => l.is_active).length || 0;

  const { count: leadsThisMonthCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte(
      'clicked_at',
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString(),
    );

  const { count: totalLeadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.id);

  const { count: pendingToursCount } = await supabase
    .from('tour_bookings')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .in('status', ['pending_payment', 'confirmed', 'contacted']);

  const { data: paidTours } = await supabase
    .from('tour_bookings')
    .select('amount')
    .eq('agent_id', agent.id)
    .in('status', ['paid', 'completed']);

  const tourEarnings = (paidTours || []).reduce(
    (acc: number, t: any) => acc + (t.amount || 0),
    0,
  );

  const isSuspended = agent.status === 'suspended';
  const firstName = (agent.name || 'Agent').split(' ')[0];
  const greeting = `${getGreeting()}, ${firstName} 👋`;

  if (isSuspended) {
    return (
      <div className="space-y-6">
        <SuspensionBanner
          agentName={agent.name}
          suspensionReason={agent.suspension_reason || 'No reason provided.'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome & Greeting Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              {greeting}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {activeListingsCount > 0
                ? `You have ${activeListingsCount} active listing${activeListingsCount !== 1 ? 's' : ''} bringing in student leads.`
                : 'Create your first listing to start receiving student leads.'}
            </p>
          </div>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            New Listing
          </Link>        </div>
      </div>

      <RoleGuideBanner
        title="Agent guide for a smoother workflow"
        description="These steps help you focus on listings and student enquiries without spending extra time figuring out the dashboard."
        checklist={[
          'Create a listing with the campus-specific hostel area that matches the property location.',
          'Keep your payment details updated so students can pay your consultation fee easily.',
          'Review tour bookings and respond promptly to pending requests.',
          'Use analytics and leads to understand which listings are attracting attention.',
        ]}
        storageKey="agent-dashboard-guide-dismissed"
        icon={<Sparkles className="h-4 w-4" />}
      />

      {/* Notification Banner */}
      {!hasPochi && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Payment details missing
            </p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Add your Pochi la Biashara number and registered name so students
              can pay your consultation fee directly. Otherwise, your WhatsApp
              number and name will be used in messages.{' '}
              <Link
                href="/dashboard/payment"
                className="font-semibold text-amber-700 underline hover:text-amber-900"
              >
                Set it up now
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* Navigation Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* My Listings Card */}
        <Link
          href="/dashboard/listings"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {activeListingsCount} Active
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                My Listings
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Manage your hostel listings, photos, pricing, and availability.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-emerald-700">
            <span>Manage Listings</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Tours Card */}
        <Link
          href="/dashboard/tours"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {pendingToursCount || 0} Pending
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors leading-tight">
                Tour Bookings
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                {(pendingToursCount || 0) > 0
                  ? `${pendingToursCount} tour${pendingToursCount !== 1 ? 's' : ''} awaiting your action.`
                  : 'View and manage all scheduled student tours.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-amber-700">
            <span>View Tours</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Analytics Card (includes leads + views + commissions) */}
        <Link
          href="/dashboard/analytics"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {leadsThisMonthCount || 0} Leads
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                Analytics & Leads
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Student views across all your listings over time.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-indigo-600">
            <span>View Analytics</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Tour Earnings Card */}
        <Link
          href="/dashboard/earnings"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                KES {tourEarnings.toLocaleString()}
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-rose-600 transition-colors leading-tight">
                Tour Earnings
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Revenue from completed and paid tour bookings.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-rose-600">
            <span>View Earnings</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Student Leads Card */}
        <Link
          href="/dashboard/leads"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                {totalLeadsCount || 0} Total
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                Student Leads
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                {(totalLeadsCount || 0) > 0
                  ? `${totalLeadsCount} total lead${totalLeadsCount !== 1 ? 's' : ''} across all listings.`
                  : 'Leads will appear when students view your listings.'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-blue-600">
            <span>View Leads</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* RumiaBnB Card */}
        <Link
          href="/dashboard/bnb"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bed className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 text-emerald-700 tabular-nums">
                Short stays
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                RumiaBnB
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                List your short-stay property and reach guests across Kenya.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-emerald-700">
            <span>Manage BnB listings</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Hostels Directory Card */}
        <Link
          href="/dashboard/hostels"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Hotel className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                Directory
              </span>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors leading-tight">
                Hostels Directory
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Browse official DeKUT records and all agent-uploaded hostels
                with occupancy status.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-amber-700">
            <span>View Hostels</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Payment Details Card */}
        <Link
          href="/dashboard/payment"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight">
                Payment Details
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Set up Pochi la Biashara number and registered name for
                consultation fee collection.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-emerald-700">
            <span>{hasPochi ? 'Payment set' : 'Add payment details'}</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Profile Card */}
        <Link
          href="/dashboard/profile"
          className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
            <div>
              <h3 className="text-xs sm:text-base font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-tight">
                Profile & Settings
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                Update your profile, service areas, and notification
                preferences.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-slate-700">
            <span>Edit Profile</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
