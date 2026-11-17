/**
 * Screen Wake Lock Controller & React Hook for Hands-Free Active Cooking Mode.
 * Keeps kitchen phone/tablet screen awake while cooking and automatically re-acquires
 * the sentinel when returning to a visible tab (`document.visibilitychange`).
 */
import { useCallback, useEffect, useState } from 'react';

export interface ScreenWakeLockState {
  supported: boolean;
  active: boolean;
}

interface WakeLockSentinelLike {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
  removeEventListener?: (type: 'release', listener: () => void) => void;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

function isWakeLockSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean((navigator as NavigatorWithWakeLock).wakeLock?.request)
  );
}

export class ScreenWakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private desired = false;
  private listeners = new Set<(state: ScreenWakeLockState) => void>();
  private visibilityBound = false;

  private readonly handleVisibilityChange = () => {
    if (
      this.desired &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      !this.isActive()
    ) {
      void this.acquire();
    }
  };

  private readonly handleSentinelRelease = () => {
    this.sentinel = null;
    this.emit();
  };

  isSupported(): boolean {
    return isWakeLockSupported();
  }

  isActive(): boolean {
    return Boolean(this.sentinel && !this.sentinel.released);
  }

  getStatus(): ScreenWakeLockState {
    return {
      supported: this.isSupported(),
      active: this.isActive(),
    };
  }

  subscribe(listener: (state: ScreenWakeLockState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private bindVisibilityListener() {
    if (this.visibilityBound || typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.visibilityBound = true;
  }

  private unbindVisibilityListener() {
    if (!this.visibilityBound || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.visibilityBound = false;
  }

  async acquire(): Promise<boolean> {
    this.desired = true;
    this.bindVisibilityListener();

    if (!this.isSupported()) {
      this.emit();
      return false;
    }

    if (this.isActive()) {
      this.emit();
      return true;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.emit();
      return false;
    }

    try {
      const sentinel = await (navigator as NavigatorWithWakeLock).wakeLock!.request('screen');
      if (!this.desired) {
        await sentinel.release().catch(() => {});
        return false;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener?.('release', this.handleSentinelRelease);
      this.emit();
      return true;
    } catch {
      this.sentinel = null;
      this.emit();
      return false;
    }
  }

  async release(): Promise<void> {
    this.desired = false;
    this.unbindVisibilityListener();
    const current = this.sentinel;
    this.sentinel = null;
    if (current) {
      current.removeEventListener?.('release', this.handleSentinelRelease);
      try {
        await current.release();
      } catch {
        // Ignore browser release race
      }
    }
    this.emit();
  }
}

export const screenWakeLock = new ScreenWakeLockController();

export function useScreenWakeLock(
  enabled = true,
): ScreenWakeLockState & {
  request: () => Promise<boolean>;
  release: () => Promise<void>;
} {
  const [status, setStatus] = useState<ScreenWakeLockState>(() => screenWakeLock.getStatus());

  useEffect(() => {
    const unsubscribe = screenWakeLock.subscribe(setStatus);
    setStatus(screenWakeLock.getStatus());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (enabled) {
      void screenWakeLock.acquire();
      return () => {
        void screenWakeLock.release();
      };
    }
    void screenWakeLock.release();
    return undefined;
  }, [enabled]);

  const request = useCallback(() => screenWakeLock.acquire(), []);
  const release = useCallback(() => screenWakeLock.release(), []);

  return {
    ...status,
    request,
    release,
  };
}
