'use client';

import { Lead, Listing } from '@/types';
import { format } from 'date-fns';
import { Copy, Check, MessageCircle, Building2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface LeadsTableProps {
  leads: Lead[];
  listings: Listing[];
}

export function LeadsTable({ leads, listings }: LeadsTableProps) {
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-xs">
        <p className="text-slate-400 font-semibold">No leads yet. Make sure your listings are active and attractive!</p>
      </div>
    );
  }

  const handleCopyPhone = (phone: string, id: string | number) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    toast.success('Phone number copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getContactBadge = (type?: string | null) => {
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
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-xs">
      {/* Mobile card list */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {leads.map((lead) => {
          const listing = listings.find((l) => l.id === lead.listing_id);
          const date = new Date(lead.clicked_at);
          return (
            <li key={lead.id} className="px-4 py-3 flex flex-col gap-1.5">
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-slate-900 text-sm leading-tight">
                  {listing ? listing.title : 'Unknown Listing'}
                </span>
                {getContactBadge(lead.contact_type)}
              </div>
              
              <div className="flex items-center gap-2">
                {lead.name && (
                  <span className="text-xs font-semibold text-slate-700">{lead.name}</span>
                )}
                {lead.name && lead.phone && <span className="text-slate-300">•</span>}
                {lead.phone && (
                  <button
                    onClick={() => handleCopyPhone(lead.phone!, lead.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md"
                  >
                    {copiedId === lead.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {lead.phone}
                  </button>
                )}
              </div>

              <span className="text-[11px] font-medium text-slate-500">
                {format(date, 'd MMM yyyy')} · {format(date, 'h:mm a')}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-5 py-3.5">Contact</th>
              <th className="px-5 py-3.5">Listing</th>
              <th className="px-5 py-3.5">Contact Type</th>
              <th className="px-5 py-3.5">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const listing = listings.find((l) => l.id === lead.listing_id);
              const date = new Date(lead.clicked_at);
              return (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-900">
                        {lead.name || 'Anonymous User'}
                      </span>
                      {lead.phone ? (
                        <button
                          onClick={() => handleCopyPhone(lead.phone!, lead.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 transition-colors w-fit group"
                        >
                          {copiedId === lead.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                          <span className={copiedId === lead.id ? 'text-emerald-600' : ''}>
                            {lead.phone}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">No phone provided</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-700 max-w-[200px] truncate">
                    {listing ? listing.title : 'Unknown Listing'}
                  </td>
                  <td className="px-5 py-3.5">
                    {getContactBadge(lead.contact_type)}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 font-medium text-xs">
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
    </div>
  );
}
