import React, { useState } from 'react';
import {
  X,
  Calculator,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Percent,
  ArrowRight,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';

interface CostStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  bcvRate: number;
}

export const CostStructureModal: React.FC<CostStructureModalProps> = ({
  isOpen,
  onClose,
  bcvRate,
}) => {
  // Mini simulador interactivo para que el usuario experimente
  const [simCosto, setSimCosto] = useState<number>(10);
  const [simMargen, setSimMargen] = useState<number>(30);
  const [simPrecio, setSimPrecio] = useState<number>(13);

  if (!isOpen) return null;

  const handleSimCostOrMarginChange = (cost: number, margin: number) => {
    setSimCosto(cost);
    setSimMargen(margin);
    const calculated = Number((cost * (1 + margin / 100)).toFixed(2));
    setSimPrecio(calculated);
  };

  const handleSimPriceChange = (price: number) => {
    setSimPrecio(price);
    if (simCosto > 0) {
      const calculatedMargin = Number((((price - simCosto) / simCosto) * 100).toFixed(2));
      setSimMargen(calculatedMargin);
    }
  };

  const simGananciaUSD = Math.max(0, simPrecio - simCosto);
  const simPrecioBs = usdToVes(simPrecio, bcvRate);
  const simGananciaBs = usdToVes(simGananciaUSD, bcvRate);

  return (
    <div
      id="cost-structure-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  Estructura de Costos & Precios en Dólares
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Modelo Multimoneda
                </span>
              </div>
              <p className="text-xs text-slate-300">
                ¿Cómo funciona el cálculo de margen, protección de capital y conversión a Tasa BCV?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="p-6 space-y-6 overflow-y-auto text-slate-700 text-sm">
          {/* Tarjeta Resumen Rápido */}
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="text-xs leading-relaxed text-indigo-950 flex-1">
              <strong className="block text-indigo-900 font-bold mb-1 text-sm">
                En pocas palabras:
              </strong>
              Fijas tu <strong>Costo de Compra en USD</strong> y el <strong>Margen % que deseas ganar</strong>. El sistema calcula automáticamente el <strong>Precio Final en USD</strong>. En el Punto de Venta (POS), este precio se multiplica en vivo por la <strong>Tasa Oficial del BCV</strong> para cobrar en Bolívares sin que pierdas dinero si la tasa cambia.
            </div>
          </div>

          {/* 3 Pasos del Funcionamiento */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-600" />
              Los 3 Componentes Clave
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Componente 1: Costo de Adquisición */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">1. Costo Adquisición</span>
                  <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    REF / USD
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Es el precio que pagas a tu proveedor o distribuidor por unidad en divisa referencial.
                </p>
                <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50 p-1.5 rounded border border-indigo-100 font-medium">
                  Protege tu reposición de inventario.
                </div>
              </div>

              {/* Componente 2: Margen de Ganancia */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">2. Margen de Ganancia</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    % Utilidad
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  El porcentaje de ganancia bruta sobre el costo. Puedes indicar 20%, 30%, 50% o el margen deseado.
                </p>
                <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-100 font-medium">
                  Cálculo: Ganancia = Costo × (Margen / 100)
                </div>
              </div>

              {/* Componente 3: Precio Final & Tasa BCV */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">3. Precio Final & BCV</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    USD ➔ VES
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Precio de venta al público en USD. Al facturar, se convierte a Bolívares al instante según la tasa oficial.
                </p>
                <div className="mt-2 text-[11px] text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100 font-medium">
                  Cobro: Precio USD × Tasa BCV Oficial
                </div>
              </div>
            </div>
          </div>

          {/* Dinámica Bidireccional Automática */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              Cálculo Bidireccional Inteligente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <strong className="text-slate-900 block font-semibold mb-1">
                  Opción A: Por Margen Deseado
                </strong>
                <p className="text-slate-600">
                  Ingresas el Costo ($10) y colocas 30% de margen. El sistema fija automáticamente el <strong>Precio Final en $13.00</strong>.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <strong className="text-slate-900 block font-semibold mb-1">
                  Opción B: Por Precio de Venta Fijo
                </strong>
                <p className="text-slate-600">
                  Si un producto cuesta $10 y deseas venderlo a $15.00 directamente, el sistema calcula que tu <strong>Margen Real es 50.0%</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Mini Simulador Interactivo */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Simulador en Tiempo Real
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Tasa BCV de Referencia: {formatVES(bcvRate)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Costo de Adquisición ($)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 text-xs">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={simCosto}
                    onChange={(e) =>
                      handleSimCostOrMarginChange(parseFloat(e.target.value) || 0, simMargen)
                    }
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-bold bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  % Margen de Utilidad
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={simMargen}
                    onChange={(e) =>
                      handleSimCostOrMarginChange(simCosto, parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-800 border border-slate-700 rounded-lg text-emerald-400 focus:outline-hidden focus:border-indigo-400"
                  />
                  <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 text-xs">
                    %
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                  Precio de Venta ($ REF)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 text-xs">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={simPrecio}
                    onChange={(e) => handleSimPriceChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-bold bg-slate-800 border border-slate-700 rounded-lg text-blue-400 focus:outline-hidden focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>

            {/* Resultado del simulador */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Ganancia Neta estimada:</span>
                <strong className="text-emerald-400 text-sm font-mono">
                  {formatUSD(simGananciaUSD)}
                </strong>
                <span className="text-slate-400 text-[11px]">
                  ({formatVES(simGananciaBs)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Precio en Caja (Bs.):</span>
                <strong className="text-blue-300 text-base font-bold font-mono">
                  {formatVES(simPrecioBs)}
                </strong>
              </div>
            </div>
          </div>

          {/* Clasificación de Impuesto (Gravable vs Exento) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Tratamiento Fiscal (SENIAT)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">
                  • Gravable con IVA (16%)
                </span>
                <p className="text-amber-800 text-[11px] leading-relaxed">
                  Aplica para la mayoría de bienes de consumo, licores, misceláneos y servicios. El IVA se desglosa al emitir el comprobante o ticket en caja.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="font-bold text-emerald-900 block mb-1">
                  • Exento de IVA
                </span>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Para alimentos esenciales de la canasta básica (arroz, harina, huevos, leche), medicamentos e insumos médicos según la normativa tributaria.
                </p>
              </div>
            </div>
          </div>

          {/* Por qué es vital para el comercio venezolano */}
          <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
            <strong className="text-slate-900 block font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Garantía de Reposición de Inventario
            </strong>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Al trabajar con precios base en dólares referenciales, si la tasa de cambio oficial del BCV sube en la tarde o al día siguiente, el sistema actualiza de inmediato el equivalente en Bolívares en el punto de venta. Esto evita que tu negocio descapitalice su inventario al reponer mercancía con los proveedores.
            </p>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            VentaFlow POS • Gestión de Costos & Márgenes
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
