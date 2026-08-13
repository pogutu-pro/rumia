import Link from 'next/link';
import { getManagerUser } from '@/app/actions/manager';
import { createClient } from '@/lib/supabase/server';
import {
  FileCheck2,
  Users,
  Building2,
  AlertCircle,
  ArrowRight,
  MapPin,
  Settings,
  Compass,
  MessageSquareText,
  Megaphone,
  Wallet,
} from 'lucide-react';
import { RoleGuideBanner } from '@/components/dashboard/role-guide-banner';
import { PaymentsCard } from './payments-card';
import { PushNotificationsCard } from '@/components/notifications/push-notifications-card';

export default async function ManagerDashboardPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized: You do not have permission to view manager pages.
      </div>
    );
  }

  const { context } = manager;
  const supabase = await createClient();

  let allowedCampusIds: string[] = [];

  // Scoped count queries
  let pendingAppsQuery = supabase
    .from('agent_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  let agentsQuery = supabase
    .from('agents')
    .select('id', { count: 'exact', head: true });

  let listingsQuery = supabase
    .from('listings')
    .select('id', { count: 'exact', head: true });

  let hostelRequestsQuery = supabase
    .from('hostel_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'waiting');

  if (!context.isSuperAdmin) {
    if (context.managedCampusId) {
      allowedCampusIds = [context.managedCampusId];
    } else if (context.managedRegionId) {
      const { data: campuses } = await supabase
        .from('campuses')
        .select('id')
        .eq('region_id', context.managedRegionId);
      if (campuses) {
        allowedCampusIds = campuses.map((c) => c.id);
      }
    }

    if (allowedCampusIds.length > 0) {
      pendingAppsQuery = pendingAppsQuery.in('campus_id', allowedCampusIds);
      agentsQuery = agentsQuery.in('campus_id', allowedCampusIds);
      listingsQuery = listingsQuery.in('campus_id', allowedCampusIds);
      hostelRequestsQuery = hostelRequestsQuery.in('campus_id', allowedCampusIds);
    } else {
      // If no campuses allowed, return zero for all
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Campus Operations Overview
            </h1>
            <p className="text-sm text-slate-500">
              Manage prospective agent applications, agent standing, and campus
              listings.
            </p>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm">
            No campuses assigned to your region yet.
          </div>
        </div>
      );
    }
  }

  const [appsCountRes, agentsCountRes, listingsCountRes, hostelRequestsCountRes] =
    await Promise.all([
      pendingAppsQuery,
      agentsQuery,
      listingsQuery,
      hostelRequestsQuery,
    ]);

  const pendingAppsCount = appsCountRes.count ?? 0;
  const totalAgentsCount = agentsCountRes.count ?? 0;
  const totalListingsCount = listingsCountRes.count ?? 0;
  const waitingHostelRequestsCount = hostelRequestsCountRes.count ?? 0;

  // Fees for the campuses this manager is scoped to (all campuses for super
  // admins). One lightweight query feeds the dashboard Payments & Fees card.
  let feeCampusesQuery = supabase
    .from('campuses')
    .select('id, name, hostel_finding_fee, consultation_fee')
    .order('name', { ascending: true });
  if (!context.isSuperAdmin && allowedCampusIds.length > 0) {
    feeCampusesQuery = feeCampusesQuery.in('id', allowedCampusIds);
  }
  const { data: feeCampuses } = await feeCampusesQuery;

  const quickActions = [
    {
      href: '/manager/applications',
      title: 'Review Applications',
      desc: 'Approve or reject pending agent applications for your campus.',
      icon: FileCheck2,
      badge: `${pendingAppsCount} Pending`,
      color: 'bg-amber-50 text-amber-600',
      hoverColor: 'group-hover:text-amber-700',
    },
    {
      href: '/manager/agents',
      title: 'Manage Agents',
      desc: 'Monitor standing, suspend, or reinstate active campus agents.',
      icon: Users,
      badge: `${totalAgentsCount} Agents`,
      color: 'bg-emerald-50 text-emerald-600',
      hoverColor: 'group-hover:text-emerald-700',
    },
    {
      href: '/manager/zones',
      title: 'Manage Zones & Pricing',
      desc: 'Define campus geographical areas and set tour pricing.',
      icon: MapPin,
      color: 'bg-slate-100 text-slate-700',
      hoverColor: 'group-hover:text-slate-900',
    },
    {
      href: '/manager/payments',
      title: 'Payments & Fees',
      desc: 'Set hostel-finding and agent consultation fees.',
      icon: Wallet,
      color: 'bg-emerald-50 text-emerald-600',
      hoverColor: 'group-hover:text-emerald-700',
    },
    {
      href: '/manager/settings',
      title: 'Campus Settings',
      desc: 'Update campus branding, contact details, hero copy, and SEO.',
      icon: Settings,
      color: 'bg-slate-100 text-slate-700',
      hoverColor: 'group-hover:text-slate-900',
    },
    {
      href: '/manager/requests',
      title: 'Hostel Requests',
      desc: 'Review student hostel-finding requests and contact them on WhatsApp.',
      icon: MessageSquareText,
      badge: `${waitingHostelRequestsCount} Waiting`,
      color: 'bg-amber-50 text-amber-600',
      hoverColor: 'group-hover:text-amber-700',
    },
    {
      href: '/manager/announcements',
      title: 'Announcements',
      desc: 'Publish campus updates that appear at the top of the public site.',
      icon: Megaphone,
      color: 'bg-slate-100 text-slate-700',
      hoverColor: 'group-hover:text-slate-900',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Campus Operations Overview
        </h1>
        <p className="text-sm text-slate-500">
          Manage prospective agent applications, agent standing, and campus
          listings.
        </p>
      </div>

      <RoleGuideBanner
        title="Manager checklist for smoother campus operations"
        description="Use this guide to keep your campus setup consistent and help agents list properties faster without confusion."
        checklist={[
          'Review and update the valid hostel areas for your campus in Zones & Pricing.',
          'Approve or reject new agent applications before they start listing.',
          'Check agent standing regularly and keep campus settings current.',
          'Use the same campus-specific areas for every listing so students see consistent options.',
        ]}
        storageKey="manager-dashboard-guide-dismissed"
        icon={<Compass className="h-4 w-4" />}
      />

      {/* Metrics Grid — 2 cols on mobile, full cards clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link
          href="/manager/applications"
          className="group bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Pending Apps
            </span>
            <FileCheck2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {pendingAppsCount}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-700 group-hover:text-amber-800 pt-1">
            Review{' '}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <Link
          href="/manager/agents"
          className="group bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Campus Agents
            </span>
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {totalAgentsCount}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-700 group-hover:text-emerald-800 pt-1">
            Manage{' '}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <Link
          href="/manager/listings"
          className="group bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Active Listings
            </span>
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {totalListingsCount}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-emerald-700 group-hover:text-emerald-800 pt-1">
            View{' '}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>

        <Link
          href="/manager/requests"
          className="group bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-2 hover:border-slate-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">
              Hostel Requests
            </span>
            <MessageSquareText className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {waitingHostelRequestsCount}
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-amber-700 group-hover:text-amber-800 pt-1">
            Waiting <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </div>

      {/* Payments & Fees — hostel-finding + consultation fees in one card */}
      <PaymentsCard
        campuses={(feeCampuses || []) as any[]}
        isSuperAdmin={context.isSuperAdmin}
      />

      {/* Push notifications — surface silent alerts + link to settings */}
      <PushNotificationsCard />

      {/* Quick Actions Grid — 2-col on mobile like admin */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {quickActions.map(
            ({ href, title, desc, icon: Icon, badge, color, hoverColor }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${color} flex items-center justify-center`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    {badge && (
                      <span className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                        {badge}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-xs sm:text-base font-bold text-slate-900 ${hoverColor} transition-colors leading-tight`}
                    >
                      {title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed hidden sm:block">
                      {desc}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 ${hoverColor}`}
                >
                  <span>Access</span>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
