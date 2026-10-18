import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from '../config/firebase';
import type { Church, UserProfile } from '../types';
import {
  fetchChurchDoc,
  saveChurchDoc,
  saveStoredChurch,
  checkIfUserIsWorker,
  deleteChurchWorkspaceDoc,
  purgeLocalWorkspaceData,
} from '../services/dataService';

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  churchName: string;
  branchName: string;
  churchCode: string;
}

interface AuthContextType {
  user: UserProfile | null;
  church: Church | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ isNewUser: boolean; churchExists: boolean }>;
  signInWithGoogleRedirect: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateChurch: (updated: Partial<Church>) => Promise<void>;
  createChurchWorkspace: (data: Omit<Church, 'id' | 'adminUids'>) => Promise<Church>;
  deleteChurchWorkspace: () => Promise<void>;
  isLiveFirebase: boolean;
}

const SESSION_KEY = 'sanctuary_active_session';
const ACCOUNTS_KEY = 'sanctuary_registered_admins';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Auth state
  useEffect(() => {
    let isMounted = true;

    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (!isMounted) return;
        if (fbUser) {
          const profile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0],
            photoURL: fbUser.photoURL,
            emailVerified: fbUser.emailVerified,
          };
          // Fetch church document FIRST before committing user to state
          const churchData = await fetchChurchDoc(fbUser.uid, fbUser.email);
          if (!churchData && fbUser.email) {
            const isWorker = await checkIfUserIsWorker(fbUser.email, fbUser.uid);
            if (isWorker) {
              if (auth) await signOut(auth);
              if (isMounted) {
                setUser(null);
                setChurch(null);
                setLoading(false);
              }
              return;
            }
          }
          if (isMounted) {
            setUser(profile);
            setChurch(churchData);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setChurch(null);
            setLoading(false);
          }
        }
      });
      return () => {
        isMounted = false;
        unsubscribe();
      };
    } else {
      // Local session restoration
      const activeSession = localStorage.getItem(SESSION_KEY);
      if (activeSession) {
        try {
          const profile: UserProfile = JSON.parse(activeSession);
          fetchChurchDoc(profile.uid, profile.email).then((c) => {
            if (isMounted) {
              setUser(profile);
              setChurch(c);
              setLoading(false);
            }
          });
        } catch {
          localStorage.removeItem(SESSION_KEY);
          if (isMounted) {
            setUser(null);
            setChurch(null);
            setLoading(false);
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
          setChurch(null);
          setLoading(false);
        }
      }
      return () => {
        isMounted = false;
      };
    }
  }, []);

  // Real-time synchronization of church document across the entire admin application
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !church?.id) return;

    const churchRef = doc(db, 'churches', church.id);
    const unsubscribe = onSnapshot(
      churchRef,
      (snap) => {
        if (snap.exists()) {
          const fresh = { id: snap.id, ...(snap.data() as Omit<Church, 'id'>) };
          setChurch(fresh);
          saveStoredChurch(fresh);
        }
      },
      (err) => {
        console.warn('Real-time church doc listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [church?.id]);

  const signInWithGoogle = async (): Promise<{ isNewUser: boolean; churchExists: boolean }> => {
    if (isFirebaseConfigured && auth) {
      const cred = await signInWithPopup(auth, googleProvider);
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email?.split('@')[0],
        photoURL: cred.user.photoURL,
        emailVerified: cred.user.emailVerified,
      };

      // CRITICAL: Await church lookup BEFORE updating React state to eliminate the onboarding screen flash
      const existingChurch = await fetchChurchDoc(cred.user.uid, cred.user.email);

      // Security check: If no existing church workspace, ensure account is NOT a mobile workforce member
      if (!existingChurch && cred.user.email) {
        const isWorker = await checkIfUserIsWorker(cred.user.email, cred.user.uid);
        if (isWorker) {
          if (auth) await signOut(auth);
          throw new Error(
            `This account (${cred.user.email}) is registered as a workforce member on the mobile app. Workforce accounts cannot create or access administrative workspaces on the web portal. Please sign in with a designated administrator account.`
          );
        }
      }

      setUser(profile);
      setChurch(existingChurch);

      if (existingChurch) {
        return { isNewUser: false, churchExists: true };
      } else {
        return { isNewUser: true, churchExists: false };
      }
    } else {
      // Local fallback with verified Google credentials simulation
      const mockGoogleProfile: UserProfile = {
        uid: 'google-usr-' + Date.now(),
        email: 'pastor.office@sanctuary.org',
        displayName: 'Pastor Lead Minister',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        emailVerified: true,
      };
      const existing = await fetchChurchDoc(mockGoogleProfile.uid, mockGoogleProfile.email);
      setUser(mockGoogleProfile);
      setChurch(existing);
      localStorage.setItem(SESSION_KEY, JSON.stringify(mockGoogleProfile));
      if (existing) {
        return { isNewUser: false, churchExists: true };
      }
      return { isNewUser: true, churchExists: false };
    }
  };

  const signInWithGoogleRedirect = async (): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      await signInWithRedirect(auth, googleProvider);
    }
  };

  const login = async (email: string, pass: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();

    if (isFirebaseConfigured && auth) {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cleanEmail.split('@')[0],
        photoURL: cred.user.photoURL,
        emailVerified: cred.user.emailVerified,
      };
      const churchData = await fetchChurchDoc(cred.user.uid, cred.user.email);
      if (!churchData && cleanEmail) {
        const isWorker = await checkIfUserIsWorker(cleanEmail, cred.user.uid);
        if (isWorker) {
          if (auth) await signOut(auth);
          throw new Error(
            `This account (${cleanEmail}) is registered as a workforce member on the mobile app. Workforce accounts cannot access the administrative portal.`
          );
        }
      }
      setUser(profile);
      setChurch(churchData);
    } else {
      const accountsRaw = localStorage.getItem(ACCOUNTS_KEY);
      const accounts: Array<{
        email: string;
        passwordHash: string;
        displayName: string;
        uid: string;
      }> = accountsRaw ? JSON.parse(accountsRaw) : [];

      const found = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
      if (!found || found.passwordHash !== pass) {
        throw new Error('Invalid email or password. Please verify your credentials or register an account.');
      }

      const profile: UserProfile = {
        uid: found.uid,
        email: found.email,
        displayName: found.displayName,
      };

      const c = await fetchChurchDoc(found.uid, found.email);
      setUser(profile);
      setChurch(c);
      localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    }
  };

  const register = async (payload: RegisterPayload): Promise<void> => {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanCode = payload.churchCode.trim().toUpperCase();

    // Verify this email is not a mobile workforce member
    const isWorker = await checkIfUserIsWorker(cleanEmail);
    if (isWorker) {
      throw new Error(
        `This email address (${cleanEmail}) is registered as a workforce member on the mobile app. Workforce accounts cannot create administrator workspaces. Please use a separate administrator email address.`
      );
    }

    if (isFirebaseConfigured && auth) {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, payload.password);
      if (cred.user && payload.displayName) {
        await updateProfile(cred.user, { displayName: payload.displayName });
      }

      const profile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: payload.displayName || cleanEmail.split('@')[0],
        photoURL: null,
        emailVerified: cred.user.emailVerified,
      };
      setUser(profile);

      const newChurch: Church = {
        id: cred.user.uid,
        churchName: payload.churchName.trim(),
        branchName: payload.branchName.trim(),
        churchCode: cleanCode,
        adminUids: [cred.user.uid],
        adminEmail: cleanEmail,
        departments: [
          'Engineering & Tech',
          'Operations & Logistics',
          'Media & Marketing',
          'Human Resources',
          'Finance & Legal',
          'Administration',
        ],
        beaconConfig: {
          targetBssid: '',
          ssidHint: '',
        },
        geoFallback: {
          latitude: 0,
          longitude: 0,
          radiusMeters: 0,
        },
        policySettings: {
          serviceDays: [1, 2, 3, 4, 5],
          arrivalCutoff: '07:00',
          lateTolerance: '07:30',
          allowLateSignIn: true,
          enableSignOut: false,
          signOutTime: '17:00',
        },
      };
      await saveChurchDoc(newChurch);
      setChurch(newChurch);
    } else {
      const accountsRaw = localStorage.getItem(ACCOUNTS_KEY);
      const accounts: Array<{
        email: string;
        passwordHash: string;
        displayName: string;
        uid: string;
      }> = accountsRaw ? JSON.parse(accountsRaw) : [];

      if (accounts.some((a) => a.email.toLowerCase() === cleanEmail)) {
        throw new Error('An administrator account with this email address already exists. Please sign in.');
      }

      const newUid = 'admin-' + Date.now();
      accounts.push({
        email: cleanEmail,
        passwordHash: payload.password,
        displayName: payload.displayName.trim(),
        uid: newUid,
      });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

      const profile: UserProfile = {
        uid: newUid,
        email: cleanEmail,
        displayName: payload.displayName.trim(),
      };
      setUser(profile);

      const newChurch: Church = {
        id: newUid,
        churchName: payload.churchName.trim(),
        branchName: payload.branchName.trim(),
        churchCode: cleanCode,
        adminUids: [newUid],
        adminEmail: cleanEmail,
        departments: [
          'Engineering & Tech',
          'Operations & Logistics',
          'Media & Marketing',
          'Human Resources',
          'Finance & Legal',
          'Administration',
        ],
        beaconConfig: {
          targetBssid: '',
          ssidHint: '',
        },
        geoFallback: {
          latitude: 0,
          longitude: 0,
          radiusMeters: 0,
        },
        policySettings: {
          serviceDays: [1, 2, 3, 4, 5],
          arrivalCutoff: '07:00',
          lateTolerance: '07:30',
          allowLateSignIn: true,
          enableSignOut: false,
          signOutTime: '17:00',
        },
      };
      saveStoredChurch(newChurch);
      localStorage.setItem(`sanctuary_church_${newUid}`, JSON.stringify(newChurch));
      setChurch(newChurch);
      localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    }
  };

  const createChurchWorkspace = async (
    data: Omit<Church, 'id' | 'adminUids'>
  ): Promise<Church> => {
    if (!user) throw new Error('Authentication required to provision church workspace.');

    const cleanEmail = (data.adminEmail || user.email || '').trim().toLowerCase();
    const isWorker = await checkIfUserIsWorker(cleanEmail, user.uid);
    if (isWorker) {
      throw new Error(
        `This account is registered as a workforce member on the mobile app and cannot provision an administrator workspace.`
      );
    }

    const newChurch: Church = {
      ...data,
      id: user.uid,
      adminUids: [user.uid],
      adminEmail: data.adminEmail || user.email || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveChurchDoc(newChurch);
    setChurch(newChurch);
    return newChurch;
  };

  const deleteChurchWorkspace = async (): Promise<void> => {
    if (!church) return;
    const cid = church.id;
    const email = church.adminEmail || user?.email;
    await deleteChurchWorkspaceDoc(cid, email);
    setChurch(null);
  };

  const logout = async (): Promise<void> => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    purgeLocalWorkspaceData(church?.id);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setChurch(null);
  };

  const updateChurch = async (updated: Partial<Church>): Promise<void> => {
    if (!church) return;
    const merged: Church = { ...church, ...updated };
    setChurch(merged);
    await saveChurchDoc(merged);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        church,
        loading,
        signInWithGoogle,
        signInWithGoogleRedirect,
        login,
        register,
        logout,
        updateChurch,
        createChurchWorkspace,
        deleteChurchWorkspace,
        isLiveFirebase: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
