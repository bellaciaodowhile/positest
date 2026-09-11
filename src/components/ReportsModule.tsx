import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  Package,
  Users,
  CreditCard,
  PieChart,
  Filter,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { SaleNote, Expense, Product, User } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';
import {
  exportSalesToExcel,
  generateManagerReportPDF,
} from '../services/exportService';

interface ReportsModuleProps {
  sales: SaleNote[];
  expenses: Expense[];
  products: Product[];
  bcvRate: number;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  sales,
  expenses,
  products,
  bcvRate,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dateFilterMode, setDateFilterMode] = useState<
    'hoy' | 'ayer' | '7dias' | 'mes' | 'mes_anterior' | 'ano' | 'todos' | 'personalizado'
  >('mes');
  
  // Inicializamos en el mes actual para una vista gerencial balanceada
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Manejar cambio de filtros rápidos
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

  // Filtrar ventas por rango de fechas
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const saleDateStr = s.fecha.slice(0, 10);
      return saleDateStr >= startDate && saleDateStr <= endDate;
    });
  }, [sales, startDate, endDate]);

  // Filtrar gastos por rango de fechas
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expDateStr = e.fecha.slice(0, 10);
      return expDateStr >= startDate && expDateStr <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // Ventas completadas (excluye anuladas para cálculos de ingresos)
  const validSales = useMemo(() => {
    return filteredSales.filter((s) => s.estado === 'completada');
  }, [filteredSales]);

  // Métricas Clave Filtradas
  const totalVentasUSD = validSales.reduce((acc, s) => acc + s.totalUSD, 0);
  const totalCostoUSD = validSales.reduce((acc, s) => acc + s.costoTotalUSD, 0);
  const totalUtilidadBrutaUSD = validSales.reduce((acc, s) => acc + s.utilidadBrutaUSD, 0);
  const totalGastosUSD = filteredExpenses.reduce((acc, e) => acc + e.montoUSD, 0);
  const utilidadNetaUSD = totalUtilidadBrutaUSD - totalGastosUSD;
  const margenBrutoPromedio = totalVentasUSD > 0 ? (totalUtilidadBrutaUSD / totalVentasUSD) * 100 : 0;

  // Agrupación: Ventas por Método de Pago en el período
  const ventasPorMetodo = useMemo(() => {
    const map: Record<string, { totalUSD: number; count: number }> = {};
    validSales.forEach((s) => {
      s.pagos.forEach((p) => {
        if (!map[p.nombreMetodo]) {
          map[p.nombreMetodo] = { totalUSD: 0, count: 0 };
        }
        map[p.nombreMetodo].totalUSD += p.montoUSD;
        map[p.nombreMetodo].count += 1;
      });
    });
    return map;
  }, [validSales]);

  // Agrupación: Ventas por Producto (Top Vendidos en el período)
  const topProductos = useMemo(() => {
    const map: Record<
      string,
      { nombre: string; cantidad: number; totalUSD: number; utilidadUSD: number }
    > = {};

    validSales.forEach((s) => {
      s.items.forEach((item) => {
        if (!map[item.productoId]) {
          map[item.productoId] = {
            nombre: item.nombre,
            cantidad: 0,
            totalUSD: 0,
            utilidadUSD: 0,
          };
        }
        map[item.productoId].cantidad += item.cantidad;
        map[item.productoId].totalUSD += item.totalUSD;
        map[item.productoId].utilidadUSD +=
          item.totalUSD - item.costoUnitarioUSD * item.cantidad;
      });
    });

    return Object.values(map).sort((a, b) => b.totalUSD - a.totalUSD);
  }, [validSales]);

  // Agrupación: Ventas por Cajero en el período
  const ventasPorCajero = useMemo(() => {
    const map: Record<string, { totalUSD: number; notasCount: number }> = {};
    validSales.forEach((s) => {
      if (!map[s.cajeroNombre]) {
        map[s.cajeroNombre] = { totalUSD: 0, notasCount: 0 };
      }
      map[s.cajeroNombre].totalUSD += s.totalUSD;
      map[s.cajeroNombre].notasCount += 1;
    });
    return map;
  }, [validSales]);

  // Etiqueta legible del filtro
  const dateFilterLabel = useMemo(() => {
    if (dateFilterMode === 'hoy') return `Hoy (${todayStr})`;
    if (dateFilterMode === 'ayer') return 'Ayer';
    if (dateFilterMode === '7dias') return 'Últimos 7 días';
    if (dateFilterMode === 'mes') return 'Este Mes';
    if (dateFilterMode === 'mes_anterior') return 'Mes Anterior';
    if (dateFilterMode === 'ano') return 'Este Año';
    if (dateFilterMode === 'todos') return 'Todo el Historial';
    return `${startDate} al ${endDate}`;
  }, [dateFilterMode, todayStr, startDate, endDate]);

  const formatDisplayDate = (dStr: string) => {
    if (!dStr || dStr.length < 10) return dStr;
    const [y, m, d] = dStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  // Exportar Ventas a Excel filtradas por fecha
  const handleExportSalesExcel = () => {
    exportSalesToExcel(filteredSales, dateFilterLabel, startDate, endDate);
  };

  // Exportar Reporte PDF formal filtrado por fecha
  const handleExportPDF = () => {
    generateManagerReportPDF({
      startDate: formatDisplayDate(startDate),
      endDate: formatDisplayDate(endDate),
      sales: filteredSales,
      expenses: filteredExpenses,
      bcvRate,
    });
  };

  return (
    <div id="reports-module-root" className="space-y-4">
      {/* Encabezado y Barra de Filtros por Fecha */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Reportes Gerenciales & Control Interno
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Análisis consolidado de márgenes, P&L, cajeros y exportación filtrada a Excel y PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="btn-export-sales-excel-reportes"
              type="button"
              onClick={handleExportSalesExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title={`Exportar ${filteredSales.length} notas a Excel filtradas por fecha`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Ventas Excel</span>
            </button>

            <button
              id="btn-export-manager-pdf-reportes"
              type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title={`Descargar informe gerencial PDF (${formatDisplayDate(startDate)} al ${formatDisplayDate(endDate)})`}
            >
              <Download className="w-4 h-4" />
              <span>Descargar Reporte PDF (A4)</span>
            </button>
          </div>
        </div>

        {/* Panel Interactivo de Filtros de Fecha para Exportación */}
        <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Filtro por Rango de Fechas para Auditoría & Exportación
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 font-mono">
                {formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                {validSales.length} notas • {filteredExpenses.length} gastos
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
            {/* Botones de Rango Rápido */}
            <div className="md:col-span-7 flex flex-wrap gap-1.5">
              {[
                { id: 'hoy', label: 'Hoy' },
                { id: 'ayer', label: 'Ayer' },
                { id: '7dias', label: 'Últimos 7 días' },
                { id: 'mes', label: 'Este Mes' },
                { id: 'mes_anterior', label: 'Mes Anterior' },
                { id: 'ano', label: 'Este Año' },
                { id: 'todos', label: 'Todo el Historial' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectDateFilter(item.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    dateFilterMode === item.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Inputs de Fecha Personalizada */}
            <div className="md:col-span-5 flex items-center gap-2">
              <div className="relative flex-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase absolute left-2.5 top-1">
                  Desde:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateFilterMode('personalizado');
                  }}
                  className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <span className="text-slate-400 font-bold text-xs">-</span>

              <div className="relative flex-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase absolute left-2.5 top-1">
                  Hasta:
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateFilterMode('personalizado');
                  }}
                  className="w-full pl-2.5 pr-2 pt-4 pb-1 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas Ejecutivas Filtradas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            Ventas Totales
          </span>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">
            {formatUSD(totalVentasUSD)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {formatVES(totalVentasUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            Utilidad Bruta
          </span>
          <div className="text-xl font-black text-blue-600 mt-1 font-mono">
            {formatUSD(totalUtilidadBrutaUSD)}
          </div>
          <span className="text-[11px] text-slate-500">
            Margen Bruto: <strong className="text-slate-700">{margenBrutoPromedio.toFixed(1)}%</strong>
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            Gastos Totales ({filteredExpenses.length})
          </span>
          <div className="text-xl font-black text-rose-600 mt-1 font-mono">
            {formatUSD(totalGastosUSD)}
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {formatVES(totalGastosUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            Utilidad Neta del Ejercicio
          </span>
          <div
            className={`text-xl font-black mt-1 font-mono ${
              utilidadNetaUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatUSD(utilidadNetaUSD)}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium font-mono">
            {formatVES(utilidadNetaUSD * bcvRate)}
          </span>
        </div>
      </div>

      {/* Gráficos / Tablas Comparativas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ventas por Método de Pago */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Auditoría de Ventas por Método de Pago
            </h4>
            <span className="text-xs text-slate-400">Canal de cobro ({validSales.length} notas)</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(ventasPorMetodo).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No hay ventas registradas en el período seleccionado.
              </p>
            ) : (
              (
                Object.entries(ventasPorMetodo) as [
                  string,
                  { totalUSD: number; count: number }
                ][]
              ).map(([metodo, data]) => {
                const pct = totalVentasUSD > 0 ? (data.totalUSD / totalVentasUSD) * 100 : 0;
                return (
                  <div key={metodo} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{metodo}</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatUSD(data.totalUSD)}{' '}
                        <span className="text-[10px] text-slate-400 font-sans">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Ventas por Cajero / Turno */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Desempeño & Recaudación por Cajero
            </h4>
            <span className="text-xs text-slate-400">En el período seleccionado</span>
          </div>

          <div className="space-y-3">
            {Object.keys(ventasPorCajero).length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Sin actividad de cajeros en las fechas indicadas.
              </p>
            ) : (
              (
                Object.entries(ventasPorCajero) as [
                  string,
                  { totalUSD: number; notasCount: number }
                ][]
              ).map(([cajero, data]) => (
                <div
                  key={cajero}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{cajero}</div>
                    <div className="text-[11px] text-slate-500">
                      {data.notasCount} notas de venta emitidas
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700 font-mono">
                      {formatUSD(data.totalUSD)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {formatVES(data.totalUSD * bcvRate)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Artículos Más Vendidos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" />
            Ranking de Productos Más Vendidos
          </h4>
          <span className="text-xs text-slate-500">
            {topProductos.length} productos con ventas en el período
          </span>
        </div>

        <div className="overflow-x-auto">
          {topProductos.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No hubo ventas de productos en el rango de fechas seleccionado.
            </p>
          ) : (
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-3 py-3 text-center">Unidades Vendidas</th>
                  <th className="px-3 py-3 text-right">Ingresos Brutos (REF)</th>
                  <th className="px-3 py-3 text-right">Ingresos Bolívares (VES)</th>
                  <th className="px-3 py-3 text-right">Utilidad Generada (REF)</th>
                  <th className="px-3 py-3 text-center">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProductos.map((prod, idx) => {
                  const margenPct = prod.totalUSD > 0 ? (prod.utilidadUSD / prod.totalUSD) * 100 : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{prod.nombre}</td>
                      <td className="px-3 py-3 text-center font-bold text-slate-800 font-mono">
                        {prod.cantidad}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900 font-mono">
                        {formatUSD(prod.totalUSD)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-blue-700 font-mono">
                        {formatVES(prod.totalUSD * bcvRate)}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600 font-mono">
                        {formatUSD(prod.utilidadUSD)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                          {margenPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

