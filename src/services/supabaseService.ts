/**
 * Servicio de Sincronización con Supabase con soporte offline-first
 * Cuando no hay conexión, las operaciones se guardan en cola para sincronizar luego
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  toValidUUID,
  isValidUUID,
  generateUUID,
  mapUserToUUID,
  mapClientToUUID,
} from './uuidUtils';
import {
  Product,
  Client,
  Supplier,
  SaleNote,
  SaleItem,
  PaymentItem,
  CashShift,
  Expense,
  AccountReceivable,
  AccountPayable,
  AuditLog,
  User,
  InventoryMovement,
  PaymentMethodType,
} from '../types';
import { addToQueue, processQueue } from './syncQueue';
import { onlineMonitor } from './onlineMonitor';

/**
 * Carga todo el conjunto de datos desde Supabase si está conectado
 */
export async function loadAllDataFromSupabase(): Promise<{
  success: boolean;
  data?: {
    products: Product[];
    clients: Client[];
    suppliers: Supplier[];
    sales: SaleNote[];
    expenses: Expense[];
    cxc: AccountReceivable[];
    cxp: AccountPayable[];
    activeShift: CashShift | null;
    shiftHistory: CashShift[];
    users: User[];
    auditLogs: AuditLog[];
  };
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase no está configurado.' };
  }

  const client = getSupabaseClient();
  if (!client || !onlineMonitor.isOnline()) {
    // Si no hay conexión, retornar datos locales
    return { success: true, data: undefined };
  }

  try {
    // 1. Productos
    const { data: prodData, error: prodErr } = await client
      .from('productos')
      .select('*')
      .order('nombre');

    if (prodErr) throw prodErr;

    const products: Product[] = (prodData || []).map((p: any) => ({
      id: p.id,
      codigoBarras: p.codigo_barras,
      nombre: p.nombre,
      categoria: p.categoria,
      clasificacion: p.clasificacion as 'gravable' | 'exento',
      costoUSD: Number(p.costo_usd),
      margenGanancia: Number(p.margen_ganancia),
      precioUSD: Number(p.precio_usd),
      stockActual: Number(p.stock_actual),
      stockMinimo: Number(p.stock_minimo),
      unidadMedida: p.unidad_medida || 'unidad',
      descripcion: p.descripcion || '',
      fechaActualizacion: p.fecha_actualizacion || p.created_at || new Date().toISOString(),
    }));

    // 2. Clientes
    const { data: clientData, error: clientErr } = await client
      .from('clientes')
      .select('*')
      .order('nombre');
    if (clientErr) throw clientErr;

    const clients: Client[] = (clientData || []).map((c: any) => ({
      id: c.id,
      documento: c.documento,
      nombre: c.nombre,
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      email: c.email || '',
      limiteCreditoUSD: Number(c.limite_credito_usd || 0),
    }));

    // 3. Proveedores
    const { data: suppData, error: suppErr } = await client
      .from('proveedores')
      .select('*')
      .order('nombre');
    if (suppErr) throw suppErr;

    const suppliers: Supplier[] = (suppData || []).map((s: any) => ({
      id: s.id,
      rif: s.rif,
      nombre: s.nombre,
      contacto: s.contacto || '',
      telefono: s.telefono || '',
      direccion: s.direccion || '',
    }));

    // 4. Usuarios
    const { data: userData, error: userErr } = await client
      .from('usuarios')
      .select('*')
      .order('created_at');
    if (userErr) throw userErr;

    const users: User[] = (userData || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol as 'admin' | 'cajero' | 'inventario',
      activo: Boolean(u.activo),
      ultimoAcceso: u.ultimo_acceso || undefined,
    }));

    // 5. Cajas y Turnos
    const { data: shiftData, error: shiftErr } = await client
      .from('cajas_turnos')
      .select('*')
      .order('fecha_apertura', { ascending: false });
    if (shiftErr) throw shiftErr;

    const allShifts: CashShift[] = (shiftData || []).map((ct: any) => {
      const cajero = users.find((u) => u.id === ct.cajero_id);
      return {
        id: ct.id,
        cajeroId: ct.cajero_id,
        cajeroNombre: cajero ? cajero.nombre : 'Cajero',
        fechaApertura: ct.fecha_apertura,
        fechaCierre: ct.fecha_cierre || undefined,
        estado: ct.estado as 'abierta' | 'cerrada',
        fondoInicialUSD: Number(ct.fondo_inicial_usd || 0),
        fondoInicialVES: Number(ct.fondo_inicial_ves || 0),
        tasaBCV: Number(ct.tasa_bcv),
        ventasEfectivoUSD: 0,
        ventasEfectivoVES: 0,
        ventasPuntoVentaVES: 0,
        ventasPagoMovilVES: 0,
        ventasZelleUSD: 0,
        ventasTransferenciaVES: 0,
        ventasIGTFUSD: 0,
        totalVendidoUSD: 0,
        totalVendidoVES: 0,
        arqueoFisicoUSD: ct.arqueo_fisico_usd !== null ? Number(ct.arqueo_fisico_usd) : undefined,
        arqueoFisicoVES: ct.arqueo_fisico_ves !== null ? Number(ct.arqueo_fisico_ves) : undefined,
        diferenciaUSD: ct.diferencia_usd !== null ? Number(ct.diferencia_usd) : undefined,
        diferenciaVES: ct.diferencia_ves !== null ? Number(ct.diferencia_ves) : undefined,
        observacionesCierre: ct.observaciones || undefined,
      };
    });

    const activeShift = allShifts.find((s) => s.estado === 'abierta') || null;
    const shiftHistory = allShifts.filter((s) => s.estado === 'cerrada');

    // 6. Ventas con items y pagos
    const { data: salesData, error: salesErr } = await client
      .from('ventas_notas')
      .select(`
        *,
        ventas_items (*),
        ventas_pagos (*)
      `)
      .order('fecha', { ascending: false });
    if (salesErr) throw salesErr;

    const sales: SaleNote[] = (salesData || []).map((vn: any) => {
      const cliente = clients.find((c) => c.id === vn.cliente_id);
      const cajero = users.find((u) => u.id === vn.cajero_id);

      const items: SaleItem[] = (vn.ventas_items || []).map((it: any) => ({
        productoId: it.producto_id,
        nombre: it.nombre_producto || '',
        codigoBarras: it.codigo_barras || '',
        cantidad: Number(it.cantidad),
        precioUnitarioUSD: Number(it.precio_unitario_usd),
        precioUnitarioVES: Number(it.precio_unitario_ves),
        costoUnitarioUSD: Number(it.costo_unitario_usd),
        clasificacion: it.clasificacion as 'gravable' | 'exento',
        subtotalUSD: Number(it.subtotal_usd),
        subtotalVES: Number(it.subtotal_ves),
        ivaUSD: Number(it.iva_usd || 0),
        ivaVES: Number(it.iva_ves || 0),
        totalUSD: Number(it.total_usd),
        totalVES: Number(it.total_ves),
      }));

      const pagos: PaymentItem[] = (vn.ventas_pagos || []).map((p: any) => ({
        metodo: p.metodo as PaymentMethodType,
        nombreMetodo: p.nombre_metodo,
        moneda: p.moneda as 'USD' | 'VES',
        montoOriginal: Number(p.monto_original),
        montoUSD: Number(p.monto_usd),
        montoVES: Number(p.monto_ves),
        tasaBCV: Number(p.tasa_bcv),
        aplicaIGTF: Boolean(p.aplica_igtf),
        montoIGTFUSD: Number(p.monto_igtf_usd || 0),
        montoIGTFVES: Number(p.monto_igtf_ves || 0),
        referencia: p.referencia || undefined,
      }));

      return {
        id: vn.id,
        numeroNota: vn.numero_nota,
        clienteId: vn.cliente_id,
        clienteNombre: cliente ? cliente.nombre : 'Consumidor Final',
        clienteDocumento: cliente ? cliente.documento : 'V-00000000',
        cajeroId: vn.cajero_id,
        cajeroNombre: cajero ? cajero.nombre : 'Cajero',
        turnoId: vn.turno_id || '',
        fecha: vn.fecha,
        tasaBCV: Number(vn.tasa_bcv),
        tasaIVA: Number(vn.tasa_iva || 0.16),
        items,
        pagos,
        subtotalExentoUSD: Number(vn.subtotal_exento_usd || 0),
        subtotalGravableUSD: Number(vn.subtotal_gravable_usd || 0),
        ivaUSD: Number(vn.iva_usd || 0),
        igtfUSD: Number(vn.igtf_usd || 0),
        totalUSD: Number(vn.total_usd),
        totalVES: Number(vn.total_ves),
        costoTotalUSD: Number(vn.costo_total_usd || 0),
        utilidadBrutaUSD: Number(vn.utilidad_bruta_usd || 0),
        montoRecibidoUSD: Number(vn.monto_recibido_usd || 0),
        montoRecibidoVES: Number(vn.monto_recibido_ves || 0),
        vueltoUSD: Number(vn.vuelto_usd || 0),
        vueltoVES: Number(vn.vuelto_ves || 0),
        estado: vn.estado as 'completada' | 'anulada',
        motivoAnulacion: vn.motivo_anulacion || undefined,
        anuladaPor: vn.anulada_por || undefined,
        fechaAnulacion: vn.fecha_anulacion || undefined,
      };
    });

    // 7. Gastos
    const { data: expenseData, error: expErr } = await client
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false });
    if (expErr) throw expErr;

    const expenses: Expense[] = (expenseData || []).map((g: any) => {
      const u = users.find((usr) => usr.id === g.usuario_id);
      return {
        id: g.id,
        concepto: g.concepto,
        categoria: g.categoria as any,
        montoUSD: Number(g.monto_usd),
        montoVES: Number(g.monto_ves),
        tasaBCV: Number(g.tasa_bcv),
        metodoPago: g.metodo_pago as PaymentMethodType,
        fecha: g.fecha,
        usuarioId: g.usuario_id || '',
        usuarioNombre: u ? u.nombre : 'Sistema',
        comprobanteRef: g.comprobante_ref || undefined,
        observaciones: g.observaciones || undefined,
      };
    });

    // 8. Cuentas por cobrar
    const { data: cxcData, error: cxcErr } = await client
      .from('cuentas_por_cobrar')
      .select('*')
      .order('fecha_emision', { ascending: false });
    if (cxcErr) throw cxcErr;

    const cxc: AccountReceivable[] = (cxcData || []).map((item: any) => {
      const cliente = clients.find((c) => c.id === item.cliente_id);
      return {
        id: item.id,
        clienteId: item.cliente_id,
        clienteNombre: cliente ? cliente.nombre : 'Cliente',
        clienteDocumento: cliente ? cliente.documento : 'V-00000000',
        notaVentaId: item.venta_id || '',
        montoTotalUSD: Number(item.monto_total_usd),
        montoAbonadoUSD: Number(item.monto_abonado_usd || 0),
        saldoPendienteUSD: Number(item.saldo_pendiente_usd),
        montoTotalVES: item.monto_total_ves ? Number(item.monto_total_ves) : Number(item.monto_total_usd) * 68.5,
        montoAbonadoVES: item.monto_abonado_ves ? Number(item.monto_abonado_ves) : Number(item.monto_abonado_usd || 0) * 68.5,
        saldoPendienteVES: item.saldo_pendiente_ves ? Number(item.saldo_pendiente_ves) : Number(item.saldo_pendiente_usd) * 68.5,
        monedaFijada: item.moneda_fijada || 'USD',
        fechaEmision: item.fecha_emision,
        fechaVencimiento: item.fecha_vencimiento,
        estado: item.estado as any,
        abonos: Array.isArray(item.abonos) ? item.abonos : [],
      };
    });

    // 9. Cuentas por pagar
    const { data: cxpData, error: cxpErr } = await client
      .from('cuentas_por_pagar')
      .select('*')
      .order('fecha_emision', { ascending: false });
    if (cxpErr) throw cxpErr;

    const cxp: AccountPayable[] = (cxpData || []).map((item: any) => {
      const proveedor = suppliers.find((s) => s.id === item.proveedor_id);
      return {
        id: item.id,
        proveedorId: item.proveedor_id,
        proveedorNombre: proveedor ? proveedor.nombre : 'Proveedor',
        proveedorRif: proveedor ? proveedor.rif : 'J-00000000-0',
        numeroFacturaProvedor: item.numero_factura_proveedor || '',
        montoTotalUSD: Number(item.monto_total_usd),
        montoAbonadoUSD: Number(item.monto_abonado_usd || 0),
        saldoPendienteUSD: Number(item.saldo_pendiente_usd),
        fechaEmision: item.fecha_emision,
        fechaVencimiento: item.fecha_vencimiento,
        estado: item.estado as any,
        abonos: [],
      };
    });

    // 10. Logs de Auditoría
    const { data: auditData, error: auditErr } = await client
      .from('auditoria_logs')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100);
    if (auditErr) throw auditErr;

    const auditLogs: AuditLog[] = (auditData || []).map((a: any) => ({
      id: a.id,
      usuarioId: a.usuario_id || '',
      usuarioNombre: a.usuario_nombre || 'Sistema',
      modulo: a.modulo as any,
      accion: a.accion,
      detalles: a.detalles || '',
      fecha: a.fecha,
    }));

    return {
      success: true,
      data: {
        products,
        clients,
        suppliers,
        sales,
        expenses,
        cxc,
        cxp,
        activeShift,
        shiftHistory,
        users,
        auditLogs,
      },
    };
  } catch (err: any) {
    console.error('Error cargando datos desde Supabase:', err);
    return {
      success: false,
      error: err.message || 'Error desconocido al consultar Supabase',
    };
  }
}

/**
 * Guarda una nueva nota de venta en Supabase (con cola offline-first)
 */
export async function syncSaleToSupabase(sale: SaleNote): Promise<boolean> {
  const client = getSupabaseClient();
  
  // Si no hay conexión o Supabase no está configurado, usar cola
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('sale', sale);
    return true; // Operación encolada, no falló
  }

  try {
    const saleId = toValidUUID(sale.id) || generateUUID();
    const cajeroId = mapUserToUUID(sale.cajeroId);
    let clienteId = mapClientToUUID(sale.clienteId);
    let turnoId = (sale.turnoId && isValidUUID(sale.turnoId)) ? sale.turnoId : (toValidUUID(sale.turnoId) || null);

    const salePayload = {
      id: saleId,
      numero_nota: sale.numeroNota,
      cliente_id: clienteId,
      cajero_id: cajeroId,
      turno_id: turnoId,
      fecha: sale.fecha || new Date().toISOString(),
      tasa_bcv: Number(sale.tasaBCV) || 1,
      tasa_iva: Number(sale.tasaIVA) || 0.16,
      subtotal_exento_usd: Number(sale.subtotalExentoUSD) || 0,
      subtotal_gravable_usd: Number(sale.subtotalGravableUSD) || 0,
      iva_usd: Number(sale.ivaUSD) || 0,
      igtf_usd: Number(sale.igtfUSD) || 0,
      total_usd: Number(sale.totalUSD) || 0,
      total_ves: Number(sale.totalVES) || 0,
      costo_total_usd: Number(sale.costoTotalUSD) || 0,
      utilidad_bruta_usd: Number(sale.utilidadBrutaUSD) || 0,
      monto_recibido_usd: Number(sale.montoRecibidoUSD) || 0,
      monto_recibido_ves: Number(sale.montoRecibidoVES) || 0,
      vuelto_usd: Number(sale.vueltoUSD) || 0,
      vuelto_ves: Number(sale.vueltoVES) || 0,
      estado: sale.estado || 'completada',
    };

    // 1. Insertar nota principal
    let { error: saleError } = await client.from('ventas_notas').upsert(salePayload);

    if (saleError && saleError.message?.includes('foreign key')) {
      salePayload.turno_id = null;
      salePayload.cliente_id = '11111111-1111-1111-1111-111111111100';
      const retry = await client.from('ventas_notas').upsert(salePayload);
      saleError = retry.error;
    }

    if (saleError) {
      console.error('Error insertando venta_nota en Supabase:', saleError);
      addToQueue('sale', sale); // Reintentar luego
      return false;
    }

    // 2. Insertar items
    if (sale.items && sale.items.length > 0) {
      const itemsPayload = sale.items.map((it) => {
        const prodUUID = it.productoId && isValidUUID(it.productoId)
          ? it.productoId
          : (toValidUUID(it.productoId) || null);

        return {
          id: generateUUID(),
          venta_id: saleId,
          producto_id: prodUUID,
          nombre_producto: it.nombre || 'Producto',
          codigo_barras: it.codigoBarras || null,
          cantidad: Number(it.cantidad) || 1,
          precio_unitario_usd: Number(it.precioUnitarioUSD) || 0,
          precio_unitario_ves: Number(it.precioUnitarioVES) || 0,
          costo_unitario_usd: Number(it.costoUnitarioUSD) || 0,
          clasificacion: it.clasificacion || 'exento',
          subtotal_usd: Number(it.subtotalUSD) || 0,
          subtotal_ves: Number(it.subtotalVES) || 0,
          iva_usd: Number(it.ivaUSD) || 0,
          total_usd: Number(it.totalUSD) || 0,
          total_ves: Number(it.totalVES) || 0,
        };
      });

      let { error: itemsError } = await client.from('ventas_items').upsert(itemsPayload);

      if (itemsError && itemsError.message?.includes('foreign key')) {
        const sanitizedItems = itemsPayload.map((item) => ({ ...item, producto_id: null }));
        const retryItems = await client.from('ventas_items').upsert(sanitizedItems);
        itemsError = retryItems.error;
      }

      if (itemsError) {
        console.warn('Aviso al insertar items en Supabase:', itemsError);
      }

      // Descontar stock
      for (const it of sale.items) {
        const prodUUID = it.productoId && isValidUUID(it.productoId)
          ? it.productoId
          : (toValidUUID(it.productoId) || null);

        if (prodUUID) {
          try {
            const { data: prod } = await client
              .from('productos')
              .select('stock_actual')
              .eq('id', prodUUID)
              .maybeSingle();

            if (prod && prod.stock_actual !== null) {
              const newStock = Math.max(0, Number(prod.stock_actual) - (Number(it.cantidad) || 0));
              await client
                .from('productos')
                .update({ stock_actual: newStock })
                .eq('id', prodUUID);
            }
          } catch (e) {
            // Ignorar fallos no críticos
          }
        }
      }
    }

    // 3. Insertar pagos
    if (sale.pagos && sale.pagos.length > 0) {
      const pagosPayload = sale.pagos.map((p) => ({
        id: generateUUID(),
        venta_id: saleId,
        metodo: p.metodo,
        nombre_metodo: p.nombreMetodo || p.metodo,
        moneda: p.moneda || 'USD',
        monto_original: Number(p.montoOriginal) || 0,
        monto_usd: Number(p.montoUSD) || 0,
        monto_ves: Number(p.montoVES) || 0,
        tasa_bcv: Number(p.tasaBCV) || 1,
        aplica_igtf: Boolean(p.aplicaIGTF),
        monto_igtf_usd: Number(p.montoIGTFUSD) || 0,
        monto_igtf_ves: Number(p.montoIGTFVES) || 0,
        referencia: p.referencia || null,
      }));

      const { error: pagosError } = await client.from('ventas_pagos').upsert(pagosPayload);
      if (pagosError) {
        console.warn('Aviso al insertar pagos en Supabase:', pagosError);
      }
    }

    return true;
  } catch (err) {
    console.error('Error sincronizando venta con Supabase:', err);
    addToQueue('sale', sale); // Reintentar luego
    return false;
  }
}

/**
 * Anula una venta en Supabase
 */
export async function syncCancelSaleToSupabase(
  saleId: string,
  reason: string,
  cancelledByName: string,
  itemsToRestock: { productoId: string; cantidad: number }[]
): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('cancelSale', {
      saleId,
      reason,
      cancelledByName,
      itemsToRestock,
    });
    return true;
  }

  try {
    const saleUUID = toValidUUID(saleId) || saleId;
    await client
      .from('ventas_notas')
      .update({
        estado: 'anulada',
        motivo_anulacion: reason,
        anulada_por: cancelledByName || null,
        fecha_anulacion: new Date().toISOString(),
      })
      .eq('id', saleUUID);

    // Reintegrar stock
    for (const it of itemsToRestock) {
      const prodUUID = toValidUUID(it.productoId) || it.productoId;
      if (prodUUID) {
        const { data: prod } = await client
          .from('productos')
          .select('stock_actual')
          .eq('id', prodUUID)
          .maybeSingle();

        if (prod && prod.stock_actual !== null) {
          const newStock = Number(prod.stock_actual) + (Number(it.cantidad) || 0);
          await client
            .from('productos')
            .update({ stock_actual: newStock })
            .eq('id', prodUUID);
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Error anulando venta en Supabase:', err);
    addToQueue('cancelSale', {
      saleId,
      reason,
      cancelledByName,
      itemsToRestock,
    });
    return false;
  }
}

/**
 * Guarda o actualiza un producto en Supabase
 */
export async function syncProductToSupabase(product: Product): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('product', product);
    return true;
  }

  try {
    const prodUUID = toValidUUID(product.id) || generateUUID();
    const payload = {
      id: prodUUID,
      codigo_barras: product.codigoBarras,
      nombre: product.nombre,
      categoria: product.categoria,
      clasificacion: product.clasificacion || 'exento',
      costo_usd: Number(product.costoUSD) || 0,
      margen_ganancia: Number(product.margenGanancia) || 0,
      unidades: Number(product.unidades) || 1,
      precio_usd: Number(product.precioUSD) || 0,
      stock_actual: Number(product.stockActual) || 0,
      stock_minimo: Number(product.stockMinimo) || 0,
      unidad_medida: product.unidadMedida || 'unidad',
      descripcion: product.descripcion || '',
      updated_at: new Date().toISOString(),
    };

    let { error } = await client.from('productos').upsert(payload, { onConflict: 'codigo_barras' });
    if (error) {
      const retry = await client.from('productos').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.error('Error upsert producto Supabase:', error);
      addToQueue('product', product);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncProductToSupabase:', err);
    addToQueue('product', product);
    return false;
  }
}

/**
 * Registra un movimiento de inventario en Supabase
 */
export async function syncStockMovementToSupabase(movement: InventoryMovement): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('stockMovement', movement);
    return true;
  }

  try {
    const movUUID = toValidUUID(movement.id) || generateUUID();
    const prodUUID = toValidUUID(movement.productoId);
    const userUUID = mapUserToUUID(movement.usuarioId);

    const movPayload = {
      id: movUUID,
      producto_id: prodUUID,
      tipo: movement.tipo,
      cantidad: Number(movement.cantidad) || 0,
      stock_anterior: Number(movement.stockAnterior) || 0,
      stock_nuevo: Number(movement.stockNuevo) || 0,
      motivo: movement.motivo || '',
      usuario_id: userUUID,
      created_at: new Date().toISOString(),
    };

    let { error } = await client.from('movimientos_inventario').insert(movPayload);
    if (error && error.message?.includes('foreign key')) {
      movPayload.producto_id = null;
      const retry = await client.from('movimientos_inventario').insert(movPayload);
      error = retry.error;
    }

    // Actualizar también productos
    if (prodUUID) {
      await client
        .from('productos')
        .update({ stock_actual: Number(movement.stockNuevo) || 0 })
        .eq('id', prodUUID);
    }

    return true;
  } catch (err) {
    console.error('Error syncStockMovementToSupabase:', err);
    addToQueue('stockMovement', movement);
    return false;
  }
}

/**
 * Guarda o actualiza un turno de caja en Supabase
 */
export async function syncCashShiftToSupabase(shift: CashShift): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('cashShift', shift);
    return true;
  }

  try {
    const shiftUUID = toValidUUID(shift.id) || generateUUID();
    const cajeroUUID = mapUserToUUID(shift.cajeroId);

    const payload: any = {
      id: shiftUUID,
      cajero_id: cajeroUUID,
      fecha_apertura: shift.fechaApertura || new Date().toISOString(),
      fecha_cierre: shift.fechaCierre || null,
      estado: shift.estado || 'abierta',
      fondo_inicial_usd: Number(shift.fondoInicialUSD) || 0,
      fondo_inicial_ves: Number(shift.fondoInicialVES) || 0,
      tasa_bcv: Number(shift.tasaBCV) || 1,
      arqueo_fisico_usd: shift.arqueoFisicoUSD != null ? Number(shift.arqueoFisicoUSD) : null,
      arqueo_fisico_ves: shift.arqueoFisicoVES != null ? Number(shift.arqueoFisicoVES) : null,
      diferencia_usd: shift.diferenciaUSD != null ? Number(shift.diferenciaUSD) : null,
      diferencia_ves: shift.diferenciaVES != null ? Number(shift.diferenciaVES) : null,
      observaciones: shift.observacionesCierre || null,
    };

    const { error } = await client.from('cajas_turnos').upsert(payload);
    if (error) {
      console.error('Error syncCashShiftToSupabase:', error);
      addToQueue('cashShift', shift);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncCashShiftToSupabase:', err);
    addToQueue('cashShift', shift);
    return false;
  }
}

/**
 * Guarda un gasto en Supabase
 */
export async function syncExpenseToSupabase(expense: Expense): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('expense', expense);
    return true;
  }

  try {
    const expUUID = toValidUUID(expense.id) || generateUUID();
    const userUUID = mapUserToUUID(expense.usuarioId);

    const { error } = await client.from('gastos').insert({
      id: expUUID,
      concepto: expense.concepto,
      categoria: expense.categoria,
      monto_usd: Number(expense.montoUSD) || 0,
      monto_ves: Number(expense.montoVES) || 0,
      tasa_bcv: Number(expense.tasaBCV) || 1,
      metodo_pago: expense.metodoPago,
      usuario_id: userUUID,
      comprobante_ref: expense.comprobanteRef || null,
      observaciones: expense.observaciones || null,
      fecha: expense.fecha || new Date().toISOString(),
    });

    if (error) {
      console.error('Error insert gasto Supabase:', error);
      addToQueue('expense', expense);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncExpenseToSupabase:', err);
    addToQueue('expense', expense);
    return false;
  }
}

/**
 * Guarda un cliente en Supabase
 */
export async function syncClientToSupabase(clientObj: Client): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('client', clientObj);
    return true;
  }

  try {
    const cliUUID = mapClientToUUID(clientObj.id) || toValidUUID(clientObj.id) || generateUUID();
    const { error } = await client.from('clientes').upsert({
      id: cliUUID,
      documento: clientObj.documento,
      nombre: clientObj.nombre,
      telefono: clientObj.telefono || '',
      direccion: clientObj.direccion || '',
      email: clientObj.email || '',
      limite_credito_usd: Number(clientObj.limiteCreditoUSD) || 0,
    }, { onConflict: 'documento' });

    if (error) {
      console.error('Error upsert cliente Supabase:', error);
      addToQueue('client', clientObj);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncClientToSupabase:', err);
    addToQueue('client', clientObj);
    return false;
  }
}

/**
 * Guarda un log de auditoría en Supabase
 */
export async function syncAuditLogToSupabase(log: AuditLog): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('auditLog', log);
    return true;
  }

  try {
    const logUUID = toValidUUID(log.id) || generateUUID();
    const userUUID = mapUserToUUID(log.usuarioId);

    await client.from('auditoria_logs').insert({
      id: logUUID,
      usuario_id: userUUID,
      usuario_nombre: log.usuarioNombre || 'Sistema',
      modulo: log.modulo,
      accion: log.accion,
      detalles: log.detalles,
      fecha: log.fecha || new Date().toISOString(),
    });
    return true;
  } catch {
    addToQueue('auditLog', log);
    return false;
  }
}

/**
 * Guarda o actualiza una cuenta por cobrar (CxC) en Supabase
 */
export async function syncCxCToSupabase(cxcItem: AccountReceivable): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('cxc', cxcItem);
    return true;
  }

  try {
    const cxcUUID = toValidUUID(cxcItem.id) || generateUUID();
    const cliUUID = mapClientToUUID(cxcItem.clienteId);
    const ventaUUID = cxcItem.notaVentaId ? (toValidUUID(cxcItem.notaVentaId) || null) : null;

    const payload: any = {
      id: cxcUUID,
      cliente_id: cliUUID,
      venta_id: ventaUUID,
      monto_total_usd: Number(cxcItem.montoTotalUSD) || 0,
      monto_total_ves: cxcItem.montoTotalVES != null ? Number(cxcItem.montoTotalVES) : null,
      monto_abonado_usd: Number(cxcItem.montoAbonadoUSD) || 0,
      monto_abonado_ves: Number(cxcItem.montoAbonadoVES) || 0,
      saldo_pendiente_usd: Number(cxcItem.saldoPendienteUSD) || 0,
      saldo_pendiente_ves: Number(cxcItem.saldoPendienteVES) || 0,
      moneda_fijada: cxcItem.monedaFijada || 'USD',
      fecha_emision: cxcItem.fechaEmision,
      fecha_vencimiento: cxcItem.fechaVencimiento,
      estado: cxcItem.estado,
      abonos: cxcItem.abonos || [],
    };

    let { error } = await client.from('cuentas_por_cobrar').upsert(payload);
    if (error && error.message?.includes('foreign key')) {
      payload.venta_id = null;
      payload.cliente_id = '11111111-1111-1111-1111-111111111100';
      const retry = await client.from('cuentas_por_cobrar').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.error('Error upsert cuenta por cobrar Supabase:', error);
      addToQueue('cxc', cxcItem);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncCxCToSupabase:', err);
    addToQueue('cxc', cxcItem);
    return false;
  }
}

/**
 * Guarda o actualiza un proveedor en Supabase
 */
export async function syncSupplierToSupabase(supplier: Supplier): Promise<boolean> {
  const client = getSupabaseClient();
  
  if (!client || !onlineMonitor.isOnline() || !isSupabaseConfigured()) {
    addToQueue('supplier', supplier);
    return true;
  }

  try {
    const suppUUID = toValidUUID(supplier.id) || generateUUID();
    const { error } = await client.from('proveedores').upsert({
      id: suppUUID,
      rif: supplier.rif,
      nombre: supplier.nombre,
      contacto: supplier.contacto || null,
      telefono: supplier.telefono || null,
      direccion: supplier.direccion || null,
    }, { onConflict: 'rif' });

    if (error) {
      console.error('Error upsert proveedor Supabase:', error);
      addToQueue('supplier', supplier);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error syncSupplierToSupabase:', err);
    addToQueue('supplier', supplier);
    return false;
  }
}

/**
 * Sincronización masiva de todo el dataset actual a Supabase
 */
export async function syncBulkDataToSupabase(dataset: {
  products: Product[];
  clients: Client[];
  suppliers: Supplier[];
  sales: SaleNote[];
  expenses: Expense[];
  cxc: AccountReceivable[];
  activeShift: CashShift | null;
  shiftHistory: CashShift[];
}): Promise<{ success: boolean; count: number; error?: string }> {
  if (!isSupabaseConfigured() || !onlineMonitor.isOnline()) {
    return { success: false, count: 0, error: 'Sin conexión a internet o Supabase no configurado' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, error: 'Supabase no está configurado aún.' };
  }

  let totalSynced = 0;

  try {
    // 1. Clientes
    for (const c of dataset.clients) {
      const ok = await syncClientToSupabase(c);
      if (ok) totalSynced++;
    }

    // 2. Proveedores
    for (const s of dataset.suppliers) {
      const ok = await syncSupplierToSupabase(s);
      if (ok) totalSynced++;
    }

    // 3. Productos
    for (const p of dataset.products) {
      const ok = await syncProductToSupabase(p);
      if (ok) totalSynced++;
    }

    // 4. Turnos de Caja
    if (dataset.activeShift) {
      const ok = await syncCashShiftToSupabase(dataset.activeShift);
      if (ok) totalSynced++;
    }
    for (const sh of dataset.shiftHistory) {
      const ok = await syncCashShiftToSupabase(sh);
      if (ok) totalSynced++;
    }

    // 5. Ventas
    for (const sale of dataset.sales) {
      const ok = await syncSaleToSupabase(sale);
      if (ok) totalSynced++;
    }

    // 6. Cuentas por Cobrar
    for (const c of dataset.cxc) {
      const ok = await syncCxCToSupabase(c);
      if (ok) totalSynced++;
    }

    // 7. Gastos
    for (const exp of dataset.expenses) {
      const ok = await syncExpenseToSupabase(exp);
      if (ok) totalSynced++;
    }

    return { success: true, count: totalSynced };
  } catch (err: any) {
    return {
      success: false,
      count: totalSynced,
      error: err.message || 'Error en sincronización masiva a Supabase',
    };
  }
}

