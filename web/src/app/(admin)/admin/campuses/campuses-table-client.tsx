'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { adminActivateCampusAction, adminDeactivateCampusAction, adminSuspendCampusAction } from '@/app/actions/admin-campus';
import { AddCampusSheet } from './add-campus-sheet';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function CampusesTableClient({ 
  initialCampuses, 
  regions 
}: { 
  initialCampuses: any[];
  regions: any[];
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleActivate = (id: string) => {
    startTransition(async () => {
      const result = await adminActivateCampusAction(id);
      if (result.success) {
        toast.success('Campus activated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDeactivate = (id: string) => {
    startTransition(async () => {
      const result = await adminDeactivateCampusAction(id);
      if (result.success) {
        toast.success('Campus deactivated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSuspend = (id: string) => {
    startTransition(async () => {
      const result = await adminSuspendCampusAction(id);
      if (result.success) {
        toast.success('Campus suspended and removed from public pages');
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setConfirmSuspend(null);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button 
          onClick={() => setIsSheetOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Campus
        </Button>
      </div>

      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Suspend campus?</h2>
            <p className="text-sm text-slate-600">
              This will immediately hide{' '}
              <span className="font-semibold">
                {initialCampuses.find((c) => c.id === confirmSuspend)?.name}
              </span>{' '}
              from all public pages. You can restore it later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmSuspend(null)}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={() => handleSuspend(confirmSuspend)}
                className="text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-700">
              <tr>
                <th className="px-5 py-4">Campus Name</th>
                <th className="px-5 py-4">City</th>
                <th className="px-5 py-4">Region</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {initialCampuses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    No campuses found
                  </td>
                </tr>
              ) : (
                initialCampuses.map((campus) => (
                  <tr key={campus.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{campus.name}</td>
                    <td className="px-5 py-4">{campus.city}</td>
                    <td className="px-5 py-4">{regions.find((r) => r.id === campus.region_id)?.name || 'N/A'}</td>
                    <td className="px-5 py-4">
                      {campus.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      ) : campus.status === 'suspended' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          Coming Soon
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                          Edit
                        </button>
                        {campus.status === 'suspended' ? (
                          <button
                            disabled={isPending}
                            onClick={() => handleActivate(campus.id)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                          >
                            Restore
                          </button>
                        ) : campus.status === 'coming_soon' ? (
                          <>
                            <button
                              disabled={isPending}
                              onClick={() => handleActivate(campus.id)}
                              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50"
                            >
                              Activate
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => setConfirmSuspend(campus.id)}
                              className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={isPending}
                              onClick={() => handleDeactivate(campus.id)}
                              className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50"
                            >
                              Deactivate
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() => setConfirmSuspend(campus.id)}
                              className="text-sm font-medium text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddCampusSheet 
        open={isSheetOpen} 
        onOpenChange={setIsSheetOpen} 
        regions={regions} 
      />
    </div>
  );
}
