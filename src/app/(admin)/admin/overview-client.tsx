'use client';

import Link from 'next/link';
import {
  Building2,
  Users,
  BarChart3,
  DollarSign,
  MousePointerClick,
  CalendarCheck,
  ArrowRight,
  UserCog,
  ArrowLeftRight,
  MessageSquare,
  Landmark,
  Globe,
  ShieldCheck,
  Headset,
} from 'lucide-react';

interface OverviewClientProps {
  stats: {
    activeListings: number;
    monthlyLeads: number;
    pendingCommissionsKes: number;
    activeAgents: number;
    totalCampuses?: number;
    totalRegions?: number;
    totalManagers?: number;
    supportAgents?: number;
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function OverviewClient({ stats }: OverviewClientProps) {
  const greeting = `${getGreeting()}, Admin`;

  const adminCards = [
    {
      href: '/admin/analytics',
      label: 'Analytics',
      description: 'Platform view performance and student engagement metrics.',
      icon: BarChart3,
      color: 'bg-indigo-50 text-indigo-600',
      hoverColor: 'group-hover:text-indigo-600',
      badge: `${stats.monthlyLeads} Leads`,
    },
    {
      href: '/admin/agents',
      label: 'Agents',
      description: 'Manage agent accounts, roles, badges, and performance.',
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600',
      hoverColor: 'group-hover:text-emerald-700',
      badge: `${stats.activeAgents} Active`,
    },
    {
      href: '/admin/users',
      label: 'Users',
      description: 'View and manage all registered student accounts.',
      icon: UserCog,
      color: 'bg-blue-50 text-blue-600',
      hoverColor: 'group-hover:text-blue-600',
    },
    {
      href: '/admin/campuses',
      label: 'Campuses',
      description: 'Create and manage university campuses.',
      icon: Landmark,
      color: 'bg-teal-50 text-teal-600',
      hoverColor: 'group-hover:text-teal-600',
      badge: stats.totalCampuses ? `${stats.totalCampuses} Total` : undefined,
    },
    {
      href: '/admin/regions',
      label: 'Regions',
      description: 'View Kenya&apos;s 47 counties (fixed reference data).',
      icon: Globe,
      color: 'bg-cyan-50 text-cyan-600',
      hoverColor: 'group-hover:text-cyan-600',
      badge: stats.totalRegions ? `${stats.totalRegions} Counties` : undefined,
    },
    {
      href: '/admin/managers',
      label: 'Managers',
      description: 'Assign and manage campus and region managers.',
      icon: ShieldCheck,
      color: 'bg-violet-50 text-violet-600',
      hoverColor: 'group-hover:text-violet-600',
      badge: stats.totalManagers ? `${stats.totalManagers} Active` : undefined,
    },
    {
      href: '/admin/support',
      label: 'Customer Support',
      description: 'Choose who answers students on Hakikisha and set the platform owner.',
      icon: Headset,
      color: 'bg-amber-50 text-amber-600',
      hoverColor: 'group-hover:text-amber-700',
      badge: stats.supportAgents ? `${stats.supportAgents} on page` : undefined,
    },
    {
      href: '/admin/listings',
      label: 'Listings',
      description: 'Manage hostel listings, photos, pricing, and availability.',
      icon: Building2,
      color: 'bg-amber-50 text-amber-600',
      hoverColor: 'group-hover:text-amber-700',
      badge: `${stats.activeListings} Active`,
    },
    {
      href: '/admin/tours',
      label: 'Tours',
      description: 'View and manage all scheduled student tour bookings.',
      icon: CalendarCheck,
      color: 'bg-rose-50 text-rose-600',
      hoverColor: 'group-hover:text-rose-600',
    },
    {
      href: '/admin/leads',
      label: 'Leads',
      description: 'Student leads across all listings and agents.',
      icon: MousePointerClick,
      color: 'bg-purple-50 text-purple-600',
      hoverColor: 'group-hover:text-purple-600',
      badge: `${stats.monthlyLeads} This Month`,
    },
    {
      href: '/admin/commissions',
      label: 'Commissions',
      description: 'Track pending and paid commissions across agents.',
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
      hoverColor: 'group-hover:text-emerald-700',
      badge: `KES ${stats.pendingCommissionsKes.toLocaleString()}`,
    },
    {
      href: '/admin/transfers',
      label: 'Transfers',
      description: 'History of listing ownership transfers between agents.',
      icon: ArrowLeftRight,
      color: 'bg-slate-100 text-slate-600',
      hoverColor: 'group-hover:text-slate-700',
    },
    {
      href: '/admin/feedback',
      label: 'Feedback',
      description: 'Student feedback, feature requests, and reports.',
      icon: MessageSquare,
      color: 'bg-sky-50 text-sky-600',
      hoverColor: 'group-hover:text-sky-600',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome & Greeting Banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-6">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            {stats.activeListings > 0
              ? `${stats.activeListings} active listing${stats.activeListings !== 1 ? 's' : ''} with ${stats.activeAgents} agent${stats.activeAgents !== 1 ? 's' : ''} managing them.`
              : 'Your marketplace overview at a glance.'}
          </p>
        </div>
      </div>

      {/* Navigation Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {adminCards.map(({ href, label, description, icon: Icon, color, hoverColor, badge }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-5 hover:border-slate-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${color} flex items-center justify-center`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                {badge && (
                  <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                    {badge}
                  </span>
                )}
              </div>
              <div>
                <h3 className={`text-xs sm:text-base font-bold text-slate-900 ${hoverColor} transition-colors leading-tight`}>
                  {label}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-2 hidden sm:block">
                  {description}
                </p>
              </div>
            </div>
            <div className={`flex items-center justify-between pt-2.5 sm:pt-3 border-t border-slate-100 text-[11px] sm:text-xs font-bold text-slate-900 ${hoverColor}`}>
              <span>Manage {label}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
