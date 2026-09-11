import React, { useState } from 'react';
import { Key, User as UserIcon, Lock, AlertCircle, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
  users: User[];
  defaultCredentials: Record<string, string>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  users,
  defaultCredentials,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const executeLogin = (usr: string, pass: string) => {
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanUser = usr.trim().toLowerCase();
      // Buscar usuario en la lista cargada o en usuarios del sistema
      const foundUser = users.find(
        (u) => u.username.toLowerCase() === cleanUser
      );

      const expectedPass = defaultCredentials[cleanUser];

      if (!foundUser) {
        setErrorMsg('Usuario no registrado en el sistema.');
        setIsLoading(false);
        return;
      }

      if (!foundUser.activo) {
        setErrorMsg('Este usuario se encuentra desactivado. Contacte al administrador.');
        setIsLoading(false);
        return;
      }

      if (expectedPass && pass !== expectedPass) {
        setErrorMsg('Contraseña incorrecta. Verifique sus credenciales.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLoginSuccess(foundUser);
    }, 250);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Por favor ingrese su usuario.');
      return;
    }
    if (!password) {
      setErrorMsg('Por favor ingrese su contraseña.');
      return;
    }
    executeLogin(username, password);
  };

  const handleEnterDemo = () => {
    executeLogin('demo', 'demo123');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm mx-auto mb-3">
            V
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
            VentaFlow POS
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Control de Inventario, Ventas Multimoneda & Facturación
          </p>
        </div>

        {/* Card Login */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="mb-5 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-wide">
              Iniciar Sesión
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ingrese su usuario y contraseña para acceder al sistema.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingrese su usuario"
                  className="w-full pl-10 pr-3 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-900"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all text-slate-900"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 uppercase tracking-wider"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Acceso a Modo Demo opcional y discreto */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 mb-2">
              ¿Desea explorar el sistema con datos de demostración?
            </p>
            <button
              id="btn-access-demo-mode"
              type="button"
              onClick={handleEnterDemo}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Acceder al Modo Demo</span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-500 ml-1" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-[11px] text-slate-400">
          VentaFlow POS &bull; Acceso Seguro y Control Comercial
        </div>
      </div>
    </div>
  );
};
