import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';
import type { Church, ChurchMember, AttendanceRecord } from '../types';

export const DEFAULT_CHURCH: Church = {
  id: 'apex-global-01',
  churchName: 'Apex Global Technologies',
  branchName: 'Corporate Headquarters',
  churchCode: 'APEX-HQ',
  adminUids: ['admin-demo-1'],
  departments: [
    'Engineering & Tech',
    'Operations & Logistics',
    'Media & Marketing',
    'Human Resources',
    'Finance & Legal',
    'Administration',
  ],
  beaconConfig: {
    targetBssid: '0c:61:f9:65:8f:07',
    ssidHint: 'ApexCorp-Office-5G',
  },
  geoFallback: {
    latitude: 4.975,
    longitude: 8.3417,
    radiusMeters: 10,
  },
  policySettings: {
    serviceDays: [1, 2, 3, 4, 5], // Monday through Friday
    arrivalCutoff: '07:00',
    lateTolerance: '07:30',
    allowLateSignIn: true,
    enableSignOut: false,
    signOutTime: '17:00',
  },
};

export const INITIAL_MEMBERS: ChurchMember[] = [];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

// Local storage keys for local offline mode
const STORAGE_CHURCH = 'sanctuary_church_data';
const STORAGE_ATTENDANCE = 'sanctuary_attendance_data';
const STORAGE_MEMBERS = 'sanctuary_members_data';

export const getStoredChurch = (): Church => {
  const data = localStorage.getItem(STORAGE_CHURCH);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      // fallback
    }
  }
  return DEFAULT_CHURCH;
};

export const saveStoredChurch = (church: Church): void => {
  localStorage.setItem(STORAGE_CHURCH, JSON.stringify(church));
};

const DUMMY_NAMES = [
  'victor u. henshaw',
  'precious t. braide',
  'miracle c. george',
  'joy i. briggs',
  'david o. adeleke',
  'blessing e. okafor',
  'emmanuel k. peters',
  'grace n. amadi',
  'chidi v. nwosu',
  'samuel b. danjuma',
  'staff member (test)',
  'staff member',
];

export const getStoredMembers = (): ChurchMember[] => {
  const data = localStorage.getItem(STORAGE_MEMBERS);
  if (data) {
    try {
      const parsed: ChurchMember[] = JSON.parse(data);
      const real = parsed.filter(
        (m) =>
          !DUMMY_NAMES.some((d) => m.fullName.toLowerCase().includes(d)) &&
          !m.id.startsWith('m-')
      );
      if (real.length !== parsed.length) {
        localStorage.setItem(STORAGE_MEMBERS, JSON.stringify(real));
      }
      return real;
    } catch {
      // fallback
    }
  }
  return [];
};

export const saveStoredMembers = (members: ChurchMember[]): void => {
  localStorage.setItem(STORAGE_MEMBERS, JSON.stringify(members));
};

export const addMemberRecord = (
  memberData: Omit<ChurchMember, 'id' | 'registeredAt'>
): ChurchMember => {
  const current = getStoredMembers();
  const newMember: ChurchMember = {
    ...memberData,
    id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    registeredAt: new Date().toISOString(),
  };
  const updated = [newMember, ...current];
  saveStoredMembers(updated);
  return newMember;
};

export const updateMemberRecord = (updatedMember: ChurchMember): void => {
  const current = getStoredMembers();
  const next = current.map((m) => (m.id === updatedMember.id ? updatedMember : m));
  saveStoredMembers(next);
};

export const deleteMemberRecord = (memberId: string): void => {
  const current = getStoredMembers();
  const next = current.filter((m) => m.id !== memberId);
  saveStoredMembers(next);
};

export const deleteMemberFromFirestore = async (
  churchId: string,
  memberId: string
): Promise<void> => {
  if (isFirebaseConfigured && db) {
    try {
      const memberDocRef = doc(db, 'churches', churchId, 'members', memberId);
      await deleteDoc(memberDocRef);
    } catch (err) {
      console.error('Error deleting member from Firestore:', err);
      throw err;
    }
  }
  deleteMemberRecord(memberId);
};

export const unbindMemberDevice = (memberId: string): void => {
  const current = getStoredMembers();
  const next = current.map((m) =>
    m.id === memberId ? { ...m, boundDeviceId: 'UNBOUND' } : m
  );
  saveStoredMembers(next);
};

export const unbindMemberDeviceInFirestore = async (
  churchId: string,
  memberId: string
): Promise<void> => {
  if (isFirebaseConfigured && db) {
    try {
      const memberDocRef = doc(db, 'churches', churchId, 'members', memberId);
      await updateDoc(memberDocRef, { boundDeviceId: 'UNBOUND' });
    } catch (err) {
      console.warn('Error resetting device in Firestore:', err);
      throw err;
    }
  }
  unbindMemberDevice(memberId);
};

export const subscribeToMembers = (
  churchId: string,
  callback: (members: ChurchMember[]) => void
): (() => void) => {
  if (isFirebaseConfigured && db) {
    try {
      const membersRef = collection(db, 'churches', churchId, 'members');
      const q = query(membersRef, orderBy('registeredAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ChurchMember[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ChurchMember, 'id'>),
          }));
          callback(list.length > 0 ? list : getStoredMembers());
        },
        (error) => {
          console.warn('Firestore members subscription error:', error);
          callback(getStoredMembers());
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('Could not set up Firestore members listener:', err);
    }
  }

  callback(getStoredMembers());
  const interval = setInterval(() => {
    callback(getStoredMembers());
  }, 5000);
  return () => clearInterval(interval);
};

export const clearAllAttendance = (): void => {
  try {
    localStorage.removeItem(STORAGE_ATTENDANCE);
    localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify([]));
  } catch {
    // ignore
  }
};

export const getStoredAttendance = (): AttendanceRecord[] => {
  const data = localStorage.getItem(STORAGE_ATTENDANCE);
  if (data) {
    try {
      const parsed: AttendanceRecord[] = JSON.parse(data);
      // Filter out all dummy demo and simulated test records
      const real = parsed.filter(
        (a) =>
          !DUMMY_NAMES.some((d) => a.memberName.toLowerCase().includes(d)) &&
          !a.id.startsWith('att-10') &&
          !a.id.startsWith('test-')
      );
      if (real.length !== parsed.length) {
        localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(real));
      }
      return real;
    } catch {
      // fallback
    }
  }
  return [];
};

// Immediate module-level purge to clean any legacy dummy records from browser localStorage
try {
  const cached = localStorage.getItem(STORAGE_ATTENDANCE);
  if (cached) {
    const list = JSON.parse(cached);
    if (Array.isArray(list)) {
      const cleaned = list.filter(
        (a: AttendanceRecord) =>
          !DUMMY_NAMES.some((d) => a.memberName?.toLowerCase().includes(d)) &&
          !a.id?.startsWith('att-10')
      );
      localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(cleaned));
    }
  }
} catch {
  // ignore
}

export const saveStoredAttendance = (records: AttendanceRecord[]): void => {
  localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(records));
};

// Purge all workspace data from browser localStorage to prevent resurrecting deleted Firestore data
export const purgeLocalWorkspaceData = (churchId?: string): void => {
  try {
    if (churchId) {
      localStorage.removeItem(`sanctuary_church_${churchId}`);
    }
    localStorage.removeItem(STORAGE_CHURCH);
    localStorage.removeItem('sanctuary_church_data');
    localStorage.removeItem(STORAGE_MEMBERS);
    localStorage.removeItem(STORAGE_ATTENDANCE);

    // Purge any key in localStorage matching sanctuary_church_
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('sanctuary_church_') ||
          key.startsWith('sanctuary_members_') ||
          key.startsWith('sanctuary_attendance_'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Error purging local workspace data:', err);
  }
};

// Firestore integration methods
export const fetchChurchDoc = async (
  churchId: string,
  userEmail?: string | null
): Promise<Church | null> => {
  if (isFirebaseConfigured && db) {
    try {
      // 1. Direct document lookup by ID (e.g. churches/{uid})
      const ref = doc(db, 'churches', churchId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const churchData = { id: snap.id, ...(snap.data() as Omit<Church, 'id'>) };
        saveStoredChurch(churchData);
        localStorage.setItem(`sanctuary_church_${churchId}`, JSON.stringify(churchData));
        return churchData;
      }

      // 2. Query churches collection where adminUids contains churchId
      const churchesCol = collection(db, 'churches');
      const qUids = query(churchesCol, where('adminUids', 'array-contains', churchId));
      const snapUids = await getDocs(qUids);
      if (!snapUids.empty) {
        const found = snapUids.docs[0];
        const churchData = { id: found.id, ...(found.data() as Omit<Church, 'id'>) };
        saveStoredChurch(churchData);
        localStorage.setItem(`sanctuary_church_${churchId}`, JSON.stringify(churchData));
        return churchData;
      }

      // 3. Query churches collection where adminEmail matches userEmail
      if (userEmail) {
        const cleanEmail = userEmail.trim().toLowerCase();
        const qEmail = query(churchesCol, where('adminEmail', '==', cleanEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const found = snapEmail.docs[0];
          const churchData = { id: found.id, ...(found.data() as Omit<Church, 'id'>) };
          // Link this user's UID to adminUids for fast direct lookup next time
          if (!churchData.adminUids) {
            churchData.adminUids = [churchId];
          } else if (!churchData.adminUids.includes(churchId)) {
            churchData.adminUids.push(churchId);
          }
          try {
            await updateDoc(doc(db, 'churches', found.id), {
              adminUids: churchData.adminUids,
            });
          } catch {
            // non-fatal
          }
          saveStoredChurch(churchData);
          localStorage.setItem(`sanctuary_church_${churchId}`, JSON.stringify(churchData));
          return churchData;
        }
      }

      // Firestore was successfully checked and confirms NO church document exists.
      // Purge any stale localStorage data for this church and return null so the user is routed to /onboarding!
      purgeLocalWorkspaceData(churchId);
      return null;
    } catch (err: unknown) {
      console.warn(
        'Firestore fetchChurchDoc error (Check Firestore Rules in Firebase Console):',
        err
      );
    }
  }

  // 4. Local storage fallback (ONLY for offline or mock mode when Firebase is NOT configured)
  if (!isFirebaseConfigured) {
    const local = localStorage.getItem(`sanctuary_church_${churchId}`);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        // fallback
      }
    }

    const genericLocal = localStorage.getItem('sanctuary_church_data');
    if (genericLocal) {
      try {
        const parsed = JSON.parse(genericLocal);
        if (
          parsed &&
          (parsed.id === churchId ||
            parsed.adminUids?.includes(churchId) ||
            (userEmail && parsed.adminEmail?.toLowerCase() === userEmail.toLowerCase()))
        ) {
          return parsed;
        }
      } catch {
        // fallback
      }
    }
  }

  return null;
};

// Completely wipe a church workspace from Firestore and localStorage
export const deleteChurchWorkspaceDoc = async (
  churchId: string,
  userEmail?: string | null
): Promise<void> => {
  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, 'churches', churchId));
    } catch (err) {
      console.warn('Error deleting church doc from Firestore:', err);
    }
    if (userEmail) {
      try {
        await deleteDoc(doc(db, 'account_roles', userEmail.trim().toLowerCase()));
      } catch (err) {
        console.warn('Error deleting account role from Firestore:', err);
      }
    }
  }
  purgeLocalWorkspaceData(churchId);
};

// Check if an email or UID is registered as a workforce member / employee on the mobile app
export const checkIfUserIsWorker = async (
  email?: string | null,
  uid?: string | null
): Promise<boolean> => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail && !uid) return false;

  // 1. Local storage check for local/offline testing
  const localMembersRaw = localStorage.getItem('sanctuary_members_data');
  if (localMembersRaw) {
    try {
      const localMembers = JSON.parse(localMembersRaw);
      if (
        Array.isArray(localMembers) &&
        localMembers.some(
          (m: any) =>
            (cleanEmail && m.email?.toLowerCase() === cleanEmail) ||
            (uid && m.id === uid)
        )
      ) {
        return true;
      }
    } catch {
      // fallback
    }
  }

  if (isFirebaseConfigured && db) {
    try {
      // 2. Direct O(1) read from central account_roles registry
      if (cleanEmail) {
        const roleRef = doc(db, 'account_roles', cleanEmail);
        const roleSnap = await getDoc(roleRef);
        if (roleSnap.exists()) {
          const roleData = roleSnap.data();
          if (roleData.role === 'WORKER') return true;
          if (roleData.role === 'ADMIN') return false;
        }
      }

      // 3. Query collectionGroup('members') across all organizations
      if (cleanEmail) {
        const membersGroup = collectionGroup(db, 'members');
        const qEmail = query(membersGroup, where('email', '==', cleanEmail), limit(1));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          // Cache in account_roles for instant subsequent checks
          try {
            await setDoc(
              doc(db, 'account_roles', cleanEmail),
              {
                email: cleanEmail,
                role: 'WORKER',
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch {
            // non-fatal
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('Error checking if user is a worker:', err);
    }
  }

  return false;
};

export const saveChurchDoc = async (church: Church): Promise<void> => {
  saveStoredChurch(church);
  localStorage.setItem(`sanctuary_church_${church.id}`, JSON.stringify(church));
  if (isFirebaseConfigured && db) {
    try {
      const ref = doc(db, 'churches', church.id);
      await setDoc(ref, church, { merge: true });

      // Automatically register administrator role in account_roles
      const cleanEmail = church.adminEmail?.trim().toLowerCase();
      if (cleanEmail) {
        try {
          await setDoc(
            doc(db, 'account_roles', cleanEmail),
            {
              email: cleanEmail,
              role: 'ADMIN',
              churchId: church.id,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {
          // non-fatal
        }
      }
    } catch (err: unknown) {
      console.warn(
        'Firestore saveChurchDoc error: Permissions may be restricted in Firebase Console. Local workspace saved.',
        err
      );
    }
  }
};

export const updateBeaconAndGeo = async (
  churchId: string,
  beaconConfig: Church['beaconConfig'],
  geoFallback: Church['geoFallback']
): Promise<void> => {
  const current = getStoredChurch();
  const updated: Church = {
    ...current,
    beaconConfig,
    geoFallback,
  };
  saveStoredChurch(updated);

  if (isFirebaseConfigured && db) {
    try {
      const ref = doc(db, 'churches', churchId);
      await updateDoc(ref, { beaconConfig, geoFallback });
    } catch (err) {
      console.error('Firestore updateBeaconAndGeo error:', err);
    }
  }
};

// Real-time listener for attendance
export const subscribeToAttendance = (
  churchId: string,
  callback: (records: AttendanceRecord[]) => void
): (() => void) => {
  if (isFirebaseConfigured && db) {
    try {
      const attendanceRef = collection(db, 'churches', churchId, 'attendance');
      const q = query(attendanceRef, orderBy('punchedAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: AttendanceRecord[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<AttendanceRecord, 'id'>),
          }));
          callback(list.length > 0 ? list : getStoredAttendance());
        },
        (error) => {
          console.warn('Firestore subscription error, using stored records:', error);
          callback(getStoredAttendance());
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('Could not set up Firestore listener, using local store:', err);
    }
  }

  // Fallback local memory & interval simulator
  callback(getStoredAttendance());
  const interval = setInterval(() => {
    callback(getStoredAttendance());
  }, 5000);

  return () => clearInterval(interval);
};

// Simulate or add a live check-in for testing the dashboard stream
export const simulateLiveCheckIn = (
  member: ChurchMember,
  method: 'WIFI_BSSID' | 'GEO_FALLBACK'
): AttendanceRecord => {
  const current = getStoredAttendance();
  const now = new Date();
  const newRecord: AttendanceRecord = {
    id: `att-${Date.now()}`,
    memberId: member.id,
    memberName: member.fullName,
    department: member.department,
    serviceDate: now.toISOString().split('T')[0],
    punchedAt: now.toISOString(),
    syncedAt: new Date(now.getTime() + (method === 'GEO_FALLBACK' ? 45000 : 2000)).toISOString(),
    verificationMethod: method,
    status: 'ON_TIME',
  };

  const updated = [newRecord, ...current];
  saveStoredAttendance(updated);
  return newRecord;
};
