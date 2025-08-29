import { useState, useEffect } from 'react';
import { PlasmaContainer } from './PlasmaContainerList';

export interface UserActivity {
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  containerId?: string;
  metadata?: any;
}

interface RealtimeSyncProps {
  containers: PlasmaContainer[];
  onContainersChange: (containers: PlasmaContainer[]) => void;
  onUserActivity: (activities: UserActivity[]) => void;
  onContainerLocked: (containerId: string, userId: string, userName: string) => void;
  onContainerUnlocked: (containerId: string) => void;
}

interface RealtimeSyncReturn {
  userId: string;
  userName: string;
  broadcastContainerUpdate: (containers: PlasmaContainer[]) => void;
  broadcastSampleUpdate: (containerId: string, samples: any) => void;
  broadcastUserActivity: (activity: UserActivity) => void;
  lockContainer: (containerId: string) => Promise<void>;
  unlockContainer: (containerId: string) => Promise<void>;
  isContainerLocked: (containerId: string) => boolean;
}

// StackBlitz-compatible real-time sync using browser events and localStorage
export function useRealtimeSync({
  containers,
  onContainersChange,
  onUserActivity,
  onContainerLocked,
  onContainerUnlocked,
}: RealtimeSyncProps): RealtimeSyncReturn {
  const [userId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
  const [userName] = useState(() => `Demo User ${Math.floor(Math.random() * 100)}`);
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [lockedContainers, setLockedContainers] = useState<Set<string>>(new Set());

  // Listen for container updates from other instances
  useEffect(() => {
    const handleContainerUpdate = (event: CustomEvent) => {
      const { containers: updatedContainers, userId: senderId } = event.detail;
      if (senderId !== userId) {
        onContainersChange(updatedContainers);
      }
    };

    const handleSampleUpdate = (event: CustomEvent) => {
      const { containerId, samples, userId: senderId } = event.detail;
      if (senderId !== userId) {
        // Trigger container refresh if needed
        console.log('Sample update received for container:', containerId);
      }
    };

    const handleUserActivity = (event: CustomEvent) => {
      const activity = event.detail;
      if (activity.userId !== userId) {
        setUserActivities(prev => {
          const filtered = prev.filter(a => a.userId !== activity.userId);
          return [activity, ...filtered].slice(0, 50); // Keep last 50 activities
        });
      }
    };

    const handleContainerLock = (event: CustomEvent) => {
      const { containerId, userId: lockUserId, userName: lockUserName } = event.detail;
      if (lockUserId !== userId) {
        setLockedContainers(prev => new Set([...prev, containerId]));
        onContainerLocked(containerId, lockUserId, lockUserName);
      }
    };

    const handleContainerUnlock = (event: CustomEvent) => {
      const { containerId, userId: unlockUserId } = event.detail;
      if (unlockUserId !== userId) {
        setLockedContainers(prev => {
          const newSet = new Set(prev);
          newSet.delete(containerId);
          return newSet;
        });
        onContainerUnlocked(containerId);
      }
    };

    window.addEventListener('saga-container-update', handleContainerUpdate as EventListener);
    window.addEventListener('saga-sample-update', handleSampleUpdate as EventListener);
    window.addEventListener('saga-user-activity', handleUserActivity as EventListener);
    window.addEventListener('saga-container-lock', handleContainerLock as EventListener);
    window.addEventListener('saga-container-unlock', handleContainerUnlock as EventListener);

    return () => {
      window.removeEventListener('saga-container-update', handleContainerUpdate as EventListener);
      window.removeEventListener('saga-sample-update', handleSampleUpdate as EventListener);
      window.removeEventListener('saga-user-activity', handleUserActivity as EventListener);
      window.removeEventListener('saga-container-lock', handleContainerLock as EventListener);
      window.removeEventListener('saga-container-unlock', handleContainerUnlock as EventListener);
    };
  }, [userId, onContainersChange, onContainerLocked, onContainerUnlocked]);

  // Update user activities for parent component
  useEffect(() => {
    onUserActivity(userActivities);
  }, [userActivities, onUserActivity]);

  // Periodic activity heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      const activity: UserActivity = {
        userId,
        userName,
        action: 'heartbeat',
        timestamp: new Date().toISOString(),
      };
      broadcastUserActivity(activity);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [userId, userName]);

  const broadcastContainerUpdate = (containers: PlasmaContainer[]) => {
    const event = new CustomEvent('saga-container-update', {
      detail: { containers, userId, userName }
    });
    window.dispatchEvent(event);
  };

  const broadcastSampleUpdate = (containerId: string, samples: any) => {
    const event = new CustomEvent('saga-sample-update', {
      detail: { containerId, samples, userId, userName }
    });
    window.dispatchEvent(event);

    // Also broadcast as user activity
    const activity: UserActivity = {
      userId,
      userName,
      action: 'sample_update',
      timestamp: new Date().toISOString(),
      containerId,
      metadata: { sampleCount: Object.keys(samples || {}).length }
    };
    broadcastUserActivity(activity);
  };

  const broadcastUserActivity = (activity: UserActivity) => {
    const event = new CustomEvent('saga-user-activity', {
      detail: activity
    });
    window.dispatchEvent(event);

    // Update local activities
    setUserActivities(prev => {
      const filtered = prev.filter(a => a.userId !== activity.userId);
      return [activity, ...filtered].slice(0, 50);
    });
  };

  const lockContainer = async (containerId: string) => {
    setLockedContainers(prev => new Set([...prev, containerId]));
    onContainerLocked(containerId, userId, userName);
    
    const event = new CustomEvent('saga-container-lock', {
      detail: { containerId, userId, userName }
    });
    window.dispatchEvent(event);
  };

  const unlockContainer = async (containerId: string) => {
    setLockedContainers(prev => {
      const newSet = new Set(prev);
      newSet.delete(containerId);
      return newSet;
    });
    onContainerUnlocked(containerId);
    
    const event = new CustomEvent('saga-container-unlock', {
      detail: { containerId, userId }
    });
    window.dispatchEvent(event);
  };

  const isContainerLocked = (containerId: string) => {
    return lockedContainers.has(containerId);
  };

  return {
    userId,
    userName,
    broadcastContainerUpdate,
    broadcastSampleUpdate,
    broadcastUserActivity,
    lockContainer,
    unlockContainer,
    isContainerLocked,
  };
}