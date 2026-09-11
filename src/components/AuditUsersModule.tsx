import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  History,
  Lock,
  FileSpreadsheet,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Key,
  Database,
} from 'lucide-react';
import { User, UserRole, AuditLog } from '../types';
import { generateUUID } from '../services/uuidUtils';

interface AuditUsersModuleProps {
  users: User[];
  auditLogs: AuditLog[];
  currentUser: User;
  onAddUser: (newUser: User) => void;
  onUpdateUser: (updatedUser: User) => void;
  onOpenDatabaseConfig?: () => void;
}

export const AuditUsersModule: React.FC<AuditUsersModuleProps> = ({
  users,
  auditLogs,
  currentUser,
  onAddUser,
  onUpdateUser,
  onOpenDatabaseConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'auditoria'>('usuarios');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal Usuario
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UserRole>('cajero');
  const [activo, setActivo] = useState(true);

  const canManageUsers = currentUser.rol === 'admin';

  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUsername('');
    setNombre('');
    setPassword('');
    setRol('cajero');
    setActivo(true);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setNombre(u.nombre);
    setPassword(u.password || '');
    setRol(u.rol);
    setActivo(u.activo);
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nombre.trim()) return;

    if (editingUser) {
      const updated: User = {
        ...editingUser,
        username: username.trim().toLowerCase(),
        nombre: nombre.trim(),
        rol,
        activo,
        password: password || editingUser.password,
      };
      onUpdateUser(updated);
    } else {
      const newUser: User = {
        id: generateUUID(),
        username: username.trim().toLowerCase(),
        nombre: nombre.trim(),
        password: password || '123456',
        rol,
        activo,
        fechaCreacion: new Date().toISOString().slice(0, 10),
      };
      onAddUser(newUser);
    }

    setShowUserModal(false);
  };

  const filteredLogs = auditLogs.filter(
    (log) =>
      log.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuarioNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.detalles.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="audit-users-module-root" className="space-y-4">
      {/* Selector de Pestañas */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('usuarios')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'usuarios'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Gestión de Usuarios y Roles ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auditoria')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'auditoria'
                ? 'bg-slate-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Trazabilidad y Auditoría ({auditLogs.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canManageUsers && onOpenDatabaseConfig && (
            <button
              type="button"
              onClick={onOpenDatabaseConfig}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Configuración avanzada de base de datos"
            >
              <Database className="w-3.5 h-3.5 text-slate-600" />
              <span>Base de Datos</span>
            </button>
          )}

          {activeTab === 'usuarios' && canManageUsers && (
            <button
              type="button"
              onClick={handleOpenNewUser}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Usuario</span>
            </button>
          )}
        </div>
      </div>

      {/* Pestaña: Usuarios y Permisos */}
      {activeTab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-slate-50/50">
            <h4 className="text-sm font-bold text-gray-900">Perfiles de Acceso al Sistema</h4>
            <p className="text-xs text-gray-500">
              Control de credenciales, roles asignados y niveles de acceso a los módulos comerciales.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-3 py-3">Usuario (Login)</th>
                  <th className="px-3 py-3">Rol Asignado</th>
                  <th className="px-3 py-3">Permisos Clave</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  let roleColor = 'bg-gray-100 text-gray-700 border-gray-200';
                  let permisos = 'Venta en mostrador, emisión de recibos y consulta de stock';
                  if (u.rol === 'admin') {
                    roleColor = 'bg-rose-50 text-rose-800 border-rose-200';
                    permisos = 'Acceso total: Precios, anulación de notas, cierres, finanzas y reportes';
                  } else if (u.rol === 'inventario') {
                    roleColor = 'bg-blue-50 text-blue-800 border-blue-200';
                    permisos = 'Entrada/salida de mercancía, conteo físico y catálogos';
                  }

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50/80 ${u.username === 'demo' ? 'bg-purple-50/40' : ''}`}>
                      <td className="px-4 py-3 font-bold text-gray-900 flex items-center gap-2">
                        <span>{u.nombre}</span>
                        {u.username === 'demo' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                            Demo Clientes
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-600 font-semibold">{u.username}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${roleColor}`}
                        >
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500 max-w-xs truncate">{permisos}</td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManageUsers && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pestaña: Trazabilidad y Auditoría */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por acción, usuario o módulo..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <span className="text-xs text-gray-400">
              Registrado en tiempo real según las directrices de seguridad
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-3 py-3">Módulo</th>
                  <th className="px-3 py-3">Acción</th>
                  <th className="px-3 py-3">Usuario Responsable</th>
                  <th className="px-4 py-3">Detalles de la Operación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.fecha).toLocaleString('es-VE')}
                    </td>
                    <td className="px-3 py-3 font-bold text-gray-700 uppercase">{log.modulo}</td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-800">
                        {log.accion}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-sans font-semibold text-gray-900">
                      {log.usuarioNombre}
                    </td>
                    <td className="px-4 py-3 font-sans text-gray-600">{log.detalles}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {editingUser ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Configura credenciales y permisos operativos en el sistema.
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. Juan Pérez"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre de Usuario (Login)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej. jperez"
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Contraseña {editingUser && '(dejar en blanco para conservar)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? '••••••' : 'Ingresa contraseña segura'}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Perfil de Acceso (Rol)
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
                >
                  <option value="admin">Administrador (Control Total & Reportes)</option>
                  <option value="cajero">Cajero (Ventas, Cobros y Cierre de Caja)</option>
                  <option value="inventario">Operador de Inventario (Stock y Artículos)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Usuario Activo en el Sistema</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
