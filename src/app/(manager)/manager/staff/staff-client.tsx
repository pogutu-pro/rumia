'use client';

import { useState, useTransition } from 'react';
import { Users, Search, Plus, ShieldCheck, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { assignManagerRoleAction, removeManagerRoleAction, findUserByEmailAction } from '@/app/actions/staff';

interface StaffItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  managed_campus_id: string | null;
  managed_region_id: string | null;
}

interface StaffClientProps {
  staff: StaffItem[];
  campuses: any[];
  regions: any[];
}

export function StaffClient({ staff: initialStaff, campuses, regions }: StaffClientProps) {
  const [staff, setStaff] = useState<StaffItem[]>(initialStaff);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; email: string; full_name: string } | null>(null);
  
  const [formData, setFormData] = useState<{
    role: 'manager';
    managed_campus_id: string;
    managed_region_id: string;
  }>({
    role: 'manager',
    managed_campus_id: '',
    managed_region_id: '',
  });

  const getCampusName = (id: string | null) => campuses.find(c => c.id === id)?.name || 'Unknown';
  const getRegionName = (id: string | null) => regions.find(r => r.id === id)?.name || 'Unknown';

  const handleSearchUser = () => {
    if (!searchEmail.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await findUserByEmailAction(searchEmail.trim());
      if (!res.success) {
        setErrorMsg(res.error);
        setFoundUser(null);
      } else {
        setFoundUser(res.data || null);
        // Pre-fill form if they are already staff? We'll just reset.
        setFormData({ role: 'manager', managed_campus_id: '', managed_region_id: '' });
      }
    });
  };

  const handleSaveStaff = () => {
    if (!foundUser) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await assignManagerRoleAction(foundUser.id, {
        role: formData.role,
        managed_campus_id: formData.managed_campus_id || null,
        managed_region_id: formData.managed_region_id || null,
      });

      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setIsModalOpen(false);
        // Just reload page in real app, or optimistically update
        window.location.reload();
      }
    });
  };

  const handleRemoveStaff = (userId: string) => {
    if (!confirm('Are you sure you want to remove manager access for this user? They will become a regular student.')) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await removeManagerRoleAction(userId);
      if (!res.success) {
        setErrorMsg(res.error);
      } else {
        setStaff(prev => prev.filter(s => s.id !== userId));
      }
    });
  };

  const openEditModal = (member: StaffItem) => {
    setSearchEmail(member.email);
    setFoundUser({ id: member.id, email: member.email, full_name: member.full_name });
    setFormData({
      role: 'manager',
      managed_campus_id: member.managed_campus_id || '',
      managed_region_id: member.managed_region_id || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => {
            setSearchEmail('');
            setFoundUser(null);
            setFormData({ role: 'manager', managed_campus_id: '', managed_region_id: '' });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Manager
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Name / Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Scope</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{member.full_name}</div>
                    <div className="text-slate-500 text-xs">{member.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {member.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {member.role === 'admin' ? (
                      <span className="text-slate-900 font-medium text-xs">Global</span>
                    ) : member.managed_region_id ? (
                      <span className="text-emerald-600 font-medium text-xs bg-emerald-50 px-2 py-1 rounded">Region: {getRegionName(member.managed_region_id)}</span>
                    ) : member.managed_campus_id ? (
                      <span className="text-emerald-600 font-medium text-xs bg-emerald-50 px-2 py-1 rounded">Campus: {getCampusName(member.managed_campus_id)}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveStaff(member.id)}
                        disabled={isPending}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {foundUser ? 'Assign Role & Scope' : 'Add Staff Member'}
            </h3>

            {!foundUser ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Search for a registered user by their exact email address.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="flex-1 p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    onClick={handleSearchUser}
                    disabled={isPending || !searchEmail}
                    className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Find
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
                    {foundUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{foundUser.full_name}</div>
                    <div className="text-xs text-slate-500">{foundUser.email}</div>
                  </div>
                  <button 
                    onClick={() => { setFoundUser(null); setSearchEmail(''); }}
                    className="ml-auto text-xs text-emerald-600 hover:underline font-semibold"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const role = e.target.value as any;
                        setFormData({ ...formData, role });
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="manager">Campus/Region Manager</option>
                    </select>
                  </div>

                  {formData.role === 'manager' && (
                    <>
                      <div className="text-xs text-slate-500 pb-1 pt-2 border-t border-slate-100">
                        A manager must be assigned to EITHER a single Campus OR an entire Region.
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Campus</label>
                          <select
                            value={formData.managed_campus_id}
                            onChange={(e) => setFormData({ ...formData, managed_campus_id: e.target.value, managed_region_id: '' })}
                            disabled={!!formData.managed_region_id}
                            className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:opacity-50"
                          >
                            <option value="">No Campus</option>
                            {campuses.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
                          <select
                            value={formData.managed_region_id}
                            onChange={(e) => setFormData({ ...formData, managed_region_id: e.target.value, managed_campus_id: '' })}
                            disabled={!!formData.managed_campus_id}
                            className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50 disabled:opacity-50"
                          >
                            <option value="">No Region</option>
                            {regions.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFoundUser(null);
                  setErrorMsg(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {foundUser && (
                <button
                  onClick={handleSaveStaff}
                  disabled={isPending || (formData.role === 'manager' && !formData.managed_campus_id && !formData.managed_region_id)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl disabled:opacity-50 flex items-center gap-2"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Staff
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
