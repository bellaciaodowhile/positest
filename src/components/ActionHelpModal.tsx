import React from 'react';
import {
  X,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Calculator,
  Lock,
  Wallet,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Ban,
} from 'lucide-react';

export type HelpTopicKey =
  | 'arqueo_cierre'
  | 'apertura_caja'
  | 'diferencia_arqueo'
  | 'exportar_arqueo'
  | 'pagar_luego'
  | 'cobro_multimoneda'
  | 'anular_nota';

export interface HelpTopicContent {
  id: HelpTopicKey;
  title: string;
  category: string;
  shortSummary: string;
  icon: React.ReactNode;
  concept: string;
  steps: { title: string; desc: string }[];
  formula?: {
    title: string;
    expression: string;
    explanation: string;
  };
  keyTips: string[];
}

export const HELP_TOPICS: Record<HelpTopicKey, HelpTopicContent> = {
  arqueo_cierre: {
    id: 'arqueo_cierre',
    title: 'Arqueo Físico & Cierre de Turno de Caja',
    category: 'Control de Caja & Auditoría',
    shortSummary: 'Auditoría obligatoria al finalizar el turno para verificar que el dinero físico en gaveta coincida exactamente con las ventas registradas.',
    icon: <Lock className="w-5 h-5 text-rose-600" />,
    concept:
      'El arqueo de caja consiste en contar manualmente billete por billete el dinero físico (Dólares y Bolívares) que realmente existe en la gaveta, y contrastarlo con el cálculo que el sistema lleva acumulado desde que se abrió la caja.',
    steps: [
      {
        title: '1. Separar y agrupar billetes por denominación',
        desc: 'Organiza por separado los billetes de USD (1$, 5$, 10$, 20$, 50$, 100$) y de Bolívares (Bs. 5, 10, 20, 50, 100, etc.).',
      },
      {
        title: '2. Contar el efectivo real en la gaveta',
        desc: 'Suma el total de dólares en mano e ingrésalo en la casilla "Conteo Físico Contado (REF)". Haz lo mismo con los Bolívares en "Conteo Físico Contado (Bs.)".',
      },
      {
        title: '3. Evaluar la Diferencia (Faltante o Sobrante)',
        desc: 'El sistema calcula en tiempo real si el conteo físico es igual, mayor (sobrante) o menor (faltante) respecto al saldo esperado.',
      },
      {
        title: '4. Conciliar métodos bancarios (Punto de Venta / Pago Móvil)',
        desc: 'Saca el reporte de Cierre de Lote del Punto de Venta inalámbrico/alámbrico y verifica que coincida con el total de "Punto de Venta" del sistema. Revisa las transferencias y pagos móviles recibidos.',
      },
      {
        title: '5. Registrar observaciones y confirmar el cierre',
        desc: 'Si hubo alguna diferencia por redondeo de cambio o propina, anótala en las observaciones y pulsa "Confirmar Cierre de Turno". El turno queda congelado y auditado.',
      },
    ],
    formula: {
      title: 'Fórmula de Verificación de Caja',
      expression: 'Saldo Esperado = Fondo Inicial + Total Ventas en Efectivo - Vueltos Entregados',
      explanation:
        'Diferencia = Conteo Físico - Saldo Esperado. Si es 0 está cuadrado. Si es negativo (-), hay un faltante de dinero. Si es positivo (+), hay un sobrante.',
    },
    keyTips: [
      'No mezcles el dinero de las ventas con el fondo inicial: el sistema los suma automáticamente.',
      'Imprime el Cierre de Lote de tu datáfono/punto antes de cerrar el turno en el software.',
      'Descarga el Excel del turno para archivar el comprobante contable firmado por cajero y supervisor.',
    ],
  },

  apertura_caja: {
    id: 'apertura_caja',
    title: 'Apertura de Turno & Fondo de Caja (Base)',
    category: 'Inicio de Operaciones',
    shortSummary: 'Registro del dinero base disponible en gaveta para dar vueltos antes de realizar la primera venta.',
    icon: <Wallet className="w-5 h-5 text-emerald-600" />,
    concept:
      'La apertura de caja inicia el turno de trabajo asignado a un cajero específico. Define el fondo de cambio o "base" inicial en Dólares (USD) y en Bolívares (VES), y fija la tasa oficial de cambio del Banco Central de Venezuela (BCV) con la que operará el turno.',
    steps: [
      {
        title: '1. Recibir la gaveta de caja con el fondo asignado',
        desc: 'El supervisor o dueño entrega al cajero un monto fijo en billetes de baja denominación para iniciar la jornada y poder dar cambio a los primeros clientes.',
      },
      {
        title: '2. Contar la base antes de ingresar al sistema',
        desc: 'Verifica físicamente que los dólares y bolívares entregados coincidan con el monto a declarar.',
      },
      {
        title: '3. Ingresar Fondo Inicial USD y VES',
        desc: 'Escribe los valores en el formulario. Por ejemplo: $50 en billetes pequeños y Bs. 2.000.',
      },
      {
        title: '4. Verificar Tasa Oficial BCV',
        desc: 'El sistema toma automáticamente la tasa BCV del día para valorar los productos y calcular equivalencias.',
      },
      {
        title: '5. Confirmar Apertura',
        desc: 'El módulo POS queda habilitado inmediatamente para facturar y emitir notas de venta.',
      },
    ],
    keyTips: [
      'Nunca inicies un turno con fondo 0 si vas a cobrar en efectivo; de lo contrario, el primer cliente que pague en efectivo no tendrá vuelto disponible.',
      'Solo debe haber un turno activo por cajero a la vez para mantener la trazabilidad de auditoría.',
    ],
  },

  diferencia_arqueo: {
    id: 'diferencia_arqueo',
    title: 'Cálculo de Diferencia en Arqueo (Faltante vs Sobrante)',
    category: 'Matemática Contable',
    shortSummary: 'Cómo interpretar y resolver las discrepancias entre el dinero que el sistema esperaba y el dinero que realmente se contó.',
    icon: <Calculator className="w-5 h-5 text-indigo-600" />,
    concept:
      'Durante el turno, cada venta pagada en efectivo incrementa el saldo teórico de la caja. El arqueo compara ese saldo teórico contra los billetes reales que se encuentran físicamente en la gaveta.',
    steps: [
      {
        title: 'Cuadrado Exacto (Diferencia = $0.00 / Bs. 0.00)',
        desc: 'El dinero físico coincide al 100% con las ventas y el fondo inicial. Es el escenario ideal.',
      },
      {
        title: 'Faltante de Caja (Diferencia Negativa -)',
        desc: 'Hay MENOS dinero en la gaveta del que debería haber. Causas comunes: vuelto entregado de más por error, billete extraviado o cobro omitido.',
      },
      {
        title: 'Sobrante de Caja (Diferencia Positiva +)',
        desc: 'Hay MÁS dinero en la gaveta del que el sistema registra. Causas comunes: propina dejada por un cliente que no se registró, cliente que no esperó el cambio pequeño, o venta no ingresada en el sistema.',
      },
      {
        title: 'Qué hacer ante una diferencia',
        desc: 'Vuelve a contar los billetes. Si la diferencia persiste, descríbela detalladamente en el campo "Observaciones de Cierre".',
      },
    ],
    formula: {
      title: 'Fórmula de Arqueo',
      expression: 'Diferencia = Conteo Físico Real - (Fondo Inicial + Ventas Efectivo)',
      explanation: 'Verde si es ≥ 0. Rojo si es negativo (faltante).',
    },
    keyTips: [
      'Si el faltante es de un billete exacto (ej. exactamente $10 o Bs. 50), revisa si se cayó detrás de la gaveta o si un pago fue registrado erróneamente como efectivo en vez de pago móvil.',
    ],
  },

  exportar_arqueo: {
    id: 'exportar_arqueo',
    title: 'Exportación de Turno & Auditoría en Excel',
    category: 'Reportes & Exportación',
    shortSummary: 'Generación de una planilla oficial en formato .XLSX con el desglose contable completo del turno.',
    icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
    concept:
      'Descarga un archivo Excel detallado que resume las ventas totales en USD y VES, ventas separadas por método de pago (Efectivo USD/VES, Pago Móvil, Punto de Venta, Zelle, Transferencias), fondos iniciales, conteos físicos y diferencias.',
    steps: [
      {
        title: '1. Clic en "Exportar Turno Excel"',
        desc: 'El sistema recopila todas las notas emitidas dentro del turno seleccionado.',
      },
      {
        title: '2. Hoja 1: Resumen Ejecutivo',
        desc: 'Muestra la carátula contable: cajero, fechas y horas, tasa BCV, totales por método y balance del arqueo.',
      },
      {
        title: '3. Hoja 2: Listado Detallado de Notas',
        desc: 'Incluye cada nota de venta con cliente, documento, estado, métodos de pago utilizados y montos.',
      },
      {
        title: '4. Firma y Respaldo Físico/Digital',
        desc: 'Puedes imprimir la planilla para que sea firmada por el cajero saliente y el supervisor receptor de la guardia.',
      },
    ],
    keyTips: [
      'Este archivo sirve como soporte contable ante auditorías tributarias y para el control de inventario cruzado.',
    ],
  },

  pagar_luego: {
    id: 'pagar_luego',
    title: 'Pagar Luego: Venta a Crédito / Fiado en Bolívares Fijos',
    category: 'Punto de Venta (POS)',
    shortSummary: 'Permite despachar la mercancía al cliente sin cobrar de inmediato, registrando la deuda congelada en Bolívares.',
    icon: <Clock className="w-5 h-5 text-amber-600" />,
    concept:
      'En el comercio venezolano es habitual despachar productos a clientes frecuentes para cobrar al final del día o de la semana. Esta opción emite la Nota de Entrega, descuenta el stock de inventario de inmediato, y carga el saldo pendiente a la cuenta por cobrar del cliente.',
    steps: [
      {
        title: '1. Seleccionar el Cliente correspondiente',
        desc: 'La venta a crédito requiere obligatoriamente asociarse a un cliente registrado (nombre, cédula/RIF y teléfono).',
      },
      {
        title: '2. Revisar los productos en el carrito',
        desc: 'Verifica los artículos y cantidades que el cliente se llevará fiados.',
      },
      {
        title: '3. Pulsar "Pagar Luego (Fiado en Bs Fijos)"',
        desc: 'El sistema emite la nota en estado "Pendiente" y congela el importe exacto en Bolívares según la tasa BCV de este momento.',
      },
      {
        title: '4. Cobro posterior',
        desc: 'Cuando el cliente regrese a cancelar, puedes ingresar a su ficha en "Gestión de Clientes" o buscar la nota en "Historial" y registrar el abono o pago total.',
      },
    ],
    keyTips: [
      'El inventario se rebaja al instante de emitir la nota para que no haya descuadres físicos en almacén.',
      'No uses esta opción con clientes de paso no identificados.',
    ],
  },

  cobro_multimoneda: {
    id: 'cobro_multimoneda',
    title: 'Cobro Multimoneda & Vueltos Inteligentes',
    category: 'Punto de Venta (POS)',
    shortSummary: 'Cómo registrar pagos combinados en dólares y bolívares, cálculo de IGTF (3%) y entrega de cambio en la moneda preferida.',
    icon: <CreditCard className="w-5 h-5 text-indigo-600" />,
    concept:
      'Permite pagar una misma cuenta con múltiples medios de pago: por ejemplo, una parte en Efectivo Divisas, otra por Pago Móvil y el restante con Punto de Venta. El sistema calcula en tiempo real si se cubre el total y cuánto vuelto corresponde entregar.',
    steps: [
      {
        title: '1. Agregar canales de pago',
        desc: 'Utiliza los botones de atajo rápido ("100% Pago Móvil", "100% Efectivo REF", "100% Punto") o agrega varios métodos con el botón "+ Otro".',
      },
      {
        title: '2. Ingresar montos recibidos',
        desc: 'Escribe cuánto dinero entregó el cliente en cada canal. Para pagos electrónicos, anota los últimos 4 dígitos o número de comprobante.',
      },
      {
        title: '3. Impuesto a las Grandes Transacciones Financieras (IGTF 3%)',
        desc: 'Si la venta incluye pagos en efectivo divisas, el sistema calcula automáticamente el 3% de IGTF exigido por ley sobre la porción pagada en divisas.',
      },
      {
        title: '4. Selección de Moneda para Vuelto',
        desc: 'Elige si entregarás el vuelto en Bolívares (VES), Dólares (REF) o Mixto. El sistema te indicará la cantidad exacta en cada divisa.',
      },
      {
        title: '5. Confirmar Venta',
        desc: 'Se descuenta el inventario, se suma el dinero a la caja y se genera la Nota de Entrega imprimible en 80mm.',
      },
    ],
    keyTips: [
      'Verifica siempre la recepción del Pago Móvil en tu banco antes de pulsar "Confirmar Venta".',
      'Si el cliente paga en divisas y no tienes billetes de dólar pequeños para vuelto, selecciona "Preferencia de Vuelto: Bolívares (VES)" para entregarle el cambio al cambio BCV.',
    ],
  },

  anular_nota: {
    id: 'anular_nota',
    title: 'Anulación de Nota de Venta & Reversión de Stock',
    category: 'Auditoría & Devoluciones',
    shortSummary: 'Cómo anular una venta errónea, reincorporar los productos al almacén y descontar el dinero de la caja.',
    icon: <Ban className="w-5 h-5 text-rose-600" />,
    concept:
      'La anulación es una operación restringida (solo para Administradores) que cancela formalmente una nota emitida por equivocación o por devolución completa del cliente. Reintegra los productos al inventario disponible y revierte los montos de la caja.',
    steps: [
      {
        title: '1. Localizar la nota en la tabla',
        desc: 'Usa el buscador por número de nota o nombre de cliente.',
      },
      {
        title: '2. Clic en el icono de anular (Ban)',
        desc: 'Se abre el diálogo de confirmación de anulación.',
      },
      {
        title: '3. Ingresar motivo obligatorio',
        desc: 'Escribe la razón justificada (ej. "Error en cantidad digitada", "Cliente canceló el pedido").',
      },
      {
        title: '4. Confirmar anulación',
        desc: 'La nota queda marcada en rojo como "Anulada" para auditoría y su impacto financiero se neutraliza.',
      },
    ],
    keyTips: [
      'Las notas anuladas nunca se borran físicamente de la base de datos para preservar la trazabilidad legal y evitar fraudes.',
    ],
  },
};

interface ActionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicKey: HelpTopicKey | null;
}

export const ActionHelpModal: React.FC<ActionHelpModalProps> = ({
  isOpen,
  onClose,
  topicKey,
}) => {
  if (!isOpen || !topicKey) return null;

  const topic = HELP_TOPICS[topicKey];
  if (!topic) return null;

  return (
    <div
      id={`help-modal-${topic.id}`}
      className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente sutil y categoría */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white shadow-xs border border-slate-200/80 shrink-0">
              {topic.icon}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block mb-1">
                {topic.category}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {topic.title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {topic.shortSummary}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Cerrar guía"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll natural */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-700">
          {/* ¿De qué trata? */}
          <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200/80">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              ¿De qué trata y por qué es importante?
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
              {topic.concept}
            </p>
          </div>

          {/* Fórmula si aplica */}
          {topic.formula && (
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5 sm:p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-1 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-700" />
                {topic.formula.title}
              </h4>
              <div className="p-2.5 bg-white rounded-lg border border-indigo-100 font-mono text-xs sm:text-sm font-bold text-indigo-950 my-1.5">
                {topic.formula.expression}
              </div>
              <p className="text-[11px] text-indigo-800 leading-normal">
                {topic.formula.explanation}
              </p>
            </div>
          )}

          {/* Paso a paso: ¿Cómo se hace? */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              Paso a Paso: ¿Cómo se hace?
            </h4>
            <div className="space-y-2">
              {topic.steps.map((st, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900 mb-0.5">
                    {st.title}
                  </div>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    {st.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consejos y buenas prácticas */}
          {topic.keyTips.length > 0 && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5">
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Recomendaciones Clave:
              </h4>
              <ul className="text-xs text-amber-900/90 space-y-1 pl-5 list-disc">
                {topic.keyTips.map((tip, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Control Operativo Multi-Moneda
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Entendido, volver
          </button>
        </div>
      </div>
    </div>
  );
};

interface InfoHelpButtonProps {
  topicKey: HelpTopicKey;
  onOpenHelp: (topic: HelpTopicKey) => void;
  className?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const InfoHelpButton: React.FC<InfoHelpButtonProps> = ({
  topicKey,
  onOpenHelp,
  className = '',
  label,
  size = 'sm',
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenHelp(topicKey);
      }}
      className={`inline-flex items-center justify-center gap-1 text-slate-400 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all cursor-pointer shadow-2xs ${
        size === 'sm' ? 'p-1.5 text-xs' : 'px-2 py-1 text-xs'
      } ${className}`}
      title="¿De qué trata y cómo se hace? Haz clic para ver la guía interactiva"
      aria-label="Ver ayuda y explicación"
    >
      <HelpCircle className={size === 'sm' ? 'w-3.5 h-3.5 text-indigo-500' : 'w-4 h-4 text-indigo-600'} />
      {label && <span className="font-semibold text-slate-600">{label}</span>}
    </button>
  );
};
