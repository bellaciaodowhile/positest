/**
 * Servicio de Tasa Cambiaria BCV con cacheo offline-first
 */

export interface BCVState {
  rate: number;
  lastUpdated: string;
  source: string;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_BCV_RATE = 68.50; // Tasa de referencia por defecto
const CACHE_KEY = 'pos_bcv_rate_data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache

/**
 * Obtener tasa BCV del cache o localStorage
 */
export function getStoredBCVRate(): number {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
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

/**
 * Guardar tasa BCV en localStorage
 */
export function saveStoredBCVRate(rate: number, source = 'Manual'): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
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
 * Verificar si el cache de BCV está fresco
 */
export function isBCVCacheFresh(): boolean {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.lastUpdated) {
        const lastUpdate = new Date(parsed.lastUpdated).getTime();
        return Date.now() - lastUpdate < CACHE_TTL;
      }
    }
  } catch {
    // Ignorar errores
  }
  return false;
}

/**
 * Consulta la API oficial del Dólar BCV en Venezuela
 */
export async function fetchLiveBCVRate(): Promise<{ rate: number; source: string; timestamp: string }> {
  // Verificar cache primero
  if (isBCVCacheFresh()) {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          rate: parsed.rate,
          source: parsed.source || 'Cache Local',
          timestamp: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    } catch {
      // Continuar a API si hay error
    }
  }

  // Intentar dolarapi.com
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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
    const res = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv', {
      cache: 'no-store',
    });
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

import Decimal from 'decimal.js';

/**
 * Conversión USD a VES con la tasa BCV indicada
 */
export function usdToVes(amountUSD: number | string, bcvRate: number): number {
  const numAmount = typeof amountUSD === 'string' ? parseFloat(amountUSD) : amountUSD;
  if (isNaN(numAmount) || numAmount <= 0) return 0;
  const result = new Decimal(numAmount).mul(bcvRate).toFixed(2);
  return Number(result);
}

/**
 * Conversión VES a USD con la tasa BCV indicada
 */
export function vesToUsd(amountVES: number, bcvRate: number): number {
  if (!bcvRate || bcvRate <= 0) return 0;
  const result = new Decimal(amountVES).div(bcvRate).toFixed(2);
  return Number(result);
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
  const result = new Decimal(amountUSD).mul(IGTF_PERCENT).toFixed(2);
  return Number(result);
}

/**
 * Algoritmo de Vuelto Exacto Multidivisa
 */
export function calculateExactChange({
  totalUSD,
  paidUSD,
  paidVES,
  bcvRate,
  preferVueltoEn = 'VES',
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
    // Mixto
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

