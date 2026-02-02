
-- Create table for communication between Tenants and Master Platform
CREATE TABLE IF NOT EXISTS public.platform_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    sender_role text CHECK (sender_role IN ('tenant', 'master')) NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    sender_user_id uuid REFERENCES auth.users(id) -- Optional: who specifically wrote it
);

-- Enable RLS
ALTER TABLE public.platform_messages ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenants can access their own message thread
CREATE POLICY "Tenants access own platform messages" ON public.platform_messages
    FOR ALL
    USING (
        tenant_id IN (
            SELECT id FROM public.tenants 
            WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT id FROM public.tenants 
            WHERE owner_id = auth.uid()
        )
    );

-- Policy 2: Master Admin can access ALL platform messages
CREATE POLICY "Master admin accesses all platform messages" ON public.platform_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants 
            WHERE id = '00000000-0000-0000-0000-000000000000' 
            AND owner_id = auth.uid()
        )
    );
