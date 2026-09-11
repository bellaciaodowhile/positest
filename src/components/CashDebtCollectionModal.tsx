import React, { useState, useEffect } from 'react';
import {
  Coins,
  DollarSign,
  CreditCard,
  Smartphone,
  Building,
  CheckCircle2,
  AlertCircle,
  X,
  Receipt,
  Printer,
  Sparkles,
  ArrowRight,
  User,
  FileText,
  Calendar,
} from 'lucide-react';
import { AccountReceivable, CashShift, PaymentMethodType } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';

interface CashDebtCollectionModalProps {
  isOpen: boolean;
  cxc: AccountReceivable | null;
  bcvRate: number;
  activeShift: CashShift | null;
  onClose: () => void;
  onConfirmPayment: (
    cxcId: string,
    amountUSD: number,
    method: PaymentMethodType,
    ref?: string,
    amountVES?: number
  ) => void;
}

export const CashDebtCollectionModal: React.FC<CashDebtCollectionModalProps> = ({
  isOpen,
  cxc,
  bcvRate,
  activeShift,
  onClose,
  onConfirmPayment,
}) => {
  const [payCurrency, setPayCurrency] = useState<'VES' | 'USD'>('VES');
  const [amountVES, setAmountVES] = useState<number>(0);
  const [amountUSD, setAmountUSD] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethodType>('pago_movil');
  const [refNumber, setRefNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Comprobante post-pago
  const [receiptData, setReceiptData] = useState<{
    cxc: AccountReceivable;
    montoAbonadoUSD: number;
    montoAbonadoVES: number;
    metodo: PaymentMethodType;
    referencia?: string;
    nuevoSaldoUSD: number;
    nuevoSaldoVES: number;
    fecha: string;
    cajero: string;
  } | null>(null);

  // Al abrir el modal, inicializar los valores con la deuda pendiente
  useEffect(() => {
    if (cxc && isOpen) {
      const isFixedVES = cxc.monedaFijada === 'VES';
      const initialCurrency = isFixedVES ? 'VES' : 'VES';
      setPayCurrency(initialCurrency);

      const maxVES = cxc.saldoPendienteVES !== undefined && cxc.saldoPendienteVES > 0
        ? cxc.saldoPendienteVES
        : usdToVes(cxc.saldoPendienteUSD, bcvRate);
      const maxUSD = isFixedVES ? maxVES / bcvRate : cxc.saldoPendienteUSD;

      setAmountVES(Number(maxVES.toFixed(2)));
      setAmountUSD(Number(maxUSD.toFixed(2)));
      setMethod('pago_movil');
      setRefNumber('');
      setErrorMsg('');
      setReceiptData(null);
    }
  }, [cxc, isOpen, bcvRate]);

  if (!isOpen || !cxc) return null;

  const isFixedVES = cxc.monedaFijada === 'VES';
  const pendingVES = cxc.saldoPendienteVES !== undefined && cxc.saldoPendienteVES > 0
    ? cxc.saldoPendienteVES
    : usdToVes(cxc.saldoPendienteUSD, bcvRate);
  const pendingUSD = isFixedVES ? pendingVES / bcvRate : cxc.saldoPendienteUSD;

  const totalOriginalVES = cxc.montoTotalVES ?? usdToVes(cxc.montoTotalUSD, bcvRate);
  const totalAbonadoVES = cxc.montoAbonadoVES ?? usdToVes(cxc.montoAbonadoUSD, bcvRate);

  // Manejadores de cambio de monto con sincronización automática en vivo
  const handleAmountVESChange = (val: number) => {
    setAmountVES(val);
    if (bcvRate > 0) {
      setAmountUSD(Number((val / bcvRate).toFixed(2)));
    }
    setErrorMsg('');
  };

  const handleAmountUSDChange = (val: number) => {
    setAmountUSD(val);
    if (bcvRate > 0) {
      setAmountVES(Number((val * bcvRate).toFixed(2)));
    }
    setErrorMsg('');
  };

  // Botón para liquidar el 100% de la deuda pendiente
  const handleSetFullPendingAmount = () => {
    setAmountVES(Number(pendingVES.toFixed(2)));
    setAmountUSD(Number(pendingUSD.toFixed(2)));
    setErrorMsg('');
  };

  const handleCurrencyToggle = (curr: 'VES' | 'USD') => {
    setPayCurrency(curr);
    if (curr === 'USD') {
      setMethod('efectivo_usd');
    } else {
      setMethod('pago_movil');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (payCurrency === 'VES') {
      if (amountVES <= 0) {
        setErrorMsg('Por favor ingresa un monto mayor a 0 Bs.');
        return;
      }
      if (amountVES > pendingVES + 0.5) {
        setErrorMsg(`El monto ingresado (Bs. ${amountVES.toFixed(2)}) supera la deuda pendiente (Bs. ${pendingVES.toFixed(2)}).`);
        return;
      }
    } else {
      if (amountUSD <= 0) {
        setErrorMsg('Por favor ingresa un monto mayor a $0 USD.');
        return;
      }
      if (amountUSD > pendingUSD + 0.1) {
        setErrorMsg(`El monto ingresado ($${amountUSD.toFixed(2)}) supera la deuda pendiente ($${pendingUSD.toFixed(2)}).`);
        return;
      }
    }

    const actualPayUSD = payCurrency === 'USD' ? amountUSD : (amountVES / bcvRate);
    const actualPayVES = payCurrency === 'VES' ? amountVES : (amountUSD * bcvRate);

    // Ejecutar abono/pago
    onConfirmPayment(
      cxc.id,
      actualPayUSD,
      method,
      refNumber.trim() || undefined,
      payCurrency === 'VES' ? amountVES : undefined
    );

    const remainingUSD = Math.max(0, pendingUSD - actualPayUSD);
    const remainingVES = Math.max(0, pendingVES - actualPayVES);

    // Mostrar recibo exitoso
    setReceiptData({
      cxc,
      montoAbonadoUSD: actualPayUSD,
      montoAbonadoVES: actualPayVES,
      metodo: method,
      referencia: refNumber.trim() || undefined,
      nuevoSaldoUSD: remainingUSD < 0.02 ? 0 : remainingUSD,
      nuevoSaldoVES: remainingVES < 0.1 ? 0 : remainingVES,
      fecha: new Date().toLocaleString('es-VE'),
      cajero: activeShift?.cajeroNombre || 'Cajero de Turno',
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const methodLabels: Record<PaymentMethodType, { label: string; icon: React.ReactNode; color: string }> = {
    efectivo_ves: {
      label: 'Efectivo Bolívares (VES)',
      icon: <Coins className="w-4 h-4 text-blue-600" />,
      color: 'hover:border-blue-500 hover:bg-blue-50',
    },
    efectivo_usd: {
      label: 'Efectivo Divisas (USD)',
      icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
      color: 'hover:border-emerald-500 hover:bg-emerald-50',
    },
    pago_movil: {
      label: 'Pago Móvil (VES)',
      icon: <Smartphone className="w-4 h-4 text-amber-600" />,
      color: 'hover:border-amber-500 hover:bg-amber-50',
    },
    punto_venta: {
      label: 'Punto de Venta / Débito (VES)',
      icon: <CreditCard className="w-4 h-4 text-purple-600" />,
      color: 'hover:border-purple-500 hover:bg-purple-50',
    },
    transferencia: {
      label: 'Transferencia Bancaria (VES)',
      icon: <Building className="w-4 h-4 text-cyan-600" />,
      color: 'hover:border-cyan-500 hover:bg-cyan-50',
    },
    zelle: {
      label: 'Zelle (USD)',
      icon: <DollarSign className="w-4 h-4 text-indigo-600" />,
      color: 'hover:border-indigo-500 hover:bg-indigo-50',
    },
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* COMPROBANTE DE PAGO POST-CONFIRMACIÓN */}
        {receiptData ? (
          <div className="p-6 sm:p-7 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                ¡Cobro Ingresado a Caja Exitosamente!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                El dinero recibido ha sido acreditado en el turno de caja de{' '}
                <strong className="text-slate-700">{receiptData.cajero}</strong> y se descontó de la deuda del cliente.
              </p>
            </div>

            {/* Recibo tipo Ticket */}
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 sm:p-5 space-y-3 font-mono text-xs">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="text-sm font-black tracking-wider text-slate-800">
                  COMPROBANTE DE ABONO EN CAJA
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{receiptData.fecha}</div>
                <div className="text-[11px] text-indigo-600 font-bold mt-1">
                  Nota de Venta: {receiptData.cxc.notaVentaId}
                </div>
              </div>

              <div className="space-y-1.5 py-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-900">{receiptData.cxc.clienteNombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cédula/RIF:</span>
                  <span>{receiptData.cxc.clienteDocumento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Forma de Pago:</span>
                  <span className="font-bold text-slate-900">
                    {methodLabels[receiptData.metodo]?.label || receiptData.metodo}
                  </span>
                </div>
                {receiptData.referencia && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">N° Referencia:</span>
                    <span className="font-bold text-indigo-600">{receiptData.referencia}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Tasa BCV Aplicada:</span>
                  <span>Bs. {bcvRate.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2.5 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-900">Monto Cobrado (Bs):</span>
                  <span className="font-black text-emerald-600">{formatVES(receiptData.montoAbonadoVES)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Equivalente Divisas ($):</span>
                  <span className="font-bold text-slate-700">{formatUSD(receiptData.montoAbonadoUSD)}</span>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600">Saldo Restante del Cliente:</span>
                {receiptData.nuevoSaldoVES <= 0.05 ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-[11px]">
                    ✓ DEUDA LIQUIDADA AL 100%
                  </span>
                ) : (
                  <div className="text-right font-bold text-amber-600">
                    <div>{formatVES(receiptData.nuevoSaldoVES)}</div>
                    <div className="text-[10px] text-slate-400">({formatUSD(receiptData.nuevoSaldoUSD)})</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Recibo</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Listo / Continuar en Caja</span>
              </button>
            </div>
          </div>
        ) : (
          /* FORMULARIO DE COBRO DE DEUDA */
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Header del Modal */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Cobro de Saldo Restante en Caja</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                      CxC
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Ingresa el dinero que el cliente debe directamente al turno de caja activo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4.5 max-h-[82vh] overflow-y-auto">
              {/* Información del Cliente y la Venta */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-indigo-600" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{cxc.clienteNombre}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        C.I./RIF: {cxc.clienteDocumento} {cxc.clienteTelefono && `• Tlf: ${cxc.clienteTelefono}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Comprobante</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                      {cxc.notaVentaId}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Emisión: {cxc.fechaEmision}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Modalidad: </span>
                    <strong className="text-slate-700">
                      {isFixedVES ? 'Pagar Luego (Fijado en Bs)' : 'Referenciado en USD'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* TABLA COMPARATIVA: TOTAL VENTA vs YA PAGÓ vs DEBE ACTUALMENTE */}
              <div className="grid grid-cols-3 gap-2.5">
                {/* 1. Total Compra */}
                <div className="p-3 rounded-2xl bg-slate-100/80 border border-slate-200 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                    Total Compra
                  </span>
                  <div className="font-black text-slate-800 text-xs sm:text-sm font-mono">
                    {formatUSD(cxc.montoTotalUSD)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 font-mono">
                    {formatVES(totalOriginalVES)}
                  </div>
                </div>

                {/* 2. Ya Pagó */}
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
                    Ya Pagó
                  </span>
                  <div className="font-black text-emerald-800 text-xs sm:text-sm font-mono">
                    {formatUSD(cxc.montoAbonadoUSD)}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-600 font-mono">
                    {formatVES(totalAbonadoVES)}
                  </div>
                  {cxc.abonos.length > 0 && (
                    <span className="text-[9px] text-emerald-600 block mt-0.5">
                      ({cxc.abonos.length} abono{cxc.abonos.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>

                {/* 3. Debe Actualmente (Destacado) */}
                <div className="p-3 rounded-2xl bg-amber-500/10 border-2 border-amber-500 text-center relative overflow-hidden">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block mb-0.5">
                    Debe Actualmente
                  </span>
                  <div className="font-black text-amber-950 text-sm sm:text-base font-mono">
                    {formatVES(pendingVES)}
                  </div>
                  <div className="text-[11px] font-bold text-amber-800 font-mono">
                    {formatUSD(pendingUSD)}
                  </div>
                </div>
              </div>

              {/* Botón de 1 Clic para Liquidar Total Restante */}
              <button
                type="button"
                onClick={handleSetFullPendingAmount}
                className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Cobrar Todo el Restante (Liquidar Deuda al 100%)</span>
                </span>
                <span className="font-mono font-black text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                  {formatVES(pendingVES)} / {formatUSD(pendingUSD)}
                </span>
              </button>

              {/* Selector de Moneda: Pagar en Bolívares o Dólares */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ¿En qué moneda está pagando el cliente ahora?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCurrencyToggle('VES')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      payCurrency === 'VES'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    <span>Bolívares (Bs. VES)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyToggle('USD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      payCurrency === 'USD'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Dólares ($ USD)</span>
                  </button>
                </div>
              </div>

              {/* Input de Monto a Pagar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a Cobrar / Agregar a Caja {payCurrency === 'VES' ? '(Bolívares)' : '(Dólares)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold font-mono text-sm">
                    {payCurrency === 'VES' ? 'Bs.' : '$'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payCurrency === 'VES' ? (amountVES || '') : (amountUSD || '')}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value) || 0;
                      if (payCurrency === 'VES') {
                        handleAmountVESChange(num);
                      } else {
                        handleAmountUSDChange(num);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl font-mono font-bold text-slate-900 text-base focus:ring-2 focus:ring-indigo-100 outline-hidden"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>
                    Equivalente en {payCurrency === 'VES' ? 'Divisas ($ USD)' : 'Bolívares (VES)'}:{' '}
                    <strong className="text-slate-800">
                      {payCurrency === 'VES' ? formatUSD(amountUSD) : formatVES(amountVES)}
                    </strong>
                  </span>
                  <span>Tasa BCV: Bs. {bcvRate.toFixed(2)}</span>
                </div>
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Método de Pago Utilizado por el Cliente
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(methodLabels) as PaymentMethodType[]).map((key) => {
                    const item = methodLabels[key];
                    const isSelected = method === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMethod(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                            : `bg-white border-slate-200 ${item.color}`
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          {item.icon}
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                        </div>
                        <span className={`text-[11px] leading-tight font-bold ${isSelected ? 'text-indigo-950' : 'text-slate-700'}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referencia bancaria si no es efectivo */}
              {method !== 'efectivo_usd' && method !== 'efectivo_ves' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número de Referencia Bancaria / Comprobante
                  </label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="Ej. 658932 o últimos 4-6 dígitos"
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Mensaje de error si hay validación */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Alerta informativa de que el dinero entra a la caja activa */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Impacto directo en Caja:</strong> El dinero cobrado se agregará inmediatamente a los totales del turno de caja activo de{' '}
                  <strong>{activeShift?.cajeroNombre || 'Caja'}</strong>, asegurando que el arqueo físico al cerrar coincida al 100%.
                </p>
              </div>
            </div>

            {/* Footer con Botones */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all hover:shadow-lg"
              >
                <Coins className="w-4 h-4" />
                <span>Confirmar Cobro e Ingresar a Caja</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
