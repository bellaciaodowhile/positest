import React, { useState } from 'react';
import {
  DollarSign,
  RefreshCw,
  User as UserIcon,
  LogOut,
  Lock,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Menu,
  X,
  ChevronRight,
  ShoppingCart,
  Package,
  Wallet,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { User, CashShift, Role } from '../types';
import { formatVES } from '../services/bcvService';

export type ActiveTab = 'pos' | 'inventario' | 'caja' | 'finanzas' | 'reportes' | 'seguridad';

interface HeaderProps {
  currentUser: User;
  bcvRate: number;
  bcvSource: string;
  isBcvLoading: boolean;
  onRefreshBCV: () => void;
  onUpdateManualBCV: (newRate: number) => void;
  activeShift: CashShift | null;
  onOpenQuickLogin: () => void;
  onLogout: () => void;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onOpenSupabaseModal?: () => void;
  supabaseStatus?: 'connected' | 'disconnected' | 'connecting' | 'error';
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  bcvRate,
  bcvSource,
  isBcvLoading,
  onRefreshBCV,
  onUpdateManualBCV,
  activeShift,
  onOpenQuickLogin,
  onLogout,
  activeTab = 'pos',
  onSelectTab,
  onOpenSupabaseModal,
  supabaseStatus = 'disconnected',
  isDemoMode = false,
  onToggleDemoMode,
}) => {
  const [showEditRateModal, setShowEditRateModal] = useState(false);
  const [customRateInput, setCustomRateInput] = useState(bcvRate.toString());
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customRateInput);
    if (!isNaN(val) && val > 0) {
      onUpdateManualBCV(val);
      setShowEditRateModal(false);
    }
  };

  const getRoleBadge = (rol: string, username?: string) => {
    if (username === 'demo') {
      return {
        label: 'Demo Clientes (Full)',
        bg: 'text-purple-700 font-bold',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    switch (rol) {
      case 'admin':
        return {
          label: 'Administrador',
          bg: 'text-indigo-600 font-semibold',
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'cajero':
        return {
          label: 'Cajero POS',
          bg: 'text-emerald-600 font-semibold',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'inventario':
        return {
          label: 'Operador Almacén',
          bg: 'text-amber-600 font-semibold',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      default:
        return {
          label: rol,
          bg: 'text-slate-500 font-medium',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
        };
    }
  };

  const roleInfo = getRoleBadge(currentUser.rol, currentUser.username);

  const navMenuItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'Terminal POS',
      description: 'Ventas, Multimoneda & Vuelto',
      icon: ShoppingCart,
      roles: ['admin', 'cajero'],
    },
    {
      id: 'inventario' as ActiveTab,
      label: 'Inventario & Catálogo',
      description: 'Precios USD/BCV & Escáner',
      icon: Package,
      roles: ['admin', 'inventario', 'cajero'],
    },
    {
      id: 'caja' as ActiveTab,
      label: 'Caja Operativa',
      description: 'Apertura, Arqueo & Conciliación',
      icon: Wallet,
      roles: ['admin', 'cajero'],
    },
    {
      id: 'finanzas' as ActiveTab,
      label: 'Finanzas & Costos',
      description: 'Egresos, CxC, CxP & Margen',
      icon: TrendingUp,
      roles: ['admin'],
    },
    {
      id: 'reportes' as ActiveTab,
      label: 'Reportes & Métricas',
      description: 'Análisis, PDF & Excel',
      icon: BarChart3,
      roles: ['admin'],
    },
    {
      id: 'seguridad' as ActiveTab,
      label: 'Seguridad & Acceso',
      description: 'Roles, Usuarios & Auditoría',
      icon: ShieldCheck,
      roles: ['admin'],
    },
  ];

  const currentActiveItem = navMenuItems.find((item) => item.id === activeTab);

  const handleNavClick = (tabId: ActiveTab) => {
    setIsMobileDrawerOpen(false);
    if (onSelectTab) {
      onSelectTab(tabId);
    }
  };

  return (
    <>
      {/* Banner de Aviso de Modo Demo Aislado */}
      {isDemoMode && (
        <div
          id="demo-mode-alert-banner"
          className="bg-purple-950 text-white px-3 sm:px-6 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-purple-800 shadow-xs z-40 sticky top-0"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
            </span>
            <span className="font-black tracking-wide uppercase text-[10px] sm:text-[11px] text-purple-200">
              Modo Demostración Activo:
            </span>
            <span className="text-slate-200 text-xs hidden md:inline">
              Datos simulados para presentaciones a clientes. La base de datos real está limpia y aislada.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-purple-300 font-mono hidden sm:inline">
              (El demo es aparte)
            </span>
            {onToggleDemoMode && (
              <button
                type="button"
                onClick={onToggleDemoMode}
                className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-950 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Salir del modo demostración y entrar al sistema real"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ir al Sistema Real</span>
              </button>
            )}
          </div>
        </div>
      )}

      <header
        id="main-app-header"
        className={`h-16 bg-white border-b border-slate-200 sticky ${isDemoMode ? 'top-8' : 'top-0'} z-30 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-xs`}
      >
        {/* Lado Izquierdo: Botón Menú Móvil + Logo + Título Activo */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Botón Hamburguesa Responsive para Móviles y Tablets */}
          <button
            id="btn-open-mobile-drawer"
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Abrir menú de navegación"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo y Nombre del Comercio */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              V
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-800 uppercase truncate">
                VentaFlow
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                POS Multimoneda
              </span>
              {/* Badge de sección activa en pantallas intermedias */}
              {currentActiveItem && (
                <span className="hidden sm:inline-flex md:hidden items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shrink-0 truncate">
                  {currentActiveItem.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lado Derecho: Tasa BCV, Estado de Caja & Controles de Usuario */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-5 shrink-0">
          {/* Tasa BCV Widget: Versión Adaptativa */}
          {/* Versión Compacta en Móviles (< sm) */}
          <div
            id="bcv-rate-indicator-mobile"
            className="flex sm:hidden items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors"
            onClick={() => {
              setCustomRateInput(bcvRate.toString());
              setShowEditRateModal(true);
            }}
            title="Tasa BCV Oficial. Clic para ajustar manualmente."
          >
            <span className="text-[11px] font-semibold text-emerald-700">BCV:</span>
            <span>{bcvRate.toFixed(2)}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRefreshBCV();
              }}
              disabled={isBcvLoading}
              className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded transition-colors"
              title="Sincronizar tasa oficial"
            >
              <RefreshCw
                className={`w-3 h-3 ${isBcvLoading ? 'animate-spin text-emerald-700' : ''}`}
              />
            </button>
          </div>

          {/* Versión Completa en Desktop/Tablet (>= sm) */}
          <div
            id="bcv-rate-indicator-desktop"
            className="hidden sm:flex flex-col items-end border-r border-slate-200 pr-3 sm:pr-5 cursor-pointer group"
            onClick={() => {
              setCustomRateInput(bcvRate.toString());
              setShowEditRateModal(true);
            }}
            title="Clic para ajustar tasa manualmente o sincronizar con API de BCV"
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                Tasa BCV Oficial
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshBCV();
                }}
                disabled={isBcvLoading}
                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                title="Sincronizar tasa oficial"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isBcvLoading ? 'animate-spin text-indigo-600' : ''}`}
                />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-bold text-emerald-600">
                {bcvRate.toFixed(2)} Bs/REF
              </span>
            </div>
          </div>

          {/* Estado de Turno de Caja */}
          <div
            id="cash-shift-badge"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
              activeShift && activeShift.estado === 'abierta'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
            title={activeShift && activeShift.estado === 'abierta' ? 'Caja Activa y Operativa' : 'Caja Cerrada'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeShift && activeShift.estado === 'abierta'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {activeShift && activeShift.estado === 'abierta'
                ? `Caja Abierta (${activeShift.cajeroNombre.split(' ')[0]})`
                : 'Caja Cerrada'}
            </span>
          </div>

          {/* Botón & Indicador de Modo Real vs Modo Demo */}
          {/* Botón & Indicador de Modo Real vs Modo Demo (Desktop) */}
          {onToggleDemoMode && (
            <button
              id="btn-toggle-demo-mode"
              type="button"
              onClick={onToggleDemoMode}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                isDemoMode
                  ? 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200 shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
              }`}
              title={
                isDemoMode
                  ? 'Modo Demo Activo. Clic para cambiar a Modo Real.'
                  : 'Modo Real Activo. Clic para cambiar a Modo Demo.'
              }
            >
              {isDemoMode ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Modo Demo</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Modo Real</span>
                </>
              )}
            </button>
          )}

          {/* Botón & Indicador de Modo Real vs Modo Demo (Móvil) */}
          {onToggleDemoMode && (
            <button
              type="button"
              onClick={onToggleDemoMode}
              className={`flex sm:hidden items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                isDemoMode
                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
              title={
                isDemoMode
                  ? 'Modo Demo Activo. Clic para cambiar a Modo Real.'
                  : 'Modo Real Activo. Clic para cambiar a Modo Demo.'
              }
            >
              {isDemoMode ? (
                <>
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>Demo</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Real</span>
                </>
              )}
            </button>
          )}

          {/* Indicador de caja compacto en tablets pequeñas */}
          <div
            className={`hidden sm:flex md:hidden items-center justify-center w-8 h-8 rounded-lg border ${
              activeShift && activeShift.estado === 'abierta'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={activeShift && activeShift.estado === 'abierta' ? 'Caja Abierta' : 'Caja Cerrada'}
          >
            <Wallet className="w-4 h-4" />
          </div>

          {/* Usuario Actual & Controles de Sesión */}
          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-200">
            <button
              id="btn-switch-user"
              type="button"
              onClick={onOpenQuickLogin}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50 transition-colors text-left cursor-pointer"
              title="Cambiar rol o usuario para probar permisos"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                {currentUser.nombre.charAt(0)}
              </div>
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[110px]">
                  {currentUser.nombre}
                </p>
                <p className={`text-[10px] ${roleInfo.bg} mt-0.5 leading-none`}>
                  {roleInfo.label}
                </p>
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 hidden xl:block" />
            </button>

            <button
              id="btn-logout"
              type="button"
              onClick={onLogout}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* DRAWER RESPONSIVE DE NAVEGACIÓN COMPLETA (Móvil / Tablet) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Panel Lateral Deslizable */}
          <div className="fixed inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {/* Cabecera del Menú Móvil */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  V
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    VentaFlow POS
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Menú de Operaciones
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjeta de Usuario y Estado de Caja dentro del Menú */}
            <div className="p-3.5 mx-3 mt-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {currentUser.nombre}
                    </p>
                    <span className={`text-[10px] ${roleInfo.bg} leading-none block`}>
                      {roleInfo.label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onOpenQuickLogin();
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Cambiar usuario"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between ${
                  activeShift && activeShift.estado === 'abierta'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeShift && activeShift.estado === 'abierta'
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {activeShift && activeShift.estado === 'abierta'
                      ? 'Caja Operativa: Abierta'
                      : 'Caja Cerrada'}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {bcvRate.toFixed(2)} Bs/USD
                </span>
              </div>

              {/* Selector de Modo en Menú Móvil */}
              {onToggleDemoMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onToggleDemoMode();
                  }}
                  className={`mt-2.5 w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isDemoMode
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDemoMode ? (
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{isDemoMode ? 'Modo Demostración' : 'Modo Real'}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isDemoMode
                        ? 'bg-purple-200 text-purple-900'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isDemoMode ? 'Cambiar a Real' : 'Cambiar a Demo'}
                  </span>
                </button>
              )}
            </div>

            {/* Listado de Módulos de Navegación */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Módulos del Sistema
              </div>

              {navMenuItems.map((item) => {
                const Icon = item.icon;
                const isAuthorized = item.roles.includes(currentUser.rol);
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`mobile-nav-${item.id}`}
                    type="button"
                    disabled={!isAuthorized}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all border ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-2xs'
                        : isAuthorized
                        ? 'bg-white border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200 cursor-pointer'
                        : 'bg-slate-50/50 border-transparent text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : isAuthorized
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">
                            {item.label}
                          </span>
                          {!isAuthorized && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    {isAuthorized && (
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-indigo-600' : 'text-slate-300'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pie del Menú Móvil */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/60 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setCustomRateInput(bcvRate.toString());
                  setShowEditRateModal(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>Ajustar Tasa BCV Oficial</span>
                </div>
                <span className="font-mono text-emerald-600 font-bold">
                  {bcvRate.toFixed(2)} Bs
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajustar Tasa BCV Manualmente */}
      {showEditRateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Ajustar Tasa Oficial BCV
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Todos los precios fijados en dólares (USD) se recalculan automáticamente en Bolívares
              (VES) con esta tasa de referencia.
            </p>

            <form onSubmit={handleSaveRate}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tasa de Cambio Oficial (Bs. por 1 USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-medium text-sm font-mono">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    required
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Ejemplo: 68.50 (o el monto publicado por el Banco Central de Venezuela)
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 mb-5 space-y-1.5">
                <div className="flex justify-between">
                  <span>REF 1.00 equivale a:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatVES(parseFloat(customRateInput) || 0)}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span>REF 15.50 equivale a:</span>
                  <strong className="text-slate-900 font-mono">
                    {formatVES((parseFloat(customRateInput) || 0) * 15.5)}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditRateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Guardar Tasa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

