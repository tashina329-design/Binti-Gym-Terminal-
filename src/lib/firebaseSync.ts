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

export async function fetchCloudStore(): Promise<GymDataStore | null> {
  try {
    const storeDocRef = doc(db, 'gym', 'store');
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
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'offline') => void
) {
  let unsubFirestore = () => {};
  const myDeviceId = getDeviceId();

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
        });
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
    const storeDocRef = doc(db, 'gym', 'store');
    unsubFirestore = onSnapshot(
      storeDocRef,
      (snapshot) => {
        const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
        if (onStatusChange) onStatusChange(isOnline ? 'connected' : 'offline');
        if (snapshot.exists()) {
          const data = snapshot.data();
          const updatedAt = data.updatedAt || 0;
          if (updatedAt > lastHandledTimestamp) {
            lastHandledTimestamp = updatedAt;
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
    if (event.data && event.data.updatedAt > lastHandledTimestamp) {
      lastHandledTimestamp = event.data.updatedAt;
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
          if (parsed.type === 'data_updated' && parsed.timestamp > lastHandledTimestamp) {
            lastHandledTimestamp = parsed.timestamp;
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
        if (parsed.updatedAt > lastHandledTimestamp) {
          lastHandledTimestamp = parsed.updatedAt;
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

export async function broadcastLiveSync(eventData?: SyncEventPayload, storeData?: GymDataStore) {
  const timestamp = Date.now();
  const myDeviceId = getDeviceId();

  // Load latest store if not provided
  let storeToSync = storeData;
  if (!storeToSync && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('gym_data_store_v1');
      if (saved) storeToSync = JSON.parse(saved);
    } catch {}
  }

  const payload = {
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
    const storeDocRef = doc(db, 'gym', 'store');
    await setDoc(storeDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Firestore broadcastLiveSync notice (cached locally if offline):', err);
    try {
      localStorage.setItem('gym_pending_offline_sync', 'true');
    } catch {}
  }
}
