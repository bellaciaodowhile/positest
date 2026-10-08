import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import {
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_CASH_SHIFT,
  INITIAL_SHIFT_HISTORY,
  INITIAL_SALES,
  INITIAL_EXPENSES,
  INITIAL_CXC,
  INITIAL_CXP,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import {
  User,
  Product,
  Client,
  Supplier,
  CashShift,
  SaleNote,
  Expense,
  AccountReceivable,
  AccountPayable,
  AuditLog,
  InventoryMovement,
  PaymentMethodType,
} from './types';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { POSModule } from './components/POSModule';
import { InventoryModule } from './components/InventoryModule';
import { CashControlModule } from './components/CashControlModule';
import { FinanceModule } from './components/FinanceModule';
import { ReportsModule } from './components/ReportsModule';
import { AuditUsersModule } from './components/AuditUsersModule';
import { AuthScreen } from './components/AuthScreen';
import { QuickUserModal } from './components/QuickUserModal';
import { SupabaseModal } from './components/SupabaseModal';
import { fetchBCVRate, usdToVes } from './services/bcvService';
import { isSupabaseConfigured, testSupabaseConnection } from './services/supabaseClient';
import {
  loadAllDataFromSupabase,
  syncSaleToSupabase,
  syncCancelSaleToSupabase,
  syncProductToSupabase,
  syncStockMovementToSupabase,
  syncCashShiftToSupabase,
  syncExpenseToSupabase,
  syncClientToSupabase,
  syncAuditLogToSupabase,
  syncCxCToSupabase,
  syncSupplierToSupabase,
  syncBulkDataToSupabase,
} from './services/supabaseService';
import { generateUUID } from './services/uuidUtils';
import {
  loadRealDataset,
  saveRealDataset,
  loadDemoDataset,
  saveDemoDataset,
  isDemoModeStored,
  setStoredDemoMode,
  REAL_SYSTEM_USERS,
  DatasetState,
  setLastSyncTimestamp,
} from './services/environmentManager';
import { initOfflineSyncSystem, hasPendingSyncOperations, getPendingSyncCount } from './services/initOfflineSync';
import { onlineMonitor } from './services/onlineMonitor';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Inicializar sistema de sincronización offline al montar el componente
  React.useEffect(() => {
    initOfflineSyncSystem();
    
    // Verificar estado de conexión inicial
    console.log(`[App] Estado inicial de conexión: ${onlineMonitor.getStatus()}`);
    console.log(`[App] Operaciones pendientes de sincronización: ${getPendingSyncCount()}`);
    
    return () => {
      // Cleanup si es necesario
    };
  }, []);

  // Inicialización de Usuario y Entorno (Aislamiento de Demo vs Modo Real Operativo)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const activeSession = sessionStorage.getItem('pos_active_user_session');
      if (activeSession) {
        const parsed = JSON.parse(activeSession);
        if (parsed?.username) {
          if (parsed.username === 'demo') return INITIAL_USERS[0];
          if (parsed.username === 'admin') return REAL_SYSTEM_USERS[0];
          return {
            id: parsed.id || 'u-admin-01',
            username: parsed.username,
            nombre: parsed.nombre || 'Administrador',
            rol: parsed.rol || 'admin',
            activo: true,
          };
        }
      }
    } catch {
      // ignore
    }
    const isDemoStored = isDemoModeStored();
    if (isDemoStored) {
      return INITIAL_USERS[0]; // Usuario Demo
    }
    // En modo real por defecto solo el administrador real
    return REAL_SYSTEM_USERS[0];
  });

  const isDemoMode = currentUser.username === 'demo';

  // Estado de Autenticación: Debe comenzar en formulario de inicio de sesión salvo que haya sesión activa
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem('pos_active_user_session'));
    } catch {
      return false;
    }
  });

  // Credenciales válidas para login (solo admin en modo real y demo en modo demo)
  const defaultCredentials: Record<string, string> = {
    demo: 'demo123',
    admin: 'admin123',
  };

  // Módulo Activo: inicializado según la ruta en la barra de direcciones
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const validTabs: ActiveTab[] = ['pos', 'inventario', 'caja', 'finanzas', 'reportes', 'seguridad'];
      if (validTabs.includes(path as ActiveTab)) {
        return path as ActiveTab;
      }
    } catch {
      // ignore
    }
    return 'pos';
  });

  // Carga inicial según el modo (Demo con datos precargados; Real limpio sin ventas/deudas/arqueos falsos)
  const [initialDataState] = useState<DatasetState>(() => {
    return isDemoModeStored() ? loadDemoDataset() : loadRealDataset();
  });

  const [users, setUsers] = useState<User[]>(() => initialDataState.users);
  const [products, setProducts] = useState<Product[]>(() => initialDataState.products);
  const [clients, setClients] = useState<Client[]>(() => initialDataState.clients);
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => initialDataState.suppliers);
  const [sales, setSales] = useState<SaleNote[]>(() => initialDataState.sales);
  const [expenses, setExpenses] = useState<Expense[]>(() => initialDataState.expenses);
  const [cxc, setCxc] = useState<AccountReceivable[]>(() => initialDataState.cxc);
  const [cxp, setCxp] = useState<AccountPayable[]>(() => initialDataState.cxp);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => initialDataState.auditLogs);

  // Control de Caja & Turno
  const [activeShift, setActiveShift] = useState<CashShift | null>(() => initialDataState.activeShift);
  const [shiftHistory, setShiftHistory] = useState<CashShift[]>(() => initialDataState.shiftHistory);

  // Tasa BCV Oficial
  const [bcvRate, setBcvRate] = useState<number>(68.50);
  const [bcvSource, setBcvSource] = useState<string>('Oficial BCV');
  const [isBcvLoading, setIsBcvLoading] = useState<boolean>(false);

  // Modales
  const [isQuickUserModalOpen, setIsQuickUserModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Función para cambiar de pestaña sincronizando la ruta URL
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (location.pathname !== '/' + tab) {
      navigate('/' + tab);
    }
  };

  // Sincronización de rutas con el historial de navegación
  useEffect(() => {
    const path = location.pathname.replace(/^\//, '').toLowerCase();

    if (!isAuthenticated) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }

    if (location.pathname === '/login' || location.pathname === '/' || location.pathname === '') {
      navigate('/' + activeTab, { replace: true });
      return;
    }

    const validTabs: ActiveTab[] = ['pos', 'inventario', 'caja', 'finanzas', 'reportes', 'seguridad'];
    if (validTabs.includes(path as ActiveTab)) {
      setActiveTab(path as ActiveTab);
    }
  }, [location.pathname, isAuthenticated, navigate]);

  // Estado de Supabase Database
  const [supabaseStatus, setSupabaseStatus] = useState<
    'connected' | 'disconnected' | 'connecting' | 'error'
  >('disconnected');
  const [isSyncingWithSupabase, setIsSyncingWithSupabase] = useState(false);

  // Sincronizar con Supabase
  const handleSyncSupabase = async () => {
    if (!isSupabaseConfigured()) {
      setSupabaseStatus('disconnected');
      return;
    }

    setIsSyncingWithSupabase(true);
    setSupabaseStatus('connecting');

    try {
      const connTest = await testSupabaseConnection();
      if (!connTest.success) {
        setSupabaseStatus('error');
        setIsSyncingWithSupabase(false);
        return;
      }

      const res = await loadAllDataFromSupabase();
      if (res.success && res.data) {
        if (res.data.products && res.data.products.length > 0) {
          setProducts(res.data.products);
        }
        if (res.data.clients && res.data.clients.length > 0) {
          setClients(res.data.clients);
        }
        if (res.data.suppliers && res.data.suppliers.length > 0) {
          setSuppliers(res.data.suppliers);
        }
        if (res.data.sales && res.data.sales.length > 0) {
          setSales(res.data.sales);
        }
        if (res.data.expenses && res.data.expenses.length > 0) {
          setExpenses(res.data.expenses);
        }
        if (res.data.cxc && res.data.cxc.length > 0) {
          setCxc(res.data.cxc);
        }
        if (res.data.cxp && res.data.cxp.length > 0) {
          setCxp(res.data.cxp);
        }
        if (res.data.users && res.data.users.length > 0) {
          setUsers(res.data.users);
        }
        if (res.data.activeShift !== undefined) {
          setActiveShift(res.data.activeShift);
        }
        if (res.data.shiftHistory && res.data.shiftHistory.length > 0) {
          setShiftHistory(res.data.shiftHistory);
        }
        if (res.data.auditLogs && res.data.auditLogs.length > 0) {
          setAuditLogs(res.data.auditLogs);
        }
        setSupabaseStatus('connected');
      } else {
        setSupabaseStatus('connected');
      }
    } catch (err) {
      console.warn('Fallo sincronizando Supabase:', err);
      setSupabaseStatus('error');
    } finally {
      setIsSyncingWithSupabase(false);
    }
  };

  // Sincronizar tasa BCV y datos de Supabase al inicio
  useEffect(() => {
    handleRefreshBCV();
    if (isSupabaseConfigured()) {
      handleSyncSupabase();
    }
  }, []);

  // Asegurar que si el rol no tiene permiso para la pestaña actual, redirigir al POS
  useEffect(() => {
    const role = currentUser.rol;
    if (role === 'cajero' && (activeTab === 'finanzas' || activeTab === 'reportes' || activeTab === 'seguridad')) {
      handleSelectTab('pos');
    } else if (role === 'inventario' && activeTab !== 'inventario') {
      handleSelectTab('inventario');
    }
  }, [currentUser.rol, activeTab]);

  // Manejador: Actualizar tasa BCV desde la API
  const handleRefreshBCV = async () => {
    setIsBcvLoading(true);
    try {
      const info = await fetchBCVRate();
      setBcvRate(info.rate);
      setBcvSource(info.source);
    } catch (err) {
      console.warn('Error sincronizando BCV, manteniendo tasa actual', err);
    } finally {
      setIsBcvLoading(false);
    }
  };

  const handleUpdateManualBCV = (newRate: number) => {
    setBcvRate(newRate);
    setBcvSource('Manual / Usuario');
    addAuditLog('Ajuste de Tasa BCV', 'finanzas', `Tasa actualizada a Bs. ${newRate.toFixed(2)} por 1 USD`);
  };

  // Auto-guardado en localStorage según el entorno activo (aislamiento estricto entre Demo y Real)
  useEffect(() => {
    const currentState: DatasetState = {
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
    };

    if (isDemoMode) {
      saveDemoDataset(currentState);
    } else {
      saveRealDataset(currentState);
    }
  }, [
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
    isDemoMode,
  ]);

  // Función para alternar con aislamiento total entre el dataset Demo y el dataset Real
  const switchEnvironment = (targetUser: User, targetIsDemo: boolean) => {
    // 1. Guardar el estado actual antes de cambiar
    const currentState: DatasetState = {
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
    };

    if (isDemoMode) {
      saveDemoDataset(currentState);
    } else {
      saveRealDataset(currentState);
    }

    // 2. Cargar el dataset destino
    const nextDataset = targetIsDemo ? loadDemoDataset() : loadRealDataset();
    setProducts(nextDataset.products);
    setClients(nextDataset.clients);
    setSuppliers(nextDataset.suppliers);
    setSales(nextDataset.sales);
    setExpenses(nextDataset.expenses);
    setCxc(nextDataset.cxc);
    setCxp(nextDataset.cxp);
    setActiveShift(nextDataset.activeShift);
    setShiftHistory(nextDataset.shiftHistory);
    setUsers(nextDataset.users);
    setAuditLogs(nextDataset.auditLogs);

    setStoredDemoMode(targetIsDemo);
    setCurrentUser(targetUser);
  };

  const handleToggleDemoMode = () => {
    if (isDemoMode) {
      const adminUser = users.find((u) => u.username === 'admin') || INITIAL_USERS[1];
      switchEnvironment(adminUser, false);
      addAuditLog(
        'Cambio de Entorno',
        'seguridad',
        'Cambio a Modo Real Operativo. Sin datos simulados de demostración.'
      );
    } else {
      const demoUser = INITIAL_USERS[0];
      switchEnvironment(demoUser, true);
      addAuditLog(
        'Cambio de Entorno',
        'seguridad',
        'Cambio a Modo Demostración de Prueba con datos de muestra.'
      );
    }
  };

  // Agregar log de auditoría
  const addAuditLog = (
    accion: string,
    modulo: AuditLog['modulo'],
    detalles: string
  ) => {
    const newLog: AuditLog = {
      id: generateUUID(),
      usuarioId: currentUser.id,
      usuarioNombre: currentUser.nombre,
      modulo,
      accion,
      detalles,
      fecha: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    syncAuditLogToSupabase(newLog).catch(() => {});
  };

  // Manejador: Completar Venta POS
  const handleCompleteSale = (newSale: SaleNote) => {
    // 1. Agregar a ventas
    setSales((prev) => [newSale, ...prev]);

    // 2. Descontar stock de inventario automáticamente en tiempo real
    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        const itemSold = newSale.items.find((it) => it.productoId === prod.id);
        if (itemSold) {
          return {
            ...prod,
            stockActual: Math.max(0, prod.stockActual - itemSold.cantidad),
          };
        }
        return prod;
      })
    );

    // Sincronizar en segundo plano con Supabase si está configurado
    syncSaleToSupabase(newSale).catch((err) =>
      console.warn('Sync sale Supabase aviso:', err)
    );

    // 3. Actualizar caja / turno activo si existe
    if (activeShift) {
      let efectivoUSDInc = 0;
      let efectivoVESInc = 0;
      let puntoVentaVESInc = 0;
      let pagoMovilVESInc = 0;
      let zelleUSDInc = 0;
      let transfVESInc = 0;
      let igtfUSDInc = newSale.igtfUSD || 0;

      newSale.pagos.forEach((p) => {
        if (p.metodo === 'efectivo_usd') efectivoUSDInc += p.montoUSD;
        else if (p.metodo === 'efectivo_ves') efectivoVESInc += p.montoVES;
        else if (p.metodo === 'punto_venta') puntoVentaVESInc += p.montoVES;
        else if (p.metodo === 'pago_movil') pagoMovilVESInc += p.montoVES;
        else if (p.metodo === 'zelle') zelleUSDInc += p.montoUSD;
        else if (p.metodo === 'transferencia') transfVESInc += p.montoVES;
      });

      // Descontar vuelto entregado en efectivo
      if (newSale.vueltoUSD > 0) efectivoUSDInc -= newSale.vueltoUSD;
      if (newSale.vueltoVES > 0) efectivoVESInc -= newSale.vueltoVES;

      setActiveShift((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ventasEfectivoUSD: prev.ventasEfectivoUSD + efectivoUSDInc,
          ventasEfectivoVES: prev.ventasEfectivoVES + efectivoVESInc,
          ventasPuntoVentaVES: prev.ventasPuntoVentaVES + puntoVentaVESInc,
          ventasPagoMovilVES: prev.ventasPagoMovilVES + pagoMovilVESInc,
          ventasZelleUSD: prev.ventasZelleUSD + zelleUSDInc,
          ventasTransferenciaVES: prev.ventasTransferenciaVES + transfVESInc,
          ventasIGTFUSD: prev.ventasIGTFUSD + igtfUSDInc,
          totalVendidoUSD: prev.totalVendidoUSD + newSale.totalUSD,
          totalVendidoVES: prev.totalVendidoVES + newSale.totalVES,
        };
        syncCashShiftToSupabase(updated).catch((err) =>
          console.warn('Sync shift Supabase aviso:', err)
        );
        return updated;
      });
    }

    // 4. Si la venta es "Pagar Luego" (Crédito comercial fijado en Bolívares):
    if (
      newSale.tipoVenta === 'credito_fijado_ves' ||
      (newSale.saldoPendienteVES !== undefined && newSale.saldoPendienteVES > 0)
    ) {
      const initialAbonoVES = newSale.montoAbonoInicialVES || 0;
      const initialAbonoUSD = initialAbonoVES > 0 ? initialAbonoVES / newSale.tasaBCV : 0;
      const saldoPendienteVES =
        newSale.saldoPendienteVES !== undefined
          ? newSale.saldoPendienteVES
          : Math.max(0, newSale.totalVES - initialAbonoVES);
      const saldoPendienteUSD = saldoPendienteVES / newSale.tasaBCV;

      const newCxC: AccountReceivable = {
        id: generateUUID(),
        clienteId: newSale.clienteId,
        clienteNombre: newSale.clienteNombre,
        clienteDocumento: newSale.clienteDocumento,
        notaVentaId: newSale.id,
        montoTotalUSD: newSale.totalUSD,
        montoAbonadoUSD: initialAbonoUSD,
        saldoPendienteUSD: saldoPendienteUSD,
        montoTotalVES: newSale.totalVES,
        montoAbonadoVES: initialAbonoVES,
        saldoPendienteVES: saldoPendienteVES,
        monedaFijada: 'VES', // Fijada en Bs. sin recálculo cambiario diario
        fechaEmision: new Date().toISOString().slice(0, 10),
        fechaVencimiento: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        estado: saldoPendienteVES <= 0.05 ? 'pagada' : initialAbonoVES > 0 ? 'parcial' : 'pendiente',
        abonos:
          initialAbonoVES > 0
            ? [
                {
                  id: generateUUID(),
                  fecha: new Date().toISOString().slice(0, 10),
                  montoUSD: initialAbonoUSD,
                  montoVES: initialAbonoVES,
                  metodo: (newSale.pagos[0]?.metodo as PaymentMethodType) || 'efectivo_ves',
                  referencia:
                    newSale.pagos[0]?.referencia || 'Abono inicial en venta Pagar Luego (en Bs)',
                },
              ]
            : [],
      };

      setCxc((prev) => [newCxC, ...prev]);
      syncCxCToSupabase(newCxC).catch((err) =>
        console.warn('Sync CxC Supabase aviso:', err)
      );

      addAuditLog(
        'Registro de Cuenta por Cobrar (Pagar Luego en Bs)',
        'finanzas',
        `Deuda fijada en Bs. ${saldoPendienteVES.toFixed(2)} asignada a ${newSale.clienteNombre}. Abono inicial: Bs. ${initialAbonoVES.toFixed(2)}. Nota: ${newSale.numeroNota}`
      );
    }

    // 5. Auditoría
    addAuditLog(
      'Emisión de Nota de Entrega',
      'ventas',
      `Nota ${newSale.numeroNota} generada por $${newSale.totalUSD} (Bs. ${newSale.totalVES.toFixed(2)}) a ${newSale.clienteNombre}${newSale.tipoVenta === 'credito_fijado_ves' ? ' [MODALIDAD: PAGAR LUEGO EN BS]' : ''}`
    );
  };

  // Manejador: Anular Nota de Venta (Solo Admin)
  const handleCancelSale = (saleId: string, reason: string) => {
    const targetSale = sales.find((s) => s.id === saleId);
    if (!targetSale) return;

    // 1. Reintegrar stock de cada producto vendido
    setProducts((prev) =>
      prev.map((prod) => {
        const itemSold = targetSale.items.find((it) => it.productoId === prod.id);
        if (itemSold) {
          return {
            ...prod,
            stockActual: prod.stockActual + itemSold.cantidad,
          };
        }
        return prod;
      })
    );

    // 2. Marcar nota como anulada
    setSales((prev) =>
      prev.map((s) =>
        s.id === saleId
          ? {
              ...s,
              estado: 'anulada',
              motivoAnulacion: reason,
              anuladaPor: currentUser.nombre,
              fechaAnulacion: new Date().toISOString(),
            }
          : s
      )
    );

    // 3. Auditoría
    addAuditLog(
      'Anulación de Nota de Venta',
      'ventas',
      `Nota ${targetSale.numeroNota} anulada por ${currentUser.nombre}. Motivo: ${reason}. Stock reintegrado.`
    );

    // Sincronizar anulación con Supabase
    const itemsToRestock = targetSale.items.map((it) => ({
      productoId: it.productoId,
      cantidad: it.cantidad,
    }));
    syncCancelSaleToSupabase(saleId, reason, currentUser.nombre, itemsToRestock).catch(
      (err) => console.warn('Sync cancel sale Supabase aviso:', err)
    );
  };

  // Manejador: Inventario
  const handleAddProduct = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
    addAuditLog(
      'Creación de Producto',
      'inventario',
      `Artículo registrado: ${newProd.nombre} (${newProd.codigoBarras}) - Precio: $${newProd.precioUSD}`
    );
    syncProductToSupabase(newProd).catch((err) =>
      console.warn('Sync product Supabase aviso:', err)
    );
  };

  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProd.id ? updatedProd : p))
    );
    addAuditLog(
      'Modificación de Producto / Precios',
      'inventario',
      `Artículo actualizado: ${updatedProd.nombre} - Precio: $${updatedProd.precioUSD}`
    );
    syncProductToSupabase(updatedProd).catch((err) =>
      console.warn('Sync update product Supabase aviso:', err)
    );
  };

  const handleDeleteProduct = (deletedProd: Product) => {
    setProducts((prev) => prev.filter((p) => p.id !== deletedProd.id));
    addAuditLog(
      'Eliminación de Producto',
      'inventario',
      `Artículo eliminado: ${deletedProd.nombre} (Código: ${deletedProd.codigoBarras})`
    );
    syncProductToSupabase(deletedProd).catch((err) =>
      console.warn('Sync delete product Supabase aviso:', err)
    );
  };

  const handleStockMovement = (movement: InventoryMovement) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === movement.productoId ? { ...p, stockActual: movement.stockNuevo } : p
      )
    );
    addAuditLog(
      `Ajuste de Stock (${movement.tipo.toUpperCase()})`,
      'inventario',
      `${movement.productoNombre}: ${movement.stockAnterior} -> ${movement.stockNuevo} unidades. Motivo: ${movement.motivo}`
    );
    syncStockMovementToSupabase(movement).catch((err) =>
      console.warn('Sync movement Supabase aviso:', err)
    );
  };

  // Manejador: Caja y Turnos
  const handleOpenShift = (newShift: CashShift) => {
    setActiveShift(newShift);
    addAuditLog(
      'Apertura de Turno de Caja',
      'caja',
      `Caja abierta por ${newShift.cajeroNombre}. Fondo inicial: $${newShift.fondoInicialUSD} USD / Bs. ${newShift.fondoInicialVES} VES`
    );
    syncCashShiftToSupabase(newShift).catch((err) =>
      console.warn('Sync open shift Supabase aviso:', err)
    );
  };

  const handleCloseShift = (closedShift: CashShift) => {
    setActiveShift(null);
    setShiftHistory((prev) => [closedShift, ...prev]);
    addAuditLog(
      'Arqueo & Cierre de Caja',
      'caja',
      `Caja cerrada por ${closedShift.cajeroNombre}. Arqueo USD: $${closedShift.arqueoFisicoUSD} (Dif: $${closedShift.diferenciaUSD}) | Arqueo VES: Bs. ${closedShift.arqueoFisicoVES} (Dif: Bs. ${closedShift.diferenciaVES})`
    );
    syncCashShiftToSupabase(closedShift).catch((err) =>
      console.warn('Sync close shift Supabase aviso:', err)
    );
  };

  // Manejador: Finanzas
  const handleAddExpense = (exp: Expense) => {
    setExpenses((prev) => [exp, ...prev]);
    addAuditLog(
      'Registro de Gasto',
      'finanzas',
      `Gasto ${exp.categoria}: ${exp.concepto} por $${exp.montoUSD}`
    );
    syncExpenseToSupabase(exp).catch((err) =>
      console.warn('Sync expense Supabase aviso:', err)
    );
  };

  const handleAddAbonoCxC = (
    cxcId: string,
    amountUSD: number,
    method: PaymentMethodType,
    ref?: string,
    amountVES?: number
  ) => {
    const targetCxC = cxc.find((c) => c.id === cxcId);
    const isFixedVES = targetCxC?.monedaFijada === 'VES';
    const actualAbonoVES =
      amountVES !== undefined ? amountVES : usdToVes(amountUSD, bcvRate);
    const actualAbonoUSD = isFixedVES ? actualAbonoVES / bcvRate : amountUSD;

    // 1. Actualizar CxC
    setCxc((prev) =>
      prev.map((item) => {
        if (item.id !== cxcId) return item;
        const newAbonadoUSD = item.montoAbonadoUSD + actualAbonoUSD;
        const newPendienteUSD = Math.max(0, item.montoTotalUSD - newAbonadoUSD);

        const currentTotalVES = item.montoTotalVES ?? usdToVes(item.montoTotalUSD, bcvRate);
        const currentAbonadoVES = (item.montoAbonadoVES ?? 0) + actualAbonoVES;
        const newPendienteVES = Math.max(0, currentTotalVES - currentAbonadoVES);

        const isFullyPaid = isFixedVES ? newPendienteVES <= 0.05 : newPendienteUSD <= 0.01;
        const newStatus = isFullyPaid ? 'pagada' : 'parcial';

        const updated: AccountReceivable = {
          ...item,
          montoAbonadoUSD: newAbonadoUSD,
          saldoPendienteUSD: isFullyPaid ? 0 : newPendienteUSD,
          montoAbonadoVES: currentAbonadoVES,
          saldoPendienteVES: isFullyPaid ? 0 : newPendienteVES,
          estado: newStatus,
          abonos: [
            ...item.abonos,
            {
              id: generateUUID(),
              fecha: new Date().toISOString().slice(0, 10),
              montoUSD: actualAbonoUSD,
              montoVES: actualAbonoVES,
              metodo: method,
              referencia: ref,
            },
          ],
        };
        syncCxCToSupabase(updated).catch((err) =>
          console.warn('Sync CxC abono Supabase aviso:', err)
        );
        return updated;
      })
    );

    // 2. Si hay turno de caja activo, sumar el dinero cobrado a la caja del cajero
    if (activeShift && activeShift.estado === 'abierta') {
      setActiveShift((prev) => {
        if (!prev) return null;
        let efectivoUSDInc = 0;
        let efectivoVESInc = 0;
        let puntoVentaVESInc = 0;
        let pagoMovilVESInc = 0;
        let zelleUSDInc = 0;
        let transfVESInc = 0;

        if (method === 'efectivo_usd') efectivoUSDInc = actualAbonoUSD;
        else if (method === 'efectivo_ves') efectivoVESInc = actualAbonoVES;
        else if (method === 'punto_venta') puntoVentaVESInc = actualAbonoVES;
        else if (method === 'pago_movil') pagoMovilVESInc = actualAbonoVES;
        else if (method === 'zelle') zelleUSDInc = actualAbonoUSD;
        else if (method === 'transferencia') transfVESInc = actualAbonoVES;

        const updatedShift = {
          ...prev,
          ventasEfectivoUSD: prev.ventasEfectivoUSD + efectivoUSDInc,
          ventasEfectivoVES: prev.ventasEfectivoVES + efectivoVESInc,
          ventasPuntoVentaVES: prev.ventasPuntoVentaVES + puntoVentaVESInc,
          ventasPagoMovilVES: prev.ventasPagoMovilVES + pagoMovilVESInc,
          ventasZelleUSD: prev.ventasZelleUSD + zelleUSDInc,
          ventasTransferenciaVES: prev.ventasTransferenciaVES + transfVESInc,
          totalVendidoUSD: prev.totalVendidoUSD + actualAbonoUSD,
          totalVendidoVES: prev.totalVendidoVES + actualAbonoVES,
        };
        syncCashShiftToSupabase(updatedShift).catch((err) =>
          console.warn('Sync shift abono Supabase aviso:', err)
        );
        return updatedShift;
      });
    }

    // 3. Actualizar la Nota de Venta asociada en el historial de ventas
    const methodNames: Record<PaymentMethodType, string> = {
      efectivo_usd: 'Efectivo Divisas (USD)',
      efectivo_ves: 'Efectivo Bolívares (VES)',
      punto_venta: 'Punto de Venta / Débito (VES)',
      pago_movil: 'Pago Móvil (VES)',
      zelle: 'Zelle (USD)',
      transferencia: 'Transferencia Bancaria (VES)',
    };

    const newPaymentItem = {
      metodo: method,
      nombreMetodo: methodNames[method] || method,
      montoOriginal: method === 'efectivo_usd' || method === 'zelle' ? actualAbonoUSD : actualAbonoVES,
      moneda: (method === 'efectivo_usd' || method === 'zelle' ? 'USD' : 'VES') as 'USD' | 'VES',
      montoUSD: actualAbonoUSD,
      montoVES: actualAbonoVES,
      tasaBCV: bcvRate,
      aplicaIGTF: false,
      montoIGTFUSD: 0,
      montoIGTFVES: 0,
      referencia: ref || undefined,
    };

    setSales((prev) =>
      prev.map((sale) => {
        const isTarget = targetCxC && (sale.id === targetCxC.notaVentaId || sale.numeroNota === targetCxC.notaVentaId);
        if (!isTarget) return sale;

        const updatedAbonoUSD = (sale.montoAbonadoUSD || 0) + actualAbonoUSD;
        const updatedPendienteUSD = Math.max(0, (sale.totalUSD || 0) - updatedAbonoUSD);
        const currentTotalVES = sale.totalVES || usdToVes(sale.totalUSD, bcvRate);
        const updatedAbonoVES = (sale.montoAbonadoVES || 0) + actualAbonoVES;
        const updatedPendienteVES = Math.max(0, currentTotalVES - updatedAbonoVES);
        const isPaid = isFixedVES ? updatedPendienteVES <= 0.05 : updatedPendienteUSD <= 0.01;

        const updatedSale = {
          ...sale,
          montoAbonadoUSD: updatedAbonoUSD,
          saldoPendienteUSD: isPaid ? 0 : updatedPendienteUSD,
          montoAbonadoVES: updatedAbonoVES,
          saldoPendienteVES: isPaid ? 0 : updatedPendienteVES,
          pagos: [...sale.pagos, newPaymentItem],
        };
        syncSaleToSupabase(updatedSale).catch((err) =>
          console.warn('Sync updated sale abono Supabase aviso:', err)
        );
        return updatedSale;
      })
    );

    // 4. Actualizar saldo del cliente
    if (targetCxC) {
      setClients((prev) =>
        prev.map((cli) => {
          if (cli.id !== targetCxC.clienteId && cli.documento !== targetCxC.clienteDocumento) return cli;
          return {
            ...cli,
            saldoPendienteUSD: Math.max(0, (cli.saldoPendienteUSD || 0) - actualAbonoUSD),
          };
        })
      );
    }

    addAuditLog(
      'Cobro de Saldo Restante / Abono en Caja',
      'caja',
      `Cobro de ${amountVES !== undefined ? `Bs. ${amountVES.toFixed(2)}` : `$${amountUSD.toFixed(2)}`} al cliente ${targetCxC?.clienteNombre || cxcId} mediante ${methodNames[method]}. Ingresado a caja.`
    );
  };

  const handleAddAbonoCxP = (
    cxpId: string,
    amountUSD: number,
    method: PaymentMethodType,
    ref?: string
  ) => {
    setCxp((prev) =>
      prev.map((item) => {
        if (item.id !== cxpId) return item;
        const newAbonado = item.montoAbonadoUSD + amountUSD;
        const newPendiente = Math.max(0, item.montoTotalUSD - newAbonado);
        const newStatus = newPendiente === 0 ? 'pagada' : 'parcial';

        return {
          ...item,
          montoAbonadoUSD: newAbonado,
          saldoPendienteUSD: newPendiente,
          estado: newStatus,
          abonos: [
            ...item.abonos,
            {
              id: generateUUID(),
              fecha: new Date().toISOString().slice(0, 10),
              montoUSD: amountUSD,
              montoVES: usdToVes(amountUSD, bcvRate),
              metodo: method,
              referencia: ref,
            },
          ],
        };
      })
    );

    addAuditLog(
      'Pago a Proveedor (CxP)',
      'finanzas',
      `Pago de $${amountUSD} emitido para proveedor en compromiso ${cxpId}`
    );
  };

  // Manejador: Clientes
  const handleAddNewClient = (client: Client) => {
    setClients((prev) => [...prev, client]);
    addAuditLog(
      'Registro de Cliente',
      'ventas',
      `Nuevo cliente registrado: ${client.nombre} (${client.documento})`
    );
    syncClientToSupabase(client).catch((err) =>
      console.warn('Sync client Supabase aviso:', err)
    );
  };

  // Manejador: Usuarios
  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    addAuditLog(
      'Creación de Usuario',
      'seguridad',
      `Usuario creado: @${newUser.username} con rol ${newUser.rol}`
    );
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    addAuditLog(
      'Actualización de Usuario',
      'seguridad',
      `Usuario @${updatedUser.username} actualizado`
    );
  };

  // Autenticación: Login
  const handleLoginSuccess = (user: User) => {
    try {
      sessionStorage.setItem(
        'pos_active_user_session',
        JSON.stringify({
          id: user.id,
          username: user.username,
          nombre: user.nombre,
          rol: user.rol,
        })
      );
    } catch {
      // ignore
    }
    const isTargetDemo = user.username === 'demo';
    if (isTargetDemo !== isDemoMode) {
      switchEnvironment(user, isTargetDemo);
    } else {
      setCurrentUser(user);
    }
    setIsAuthenticated(true);
    addAuditLog(
      'Inicio de Sesión',
      'seguridad',
      `Ingreso exitoso del usuario @${user.username} (${user.rol}) en ${
        isTargetDemo ? 'Modo Demo' : 'Modo Real'
      }`
    );
    navigate('/' + activeTab, { replace: true });
  };

  // Autenticación: Logout
  const handleLogout = () => {
    try {
      sessionStorage.removeItem('pos_active_user_session');
    } catch {
      // ignore
    }
    addAuditLog(
      'Cierre de Sesión',
      'seguridad',
      `El usuario @${currentUser.username} cerró sesión`
    );
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  };

  // Subida masiva inicial de datos locales a Supabase
  const handlePushLocalDataToSupabase = async () => {
    return await syncBulkDataToSupabase({
      products,
      clients,
      suppliers,
      sales,
      expenses,
      cxc,
      activeShift,
      shiftHistory,
    });
  };

  // Si no está autenticado, renderizar la pantalla de Login con consulta estándar
  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        users={users}
        defaultCredentials={defaultCredentials}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 font-sans antialiased">
      {/* Encabezado Principal con Indicador de Tasa BCV y Control de Usuario */}
      <Header
        currentUser={currentUser}
        bcvRate={bcvRate}
        bcvSource={bcvSource}
        isBcvLoading={isBcvLoading}
        onRefreshBCV={handleRefreshBCV}
        onUpdateManualBCV={handleUpdateManualBCV}
        activeShift={activeShift}
        onOpenQuickLogin={() => setIsQuickUserModalOpen(true)}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        supabaseStatus={supabaseStatus}
        isDemoMode={isDemoMode}
        onToggleDemoMode={handleToggleDemoMode}
      />

      {/* Contenedor Principal: Barra Lateral y Módulo Activo */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1700px] w-full mx-auto p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 gap-4 sm:gap-6 transition-all duration-200">
        {/* Barra Lateral de Navegación por Roles con opción de retraer */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          userRole={currentUser.rol}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Área del Módulo Seleccionado */}
        <main className="flex-1 min-w-0">
          {activeTab === 'pos' && (
            <POSModule
              products={products}
              clients={clients}
              currentUser={currentUser}
              activeShift={activeShift}
              bcvRate={bcvRate}
              onCompleteSale={handleCompleteSale}
              onAddNewClient={handleAddNewClient}
              onGoToCashControl={() => handleSelectTab('caja')}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebarCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          )}

          {activeTab === 'inventario' && (
            <InventoryModule
              products={products}
              bcvRate={bcvRate}
              currentUser={currentUser}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onStockMovement={handleStockMovement}
            />
          )}

          {activeTab === 'caja' && (
            <CashControlModule
              activeShift={activeShift}
              shiftHistory={shiftHistory}
              sales={sales}
              currentUser={currentUser}
              bcvRate={bcvRate}
              cxc={cxc}
              products={products}
              onOpenShift={handleOpenShift}
              onCloseShift={handleCloseShift}
              onCancelSale={handleCancelSale}
              onAddAbonoCxC={handleAddAbonoCxC}
            />
          )}

          {activeTab === 'finanzas' && (
            <FinanceModule
              expenses={expenses}
              cxc={cxc}
              cxp={cxp}
              sales={sales}
              currentUser={currentUser}
              bcvRate={bcvRate}
              onAddExpense={handleAddExpense}
              onAddAbonoCxC={handleAddAbonoCxC}
              onAddAbonoCxP={handleAddAbonoCxP}
            />
          )}

          {activeTab === 'reportes' && (
            <ReportsModule
              sales={sales}
              expenses={expenses}
              products={products}
              bcvRate={bcvRate}
            />
          )}

          {activeTab === 'seguridad' && (
            <AuditUsersModule
              users={users}
              auditLogs={auditLogs}
              currentUser={currentUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onOpenDatabaseConfig={() => setIsSupabaseModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Footer Estilo Clean Utility / Minimal */}
      <footer className="h-8 bg-slate-100 border-t border-slate-200 px-4 sm:px-6 flex items-center justify-between text-[10px] text-slate-500 font-mono shrink-0 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-4">
          <span>SESIÓN ACTIVA: TERMINAL_01 // CAJERO: {currentUser.username.toUpperCase()}</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="hidden sm:inline">ESTADO: SISTEMA EN LÍNEA // SINCRONIZADO</span>
        </div>
        <div className="text-slate-400">
          VENTAFLOW // CONTROL ADMINISTRATIVO & MULTIMONEDA BCV
        </div>
      </footer>

      {/* Modal de Cambio Rápido de Usuario / Rol para Pruebas */}
      <QuickUserModal
        isOpen={isQuickUserModalOpen}
        onClose={() => setIsQuickUserModalOpen(false)}
        currentUser={currentUser}
        users={users}
        isDemoMode={isDemoMode}
        onSelectUser={(u) => {
          try {
            sessionStorage.setItem(
              'pos_active_user_session',
              JSON.stringify({
                id: u.id,
                username: u.username,
                nombre: u.nombre,
                rol: u.rol,
              })
            );
          } catch {
            // ignore
          }
          const isTargetDemo = u.username === 'demo';
          if (isTargetDemo !== isDemoMode) {
            switchEnvironment(u, isTargetDemo);
          } else {
            setCurrentUser(u);
          }
          addAuditLog(
            'Cambio Rápido de Usuario',
            'seguridad',
            `Usuario activo cambiado a @${u.username} (${u.rol})`
          );
        }}
        onSelectDemoMode={handleToggleDemoMode}
      />

      {/* Modal de Configuración y Diagnóstico de Supabase Database */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onSyncNow={handleSyncSupabase}
        isSyncing={isSyncingWithSupabase}
        onPushLocalData={handlePushLocalDataToSupabase}
      />
    </div>
  );
}
