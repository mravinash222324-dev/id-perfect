import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'teacher' | 'printer' | 'school';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role?: string, institutionName?: string, inviteToken?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      setRole(data.role as AppRole);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }

        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role?: string, institutionName?: string, inviteToken?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    // Verify token validity BEFORE creating user (double check)
    if (role === 'school' && inviteToken) {
      const { data: tokenData, error: tokenError } = await (supabase
        .from('school_invites' as any)
        .select('is_used')
        .eq('token', inviteToken)
        .single()) as any;

      if (tokenError || !tokenData) return { error: new Error("Invalid invite token") };
      if (tokenData.is_used) return { error: new Error("This invite link has already been used") };
    }


    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
          institution_name: institutionName
        },
      },
    });

    if (error) return { error };

    // Manual Profile Creation (since Trigger is disabled to prevent 500 errors)
    if (data.user) {
      try {
        // 1. Create Profile
        await supabase.from('profiles').insert({
          id: data.user.id,
          user_id: data.user.id,
          full_name: fullName,
          institution_name: institutionName
        });

        // 2. Create Role
        const assignedRole = role === 'school' ? 'school' : 'teacher';
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: assignedRole
        } as any);

        // 3. Mark Token as Used (if applicable)
        if (inviteToken) {
          await (supabase
            .from('school_invites' as any)
            .update({
              is_used: true,
              used_by: data.user.id,
              used_at: new Date().toISOString()
            } as any)
            .eq('token', inviteToken));
        }

      } catch (err) {
        console.error("Manual creation error (non-fatal if trigger ran):", err);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
