/**
 * Inicialización del sistema de sincronización offline-first
 * Este archivo configura todos los servicios necesarios para el modo offline
 */

import { initSyncQueue } from './syncQueue';
import { onlineMonitor } from './onlineMonitor';

/**
 * Inicializa el sistema de sincronización offline
 */
export function initOfflineSyncSystem(): void {
  console.log('[OfflineSync] Inicializando sistema offline-first...');
  
  // 1. Inicializar cola de sincronización
  initSyncQueue();
  
  // 2. Inicializar monitor de conexión
  onlineMonitor.addListener((status) => {
    console.log(`[OfflineSync] Estado de conexión: ${status}`);
    
    if (status === 'online') {
      console.log('[OfflineSync] Conexión RESTABLECIDA. Procesando cola pendiente...');
    }
  });
  
  console.log('[OfflineSync] Sistema offline-first inicializado correctamente');
}

/**
 * Verifica si hay operaciones pendientes de sincronización
 */
export function hasPendingSyncOperations(): boolean {
  try {
    const saved = localStorage.getItem('pos_sync_queue_v1');
    if (saved) {
      const queue = JSON.parse(saved);
      return Array.isArray(queue) && queue.length > 0;
    }
  } catch {
    // Ignorar errores
  }
  return false;
}

/**
 * Obtiene la cantidad de operaciones pendientes
 */
export function getPendingSyncCount(): number {
  try {
    const saved = localStorage.getItem('pos_sync_queue_v1');
    if (saved) {
      const queue = JSON.parse(saved);
      return Array.isArray(queue) ? queue.length : 0;
    }
  } catch {
    // Ignorar errores
  }
  return 0;
}
