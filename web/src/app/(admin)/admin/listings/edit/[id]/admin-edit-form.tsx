'use client';

import { NewListingForm } from '@/app/(dashboard)/dashboard/new/new-listing-form';
import { adminUpdateListingAction } from '@/app/actions/admin';
import type { ComponentProps } from 'react';

type FormProps = ComponentProps<typeof NewListingForm>;

interface AdminEditFormProps {
  agentId: FormProps['agentId'];
  agentWhatsapp: FormProps['agentWhatsapp'];
  initialListing: FormProps['initialListing'];
}

export function AdminEditForm({
  agentId,
  agentWhatsapp,
  initialListing,
}: AdminEditFormProps) {
  return (
    <NewListingForm
      agentId={agentId}
      agentWhatsapp={agentWhatsapp}
      initialListing={initialListing}
      mode="edit"
      customUpdateAction={adminUpdateListingAction}
    />
  );
}
