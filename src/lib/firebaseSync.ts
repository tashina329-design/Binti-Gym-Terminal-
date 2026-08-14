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
        if (data.store) {
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(data.store));
            if (data.store.registeredStaff) {
              localStorage.setItem('gym_registered_staff', JSON.stringify(data.store.registeredStaff));
            }
            if (data.store.staffPin) {
              localStorage.setItem('gym_staff_pin', data.store.staffPin);
            }
            if (data.store.availableStores) {
              localStorage.setItem('gym_available_stores', JSON.stringify(data.store.availableStores));
            }
            if (data.store.activeShift !== undefined) {
              if (data.store.activeShift) {
                localStorage.setItem('gym_active_shift', JSON.stringify(data.store.activeShift));
              } else {
                localStorage.removeItem('gym_active_shift');
              }
            }
          } catch {}
        }
        return {
          success: true,
          businessName: data.name || cleanName,
          pin: cleanPin,
          store: data.store as GymDataStore,
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
          // Store already exists and correct PIN entered -> Log them in!
          if (data.store) {
            try {
              localStorage.setItem('gym_data_store_v1', JSON.stringify(data.store));
            } catch {}
          }
          return {
            success: true,
            businessName: data.name || cleanName,
            pin: cleanPin,
            store: data.store as GymDataStore,
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
      if (data.store) {
        try {
          localStorage.setItem('gym_data_store_v1', JSON.stringify(data.store));
          if (data.store.registeredStaff) {
            localStorage.setItem('gym_registered_staff', JSON.stringify(data.store.registeredStaff));
          }
          if (data.store.staffPin) {
            localStorage.setItem('gym_staff_pin', data.store.staffPin);
          }
          if (data.store.availableStores) {
            localStorage.setItem('gym_available_stores', JSON.stringify(data.store.availableStores));
          }
          if (data.store.activeShift !== undefined) {
            if (data.store.activeShift) {
              localStorage.setItem('gym_active_shift', JSON.stringify(data.store.activeShift));
            } else {
              localStorage.removeItem('gym_active_shift');
            }
          }
        } catch (e) {
          console.warn('Failed to sync cloud store to localStorage:', e);
        }

        syncStoreToBackend(data.store, activeBiz);
        return data.store as GymDataStore;
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
          const updatedAt = data.updatedAt || 0;
          const isRemote = data.deviceId ? data.deviceId !== myDeviceId : false;

          // Accept remote changes or newer timestamps
          if (isRemote || updatedAt > subscriberLastTimestamp) {
            if (updatedAt > subscriberLastTimestamp) {
              subscriberLastTimestamp = updatedAt;
            }

            if (data.store) {
              try {
                localStorage.setItem('gym_data_store_v1', JSON.stringify(data.store));
                if (data.store.registeredStaff) {
                  localStorage.setItem('gym_registered_staff', JSON.stringify(data.store.registeredStaff));
                }
                if (data.store.staffPin) {
                  localStorage.setItem('gym_staff_pin', data.store.staffPin);
                }
                if (data.store.availableStores) {
                  localStorage.setItem('gym_available_stores', JSON.stringify(data.store.availableStores));
                }
                if (data.store.activeShift !== undefined) {
                  if (data.store.activeShift) {
                    localStorage.setItem('gym_active_shift', JSON.stringify(data.store.activeShift));
                  } else {
                    localStorage.removeItem('gym_active_shift');
                  }
                }
              } catch (e) {
                console.warn('Error updating local cache from remote cloud store:', e);
              }
              await syncStoreToBackend(data.store, activeBiz);
            }

            onUpdate(data.lastEvent || undefined, isRemote, data.store || undefined);
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

  // 2. Listen to BroadcastChannel for local cross-tab instant sync
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data) {
      const isRemote = event.data.deviceId !== myDeviceId;
      if (isRemote || event.data.updatedAt > subscriberLastTimestamp) {
        if (event.data.updatedAt > subscriberLastTimestamp) {
          subscriberLastTimestamp = event.data.updatedAt;
        }
        if (event.data.store) {
          try {
            localStorage.setItem('gym_data_store_v1', JSON.stringify(event.data.store));
          } catch {}
        }
        onUpdate(event.data.lastEvent || undefined, isRemote, event.data.store || undefined);
      }
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Storage event fallback for cross-tab sync
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'gym_live_sync_trigger') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        const isRemote = parsed.deviceId !== myDeviceId;
        if (isRemote || parsed.updatedAt > subscriberLastTimestamp) {
          if (parsed.updatedAt > subscriberLastTimestamp) {
            subscriberLastTimestamp = parsed.updatedAt;
          }
          onUpdate(parsed.lastEvent || undefined, isRemote, parsed.store || undefined);
        }
      } catch {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    unsubFirestore();
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
  };

  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {}
  }

  try {
    localStorage.setItem('gym_live_sync_trigger', JSON.stringify(payload));
  } catch {}

  if (storeToSync) {
    syncStoreToBackend(storeToSync, activeBiz);
  }

  const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
  if (isOffline) {
    try {
      localStorage.setItem('gym_pending_offline_sync', 'true');
    } catch {}
  }

  (async () => {
    try {
      const storeDocRef = getStoreDocRef(activeBiz);
      await withTimeout(setDoc(storeDocRef, payload, { merge: true }), 8000, null);

      try {
        const regDoc = doc(db, 'gym', 'registry');
        const regSnap = await withTimeout(getDoc(regDoc), 4000, null as any);
        const existingStores: string[] =
          regSnap && regSnap.exists && regSnap.exists() && Array.isArray(regSnap.data()?.stores)
            ? regSnap.data().stores
            : ['Binti Gym'];
        if (!existingStores.includes(activeBiz)) {
          existingStores.push(activeBiz);
          await withTimeout(setDoc(regDoc, { stores: existingStores }, { merge: true }), 4000, null);
        }
      } catch {}
    } catch (err) {
      console.warn('Firestore broadcastLiveSync notice:', err);
      try {
        localStorage.setItem('gym_pending_offline_sync', 'true');
      } catch {}
    }
  })();
}

