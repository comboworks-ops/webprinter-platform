import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'moderator' | 'user' | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [serverVerified, setServerVerified] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRole(null);
          setServerVerified(false);
          setLoading(false);
          return;
        }

        // Client-side check for UI purposes
        const { data, error } = await (supabase as any)
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user role:', error);
          setRole(null);
          setServerVerified(false);
        } else {
          const userRole = data?.role || null;
          setRole(userRole);
          
          // Server-side verification for admin role
          if (userRole === 'admin') {
            try {
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin');
              
              if (verifyError) {
                console.error('Server-side admin verification failed:', verifyError);
                setServerVerified(false);
              } else {
                setServerVerified(verifyData?.isAdmin === true);
              }
            } catch (err) {
              console.error('Error calling verify-admin:', err);
              setServerVerified(false);
            }
          } else {
            setServerVerified(false);
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

  return { role, loading, isAdmin: role === 'admin' && serverVerified };
};
