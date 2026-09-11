import React from 'react';
import { X, Check, Shield, User as UserIcon, Sparkles, Building2, ShieldCheck } from 'lucide-react';
import { User, Role } from '../types';

interface QuickUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  isDemoMode: boolean;
  onSelectDemoMode?: () => void;
}

export const QuickUserModal: React.FC<QuickUserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users,
  onSelectUser,
  isDemoMode,
  onSelectDemoMode,
}) => {
  if (!isOpen) return null;

  const getRoleDesc = (rol: Role, username?: string) => {
    if (username === 'demo') {
      return 'Entorno de prueba aislado para demostraciones a clientes. Contiene catálogo, ventas simuladas, arqueo y reportes de muestra sin alterar la base de datos real.';
    }
    switch (rol) {
      case 'admin':
        return 'Control maestro: Modificación de precios, anulación de notas, reportes de utilidades, finanzas y auditoría del sistema real.';
      case 'cajero':
        return 'Operatividad en Punto de Venta (POS), cobros multimoneda, cálculo de vuelto, apertura y cierre de su propio turno de caja.';
      case 'inventario':
        return 'Administración de catálogo real, escáner de código de barras, entradas, salidas y ajustes de stock físico.';
    }
  };

  const realUsers = users.filter((u) => u.username !== 'demo');
  const demoUser = users.find((u) => u.username === 'demo') || {
    id: 'u-demo-00',
    username: 'demo',
    nombre: 'Usuario Demo (Presentación Clientes)',
    email: 'demo@ventaflow.com',
    rol: 'admin' as Role,
    activo: true,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Cambiar Perfil y Entorno</h3>
            <p className="text-xs text-gray-500">
              Alterna entre usuarios reales del sistema o accede al Modo Demo de presentación.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* SECCIÓN 1: USUARIOS DEL SISTEMA REAL */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Usuarios del Sistema Real (Sin Datos Falsos)</span>
            </div>
            <div className="space-y-2">
              {realUsers.map((user) => {
                const isSelected = !isDemoMode && user.id === currentUser.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      onSelectUser(user);
                      onClose();
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-gray-900">{user.nombre}</span>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${
                            user.rol === 'admin'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                              : user.rol === 'cajero'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {user.rol}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">Usuario: @{user.username}</div>
                      <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed bg-white/80 p-2 rounded-lg border border-gray-100">
                        {getRoleDesc(user.rol, user.username)}
                      </p>
                    </div>

                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 2: MODO DEMOSTRACIÓN SEPARADO */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Modo Demostración (Aislado para Clientes)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                Sandbox
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onSelectDemoMode) {
                  onSelectDemoMode();
                } else {
                  onSelectUser(demoUser);
                }
                onClose();
              }}
              className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                isDemoMode
                  ? 'border-purple-600 bg-purple-50/80 shadow-xs ring-1 ring-purple-500'
                  : 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-purple-950">
                    {demoUser.nombre}
                  </span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md border bg-purple-200 text-purple-900 border-purple-300">
                    Demo Clientes
                  </span>
                </div>
                <div className="text-[11px] text-purple-700 mt-0.5 font-medium">
                  Usuario: @{demoUser.username} • Acceso Total Precargado
                </div>
                <p className="text-[11px] text-purple-900/80 mt-1.5 leading-relaxed bg-white/80 p-2 rounded-lg border border-purple-100">
                  {getRoleDesc('admin', 'demo')}
                </p>
              </div>

              {isDemoMode ? (
                <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-purple-300 shrink-0 mt-0.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
