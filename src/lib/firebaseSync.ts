import { doc, getDoc, getDocs, collection, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface SyncEventPayload {
  deviceId?: string;
  type?: 'checkin' | 'walkin' | 'pos' | 'class' | 'pt' | 'membership' | 'shift' | 'expense' | 'reset';
  title?: string;
  message?: string;
  timestamp?: string;
  memberName?: string;
  memberId?: string;
}

export interface GymDataStore {
  members: any[];
  attendance: any[];
  expenses: any[];
  sales: any[];
  registeredStaff: any[];
  activeShift: any | null;
  staffPin: string;
  availableStores?: string[];
}

export function extractStoreFromDoc(data: any): GymDataStore {
  if (data?.store && Array.isArray(data.store.members)) {
    const s = data.store;
    return {
      members: Array.isArray(s.members) ? s.members : [],
      attendance: Array.isArray(s.attendance) ? s.attendance : [],
      sales: Array.isArray(s.sales) ? s.sales : [],
      expenses: Array.isArray(s.expenses) ? s.expenses : [],
      registeredStaff: Array.isArray(s.registeredStaff) && s.registeredStaff.length > 0 ? s.registeredStaff : [{ id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }],
      activeShift: s.activeShift !== undefined ? s.activeShift : null,
      staffPin: s.staffPin || '123456',
      availableStores: Array.isArray(s.availableStores) && s.availableStores.length > 0 ? s.availableStores : ['Binti Gym'],
    };
  }

  return {
    members: Array.isArray(data?.members) ? data.members : [],
    attendance: Array.isArray(data?.attendance) ? data.attendance : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    registeredStaff: Array.isArray(data?.registeredStaff) && data.registeredStaff.length > 0 ? data.registeredStaff : [{ id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }],
    activeShift: data?.activeShift !== undefined ? data.activeShift : null,
    staffPin: data?.staffPin || data?.pin || '123456',
    availableStores: Array.isArray(data?.availableStores) && data.availableStores.length > 0 ? data.availableStores : ['Binti Gym'],
  };
}

function getLocalGymStore(): GymDataStore {
  try {
    const saved = localStorage.getItem('gym_data_store_v1');
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    members: [],
    attendance: [],
    expenses: [],
    sales: [],
    registeredStaff: [
      { id: 'STF-101', name: 'System Admin', phone: '8000000', pin: '123456', registeredAt: new Date().toISOString() }
    ],
    activeShift: null,
    staffPin: '123456',
    availableStores: ['Binti Gym']
  };
}

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let stored = localStorage.getItem('gym_device_id');
    if (!stored) {
      stored = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('gym_device_id', stored);
    }
    cachedDeviceId = stored;
    return stored;
  } catch {
    cachedDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    return cachedDeviceId;
  }
}

// BroadcastChannel for instant same-browser cross-tab sync
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('binti_gym_live_sync_channel')
    : null;

export function getStoredBusinessName(): string {
  try {
    return localStorage.getItem('current_business_name') || 'Binti Gym';
  } catch {
    return 'Binti Gym';
  }
}

export function getStoredBusinessPin(): string {
  try {
    return localStorage.getItem('current_business_pin') || '1234';
  } catch {
    return '1234';
  }
}

export function normalizeStoreKey(businessName?: string): string {
  const name = businessName || getStoredBusinessName();
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return clean || 'binti_gym';
}

function getStoreDocRef(businessName?: string) {
  const key = normalizeStoreKey(businessName);
  return doc(db, 'gym_stores', key);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function fetchStoresFromCloud(): Promise<string[]> {
  const storesSet = new Set<string>(['Binti Gym']);
  try {
    const regDoc = doc(db, 'gym', 'registry');
    const snap = await withTimeout(getDoc(regDoc), 4000, null as any);
    if (snap && snap.exists && snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.stores)) {
        data.stores.forEach((s: string) => {
          if (s && s.trim()) storesSet.add(s.trim());
        });
      }
    }
  } catch {}

  try {
    const storesColl = collection(db, 'gym_stores');
    const snapColl = await withTimeout(getDocs(storesColl), 4000, null as any);
    if (snapColl && snapColl.docs) {
      snapColl.docs.forEach((d: any) => {
        const dData = d.data();
        if (dData && dData.name && typeof dData.name === 'string' && dData.name.trim()) {
          storesSet.add(dData.name.trim());
        }
      });
    }
  } catch {}

  return Array.from(storesSet);
}

export async function authenticateCloudBusinessStore(
  name: string,
  pin: string,
  mode: 'login' | 'register'
): Promise<{ success: boolean; message?: string; store?: GymDataStore; businessName?: string; pin?: string }> {
  const cleanName = name.trim();
  const cleanPin = pin.trim();
  const docRef = getStoreDocRef(cleanName);

  try {
    let snapshot = await withTimeout(getDoc(docRef), 8000, null as any);

    // If direct key doesn't hit, search case-insensitively across gym_stores
    if (!snapshot || !snapshot.exists || !snapshot.exists()) {
      try {
        const storesColl = collection(db, 'gym_stores');
        const snapColl = await withTimeout(getDocs(storesColl), 5000, null as any);
        if (snapColl && snapColl.docs) {
          const matchDoc = snapColl.docs.find((d: any) => {
            const dName = (d.data()?.name || '').trim().toLowerCase();
            return dName === cleanName.toLowerCase() || d.id === normalizeStoreKey(cleanName);
          });
          if (matchDoc) {
            snapshot = matchDoc;
          }
        }
      } catch {}
    }

    if (mode === 'login') {
      if (snapshot && snapshot.exists && snapshot.exists()) {
        const data = snapshot.data();
        const storedPin = String(data.pin || data.store?.staffPin || '1234').trim();
        if (storedPin !== cleanPin) {
          return {
            success: false,
            message: `Incorrect 4-digit PIN code for "${data.name || cleanName}". Please check the PIN.`,
          };
        }
        const store = extractStoreFromDoc(data);
        try {
          localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
          if (store.registeredStaff) {
            localStorage.setItem('gym_registered_staff', JSON.stringify(store.registeredStaff));
          }
          if (store.staffPin) {
            localStorage.setItem('gym_staff_pin', store.staffPin);
          }
          if (store.availableStores) {
            localStorage.setItem('gym_available_stores', JSON.stringify(store.availableStores));
          }
          if (store.activeShift !== undefined) {
            if (store.activeShift) {
              localStorage.setItem('gym_active_shift', JSON.stringify(store.activeShift));
            } else {
              localStorage.removeItem('gym_active_shift');
            }
          }
        } catch {}

        return {
          success: true,
          businessName: data.name || cleanName,
          pin: cleanPin,
          store,
        };
      } else {
        // Not found in cloud yet: auto-register and sync this store to Cloud Firestore so all other devices can connect!
        const initialStore: GymDataStore = getLocalGymStore();
        if (!initialStore.availableStores) initialStore.availableStores = [];
        if (!initialStore.availableStores.includes(cleanName)) {
          initialStore.availableStores.push(cleanName);
        }

        const payload = {
          name: cleanName,
          pin: cleanPin,
          updatedAt: Date.now(),
          deviceId: getDeviceId(),
          store: initialStore,
          members: initialStore.members || [],
          attendance: initialStore.attendance || [],
          sales: initialStore.sales || [],
          expenses: initialStore.expenses || [],
          registeredStaff: initialStore.registeredStaff || [],
          activeShift: initialStore.activeShift || null,
          staffPin: cleanPin,
          availableStores: initialStore.availableStores || [cleanName],
        };

        await withTimeout(setDoc(docRef, payload, { merge: true }), 8000, null);

        try {
          const regDoc = doc(db, 'gym', 'registry');
          const regSnap = await withTimeout(getDoc(regDoc), 4000, null as any);
          const existingStores: string[] =
            regSnap && regSnap.exists && regSnap.exists() && Array.isArray(regSnap.data()?.stores)
              ? regSnap.data().stores
              : ['Binti Gym'];
          if (!existingStores.includes(cleanName)) {
            existingStores.push(cleanName);
            await withTimeout(setDoc(regDoc, { stores: existingStores }, { merge: true }), 4000, null);
          }
        } catch {}

        try {
          localStorage.setItem('gym_data_store_v1', JSON.stringify(initialStore));
          localStorage.setItem('current_business_name', cleanName);
          localStorage.setItem('current_business_pin', cleanPin);
        } catch {}

        return {
          success: true,
          businessName: cleanName,
          pin: cleanPin,
          store: initialStore,
        };
      }
    } else {
      // REGISTER MODE
      if (snapshot && snapshot.exists && snapshot.exists()) {
        const data = snapshot.data();
        const storedPin = String(data.pin || data.store?.staffPin || '1234').trim();
        if (storedPin === cleanPin) {
          const store = extractStoreFromDoc(data);
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
          } catch {}
          return {
            success: true,
            businessName: data.name || cleanName,
            pin: cleanPin,
            store,
          };
        }
        return {
          success: false,
          message: `Business "${data.name || cleanName}" is already registered. Please switch to "Log In Store" and enter its 4-digit PIN.`,
        };
      }

      let storeToRegister: GymDataStore;
      try {
        const raw = localStorage.getItem('gym_data_store_v1');
        storeToRegister = raw
          ? JSON.parse(raw)
          : {
              members: [],
              attendance: [],
              expenses: [],
              sales: [],
              registeredStaff: [],
              activeShift: null,
              staffPin: cleanPin,
            };
      } catch {
        storeToRegister = {
          members: [],
          attendance: [],
          expenses: [],
          sales: [],
          registeredStaff: [],
          activeShift: null,
          staffPin: cleanPin,
        };
      }

      storeToRegister.staffPin = cleanPin;

      const payload = {
        name: cleanName,
        pin: cleanPin,
        updatedAt: Date.now(),
        deviceId: getDeviceId(),
        store: storeToRegister,
        members: storeToRegister.members || [],
        attendance: storeToRegister.attendance || [],
        sales: storeToRegister.sales || [],
        expenses: storeToRegister.expenses || [],
        registeredStaff: storeToRegister.registeredStaff || [],
        activeShift: storeToRegister.activeShift || null,
        staffPin: cleanPin,
        availableStores: [cleanName],
      };

      await withTimeout(setDoc(docRef, payload, { merge: true }), 8000, null);

      try {
        const regDoc = doc(db, 'gym', 'registry');
        const regSnap = await withTimeout(getDoc(regDoc), 4000, null as any);
        const existingStores: string[] =
          regSnap && regSnap.exists && regSnap.exists() && Array.isArray(regSnap.data()?.stores)
            ? regSnap.data().stores
            : ['Binti Gym'];
        if (!existingStores.includes(cleanName)) {
          existingStores.push(cleanName);
          await withTimeout(setDoc(regDoc, { stores: existingStores }, { merge: true }), 4000, null);
        }
      } catch {}

      try {
        localStorage.setItem('gym_data_store_v1', JSON.stringify(storeToRegister));
        localStorage.setItem('current_business_name', cleanName);
        localStorage.setItem('current_business_pin', cleanPin);
      } catch {}

      return {
        success: true,
        businessName: cleanName,
        pin: cleanPin,
        store: storeToRegister,
      };
    }
  } catch (err: any) {
    console.warn('Cloud store auth fallback:', err);
    return {
      success: true,
      businessName: cleanName,
      pin: cleanPin,
    };
  }
}

export async function syncStoreToBackend(store: GymDataStore, businessName?: string): Promise<GymDataStore | null> {
  try {
    const biz = businessName || getStoredBusinessName();
    const pin = getStoredBusinessPin();
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Business-Name': biz,
        'X-Business-Pin': pin,
      },
      body: JSON.stringify({ store }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.store) {
        return data.store as GymDataStore;
      }
    }
  } catch {}
  return null;
}

export async function fetchCloudStore(businessName?: string): Promise<GymDataStore | null> {
  try {
    const activeBiz = (businessName || getStoredBusinessName()).trim();
    const storeDocRef = getStoreDocRef(activeBiz);
    let snapshot = await withTimeout(getDoc(storeDocRef), 8000, null as any);

    // If direct lookup fails, search across gym_stores
    if (!snapshot || !snapshot.exists || !snapshot.exists()) {
      try {
        const storesColl = collection(db, 'gym_stores');
        const snapColl = await withTimeout(getDocs(storesColl), 4000, null as any);
        if (snapColl && snapColl.docs) {
          const matchDoc = snapColl.docs.find((d: any) => {
            const dName = (d.data()?.name || '').trim().toLowerCase();
            return dName === activeBiz.toLowerCase() || d.id === normalizeStoreKey(activeBiz);
          });
          if (matchDoc) {
            snapshot = matchDoc;
          }
        }
      } catch {}
    }

    if (snapshot && snapshot.exists && snapshot.exists()) {
      const data = snapshot.data();
      const store = extractStoreFromDoc(data);
      if (store) {
        try {
          localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
          if (store.registeredStaff) {
            localStorage.setItem('gym_registered_staff', JSON.stringify(store.registeredStaff));
          }
          if (store.staffPin) {
            localStorage.setItem('gym_staff_pin', store.staffPin);
          }
          if (store.availableStores) {
            localStorage.setItem('gym_available_stores', JSON.stringify(store.availableStores));
          }
          if (store.activeShift !== undefined) {
            if (store.activeShift) {
              localStorage.setItem('gym_active_shift', JSON.stringify(store.activeShift));
            } else {
              localStorage.removeItem('gym_active_shift');
            }
          }
        } catch (e) {
          console.warn('Failed to sync cloud store to localStorage:', e);
        }

        syncStoreToBackend(store, activeBiz);
        return store;
      }
    }
  } catch (err) {
    console.warn('Error fetching cloud store:', err);
  }
  return null;
}

export function subscribeLiveSync(
  onUpdate: (eventData?: SyncEventPayload, isRemote?: boolean, remoteStore?: GymDataStore) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'offline') => void,
  businessName?: string
) {
  let unsubFirestore = () => {};
  let subscriberLastTimestamp = 0;
  const myDeviceId = getDeviceId();
  const activeBiz = (businessName || getStoredBusinessName()).trim();

  const updateNetworkStatus = () => {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      if (onStatusChange) onStatusChange('offline');
    }
  };

  updateNetworkStatus();

  const handleOnline = () => {
    if (onStatusChange) onStatusChange('connected');
    try {
      const pending = localStorage.getItem('gym_pending_offline_sync');
      if (pending === 'true') {
        localStorage.removeItem('gym_pending_offline_sync');
        broadcastLiveSync({
          type: 'reset',
          title: '📶 Back Online',
          message: 'Offline changes successfully synchronized with cloud database.',
        }, undefined, activeBiz);
      }
    } catch {}
  };

  const handleOffline = () => {
    if (onStatusChange) onStatusChange('offline');
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  // 1. Listen to Firestore real-time doc updates across all devices
  try {
    const storeDocRef = getStoreDocRef(activeBiz);
    unsubFirestore = onSnapshot(
      storeDocRef,
      async (snapshot) => {
        const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
        if (onStatusChange) onStatusChange(isOnline ? 'connected' : 'offline');
        if (snapshot.exists()) {
          const data = snapshot.data();
          const updatedAt = Number(data.updatedAt) || 0;
          const isRemote = Boolean(data.deviceId && data.deviceId !== myDeviceId);
          const store = extractStoreFromDoc(data);

          // Accept remote changes or newer timestamps
          if (isRemote || updatedAt > subscriberLastTimestamp) {
            subscriberLastTimestamp = Math.max(subscriberLastTimestamp, updatedAt);

            if (store) {
              try {
                localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
                if (store.registeredStaff) {
                  localStorage.setItem('gym_registered_staff', JSON.stringify(store.registeredStaff));
                }
                if (store.staffPin) {
                  localStorage.setItem('gym_staff_pin', store.staffPin);
                }
                if (store.availableStores) {
                  localStorage.setItem('gym_available_stores', JSON.stringify(store.availableStores));
                }
                if (store.activeShift !== undefined) {
                  if (store.activeShift) {
                    localStorage.setItem('gym_active_shift', JSON.stringify(store.activeShift));
                  } else {
                    localStorage.removeItem('gym_active_shift');
                  }
                }
              } catch (e) {
                console.warn('Error updating local cache from remote cloud store:', e);
              }
              await syncStoreToBackend(store, activeBiz);
            }

            onUpdate(data.lastEvent || undefined, isRemote, store);
          }
        }
      },
      (error) => {
        console.warn('Firestore live sync listener status:', error);
        const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
        if (onStatusChange) onStatusChange(isOnline ? 'reconnecting' : 'offline');
      }
    );
  } catch (err) {
    console.warn('Firestore live sync subscribe error:', err);
    if (onStatusChange) onStatusChange('offline');
  }

  // 2. Periodic cloud sync poll to guarantee background updates across networks
  const pollInterval = setInterval(async () => {
    try {
      const storeDocRef = getStoreDocRef(activeBiz);
      const snap = await getDoc(storeDocRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        const updatedAt = Number(data.updatedAt) || 0;
        const isRemote = Boolean(data.deviceId && data.deviceId !== myDeviceId);
        if (updatedAt > subscriberLastTimestamp && isRemote) {
          subscriberLastTimestamp = updatedAt;
          const store = extractStoreFromDoc(data);
          onUpdate(data.lastEvent || undefined, isRemote, store);
        }
      }
    } catch {}
  }, 10000);

  // 3. Listen to BroadcastChannel for local cross-tab instant sync
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data) {
      const isRemote = event.data.deviceId !== myDeviceId;
      if (isRemote || event.data.updatedAt > subscriberLastTimestamp) {
        if (event.data.updatedAt > subscriberLastTimestamp) {
          subscriberLastTimestamp = event.data.updatedAt;
        }
        const store = extractStoreFromDoc(event.data);
        if (store) {
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(store));
          } catch {}
        }
        onUpdate(event.data.lastEvent || undefined, isRemote, store);
      }
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  // 4. Storage event fallback for cross-tab sync
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'gym_live_sync_trigger') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        const isRemote = parsed.deviceId !== myDeviceId;
        if (isRemote || parsed.updatedAt > subscriberLastTimestamp) {
          if (parsed.updatedAt > subscriberLastTimestamp) {
            subscriberLastTimestamp = parsed.updatedAt;
          }
          const store = extractStoreFromDoc(parsed);
          onUpdate(parsed.lastEvent || undefined, isRemote, store);
        }
      } catch {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    unsubFirestore();
    clearInterval(pollInterval);
    if (syncChannel) {
      syncChannel.removeEventListener('message', handleBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}

export async function broadcastLiveSync(eventData?: SyncEventPayload, storeData?: GymDataStore, businessName?: string) {
  const timestamp = Date.now();
  const myDeviceId = getDeviceId();
  const activeBiz = (businessName || getStoredBusinessName()).trim();
  const activePin = getStoredBusinessPin();

  let storeToSync = storeData;
  if (!storeToSync && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('gym_data_store_v1');
      if (saved) storeToSync = JSON.parse(saved);
    } catch {}
  }

  const payload = {
    name: activeBiz,
    pin: activePin,
    updatedAt: timestamp,
    deviceId: myDeviceId,
    lastEvent: eventData ? { ...eventData, deviceId: myDeviceId } : null,
    store: storeToSync || null,
    members: storeToSync?.members || [],
    attendance: storeToSync?.attendance || [],
    sales: storeToSync?.sales || [],
    expenses: storeToSync?.expenses || [],
    registeredStaff: storeToSync?.registeredStaff || [],
    activeShift: storeToSync?.activeShift !== undefined ? storeToSync.activeShift : null,
    staffPin: storeToSync?.staffPin || activePin,
    availableStores: storeToSync?.availableStores || [activeBiz],
  };

  // 1. Same-browser cross-tab sync
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {}
  }

  try {
    localStorage.setItem('gym_live_sync_trigger', JSON.stringify(payload));
  } catch {}

  // 2. Sync to local backend server
  if (storeToSync) {
    syncStoreToBackend(storeToSync, activeBiz);
  }

  // 3. Write directly to Firestore cloud database for instant cross-device sync
  try {
    const storeDocRef = getStoreDocRef(activeBiz);
    await setDoc(storeDocRef, payload, { merge: true });

    // Update global registry of stores
    try {
      const regDoc = doc(db, 'gym', 'registry');
      const regSnap = await getDoc(regDoc);
      const existingStores: string[] =
        regSnap && regSnap.exists() && Array.isArray(regSnap.data()?.stores)
          ? regSnap.data().stores
          : ['Binti Gym'];
      if (!existingStores.includes(activeBiz)) {
        existingStores.push(activeBiz);
        await setDoc(regDoc, { stores: existingStores, updatedAt: timestamp }, { merge: true });
      }
    } catch (regErr) {
      console.warn('Registry update notice:', regErr);
    }
  } catch (err) {
    console.warn('Firestore cloud broadcast error (queued locally by SDK):', err);
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      try {
        localStorage.setItem('gym_pending_offline_sync', 'true');
      } catch {}
    }
  }
}
