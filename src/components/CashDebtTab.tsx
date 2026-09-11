import React, { useState, useMemo } from 'react';
import {
  Coins,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  FileText,
  Eye,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Receipt,
  Phone,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { AccountReceivable, SaleNote, CashShift } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';

interface CashDebtTabProps {
  cxcList: AccountReceivable[];
  sales: SaleNote[];
  bcvRate: number;
  activeShift: CashShift | null;
  onOpenPayModal: (cxc: AccountReceivable) => void;
  onViewSaleDetail?: (sale: SaleNote) => void;
}

export const CashDebtTab: React.FC<CashDebtTabProps> = ({
  cxcList,
  sales,
  bcvRate,
  activeShift,
  onOpenPayModal,
  onViewSaleDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pendientes' | 'todos' | 'pagadas'>('pendientes');
  const [sortBy, setSortBy] = useState<'fecha_desc' | 'deuda_desc' | 'cliente_asc'>('deuda_desc');

  // Calcular métricas de resumen
  const summary = useMemo(() => {
    let totalDeudaUSD = 0;
    let totalDeudaVES = 0;
    let totalAbonadoUSD = 0;
    let totalAbonadoVES = 0;
    let totalOriginalUSD = 0;
    let totalOriginalVES = 0;
    let countPendientes = 0;
    let countPagadas = 0;

    cxcList.forEach((item) => {
      const isFixedVES = item.monedaFijada === 'VES';
      const itemDeudaVES = item.saldoPendienteVES !== undefined && item.saldoPendienteVES > 0
        ? item.saldoPendienteVES
        : usdToVes(item.saldoPendienteUSD, bcvRate);
      const itemDeudaUSD = isFixedVES ? itemDeudaVES / bcvRate : item.saldoPendienteUSD;

      const itemAbonadoVES = item.montoAbonadoVES !== undefined
        ? item.montoAbonadoVES
        : usdToVes(item.montoAbonadoUSD, bcvRate);
      const itemAbonadoUSD = isFixedVES ? itemAbonadoVES / bcvRate : item.montoAbonadoUSD;

      const itemTotalVES = item.montoTotalVES ?? usdToVes(item.montoTotalUSD, bcvRate);
      const itemTotalUSD = item.montoTotalUSD;

      totalOriginalUSD += itemTotalUSD;
      totalOriginalVES += itemTotalVES;
      totalAbonadoUSD += itemAbonadoUSD;
      totalAbonadoVES += itemAbonadoVES;

      const hasDebt = isFixedVES ? itemDeudaVES > 0.05 : itemDeudaUSD > 0.01;
      if (hasDebt && item.estado !== 'pagada') {
        totalDeudaUSD += itemDeudaUSD;
        totalDeudaVES += itemDeudaVES;
        countPendientes++;
      } else {
        countPagadas++;
      }
    });

    return {
      totalDeudaUSD,
      totalDeudaVES,
      totalAbonadoUSD,
      totalAbonadoVES,
      totalOriginalUSD,
      totalOriginalVES,
      countPendientes,
      countPagadas,
      countTotal: cxcList.length,
    };
  }, [cxcList, bcvRate]);

  // Filtrado y ordenamiento de clientes con deuda
  const filteredList = useMemo(() => {
    return cxcList
      .filter((item) => {
        const isFixedVES = item.monedaFijada === 'VES';
        const itemDeudaVES = item.saldoPendienteVES !== undefined && item.saldoPendienteVES > 0
          ? item.saldoPendienteVES
          : usdToVes(item.saldoPendienteUSD, bcvRate);
        const itemDeudaUSD = isFixedVES ? itemDeudaVES / bcvRate : item.saldoPendienteUSD;
        const hasDebt = isFixedVES ? itemDeudaVES > 0.05 : itemDeudaUSD > 0.01;

        // Filtro de estado
        if (statusFilter === 'pendientes' && (!hasDebt || item.estado === 'pagada')) return false;
        if (statusFilter === 'pagadas' && (hasDebt && item.estado !== 'pagada')) return false;

        // Filtro de búsqueda
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchClient = item.clienteNombre.toLowerCase().includes(q);
          const matchDoc = item.clienteDocumento.toLowerCase().includes(q);
          const matchNote = item.notaVentaId.toLowerCase().includes(q);
          const matchPhone = item.clienteTelefono?.toLowerCase().includes(q);
          if (!matchClient && !matchDoc && !matchNote && !matchPhone) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'fecha_desc') {
          return new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime();
        }
        if (sortBy === 'cliente_asc') {
          return a.clienteNombre.localeCompare(b.clienteNombre);
        }
        // Por defecto: deuda_desc
        const deudaA = a.saldoPendienteVES ?? usdToVes(a.saldoPendienteUSD, bcvRate);
        const deudaB = b.saldoPendienteVES ?? usdToVes(b.saldoPendienteUSD, bcvRate);
        return deudaB - deudaA;
      });
  }, [cxcList, statusFilter, searchTerm, sortBy, bcvRate]);

  // Buscar la nota de venta correspondiente si el usuario desea ver el detalle completo
  const handleViewSale = (notaId: string) => {
    if (!onViewSaleDetail) return;
    const foundSale = sales.find((s) => s.id === notaId || s.numeroNota === notaId);
    if (foundSale) {
      onViewSaleDetail(foundSale);
    }
  };

  return (
    <div className="space-y-4">
      {/* TARJETA INFORMATIVA PRINCIPAL */}
      <div className="bg-gradient-to-r from-amber-500/10 via-indigo-50/50 to-emerald-50/20 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <span>Clientes con Deuda & Cobro de Saldo Restante en Caja</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono font-bold">
                  {summary.countPendientes} pendiente{summary.countPendientes !== 1 ? 's' : ''}
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Aquí se detallan todos los clientes que compraron a crédito o tienen saldo pendiente.
                Puedes ver exactamente <strong>cuánto pagó el cliente</strong>, <strong>cuánto debe actualmente</strong>,
                y registrar el pago del <strong>resto del dinero</strong> directamente en tu turno de caja activo.
              </p>
            </div>
          </div>

          {activeShift ? (
            <div className="text-left sm:text-right bg-white/80 border border-slate-200/60 p-2.5 rounded-xl shadow-2xs shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Caja Activa Receptora</span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {activeShift.cajeroNombre}
              </span>
            </div>
          ) : (
            <div className="text-left sm:text-right bg-amber-100/70 border border-amber-300 p-2.5 rounded-xl shadow-2xs shrink-0">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Atención</span>
              <span className="text-xs font-bold text-amber-900">
                Abre caja para registrar abonos
              </span>
            </div>
          )}
        </div>
      </div>

      {/* TARJETAS MÉTRICAS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Deuda Pendiente por Cobrar */}
        <div className="bg-white rounded-2xl border-2 border-amber-400 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Debe Actualmente (Clientes)</span>
            </span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-bold">
              Por Cobrar
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-950 mt-1">
            {formatVES(summary.totalDeudaVES)}
          </div>
          <div className="text-xs font-bold font-mono text-amber-700 mt-0.5">
            Equivalente: {formatUSD(summary.totalDeudaUSD)}
          </div>
          <div className="mt-2.5 pt-2 border-t border-amber-100 text-[11px] text-slate-500 flex justify-between">
            <span>Clientes con deuda:</span>
            <strong className="text-amber-800 font-mono">{summary.countPendientes} clientes</strong>
          </div>
        </div>

        {/* 2. Total Pagado / Abonado hasta la Fecha */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Pagaron los Clientes (Abonos)</span>
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              Recuperado
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
            {formatVES(summary.totalAbonadoVES)}
          </div>
          <div className="text-xs font-bold font-mono text-emerald-700 mt-0.5">
            Equivalente: {formatUSD(summary.totalAbonadoUSD)}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Ingresado a caja:</span>
            <strong className="text-emerald-700 font-mono">100% verificado</strong>
          </div>
        </div>

        {/* 3. Total Facturado en Compras con Crédito */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center justify-between text-indigo-800 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Total Facturado a Crédito</span>
            </span>
            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-bold">
              Total Global
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-950 mt-1">
            {formatVES(summary.totalOriginalVES)}
          </div>
          <div className="text-xs font-bold font-mono text-indigo-700 mt-0.5">
            Equivalente: {formatUSD(summary.totalOriginalUSD)}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Cuentas totales:</span>
            <strong className="text-indigo-800 font-mono">{summary.countTotal} operaciones</strong>
          </div>
        </div>

        {/* 4. Tasa Oficial BCV Actual */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              Tasa Oficial BCV
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              Bs. {bcvRate.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Conversión oficial en tiempo real
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 flex justify-between">
            <span>Cuentas Liquidadas:</span>
            <strong className="text-white font-mono">{summary.countPagadas}</strong>
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador de Texto */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, C.I./RIF, nota (ej. NE-2026-0001) o teléfono..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro de Estado (Pestañas Rápidas) */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('pendientes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'pendientes'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Solo Pendientes ({summary.countPendientes})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'todos'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({summary.countTotal})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pagadas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'pagadas'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Liquidadas ({summary.countPagadas})
            </button>
          </div>

          {/* Selector de Orden */}
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="p-2 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="deuda_desc">Mayor Saldo Deudor</option>
              <option value="fecha_desc">Más Recientes Primero</option>
              <option value="cliente_asc">Nombre de Cliente (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA DE CLIENTES CON DEUDA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              {statusFilter === 'pendientes'
                ? '¡No hay clientes con deuda pendiente!'
                : 'No se encontraron registros que coincidan con la búsqueda'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {statusFilter === 'pendientes'
                ? 'Todas las compras a crédito están 100% liquidadas o no se han emitido créditos en el sistema.'
                : 'Intenta modificar el término de búsqueda o cambia el filtro de estado.'}
            </p>
            {statusFilter === 'pendientes' && summary.countTotal > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>Ver historial de cuentas cobradas ({summary.countPagadas})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3.5">Cliente</th>
                  <th className="px-3 py-3.5">Comprobante</th>
                  <th className="px-3 py-3.5">Fecha Emisión</th>
                  <th className="px-3 py-3.5 text-right">Total Venta</th>
                  <th className="px-3 py-3.5 text-right">Pagó el Cliente</th>
                  <th className="px-3 py-3.5 text-right bg-amber-50/50">Debe Actualmente</th>
                  <th className="px-3 py-3.5 text-center">Estado</th>
                  <th className="px-4 py-3.5 text-center">Acción en Caja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => {
                  const isFixedVES = item.monedaFijada === 'VES';
                  const deudaVES = item.saldoPendienteVES !== undefined && item.saldoPendienteVES > 0
                    ? item.saldoPendienteVES
                    : usdToVes(item.saldoPendienteUSD, bcvRate);
                  const deudaUSD = isFixedVES ? deudaVES / bcvRate : item.saldoPendienteUSD;

                  const abonadoVES = item.montoAbonadoVES !== undefined
                    ? item.montoAbonadoVES
                    : usdToVes(item.montoAbonadoUSD, bcvRate);
                  const abonadoUSD = isFixedVES ? abonadoVES / bcvRate : item.montoAbonadoUSD;

                  const totalVES = item.montoTotalVES ?? usdToVes(item.montoTotalUSD, bcvRate);
                  const totalUSD = item.montoTotalUSD;

                  const isFullyPaid = isFixedVES ? deudaVES <= 0.05 : deudaUSD <= 0.01;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isFullyPaid ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-xs">
                          {item.clienteNombre}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{item.clienteDocumento}</span>
                          {item.clienteTelefono && (
                            <span className="text-slate-400 flex items-center gap-1">
                              • {item.clienteTelefono}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Comprobante */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewSale(item.notaVentaId)}
                          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                          title="Ver comprobante de venta"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{item.notaVentaId}</span>
                        </button>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {isFixedVES ? 'Pagar Luego (Bs)' : 'Ref. Divisas'}
                        </span>
                      </td>

                      {/* Fecha Emisión */}
                      <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap">
                        <div className="font-mono">{item.fechaEmision}</div>
                        {item.fechaVencimiento && (
                          <div className="text-[10px] text-slate-400">
                            Vence: {item.fechaVencimiento}
                          </div>
                        )}
                      </td>

                      {/* Total Venta */}
                      <td className="px-3 py-3.5 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-900">{formatVES(totalVES)}</div>
                        <div className="text-[10px] text-slate-400">{formatUSD(totalUSD)}</div>
                      </td>

                      {/* Pagó el Cliente */}
                      <td className="px-3 py-3.5 text-right font-mono whitespace-nowrap">
                        <div className="font-bold text-emerald-700">
                          {formatVES(abonadoVES)}
                        </div>
                        <div className="text-[10px] text-emerald-600">
                          {formatUSD(abonadoUSD)}
                        </div>
                        {item.abonos.length > 0 && (
                          <div className="text-[9px] text-slate-400">
                            {item.abonos.length} abono{item.abonos.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Debe Actualmente (Destacado) */}
                      <td className="px-3 py-3.5 text-right font-mono whitespace-nowrap bg-amber-50/40">
                        {isFullyPaid ? (
                          <span className="text-[11px] font-bold text-emerald-600">
                            Bs. 0.00 ($0.00)
                          </span>
                        ) : (
                          <div>
                            <div className="font-black text-amber-950 text-sm">
                              {formatVES(deudaVES)}
                            </div>
                            <div className="text-[11px] font-bold text-amber-800">
                              {formatUSD(deudaUSD)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {isFullyPaid ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Liquidada
                          </span>
                        ) : item.abonos.length > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Abono Parcial
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Deuda Total
                          </span>
                        )}
                      </td>

                      {/* Acción en Caja */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {!isFullyPaid ? (
                          <button
                            type="button"
                            onClick={() => onOpenPayModal(item)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-sm cursor-pointer transition-all mx-auto"
                            title="Cobrar saldo restante o recibir abono"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>Cobrar Resto / Abonar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenPayModal(item)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors mx-auto"
                            title="Ver detalles de los abonos recibidos"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ver Pagado</span>
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
      </div>
    </div>
  );
};
