import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('binti_gym_live_sync_channel')
  : null;

let lastHandledTimestamp = 0;

export function subscribeLiveSync(
  onUpdate: (eventData?: SyncEventPayload, isRemote?: boolean) => void,
  onStatusChange?: (status: 'connected' | 'reconnecting' | 'offline') => void
) {
  let unsubFirestore = () => {};
  const myDeviceId = getDeviceId();

  // 1. Listen to Firestore real-time doc updates across devices
  try {
    const syncDocRef = doc(db, 'gym', 'sync');
    unsubFirestore = onSnapshot(
      syncDocRef,
      (snapshot) => {
        if (onStatusChange) onStatusChange('connected');
        if (snapshot.exists()) {
          const data = snapshot.data();
          const updatedAt = data.updatedAt || 0;
          if (updatedAt > lastHandledTimestamp) {
            lastHandledTimestamp = updatedAt;
            const isRemote = data.deviceId ? data.deviceId !== myDeviceId : true;
            onUpdate(data.lastEvent || undefined, isRemote);
          }
        }
      },
      (error) => {
        console.warn('Firestore live sync listener fallback:', error);
        if (onStatusChange) onStatusChange('reconnecting');
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
      onUpdate(event.data.lastEvent || undefined, isRemote);
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
            onUpdate(parsed.lastEvent || undefined, isRemote);
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
          onUpdate(parsed.lastEvent || undefined, isRemote);
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
    }
  };
}

export async function broadcastLiveSync(eventData?: SyncEventPayload) {
  const timestamp = Date.now();
  const myDeviceId = getDeviceId();

  const payload = {
    updatedAt: timestamp,
    deviceId: myDeviceId,
    lastEvent: eventData ? { ...eventData, deviceId: myDeviceId } : null,
  };

  // Broadcast to BroadcastChannel
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

  // Broadcast to Firestore
  try {
    const syncDocRef = doc(db, 'gym', 'sync');
    await setDoc(syncDocRef, payload, { merge: true });
  } catch (err) {
    console.warn('Firestore broadcastLiveSync error:', err);
  }
}

