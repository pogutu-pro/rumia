'use client';

import { useState } from 'react';
import AssignManagerSheet from './assign-manager-sheet';
import { adminRemoveManagerAction } from '@/app/actions/admin-managers';

export default function ManagersTableClient({ initialManagers, campuses, regions }: { initialManagers: any[], campuses: any[], regions: any[] }) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const handleAssignClick = () => {
    setSelectedManager(null);
    setIsSheetOpen(true);
  };

  const handleReassignClick = (manager: any) => {
    setSelectedManager(manager);
    setIsSheetOpen(true);
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this manager?')) return;
    setIsRemoving(id);
    const res = await adminRemoveManagerAction(id);
    setIsRemoving(null);
    if (!res.success) {
      alert(res.error || 'Failed to remove manager');
    }
  };

  return (
    <div>
      <div className="p-5 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-base font-semibold text-slate-900">All Managers</h2>
        <button 
          onClick={handleAssignClick}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl px-4 py-2 transition-colors"
        >
          + Assign Manager
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Name / Email</th>
              <th className="px-5 py-4">Scope</th>
              <th className="px-5 py-4">Assignment</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialManagers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  No managers found.
                </td>
              </tr>
            ) : initialManagers.map((manager: any) => (
              <tr key={manager.id} className="bg-white hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-900">{manager.full_name || 'Unknown'}</div>
                  <div className="text-xs text-slate-500">{manager.email}</div>
                </td>
                <td className="px-5 py-4">
                  {manager.managed_campus_id ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 tabular-nums">Campus</span>
                  ) : manager.managed_region_id ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 tabular-nums">Region</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 tabular-nums">Unassigned</span>
                  )}
                </td>
                <td className="px-5 py-4 font-medium text-slate-900">
                  {manager.campuses?.name || manager.regions?.name || '-'}
                </td>
                <td className="px-5 py-4 text-right space-x-3">
                  <button 
                    onClick={() => handleReassignClick(manager)}
                    className="text-xs font-medium text-slate-600 hover:underline"
                  >
                    Reassign
                  </button>
                  <button 
                    onClick={() => handleRemove(manager.id)}
                    disabled={isRemoving === manager.id}
                    className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
                  >
                    {isRemoving === manager.id ? 'Removing...' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignManagerSheet 
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        campuses={campuses}
        regions={regions}
        initialManager={selectedManager}
      />
    </div>
  );
}
