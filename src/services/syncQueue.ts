/**
 * Servicio de Cola de Sincronización Offline
 * Almacena operaciones pendientes mientras no hay conexión para sincronizar luego con Supabase
 */

import { SaleNote, Product, CashShift, Expense, AccountReceivable, AuditLog, Client, Supplier, InventoryMovement } from '../types';
import { onlineMonitor } from './onlineMonitor';

export type SyncOperationType = 
  | 'sale' 
  | 'cancelSale' 
  | 'product' 
  | 'stockMovement' 
  | 'cashShift' 
  | 'expense' 
  | 'client' 
  | 'supplier' 
  | 'cxc' 
  | 'auditLog';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  timestamp: number;
  payload: any;
  attempts: number;
}

// Storage key
const STORAGE_KEY = 'pos_sync_queue_v1';

// Estado en memoria
let queue: SyncOperation[] = [];
let isProcessing = false;

/**
 * Cargar cola desde localStorage
 */
function loadQueue(): SyncOperation[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error cargando cola de sincronización:', e);
  }
  return [];
}

/**
 * Guardar cola en localStorage
 */
function saveQueue(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error guardando cola de sincronización:', e);
  }
}

/**
 * Añadir operación a la cola
 */
export function addToQueue(type: SyncOperationType, payload: any): void {
  const operation: SyncOperation = {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    payload,
    attempts: 0,
  };

  queue.push(operation);
  saveQueue();
  console.log(`[SyncQueue] Añadido a cola: ${type}`, payload);
  
  // Si hay conexión, intentar procesar inmediatamente
  if (onlineMonitor.isOnline()) {
    processQueue();
  }
}

/**
 * Procesar cola de sincronización
 */
export async function processQueue(): Promise<void> {
  if (isProcessing || !onlineMonitor.isOnline()) return;
  
  isProcessing = true;
  
  try {
    // Filtrar operaciones pendientes (menos de 3 intentos)
    const pending = queue.filter(op => op.attempts < 3);
    
    if (pending.length === 0) return;
    
    // Procesar operaciones
    for (const operation of pending) {
      const success = await executeOperation(operation);
      
      if (success) {
        // Eliminar de la cola si fue exitoso
        queue = queue.filter(op => op.id !== operation.id);
        saveQueue();
        console.log(`[SyncQueue] Éxito sincronizando: ${operation.type}`);
      } else {
        // Incrementar intentos si falló
        const idx = queue.findIndex(op => op.id === operation.id);
        if (idx !== -1) {
          queue[idx].attempts += 1;
        }
        console.warn(`[SyncQueue] Fallo sincronizando: ${operation.type} (intento ${operation.attempts + 1})`);
      }
    }
    
    // Guardar estado actualizado
    saveQueue();
  } catch (error) {
    console.error('Error procesando cola:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Ejecutar operación individual
 */
async function executeOperation(operation: SyncOperation): Promise<boolean> {
  const { type, payload } = operation;
  
  try {
    switch (type) {
      case 'sale': {
        const { syncSaleToSupabase } = await import('./supabaseService');
        return await syncSaleToSupabase(payload as SaleNote);
      }
      
      case 'cancelSale': {
        const { syncCancelSaleToSupabase } = await import('./supabaseService');
        return await syncCancelSaleToSupabase(
          payload.saleId,
          payload.reason,
          payload.cancelledByName,
          payload.itemsToRestock
        );
      }
      
      case 'product': {
        const { syncProductToSupabase } = await import('./supabaseService');
        return await syncProductToSupabase(payload as Product);
      }
      
      case 'stockMovement': {
        const { syncStockMovementToSupabase } = await import('./supabaseService');
        return await syncStockMovementToSupabase(payload as InventoryMovement);
      }
      
      case 'cashShift': {
        const { syncCashShiftToSupabase } = await import('./supabaseService');
        return await syncCashShiftToSupabase(payload as CashShift);
      }
      
      case 'expense': {
        const { syncExpenseToSupabase } = await import('./supabaseService');
        return await syncExpenseToSupabase(payload as Expense);
      }
      
      case 'client': {
        const { syncClientToSupabase } = await import('./supabaseService');
        return await syncClientToSupabase(payload as Client);
      }
      
      case 'supplier': {
        const { syncSupplierToSupabase } = await import('./supabaseService');
        return await syncSupplierToSupabase(payload as Supplier);
      }
      
      case 'cxc': {
        const { syncCxCToSupabase } = await import('./supabaseService');
        return await syncCxCToSupabase(payload as AccountReceivable);
      }
      
      case 'auditLog': {
        const { syncAuditLogToSupabase } = await import('./supabaseService');
        return await syncAuditLogToSupabase(payload as AuditLog);
      }
      
      default:
        return false;
    }
  } catch (error) {
    console.error(`Error ejecutando operación ${type}:`, error);
    return false;
  }
}

/**
 * Obtener cantidad de operaciones pendientes
 */
export function getQueueLength(): number {
  return queue.length;
}

/**
 * Limpiar cola completamente
 */
export function clearQueue(): void {
  queue = [];
  saveQueue();
}

/**
 * Inicializar monitoreo de conexión
 */
export function initSyncQueue(): void {
  // Cargar cola desde localStorage
  queue = loadQueue();
  
  // Procesar cuando se recupere la conexión
  onlineMonitor.addListener((status) => {
    if (status === 'online') {
      console.log('[SyncQueue] Conexión RESTABLECIDA. Iniciando sincronización pendiente...');
      processQueue();
    }
  });
  
  console.log(`[SyncQueue] Inicializado con ${queue.length} operaciones pendientes`);
}

