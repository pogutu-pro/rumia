'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminCreateCampusAction } from '@/app/actions/admin-campus';

interface AddCampusSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: any[];
}

export function AddCampusSheet({ open, onOpenChange, regions }: AddCampusSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [regionId, setRegionId] = useState('');
  const [slug, setSlug] = useState('');

  // Auto-generate slug when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
  };

  function resetForm() {
    setName('');
    setCity('');
    setRegionId('');
    setSlug('');
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!regionId) {
      toast.error('Please select a region');
      return;
    }

    startTransition(async () => {
      const result = await adminCreateCampusAction({ 
        name, 
        city, 
        slug, 
        region_id: regionId 
      });

      if (result.success) {
        resetForm();
        onOpenChange(false);
        toast.success('Campus created successfully');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader className="mb-6">
          <SheetTitle>Add Campus</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-name" className="text-xs font-bold uppercase tracking-wider text-slate-900">Campus Name</Label>
            <Input
              id="campus-name"
              type="text"
              placeholder="e.g. Maseno University"
              required
              value={name}
              onChange={handleNameChange}
              disabled={isPending}
            />
          </div>

          {/* Slug */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-slug" className="text-xs font-bold uppercase tracking-wider text-slate-900">Slug</Label>
            <Input
              id="campus-slug"
              type="text"
              placeholder="e.g. maseno-university"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* City */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-city" className="text-xs font-bold uppercase tracking-wider text-slate-900">City</Label>
            <Input
              id="campus-city"
              type="text"
              placeholder="e.g. Maseno"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* Region */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="campus-region" className="text-xs font-bold uppercase tracking-wider text-slate-900">Region</Label>
            <select
              id="campus-region"
              required
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              disabled={isPending}
              className="p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 bg-white"
            >
              <option value="">Select a region</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
            <p className="text-sm text-slate-500">
              New campuses are created with <span className="font-semibold text-slate-700">Coming Soon</span> status by default. 
              You can activate them from the table after creation.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={isPending} 
            className="mt-2"
          >
            {isPending ? 'Creating...' : 'Create Campus'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
