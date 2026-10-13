-- Step 1: Regions
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS for regions
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to regions
CREATE POLICY "Enable read access for all users on regions" 
    ON public.regions FOR SELECT USING (true);

-- Allow super_admin full access to regions
CREATE POLICY "Enable full access for super_admin on regions" 
    ON public.regions FOR ALL 
    USING (public.is_campus_super_admin());

-- Add region_id to campuses
ALTER TABLE public.campuses 
    ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;

-- Add managed_region_id to profiles and mutually exclusive constraint
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS managed_region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;

-- Drop constraint if exists to allow safe re-runs
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_manager_scope_check;

-- A manager can manage either a campus or a region, or neither (super admin), but never both
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_manager_scope_check 
    CHECK (
        (managed_campus_id IS NULL AND managed_region_id IS NULL) OR 
        (managed_campus_id IS NOT NULL AND managed_region_id IS NULL) OR 
        (managed_campus_id IS NULL AND managed_region_id IS NOT NULL)
    );

-- Step 2: Update is_manager_of_campus RLS helper
CREATE OR REPLACE FUNCTION public.is_manager_of_campus(p_campus_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
    v_managed_campus_id UUID;
    v_managed_region_id UUID;
    v_campus_region_id UUID;
    v_is_super BOOLEAN;
BEGIN
    -- Check if super admin first
    v_is_super := public.is_campus_super_admin();
    IF v_is_super THEN
        RETURN TRUE;
    END IF;

    -- Get user role and management scopes
    SELECT role, managed_campus_id, managed_region_id 
    INTO v_role, v_managed_campus_id, v_managed_region_id
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_role != 'manager' THEN
        RETURN FALSE;
    END IF;

    -- Check direct campus management
    IF v_managed_campus_id IS NOT NULL AND v_managed_campus_id = p_campus_id THEN
        RETURN TRUE;
    END IF;

    -- Check region management
    IF v_managed_region_id IS NOT NULL THEN
        -- Get the region of the target campus
        SELECT region_id INTO v_campus_region_id
        FROM public.campuses
        WHERE id = p_campus_id;

        IF v_campus_region_id IS NOT NULL AND v_campus_region_id = v_managed_region_id THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 3: Zones and Tour Pricing
CREATE TABLE IF NOT EXISTS public.campus_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    distance_category TEXT,
    full_search_price INTEGER NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(campus_id, slug)
);

-- Enable RLS for campus_zones
ALTER TABLE public.campus_zones ENABLE ROW LEVEL SECURITY;

-- Allow public read access to campus_zones
CREATE POLICY "Enable read access for all users on campus_zones" 
    ON public.campus_zones FOR SELECT USING (true);

-- Allow super_admin full access to campus_zones
CREATE POLICY "Enable full access for super_admin on campus_zones" 
    ON public.campus_zones FOR ALL 
    USING (public.is_campus_super_admin());

-- Allow campus/region managers to modify zones for their campuses
CREATE POLICY "Enable write access for managers on their campus_zones" 
    ON public.campus_zones FOR ALL 
    USING (public.is_manager_of_campus(campus_id))
    WITH CHECK (public.is_manager_of_campus(campus_id));

-- Seed existing DeKUT zones
DO $$
DECLARE
    v_dekut_id UUID;
BEGIN
    SELECT id INTO v_dekut_id FROM public.campuses WHERE slug = 'dekut';

    IF v_dekut_id IS NOT NULL THEN
        INSERT INTO public.campus_zones (campus_id, name, slug, distance_category, full_search_price)
        VALUES
            (v_dekut_id, 'Boma', 'boma', 'walking-500m', 600),
            (v_dekut_id, 'Near Gate A', 'near-gate-a', 'walking-500m', 600),
            (v_dekut_id, 'Near Gate B', 'near-gate-b', 'walking-500m', 600),
            (v_dekut_id, 'Nyeri View', 'nyeri-view', '1-2km', 1000),
            (v_dekut_id, 'Kahawa Ridge', 'kahawa-ridge', '3km', 1000),
            (v_dekut_id, 'Nyaribo', 'nyaribo', 'over-3km', 1500),
            (v_dekut_id, 'Embassy Area', 'embassy-area', 'over-3km', 1500)
        ON CONFLICT (campus_id, slug) DO UPDATE SET
            full_search_price = EXCLUDED.full_search_price,
            distance_category = EXCLUDED.distance_category;
    END IF;
END $$;
