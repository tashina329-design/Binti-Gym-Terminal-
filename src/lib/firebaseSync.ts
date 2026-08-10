import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
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

let lastHandledTimestamp = 0;

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
  if (key === 'binti_gym') {
    return doc(db, 'gym', 'store');
  }
  return doc(db, 'gym_stores', key);
}

export async function fetchStoresFromCloud(): Promise<string[]> {
  try {
    const regDoc = doc(db, 'gym', 'registry');
    const snap = await getDoc(regDoc);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.stores)) {
        return data.stores.filter(Boolean);
      }
    }
  } catch {}
  return ['Binti Gym'];
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
    const snapshot = await getDoc(docRef);

    if (mode === 'login') {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const storedPin = String(data.pin || data.store?.staffPin || '1234').trim();
        if (storedPin !== cleanPin) {
          return {
            success: false,
            message: `Incorrect 4-digit PIN code for "${cleanName}". Access denied.`,
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
          } catch {}
        }
        return {
          success: true,
          businessName: data.name || cleanName,
          pin: cleanPin,
          store: data.store as GymDataStore,
        };
      } else {
        return {
          success: false,
          message: `Business "${cleanName}" not found. Please click "Register New Store" to create it.`,
        };
      }
    } else {
      if (snapshot.exists()) {
        return {
          success: false,
          message: `Business "${cleanName}" is already registered. Please select it and enter its 4-digit PIN code to log in.`,
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

      await setDoc(docRef, payload, { merge: true });

      try {
        const regDoc = doc(db, 'gym', 'registry');
        const regSnap = await getDoc(regDoc);
        const existingStores: string[] =
          regSnap.exists() && Array.isArray(regSnap.data()?.stores) ? regSnap.data().stores : ['Binti Gym'];
        if (!existingStores.includes(cleanName)) {
          existingStores.push(cleanName);
          await setDoc(regDoc, { stores: existingStores }, { merge: true });
        }
      } catch {}

      try {
        localStorage.setItem('gym_data_store_v1', JSON.stringify(storeToRegister));
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
      success: false,
      message: err.message || 'Could not verify business credentials on cloud database.',
    };
  }
}

export async function fetchCloudStore(businessName?: string): Promise<GymDataStore | null> {
  try {
    const storeDocRef = getStoreDocRef(businessName);
    const snapshot = await getDoc(storeDocRef);
    if (snapshot.exists()) {
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
  const activeBiz = businessName || getStoredBusinessName();

  const updateNetworkStatus = () => {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      if (onStatusChange) onStatusChange('offline');
    }
  };

  updateNetworkStatus();

  // Listen to window online/offline events
  const handleOnline = () => {
    if (onStatusChange) onStatusChange('connected');
    // Auto re-sync pending offline changes when coming back online
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
      (snapshot) => {
        const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
        if (onStatusChange) onStatusChange(isOnline ? 'connected' : 'offline');
        if (snapshot.exists()) {
          const data = snapshot.data();
          const updatedAt = data.updatedAt || 0;
          if (updatedAt > subscriberLastTimestamp) {
            subscriberLastTimestamp = updatedAt;
            const isRemote = data.deviceId ? data.deviceId !== myDeviceId : true;

            // Sync remote store into local storage if present
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
            }

            onUpdate(data.lastEvent || undefined, isRemote, data.store || undefined);
          }
        }
      },
      (error) => {
        console.warn('Firestore live sync listener reconnecting or offline:', error);
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
    if (event.data && event.data.updatedAt > subscriberLastTimestamp) {
      subscriberLastTimestamp = event.data.updatedAt;
      const isRemote = event.data.deviceId !== myDeviceId;
      if (event.data.store) {
        try {
          localStorage.setItem('gym_data_store_v1', JSON.stringify(event.data.store));
        } catch {}
      }
      onUpdate(event.data.lastEvent || undefined, isRemote, event.data.store || undefined);
    }
  };

  if (syncChannel) {
    syncChannel.addEventListener('message', handleBroadcast);
  }

  // 3. Listen to SSE Server-Sent Events if connected to Express backend
  let eventSource: EventSource | null = null;
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === 'data_updated' && parsed.timestamp > subscriberLastTimestamp) {
            subscriberLastTimestamp = parsed.timestamp;
            const isRemote = parsed.deviceId ? parsed.deviceId !== myDeviceId : true;
            onUpdate(parsed.lastEvent || undefined, isRemote, parsed.store || undefined);
          }
        } catch {}
      };
      eventSource.onerror = () => {
        // SSE fallback
      };
    } catch {}
  }

  // 4. Storage event fallback
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'gym_live_sync_trigger') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        if (parsed.updatedAt > subscriberLastTimestamp) {
          subscriberLastTimestamp = parsed.updatedAt;
          const isRemote = parsed.deviceId !== myDeviceId;
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
    if (eventSource) {
      eventSource.close();
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
  const activeBiz = businessName || getStoredBusinessName();
  const activePin = getStoredBusinessPin();

  // Load latest store if not provided
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

  // Broadcast to BroadcastChannel (local tabs)
  if (syncChannel) {
    try {
      syncChannel.postMessage(payload);
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // LocalStorage sync trigger
  try {
    localStorage.setItem('gym_live_sync_trigger', JSON.stringify(payload));
  } catch {}

  // Check if offline
  const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;
  if (isOffline) {
    try {
      localStorage.setItem('gym_pending_offline_sync', 'true');
    } catch {}
  }

  // Broadcast to Firestore for real-time multi-device cloud synchronization
  try {
    const storeDocRef = getStoreDocRef(activeBiz);
    await setDoc(storeDocRef, payload, { merge: true });

    // Keep cloud registry doc updated
    try {
      const regDoc = doc(db, 'gym', 'registry');
      const regSnap = await getDoc(regDoc);
      const existingStores: string[] =
        regSnap.exists() && Array.isArray(regSnap.data()?.stores) ? regSnap.data().stores : ['Binti Gym'];
      if (!existingStores.includes(activeBiz)) {
        existingStores.push(activeBiz);
        await setDoc(regDoc, { stores: existingStores }, { merge: true });
      }
    } catch {}
  } catch (err) {
    console.warn('Firestore broadcastLiveSync notice (cached locally if offline):', err);
    try {
      localStorage.setItem('gym_pending_offline_sync', 'true');
    } catch {}
  }
}
