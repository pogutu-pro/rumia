'use client';

import { NewListingForm } from '@/app/(dashboard)/dashboard/new/new-listing-form';
import { updateListingByManagerAction } from '@/app/actions/manager';
import type { ComponentProps } from 'react';

type FormProps = ComponentProps<typeof NewListingForm>;

interface ManagerEditFormProps {
  agentId: FormProps['agentId'];
  agentWhatsapp: FormProps['agentWhatsapp'];
  initialListing: FormProps['initialListing'];
  campusId: FormProps['campusId'];
  campusZones: FormProps['campusZones'];
}

export function ManagerEditForm({
  agentId,
  agentWhatsapp,
  initialListing,
  campusId,
  campusZones,
}: ManagerEditFormProps) {
  return (
    <NewListingForm
      agentId={agentId}
      agentWhatsapp={agentWhatsapp}
      initialListing={initialListing}
      mode="edit"
      campusId={campusId}
      campusZones={campusZones}
      successRedirectPath="/manager/listings"
      customUpdateAction={updateListingByManagerAction}
    />
  );
}
