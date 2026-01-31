import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant, MASTER_TENANT_ID } from '@/lib/adminTenant';

export type UserRole = 'admin' | 'master_admin' | 'moderator' | 'user' | null;

// Whitelisted admin emails as a last-resort fallback to avoid lockouts
const EMAIL_ROLE_MAP: Record<string, UserRole> = {
  'admin@webprinter.dk': 'master_admin',
  'result-admin@webprinter.dk': 'admin',
  'info@webprinter.dk': 'admin',
  'online-trukserre@gmail.com': 'admin',
};

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [serverVerified, setServerVerified] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        // Try primary user fetch
        let user = (await supabase.auth.getUser()).data.user;

        // Fallback: try session if user is null (avoids occasional null from getUser)
        if (!user) {
          const { data: sessionData } = await supabase.auth.getSession();
          user = sessionData.session?.user ?? null;
        }

        if (!user) {
          setRole(null);
          setServerVerified(false);
          setLoading(false);
          return;
        }

        // Immediate fallback based on email to avoid lockout while we fetch roles
        const email = (user.email || '').toLowerCase();
        const fallbackRole = EMAIL_ROLE_MAP[email] || null;
        if (fallbackRole) {
          // Whitelisted emails: trust the fallback and skip DB fetch to avoid lockouts
          setRole(fallbackRole);
          setServerVerified(true);
          setLoading(false);
          return;
        }

        // Fetch all roles (a user may have multiple; pick highest priority)
        const { data, error } = await (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.warn('Error fetching user role, falling back to tenant ownership:', error);
          const { data: owned } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();

          if (owned) {
            setRole('admin');
            setServerVerified(true);
          } else {
            setRole(null);
            setServerVerified(false);
          }
        } else {
          const roles: UserRole[] = (data || []).map((r: any) => r.role);
          const priority: UserRole[] = ['master_admin', 'admin', 'moderator', 'user'];
          const userRole = priority.find((p) => roles.includes(p)) || null;

          if (userRole) {
            // Context-Aware Role Masking:
            // If user is Master Admin, but they are operating in a specific tenant (like Salgsmapper),
            // we must DOWNGRADE them to effective 'admin' so the UI doesn't show Platform tools.
            if (userRole === 'master_admin') {
              const { tenantId } = await resolveAdminTenant();
              if (tenantId && tenantId !== MASTER_TENANT_ID) {
                console.log('[useUserRole] Masking Master Admin as Admin for tenant:', tenantId);
                setRole('admin');
                setServerVerified(true);
                return;
              }
            }

            setRole(userRole);
            setServerVerified(userRole === 'admin' || userRole === 'master_admin');
          } else {
            const { data: owned } = await supabase
              .from('tenants' as any)
              .select('id')
              .eq('owner_id', user.id)
              .maybeSingle();

            if (owned) {
              setRole('admin');
              setServerVerified(true);
            } else {
              setRole(null);
              setServerVerified(false);
            }
          }
        }
      } catch (error) {
        console.error('Error in useUserRole:', error);
        setRole(null);
        setServerVerified(false);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    role,
    loading,
    isAdmin: (role === 'admin' || role === 'master_admin') && serverVerified,
    isMasterAdmin: role === 'master_admin' && serverVerified,
  };
};
