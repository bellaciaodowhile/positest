export interface BCVState {
  rate: number;
  lastUpdated: string;
  source: string;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_BCV_RATE = 68.50; // Tasa de referencia por defecto
const STORAGE_KEY = 'pos_bcv_rate_data';

export function getStoredBCVRate(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.rate === 'number' && parsed.rate > 0) {
        return parsed.rate;
      }
    }
  } catch (e) {
    console.error('Error reading BCV rate from storage', e);
  }
  return DEFAULT_BCV_RATE;
}

export function saveStoredBCVRate(rate: number, source = 'Manual') {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rate,
        source,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.error('Error saving BCV rate to storage', e);
  }
}

/**
 * Consulta la API oficial / pública del Dólar BCV en Venezuela.
 * Intenta primero con dolarapi.com y luego con pydolarvenezuela como fallback.
 */
export async function fetchLiveBCVRate(): Promise<{ rate: number; source: string; timestamp: string }> {
  // Intentar dolarapi.com
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const val = parseFloat(data.promedio || data.precio || data.monto);
      if (!isNaN(val) && val > 0) {
        saveStoredBCVRate(val, 'API DolarAPI BCV');
        return {
          rate: Number(val.toFixed(4)),
          source: 'DolarAPI Oficial BCV',
          timestamp: data.fechaActualizacion || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('Fallo consulta a dolarapi, intentando alternativa...', err);
  }

  // Intentar pydolarvenezuela
  try {
    const res = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv');
    if (res.ok) {
      const data = await res.json();
      const val = parseFloat(data?.monitors?.usd?.price || data?.price);
      if (!isNaN(val) && val > 0) {
        saveStoredBCVRate(val, 'PyDolar BCV');
        return {
          rate: Number(val.toFixed(4)),
          source: 'PyDolar Venezuela (BCV)',
          timestamp: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('Fallo consulta a pydolarvenezuela', err);
  }

  // Fallback con valor guardado o por defecto
  const fallback = getStoredBCVRate();
  return {
    rate: fallback,
    source: 'Tasa en Caché / Manual',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Conversión USD a VES con la tasa BCV indicada
 */
export function usdToVes(amountUSD: number, bcvRate: number): number {
  return Number((amountUSD * bcvRate).toFixed(2));
}

/**
 * Conversión VES a USD con la tasa BCV indicada
 */
export function vesToUsd(amountVES: number, bcvRate: number): number {
  if (!bcvRate || bcvRate <= 0) return 0;
  return Number((amountVES / bcvRate).toFixed(2));
}

/**
 * Formato de precio en divisas de referencia REF (REF 1,250.00)
 */
export function formatUSD(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `REF ${formatted}`;
}

/**
 * Formato de moneda Bolívares (Bs. 1.250,00)
 */
export function formatVES(amount: number): string {
  return (
    'Bs. ' +
    new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}

/**
 * Cálculo del 3% IGTF aplicable a pagos en divisas o moneda extranjera en efectivo/digital
 */
export const IGTF_PERCENT = 0.03;

export function calculateIGTF(amountUSD: number): number {
  return Number((amountUSD * IGTF_PERCENT).toFixed(2));
}

/**
 * Algoritmo de Vuelto Exacto Multidivisa:
 * Determina el monto del vuelto en USD y/o en Bolívares dependiendo de
 * los montos pagados y la tasa oficial.
 */
export function calculateExactChange({
  totalUSD,
  paidUSD,
  paidVES,
  bcvRate,
  preferVueltoEn = 'VES', // 'VES' o 'USD' o 'MIXTO'
}: {
  totalUSD: number;
  paidUSD: number;
  paidVES: number;
  bcvRate: number;
  preferVueltoEn?: 'VES' | 'USD' | 'MIXTO';
}) {
  const totalPaidInUSD = paidUSD + (paidVES / bcvRate);
  const diffUSD = totalPaidInUSD - totalUSD;

  if (diffUSD <= 0.001) {
    return {
      hasChange: false,
      differenceUSD: 0,
      vueltoUSD: 0,
      vueltoVES: 0,
      mensaje: 'Pago exacto o pendiente',
    };
  }

  let vueltoUSD = 0;
  let vueltoVES = 0;

  if (preferVueltoEn === 'USD') {
    vueltoUSD = Math.floor(diffUSD * 100) / 100;
    const remainingFractionUSD = diffUSD - vueltoUSD;
    vueltoVES = Number((remainingFractionUSD * bcvRate).toFixed(2));
  } else if (preferVueltoEn === 'VES') {
    vueltoUSD = 0;
    vueltoVES = Number((diffUSD * bcvRate).toFixed(2));
  } else {
    // Mixto: Dar billetes enteros en USD y el residuo fraccionario en Bolívares (muy común en Venezuela)
    vueltoUSD = Math.floor(diffUSD);
    const fractionUSD = diffUSD - vueltoUSD;
    vueltoVES = Number((fractionUSD * bcvRate).toFixed(2));
  }

  return {
    hasChange: true,
    differenceUSD: Number(diffUSD.toFixed(2)),
    differenceVES: Number((diffUSD * bcvRate).toFixed(2)),
    vueltoUSD,
    vueltoVES,
    mensaje: `Vuelto a entregar: ${vueltoUSD > 0 ? formatUSD(vueltoUSD) : ''} ${
      vueltoUSD > 0 && vueltoVES > 0 ? '+ ' : ''
    }${vueltoVES > 0 ? formatVES(vueltoVES) : ''}`,
  };
}

export const fetchBCVRate = fetchLiveBCVRate;

