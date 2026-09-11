import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SaleNote, Product, CashShift, Expense, AccountReceivable, AccountPayable } from '../types';
import { formatUSD, formatVES } from './bcvService';

/**
 * Exporta cualquier conjunto de datos a archivo Excel (.xlsx)
 */
export function exportToExcel(sheets: { name: string; data: Record<string, any>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // Max 31 chars por nombre de hoja
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exportar Inventario a Excel
 */
export function exportInventoryToExcel(products: Product[], bcvRate: number) {
  const data = products.map((p) => ({
    'Código de Barras': p.codigoBarras,
    'Producto': p.nombre,
    'Categoría': p.categoria,
    'Clasificación Fiscal': p.clasificacion.toUpperCase(),
    'Costo (USD)': p.costoUSD,
    '% Margen Ganancia': `${p.margenGanancia}%`,
    'Precio Venta (USD)': p.precioUSD,
    'Precio Venta (VES @ BCV)': Number((p.precioUSD * bcvRate).toFixed(2)),
    'Stock Actual': p.stockActual,
    'Stock Mínimo': p.stockMinimo,
    'Unidad': p.unidadMedida,
    'Valoración Inventario (USD)': Number((p.stockActual * p.costoUSD).toFixed(2)),
    'Estado Stock': p.stockActual <= p.stockMinimo ? 'STOCK BAJO / REORDEN' : 'NORMAL',
  }));

  exportToExcel([{ name: 'Inventario y Catálogo', data }], `Inventario_Productos_${new Date().toISOString().slice(0,10)}`);
}

/**
 * Exportar Ventas a Excel con Filtro de Fecha y Resumen Auditor
 */
export function exportSalesToExcel(
  sales: SaleNote[],
  dateFilterLabel?: string,
  startDate?: string,
  endDate?: string
) {
  const completadas = sales.filter((s) => s.estado === 'completada');
  const totalUSD = completadas.reduce((acc, s) => acc + s.totalUSD, 0);
  const totalVES = completadas.reduce((acc, s) => acc + s.totalVES, 0);
  const totalUtilidadUSD = completadas.reduce((acc, s) => acc + s.utilidadBrutaUSD, 0);

  const summaryData = [
    { Parámetro: 'Filtro de Fecha Aplicado', Valor: dateFilterLabel || 'Todo el Historial' },
    { Parámetro: 'Rango de Fechas', Valor: startDate && endDate ? `${startDate} al ${endDate}` : 'Completo' },
    { Parámetro: 'Total de Notas Emitidas', Valor: sales.length },
    { Parámetro: 'Notas Completadas (Válidas)', Valor: completadas.length },
    { Parámetro: 'Notas Anuladas', Valor: sales.length - completadas.length },
    { Parámetro: 'Total Facturado USD (REF)', Valor: Number(totalUSD.toFixed(2)) },
    { Parámetro: 'Total Facturado Bolívares (VES)', Valor: Number(totalVES.toFixed(2)) },
    { Parámetro: 'Utilidad Bruta Estimada (USD)', Valor: Number(totalUtilidadUSD.toFixed(2)) },
    { Parámetro: 'Fecha y Hora de Descarga', Valor: new Date().toLocaleString('es-VE') },
  ];

  const data = sales.map((s) => ({
    'Número Nota': s.numeroNota,
    'Fecha y Hora': new Date(s.fecha).toLocaleString('es-VE'),
    'Cliente': s.clienteNombre,
    'Cédula / RIF': s.clienteDocumento,
    'Cajero': s.cajeroNombre,
    'Estado': s.estado.toUpperCase(),
    'Tasa BCV': s.tasaBCV,
    'Subtotal Exento (USD)': s.subtotalExentoUSD,
    'Subtotal Gravable (USD)': s.subtotalGravableUSD,
    'IVA (USD)': s.ivaUSD,
    'IGTF 3% (USD)': s.igtfUSD,
    'Total Venta (USD)': s.totalUSD,
    'Total Venta (VES)': s.totalVES,
    'Costo Total (USD)': s.costoTotalUSD,
    'Utilidad Bruta (USD)': s.utilidadBrutaUSD,
    'Métodos de Pago': s.pagos.map((p) => `${p.nombreMetodo}: ${p.moneda === 'USD' ? 'REF ' + p.montoOriginal : 'Bs.' + p.montoOriginal}`).join(' | '),
    'Vuelto USD': s.vueltoUSD,
    'Vuelto VES': s.vueltoVES,
  }));

  const filenameDate = startDate && endDate ? `${startDate}_a_${endDate}` : new Date().toISOString().slice(0, 10);
  exportToExcel(
    [
      { name: 'Resumen Filtro Ventas', data: summaryData },
      { name: 'Historial de Ventas', data },
    ],
    `Reporte_Ventas_${filenameDate}`
  );
}

/**
 * Exportar Historial de Turnos y Cierres de Caja a Excel con Filtro de Fecha
 */
export function exportShiftHistoryToExcel(
  shifts: CashShift[],
  dateFilterLabel?: string,
  startDate?: string,
  endDate?: string
) {
  const totalVendidoUSD = shifts.reduce((acc, s) => acc + s.totalVendidoUSD, 0);
  const totalVendidoVES = shifts.reduce((acc, s) => acc + s.totalVendidoVES, 0);

  const summaryData = [
    { Parámetro: 'Filtro de Fecha Aplicado', Valor: dateFilterLabel || 'Todo el Historial' },
    { Parámetro: 'Rango de Fechas', Valor: startDate && endDate ? `${startDate} al ${endDate}` : 'Completo' },
    { Parámetro: 'Total de Turnos / Cierres', Valor: shifts.length },
    { Parámetro: 'Total Vendido Turnos (USD)', Valor: Number(totalVendidoUSD.toFixed(2)) },
    { Parámetro: 'Total Vendido Turnos (VES)', Valor: Number(totalVendidoVES.toFixed(2)) },
    { Parámetro: 'Fecha y Hora de Generación', Valor: new Date().toLocaleString('es-VE') },
  ];

  const shiftsData = shifts.map((s) => ({
    'ID Turno': s.id,
    'Cajero Responsable': s.cajeroNombre,
    'Apertura': new Date(s.fechaApertura).toLocaleString('es-VE'),
    'Cierre': s.fechaCierre ? new Date(s.fechaCierre).toLocaleString('es-VE') : 'EN CURSO',
    'Estado': s.estado.toUpperCase(),
    'Tasa BCV': s.tasaBCV,
    'Fondo Inicial USD': s.fondoInicialUSD,
    'Fondo Inicial VES': s.fondoInicialVES,
    'Total Vendido USD': s.totalVendidoUSD,
    'Total Vendido VES': s.totalVendidoVES,
    'Efectivo USD': s.ventasEfectivoUSD,
    'Efectivo VES': s.ventasEfectivoVES,
    'Punto de Venta VES': s.ventasPuntoVentaVES,
    'Pago Móvil VES': s.ventasPagoMovilVES,
    'Zelle USD': s.ventasZelleUSD,
    'Transferencia VES': s.ventasTransferenciaVES,
    'IGTF Recaudado USD': s.ventasIGTFUSD,
    'Arqueo Físico USD': s.arqueoFisicoUSD ?? 'No registrado',
    'Diferencia USD': s.diferenciaUSD ?? 0,
    'Arqueo Físico VES': s.arqueoFisicoVES ?? 'No registrado',
    'Diferencia VES': s.diferenciaVES ?? 0,
    'Observaciones': s.observacionesCierre || 'Sin novedades',
  }));

  const filenameDate = startDate && endDate ? `${startDate}_a_${endDate}` : new Date().toISOString().slice(0, 10);
  exportToExcel(
    [
      { name: 'Resumen Cierres', data: summaryData },
      { name: 'Detalle de Turnos', data: shiftsData },
    ],
    `Historial_Cierres_Caja_${filenameDate}`
  );
}

/**
 * Exportar Cierre de Caja a Excel
 */
export function exportCashShiftToExcel(shift: CashShift) {
  const summary = [
    { Concepto: 'Cajero Responsable', Valor: shift.cajeroNombre },
    { Concepto: 'Fecha de Apertura', Valor: new Date(shift.fechaApertura).toLocaleString('es-VE') },
    { Concepto: 'Fecha de Cierre', Valor: shift.fechaCierre ? new Date(shift.fechaCierre).toLocaleString('es-VE') : 'En curso' },
    { Concepto: 'Estado del Turno', Valor: shift.estado.toUpperCase() },
    { Concepto: 'Tasa BCV del Turno', Valor: shift.tasaBCV },
    { Concepto: 'Fondo Inicial USD', Valor: shift.fondoInicialUSD },
    { Concepto: 'Fondo Inicial VES', Valor: shift.fondoInicialVES },
    { Concepto: 'Ventas Efectivo USD', Valor: shift.ventasEfectivoUSD },
    { Concepto: 'Ventas Efectivo VES', Valor: shift.ventasEfectivoVES },
    { Concepto: 'Ventas Punto de Venta (VES)', Valor: shift.ventasPuntoVentaVES },
    { Concepto: 'Ventas Pago Móvil (VES)', Valor: shift.ventasPagoMovilVES },
    { Concepto: 'Ventas Zelle (USD)', Valor: shift.ventasZelleUSD },
    { Concepto: 'Ventas Transferencia (VES)', Valor: shift.ventasTransferenciaVES },
    { Concepto: 'Total IGTF Recaudado (USD)', Valor: shift.ventasIGTFUSD },
    { Concepto: 'Gran Total Ventas (USD)', Valor: shift.totalVendidoUSD },
    { Concepto: 'Gran Total Ventas (VES)', Valor: shift.totalVendidoVES },
    { Concepto: 'Arqueo Físico USD Contado', Valor: shift.arqueoFisicoUSD ?? 'No registrado' },
    { Concepto: 'Diferencia USD (Sobrante/Faltante)', Valor: shift.diferenciaUSD ?? 0 },
    { Concepto: 'Arqueo Físico VES Contado', Valor: shift.arqueoFisicoVES ?? 'No registrado' },
    { Concepto: 'Diferencia VES (Sobrante/Faltante)', Valor: shift.diferenciaVES ?? 0 },
    { Concepto: 'Observaciones', Valor: shift.observacionesCierre || 'Sin novedades' },
  ];

  exportToExcel([{ name: 'Resumen Cierre Caja', data: summary }], `Cierre_Caja_${shift.id.slice(0, 8)}`);
}

/**
 * Exportar Reporte de Caja Operativa Filtrado por Fecha y Métodos a Excel
 */
export function exportCashControlReportToExcel({
  dateFilterLabel,
  shiftLabel,
  totals,
  sales,
  startDate,
  endDate,
}: {
  dateFilterLabel: string;
  shiftLabel: string;
  totals: {
    totalUSD: number;
    totalVES: number;
    efectivoUSD: number;
    efectivoVES: number;
    pagoMovilVES: number;
    transferenciaVES: number;
    puntoVentaVES: number;
    zelleUSD: number;
    otrosUSD: number;
    countNotas: number;
  };
  sales: SaleNote[];
  startDate?: string;
  endDate?: string;
}) {
  const summaryData = [
    { Indicador: 'Período / Filtro Fecha', Detalle: dateFilterLabel },
    { Indicador: 'Rango Exacto', Detalle: startDate && endDate ? `${startDate} al ${endDate}` : 'No delimitado' },
    { Indicador: 'Caja / Turno', Detalle: shiftLabel },
    { Indicador: 'Total Facturado (USD / REF)', Detalle: totals.totalUSD },
    { Indicador: 'Total Facturado (Bolívares VES)', Detalle: totals.totalVES },
    { Indicador: 'Efectivo Divisas (USD)', Detalle: totals.efectivoUSD },
    { Indicador: 'Efectivo Bolívares (VES)', Detalle: totals.efectivoVES },
    { Indicador: 'Pago Móvil (VES)', Detalle: totals.pagoMovilVES },
    { Indicador: 'Transferencia Bancaria (VES)', Detalle: totals.transferenciaVES },
    { Indicador: 'Punto de Venta / Débito (VES)', Detalle: totals.puntoVentaVES },
    { Indicador: 'Zelle (USD)', Detalle: totals.zelleUSD },
    { Indicador: 'Otros Métodos (USD)', Detalle: totals.otrosUSD },
    { Indicador: 'Total Comprobantes / Notas Emitidas', Detalle: totals.countNotas },
    { Indicador: 'Fecha de Emisión del Reporte', Detalle: new Date().toLocaleString('es-VE') },
  ];

  const salesData = sales.map((s) => ({
    'N° Nota': s.numeroNota,
    'Fecha y Hora': new Date(s.fecha).toLocaleString('es-VE'),
    'Cajero': s.cajeroNombre,
    'Cliente': s.clienteNombre,
    'Cédula / Documento': s.clienteDocumento,
    'Productos / Artículos': (s.items || [])
      .map((it) => `${it.cantidad}x ${it.nombre || (it as any).productoNombre || (it as any).nombre_producto || 'Artículo'}`)
      .join(', ') || 'Venta directa',
    'Total Unidades': (s.items || []).reduce((acc, it) => acc + (it.cantidad || 0), 0),
    'Estado': s.estado.toUpperCase(),
    'Total REF': s.totalUSD,
    'Total Bs': s.totalVES,
    'Métodos Desglose': s.pagos.map((p) => `${p.nombreMetodo}: ${p.moneda === 'USD' ? 'REF ' + p.montoOriginal : 'Bs. ' + p.montoOriginal}`).join(' | '),
  }));

  const filenameDate = startDate && endDate ? `${startDate}_a_${endDate}` : new Date().toISOString().slice(0, 10);
  exportToExcel(
    [
      { name: 'Resumen Caja por Métodos', data: summaryData },
      { name: 'Detalle de Comprobantes', data: salesData },
    ],
    `Caja_Operativa_Reporte_${filenameDate}`
  );
}

/**
 * Exportar Finanzas (Gastos, CxC, CxP) a Excel con Filtro de Fecha
 */
export function exportFinanceToExcel({
  expenses,
  cxc,
  cxp,
  dateFilterLabel,
  startDate,
  endDate,
}: {
  expenses: Expense[];
  cxc: AccountReceivable[];
  cxp: AccountPayable[];
  dateFilterLabel?: string;
  startDate?: string;
  endDate?: string;
}) {
  const totalGastosUSD = expenses.reduce((sum, e) => sum + e.montoUSD, 0);
  const totalGastosVES = expenses.reduce((sum, e) => sum + e.montoVES, 0);
  const totalCxC = cxc.reduce((sum, c) => sum + c.saldoPendienteUSD, 0);
  const totalCxP = cxp.reduce((sum, p) => sum + p.saldoPendienteUSD, 0);

  const summaryData = [
    { Parámetro: 'Filtro de Fecha Aplicado', Valor: dateFilterLabel || 'Todo el Historial' },
    { Parámetro: 'Rango de Fechas', Valor: startDate && endDate ? `${startDate} al ${endDate}` : 'Completo' },
    { Parámetro: 'Total de Registros de Gasto', Valor: expenses.length },
    { Parámetro: 'Total Gastos (USD)', Valor: Number(totalGastosUSD.toFixed(2)) },
    { Parámetro: 'Total Gastos (VES)', Valor: Number(totalGastosVES.toFixed(2)) },
    { Parámetro: 'Total Saldo Pendiente CxC (USD)', Valor: Number(totalCxC.toFixed(2)) },
    { Parámetro: 'Total Saldo Pendiente CxP (USD)', Valor: Number(totalCxP.toFixed(2)) },
    { Parámetro: 'Fecha de Descarga', Valor: new Date().toLocaleString('es-VE') },
  ];

  const expensesData = expenses.map((e) => ({
    Fecha: new Date(e.fecha).toLocaleDateString('es-VE'),
    Concepto: e.concepto,
    Categoría: e.categoria.toUpperCase(),
    'Monto USD': e.montoUSD,
    'Monto VES': e.montoVES,
    'Tasa BCV': e.tasaBCV,
    'Método Pago': e.metodoPago,
    Responsable: e.usuarioNombre,
    Referencia: e.comprobanteRef || '-',
  }));

  const cxcData = cxc.map((c) => ({
    Cliente: c.clienteNombre,
    Documento: c.clienteDocumento,
    'Fecha Emisión': c.fechaEmision,
    'Fecha Vencimiento': c.fechaVencimiento,
    'Monto Total USD': c.montoTotalUSD,
    'Abonado USD': c.montoAbonadoUSD,
    'Saldo Pendiente USD': c.saldoPendienteUSD,
    Estado: c.estado.toUpperCase(),
  }));

  const cxpData = cxp.map((p) => ({
    Proveedor: p.proveedorNombre,
    RIF: p.proveedorRif,
    'Nro Factura / Ref': p.numeroFacturaProvedor,
    'Fecha Emisión': p.fechaEmision,
    'Fecha Vencimiento': p.fechaVencimiento,
    'Monto Total USD': p.montoTotalUSD,
    'Abonado USD': p.montoAbonadoUSD,
    'Saldo Pendiente USD': p.saldoPendienteUSD,
    Estado: p.estado.toUpperCase(),
  }));

  const filenameDate = startDate && endDate ? `${startDate}_a_${endDate}` : new Date().toISOString().slice(0, 10);
  exportToExcel(
    [
      { name: 'Resumen Financiero', data: summaryData },
      { name: 'Gastos y Egresos', data: expensesData },
      { name: 'Cuentas por Cobrar', data: cxcData },
      { name: 'Cuentas por Pagar', data: cxpData },
    ],
    `Reporte_Financiero_${filenameDate}`
  );
}

/**
 * Genera PDF de Nota de Entrega / Comprobante Interno de Venta
 */
export function generateSaleNotePDF(sale: SaleNote) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 220], // Formato Ticket / Comprobante Térmico estándar 80mm
  });

  const pageWidth = 80;
  let y = 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('COMERCIALIZADORA ÁVILA', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RIF: J-40123456-7', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.text('Av. Francisco de Miranda, Chacao, Caracas', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.text('Teléf: (0212) 952-0000', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('NOTA DE ENTREGA / COMPROBANTE INTERNO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(8);
  doc.text(`N°: ${sale.numeroNota}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setLineWidth(0.2);
  doc.line(4, y, pageWidth - 4, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Fecha: ${new Date(sale.fecha).toLocaleString('es-VE')}`, 5, y);
  y += 3.5;
  doc.text(`Cajero: ${sale.cajeroNombre}`, 5, y);
  y += 3.5;
  doc.text(`Cliente: ${sale.clienteNombre}`, 5, y);
  y += 3.5;
  doc.text(`Doc / RIF: ${sale.clienteDocumento}`, 5, y);
  y += 3.5;
  doc.text(`Tasa Oficial BCV: ${formatVES(sale.tasaBCV)} / REF`, 5, y);
  y += 4;

  doc.line(4, y, pageWidth - 4, y);
  y += 4;

  // Encabezado de items
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CANT', 5, y);
  doc.text('DESCRIPCIÓN', 15, y);
  doc.text('P.UNIT', 52, y);
  doc.text('TOTAL', pageWidth - 5, y, { align: 'right' });
  y += 3;

  doc.setFont('helvetica', 'normal');
  (sale.items || []).forEach((item) => {
    const itemName = item.nombre || (item as any).productoNombre || (item as any).nombre_producto || 'Artículo';
    const desc = itemName.length > 20 ? itemName.substring(0, 18) + '..' : itemName;
    doc.text(`${item.cantidad}`, 5, y);
    doc.text(desc, 15, y);
    doc.text(`REF ${(Number(item.precioUnitarioUSD) || 0).toFixed(2)}`, 52, y);
    doc.text(`REF ${(Number(item.totalUSD || item.subtotalUSD) || 0).toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;
  });

  y += 1;
  doc.line(4, y, pageWidth - 4, y);
  y += 4;

  // Totales
  doc.setFontSize(7.5);
  doc.text('Subtotal Exento:', 10, y);
  doc.text(`REF ${sale.subtotalExentoUSD.toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
  y += 3.5;

  doc.text('Subtotal Gravable:', 10, y);
  doc.text(`REF ${sale.subtotalGravableUSD.toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
  y += 3.5;

  if (sale.ivaUSD > 0) {
    doc.text('IVA (16%):', 10, y);
    doc.text(`REF ${sale.ivaUSD.toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;
  }

  if (sale.igtfUSD > 0) {
    doc.text('IGTF (3% Divisas):', 10, y);
    doc.text(`REF ${sale.igtfUSD.toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL A PAGAR (REF):', 8, y);
  doc.text(formatUSD(sale.totalUSD), pageWidth - 5, y, { align: 'right' });
  y += 4;

  doc.text('TOTAL A PAGAR (VES):', 8, y);
  doc.text(formatVES(sale.totalVES), pageWidth - 5, y, { align: 'right' });
  y += 4.5;

  doc.line(4, y, pageWidth - 4, y);
  y += 4;

  // Desglose de Pagos
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DESGLOSE DE PAGO:', 5, y);
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  sale.pagos.forEach((p) => {
    const formattedAmt = p.moneda === 'USD' ? formatUSD(p.montoOriginal) : formatVES(p.montoOriginal);
    const igtfNote = p.aplicaIGTF ? ' (Incluye IGTF 3%)' : '';
    doc.text(`• ${p.nombreMetodo}${igtfNote}:`, 5, y);
    doc.text(formattedAmt, pageWidth - 5, y, { align: 'right' });
    y += 3.2;
  });

  if (sale.vueltoUSD > 0 || sale.vueltoVES > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.text('Vuelto Entregado:', 5, y);
    const vueltoStr = `${sale.vueltoUSD > 0 ? formatUSD(sale.vueltoUSD) : ''} ${sale.vueltoVES > 0 ? formatVES(sale.vueltoVES) : ''}`.trim();
    doc.text(vueltoStr, pageWidth - 5, y, { align: 'right' });
    y += 3.5;
  }

  y += 3;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('*** COMPROBANTE DE CONTROL INTERNO ***', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('NO CONSTITUYE FACTURA FISCAL', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('¡Gracias por su compra y preferencia!', pageWidth / 2, y, { align: 'center' });

  doc.save(`Nota_${sale.numeroNota}.pdf`);
}

/**
 * Genera PDF de Reporte Gerencial de Ventas y Utilidades (Formato Carta A4)
 */
export function generateManagerReportPDF({
  startDate,
  endDate,
  sales,
  expenses,
  bcvRate,
}: {
  startDate: string;
  endDate: string;
  sales: SaleNote[];
  expenses: Expense[];
  bcvRate: number;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COMERCIALIZADORA ÁVILA C.A.', 14, 18);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte Gerencial de Ventas, Costos y Utilidades', 14, 25);
  doc.setFontSize(9);
  doc.text(`Período: ${startDate} al ${endDate} | Tasa de Conversión BCV: ${formatVES(bcvRate)}/USD`, 14, 30);

  const totalVentasUSD = sales.filter((s) => s.estado === 'completada').reduce((acc, s) => acc + s.totalUSD, 0);
  const totalCostoUSD = sales.filter((s) => s.estado === 'completada').reduce((acc, s) => acc + s.costoTotalUSD, 0);
  const totalGastosUSD = expenses.reduce((acc, e) => acc + e.montoUSD, 0);
  const utilidadBrutaUSD = totalVentasUSD - totalCostoUSD;
  const utilidadNetaUSD = utilidadBrutaUSD - totalGastosUSD;

  // Cuadro resumen de métricas clave
  autoTable(doc, {
    startY: 35,
    head: [['Métrica Financiera', 'Monto en USD ($)', 'Monto en Bolívares (VES @ BCV)', '% del Ingreso']],
    body: [
      ['Ingresos Brutos por Ventas', formatUSD(totalVentasUSD), formatVES(totalVentasUSD * bcvRate), '100%'],
      ['(-) Costo de Mercancía Vendida (CMV)', formatUSD(totalCostoUSD), formatVES(totalCostoUSD * bcvRate), `${totalVentasUSD > 0 ? ((totalCostoUSD / totalVentasUSD) * 100).toFixed(1) : 0}%`],
      ['(=) Utilidad Bruta Operativa', formatUSD(utilidadBrutaUSD), formatVES(utilidadBrutaUSD * bcvRate), `${totalVentasUSD > 0 ? ((utilidadBrutaUSD / totalVentasUSD) * 100).toFixed(1) : 0}%`],
      ['(-) Gastos Operativos y Administrativos', formatUSD(totalGastosUSD), formatVES(totalGastosUSD * bcvRate), `${totalVentasUSD > 0 ? ((totalGastosUSD / totalVentasUSD) * 100).toFixed(1) : 0}%`],
      ['(=) UTILIDAD NETA DEL EJERCICIO', formatUSD(utilidadNetaUSD), formatVES(utilidadNetaUSD * bcvRate), `${totalVentasUSD > 0 ? ((utilidadNetaUSD / totalVentasUSD) * 100).toFixed(1) : 0}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [24, 43, 73] },
  });

  // Ventas por Método de Pago
  const paymentTotals: Record<string, number> = {};
  sales.forEach((s) => {
    if (s.estado === 'completada') {
      s.pagos.forEach((p) => {
        paymentTotals[p.nombreMetodo] = (paymentTotals[p.nombreMetodo] || 0) + p.montoUSD;
      });
    }
  });

  const paymentRows = Object.entries(paymentTotals).map(([metodo, usd]) => [
    metodo,
    formatUSD(usd),
    formatVES(usd * bcvRate),
    `${totalVentasUSD > 0 ? ((usd / totalVentasUSD) * 100).toFixed(1) : 0}%`,
  ]);

  const lastTable = (doc as any).lastAutoTable;
  autoTable(doc, {
    startY: lastTable.finalY + 10,
    head: [['Método de Pago / Canal', 'Total Recaudado (USD)', 'Total Recaudado (VES)', 'Participación']],
    body: paymentRows,
    theme: 'striped',
    headStyles: { fillColor: [40, 80, 120] },
  });

  const safeStart = startDate.replace(/\//g, '-');
  const safeEnd = endDate.replace(/\//g, '-');
  doc.save(`Reporte_Gerencial_${safeStart}_a_${safeEnd}.pdf`);
}
