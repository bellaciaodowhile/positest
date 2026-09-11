import React from 'react';
import {
  ShoppingCart,
  Package,
  Wallet,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Role } from '../types';

export type ActiveTab = 'pos' | 'inventario' | 'caja' | 'finanzas' | 'reportes' | 'seguridad';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  userRole: Role;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  userRole,
  isCollapsed = true,
  onToggleCollapse,
}) => {
  const menuItems = [
    {
      id: 'pos' as ActiveTab,
      label: 'Terminal POS',
      shortLabel: 'POS',
      description: 'Ventas, Multimoneda & Vuelto',
      icon: ShoppingCart,
      roles: ['admin', 'cajero'],
    },
    {
      id: 'inventario' as ActiveTab,
      label: 'Inventario & Catálogo',
      shortLabel: 'Inventario',
      description: 'Precios USD/BCV & Escáner',
      icon: Package,
      roles: ['admin', 'inventario', 'cajero'],
    },
    {
      id: 'caja' as ActiveTab,
      label: 'Control de Caja',
      shortLabel: 'Caja',
      description: 'Apertura, Arqueo & Cierre',
      icon: Wallet,
      roles: ['admin', 'cajero'],
    },
    {
      id: 'finanzas' as ActiveTab,
      label: 'Finanzas & Costos',
      shortLabel: 'Finanzas',
      description: 'Egresos, CxC, CxP & Margen',
      icon: TrendingUp,
      roles: ['admin'],
    },
    {
      id: 'reportes' as ActiveTab,
      label: 'Reportes & Métricas',
      shortLabel: 'Reportes',
      description: 'Análisis, PDF & Excel',
      icon: BarChart3,
      roles: ['admin'],
    },
    {
      id: 'seguridad' as ActiveTab,
      label: 'Seguridad & Acceso',
      shortLabel: 'Seguridad',
      description: 'Roles, Usuarios & Auditoría',
      icon: ShieldCheck,
      roles: ['admin'],
    },
  ];

  return (
    <>
      {/* Barra Lateral Desktop (pantallas grandes >= lg) */}
      <aside
        id="main-navigation-sidebar"
        className={`hidden lg:flex bg-white border border-slate-200 rounded-2xl p-3 lg:p-4 flex-col justify-between shrink-0 shadow-xs transition-all duration-200 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className="w-full">
          {/* Header con botón para retraer / expandir */}
          <div className="flex items-center justify-between mb-3 px-1">
            {!isCollapsed && (
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Operaciones Rápidas
              </div>
            )}
            {onToggleCollapse && (
              <button
                id="btn-toggle-sidebar-collapse"
                type="button"
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expandir menú de opciones rápidas' : 'Retraer menú (más espacio para productos)'}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ${
                  isCollapsed ? 'mx-auto' : ''
                }`}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-1.5 w-full">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isAuthorized = item.roles.includes(userRole);
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  onClick={() => {
                    if (isAuthorized) {
                      onSelectTab(item.id);
                    }
                  }}
                  disabled={!isAuthorized}
                  className={`flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                  } rounded-xl text-left transition-all text-xs font-medium group border ${
                    isActive
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold shadow-2xs'
                      : isAuthorized
                      ? 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300 cursor-pointer'
                      : 'bg-slate-50/40 border-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                  }`}
                  title={!isAuthorized ? 'Acceso restringido por rol de usuario' : item.label}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isAuthorized
                        ? 'bg-white text-slate-600 group-hover:text-indigo-600 border border-slate-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs truncate">{item.label}</span>
                        {!isAuthorized && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal leading-tight truncate">
                        {item.description}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Widgets Inferiores estilo Clean Utility */}
        <div className="flex flex-col gap-3 pt-3 mt-3 border-t border-slate-200">
          {!isCollapsed ? (
            <>
              {/* Quick Report Export Card */}
              <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100 text-center">
                <p className="text-xs text-indigo-800 font-medium mb-1.5">
                  Exportar Reporte
                </p>
                <div className="flex gap-1.5 justify-center">
                  <button
                    type="button"
                    onClick={() => onSelectTab('reportes')}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold rounded-lg border border-indigo-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3 h-3 text-indigo-600" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTab('reportes')}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold rounded-lg border border-indigo-200 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                    EXCEL
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => onSelectTab('reportes')}
                title="Exportar Reportes (PDF / Excel)"
                className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <div
                title="Sistema En Línea"
                className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200 animate-pulse"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Barra de Navegación Inferior Móvil (pantallas < lg) */}
      <nav
        id="mobile-bottom-navbar"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isAuthorized = item.roles.includes(userRole);

          return (
            <button
              key={item.id}
              id={`mobile-bottom-nav-${item.id}`}
              type="button"
              disabled={!isAuthorized}
              onClick={() => {
                if (isAuthorized) onSelectTab(item.id);
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-600 font-bold scale-105'
                  : isAuthorized
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-slate-300 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? 'bg-indigo-50 text-indigo-600' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] leading-none mt-0.5 truncate max-w-[56px]">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
