/**
 * Servicio de monitoreo de conexión a internet
 * Detecta estado online/offline usando navigator.onLine + eventos del navegador
 */

type OnlineStatus = 'online' | 'offline' | 'checking';
type OnlineCallback = (status: OnlineStatus) => void;

export interface OnlineMonitor {
  getStatus: () => OnlineStatus;
  isOnline: () => boolean;
  addListener: (callback: OnlineCallback) => () => void;
  forceOffline: () => void;
  forceOnline: () => void;
}

// Estado interno
let currentStatus: OnlineStatus = 'online';
let listeners: Set<OnlineCallback> = new Set();
let isForcedOffline = false;

/**
 * Detecta el estado real de conexión
 */
function detectOnlineStatus(): OnlineStatus {
  if (isForcedOffline) return 'offline';
  if (typeof navigator !== 'undefined') {
    return navigator.onLine ? 'online' : 'offline';
  }
  return 'online';
}

/**
 * Notifica a todos los listeners del cambio de estado
 */
function notifyListeners(status: OnlineStatus) {
  listeners.forEach(callback => callback(status));
}

/**
 * Inicializa el monitoreo de conexión
 */
export function initOnlineMonitor(): OnlineMonitor {
  // Detectar estado inicial
  currentStatus = detectOnlineStatus();
  
  // Escuchar eventos del navegador
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      currentStatus = detectOnlineStatus();
      notifyListeners(currentStatus);
      console.log('[OnlineMonitor] Conectado a internet');
    });
    
    window.addEventListener('offline', () => {
      currentStatus = detectOnlineStatus();
      notifyListeners(currentStatus);
      console.log('[OnlineMonitor] Desconectado de internet');
    });
  }

  return {
    getStatus: () => currentStatus,
    isOnline: () => currentStatus === 'online',
    addListener: (callback: OnlineCallback) => {
      listeners.add(callback);
      // Notificar inmediatamente con el estado actual
      callback(currentStatus);
      // Retorna función para remover listener
      return () => listeners.delete(callback);
    },
    forceOffline: () => {
      isForcedOffline = true;
      currentStatus = 'offline';
      notifyListeners('offline');
      console.log('[OnlineMonitor] Forzado a modo offline');
    },
    forceOnline: () => {
      isForcedOffline = false;
      currentStatus = detectOnlineStatus();
      notifyListeners(currentStatus);
      console.log('[OnlineMonitor] Forzado a modo online');
    },
  };
}

// Exportar instancia singleton
export const onlineMonitor = initOnlineMonitor();

