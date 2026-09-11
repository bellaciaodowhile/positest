import {
  User,
  Product,
  Client,
  Supplier,
  SaleNote,
  Expense,
  AccountReceivable,
  AccountPayable,
  CashShift,
  AuditLog,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_EXPENSES,
  INITIAL_CXC,
  INITIAL_CXP,
  INITIAL_CASH_SHIFT,
  INITIAL_SHIFT_HISTORY,
  INITIAL_AUDIT_LOGS,
} from '../data/mockData';

export interface DatasetState {
  products: Product[];
  clients: Client[];
  suppliers: Supplier[];
  sales: SaleNote[];
  expenses: Expense[];
  cxc: AccountReceivable[];
  cxp: AccountPayable[];
  activeShift: CashShift | null;
  shiftHistory: CashShift[];
  users: User[];
  auditLogs: AuditLog[];
}

const STORAGE_KEYS = {
  IS_DEMO: 'ventaflow_mode_is_demo',
  REAL_DATA: 'ventaflow_real_data_v2',
  DEMO_DATA: 'ventaflow_demo_data_v2',
  ACTIVE_USER_ID: 'ventaflow_active_user_id',
};

// Usuarios del Sistema Real (Sin datos falsos ni usuarios de muestra; solo Administrador)
export const REAL_SYSTEM_USERS: User[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    nombre: 'Administrador',
    email: 'admin@ventaflow.com',
    rol: 'admin',
    activo: true,
    ultimoAcceso: new Date().toISOString().replace('T', ' ').slice(0, 16),
  },
];

// Cliente base para ventas de mostrador / contado
export const REAL_DEFAULT_CLIENTS: Client[] = [
  {
    id: '11111111-1111-1111-1111-111111111100',
    documento: 'V-00000000',
    nombre: 'Consumidor Final (Contado)',
    telefono: '0000-0000000',
    direccion: 'Caracas, Venezuela',
    email: '',
    limiteCreditoUSD: 0,
    saldoPendienteUSD: 0,
  },
];

export const DEMO_USER: User = INITIAL_USERS[0]; // Usuario Demo (Presentación Clientes)

/**
 * Verifica si el modo activo guardado es Demo
 */
export function isDemoModeStored(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.IS_DEMO);
    return saved === 'true';
  } catch {
    return false;
  }
}

/**
 * Guarda el modo activo (Demo o Real)
 */
export function setStoredDemoMode(isDemo: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, isDemo ? 'true' : 'false');
  } catch {
    // Ignorar si localStorage no está disponible
  }
}

/**
 * Carga el dataset del Modo Real (100% limpio, sin datos falsos ni inventario simulado)
 */
export function loadRealDataset(): DatasetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REAL_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Filtrar cualquier producto que provenga del mockData previo
      const mockProductBarcodes = new Set([
        '759100100101', '759100100102', '759100100103', '759100100104',
        '759100100105', '759100100106', '759100100107', '759100100108',
      ]);
      const isMockProduct = (p: Product) =>
        p.id?.startsWith('prod-00') || mockProductBarcodes.has(p.codigoBarras);

      const realProducts = Array.isArray(parsed.products)
        ? parsed.products.filter((p: Product) => !isMockProduct(p))
        : [];

      const isMockSupplier = (s: Supplier) =>
        s.id?.startsWith('sup-00') || s.rif === 'J-00041363-4' || s.rif === 'J-00012226-5';

      const realSuppliers = Array.isArray(parsed.suppliers)
        ? parsed.suppliers.filter((s: Supplier) => !isMockSupplier(s))
        : [];

      // Filtrar usuarios falsos (cajero, inventario de demostración)
      const realUsers = Array.isArray(parsed.users)
        ? parsed.users.filter(
            (u: User) =>
              u.username === 'admin' ||
              (u.username !== 'demo' &&
                u.username !== 'cajero' &&
                u.username !== 'inventario' &&
                !u.email?.includes('@avila.com'))
          )
        : REAL_SYSTEM_USERS;

      return {
        products: realProducts,
        clients: Array.isArray(parsed.clients) && parsed.clients.length > 0
          ? parsed.clients
          : REAL_DEFAULT_CLIENTS,
        suppliers: realSuppliers,
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        cxc: Array.isArray(parsed.cxc) ? parsed.cxc : [],
        cxp: Array.isArray(parsed.cxp) ? parsed.cxp : [],
        activeShift: parsed.activeShift || null,
        shiftHistory: Array.isArray(parsed.shiftHistory) ? parsed.shiftHistory : [],
        users: realUsers.length > 0 ? realUsers : REAL_SYSTEM_USERS,
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      };
    }
  } catch (err) {
    console.warn('Error leyendo dataset real de localStorage:', err);
  }

  // Estado limpio por defecto para el Modo Real: sin productos falsos, sin ventas, solo el usuario admin
  return {
    products: [],
    clients: REAL_DEFAULT_CLIENTS,
    suppliers: [],
    sales: [],
    expenses: [],
    cxc: [],
    cxp: [],
    activeShift: null, // Caja cerrada inicialmente
    shiftHistory: [],
    users: REAL_SYSTEM_USERS, // Solo el usuario Administrador
    auditLogs: [],
  };
}

/**
 * Guarda el dataset del Modo Real en localStorage
 */
export function saveRealDataset(state: DatasetState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REAL_DATA, JSON.stringify(state));
  } catch (err) {
    console.warn('Error guardando dataset real en localStorage:', err);
  }
}

/**
 * Carga el dataset del Modo Demo (Con ejemplos precargados para exhibición a clientes)
 */
export function loadDemoDataset(): DatasetState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEMO_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        products: Array.isArray(parsed.products) ? parsed.products : INITIAL_PRODUCTS,
        clients: Array.isArray(parsed.clients) ? parsed.clients : INITIAL_CLIENTS,
        suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : INITIAL_SUPPLIERS,
        sales: Array.isArray(parsed.sales) ? parsed.sales : INITIAL_SALES,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : INITIAL_EXPENSES,
        cxc: Array.isArray(parsed.cxc) ? parsed.cxc : INITIAL_CXC,
        cxp: Array.isArray(parsed.cxp) ? parsed.cxp : INITIAL_CXP,
        activeShift: parsed.activeShift !== undefined ? parsed.activeShift : INITIAL_CASH_SHIFT,
        shiftHistory: Array.isArray(parsed.shiftHistory)
          ? parsed.shiftHistory
          : INITIAL_SHIFT_HISTORY,
        users: Array.isArray(parsed.users) ? parsed.users : INITIAL_USERS,
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : INITIAL_AUDIT_LOGS,
      };
    }
  } catch (err) {
    console.warn('Error leyendo dataset demo de localStorage:', err);
  }

  // Estado inicial de demostración
  return {
    products: INITIAL_PRODUCTS,
    clients: INITIAL_CLIENTS,
    suppliers: INITIAL_SUPPLIERS,
    sales: INITIAL_SALES,
    expenses: INITIAL_EXPENSES,
    cxc: INITIAL_CXC,
    cxp: INITIAL_CXP,
    activeShift: INITIAL_CASH_SHIFT,
    shiftHistory: INITIAL_SHIFT_HISTORY,
    users: INITIAL_USERS,
    auditLogs: INITIAL_AUDIT_LOGS,
  };
}

/**
 * Guarda el dataset del Modo Demo en localStorage
 */
export function saveDemoDataset(state: DatasetState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEMO_DATA, JSON.stringify(state));
  } catch (err) {
    console.warn('Error guardando dataset demo en localStorage:', err);
  }
}

/**
 * Reinicia el dataset demo a los valores originales de muestra
 */
export function resetDemoDataset(): DatasetState {
  const initialDemo: DatasetState = {
    products: INITIAL_PRODUCTS,
    clients: INITIAL_CLIENTS,
    suppliers: INITIAL_SUPPLIERS,
    sales: INITIAL_SALES,
    expenses: INITIAL_EXPENSES,
    cxc: INITIAL_CXC,
    cxp: INITIAL_CXP,
    activeShift: INITIAL_CASH_SHIFT,
    shiftHistory: INITIAL_SHIFT_HISTORY,
    users: INITIAL_USERS,
    auditLogs: INITIAL_AUDIT_LOGS,
  };
  saveDemoDataset(initialDemo);
  return initialDemo;
}
