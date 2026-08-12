import { getManagerApplicationsAction, getManagerUser } from '@/app/actions/manager';
import { ApplicationsTableClient } from './applications-table-client';

export default async function ManagerApplicationsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized access.
      </div>
    );
  }

  const applications = await getManagerApplicationsAction();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Agent Applications Queue
        </h1>
        <p className="text-sm text-slate-500">
          Review and decide on self-serve agent applications submitted for your campus.
        </p>
      </div>

      <ApplicationsTableClient initialApplications={applications as any} />
    </div>
  );
}
