import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Coins,
  DollarSign,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Ban,
  Clock,
  Eye,
  CreditCard,
  Smartphone,
  ArrowRight,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  ArrowRightLeft,
  Building,
  ChevronRight,
  X,
  Layers,
  TrendingUp,
  LayoutGrid,
  Table,
  HelpCircle,
  Package,
} from 'lucide-react';
import { CashShift, SaleNote, User, PaymentMethodType, AccountReceivable, Product } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';
import {
  exportCashShiftToExcel,
  generateSaleNotePDF,
  exportCashControlReportToExcel,
  exportShiftHistoryToExcel,
} from '../services/exportService';
import {
  ActionHelpModal,
  InfoHelpButton,
  HelpTopicKey,
} from './ActionHelpModal';
import { BalanceMethodInfoModal } from './BalanceMethodInfoModal';
import { CashDebtCollectionModal } from './CashDebtCollectionModal';
import { CashDebtTab } from './CashDebtTab';
import { generateUUID } from '../services/uuidUtils';

interface CashControlModuleProps {
  activeShift: CashShift | null;
  shiftHistory: CashShift[];
  sales: SaleNote[];
  currentUser: User;
  bcvRate: number;
  cxc?: AccountReceivable[];
  products?: Product[];
  onOpenShift: (shift: CashShift) => void;
  onCloseShift: (closedShift: CashShift) => void;
  onCancelSale: (saleId: string, reason: string) => void;
  onAddAbonoCxC?: (
    cxcId: string,
    amountUSD: number,
    method: PaymentMethodType,
    ref?: string,
    amountVES?: number
  ) => void;
}

export const CashControlModule: React.FC<CashControlModuleProps> = ({
  activeShift,
  shiftHistory,
  sales,
  currentUser,
  bcvRate,
  cxc = [],
  products = [],
  onOpenShift,
  onCloseShift,
  onCancelSale,
  onAddAbonoCxC,
}) => {
  // Pestaña principal de visualización dentro de Caja
  const [activeTab, setActiveTab] = useState<'resumen_caja' | 'deudas_cxc' | 'historial_turnos'>('resumen_caja');

  // Modal de Cobro de Saldo Restante / Abono de Deuda en Caja
  const [selectedCxCToPay, setSelectedCxCToPay] = useState<AccountReceivable | null>(null);

  // Modal de Apertura de Caja
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [fondoInicialUSD, setFondoInicialUSD] = useState(50);
  const [fondoInicialVES, setFondoInicialVES] = useState(2000);

  // Modal de Cierre de Caja / Arqueo
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [arqueoUSD, setArqueoUSD] = useState<number>(0);
  const [arqueoVES, setArqueoVES] = useState<number>(0);
  const [observacionesCierre, setObservacionesCierre] = useState('');

  // Helper para buscar o generar la cuenta por cobrar asociada a una venta con deuda
  const getCxCForSale = (sale: SaleNote): AccountReceivable => {
    const existing = cxc.find(
      (c) =>
        c.notaVentaId === sale.id ||
        c.notaVentaId === sale.numeroNota ||
        (c.clienteDocumento === sale.clienteDocumento && sale.tipoVenta === 'credito_fijado_ves')
    );
    if (existing) return existing;

    const isFixedVES = sale.tipoVenta === 'credito_fijado_ves';
    const pendienteVES = sale.saldoPendienteVES ?? 0;
    const pendienteUSD = sale.saldoPendienteUSD ?? (pendienteVES / (bcvRate || 1));
    const abonadoVES = sale.montoAbonadoVES ?? 0;
    const abonadoUSD = sale.montoAbonadoUSD ?? (abonadoVES / (bcvRate || 1));
    const totalVES = sale.totalVES || usdToVes(sale.totalUSD, bcvRate);

    return {
      id: 'cxc-' + (sale.id || sale.numeroNota),
      clienteId: sale.clienteId,
      clienteNombre: sale.clienteNombre,
      clienteDocumento: sale.clienteDocumento,
      notaVentaId: sale.numeroNota || sale.id,
      montoTotalUSD: sale.totalUSD,
      montoAbonadoUSD: abonadoUSD,
      saldoPendienteUSD: pendienteUSD,
      montoTotalVES: totalVES,
      montoAbonadoVES: abonadoVES,
      saldoPendienteVES: pendienteVES,
      monedaFijada: isFixedVES ? 'VES' : 'USD',
      fechaEmision: sale.fecha ? sale.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10),
      fechaVencimiento: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      estado: (pendienteVES <= 0.05 && pendienteUSD <= 0.01) ? 'pagada' : abonadoVES > 0 ? 'parcial' : 'pendiente',
      abonos: [],
    };
  };

  const handleOpenPayForSale = (sale: SaleNote) => {
    const targetCxC = getCxCForSale(sale);
    setSelectedCxCToPay(targetCxC);
  };

  // Cálculo de conteo de clientes con deuda pendiente
  const pendingCxCCount = useMemo(() => {
    return cxc.filter((c) => {
      const isFixedVES = c.monedaFijada === 'VES';
      const debtVES = c.saldoPendienteVES !== undefined && c.saldoPendienteVES > 0
        ? c.saldoPendienteVES
        : usdToVes(c.saldoPendienteUSD, bcvRate);
      const debtUSD = isFixedVES ? debtVES / bcvRate : c.saldoPendienteUSD;
      const hasDebt = isFixedVES ? debtVES > 0.05 : debtUSD > 0.01;
      return hasDebt && c.estado !== 'pagada';
    }).length;
  }, [cxc, bcvRate]);

  const totalCxCPendingVES = useMemo(() => {
    return cxc.reduce((acc, c) => {
      const isFixedVES = c.monedaFijada === 'VES';
      const debtVES = c.saldoPendienteVES !== undefined && c.saldoPendienteVES > 0
        ? c.saldoPendienteVES
        : usdToVes(c.saldoPendienteUSD, bcvRate);
      const debtUSD = isFixedVES ? debtVES / bcvRate : c.saldoPendienteUSD;
      const hasDebt = isFixedVES ? debtVES > 0.05 : debtUSD > 0.01;
      return hasDebt && c.estado !== 'pagada' ? acc + debtVES : acc;
    }, 0);
  }, [cxc, bcvRate]);

  // Modal de Anulación de Nota
  const [saleToCancel, setSaleToCancel] = useState<SaleNote | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Modal de Detalle de Nota
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleNote | null>(null);

  // Modal Flotante de Información y Guía Paso a Paso
  const [helpTopic, setHelpTopic] = useState<HelpTopicKey | null>(null);

  // --- FILTROS DE FECHA Y CAJA ---
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFilterMode, setDateFilterMode] = useState<
    'hoy' | 'ayer' | '7dias' | 'mes' | 'mes_anterior' | 'ano' | 'todos' | 'personalizado'
  >('hoy');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filtro por Caja / Turno: 'todos' | 'activa' | ID de un turno específico
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('todos');

  // Filtro por método de pago: 'todos' o uno específico
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState<string>('todos');

  // Buscador de texto en ventas
  const [salesSearchTerm, setSalesSearchTerm] = useState('');

  // Modos de visualización para Totales por Método y Notas de Caja: 'ambos' | 'cards' | 'tabla'
  const [methodViewMode, setMethodViewMode] = useState<'ambos' | 'cards' | 'tabla'>('ambos');
  const [salesViewMode, setSalesViewMode] = useState<'tabla' | 'cards' | 'ambos'>('tabla');

  // Modal explicativo de la Tabla de Balance Consolidado por Método de Pago
  const [showBalanceMethodInfoModal, setShowBalanceMethodInfoModal] = useState(false);

  const canCancelSales = currentUser.rol === 'admin';
  const canCloseRegister = currentUser.rol === 'admin' || currentUser.rol === 'cajero';

  // Manejar selector rápido de fechas
  const handleSelectDateFilter = (
    mode: 'hoy' | 'ayer' | '7dias' | 'mes' | 'mes_anterior' | 'ano' | 'todos'
  ) => {
    setDateFilterMode(mode);
    const now = new Date();

    if (mode === 'hoy') {
      const dStr = now.toISOString().slice(0, 10);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (mode === 'ayer') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const dStr = yesterday.toISOString().slice(0, 10);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (mode === '7dias') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (mode === 'mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (mode === 'mes_anterior') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstDayPrev.toISOString().slice(0, 10));
      setEndDate(lastDayPrev.toISOString().slice(0, 10));
    } else if (mode === 'ano') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      setStartDate(firstDayYear.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (mode === 'todos') {
      setStartDate('2020-01-01');
      setEndDate('2030-12-31');
    }
  };

  // Apertura de turno
  const handleConfirmOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const newShift: CashShift = {
      id: generateUUID(),
      cajeroId: currentUser.id,
      cajeroNombre: currentUser.nombre,
      fechaApertura: new Date().toISOString(),
      estado: 'abierta',
      fondoInicialUSD,
      fondoInicialVES,
      tasaBCV: bcvRate,
      ventasEfectivoUSD: 0,
      ventasEfectivoVES: 0,
      ventasPuntoVentaVES: 0,
      ventasPagoMovilVES: 0,
      ventasZelleUSD: 0,
      ventasTransferenciaVES: 0,
      ventasIGTFUSD: 0,
      totalVendidoUSD: 0,
      totalVendidoVES: 0,
    };
    onOpenShift(newShift);
    setShowOpenModal(false);
  };

  // Abrir modal de arqueo de caja con valores sugeridos
  const handleOpenArqueo = () => {
    if (!activeShift) return;
    const expectedCashUSD = activeShift.fondoInicialUSD + activeShift.ventasEfectivoUSD;
    const expectedCashVES = activeShift.fondoInicialVES + activeShift.ventasEfectivoVES;
    setArqueoUSD(expectedCashUSD);
    setArqueoVES(expectedCashVES);
    setObservacionesCierre('');
    setShowCloseModal(true);
  };

  // Manejar cierre de caja
  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const expectedCashUSD = activeShift.fondoInicialUSD + activeShift.ventasEfectivoUSD;
    const expectedCashVES = activeShift.fondoInicialVES + activeShift.ventasEfectivoVES;

    const diferenciaUSD = Number((arqueoUSD - expectedCashUSD).toFixed(2));
    const diferenciaVES = Number((arqueoVES - expectedCashVES).toFixed(2));

    const closed: CashShift = {
      ...activeShift,
      estado: 'cerrada',
      fechaCierre: new Date().toISOString(),
      arqueoFisicoUSD: arqueoUSD,
      arqueoFisicoVES: arqueoVES,
      diferenciaUSD,
      diferenciaVES,
      observacionesCierre,
    };

    onCloseShift(closed);
    setShowCloseModal(false);
  };

  const handleConfirmCancelSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToCancel || !cancelReason.trim()) return;
    onCancelSale(saleToCancel.id, cancelReason.trim());
    setSaleToCancel(null);
    setCancelReason('');
  };

  // Filtrado de Notas de Venta con Fecha, Caja y Método
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 1. Filtro de Fechas
      if (dateFilterMode !== 'todos') {
        const saleDateStr = sale.fecha.slice(0, 10);
        if (saleDateStr < startDate || saleDateStr > endDate) {
          return false;
        }
      }

      // 2. Filtro de Caja / Turno
      if (selectedShiftFilter === 'activa') {
        if (!activeShift || sale.turnoId !== activeShift.id) return false;
      } else if (selectedShiftFilter !== 'todos') {
        if (sale.turnoId !== selectedShiftFilter) return false;
      }

      // 3. Filtro por Método de Pago
      if (selectedPaymentMethodFilter !== 'todos') {
        const hasMethod = sale.pagos.some((p) => p.metodo === selectedPaymentMethodFilter);
        if (!hasMethod) return false;
      }

      // 4. Búsqueda por texto
      if (salesSearchTerm.trim()) {
        const term = salesSearchTerm.toLowerCase();
        const matchNota = sale.numeroNota.toLowerCase().includes(term);
        const matchCliente =
          sale.clienteNombre.toLowerCase().includes(term) ||
          sale.clienteDocumento.toLowerCase().includes(term);
        const matchCajero = sale.cajeroNombre.toLowerCase().includes(term);
        if (!matchNota && !matchCliente && !matchCajero) return false;
      }

      return true;
    });
  }, [
    sales,
    dateFilterMode,
    startDate,
    endDate,
    selectedShiftFilter,
    selectedPaymentMethodFilter,
    salesSearchTerm,
    activeShift,
  ]);

  // Cálculo de Totales por Caja y Métodos de Pago
  const totalsByPaymentMethod = useMemo(() => {
    const validSales = filteredSales.filter((s) => s.estado !== 'anulada');

    let totalUSD = 0;
    let totalVES = 0;
    let efectivoUSD = 0;
    let efectivoVES = 0;
    let pagoMovilVES = 0;
    let transferenciaVES = 0;
    let puntoVentaVES = 0;
    let zelleUSD = 0;
    let otrosUSD = 0;

    let countEfectivoUSD = 0;
    let countEfectivoVES = 0;
    let countPagoMovil = 0;
    let countTransferencia = 0;
    let countPuntoVenta = 0;
    let countZelle = 0;

    validSales.forEach((sale) => {
      totalUSD += sale.totalUSD;
      totalVES += sale.totalVES;

      sale.pagos.forEach((p) => {
        if (p.metodo === 'efectivo_usd') {
          efectivoUSD += p.montoUSD || p.montoOriginal;
          countEfectivoUSD++;
        } else if (p.metodo === 'efectivo_ves') {
          efectivoVES += p.montoVES || p.montoOriginal;
          countEfectivoVES++;
        } else if (p.metodo === 'pago_movil') {
          pagoMovilVES += p.montoVES || p.montoOriginal;
          countPagoMovil++;
        } else if (p.metodo === 'transferencia') {
          transferenciaVES += p.montoVES || p.montoOriginal;
          countTransferencia++;
        } else if (p.metodo === 'punto_venta') {
          puntoVentaVES += p.montoVES || p.montoOriginal;
          countPuntoVenta++;
        } else if (p.metodo === 'zelle') {
          zelleUSD += p.montoUSD || p.montoOriginal;
          countZelle++;
        } else {
          otrosUSD += p.montoUSD || 0;
        }
      });
    });

    return {
      totalUSD: Number(totalUSD.toFixed(2)),
      totalVES: Number(totalVES.toFixed(2)),
      efectivoUSD: Number(efectivoUSD.toFixed(2)),
      efectivoVES: Number(efectivoVES.toFixed(2)),
      pagoMovilVES: Number(pagoMovilVES.toFixed(2)),
      transferenciaVES: Number(transferenciaVES.toFixed(2)),
      puntoVentaVES: Number(puntoVentaVES.toFixed(2)),
      zelleUSD: Number(zelleUSD.toFixed(2)),
      otrosUSD: Number(otrosUSD.toFixed(2)),
      countEfectivoUSD,
      countEfectivoVES,
      countPagoMovil,
      countTransferencia,
      countPuntoVenta,
      countZelle,
      countNotas: validSales.length,
    };
  }, [filteredSales]);

  // Total acumulado de operaciones individuales de pago
  const totalOperaciones = useMemo(() => {
    return (
      totalsByPaymentMethod.countEfectivoUSD +
      totalsByPaymentMethod.countEfectivoVES +
      totalsByPaymentMethod.countPagoMovil +
      totalsByPaymentMethod.countTransferencia +
      totalsByPaymentMethod.countPuntoVenta +
      totalsByPaymentMethod.countZelle
    );
  }, [totalsByPaymentMethod]);

  // Desglose analítico para la Tabla de Totales por Método
  const paymentMethodsBreakdown = useMemo(() => {
    const totalUSD = totalsByPaymentMethod.totalUSD > 0 ? totalsByPaymentMethod.totalUSD : 1;

    return [
      {
        id: 'efectivo_usd',
        nombre: 'Efectivo Divisas (USD / REF)',
        desc: 'Billetes en moneda extranjera recibidos en caja física',
        icon: DollarSign,
        colorBg: 'bg-emerald-50',
        colorText: 'text-emerald-800',
        colorBorder: 'border-emerald-200',
        iconBg: 'bg-emerald-600',
        montoUSD: totalsByPaymentMethod.efectivoUSD,
        montoVES: totalsByPaymentMethod.efectivoUSD * bcvRate,
        operaciones: totalsByPaymentMethod.countEfectivoUSD,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? (totalsByPaymentMethod.efectivoUSD / totalUSD) * 100
          : 0,
        custodia: 'Caja Física / Gaveta de Divisas',
      },
      {
        id: 'efectivo_ves',
        nombre: 'Efectivo Bolívares (VES)',
        desc: 'Moneda de curso legal en efectivo en caja física',
        icon: Coins,
        colorBg: 'bg-blue-50',
        colorText: 'text-blue-800',
        colorBorder: 'border-blue-200',
        iconBg: 'bg-blue-600',
        montoUSD: totalsByPaymentMethod.efectivoVES / (bcvRate || 1),
        montoVES: totalsByPaymentMethod.efectivoVES,
        operaciones: totalsByPaymentMethod.countEfectivoVES,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? ((totalsByPaymentMethod.efectivoVES / (bcvRate || 1)) / totalUSD) * 100
          : 0,
        custodia: 'Caja Física / Moneda Nacional',
      },
      {
        id: 'pago_movil',
        nombre: 'Pago Móvil (VES)',
        desc: 'Liquidación bancaria inmediata interbancaria',
        icon: Smartphone,
        colorBg: 'bg-amber-50',
        colorText: 'text-amber-800',
        colorBorder: 'border-amber-200',
        iconBg: 'bg-amber-600',
        montoUSD: totalsByPaymentMethod.pagoMovilVES / (bcvRate || 1),
        montoVES: totalsByPaymentMethod.pagoMovilVES,
        operaciones: totalsByPaymentMethod.countPagoMovil,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? ((totalsByPaymentMethod.pagoMovilVES / (bcvRate || 1)) / totalUSD) * 100
          : 0,
        custodia: 'Banca Digital / Cuenta Receptora',
      },
      {
        id: 'transferencia',
        nombre: 'Transferencia Bancaria (VES)',
        desc: 'Depósitos y transferencias en cuentas bancarias',
        icon: ArrowRightLeft,
        colorBg: 'bg-cyan-50',
        colorText: 'text-cyan-800',
        colorBorder: 'border-cyan-200',
        iconBg: 'bg-cyan-600',
        montoUSD: totalsByPaymentMethod.transferenciaVES / (bcvRate || 1),
        montoVES: totalsByPaymentMethod.transferenciaVES,
        operaciones: totalsByPaymentMethod.countTransferencia,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? ((totalsByPaymentMethod.transferenciaVES / (bcvRate || 1)) / totalUSD) * 100
          : 0,
        custodia: 'Cuentas Bancarias / Conciliación',
      },
      {
        id: 'punto_venta',
        nombre: 'Punto de Venta / Débito (VES)',
        desc: 'Tarjetas de débito procesadas en terminales POS',
        icon: CreditCard,
        colorBg: 'bg-purple-50',
        colorText: 'text-purple-800',
        colorBorder: 'border-purple-200',
        iconBg: 'bg-purple-600',
        montoUSD: totalsByPaymentMethod.puntoVentaVES / (bcvRate || 1),
        montoVES: totalsByPaymentMethod.puntoVentaVES,
        operaciones: totalsByPaymentMethod.countPuntoVenta,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? ((totalsByPaymentMethod.puntoVentaVES / (bcvRate || 1)) / totalUSD) * 100
          : 0,
        custodia: 'Liquidación Bancaria Terminal POS',
      },
      {
        id: 'zelle',
        nombre: 'Zelle (USD)',
        desc: 'Transferencias internacionales directas en USD',
        icon: Building,
        colorBg: 'bg-indigo-50',
        colorText: 'text-indigo-800',
        colorBorder: 'border-indigo-200',
        iconBg: 'bg-indigo-600',
        montoUSD: totalsByPaymentMethod.zelleUSD,
        montoVES: totalsByPaymentMethod.zelleUSD * bcvRate,
        operaciones: totalsByPaymentMethod.countZelle,
        porcentaje: totalsByPaymentMethod.totalUSD > 0
          ? (totalsByPaymentMethod.zelleUSD / totalUSD) * 100
          : 0,
        custodia: 'Cuenta Internacional / Zelle',
      },
    ];
  }, [totalsByPaymentMethod, bcvRate]);

  // Filtrar el historial de turnos por rango de fecha
  const filteredShiftHistory = useMemo(() => {
    return shiftHistory.filter((shift) => {
      const shiftDate = shift.fechaApertura.slice(0, 10);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }, [shiftHistory, startDate, endDate]);

  // Totales acumulados de los turnos filtrados
  const filteredShiftTotals = useMemo(() => {
    let totalUSD = 0;
    let totalVES = 0;
    filteredShiftHistory.forEach((s) => {
      totalUSD += s.totalVendidoUSD || 0;
      totalVES += s.totalVendidoVES || 0;
    });
    return {
      totalUSD: Number(totalUSD.toFixed(2)),
      totalVES: Number(totalVES.toFixed(2)),
    };
  }, [filteredShiftHistory]);

  // Exportar el reporte de caja con el filtro actual
  const handleExportFilteredReport = () => {
    let dateLabel = '';
    if (dateFilterMode === 'hoy') dateLabel = `Hoy (${todayStr})`;
    else if (dateFilterMode === 'ayer') dateLabel = 'Ayer';
    else if (dateFilterMode === '7dias') dateLabel = 'Últimos 7 días';
    else if (dateFilterMode === 'mes') dateLabel = 'Este Mes';
    else if (dateFilterMode === 'mes_anterior') dateLabel = 'Mes Anterior';
    else if (dateFilterMode === 'ano') dateLabel = 'Este Año';
    else if (dateFilterMode === 'todos') dateLabel = 'Todo el Historial';
    else dateLabel = `${startDate} a ${endDate}`;

    let shiftLabel = 'Todas las Cajas / Turnos';
    if (selectedShiftFilter === 'activa') shiftLabel = 'Caja Operativa Activa';
    else if (selectedShiftFilter !== 'todos') {
      const sh = shiftHistory.find((s) => s.id === selectedShiftFilter);
      if (sh) shiftLabel = `Turno ${sh.cajeroNombre} (${sh.fechaApertura.slice(0, 10)})`;
    }

    exportCashControlReportToExcel({
      dateFilterLabel: dateLabel,
      shiftLabel,
      totals: totalsByPaymentMethod,
      sales: filteredSales,
      startDate,
      endDate,
    });
  };

  // Exportar el historial de turnos y arqueos filtrados a Excel
  const handleExportFilteredShifts = () => {
    let dateLabel = '';
    if (dateFilterMode === 'hoy') dateLabel = `Hoy (${todayStr})`;
    else if (dateFilterMode === 'ayer') dateLabel = 'Ayer';
    else if (dateFilterMode === '7dias') dateLabel = 'Últimos 7 días';
    else if (dateFilterMode === 'mes') dateLabel = 'Este Mes';
    else if (dateFilterMode === 'mes_anterior') dateLabel = 'Mes Anterior';
    else if (dateFilterMode === 'ano') dateLabel = 'Este Año';
    else if (dateFilterMode === 'todos') dateLabel = 'Todo el Historial';
    else dateLabel = `${startDate} a ${endDate}`;

    exportShiftHistoryToExcel(filteredShiftHistory, dateLabel, startDate, endDate);
  };

  return (
    <div id="cash-control-module-root" className="space-y-4">
      {/* Encabezado Principal y Pestañas de Vista */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl text-white shadow-xs ${
                activeShift && activeShift.estado === 'abierta'
                  ? 'bg-emerald-600'
                  : 'bg-slate-800'
              }`}
            >
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Caja Operativa & Totales por Método
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeShift && activeShift.estado === 'abierta'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {activeShift && activeShift.estado === 'abierta' ? 'Caja Abierta' : 'Caja Cerrada'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeShift && activeShift.estado === 'abierta'
                  ? `Turno activo a cargo de ${activeShift.cajeroNombre} • Tasa BCV: ${formatVES(activeShift.tasaBCV)}`
                  : 'Filtra por fecha y revisa totales en efectivo, transferencia, pago móvil y punto de venta.'}
              </p>
            </div>
          </div>

          {/* Botones de Acción de Turno de Caja */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
            {!activeShift || activeShift.estado === 'cerrada' ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apertura de Turno de Caja</span>
                </button>
                <InfoHelpButton
                  topicKey="apertura_caja"
                  onOpenHelp={setHelpTopic}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => exportCashShiftToExcel(activeShift)}
                    className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Exportar arqueo actual a Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="hidden sm:inline">Exportar Turno Excel</span>
                  </button>
                  <InfoHelpButton
                    topicKey="exportar_arqueo"
                    onOpenHelp={setHelpTopic}
                  />
                </div>

                {canCloseRegister && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleOpenArqueo}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Arqueo & Cierre de Caja</span>
                    </button>
                    <InfoHelpButton
                      topicKey="arqueo_cierre"
                      onOpenHelp={setHelpTopic}
                    />
                  </div>
                )}
              </>
            )}

            {/* Pestañas de Navegación del Módulo */}
            <div className="flex flex-wrap p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('resumen_caja')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'resumen_caja'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Totales por Caja & Fecha
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deudas_cxc')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'deudas_cxc'
                    ? 'bg-white text-amber-950 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>Clientes con Deuda ({pendingCxCCount})</span>
                {pendingCxCCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historial_turnos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'historial_turnos'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial de Cierres ({shiftHistory.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === 'resumen_caja' && (
        <>
          {/* BARRA DE FILTROS POR FECHA, CAJA Y MÉTODOS DE PAGO */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                  Filtros de Búsqueda & Rango de Fechas
                </h3>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleExportFilteredReport}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Descargar reporte en Excel con los filtros aplicados"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Reporte Excel</span>
                </button>
                <InfoHelpButton
                  topicKey="exportar_arqueo"
                  onOpenHelp={setHelpTopic}
                />
              </div>
            </div>

            {/* Fila 1: Botones rápidos de fecha + Selectores Desde / Hasta */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Atajos Rápidos */}
              <div className="md:col-span-6 flex flex-wrap gap-1.5">
                {[
                  { id: 'hoy', label: 'Hoy' },
                  { id: 'ayer', label: 'Ayer' },
                  { id: '7dias', label: '7 días' },
                  { id: 'mes', label: 'Este Mes' },
                  { id: 'mes_anterior', label: 'Mes Anterior' },
                  { id: 'ano', label: 'Este Año' },
                  { id: 'todos', label: 'Todo el Historial' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectDateFilter(item.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      dateFilterMode === item.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Rango de Fechas Personalizado */}
              <div className="md:col-span-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="text-[10px] font-bold text-slate-400 absolute left-2.5 top-1">
                    Desde:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilterMode('personalizado');
                    }}
                    className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-slate-400 font-bold text-xs">-</span>
                <div className="relative flex-1">
                  <span className="text-[10px] font-bold text-slate-400 absolute left-2.5 top-1">
                    Hasta:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilterMode('personalizado');
                    }}
                    className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Fila 2: Filtro por Caja, Filtro por Método y Buscador de Texto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              {/* Selector de Caja / Turno */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Caja / Turno de Caja
                </label>
                <select
                  value={selectedShiftFilter}
                  onChange={(e) => setSelectedShiftFilter(e.target.value)}
                  className="w-full p-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todos">Todas las Cajas / Turnos</option>
                  {activeShift && (
                    <option value="activa">
                      Turno Activo Actual ({activeShift.cajeroNombre})
                    </option>
                  )}
                  {shiftHistory.map((s) => (
                    <option key={s.id} value={s.id}>
                      Turno {s.cajeroNombre} ({new Date(s.fechaApertura).toLocaleDateString('es-VE')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Método de Pago Específico
                </label>
                <select
                  value={selectedPaymentMethodFilter}
                  onChange={(e) => setSelectedPaymentMethodFilter(e.target.value)}
                  className="w-full p-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="todos">Todos los Métodos de Pago</option>
                  <option value="efectivo_usd">Efectivo Divisas (USD / REF)</option>
                  <option value="efectivo_ves">Efectivo Bolívares (VES)</option>
                  <option value="pago_movil">Pago Móvil (VES)</option>
                  <option value="transferencia">Transferencia Bancaria (VES)</option>
                  <option value="punto_venta">Punto de Venta / Débito (VES)</option>
                  <option value="zelle">Zelle (USD)</option>
                </select>
              </div>

              {/* Buscador de Notas / Clientes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Buscar por N° Nota, Cliente o Cajero
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={salesSearchTerm}
                    onChange={(e) => setSalesSearchTerm(e.target.value)}
                    placeholder="ej. NE-2026, Pérez, María..."
                    className="w-full pl-9 pr-7 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  {salesSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setSalesSearchTerm('')}
                      className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TARJETAS DE TOTALES CONSOLIDADOS POR CAJA Y MÉTODOS DE PAGO */}
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                {selectedPaymentMethodFilter === 'todos' ? (
                  <>
                    <Coins className="w-4 h-4 text-emerald-600" />
                    Desglose Total por Caja & Medios de Pago
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span>Filtro de Caja:</span>
                    <span className="text-indigo-700 font-black">
                      {selectedPaymentMethodFilter === 'efectivo_usd' && 'Efectivo Divisas (USD)'}
                      {selectedPaymentMethodFilter === 'efectivo_ves' && 'Efectivo Bolívares (VES)'}
                      {selectedPaymentMethodFilter === 'pago_movil' && 'Pago Móvil (VES)'}
                      {selectedPaymentMethodFilter === 'transferencia' && 'Transferencia Bancaria (VES)'}
                      {selectedPaymentMethodFilter === 'punto_venta' && 'Punto de Venta / Débito (VES)'}
                      {selectedPaymentMethodFilter === 'zelle' && 'Zelle (USD)'}
                    </span>
                  </>
                )}
              </span>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                  {totalsByPaymentMethod.countNotas} ventas registradas
                </span>
                {selectedPaymentMethodFilter !== 'todos' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethodFilter('todos')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                    title="Restablecer filtro y mostrar todas las cards"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Ver todas las cards</span>
                  </button>
                )}

                {/* Botón de Ayuda e Info para Métodos de Pago */}
                <button
                  type="button"
                  onClick={() => setShowBalanceMethodInfoModal(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Guía explicativa: ¿Cómo funciona el balance consolidado por método de pago?"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Info Métodos</span>
                </button>

                {/* Selector de Modo de Vista para Totales por Método: Tabla, Cards o Ambos */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setMethodViewMode('ambos')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      methodViewMode === 'ambos'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Mostrar tarjetas y tabla de balance simultáneamente"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Cards & Tabla</span>
                    <span className="md:hidden">Ambos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      methodViewMode === 'cards'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Mostrar únicamente tarjetas métricas"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethodViewMode('tabla')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      methodViewMode === 'tabla'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Mostrar únicamente tabla de balance por método"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabla</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECCIÓN DE CARDS DE TOTALES POR MÉTODO */}
            {(methodViewMode === 'cards' || methodViewMode === 'ambos') && (
              <div className="mb-4">
                {selectedPaymentMethodFilter === 'todos' ? (
              /* Mostrar todas las cards cuando NO hay filtro de método específico */
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Banner Accesible: Clientes con Deuda */}
                {pendingCxCCount > 0 && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-6 p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-amber-950 flex items-center gap-2">
                          <span>Hay {pendingCxCCount} cliente{pendingCxCCount > 1 ? 's' : ''} con deuda pendiente por cobrar</span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-mono font-bold">
                            Total: {formatVES(totalCxCPendingVES)}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Puedes consultar cuánto pagaron, cuánto deben y cobrar el saldo restante ingresándolo a tu caja.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('deudas_cxc')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Ver Clientes y Cobrar Resto</span>
                    </button>
                  </div>
                )}

                {/* Gran Total Facturado */}
                <div className="col-span-2 sm:col-span-3 lg:col-span-2 p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
                  <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">
                    <span>Total Facturado Caja</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">
                      Todos los métodos
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
                    {formatUSD(totalsByPaymentMethod.totalUSD)}
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                    {formatVES(totalsByPaymentMethod.totalVES)}
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Comprobantes Emitidos:</span>
                    <strong className="text-white font-mono">{totalsByPaymentMethod.countNotas}</strong>
                  </div>
                </div>

                {/* 1. Efectivo Divisas USD */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('efectivo_usd')}
                  className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-emerald-400 cursor-pointer group"
                  title="Clic para filtrar solo Efectivo Divisas"
                >
                  <div className="flex items-center justify-between text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Efectivo Divisas</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-emerald-950">
                    {formatUSD(totalsByPaymentMethod.efectivoUSD)}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                    {formatVES(totalsByPaymentMethod.efectivoUSD * bcvRate)}
                  </div>
                  <div className="text-[10px] text-emerald-600/80 mt-2 flex items-center justify-between">
                    <span>Billetes en caja</span>
                    <span className="font-mono font-bold text-emerald-700">{totalsByPaymentMethod.countEfectivoUSD}</span>
                  </div>
                </button>

                {/* 2. Efectivo Bolívares VES */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('efectivo_ves')}
                  className="p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-50 border border-blue-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-blue-400 cursor-pointer group"
                  title="Clic para filtrar solo Efectivo Bolívares"
                >
                  <div className="flex items-center justify-between text-blue-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-blue-600" />
                      <span>Efectivo Bolívares</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-blue-950">
                    {formatVES(totalsByPaymentMethod.efectivoVES)}
                  </div>
                  <div className="text-[11px] text-blue-700 font-mono mt-0.5">
                    {formatUSD(totalsByPaymentMethod.efectivoVES / (bcvRate || 1))}
                  </div>
                  <div className="text-[10px] text-blue-600/80 mt-2 flex items-center justify-between">
                    <span>Efectivo en Bs.</span>
                    <span className="font-mono font-bold text-blue-700">{totalsByPaymentMethod.countEfectivoVES}</span>
                  </div>
                </button>

                {/* 3. Pago Móvil VES */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('pago_movil')}
                  className="p-3.5 rounded-2xl bg-amber-50/70 hover:bg-amber-50 border border-amber-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-amber-400 cursor-pointer group"
                  title="Clic para filtrar solo Pago Móvil"
                >
                  <div className="flex items-center justify-between text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                      <span>Pago Móvil (VES)</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-amber-950">
                    {formatVES(totalsByPaymentMethod.pagoMovilVES)}
                  </div>
                  <div className="text-[11px] text-amber-700 font-mono mt-0.5">
                    {formatUSD(totalsByPaymentMethod.pagoMovilVES / (bcvRate || 1))}
                  </div>
                  <div className="text-[10px] text-amber-600/80 mt-2 flex items-center justify-between">
                    <span>Banca digital</span>
                    <span className="font-mono font-bold text-amber-700">{totalsByPaymentMethod.countPagoMovil}</span>
                  </div>
                </button>

                {/* 4. Transferencias Bancarias VES */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('transferencia')}
                  className="p-3.5 rounded-2xl bg-cyan-50/70 hover:bg-cyan-50 border border-cyan-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-cyan-400 cursor-pointer group"
                  title="Clic para filtrar solo Transferencia"
                >
                  <div className="flex items-center justify-between text-cyan-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Transferencia (VES)</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-cyan-950">
                    {formatVES(totalsByPaymentMethod.transferenciaVES)}
                  </div>
                  <div className="text-[11px] text-cyan-700 font-mono mt-0.5">
                    {formatUSD(totalsByPaymentMethod.transferenciaVES / (bcvRate || 1))}
                  </div>
                  <div className="text-[10px] text-cyan-600/80 mt-2 flex items-center justify-between">
                    <span>Bancaria / Cuentas</span>
                    <span className="font-mono font-bold text-cyan-700">{totalsByPaymentMethod.countTransferencia}</span>
                  </div>
                </button>

                {/* 5. Punto de Venta / Débito VES */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('punto_venta')}
                  className="p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-50 border border-purple-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-purple-400 cursor-pointer group"
                  title="Clic para filtrar solo Punto de Venta"
                >
                  <div className="flex items-center justify-between text-purple-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                      <span>Punto de Venta</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-purple-950">
                    {formatVES(totalsByPaymentMethod.puntoVentaVES)}
                  </div>
                  <div className="text-[11px] text-purple-700 font-mono mt-0.5">
                    {formatUSD(totalsByPaymentMethod.puntoVentaVES / (bcvRate || 1))}
                  </div>
                  <div className="text-[10px] text-purple-600/80 mt-2 flex items-center justify-between">
                    <span>Tarjetas de Débito</span>
                    <span className="font-mono font-bold text-purple-700">{totalsByPaymentMethod.countPuntoVenta}</span>
                  </div>
                </button>

                {/* 6. Zelle USD */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethodFilter('zelle')}
                  className="p-3.5 rounded-2xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-200/80 shadow-2xs text-left transition-all hover:ring-2 hover:ring-indigo-400 cursor-pointer group"
                  title="Clic para filtrar solo Zelle"
                >
                  <div className="flex items-center justify-between text-indigo-800 text-[11px] font-bold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Zelle (USD)</span>
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black font-mono text-indigo-950">
                    {formatUSD(totalsByPaymentMethod.zelleUSD)}
                  </div>
                  <div className="text-[11px] text-indigo-700 font-mono mt-0.5">
                    {formatVES(totalsByPaymentMethod.zelleUSD * bcvRate)}
                  </div>
                  <div className="text-[10px] text-indigo-600/80 mt-2 flex items-center justify-between">
                    <span>Transferencias USD</span>
                    <span className="font-mono font-bold text-indigo-700">{totalsByPaymentMethod.countZelle}</span>
                  </div>
                </button>
              </div>
            ) : (
              /* Cuando se filtra por un método específico: SOLO aparece la card seleccionada */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedPaymentMethodFilter === 'efectivo_usd' && (
                  <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Efectivo Divisas (USD / REF)</div>
                          <span className="text-[11px] font-medium text-emerald-700 normal-case">
                            Billetes recibidos en caja física
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">
                          Total Cobrado en Divisas:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-950">
                          {formatUSD(totalsByPaymentMethod.efectivoUSD)}
                        </div>
                        <div className="text-sm font-bold font-mono text-emerald-700 mt-1">
                          Equivalente BCV: {formatVES(totalsByPaymentMethod.efectivoUSD * bcvRate)}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-emerald-200 text-right">
                        <div className="text-[11px] text-emerald-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-emerald-900">
                          {totalsByPaymentMethod.countEfectivoUSD} cobros
                        </div>
                        <div className="text-[10px] text-emerald-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethodFilter === 'efectivo_ves' && (
                  <div className="p-5 rounded-2xl bg-blue-50 border-2 border-blue-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                          <Coins className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Efectivo Bolívares (VES)</div>
                          <span className="text-[11px] font-medium text-blue-700 normal-case">
                            Moneda de curso legal en efectivo en caja
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-blue-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-blue-800 font-bold uppercase tracking-wider block">
                          Total Cobrado en Bolívares Efectivo:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-blue-950">
                          {formatVES(totalsByPaymentMethod.efectivoVES)}
                        </div>
                        <div className="text-sm font-bold font-mono text-blue-700 mt-1">
                          Equivalente Ref USD: {formatUSD(totalsByPaymentMethod.efectivoVES / (bcvRate || 1))}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-blue-200 text-right">
                        <div className="text-[11px] text-blue-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-blue-900">
                          {totalsByPaymentMethod.countEfectivoVES} cobros
                        </div>
                        <div className="text-[10px] text-blue-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethodFilter === 'pago_movil' && (
                  <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-amber-600 text-white rounded-xl shadow-xs">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Pago Móvil (VES)</div>
                          <span className="text-[11px] font-medium text-amber-700 normal-case">
                            Banca digital interbancaria inmediata
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-amber-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-amber-800 font-bold uppercase tracking-wider block">
                          Total Cobrado por Pago Móvil:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-amber-950">
                          {formatVES(totalsByPaymentMethod.pagoMovilVES)}
                        </div>
                        <div className="text-sm font-bold font-mono text-amber-700 mt-1">
                          Equivalente Ref USD: {formatUSD(totalsByPaymentMethod.pagoMovilVES / (bcvRate || 1))}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-amber-200 text-right">
                        <div className="text-[11px] text-amber-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-amber-900">
                          {totalsByPaymentMethod.countPagoMovil} cobros
                        </div>
                        <div className="text-[10px] text-amber-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethodFilter === 'transferencia' && (
                  <div className="p-5 rounded-2xl bg-cyan-50 border-2 border-cyan-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-cyan-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-cyan-600 text-white rounded-xl shadow-xs">
                          <ArrowRightLeft className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Transferencia Bancaria (VES)</div>
                          <span className="text-[11px] font-medium text-cyan-700 normal-case">
                            Depósitos y transferencias en cuentas bancarias
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-cyan-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-cyan-800 font-bold uppercase tracking-wider block">
                          Total Cobrado por Transferencia:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-cyan-950">
                          {formatVES(totalsByPaymentMethod.transferenciaVES)}
                        </div>
                        <div className="text-sm font-bold font-mono text-cyan-700 mt-1">
                          Equivalente Ref USD: {formatUSD(totalsByPaymentMethod.transferenciaVES / (bcvRate || 1))}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-cyan-200 text-right">
                        <div className="text-[11px] text-cyan-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-cyan-900">
                          {totalsByPaymentMethod.countTransferencia} cobros
                        </div>
                        <div className="text-[10px] text-cyan-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethodFilter === 'punto_venta' && (
                  <div className="p-5 rounded-2xl bg-purple-50 border-2 border-purple-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Punto de Venta / Débito (VES)</div>
                          <span className="text-[11px] font-medium text-purple-700 normal-case">
                            Tarjetas de débito y operaciones en terminales POS
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-purple-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-purple-800 font-bold uppercase tracking-wider block">
                          Total Cobrado por Punto de Venta:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-purple-950">
                          {formatVES(totalsByPaymentMethod.puntoVentaVES)}
                        </div>
                        <div className="text-sm font-bold font-mono text-purple-700 mt-1">
                          Equivalente Ref USD: {formatUSD(totalsByPaymentMethod.puntoVentaVES / (bcvRate || 1))}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-purple-200 text-right">
                        <div className="text-[11px] text-purple-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-purple-900">
                          {totalsByPaymentMethod.countPuntoVenta} cobros
                        </div>
                        <div className="text-[10px] text-purple-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedPaymentMethodFilter === 'zelle' && (
                  <div className="p-5 rounded-2xl bg-indigo-50 border-2 border-indigo-400 shadow-md sm:col-span-2 lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm uppercase tracking-wider">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <div>Zelle (USD)</div>
                          <span className="text-[11px] font-medium text-indigo-700 normal-case">
                            Transferencias directas en dólares internacionales
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethodFilter('todos')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Ver todas las cards</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-indigo-200 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-indigo-800 font-bold uppercase tracking-wider block">
                          Total Cobrado por Zelle USD:
                        </span>
                        <div className="text-3xl sm:text-4xl font-black font-mono text-indigo-950">
                          {formatUSD(totalsByPaymentMethod.zelleUSD)}
                        </div>
                        <div className="text-sm font-bold font-mono text-indigo-700 mt-1">
                          Equivalente BCV: {formatVES(totalsByPaymentMethod.zelleUSD * bcvRate)}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-indigo-200 text-right">
                        <div className="text-[11px] text-indigo-800 font-semibold">Operaciones registradas:</div>
                        <div className="text-xl font-black font-mono text-indigo-900">
                          {totalsByPaymentMethod.countZelle} cobros
                        </div>
                        <div className="text-[10px] text-indigo-700">en notas de venta</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            {/* SECCIÓN DE TABLA DE BALANCE POR MÉTODO DE PAGO */}
            {(methodViewMode === 'tabla' || methodViewMode === 'ambos') && (
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
                <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-2xs">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                          Tabla de Balance Consolidado por Método de Pago
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowBalanceMethodInfoModal(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                          title="Guía contable y explicativa: ¿Cómo interpretar y conciliar esta tabla?"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                          <span>¿Cómo funciona esta tabla?</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {totalsByPaymentMethod.countNotas} comprobantes • Tasa BCV aplicada:{' '}
                        <strong className="text-slate-700 font-mono">{formatVES(bcvRate)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                      {totalOperaciones} Cobros Registrados
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBalanceMethodInfoModal(true)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Abrir guía explicativa de auditoría y conciliación"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="hidden sm:inline">Guía Contable</span>
                    </button>
                  </div>
                </div>

                {/* Banner de Info Rápida de la Tabla */}
                <div className="px-4 py-2 bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-slate-50 border-b border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      <strong className="text-slate-900 font-bold">Conciliación de Caja:</strong> Separa el efectivo físico en gaveta (USD/VES) del dinero en cuentas bancarias (Pago Móvil, POS y transferencias).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBalanceMethodInfoModal(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 shrink-0 cursor-pointer hover:underline"
                  >
                    <span>Ver manual de arqueo</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="px-4 py-3">Método de Pago</th>
                        <th className="px-3 py-3 text-center">Operaciones</th>
                        <th className="px-3 py-3 text-right">Monto (USD / REF)</th>
                        <th className="px-3 py-3 text-right">Equivalente (Bolívares)</th>
                        <th className="px-3 py-3 text-center">% Participación</th>
                        <th className="px-3 py-3">Custodia / Destino</th>
                        <th className="px-4 py-3 text-center">Filtro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paymentMethodsBreakdown.map((item) => {
                        const Icon = item.icon;
                        const isSelected = selectedPaymentMethodFilter === item.id;
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-slate-50/90 transition-colors ${
                              isSelected ? 'bg-indigo-50/60 font-semibold' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl text-white shadow-2xs shrink-0 ${item.iconBg}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{item.nombre}</div>
                                  <div className="text-[10px] text-slate-500 font-normal">{item.desc}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center font-mono">
                              <span className="font-bold text-slate-800">{item.operaciones}</span>
                              <span className="text-[10px] text-slate-400 ml-1">
                                ({totalOperaciones > 0 ? ((item.operaciones / totalOperaciones) * 100).toFixed(0) : 0}%)
                              </span>
                            </td>

                            <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                              {formatUSD(item.montoUSD)}
                            </td>

                            <td className="px-3 py-3 text-right font-mono font-bold text-indigo-700">
                              {formatVES(item.montoVES)}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.porcentaje > 40
                                        ? 'bg-emerald-500'
                                        : item.porcentaje > 20
                                        ? 'bg-indigo-500'
                                        : item.porcentaje > 5
                                        ? 'bg-amber-500'
                                        : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, item.porcentaje))}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-right">
                                  {item.porcentaje.toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>{item.custodia}</span>
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedPaymentMethodFilter(
                                    isSelected ? 'todos' : item.id
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title={isSelected ? 'Quitar filtro' : `Filtrar notas por ${item.nombre}`}
                              >
                                {isSelected ? 'Activo' : 'Filtrar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-800">
                      <tr>
                        <td className="px-4 py-3 uppercase tracking-wider text-[11px]">
                          Gran Total Recaudado en Caja
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-slate-300">
                          {totalOperaciones} cobros
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-400 text-sm">
                          {formatUSD(totalsByPaymentMethod.totalUSD)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-blue-300 text-sm">
                          {formatVES(totalsByPaymentMethod.totalVES)}
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-emerald-400">
                          100.0%
                        </td>
                        <td className="px-3 py-3 text-slate-400 text-[11px] font-normal">
                          Caja Central & Conciliación Bancaria
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedPaymentMethodFilter !== 'todos' ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPaymentMethodFilter('todos')}
                              className="text-[11px] text-indigo-300 hover:text-white underline cursor-pointer"
                            >
                              Ver todos
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-normal">Completo</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN DETALLADA DE COMPROBANTES Y NOTAS DE VENTA FILTRADAS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  <span>Comprobantes & Notas Emitidas en Caja</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Visualiza el desglose exacto de pagos por cada transacción del período seleccionado.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono">
                  {filteredSales.length} notas
                </span>

                {/* Selector de Modo de Vista para Comprobantes: Tabla, Cards o Ambos */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSalesViewMode('tabla')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      salesViewMode === 'tabla'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Ver notas en formato tabla tradicional"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabla</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      salesViewMode === 'cards'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Ver notas en formato tarjetas individuales"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalesViewMode('ambos')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      salesViewMode === 'ambos'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Ver tabla y tarjetas simultáneamente"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tabla & Cards</span>
                    <span className="sm:hidden">Ambos</span>
                  </button>
                </div>
              </div>
            </div>

            {/* VISTA EN TABLA DE COMPROBANTES */}
            {(salesViewMode === 'tabla' || salesViewMode === 'ambos') && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="px-4 py-3">N° Nota</th>
                      <th className="px-3 py-3">Fecha y Hora</th>
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-3 py-3">Productos Vendidos</th>
                      <th className="px-3 py-3">Cajero</th>
                      <th className="px-3 py-3">Desglose de Métodos</th>
                      <th className="px-3 py-3 text-right">Total (REF)</th>
                      <th className="px-3 py-3 text-right">Total (Bs)</th>
                      <th className="px-3 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center">
                            <Filter className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="font-bold text-slate-600 text-xs">
                              No hay notas de venta con los filtros seleccionados
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Prueba ajustando el rango de fechas o seleccionando "Todo el Historial".
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSales.map((sale) => {
                        const isAnulada = sale.estado === 'anulada';
                        const isCredit = sale.tipoVenta === 'credito_fijado_ves' || (sale.saldoPendienteVES !== undefined && sale.saldoPendienteVES > 0);
                        const matchingCxC = cxc.find((c) => c.notaVentaId === sale.id || c.notaVentaId === sale.numeroNota || (c.clienteDocumento === sale.clienteDocumento && sale.tipoVenta === 'credito_fijado_ves'));

                        const hasPendingDebt = !isAnulada && (
                          matchingCxC
                            ? (matchingCxC.monedaFijada === 'VES' ? (matchingCxC.saldoPendienteVES || 0) > 0.05 : matchingCxC.saldoPendienteUSD > 0.01) && matchingCxC.estado !== 'pagada'
                            : (sale.saldoPendienteVES !== undefined && sale.saldoPendienteVES > 0.05) || (sale.saldoPendienteUSD !== undefined && sale.saldoPendienteUSD > 0.01)
                        );

                        const displayPaidVES = matchingCxC ? (matchingCxC.montoAbonadoVES ?? (matchingCxC.montoAbonadoUSD * bcvRate)) : (sale.montoAbonadoVES ?? (sale.montoRecibidoVES || 0));
                        const displayDueVES = matchingCxC ? (matchingCxC.saldoPendienteVES ?? (matchingCxC.saldoPendienteUSD * bcvRate)) : (sale.saldoPendienteVES ?? (sale.saldoPendienteUSD ? sale.saldoPendienteUSD * bcvRate : 0));

                        return (
                          <tr
                            key={sale.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isAnulada ? 'bg-rose-50/40 opacity-70' : hasPendingDebt ? 'bg-amber-50/20' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {sale.numeroNota}
                            </td>

                            <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                              {new Date(sale.fecha).toLocaleString('es-VE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>

                            <td className="px-3 py-3 font-medium text-slate-900">
                              <span className="block truncate max-w-[140px]">{sale.clienteNombre}</span>
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {sale.clienteDocumento}
                              </span>
                            </td>

                            <td className="px-3 py-3 max-w-[220px]">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                                  <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>{sale.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0} unid.</span>
                                  <span className="text-slate-400 font-normal">({sale.items?.length || 0} {sale.items?.length === 1 ? 'ítem' : 'ítems'})</span>
                                </div>
                                <div
                                  className="truncate text-[11px] text-slate-600 font-medium"
                                  title={sale.items?.map((it) => `${it.cantidad}× ${it.nombre || (it as any).productoNombre || (it as any).nombre_producto || 'Artículo'}`).join('\n')}
                                >
                                  {sale.items && sale.items.length > 0
                                    ? sale.items.map((it) => `${it.cantidad}× ${it.nombre || (it as any).productoNombre || (it as any).nombre_producto || 'Artículo'}`).join(', ')
                                    : 'Venta sin detalle'}
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                              {sale.cajeroNombre}
                            </td>

                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {sale.pagos.map((p, i) => {
                                  let badgeColor = 'bg-slate-100 text-slate-700';
                                  if (p.metodo === 'efectivo_usd') badgeColor = 'bg-emerald-100 text-emerald-800 font-bold';
                                  else if (p.metodo === 'efectivo_ves') badgeColor = 'bg-blue-100 text-blue-800 font-bold';
                                  else if (p.metodo === 'pago_movil') badgeColor = 'bg-amber-100 text-amber-900 font-bold';
                                  else if (p.metodo === 'transferencia') badgeColor = 'bg-cyan-100 text-cyan-900 font-bold';
                                  else if (p.metodo === 'punto_venta') badgeColor = 'bg-purple-100 text-purple-800 font-bold';
                                  else if (p.metodo === 'zelle') badgeColor = 'bg-indigo-100 text-indigo-800 font-bold';

                                  return (
                                    <span
                                      key={i}
                                      className={`px-1.5 py-0.5 rounded text-[10px] ${badgeColor}`}
                                    >
                                      {p.nombreMetodo}:{' '}
                                      <span className="font-mono">
                                        {p.moneda === 'USD' ? formatUSD(p.montoOriginal) : formatVES(p.montoOriginal)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right font-bold text-slate-900 font-mono">
                              {formatUSD(sale.totalUSD)}
                            </td>

                            <td className="px-3 py-3 text-right font-bold text-indigo-700 font-mono">
                              {formatVES(sale.totalVES)}
                            </td>

                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {isAnulada ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                                  anulada
                                </span>
                              ) : hasPendingDebt ? (
                                <div className="space-y-1">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 block">
                                    Debe Saldo
                                  </span>
                                  <div className="text-[10px] font-mono leading-tight">
                                    <div className="font-bold text-amber-900">Debe: {formatVES(displayDueVES)}</div>
                                    <div className="text-emerald-700 font-semibold">Pagó: {formatVES(displayPaidVES)}</div>
                                  </div>
                                </div>
                              ) : isCredit ? (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 block">
                                    ✓ Crédito Pagado
                                  </span>
                                  <span className="text-[9px] text-emerald-600 font-mono block">
                                    Pagó: {formatVES(displayPaidVES)}
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                                  {sale.estado}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                {hasPendingDebt && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayForSale(sale)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                    title="Cobrar resto o registrar abono directamente a caja"
                                  >
                                    <Coins className="w-3.5 h-3.5" />
                                    <span>Cobrar Resto</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedSaleDetail(sale)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="Ver comprobante y detalle de artículos"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => generateSaleNotePDF(sale)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  title="Descargar Comprobante PDF (80mm)"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {!isAnulada && canCancelSales && (
                                  <button
                                    type="button"
                                    onClick={() => setSaleToCancel(sale)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Anular Nota de Venta (Solo Administrador)"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISTA EN CARDS DE COMPROBANTES */}
            {(salesViewMode === 'cards' || salesViewMode === 'ambos') && (
              <div className="space-y-3 pt-1">
                {salesViewMode === 'ambos' && (
                  <div className="pt-3 flex items-center justify-between border-t border-slate-200">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Vista en Tarjetas (Cards) de Comprobantes</span>
                    </h5>
                    <span className="text-[11px] font-mono text-slate-500">
                      {filteredSales.length} notas
                    </span>
                  </div>
                )}

                {filteredSales.length === 0 ? (
                  salesViewMode === 'cards' && (
                    <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600 text-xs">
                        No hay notas de venta con los filtros seleccionados
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Prueba ajustando el rango de fechas o seleccionando "Todo el Historial".
                      </p>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {filteredSales.map((sale) => {
                      const isAnulada = sale.estado === 'anulada';
                      const isCredit = sale.tipoVenta === 'credito_fijado_ves' || (sale.saldoPendienteVES !== undefined && sale.saldoPendienteVES > 0);
                      const matchingCxC = cxc.find((c) => c.notaVentaId === sale.id || c.notaVentaId === sale.numeroNota || (c.clienteDocumento === sale.clienteDocumento && sale.tipoVenta === 'credito_fijado_ves'));

                      const hasPendingDebt = !isAnulada && (
                        matchingCxC
                          ? (matchingCxC.monedaFijada === 'VES' ? (matchingCxC.saldoPendienteVES || 0) > 0.05 : matchingCxC.saldoPendienteUSD > 0.01) && matchingCxC.estado !== 'pagada'
                          : (sale.saldoPendienteVES !== undefined && sale.saldoPendienteVES > 0.05) || (sale.saldoPendienteUSD !== undefined && sale.saldoPendienteUSD > 0.01)
                      );

                      const displayPaidVES = matchingCxC ? (matchingCxC.montoAbonadoVES ?? (matchingCxC.montoAbonadoUSD * bcvRate)) : (sale.montoAbonadoVES ?? (sale.montoRecibidoVES || 0));
                      const displayDueVES = matchingCxC ? (matchingCxC.saldoPendienteVES ?? (matchingCxC.saldoPendienteUSD * bcvRate)) : (sale.saldoPendienteVES ?? (sale.saldoPendienteUSD ? sale.saldoPendienteUSD * bcvRate : 0));

                      return (
                        <div
                          key={sale.id}
                          className={`rounded-2xl border transition-all hover:shadow-md p-4 flex flex-col justify-between ${
                            isAnulada
                              ? 'border-rose-200 bg-rose-50/30 opacity-75'
                              : hasPendingDebt
                              ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400 shadow-2xs'
                              : 'border-slate-200/90 bg-white hover:border-indigo-300 shadow-2xs'
                          }`}
                        >
                          {/* Cabecera de la Card: N° Nota, Fecha y Estado */}
                          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-slate-900">
                                  {sale.numeroNota}
                                </span>
                                {hasPendingDebt ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                    Debe Saldo
                                  </span>
                                ) : isCredit ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ Crédito Pagado
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      isAnulada
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {sale.estado}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="font-mono">
                                  {new Date(sale.fecha).toLocaleString('es-VE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Cajero
                              </span>
                              <span className="text-xs font-semibold text-slate-700">
                                {sale.cajeroNombre}
                              </span>
                            </div>
                          </div>

                          {/* Cuerpo: Cliente y Métodos de Pago */}
                          <div className="py-3 space-y-2.5 flex-1">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Cliente
                              </span>
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900 truncate">
                                  {sale.clienteNombre}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                  {sale.clienteDocumento}
                                </span>
                              </div>
                            </div>

                            {/* Desglose de Pagos */}
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Métodos de Pago
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {sale.pagos.map((p, i) => {
                                  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                                  if (p.metodo === 'efectivo_usd') badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
                                  else if (p.metodo === 'efectivo_ves') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200 font-bold';
                                  else if (p.metodo === 'pago_movil') badgeColor = 'bg-amber-50 text-amber-900 border-amber-200 font-bold';
                                  else if (p.metodo === 'transferencia') badgeColor = 'bg-cyan-50 text-cyan-900 border-cyan-200 font-bold';
                                  else if (p.metodo === 'punto_venta') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200 font-bold';
                                  else if (p.metodo === 'zelle') badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200 font-bold';

                                  return (
                                    <span
                                      key={i}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] border ${badgeColor}`}
                                    >
                                      {p.nombreMetodo}:{' '}
                                      <span className="font-mono font-bold">
                                        {p.moneda === 'USD' ? formatUSD(p.montoOriginal) : formatVES(p.montoOriginal)}
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Detalle de Productos Vendidos en la Card */}
                            <div className="pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                  <Package className="w-3 h-3 text-indigo-600" />
                                  <span>Productos Vendidos ({sale.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0} unid.)</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {sale.items?.length || 0} {sale.items?.length === 1 ? 'artículo' : 'artículos'}
                                </span>
                              </div>
                              <div className="space-y-1 bg-slate-50/80 p-2 rounded-xl border border-slate-100 max-h-28 overflow-y-auto">
                                {sale.items && sale.items.length > 0 ? (
                                  sale.items.map((it, idx) => {
                                    const itemName =
                                      it.nombre ||
                                      (it as any).productoNombre ||
                                      (it as any).nombre_producto ||
                                      products?.find((p) => p.id === it.productoId || p.codigoBarras === it.codigoBarras)?.nombre ||
                                      `Artículo #${idx + 1}`;

                                    return (
                                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate text-slate-800 font-medium min-w-0" title={`${it.cantidad}× ${itemName}`}>
                                          <strong className="text-slate-900 font-mono">{it.cantidad}×</strong>{' '}
                                          {itemName}
                                        </span>
                                        <span className="font-mono text-[11px] font-bold text-slate-700 shrink-0">
                                          {formatUSD(it.subtotalUSD)}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-slate-400 italic text-[11px] block text-center py-1">
                                    Sin detalle de productos registrado
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Resumen Deuda vs Cobrado para ventas a crédito */}
                          {hasPendingDebt && (
                            <div className="mb-2.5 p-2 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="text-[9px] uppercase font-bold text-amber-800 block">Debe Actualmente</span>
                                <span className="font-black text-amber-950">{formatVES(displayDueVES)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] uppercase font-bold text-emerald-800 block">Pagó el Cliente</span>
                                <span className="font-bold text-emerald-700">{formatVES(displayPaidVES)}</span>
                              </div>
                            </div>
                          )}

                          {/* Pie: Montos y Botones de Acción */}
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                Total Cobrado
                              </span>
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-base font-black font-mono text-slate-900">
                                  {formatUSD(sale.totalUSD)}
                                </span>
                                <span className="text-xs font-bold font-mono text-indigo-700">
                                  ({formatVES(sale.totalVES)})
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {hasPendingDebt && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayForSale(sale)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                  title="Cobrar resto o registrar abono a caja"
                                >
                                  <Coins className="w-3.5 h-3.5" />
                                  <span>Cobrar Resto</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedSaleDetail(sale)}
                                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                                title="Ver comprobante y detalle de artículos"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => generateSaleNotePDF(sale)}
                                className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                                title="Descargar Comprobante PDF (80mm)"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {!isAnulada && canCancelSales && (
                                <button
                                  type="button"
                                  onClick={() => setSaleToCancel(sale)}
                                  className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-rose-200 shadow-2xs"
                                  title="Anular Nota de Venta (Solo Administrador)"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* PESTAÑA: CLIENTES CON DEUDA Y CUENTAS POR COBRAR (CxC) */}
      {activeTab === 'deudas_cxc' && (
        <CashDebtTab
          cxcList={cxc}
          sales={sales}
          bcvRate={bcvRate}
          activeShift={activeShift}
          onOpenPayModal={(item) => setSelectedCxCToPay(item)}
          onViewSaleDetail={(sale) => setSelectedSaleDetail(sale)}
        />
      )}

      {/* PESTAÑA: HISTORIAL DE TURNOS Y CIERRES DE CAJA */}
      {activeTab === 'historial_turnos' && (
        <div className="space-y-4">
          {/* BARRA DE FILTRO POR FECHA & EXPORTACIÓN DEL HISTORIAL DE CIERRES */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                  Auditoría de Cierres de Caja por Fecha
                </h3>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={handleExportFilteredShifts}
                  disabled={filteredShiftHistory.length === 0}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Exportar a Excel los turnos y arqueos filtrados por fecha"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar Cierres Filtrados (Excel)</span>
                </button>
                <InfoHelpButton
                  topicKey="exportar_arqueo"
                  onOpenHelp={setHelpTopic}
                />
              </div>
            </div>

            {/* Selector de Rango de Fechas */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Atajos Rápidos */}
              <div className="md:col-span-6 flex flex-wrap gap-1.5">
                {[
                  { id: 'hoy', label: 'Hoy' },
                  { id: 'ayer', label: 'Ayer' },
                  { id: '7dias', label: '7 días' },
                  { id: 'mes', label: 'Este Mes' },
                  { id: 'mes_anterior', label: 'Mes Anterior' },
                  { id: 'ano', label: 'Este Año' },
                  { id: 'todos', label: 'Todo el Historial' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectDateFilter(item.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      dateFilterMode === item.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Rango de Fechas Personalizado */}
              <div className="md:col-span-6 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="text-[10px] font-bold text-slate-400 absolute left-2.5 top-1">
                    Desde:
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilterMode('personalizado');
                    }}
                    className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-slate-400 font-bold text-xs">-</span>
                <div className="relative flex-1">
                  <span className="text-[10px] font-bold text-slate-400 absolute left-2.5 top-1">
                    Hasta:
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilterMode('personalizado');
                    }}
                    className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Resumen del Período Filtrado */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <span>Rango seleccionado:</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono font-bold text-[11px]">
                  {startDate} al {endDate}
                </span>
                <span>({filteredShiftHistory.length} turnos de {shiftHistory.length} totales)</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px]">Vendido en el período: </span>
                  <span className="font-bold font-mono text-slate-900">{formatUSD(filteredShiftTotals.totalUSD)}</span>
                  <span className="text-indigo-600 font-mono text-[11px] ml-1.5 font-semibold">({formatVES(filteredShiftTotals.totalVES)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Listado de Turnos Filtrados */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Turnos & Cierres Registrados en el Período
                </h3>
                <p className="text-xs text-slate-500">
                  Audita cada turno con sus fondos iniciales, ventas por método, conteo físico y diferencias.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold">
                {filteredShiftHistory.length} turnos en este período
              </span>
            </div>

            {filteredShiftHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">
                  No se encontraron turnos de caja registrados entre el {startDate} y el {endDate}.
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectDateFilter('todos')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Ver Todo el Historial
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredShiftHistory.map((shift) => (
                  <div
                    key={shift.id}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-slate-900 text-white">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            Turno: {shift.cajeroNombre}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Apertura: {new Date(shift.fechaApertura).toLocaleString('es-VE')}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          shift.estado === 'abierta'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {shift.estado}
                      </span>
                    </div>

                    {/* Desglose de Ventas del Turno */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Total Vendido USD
                        </span>
                        <strong className="text-slate-900 font-mono text-sm">
                          {formatUSD(shift.totalVendidoUSD)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          Total Vendido VES
                        </span>
                        <strong className="text-indigo-700 font-mono text-sm">
                          {formatVES(shift.totalVendidoVES)}
                        </strong>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono">
                          Efec. USD: {formatUSD(shift.ventasEfectivoUSD)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-mono">
                          Efec. VES: {formatVES(shift.ventasEfectivoVES)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono">
                          Pago Móvil: {formatVES(shift.ventasPagoMovilVES)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 font-mono">
                          Punto: {formatVES(shift.ventasPuntoVentaVES)}
                        </span>
                        {shift.ventasZelleUSD > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-mono">
                            Zelle: {formatUSD(shift.ventasZelleUSD)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arqueo y Cierre */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="text-[11px] text-slate-500">
                        <span>Fondo Inicial: </span>
                        <strong className="text-slate-800 font-mono">
                          {formatUSD(shift.fondoInicialUSD)} / {formatVES(shift.fondoInicialVES)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => exportCashShiftToExcel(shift)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Descargar Arqueo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Apertura de Turno de Caja */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Apertura de Caja & Turno
                </h3>
                <InfoHelpButton
                  topicKey="apertura_caja"
                  onOpenHelp={setHelpTopic}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Ingresa los fondos de cambio iniciales disponibles en caja en Dólares y Bolívares.
            </p>

            <form onSubmit={handleConfirmOpen} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cajero Responsable
                </label>
                <input
                  type="text"
                  value={currentUser.nombre}
                  disabled
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fondo Inicial (REF / USD)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={fondoInicialUSD}
                    onChange={(e) => setFondoInicialUSD(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fondo Inicial VES (Bs.)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={fondoInicialVES}
                    onChange={(e) => setFondoInicialVES(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                Tasa de cambio oficial del turno: <strong>{formatVES(bcvRate)} / USD</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Arqueo Físico & Cierre de Caja */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Arqueo de Caja & Cierre de Turno
                </h3>
                <InfoHelpButton
                  topicKey="arqueo_cierre"
                  onOpenHelp={setHelpTopic}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Realiza el conteo físico de billetes y compáralo con el saldo esperado en sistema.
            </p>

            <form onSubmit={handleConfirmClose} className="space-y-4">
              {/* Comparativo USD */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase block">
                    Arqueo en Dólares Efectivo (USD)
                  </span>
                  <InfoHelpButton
                    topicKey="diferencia_arqueo"
                    onOpenHelp={setHelpTopic}
                    label="¿Cómo cuadrar?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Saldo Esperado en Sistema:</span>
                    <div className="text-sm font-bold text-slate-900">
                      {formatUSD(activeShift.fondoInicialUSD + activeShift.ventasEfectivoUSD)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Conteo Físico Contado (REF):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={arqueoUSD}
                      onChange={(e) => setArqueoUSD(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600">Diferencia USD:</span>
                  <span
                    className={`font-bold ${
                      arqueoUSD - (activeShift.fondoInicialUSD + activeShift.ventasEfectivoUSD) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {formatUSD(
                      arqueoUSD - (activeShift.fondoInicialUSD + activeShift.ventasEfectivoUSD)
                    )}
                  </span>
                </div>
              </div>

              {/* Comparativo VES */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase block">
                    Arqueo en Bolívares Efectivo (VES)
                  </span>
                  <InfoHelpButton
                    topicKey="diferencia_arqueo"
                    onOpenHelp={setHelpTopic}
                    label="¿Cómo cuadrar?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Saldo Esperado en Sistema:</span>
                    <div className="text-sm font-bold text-slate-900">
                      {formatVES(activeShift.fondoInicialVES + activeShift.ventasEfectivoVES)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Conteo Físico Contado (Bs.):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={arqueoVES}
                      onChange={(e) => setArqueoVES(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600">Diferencia VES:</span>
                  <span
                    className={`font-bold ${
                      arqueoVES - (activeShift.fondoInicialVES + activeShift.ventasEfectivoVES) >= 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {formatVES(
                      arqueoVES - (activeShift.fondoInicialVES + activeShift.ventasEfectivoVES)
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observaciones de Cierre de Caja
                </label>
                <textarea
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  placeholder="Sin novedades, sobrante justificado por cambio, etc."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Cerrar Caja Definitivamente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Anulación de Nota de Venta (Solo Admin) */}
      {saleToCancel && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Anular Nota de Entrega</h3>
              </div>
              <InfoHelpButton
                topicKey="anular_nota"
                onOpenHelp={setHelpTopic}
              />
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Al anular la nota <strong className="font-mono">{saleToCancel.numeroNota}</strong> por{' '}
              {formatUSD(saleToCancel.totalUSD)}, las unidades vendidas se reintegrarán automáticamente
              al stock de inventario.
            </p>

            <form onSubmit={handleConfirmCancelSale} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo obligatorio de anulación
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="ej. Error en método de pago ingresado, devolución del cliente por mercancía dañada"
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToCancel(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Confirmar Anulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Nota de Entrega */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Comprobante {selectedSaleDetail.numeroNota}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {new Date(selectedSaleDetail.fecha).toLocaleString('es-VE')} • Cajero:{' '}
                  {selectedSaleDetail.cajeroNombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <strong className="text-slate-900">{selectedSaleDetail.clienteNombre}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Documento / Cédula:</span>
                  <span className="font-mono text-slate-700">{selectedSaleDetail.clienteDocumento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tasa BCV Aplicada:</span>
                  <span className="font-mono text-indigo-700 font-bold">
                    {formatVES(selectedSaleDetail.tasaBCV)}
                  </span>
                </div>
              </div>

              {/* Items Vendidos */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Artículos Despachados ({selectedSaleDetail.items?.length || 0})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Total: {selectedSaleDetail.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0} unid.
                  </span>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {selectedSaleDetail.items && selectedSaleDetail.items.length > 0 ? (
                    selectedSaleDetail.items.map((it, idx) => {
                      const itemName =
                        it.nombre ||
                        (it as any).productoNombre ||
                        (it as any).nombre_producto ||
                        products?.find((p) => p.id === it.productoId || p.codigoBarras === it.codigoBarras)?.nombre ||
                        `Artículo #${idx + 1}`;

                      return (
                        <div key={idx} className="p-3 bg-white hover:bg-slate-50/50 transition-colors flex justify-between items-center text-xs gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                              <span>{itemName}</span>
                              {it.clasificacion === 'exento' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  Exento
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                              {it.codigoBarras && (
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  {it.codigoBarras}
                                </span>
                              )}
                              <span className="font-semibold text-slate-700 font-mono">
                                {it.cantidad} {it.cantidad === 1 ? 'unidad' : 'unidades'} × {formatUSD(it.precioUnitarioUSD)}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-indigo-700 font-mono font-medium">
                                {formatVES(it.precioUnitarioVES || usdToVes(it.precioUnitarioUSD, selectedSaleDetail.tasaBCV))}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="font-black text-slate-900 text-sm">
                              {formatUSD(it.subtotalUSD)}
                            </div>
                            <div className="text-[11px] font-semibold text-indigo-700">
                              {formatVES(it.subtotalVES || usdToVes(it.subtotalUSD, selectedSaleDetail.tasaBCV))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      No se encontraron artículos registrados para esta nota.
                    </div>
                  )}
                </div>
              </div>

              {/* Métodos de Pago Aplicados */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Desglose de Formas de Pago
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {selectedSaleDetail.pagos.map((p, idx) => (
                    <div key={idx} className="p-2.5 bg-white flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{p.nombreMetodo}</div>
                        {p.referencia && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {p.referencia}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono font-bold text-indigo-700">
                        {p.moneda === 'USD' ? formatUSD(p.montoOriginal) : formatVES(p.montoOriginal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Total en Divisas:</span>
                  <strong className="font-mono text-white text-sm">
                    {formatUSD(selectedSaleDetail.totalUSD)}
                  </strong>
                </div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Total en Bolívares:</span>
                  <strong className="font-mono text-emerald-400 text-sm">
                    {formatVES(selectedSaleDetail.totalVES)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => generateSaleNotePDF(selectedSaleDetail)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Flotante de Explicación de Acciones Clave */}
      <ActionHelpModal
        isOpen={Boolean(helpTopic)}
        onClose={() => setHelpTopic(null)}
        topicKey={helpTopic}
      />

      {/* Modal Informativo y Guía Contable del Balance por Método */}
      <BalanceMethodInfoModal
        isOpen={showBalanceMethodInfoModal}
        onClose={() => setShowBalanceMethodInfoModal(false)}
        bcvRate={bcvRate}
      />

      {/* Modal de Cobro de Resto / Abono a Caja */}
      <CashDebtCollectionModal
        isOpen={Boolean(selectedCxCToPay)}
        cxc={selectedCxCToPay}
        bcvRate={bcvRate}
        activeShift={activeShift}
        onClose={() => setSelectedCxCToPay(null)}
        onConfirmPayment={(cxcId, amountUSD, method, ref, amountVES) => {
          if (onAddAbonoCxC) {
            onAddAbonoCxC(cxcId, amountUSD, method, ref, amountVES);
          }
        }}
      />
    </div>
  );
};
