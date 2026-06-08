import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ListingsList } from './listings-list';
import { GettingStarted } from './getting-started';
import { LeadsTable } from './leads-table';
import { CommissionTable } from './commission-table';
import { Building2, MessageCircle, Landmark, Plus, Wallet, Eye } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0; // Fresh statistics always

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Find agent profile, fallback to creating one if missing
  let { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (agentError) {
    console.error('Error finding agent:', agentError);
  }

  if (!agent) {
    // Attempt auto-creation of agent profile for developer/tester convenience
    const agentName = user.email?.split('@')[0] || 'New Agent';
    const { data: newAgent, error: createError } = await supabase
      .from('agents')
      .insert({
        user_id: user.id,
        name: agentName.charAt(0).toUpperCase() + agentName.slice(1),
        phone: '+254700000000',
        whatsapp: '+254700000000',
        commission_balance: 0,
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('Failed to auto-create agent profile:', createError);
      return (
        <div className="bg-white p-8 rounded-2xl border border-rose-100 text-center text-rose-600 max-w-md mx-auto mt-12 shadow-sm">
          <h2 className="font-extrabold text-xl mb-2">Agent Access Error</h2>
          <p className="text-sm font-medium">
            Could not find or create an agent profile associated with this account. Please contact administrator Paul.
          </p>
        </div>
      );
    }
    agent = newAgent;
  }

  // Fetch agent's listings
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      price,
      location,
      is_active,
      listing_images (
        r2_url
      )
    `)
    .eq('agent_id', agent.id)
    .order('id', { ascending: false });

  const activeListingsCount = listings?.filter((l: any) => l.is_active).length || 0;

  // Fetch all leads for this agent to calculate "Leads This Month" and populate Leads Table
  const { data: allLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('agent_id', agent.id)
    .order('clicked_at', { ascending: false });
    
  const leads = allLeads || [];

  // Calculate leads this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const leadsThisMonthCount = leads.filter(
    (lead: any) => new Date(lead.clicked_at) >= startOfMonth
  ).length;

  // Pre-calculate leads count per listing for the commission table
  const leadsCountByListing: Record<string, number> = {};
  leads.forEach((lead: any) => {
    leadsCountByListing[lead.listing_id] = (leadsCountByListing[lead.listing_id] || 0) + 1;
  });

  // Fetch commissions
  const { data: allCommissions } = await supabase
    .from('commissions')
    .select('*')
    .eq('agent_id', agent.id)
    .order('id', { ascending: false });

  const commissions = allCommissions || [];

  const { data: listingViewAnalyticsRaw } = await (supabase as any).rpc(
    'get_agent_listing_view_analytics',
    { p_agent_id: agent.id }
  );

  const listingViewAnalytics = (listingViewAnalyticsRaw ?? []).map((row: any) => ({
    listing_id: row.listing_id,
    listing_title: row.listing_title,
    listing_slug: row.listing_slug,
    county: row.county || 'nyeri',
    area: row.area || 'dekut',
    today_count: Number(row.today_count || 0),
    week_count: Number(row.week_count || 0),
    month_count: Number(row.month_count || 0),
    all_time_count: Number(row.all_time_count || 0),
  }));

  const viewSummary = listingViewAnalytics.reduce(
    (acc: any, row: any) => ({
      today: acc.today + row.today_count,
      week: acc.week + row.week_count,
      month: acc.month + row.month_count,
      allTime: acc.allTime + row.all_time_count,
    }),
    { today: 0, week: 0, month: 0, allTime: 0 }
  );

  const commissionOwed = commissions
    .filter((c: any) => c.status === 'pending')
    .reduce((acc: number, c: any) => acc + c.amount, 0);

  const totalEarned = commissions
    .filter((c: any) => c.status === 'paid')
    .reduce((acc: number, c: any) => acc + c.amount, 0);

  return (
    <div className="space-y-8">
      {/* Getting Started Progress */}
      <GettingStarted agent={agent} listings={listings as any || []} />

      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome back, {agent.name}!
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">
            Manage your properties, review performance, and track your payouts.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 sm:gap-5">
          <div className="p-3 sm:p-4 rounded-xl bg-slate-100 text-slate-700">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Active Listings
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {activeListingsCount}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 sm:gap-5">
          <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 text-emerald-700">
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Leads This Month
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {leadsThisMonthCount}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 sm:gap-5">
          <div className="p-3 sm:p-4 rounded-xl bg-amber-50 text-amber-700">
            <Landmark className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pending
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">
              KES {commissionOwed.toLocaleString()}
            </h3>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 sm:gap-5">
          <div className="p-3 sm:p-4 rounded-xl bg-indigo-50 text-indigo-700">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Earned
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 truncate">
              KES {totalEarned.toLocaleString()}
            </h3>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
            Analytics
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Student views across your listings.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[
            ['Today', viewSummary.today],
            ['This Week', viewSummary.week],
            ['This Month', viewSummary.month],
            ['All Time', viewSummary.allTime],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 sm:gap-5">
              <div className="p-3 sm:p-4 rounded-xl bg-blue-50 text-blue-700">
                <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {label}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {Number(value).toLocaleString()}
                </h3>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
          {listingViewAnalytics.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
              View analytics will appear after students visit your listings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Listing</th>
                    <th className="px-5 py-3 text-right">Today</th>
                    <th className="px-5 py-3 text-right">This Week</th>
                    <th className="px-5 py-3 text-right">This Month</th>
                    <th className="px-5 py-3 text-right">All Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listingViewAnalytics.map((row: any) => {
                    const href = row.listing_slug
                      ? `/hostels/${row.county}/${row.area}/${row.listing_slug}`
                      : `/listing/${row.listing_id}`;

                    return (
                      <tr key={row.listing_id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-bold text-slate-900">
                          <Link href={href} className="hover:text-emerald-600">
                            {row.listing_title}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-600">{row.today_count.toLocaleString()}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-600">{row.week_count.toLocaleString()}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">{row.month_count.toLocaleString()}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-600">{row.all_time_count.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Main Section — My Listings */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
            My Listings
          </h2>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/10 transition-all self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Add New Listing
          </Link>
        </div>
        <ListingsList 
          initialListings={listings as any || []} 
          leadsCountByListing={leadsCountByListing} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">Recent Leads</h2>
          <LeadsTable leads={leads.slice(0, 10)} listings={listings as any || []} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">Commission Status</h2>
          <CommissionTable 
            commissions={commissions} 
            listings={listings as any || []} 
            leadsCountByListing={leadsCountByListing}
          />
        </div>
      </div>
    </div>
  );
}
