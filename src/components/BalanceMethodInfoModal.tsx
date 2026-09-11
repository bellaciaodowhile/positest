import React from 'react';
import {
  X,
  Table,
  DollarSign,
  Coins,
  Smartphone,
  CreditCard,
  Building,
  ArrowRightLeft,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  FileSpreadsheet,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatVES } from '../services/bcvService';

interface BalanceMethodInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bcvRate: number;
}

export const BalanceMethodInfoModal: React.FC<BalanceMethodInfoModalProps> = ({
  isOpen,
  onClose,
  bcvRate,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="balance-method-info-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Balance Consolidado por Método de Pago
                </h3>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-400/30 uppercase">
                  Guía Contable
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                Auditoría financiera, arqueo multimoneda y conciliación bancaria en Venezuela
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar modal informativo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-700 text-xs sm:text-sm">
          {/* Introducción / Propósito */}
          <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 flex items-start gap-3.5">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-2xs shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-indigo-950 text-sm">
                ¿Qué representa esta tabla y por qué es fundamental?
              </h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Esta tabla consolida en una sola pantalla todos los ingresos recaudados en caja
                durante el turno o período seleccionado. Separa con exactitud el <strong>dinero físico</strong>{' '}
                que reposa en la gaveta del cajero del <strong>dinero bancario y digital</strong>{' '}
                liquidado en cuentas bancarias, permitiendo un arqueo rápido, transparente y sin
                discrepancias cambiarias.
              </p>
            </div>
          </div>

          {/* Dos Grandes Ámbitos: Caja Física vs Banca Digital */}
          <div>
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Separación Operativa: Gaveta Física vs. Cuentas Bancarias</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Caja Física */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span>1. Dinero en Caja Física (Gaveta)</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Corresponde a los billetes en efectivo que el cajero recibe y custodia
                  físicamente en el punto de cobro:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>
                      <strong>Efectivo Divisas (USD):</strong> Billetes en dólares para arqueo
                      manual de billetes.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>
                      <strong>Efectivo Bolívares (VES):</strong> Moneda nacional física en gaveta.
                    </span>
                  </li>
                </ul>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-100 text-[11px] text-emerald-800">
                  <strong>Auditoría:</strong> Se valida al momento del cierre contando billete por
                  billete en el <em>Arqueo de Gaveta</em>.
                </div>
              </div>

              {/* Banca Digital / POS */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                    <Building className="w-4 h-4" />
                  </div>
                  <span>2. Dinero en Bancos & Canales Digitales</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Fondos liquidados de manera electrónica que van directamente a cuentas de la
                  empresa:
                </p>
                <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                  <li className="flex items-start gap-1.5">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>
                      <strong>Pago Móvil:</strong> Verificable de inmediato en la app o SMS del banco.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>
                      <strong>Punto de Venta (POS):</strong> Se concilia con el comprobante de{' '}
                      <em>Cierre de Lote</em> diario del terminal.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-cyan-600 font-bold">•</span>
                    <span>
                      <strong>Transferencias & Zelle:</strong> Ingresos a cuentas jurídicas o
                      internacionales.
                    </span>
                  </li>
                </ul>
                <div className="bg-white/80 p-2 rounded-lg border border-indigo-100 text-[11px] text-indigo-800">
                  <strong>Auditoría:</strong> Se valida contra los reportes bancarios y el cierre del
                  terminal POS (voucher de cierre).
                </div>
              </div>
            </div>
          </div>

          {/* Explicación de las Columnas de la Tabla */}
          <div className="space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Columnas e Indicadores de la Tabla</span>
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 shrink-0 w-36">Operaciones:</span>
                <span className="text-slate-600">
                  Cantidad de pagos registrados con ese canal específico. Si un cliente paga una
                  nota con parte en efectivo y parte en Pago Móvil (pago mixto), cada porción se
                  contabiliza en su fila correspondiente.
                </span>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 shrink-0 w-36">Monto (USD / REF):</span>
                <span className="text-slate-600">
                  Valor monetario expresado en divisa referencial para conocer el total real del
                  negocio, independientemente de la devaluación.
                </span>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 shrink-0 w-36">Equivalente (Bolívares):</span>
                <span className="text-slate-600">
                  Total expresado en moneda nacional aplicando exactamente la{' '}
                  <strong className="text-indigo-700">Tasa Oficial BCV ({formatVES(bcvRate)})</strong>.
                  Facilita la declaración de ingresos contables y fiscales.
                </span>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 shrink-0 w-36">% Participación:</span>
                <span className="text-slate-600">
                  Muestra la cuota de mercado de cada medio de cobro en tus ventas. Te ayuda a
                  identificar si tus clientes prefieren pagar con Pago Móvil, Efectivo Divisas o
                  Punto de Venta.
                </span>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 shrink-0 w-36">Botón "Filtrar":</span>
                <span className="text-slate-600">
                  Al hacer clic sobre el botón de cualquier método, el sistema filtra
                  instantáneamente la lista inferior de comprobantes mostrando únicamente las notas
                  cobradas con ese método para una auditoría minuciosa.
                </span>
              </div>
            </div>
          </div>

          {/* Procedimiento Recomendado para el Cierre de Turno */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Procedimiento Recomendado de Cierre de Caja</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-1">
                <span className="font-bold text-emerald-400 block">Paso 1: Arqueo en Gaveta</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Cuenta los billetes de Efectivo USD y Efectivo Bolívares. El total contado en
                  gaveta debe coincidir exactamente con las dos primeras filas.
                </p>
              </div>

              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-1">
                <span className="font-bold text-purple-400 block">Paso 2: Cierre de POS</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Imprime el reporte de cierre de lote de los puntos de venta. El total del voucher
                  debe igualar el monto de "Punto de Venta / Débito".
                </p>
              </div>

              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 space-y-1">
                <span className="font-bold text-amber-400 block">Paso 3: Conciliación Digital</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Verifica que los pagos móviles, transferencias y pagos Zelle se encuentren
                  acreditados en los estados de cuenta correspondientes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Actualizado automáticamente en tiempo real con cada cobro en caja</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
