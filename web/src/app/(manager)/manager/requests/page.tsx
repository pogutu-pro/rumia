import { getManagerUser } from '@/app/actions/manager';
import { getManagerHostelRequestsAction } from '@/app/actions/hostel-requests';
import { HostelRequestsClient } from './hostel-requests-client';

export default async function HostelRequestsPage() {
  const manager = await getManagerUser();

  if (!manager) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm">
        Unauthorized: You do not have permission to view manager pages.
      </div>
    );
  }

  const requests = await getManagerHostelRequestsAction();

  const waitingCount = requests.filter((r) => r.status === 'waiting').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Hostel Requests
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Student &quot;Find Me a Hostel&quot; leads. Review requirements,
          contact the student on WhatsApp, and keep the status updated as the
          search progresses.
        </p>
      </div>

      <HostelRequestsClient
        initialRequests={requests}
        waitingCount={waitingCount}
      />
    </div>
  );
}