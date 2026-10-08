/**
 * Servicio de Cálculo de Costos y Precios
 * Calcula el precio de venta por unidad a partir del costo total y margen de ganancia
 */

export interface CostCalculationResult {
  costoTotal: number;
  margenGananciaPorcentaje: number;
  unidades: number;
  montoGananciaTotal: number;
  precioVentaTotal: number;
  precioPorUnidad: number;
  pasos: string[];
}

/**
 * Calcula el precio de venta por unidad
 * @param costoTotal - Costo total de producción del paquete
 * @param margenGanancia - Margen de ganancia deseado en porcentaje (ej: 30 para 30%)
 * @param unidades - Cantidad de unidades en el paquete
 * @returns Resultado con desglose completo del cálculo
 */
export function calcularPrecioVentaPorUnidad(
  costoTotal: number,
  margenGanancia: number,
  unidades: number
): CostCalculationResult {
  const pasos: string[] = [];
  
  // Validación básica
  if (costoTotal <= 0) {
    throw new Error('El costo total debe ser mayor a 0');
  }
  if (margenGanancia < 0 || margenGanancia > 100) {
    throw new Error('El margen de ganancia debe estar entre 0 y 100%');
  }
  if (unidades <= 0) {
    throw new Error('La cantidad de unidades debe ser mayor a 0');
  }

  // Paso 1: Calcular el monto de ganancia total
  const montoGananciaTotal = costoTotal * (margenGanancia / 100);
  pasos.push(
    `1. CÁLCULO DE GANANCIA TOTAL:\n` +
    `   Costo Total: $${costoTotal.toFixed(2)}\n` +
    `   Margen Deseado: ${margenGanancia}%\n` +
    `   Ganancia Total = $${costoTotal.toFixed(2)} × (${margenGanancia}/100) = $${montoGananciaTotal.toFixed(2)}`
  );

  // Paso 2: Calcular el precio de venta total del paquete
  const precioVentaTotal = costoTotal + montoGananciaTotal;
  pasos.push(
    `\n2. PRECIO DE VENTA TOTAL DEL PAQUETE:\n` +
    `   Costo Total: $${costoTotal.toFixed(2)}\n` +
    `   Ganancia Total: $${montoGananciaTotal.toFixed(2)}\n` +
    `   Precio Total = $${costoTotal.toFixed(2)} + $${montoGananciaTotal.toFixed(2)} = $${precioVentaTotal.toFixed(2)}`
  );

  // Paso 3: Calcular el precio por unidad
  const precioPorUnidad = precioVentaTotal / unidades;
  pasos.push(
    `\n3. PRECIO POR UNIDAD:\n` +
    `   Precio Total del Paquete: $${precioVentaTotal.toFixed(2)}\n` +
    `   Cantidad de Unidades: ${unidades}\n` +
    `   Precio por Unidad = $${precioVentaTotal.toFixed(2)} ÷ ${unidades} = $${precioPorUnidad.toFixed(2)}`
  );

  return {
    costoTotal,
    margenGananciaPorcentaje: margenGanancia,
    unidades,
    montoGananciaTotal,
    precioVentaTotal,
    precioPorUnidad,
    pasos,
  };
}

/**
 * Calcula el margen de ganancia real basado en el costo y el precio de venta
 */
export function calcularMargenReal(costo: number, precioVenta: number): number {
  if (costo <= 0 || precioVenta <= 0) {
    return 0;
  }
  return ((precioVenta - costo) / costo) * 100;
}

/**
 * Formatea el resultado para mostrarlo en la interfaz
 */
export function formatearResultadoCalculo(result: CostCalculationResult): string {
  return result.pasos.join('\n') + `\n\nRESULTADO FINAL:\n` +
    `· Precio de Venta por Unidad: $${result.precioPorUnidad.toFixed(2)}`;
}
