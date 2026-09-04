import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Copy, Check, MessageCircle, Building2, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export const revalidate = 0;

interface AdminListingLeadsPageProps {
  params: Promise<{ id: string }>;
}

interface Lead {
  id: string | number;
  name: string | null;
  phone: string | null;
  contact_type: string | null;
  clicked_at: string;
  agent_id: string | null;
  agent_name?: string;
}

function getContactBadge(type?: string | null) {
  if (type === 'hostel_owner') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
        <Building2 className="h-3 w-3" />
        Owner
      </span>
    );
  }
  if (type === 'rumia_agent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <UserCheck className="h-3 w-3" />
        Agent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
      <MessageCircle className="h-3 w-3" />
      Legacy
    </span>
  );
}

export default async function AdminListingLeadsPage({
  params,
}: AdminListingLeadsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('id, title, location, agent_id, agents ( id, name )')
    .eq('id', id)
    .single();

  if (listingError || !listing) {
    notFound();
  }

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, name, phone, contact_type, clicked_at, agent_id')
    .eq('listing_id', id)
    .order('clicked_at', { ascending: false });

  const allLeads: Lead[] = (leads || []) as Lead[];

  // Group leads by agent
  const agentMap = new Map<string, { name: string; leads: Lead[] }>();
  const unassignedLeads: Lead[] = [];

  for (const lead of allLeads) {
    if (lead.agent_id) {
      if (!agentMap.has(lead.agent_id)) {
        agentMap.set(lead.agent_id, { name: '', leads: [] });
      }
      agentMap.get(lead.agent_id)!.leads.push(lead);
    } else {
      unassignedLeads.push(lead);
    }
  }

  // Fetch agent names for agents we don't already have names for
  const agentIds = Array.from(agentMap.keys());
  if (agentIds.length > 0) {
    const { data: agents } = await supabaseAdmin
      .from('agents')
      .select('id, name')
      .in('id', agentIds);

    if (agents) {
      for (const agent of agents) {
        const entry = agentMap.get(agent.id);
        if (entry) {
          entry.name = agent.name;
        }
      }
    }
  }

  const totalLeads = allLeads.length;
  const agentGroups = Array.from(agentMap.entries()).sort(
    (a, b) => b[1].leads.length - a[1].leads.length
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/listings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Listings
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
          Leads — {listing.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {listing.location} &middot; {totalLeads} lead{totalLeads !== 1 ? 's' : ''} total
        </p>
      </div>

      {totalLeads === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
          <p className="text-slate-400 font-semibold">No leads yet for this listing.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-slate-900">{totalLeads}</span>
              <span className="text-slate-500">total leads</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-emerald-700">{agentGroups.length}</span>
              <span className="text-slate-500">agents contacted</span>
            </div>
            {unassignedLeads.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-amber-700">{unassignedLeads.length}</span>
                <span className="text-slate-500">unassigned</span>
              </div>
            )}
          </div>

          {/* Leads grouped by agent */}
          {agentGroups.map(([agentId, group]) => (
            <div
              key={agentId}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">{group.name || 'Unknown Agent'}</h2>
                <span className="text-xs font-medium text-slate-500">
                  {group.leads.length} lead{group.leads.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.leads.map((lead) => {
                      const date = new Date(lead.clicked_at);
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-bold text-slate-900">
                            {lead.name || 'Anonymous User'}
                          </td>
                          <td className="px-5 py-3">
                            {lead.phone ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {lead.phone}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">No phone</span>
                            )}
                          </td>
                          <td className="px-5 py-3">{getContactBadge(lead.contact_type)}</td>
                          <td className="px-5 py-3 text-slate-500 font-medium text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span>{format(date, 'd MMM yyyy')}</span>
                              <span>{format(date, 'h:mm a')}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {group.leads.map((lead) => {
                  const date = new Date(lead.clicked_at);
                  return (
                    <li key={lead.id} className="px-4 py-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-slate-900 text-sm leading-tight">
                          {lead.name || 'Anonymous User'}
                        </span>
                        {getContactBadge(lead.contact_type)}
                      </div>
                      {lead.phone && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                          {lead.phone}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-slate-500">
                        {format(date, 'd MMM yyyy')} · {format(date, 'h:mm a')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Unassigned leads */}
          {unassignedLeads.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-amber-800">Unassigned</h2>
                <span className="text-xs font-medium text-amber-700">
                  {unassignedLeads.length} lead{unassignedLeads.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3">Contact</th>
                      <th className="px-5 py-3">Phone</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unassignedLeads.map((lead) => {
                      const date = new Date(lead.clicked_at);
                      return (
                        <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-bold text-slate-900">
                            {lead.name || 'Anonymous User'}
                          </td>
                          <td className="px-5 py-3">
                            {lead.phone ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {lead.phone}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">No phone</span>
                            )}
                          </td>
                          <td className="px-5 py-3">{getContactBadge(lead.contact_type)}</td>
                          <td className="px-5 py-3 text-slate-500 font-medium text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span>{format(date, 'd MMM yyyy')}</span>
                              <span>{format(date, 'h:mm a')}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 md:hidden">
                {unassignedLeads.map((lead) => {
                  const date = new Date(lead.clicked_at);
                  return (
                    <li key={lead.id} className="px-4 py-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-slate-900 text-sm leading-tight">
                          {lead.name || 'Anonymous User'}
                        </span>
                        {getContactBadge(lead.contact_type)}
                      </div>
                      {lead.phone && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                          {lead.phone}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-slate-500">
                        {format(date, 'd MMM yyyy')} · {format(date, 'h:mm a')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
