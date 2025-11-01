import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({});

// Helper function to generate random colors for team members
const getRandomColor = () => {
  const colors = [
    '#8B5CF6', // purple
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // orange
    '#EF4444', // red
    '#EC4899', // pink
    '#84CC16', // lime
    '#06B6D4', // cyan
    '#8B5A2B', // brown
    '#6B7280'  // gray
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting initial session:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);

        // Ensure team member exists for existing authenticated user
        if (session?.user) {
          setTimeout(() => {
            ensureTeamMemberExists(session.user);
            getCurrentUserRole();
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to get initial session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

        // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'no user');

        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // Clear any stale session data
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setCurrentUserRole(null);
          } else if (event === 'TOKEN_REFRESHED' && session) {
            setSession(session);
            setUser(session.user);
          }
        } else {
          setSession(session);
          setUser(session?.user ?? null);

          // Ensure team member exists when user signs in
          if (event === 'SIGNED_IN' && session?.user) {
            // Small delay to ensure auth state is fully set
            setTimeout(() => {
              ensureTeamMemberExists(session.user);
              getCurrentUserRole();
            }, 1000);
          }
        }

        setLoading(false);
      }
    );

    // Set up periodic session refresh check
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error checking session:', error);
          return;
        }

        if (currentSession) {
          const now = Math.floor(Date.now() / 1000);
          const expiresAt = currentSession.expires_at;
          const issuedAt = currentSession.issued_at;

          // Only check session age if issued_at is valid (not 0 or null)
          let sessionAge = null;
          let isStale = false;

          if (issuedAt && issuedAt > 0) {
            sessionAge = now - issuedAt;
            isStale = sessionAge > 120; // 2 minutes
          }

          // Refresh if token expires within 5 minutes or session is stale (but only if we have valid issued_at)
          const shouldRefresh = (expiresAt && (expiresAt - now) < 300) || (isStale && issuedAt);

          if (shouldRefresh) {
            console.log('Session needs refresh (age:', sessionAge || 'unknown', 's, expires in:', expiresAt ? expiresAt - now : 'unknown', 's)');
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              console.error('Failed to refresh session:', refreshError);
              // If refresh fails due to invalid session, sign out
              if (refreshError.message?.includes('Invalid refresh token') ||
                  refreshError.message?.includes('refresh_token_not_found')) {
                await signOut();
              }
            } else if (data.session) {
              console.log('Session refreshed successfully');
              setSession(data.session);
              setUser(data.session.user);
            }
          }
        }
      } catch (error) {
        console.error('Error during session refresh check:', error);
      }
    }, 300000); // Check every 5 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signUp = async (email, password, metadata = {}) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) throw error;

      // Automatically create team member after successful signup
      if (data.user) {
        try {
          // Use full_name if provided, otherwise use display_name, or fallback to email prefix
          const memberName = metadata.full_name || metadata.display_name || email.split('@')[0];

          const teamMemberData = {
            // Don't set id - let it auto-increment
            name: memberName,
            email: email,
            nipp: metadata.nipp || '',
            jabatan: 'pending_approval', // Use jabatan field for approval status
            role: 'Level 3', // Default role for new members
            color: getRandomColor()
            // Note: created_at and updated_at columns don't exist in the table
          };

          const { error: teamError } = await supabase
            .from('team_members')
            .insert([teamMemberData]);

          if (teamError) {
            console.error('Failed to create team member:', teamError);
            // Don't throw here - user account was created successfully
          } else {
            console.log('Team member created successfully for user:', data.user.id, 'with name:', memberName);
          }
        } catch (teamError) {
          console.error('Error creating team member:', teamError);
          // Don't throw here - user account was created successfully
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

        // Check if user is approved before allowing login
        if (data.user) {
          const { data: memberData, error: memberError } = await supabase
            .from('team_members')
            .select('jabatan')
            .eq('email', data.user.email)
            .single();

          if (memberError) {
            console.error('Error checking member status:', memberError);
            // If member not found, they might be a new signup, allow login but they'll be pending
          } else if (memberData?.jabatan === 'pending_approval') {
            // Sign out the user since they're not approved
            await supabase.auth.signOut();
            return {
              data: null,
              error: { message: 'Your account is pending approval by an administrator. Please contact your administrator.' }
            };
          } else if (memberData?.jabatan === 'rejected') {
            // Sign out the user since they're rejected
            await supabase.auth.signOut();
            return {
              data: null,
              error: { message: 'Your account has been rejected. Please contact your administrator.' }
            };
          }
        }      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      setCurrentUserRole(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      return { data, error: null };
    } catch (error) {
      console.error('Session refresh error:', error);
      // If refresh fails, sign out the user
      await signOut();
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const ensureTeamMemberExists = async (userParam) => {
    const currentUser = userParam || user;
    if (!currentUser) {
      console.log('ensureTeamMemberExists: No user available');
      return;
    }

    console.log('ensureTeamMemberExists: Checking for user:', currentUser.id, currentUser.email);

    try {
      // Check if team member already exists (by email since user_id doesn't exist)
      const { data: existingMember, error: checkError } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', currentUser.email)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking team member existence:', checkError);
        return;
      }

      if (existingMember) {
        console.log('Team member already exists for user:', currentUser.id, '(email:', currentUser.email + ')');
        return;
      }

      console.log('Creating team member for user:', currentUser.id);

      // Create team member if it doesn't exist
      const memberName = currentUser.user_metadata?.full_name ||
                        currentUser.user_metadata?.display_name ||
                        currentUser.email?.split('@')[0] || 'Unknown User';

      console.log('User metadata:', currentUser.user_metadata);
      console.log('Using member name:', memberName);

      const teamMemberData = {
        // Don't set id - let it auto-increment
        name: memberName,
        email: currentUser.email,
        nipp: currentUser.user_metadata?.nipp || '',
        jabatan: currentUser.user_metadata?.jabatan || '',
        role: 'Level2',
        color: getRandomColor()
        // Note: created_at and updated_at columns don't exist in the table
      };

      console.log('Inserting team member data:', teamMemberData);

      const { error: createError } = await supabase
        .from('team_members')
        .insert([teamMemberData]);

      if (createError) {
        console.error('Failed to create team member for existing user:', createError);
      } else {
        console.log('Team member created successfully for existing user:', currentUser.id, 'with name:', memberName);
      }
    } catch (error) {
      console.error('Error in ensureTeamMemberExists:', error);
    }
  };

  const resetPassword = async (email) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserRole = async () => {
    if (!user?.email) {
      setCurrentUserRole(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('email', user.email)
        .single();

      if (error) {
        console.error('Error getting user role:', error);
        setCurrentUserRole(null);
        return null;
      }

      setCurrentUserRole(data?.role || null);
      return data?.role || null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      setCurrentUserRole(null);
      return null;
    }
  };

  const value = {
    user,
    session,
    loading,
    currentUserRole,
    signUp,
    signIn,
    signOut,
    refreshSession,
    ensureTeamMemberExists,
    resetPassword,
    updatePassword,
    updateProfile,
    getCurrentUserRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};