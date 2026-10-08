export type Role = 'admin' | 'cajero' | 'inventario';
export type UserRole = Role;

export interface User {
  id: string;
  username: string;
  nombre: string;
  email?: string;
  rol: Role;
  activo: boolean;
  password?: string;
  fechaCreacion?: string;
  ultimoAcceso?: string;
}

export interface PermissionCheck {
  canCloseCash: boolean;
  canModifyPrices: boolean;
  canCancelSales: boolean;
  canViewFinancialReports: boolean;
  canAdjustInventory: boolean;
  canManageUsers: boolean;
  canCreateExpenses: boolean;
}

export type TaxClassification = 'gravable' | 'exento';

export interface Product {
  id: string;
  codigoBarras: string;
  nombre: string;
  categoria: string;
  clasificacion: TaxClassification; // 'gravable' (aplica IVA) o 'exento'
  costoUSD: number;
  margenGanancia: number; // Porcentaje ej. 30 (%)
  unidades: number; // Número de unidades por paquete
  precioUSD: number; // Calculado: Costo ÷ (1 - Margen/100) ÷ Unidades
  stockActual: number;
  stockMinimo: number;
  unidadMedida: string;
  descripcion?: string;
  fechaActualizacion: string;
}

export interface InventoryMovement {
  id: string;
  productoId: string;
  productoNombre: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  usuarioId: string;
  usuarioNombre: string;
  fecha: string;
}

export interface Client {
  id: string;
  documento: string; // V-12345678, J-12345678-0
  nombre: string;
  telefono: string;
  direccion: string;
  email?: string;
  limiteCreditoUSD?: number;
  saldoPendienteUSD?: number;
}

export interface Supplier {
  id: string;
  rif: string;
  nombre: string;
  contacto: string;
  telefono: string;
  direccion: string;
  saldoPendienteUSD?: number;
}

export type PaymentMethodType =
  | 'efectivo_usd'
  | 'efectivo_ves'
  | 'punto_venta'
  | 'pago_movil'
  | 'zelle'
  | 'transferencia';

export interface PaymentItem {
  metodo: PaymentMethodType;
  nombreMetodo: string;
  montoOriginal: number; // En la moneda que se pagó
  moneda: 'USD' | 'VES';
  montoUSD: number; // Equivalente en USD
  montoVES: number; // Equivalente en VES
  tasaBCV: number;
  aplicaIGTF: boolean; // 3% si es divisa / moneda extranjera
  montoIGTFUSD: number;
  montoIGTFVES: number;
  referencia?: string;
}

export interface SaleItem {
  productoId: string;
  codigoBarras: string;
  nombre: string;
  cantidad: number;
  precioUnitarioUSD: number;
  precioUnitarioVES: number;
  costoUnitarioUSD: number;
  clasificacion: TaxClassification;
  subtotalUSD: number;
  subtotalVES: number;
  ivaUSD: number;
  ivaVES: number;
  totalUSD: number;
  totalVES: number;
}

export interface SaleNote {
  id: string;
  numeroNota: string; // ej. NE-2026-0001
  clienteId: string;
  clienteNombre: string;
  clienteDocumento: string;
  cajeroId: string;
  cajeroNombre: string;
  turnoId: string;
  fecha: string;
  tasaBCV: number;
  tasaIVA: number; // ej. 0.16 (16%)
  items: SaleItem[];
  subtotalExentoUSD: number;
  subtotalGravableUSD: number;
  ivaUSD: number;
  igtfUSD: number; // 3% sobre pagos en divisas
  totalUSD: number;
  totalVES: number;
  costoTotalUSD: number;
  utilidadBrutaUSD: number;
  pagos: PaymentItem[];
  montoRecibidoUSD: number;
  montoRecibidoVES: number;
  vueltoUSD: number;
  vueltoVES: number;
  estado: 'completada' | 'anulada';
  tipoVenta?: 'contado' | 'credito_fijado_ves';
  saldoPendienteVES?: number;
  montoFijadoVES?: number;
  montoAbonadoVES?: number;
  montoAbonadoUSD?: number;
  saldoPendienteUSD?: number;
  montoAbonoInicialVES?: number;
  motivoAnulacion?: string;
  anuladaPor?: string;
  fechaAnulacion?: string;
}

export interface CashShift {
  id: string;
  cajeroId: string;
  cajeroNombre: string;
  fechaApertura: string;
  fechaCierre?: string;
  estado: 'abierta' | 'cerrada';
  fondoInicialUSD: number;
  fondoInicialVES: number;
  tasaBCV: number;
  // Totales esperados en sistema
  ventasEfectivoUSD: number;
  ventasEfectivoVES: number;
  ventasPuntoVentaVES: number;
  ventasPagoMovilVES: number;
  ventasZelleUSD: number;
  ventasTransferenciaVES: number;
  ventasIGTFUSD: number;
  totalVendidoUSD: number;
  totalVendidoVES: number;
  // Arqueo físico ingresado al cerrar
  arqueoFisicoUSD?: number;
  arqueoFisicoVES?: number;
  desgloseBilletesUSD?: Record<string, number>; // "100": 2, "50": 1, etc.
  desgloseBilletesVES?: Record<string, number>;
  diferenciaUSD?: number; // arqueo - esperado
  diferenciaVES?: number;
  observacionesCierre?: string;
}

export interface Expense {
  id: string;
  concepto: string;
  categoria: 'operativo' | 'administrativo' | 'mantenimiento' | 'servicios' | 'nomina' | 'otro';
  montoUSD: number;
  montoVES: number;
  tasaBCV: number;
  metodoPago: PaymentMethodType;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  comprobanteRef?: string;
  observaciones?: string;
}

export interface AccountReceivable {
  id: string;
  clienteId: string;
  clienteNombre: string;
  clienteDocumento: string;
  clienteTelefono?: string;
  notaVentaId: string;
  montoTotalUSD: number;
  montoAbonadoUSD: number;
  saldoPendienteUSD: number;
  // Soporte para deudas congeladas/fijadas en Bolívares (sin recálculo diario)
  montoTotalVES?: number;
  montoAbonadoVES?: number;
  saldoPendienteVES?: number;
  monedaFijada?: 'VES' | 'USD';
  fechaEmision: string;
  fechaVencimiento: string;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  abonos: {
    id: string;
    fecha: string;
    montoUSD: number;
    montoVES: number;
    metodo: PaymentMethodType;
    referencia?: string;
  }[];
}

export interface AccountPayable {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  proveedorRif: string;
  numeroFacturaProvedor: string;
  montoTotalUSD: number;
  montoAbonadoUSD: number;
  saldoPendienteUSD: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  abonos: {
    id: string;
    fecha: string;
    montoUSD: number;
    montoVES: number;
    metodo: PaymentMethodType;
    referencia?: string;
  }[];
}

export interface AuditLog {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  accion: string;
  modulo: 'seguridad' | 'inventario' | 'ventas' | 'caja' | 'finanzas';
  detalles: string;
  fecha: string;
  ip?: string;
}

export interface BCVRateInfo {
  rate: number;
  lastUpdated: string;
  source: string;
  autoSync: boolean;
}
