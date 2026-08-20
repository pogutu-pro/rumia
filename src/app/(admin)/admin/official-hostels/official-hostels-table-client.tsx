'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Database,
  Building2,
  Phone,
  CreditCard,
  MapPin,
  X,
  Loader2,
  ExternalLink,
  LayoutGrid,
  List,
  UserCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createOfficialHostelAction,
  updateOfficialHostelAction,
  deleteOfficialHostelAction,
  seedOfficialHostelsAction,
} from '@/app/actions/admin';

export interface OfficialHostel {
  id: string;
  hostel_name: string;
  zone: string;
  contacts: string;
  payments: string;
  source?: string;
  verified_date?: string;
  created_at?: string;
}

export interface AgentListingHostel {
  id: string;
  title: string;
  location: string;
  price?: number;
  is_active: boolean;
  verified: boolean;
  created_at: string;
  landlord_phone?: string;
  mpesa_details?: string;
  specific_location?: string;
  county: string;
  area: string;
  slug?: string;
  agent_name: string;
  agent_phone?: string;
  agent_whatsapp?: string;
  is_full?: boolean;
}

interface OfficialHostelsTableClientProps {
  officialHostels: OfficialHostel[];
  agentListings: AgentListingHostel[];
  isFromDb?: boolean;
  readOnly?: boolean;
}

type TabType = 'all' | 'official' | 'agent';
type ViewMode = 'cards' | 'table';

export function OfficialHostelsTableClient({
  officialHostels: initialOfficial,
  agentListings: initialAgent,
  isFromDb = false,
  readOnly = false,
}: OfficialHostelsTableClientProps) {
  const router = useRouter();
  const [officialHostels, setOfficialHostels] = useState<OfficialHostel[]>(initialOfficial);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<OfficialHostel | null>(null);
  const [deletingHostel, setDeletingHostel] = useState<OfficialHostel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    hostel_name: '',
    zone: 'DeKUT',
    contacts: '',
    payments: '',
    source: 'DeKUT Official Housing List',
  });

  const officialZones = Array.from(
    new Set(initialOfficial.map((h) => h.zone).filter(Boolean)),
  ).sort();

  const agentZones = Array.from(
    new Set(initialAgent.map((l) => l.location).filter(Boolean)),
  ).sort();

  const allZones = Array.from(new Set([...officialZones, ...agentZones])).sort();

  // Combine items for 'all' tab
  const combinedItems = [
    ...officialHostels.map((h) => ({
      type: 'official' as const,
      id: h.id,
      name: h.hostel_name,
      zone: h.zone,
      contacts: h.contacts,
      payments: h.payments,
      source: h.source || 'DeKUT Official Record',
      verified: true,
      price: undefined as number | undefined,
      slug: undefined as string | undefined,
      county: undefined as string | undefined,
      area: undefined as string | undefined,
      onRumia: false,
      isFull: undefined as boolean | undefined,
      rawOfficial: h as OfficialHostel | undefined,
      rawAgent: undefined as AgentListingHostel | undefined,
    })),
    ...initialAgent.map((l) => ({
      type: 'agent' as const,
      id: l.id,
      name: l.title,
      zone: l.location || l.area,
      contacts: l.landlord_phone || l.agent_phone || l.agent_whatsapp || 'Agent Contact',
      payments: l.mpesa_details || 'Rumia Listing',
      source: `Agent: ${l.agent_name}`,
      verified: l.verified,
      price: l.price as number | undefined,
      slug: l.slug as string | undefined,
      county: l.county as string | undefined,
      area: l.area as string | undefined,
      onRumia: true,
      isFull: l.is_full ?? false,
      rawOfficial: undefined as OfficialHostel | undefined,
      rawAgent: l as AgentListingHostel | undefined,
    })),
  ];

  const filteredCombined = combinedItems.filter((item) => {
    const q = search.toLowerCase().trim();

    if (activeTab === 'official' && item.type !== 'official') return false;
    if (activeTab === 'agent' && item.type !== 'agent') return false;

    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.zone.toLowerCase().includes(q) ||
      item.contacts.toLowerCase().includes(q) ||
      item.payments.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q);

    const matchesZone = !zoneFilter || item.zone === zoneFilter;

    return matchesSearch && matchesZone;
  });

  const renderAvailability = (item: (typeof combinedItems)[number]) => {
    if (!item.onRumia) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
          Not on Rumia
        </span>
      );
    }
    if (item.isFull) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Fully Occupied
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Available
      </span>
    );
  };

  const handleOpenAdd = () => {
    setFormData({
      hostel_name: '',
      zone: allZones[0] || 'DeKUT',
      contacts: '',
      payments: '',
      source: 'DeKUT Official Housing List',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (hostel: OfficialHostel) => {
    setEditingHostel(hostel);
    setFormData({
      hostel_name: hostel.hostel_name,
      zone: hostel.zone || 'DeKUT',
      contacts: hostel.contacts || '',
      payments: hostel.payments || '',
      source: hostel.source || 'DeKUT Official Housing List',
    });
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hostel_name.trim() || !formData.zone.trim()) {
      toast.error('Hostel name and zone are required.');
      return;
    }

    setIsSubmitting(true);
    const res = await createOfficialHostelAction(formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(`Official hostel "${formData.hostel_name}" created successfully.`);
      setIsAddOpen(false);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to create official hostel.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHostel) return;
    if (!formData.hostel_name.trim() || !formData.zone.trim()) {
      toast.error('Hostel name and zone are required.');
      return;
    }

    setIsSubmitting(true);
    const res = await updateOfficialHostelAction(editingHostel.id, formData);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(`Official hostel "${formData.hostel_name}" updated.`);
      setEditingHostel(null);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to update official hostel.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingHostel) return;

    setIsSubmitting(true);
    const res = await deleteOfficialHostelAction(deletingHostel.id);
    setIsSubmitting(false);

    if (res.success) {
      toast.success(`Official hostel "${deletingHostel.hostel_name}" removed.`);
      setDeletingHostel(null);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to delete official hostel.');
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    const res = await seedOfficialHostelsAction();
    setIsSeeding(false);

    if (res.success) {
      toast.success(`Successfully seeded ${res.seededCount || 93} official hostels into database!`);
      router.refresh();
    } else {
      toast.error(res.error || 'Failed to seed official hostels.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Hostels & Official Housing Records
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            View all 93 official DeKUT housing records and Rumia agent-uploaded listings in one interactive dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              {!isFromDb && (
                <Button
                  onClick={handleSeed}
                  disabled={isSeeding}
                  variant="outline"
                  className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  {isSeeding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Sync 93 Records to DB
                </Button>
              )}

              <Button
                onClick={handleOpenAdd}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Official Hostel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Navigation Cards Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('all')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
            activeTab === 'all' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">All Hostels</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Layers className="h-4 w-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{combinedItems.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Combined Directory</p>
        </div>

        <div
          onClick={() => setActiveTab('official')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
            activeTab === 'official' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">DeKUT Official Records</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 mt-2">{officialHostels.length}</p>
          <p className="text-xs text-emerald-600 mt-1 font-medium">93 Documented Hostels</p>
        </div>

        <div
          onClick={() => setActiveTab('agent')}
          className={`cursor-pointer bg-white p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
            activeTab === 'agent' ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Rumia Agent Uploads</span>
            <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <UserCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-indigo-700 mt-2">{initialAgent.length}</p>
          <p className="text-xs text-indigo-600 mt-1 font-medium">Live Agent Listings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Housing Zones</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <MapPin className="h-4 w-4" />
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{allZones.length}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">DeKUT & Surrounding Areas</p>
        </div>
      </div>

      {/* Filter Tabs & Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Hostels ({combinedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('official')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'official' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Official Records ({officialHostels.length})
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'agent' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Agent Uploads ({initialAgent.length})
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs font-medium text-slate-400 hidden sm:inline">View:</span>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Table View"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search & Zone Dropdown */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search hostel name, phone, paybill, till number, or zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Zones</option>
            {allZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          {(search || zoneFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setZoneFilter('');
              }}
              className="rounded-xl text-slate-500"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Cards View Section */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCombined.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              No hostels match your filter or search query.
            </div>
          ) : (
            filteredCombined.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <h3 className="text-base font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.type === 'official' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Official Record
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Agent Upload
                        </span>
                      )}
                      {renderAvailability(item)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{item.zone}</span>
                    {item.price && (
                      <>
                        <span>&middot;</span>
                        <span className="font-bold text-slate-900">KES {item.price.toLocaleString()}</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono font-medium">{item.contacts || 'No contact specified'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-800 font-medium">
                      <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="line-clamp-1">{item.payments || 'No payment details'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium line-clamp-1">{item.source}</span>

                  <div className="flex items-center gap-2">
                    {item.type === 'official' && item.rawOfficial && !readOnly && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(item.rawOfficial!)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                          title="Edit official hostel"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingHostel(item.rawOfficial!)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete official hostel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {item.type === 'agent' && (
                      <a
                        href={item.slug ? `/hostels/${item.county}/${item.area}/${item.slug}` : `/listing/${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Table View Section */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50">
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Hostel Name
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Type / Source
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Zone / Area
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Contacts
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Payment Details (Paybill/Till)
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5">
                  Availability
                </th>
                <th className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCombined.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                    No hostels match your query.
                  </td>
                </tr>
              ) : (
                filteredCombined.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {item.type === 'official' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                          DeKUT Official Record
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                          Agent: {item.source.replace('Agent: ', '')}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {item.zone}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-mono font-medium text-slate-700">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{item.contacts || 'Not set'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <CreditCard className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{item.payments || 'Not set'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{renderAvailability(item)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
{item.type === 'official' && item.rawOfficial && !readOnly && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item.rawOfficial!)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                              title="Edit official hostel"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingHostel(item.rawOfficial!)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete official hostel"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {item.type === 'agent' && (
                          <a
                            href={item.slug ? `/hostels/${item.county}/${item.area}/${item.slug}` : `/listing/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddOpen || editingHostel) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingHostel ? 'Edit Official Hostel' : 'Add New Official Hostel'}
              </h2>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingHostel(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={editingHostel ? handleSaveEdit : handleSaveAdd} className="space-y-4">
              <div>
                <Label htmlFor="hostel_name">Hostel Name *</Label>
                <Input
                  id="hostel_name"
                  value={formData.hostel_name}
                  onChange={(e) => setFormData({ ...formData, hostel_name: e.target.value })}
                  placeholder="e.g. Sunrise Hostel (Block CD)"
                  className="rounded-xl mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="zone">Zone / Location Area *</Label>
                <Input
                  id="zone"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="e.g. Gate A / Boma / Embassy"
                  className="rounded-xl mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="contacts">Contact Phone Numbers</Label>
                <Input
                  id="contacts"
                  value={formData.contacts}
                  onChange={(e) => setFormData({ ...formData, contacts: e.target.value })}
                  placeholder="e.g. 0728XXXXXX, 0733XXXXXX"
                  className="rounded-xl mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Separate multiple phone numbers with commas.
                </p>
              </div>

              <div>
                <Label htmlFor="payments">Payment Details (Paybill / Till Number)</Label>
                <Input
                  id="payments"
                  value={formData.payments}
                  onChange={(e) => setFormData({ ...formData, payments: e.target.value })}
                  placeholder="e.g. Paybill 247247, A/C 6020814 or Till 9383225"
                  className="rounded-xl mt-1"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter Paybill number, Till number, or M-Pesa account details.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingHostel(null);
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingHostel ? 'Save Changes' : 'Create Official Hostel'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingHostel && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-slate-900">Remove Official Hostel?</h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <strong>{deletingHostel.hostel_name}</strong> from the official verification records?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingHostel(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Delete Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
