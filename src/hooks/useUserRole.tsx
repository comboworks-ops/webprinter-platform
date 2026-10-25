import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant, MASTER_TENANT_ID } from '@/lib/adminTenant';

export type UserRole = 'admin' | 'master_admin' | 'moderator' | 'user' | null;

const isAbortLikeError = (error: unknown) => {
  const name = (error as any)?.name;
  const message = String((error as any)?.message || '');
  return name === 'AbortError' || message.toLowerCase().includes('signal is aborted');
};

const isTransientAuthFetchError = (error: unknown) => {
  const name = String((error as any)?.name || '');
  const message = String((error as any)?.message || '').toLowerCase();
  return name === 'AuthRetryableFetchError' || message.includes('failed to fetch');
};

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [serverVerified, setServerVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    let resolvedUserId: string | null = null;
    let hasResolvedRole = false;

    const fetchUserRole = async () => {
      const requestId = ++requestIdRef.current;
      let checkedUserId: string | null = null;
      const setIfActive = (fn: () => void) => {
        if (!active) return;
        if (requestId !== requestIdRef.current) return;
        fn();
      };

      try {
        // Prefer session-based user lookup to avoid excessive auth network calls.
        let user = (await supabase.auth.getSession()).data.session?.user ?? null;

        // Fallback to remote user fetch only when no local session user is available.
        if (!user) {
          user = (await supabase.auth.getUser()).data.user;
        }
        checkedUserId = user?.id ?? null;

        if (!user) {
          setIfActive(() => {
            setRole(null);
            setServerVerified(false);
            setLoading(false);
          });
          return;
        }

        try {
          const { data: verified } = await supabase.functions.invoke('verify-admin');
          // Older deployments only return isAdmin. Missing master evidence is
          // not an explicit denial: read this user's stored roles below.
          if (verified?.isAdmin === true && typeof verified.isMasterAdmin === 'boolean') {
            const verifiedRole: UserRole = verified.isMasterAdmin ? 'master_admin' : 'admin';

            if (verifiedRole === 'master_admin') {
              const { tenantId } = await resolveAdminTenant();
              if (tenantId !== MASTER_TENANT_ID) {
                setIfActive(() => {
                  setRole('admin');
                  setServerVerified(true);
                });
                return;
              }
            }

            setIfActive(() => {
              setRole(verifiedRole);
              setServerVerified(true);
            });
            return;
          }
        } catch (verifyError) {
          console.warn('Server admin verification unavailable, falling back to direct role lookup:', verifyError);
        }

        // Fetch all roles (a user may have multiple; pick highest priority)
        const { data, error } = await (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.warn('Error fetching user role, falling back to tenant ownership:', error);
          const { data: owned } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();

          if (owned) {
            setIfActive(() => {
              setRole('admin');
              setServerVerified(true);
            });
          } else {
            setIfActive(() => {
              setRole(null);
              setServerVerified(false);
            });
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
              if (tenantId !== MASTER_TENANT_ID) {
                console.log('[useUserRole] Masking Master Admin as Admin for tenant:', tenantId);
                setIfActive(() => {
                  setRole('admin');
                  setServerVerified(true);
                });
                return;
              }
            }

            setIfActive(() => {
              setRole(userRole);
              setServerVerified(userRole === 'admin' || userRole === 'master_admin');
            });
          } else {
            const { data: owned } = await supabase
              .from('tenants')
              .select('id')
              .eq('owner_id', user.id)
              .maybeSingle();

            if (owned) {
              setIfActive(() => {
                setRole('admin');
                setServerVerified(true);
              });
            } else {
              setIfActive(() => {
                setRole(null);
                setServerVerified(false);
              });
            }
          }
        }
      } catch (error) {
        if (!isAbortLikeError(error) && !isTransientAuthFetchError(error)) {
          console.error('Error in useUserRole:', error);
        }
        setIfActive(() => {
          setRole(null);
          setServerVerified(false);
        });
      } finally {
        setIfActive(() => {
          resolvedUserId = checkedUserId;
          hasResolvedRole = true;
          setUserId(checkedUserId);
          setLoading(false);
        });
      }
    };

    void fetchUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // SIGNED_IN also fires on focus and when a preview iframe restores the
      // shared session. Unmounting admin here rebuilds that iframe, creating
      // another auth notification and a reload loop across admin tabs.
      const sameIdentityRefresh = hasResolvedRole
        && !!resolvedUserId
        && session?.user?.id === resolvedUserId
        && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION');
      ++requestIdRef.current;
      if (!sameIdentityRefresh) {
        // Sign-out, identity changes and other auth transitions still revoke
        // the previous access immediately, before any asynchronous lookup.
        resolvedUserId = null;
        hasResolvedRole = false;
        setRole(null);
        setServerVerified(false);
        setUserId(null);
        setLoading(true);
      }
      // Supabase reads run outside the callback to avoid its auth lock.
      clearTimeout(authTimer);
      authTimer = setTimeout(() => { if (active) void fetchUserRole(); }, 0);
    });

    return () => {
      active = false;
      clearTimeout(authTimer);
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    userId,
    loading,
    isAdmin: (role === 'admin' || role === 'master_admin') && serverVerified,
    isMasterAdmin: role === 'master_admin' && serverVerified,
  };
};
