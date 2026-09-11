import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Users,
  Building,
  Plus,
  FileSpreadsheet,
  Download,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CreditCard,
  Filter,
} from 'lucide-react';
import { Expense, AccountReceivable, AccountPayable, SaleNote, User, PaymentMethodType } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';
import { exportFinanceToExcel } from '../services/exportService';
import { generateUUID } from '../services/uuidUtils';

interface FinanceModuleProps {
  expenses: Expense[];
  cxc: AccountReceivable[];
  cxp: AccountPayable[];
  sales: SaleNote[];
  currentUser: User;
  bcvRate: number;
  onAddExpense: (exp: Expense) => void;
  onAddAbonoCxC: (
    cxcId: string,
    amountUSD: number,
    method: PaymentMethodType,
    ref?: string,
    amountVES?: number
  ) => void;
  onAddAbonoCxP: (cxpId: string, amountUSD: number, method: PaymentMethodType, ref?: string) => void;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  expenses,
  cxc,
  cxp,
  sales,
  currentUser,
  bcvRate,
  onAddExpense,
  onAddAbonoCxC,
  onAddAbonoCxP,
}) => {
  const [activeTab, setActiveTab] = useState<'utilidad' | 'gastos' | 'cxc' | 'cxp'>('utilidad');

  // Modal Registrar Gasto
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<Expense['categoria']>('operativo');
  const [montoUSD, setMontoUSD] = useState<number>(10);
  const [metodoPago, setMetodoPago] = useState<PaymentMethodType>('efectivo_usd');
  const [comprobanteRef, setComprobanteRef] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Modal Abonar CxC / CxP
  const [selectedCxC, setSelectedCxC] = useState<AccountReceivable | null>(null);
  const [selectedCxP, setSelectedCxP] = useState<AccountPayable | null>(null);
  const [abonoMontoUSD, setAbonoMontoUSD] = useState<number>(0);
  const [abonoMontoVES, setAbonoMontoVES] = useState<number>(0);
  const [abonoMetodo, setAbonoMetodo] = useState<PaymentMethodType>('pago_movil');
  const [abonoRef, setAbonoRef] = useState('');

  // --- FILTROS DE FECHA PARA FINANZAS Y REPORTES ---
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFilterMode, setDateFilterMode] = useState<
    'hoy' | 'ayer' | '7dias' | 'mes' | 'mes_anterior' | 'ano' | 'todos' | 'personalizado'
  >('mes');

  // Inicializar al primer día del mes actual hasta hoy
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

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

  // Filtrar ventas por rango de fecha
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = s.fecha.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [sales, startDate, endDate]);

  // Filtrar gastos por rango de fecha
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const d = e.fecha.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // Cálculos de Rentabilidad y Utilidad Real Filtrados por Fecha
  const validSales = useMemo(() => filteredSales.filter((s) => s.estado === 'completada'), [filteredSales]);
  const totalIngresosUSD = useMemo(() => validSales.reduce((sum, s) => sum + s.totalUSD, 0), [validSales]);
  const totalCostoMercanciaUSD = useMemo(() => validSales.reduce((sum, s) => sum + s.costoTotalUSD, 0), [validSales]);
  const utilidadBrutaUSD = totalIngresosUSD - totalCostoMercanciaUSD;

  const totalGastosOperativosUSD = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.categoria === 'operativo' || e.categoria === 'mantenimiento' || e.categoria === 'servicios')
      .reduce((sum, e) => sum + e.montoUSD, 0);
  }, [filteredExpenses]);

  const totalGastosAdminUSD = useMemo(() => {
    return filteredExpenses
      .filter((e) => e.categoria === 'administrativo' || e.categoria === 'nomina' || e.categoria === 'otro')
      .reduce((sum, e) => sum + e.montoUSD, 0);
  }, [filteredExpenses]);

  const totalGastosGeneralUSD = totalGastosOperativosUSD + totalGastosAdminUSD;
  const utilidadNetaUSD = utilidadBrutaUSD - totalGastosGeneralUSD;
  const margenNetoPorcentaje = totalIngresosUSD > 0 ? (utilidadNetaUSD / totalIngresosUSD) * 100 : 0;

  // Cuentas Corrientes Totales (saldo acumulado)
  const totalCxCPendienteUSD = cxc.reduce((sum, c) => sum + c.saldoPendienteUSD, 0);
  const totalCxPPendienteUSD = cxp.reduce((sum, p) => sum + p.saldoPendienteUSD, 0);

  // Manejar Exportación a Excel con filtro de fecha
  const handleExportExcel = () => {
    let dateLabel = '';
    if (dateFilterMode === 'hoy') dateLabel = `Hoy (${todayStr})`;
    else if (dateFilterMode === 'ayer') dateLabel = 'Ayer';
    else if (dateFilterMode === '7dias') dateLabel = 'Últimos 7 días';
    else if (dateFilterMode === 'mes') dateLabel = 'Este Mes';
    else if (dateFilterMode === 'mes_anterior') dateLabel = 'Mes Anterior';
    else if (dateFilterMode === 'ano') dateLabel = 'Este Año';
    else if (dateFilterMode === 'todos') dateLabel = 'Todo el Historial';
    else dateLabel = `${startDate} a ${endDate}`;

    exportFinanceToExcel({
      expenses: filteredExpenses,
      cxc,
      cxp,
      dateFilterLabel: dateLabel,
      startDate,
      endDate,
    });
  };

  // Registrar Gasto
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concepto.trim() || montoUSD <= 0) return;

    const newExp: Expense = {
      id: generateUUID(),
      concepto: concepto.trim(),
      categoria,
      montoUSD,
      montoVES: usdToVes(montoUSD, bcvRate),
      tasaBCV: bcvRate,
      metodoPago,
      fecha: new Date().toISOString(),
      usuarioId: currentUser.id,
      usuarioNombre: currentUser.nombre,
      comprobanteRef: comprobanteRef.trim(),
      observaciones: observaciones.trim(),
    };

    onAddExpense(newExp);
    setShowExpenseModal(false);
    setConcepto('');
    setMontoUSD(10);
    setComprobanteRef('');
    setObservaciones('');
  };

  // Confirmar abono CxC
  const handleConfirmAbonoCxC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCxC) return;
    if (selectedCxC.monedaFijada === 'VES') {
      if (abonoMontoVES <= 0) return;
      onAddAbonoCxC(
        selectedCxC.id,
        abonoMontoVES / bcvRate,
        abonoMetodo,
        abonoRef,
        abonoMontoVES
      );
    } else {
      if (abonoMontoUSD <= 0) return;
      onAddAbonoCxC(selectedCxC.id, abonoMontoUSD, abonoMetodo, abonoRef);
    }
    setSelectedCxC(null);
  };

  // Confirmar abono CxP
  const handleConfirmAbonoCxP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCxP || abonoMontoUSD <= 0) return;
    onAddAbonoCxP(selectedCxP.id, abonoMontoUSD, abonoMetodo, abonoRef);
    setSelectedCxP(null);
  };

  return (
    <div id="finance-module-root" className="space-y-4">
      {/* Tarjetas Superiores de Balance Financiero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Ingresos Brutos
          </span>
          <div className="text-xl font-black text-gray-900 mt-1">
            {formatUSD(totalIngresosUSD)}
          </div>
          <span className="text-[11px] text-gray-400">
            {formatVES(totalIngresosUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Total Egresos & Gastos
          </span>
          <div className="text-xl font-black text-rose-600 mt-1">
            {formatUSD(totalGastosGeneralUSD)}
          </div>
          <span className="text-[11px] text-gray-400">
            {formatVES(totalGastosGeneralUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Utilidad Neta Real
          </span>
          <div
            className={`text-xl font-black mt-1 ${
              utilidadNetaUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatUSD(utilidadNetaUSD)}
          </div>
          <span className="text-[11px] font-medium text-emerald-700">
            Margen: {margenNetoPorcentaje.toFixed(1)}%
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Cuentas Corrientes
          </span>
          <div className="text-xs font-bold text-gray-900 mt-1">
            Por Cobrar: <span className="text-blue-600">{formatUSD(totalCxCPendienteUSD)}</span>
          </div>
          <div className="text-xs font-bold text-gray-900">
            Por Pagar: <span className="text-amber-600">{formatUSD(totalCxPPendienteUSD)}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Fechas para Finanzas */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 mr-2 text-xs font-bold text-gray-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Período:</span>
          </div>

          <button
            type="button"
            onClick={() => handleSelectDateFilter('hoy')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'hoy'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('ayer')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'ayer'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('7dias')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === '7dias'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            7 días
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('mes')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'mes'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Este Mes
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('mes_anterior')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'mes_anterior'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Mes Anterior
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('ano')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'ano'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Este Año
          </button>
          <button
            type="button"
            onClick={() => handleSelectDateFilter('todos')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              dateFilterMode === 'todos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todo
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 font-medium">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateFilterMode('personalizado');
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 font-medium">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateFilterMode('personalizado');
              }}
              className="px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ml-auto sm:ml-0"
            title="Exportar finanzas a Excel con filtro de fecha activo"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Excel ({startDate === endDate ? startDate : `${startDate} al ${endDate}`})</span>
          </button>
        </div>
      </div>

      {/* Tabs y Acciones */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('utilidad')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'utilidad'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Estado de Resultados (P&L)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gastos')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'gastos'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Egresos & Gastos ({filteredExpenses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cxc')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'cxc'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Cobrar (CxC)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cxp')}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'cxp'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Por Pagar (CxP)
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar finanzas a Excel con filtro de fecha activo"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* Vista 1: Estado de Resultados / P&L de Rentabilidad Real */}
      {activeTab === 'utilidad' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs max-w-4xl mx-auto space-y-5">
          <div className="border-b border-gray-200 pb-3">
            <h3 className="text-base font-bold text-gray-900">
              Estado de Resultados & Rentabilidad Operativa
            </h3>
            <p className="text-xs text-gray-500">
              Cálculo detallado de utilidad bruta, deducción de costos de adquisición y gastos operativos.
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between p-3 bg-slate-50 rounded-lg font-bold text-sm text-gray-900">
              <span>(+) Ingresos Totales por Ventas</span>
              <span>{formatUSD(totalIngresosUSD)}</span>
            </div>

            <div className="flex justify-between px-3 text-rose-700">
              <span>(-) Costo de Mercancía Vendida (Costo de adquisición)</span>
              <span>-{formatUSD(totalCostoMercanciaUSD)}</span>
            </div>

            <div className="flex justify-between p-3 bg-blue-50 text-blue-950 font-bold rounded-lg">
              <span>(=) UTILIDAD BRUTA OPERATIVA</span>
              <span>{formatUSD(utilidadBrutaUSD)}</span>
            </div>

            <div className="pl-4 space-y-1.5 text-gray-600">
              <div className="flex justify-between px-3">
                <span>(-) Gastos Operativos, Servicios y Fletes</span>
                <span>-{formatUSD(totalGastosOperativosUSD)}</span>
              </div>
              <div className="flex justify-between px-3">
                <span>(-) Gastos Administrativos y Nómina</span>
                <span>-{formatUSD(totalGastosAdminUSD)}</span>
              </div>
            </div>

            <div className="flex justify-between p-4 bg-slate-900 text-white font-extrabold text-sm rounded-xl">
              <div>
                <div>(=) UTILIDAD NETA DEL PERÍODO</div>
                <div className="text-[11px] font-normal text-slate-300">
                  Equivalente en Bolívares: {formatVES(utilidadNetaUSD * bcvRate)}
                </div>
              </div>
              <div className="text-lg text-emerald-400">
                {formatUSD(utilidadNetaUSD)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vista 2: Lista de Gastos */}
      {activeTab === 'gastos' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500 space-y-2">
              <Calendar className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-xs font-semibold text-gray-700">
                No hay egresos o gastos registrados en el período seleccionado.
              </p>
              <p className="text-[11px] text-gray-500">
                Rango activo: {startDate} al {endDate}
              </p>
              <button
                type="button"
                onClick={() => handleSelectDateFilter('todos')}
                className="mt-2 text-xs text-blue-600 font-bold hover:underline inline-block cursor-pointer"
              >
                Ver todo el historial de gastos
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-3 py-3">Categoría</th>
                  <th className="px-3 py-3 text-right">Monto (USD)</th>
                  <th className="px-3 py-3 text-right">Monto (VES)</th>
                  <th className="px-3 py-3">Método Pago</th>
                  <th className="px-4 py-3">Registrado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">
                      {new Date(exp.fecha).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {exp.concepto}
                      {exp.comprobanteRef && (
                        <span className="block text-[10px] text-gray-400 font-mono">
                          Ref: {exp.comprobanteRef}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-[10px] uppercase font-bold text-gray-700">
                        {exp.categoria}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-rose-600">
                      {formatUSD(exp.montoUSD)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-600">
                      {formatVES(exp.montoVES)}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-700 capitalize">
                      {exp.metodoPago.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{exp.usuarioNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Vista 3: Cuentas por Cobrar (CxC) */}
      {activeTab === 'cxc' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-3 py-3">Documento</th>
                <th className="px-3 py-3">Modalidad</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3 text-right">Monto Total</th>
                <th className="px-3 py-3 text-right">Abonado</th>
                <th className="px-3 py-3 text-right">Saldo Pendiente</th>
                <th className="px-3 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cxc.map((item) => {
                const isFixedVES = item.monedaFijada === 'VES';
                const totalDisplay = isFixedVES && item.montoTotalVES !== undefined
                  ? `Bs. ${item.montoTotalVES.toFixed(2)}`
                  : formatUSD(item.montoTotalUSD);
                const abonadoDisplay = isFixedVES && item.montoAbonadoVES !== undefined
                  ? `Bs. ${item.montoAbonadoVES.toFixed(2)}`
                  : formatUSD(item.montoAbonadoUSD);
                const pendienteDisplay = isFixedVES && item.saldoPendienteVES !== undefined
                  ? `Bs. ${item.saldoPendienteVES.toFixed(2)}`
                  : formatUSD(item.saldoPendienteUSD);
                const hasPending = isFixedVES
                  ? (item.saldoPendienteVES ?? 0) > 0.05
                  : item.saldoPendienteUSD > 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-gray-900">{item.clienteNombre}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-gray-500">
                      {item.clienteDocumento}
                    </td>
                    <td className="px-3 py-3">
                      {isFixedVES ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          Pagar Luego (Fijado Bs)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700">
                          Estándar (REF)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{item.fechaVencimiento}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">
                      {totalDisplay}
                      {isFixedVES && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {formatUSD(item.montoTotalUSD)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-600 font-semibold">
                      {abonadoDisplay}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-indigo-700">
                      {pendienteDisplay}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.estado === 'pagada'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.estado === 'parcial'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasPending && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCxC(item);
                            if (isFixedVES) {
                              setAbonoMontoVES(item.saldoPendienteVES ?? (item.saldoPendienteUSD * bcvRate));
                              setAbonoMontoUSD(item.saldoPendienteUSD);
                            } else {
                              setAbonoMontoUSD(item.saldoPendienteUSD);
                              setAbonoMontoVES(item.saldoPendienteUSD * bcvRate);
                            }
                            setAbonoRef('');
                          }}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
                        >
                          Abonar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista 4: Cuentas por Pagar (CxP) */}
      {activeTab === 'cxp' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-3 py-3">RIF</th>
                <th className="px-3 py-3">Factura / Ref</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3 text-right">Total (REF)</th>
                <th className="px-3 py-3 text-right">Abonado (REF)</th>
                <th className="px-3 py-3 text-right">Saldo Deuda</th>
                <th className="px-3 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cxp.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-gray-900">{item.proveedorNombre}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-gray-500">
                    {item.proveedorRif}
                  </td>
                  <td className="px-3 py-3 font-mono">{item.numeroFacturaProvedor}</td>
                  <td className="px-3 py-3 text-gray-600">{item.fechaVencimiento}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatUSD(item.montoTotalUSD)}</td>
                  <td className="px-3 py-3 text-right text-emerald-600 font-medium">
                    {formatUSD(item.montoAbonadoUSD)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-rose-600">
                    {formatUSD(item.saldoPendienteUSD)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.estado === 'pagada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.saldoPendienteUSD > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCxP(item);
                          setAbonoMontoUSD(item.saldoPendienteUSD);
                          setAbonoRef('');
                        }}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-md"
                      >
                        Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Registrar Gasto */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">Registrar Egreso o Gasto</h3>
            <p className="text-xs text-gray-500 mb-4">
              Clasifica gastos operativos o administrativos para calcular la utilidad neta real.
            </p>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Concepto del Gasto
                </label>
                <input
                  type="text"
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="ej. Pago de alquiler local, Flete transporte, Rollos de papel"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="operativo">Operativo</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="servicios">Servicios Básicos</option>
                    <option value="nomina">Nómina / Personal</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Monto en Divisas (REF)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={montoUSD}
                    onChange={(e) => setMontoUSD(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs font-bold border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as PaymentMethodType)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="efectivo_usd">Efectivo USD</option>
                    <option value="efectivo_ves">Efectivo Bolívares</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="zelle">Zelle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Comprobante / Ref
                  </label>
                  <input
                    type="text"
                    value={comprobanteRef}
                    onChange={(e) => setComprobanteRef(e.target.value)}
                    placeholder="Nro Factura o REF"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg text-xs text-gray-600 flex justify-between">
                <span>Equivalente en Bolívares (BCV):</span>
                <strong className="text-gray-900">{formatVES(usdToVes(montoUSD, bcvRate))}</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abonar CxC */}
      {selectedCxC && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">Registrar Abono de Cliente</h3>
            <p className="text-xs text-gray-500 mb-3">
              Cliente: <strong>{selectedCxC.clienteNombre}</strong> ({selectedCxC.clienteDocumento})
            </p>

            {selectedCxC.monedaFijada === 'VES' ? (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                    Deuda Fijada en Bolívares
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-950">
                    Bs. {(selectedCxC.saldoPendienteVES ?? 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  Monto congelado en Bolívares: El cobro se realiza en Bolívares exactos sin recálculo diario por tasa de dólar.
                </p>
                <div className="mt-2 pt-2 border-t border-amber-200/60 flex justify-between text-[11px] text-amber-900 font-mono">
                  <span>Total venta: Bs. {(selectedCxC.montoTotalVES ?? 0).toFixed(2)}</span>
                  <span>Abonado: Bs. {(selectedCxC.montoAbonadoVES ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex justify-between text-xs font-bold text-slate-800">
                  <span>Saldo Pendiente USD:</span>
                  <span className="font-mono text-indigo-700">{formatUSD(selectedCxC.saldoPendienteUSD)}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmAbonoCxC} className="space-y-3">
              {selectedCxC.monedaFijada === 'VES' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Monto a Abonar en Bolívares (VES)
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setAbonoMontoVES(selectedCxC.saldoPendienteVES ?? 0)}
                        className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded cursor-pointer"
                      >
                        Pagar Todo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAbonoMontoVES(
                            Math.round(((selectedCxC.saldoPendienteVES ?? 0) / 2) * 100) / 100
                          )
                        }
                        className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                      >
                        50%
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-500">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedCxC.saldoPendienteVES}
                      value={abonoMontoVES}
                      onChange={(e) => setAbonoMontoVES(parseFloat(e.target.value) || 0)}
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                      required
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>Resta después del abono:</span>
                    <span className="font-bold text-slate-900">
                      Bs. {Math.max(0, (selectedCxC.saldoPendienteVES ?? 0) - abonoMontoVES).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Monto a Abonar (REF)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedCxC.saldoPendienteUSD}
                    value={abonoMontoUSD}
                    onChange={(e) => setAbonoMontoUSD(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm font-bold border border-gray-300 rounded-lg font-mono"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={abonoMetodo}
                  onChange={(e) => {
                    const m = e.target.value as PaymentMethodType;
                    setAbonoMetodo(m);
                    if (m === 'efectivo_ves' || m === 'efectivo_usd') {
                      setAbonoRef('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                >
                  <option value="pago_movil">Pago Móvil (VES)</option>
                  <option value="efectivo_ves">Efectivo Bolívares (VES)</option>
                  <option value="punto_venta">Punto de Venta (VES)</option>
                  <option value="transferencia">Transferencia Bancaria (VES)</option>
                  <option value="efectivo_usd">Efectivo Divisas (USD)</option>
                  <option value="zelle">Zelle (USD)</option>
                </select>
              </div>

              {abonoMetodo !== 'efectivo_ves' && abonoMetodo !== 'efectivo_usd' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Referencia Bancaria / Comprobante
                  </label>
                  <input
                    type="text"
                    value={abonoRef}
                    onChange={(e) => setAbonoRef(e.target.value)}
                    placeholder="ej. PM-99120"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCxC(null)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs cursor-pointer transition-colors"
                >
                  Confirmar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagar CxP */}
      {selectedCxP && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">Registrar Pago a Proveedor</h3>
            <p className="text-xs text-gray-500 mb-4">
              Proveedor: <strong>{selectedCxP.proveedorNombre}</strong> (Saldo deuda:{' '}
              {formatUSD(selectedCxP.saldoPendienteUSD)})
            </p>

            <form onSubmit={handleConfirmAbonoCxP} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Monto a Pagar (REF)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedCxP.saldoPendienteUSD}
                  value={abonoMontoUSD}
                  onChange={(e) => setAbonoMontoUSD(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-bold border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={abonoMetodo}
                  onChange={(e) => {
                    const m = e.target.value as PaymentMethodType;
                    setAbonoMetodo(m);
                    if (m === 'efectivo_usd' || m === 'efectivo_ves') {
                      setAbonoRef('');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>

              {abonoMetodo !== 'efectivo_usd' && abonoMetodo !== 'efectivo_ves' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Referencia de Pago
                  </label>
                  <input
                    type="text"
                    value={abonoRef}
                    onChange={(e) => setAbonoRef(e.target.value)}
                    placeholder="ej. TRANSF-09124"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCxP(null)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
