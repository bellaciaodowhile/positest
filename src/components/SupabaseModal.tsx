import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Database,
  ExternalLink,
  Code,
  Table,
  Lock,
  Download,
  Rocket,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sliders,
  Trash2,
} from 'lucide-react';
import { SUPABASE_SCHEMA_SQL, SUPABASE_CLEAN_REAL_MODE_SQL } from '../services/supabaseSql';
import {
  getSupabaseConfig,
  setRuntimeSupabaseCredentials,
  testSupabaseConnection,
} from '../services/supabaseClient';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncNow?: () => Promise<void>;
  isSyncing?: boolean;
  onPushLocalData?: () => Promise<{ success: boolean; count: number; error?: string }>;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onSyncNow,
  isSyncing = false,
  onPushLocalData,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedCleanSql, setCopiedCleanSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [activeTab, setActiveTab] = useState<'env' | 'vercel' | 'sql' | 'clean' | 'deploy' | 'instructions'>('env');

  // Configuración
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [configSource, setConfigSource] = useState<'env' | 'localStorage' | 'none'>('none');

  // Estado de prueba de conexión
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  // Cargar configuración actual al abrir
  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setSupabaseUrl(cfg.url);
      setSupabaseAnonKey(cfg.anonKey);
      setConfigSource(cfg.source);
      setTestResult(null);

      if (cfg.url && cfg.anonKey) {
        handleTestConnection(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyCleanSql = () => {
    navigator.clipboard.writeText(SUPABASE_CLEAN_REAL_MODE_SQL);
    setCopiedCleanSql(true);
    setTimeout(() => setCopiedCleanSql(false), 2500);
  };

  const handleDownloadCleanSql = () => {
    const blob = new Blob([SUPABASE_CLEAN_REAL_MODE_SQL], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'limpiar_base_de_datos_real.sql');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyEnvSnippet = () => {
    const snippet = `# Configuración de Supabase para VentaFlow POS
VITE_SUPABASE_URL=${supabaseUrl || 'https://tu-proyecto.supabase.co'}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey || 'tu_anon_public_key_aqui'}`;
    navigator.clipboard.writeText(snippet);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([SUPABASE_SCHEMA_SQL], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'supabase_ventaflow_pos.sql');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRuntimeSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    const cfg = getSupabaseConfig();
    setConfigSource(cfg.source);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);

    // Probar de inmediato
    await handleTestConnection(true);

    // Si tiene sincronizador activo, ejecutarlo
    if (onSyncNow) {
      await onSyncNow();
    }
  };

  const handleTestConnection = async (forceSave = false) => {
    if (forceSave) {
      setRuntimeSupabaseCredentials(supabaseUrl, supabaseAnonKey);
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult({
        tested: true,
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        message: err.message || 'Error desconocido al probar conexión.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExecutePushLocalData = async () => {
    if (!onPushLocalData) return;
    setIsPushing(true);
    setPushResult(null);
    try {
      const res = await onPushLocalData();
      setPushResult({
        tested: true,
        success: res.success,
        message: res.success
          ? `¡Éxito! Se sincronizaron exitosamente ${res.count} registros reales a Supabase.`
          : `Error al subir datos: ${res.error || 'Verifica la consola.'}`,
      });
      if (res.success && onSyncNow) {
        await onSyncNow();
      }
    } catch (err: any) {
      setPushResult({
        tested: true,
        success: false,
        message: err.message || 'Error inesperado al subir datos a Supabase.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">Conexión a Supabase Database</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    testResult?.success
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : configSource !== 'none'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-700 text-slate-300 border-slate-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      testResult?.success
                        ? 'bg-emerald-400 animate-pulse'
                        : configSource !== 'none'
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  {testResult?.success
                    ? 'Online & Conectado'
                    : configSource !== 'none'
                    ? 'Credenciales Cargadas'
                    : 'Sin Conexión'}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Configuración de variables <code className="text-emerald-400">.env</code>, tablas SQL relacionales y sincronización en tiempo real.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs de Navegación */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 sm:px-6 gap-2 sm:gap-4 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('env')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'env'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Configuración & Variables (.env)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vercel')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'vercel'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Rocket className="w-4 h-4 text-indigo-600" />
            Vercel & Producción
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Code className="w-4 h-4" />
            Script SQL Completo (13 Tablas)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clean')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'clean'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Trash2 className="w-4 h-4 text-amber-600" />
            Limpiar Base (Modo Real)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deploy')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'deploy'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Rocket className="w-4 h-4 text-indigo-600" />
            Paso a Paso en Supabase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'instructions'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Table className="w-4 h-4" />
            Estructura de Datos
          </button>
        </div>

        {/* Contenido según Tab */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* TAB 1: .ENV Y CONFIGURACIÓN */}
          {activeTab === 'env' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Card Variables de Entorno .env */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-indigo-600" />
                      Variables en el archivo <code className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs font-mono">.env</code>
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      El proyecto lee automáticamente estas variables al iniciar. También puedes editarlas abajo para probarlas en vivo:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEnvSnippet}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors cursor-pointer border border-indigo-200 shrink-0"
                  >
                    {copiedEnv ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-indigo-700" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar para .env</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-900 rounded-lg p-3.5 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                  <div className="text-slate-400"># Pega esto en tu archivo .env o en las variables de entorno de producción:</div>
                  <div className="text-emerald-400 mt-1">
                    VITE_SUPABASE_URL={supabaseUrl || '<TU_PROJECT_URL_SUPABASE>'}
                  </div>
                  <div className="text-amber-300">
                    VITE_SUPABASE_ANON_KEY={supabaseAnonKey ? (supabaseAnonKey.length > 25 ? `${supabaseAnonKey.slice(0, 22)}...` : supabaseAnonKey) : '<TU_ANON_PUBLIC_KEY>'}
                  </div>
                </div>

                {configSource === 'env' && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Detectadas variables activas desde el archivo <strong>.env</strong> del sistema.</span>
                  </div>
                )}
              </div>

              {/* Formulario de Entrada Rápida / Edición */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-900 mb-1">
                  Ingreso Directo de Credenciales de Supabase
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Ingresa tu Project URL y Anon Key para conectar la base de datos de inmediato sin necesidad de reiniciar:
                </p>

                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Supabase Project URL (API URL)
                    </label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-gray-50/50"
                    />
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      En Supabase: Project Settings → API → Project URL
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Supabase Anon / Public API Key
                    </label>
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-gray-50/50"
                    />
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      En Supabase: Project Settings → API → Project API Keys → anon / public
                    </span>
                  </div>

                  {/* Mensajes de Resultado de Prueba */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        testResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">{testResult.success ? 'Conexión Exitosa' : 'Aviso de Conexión'}</div>
                        <div className="mt-0.5">{testResult.message}</div>
                      </div>
                    </div>
                  )}

                  {saveSuccessMsg && (
                    <div className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      ✓ Credenciales guardadas y sincronizadas con el cliente.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(true)}
                        disabled={isTesting || !supabaseUrl || !supabaseAnonKey}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-300 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Probando...' : 'Probar Conexión'}</span>
                      </button>

                      {onSyncNow && (
                        <button
                          type="button"
                          onClick={onSyncNow}
                          disabled={isSyncing || !supabaseUrl || !supabaseAnonKey}
                          className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-indigo-200 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Cargando datos...' : 'Sincronizar Datos'}</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isTesting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Guardar y Aplicar
                    </button>
                  </div>

                  {/* Sección de Subida Masiva / Inicial de Datos */}
                  {onPushLocalData && (
                    <div className="mt-4 pt-4 border-t border-gray-200 bg-slate-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-emerald-600" />
                            ¿Tienes productos o ventas creadas localmente?
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Sube todo el inventario, clientes, ventas y deudas actuales a tu base de datos Supabase en un solo clic.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExecutePushLocalData}
                          disabled={isPushing || !supabaseUrl || !supabaseAnonKey}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                          <span>{isPushing ? 'Subiendo a Supabase...' : 'Subir Datos Locales a Supabase'}</span>
                        </button>
                      </div>

                      {pushResult && (
                        <div
                          className={`mt-2.5 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                            pushResult.success
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-red-50 border-red-200 text-red-900'
                          }`}
                        >
                          {pushResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div>{pushResult.message}</div>
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB: VERCEL & PRODUCCIÓN */}
          {activeTab === 'vercel' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 sm:p-5 rounded-xl border border-indigo-800 shadow-md">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">
                  <Rocket className="w-4 h-4 text-emerald-400" />
                  Guía Oficial para Vercel
                </div>
                <h4 className="text-base font-bold text-white">
                  Cómo hacer que los datos se guarden en Supabase desde Vercel
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  En Vercel las aplicaciones de React (Vite) se compilan en tiempo de construcción. Para que tu aplicación en Vercel se comunique con Supabase, debes configurar las siguientes variables de entorno en el panel de Vercel.
                </p>
              </div>

              {/* Paso 1: Variables de Entorno en Vercel */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <h5 className="text-sm font-bold text-gray-900">
                      Agrega las 2 Variables en Vercel Project Settings
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEnvSnippet}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEnv ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEnv ? '¡Copiado!' : 'Copiar Variables'}</span>
                  </button>
                </div>

                <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-200 space-y-1 overflow-x-auto border border-slate-800">
                  <div className="text-emerald-400 font-bold">VITE_SUPABASE_URL={supabaseUrl || 'https://tu-proyecto.supabase.co'}</div>
                  <div className="text-emerald-400 font-bold">VITE_SUPABASE_ANON_KEY={supabaseAnonKey || 'tu-anon-key-aqui'}</div>
                </div>

                <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1.5 pl-1">
                  <li>Inicia sesión en <strong>vercel.com</strong> y abre tu proyecto.</li>
                  <li>Ve a la pestaña <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
                  <li>Agrega <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">VITE_SUPABASE_URL</code> con el valor de tu Project URL.</li>
                  <li>Agrega <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">VITE_SUPABASE_ANON_KEY</code> con el valor de tu anon key.</li>
                  <li>Selecciona los tres entornos: <strong>Production</strong>, <strong>Preview</strong> y <strong>Development</strong>.</li>
                  <li>Haz clic en <strong>Save</strong>.</li>
                </ol>
              </div>

              {/* Paso 2: Redespliegue en Vercel */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <h5 className="text-sm font-bold text-gray-900">
                    Redespliega tu Aplicación (Redeploy)
                  </h5>
                </div>
                <p className="text-xs text-gray-600 pl-8">
                  Como Vite inyecta las variables <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-800">VITE_*</code> durante el build, debes ir a la pestaña <strong>Deployments</strong> en Vercel, hacer clic en los 3 puntos del último despliegue y presionar <strong>"Redeploy"</strong>.
                </p>
              </div>

              {/* Paso 3: Alternativa Inmediata sin Redesplegar */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <h5 className="text-xs font-bold text-amber-900">
                    ¿Quieres usarlo de inmediato en Vercel sin esperar el redespliegue?
                  </h5>
                </div>
                <p className="text-xs text-amber-800 pl-6">
                  ¡También puedes hacerlo! Abre tu aplicación en Vercel, haz clic en el botón <strong>"Supabase"</strong> en la esquina superior derecha, pega tus credenciales en la pestaña <strong>Configuración &amp; Variables</strong> y haz clic en <strong>"Guardar y Aplicar"</strong>. El sistema guardará tus credenciales de forma segura en tu navegador y comenzará a guardar ventas reales de inmediato.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SCRIPT SQL COMPLETO */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Script SQL Listo para el SQL Editor de Supabase
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    Copia y ejecuta este script una sola vez en <strong>SQL Editor</strong> de Supabase para crear las 13 tablas, índices y datos iniciales.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar SQL</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSql}
                    className="px-3 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar .sql</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 text-slate-300 font-mono text-xs overflow-x-auto max-h-[420px] border border-slate-800">
                <pre>{SUPABASE_SCHEMA_SQL}</pre>
              </div>
            </div>
          )}

          {/* TAB: LIMPIAR BASE DE DATOS (MODO REAL) */}
          {activeTab === 'clean' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-950">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-950 mb-1">
                      Script SQL para Poner en "Modo Real" (Producción)
                    </h4>
                    <p className="leading-relaxed text-amber-900">
                      Este script limpia todas las transacciones de prueba (ventas, pagos, detalles, movimientos de inventario, cajas chicas, gastos, historial de deudas y cierres de turno) para dejar la base de datos lista para abrir el negocio en vivo.
                    </p>
                    <div className="mt-2.5 p-2 bg-white/80 rounded-lg border border-amber-200 text-amber-950 text-[11px] font-medium space-y-1">
                      <p className="font-bold text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Conserva Intacto:
                      </p>
                      <ul className="list-disc list-inside text-gray-700 pl-1">
                        <li>Usuario Administrador inicial (admin / admin123)</li>
                        <li>Cliente obligatorio predeterminado "Consumidor Final" (V-00000000)</li>
                        <li>Configuración del sistema y tasa de cambio</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    Ejecutar en Supabase SQL Editor
                  </h4>
                  <p className="text-xs text-gray-500">
                    Copia y pega este script en tu proyecto de Supabase &gt; SQL Editor y presiona "Run".
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyCleanSql}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    {copiedCleanSql ? (
                      <>
                        <Check className="w-4 h-4 text-amber-200" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar SQL de Limpieza</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCleanSql}
                    className="px-3 py-2 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar .sql</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 text-slate-300 font-mono text-xs overflow-x-auto max-h-[420px] border border-slate-800">
                <pre>{SUPABASE_CLEAN_REAL_MODE_SQL}</pre>
              </div>
            </div>
          )}

          {/* TAB 3: PASO A PASO */}
          {activeTab === 'deploy' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-indigo-600" />
                  Instrucciones Rápidas para Configurar Supabase en 3 Minutos
                </h4>

                <div className="space-y-4 text-xs text-gray-700">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <strong>Crea un proyecto en Supabase:</strong>
                      <p className="text-gray-500 mt-0.5">
                        Ingresa a <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold underline">supabase.com</a>, crea tu cuenta o inicia sesión, y presiona <em>"New Project"</em>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <strong>Ejecuta el Script SQL:</strong>
                      <p className="text-gray-500 mt-0.5">
                        En el menú lateral de tu proyecto Supabase, ve a <strong>SQL Editor</strong>, haz clic en <em>"New Query"</em>, pega el script de la pestaña <strong>Script SQL Completo</strong> y presiona <strong>Run</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <strong>Copia las credenciales a tu .env:</strong>
                      <p className="text-gray-500 mt-0.5">
                        Ve a <strong>Project Settings → API</strong>. Copia <strong>Project URL</strong> y la clave <strong>anon / public</strong>, y colócalas en tu archivo <code className="text-emerald-700 font-mono">.env</code> o directamente en la pestaña <em>Configuración & Variables (.env)</em> de esta ventana.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
                      4
                    </span>
                    <div>
                      <strong>¡Listo! Sistema en Vivo:</strong>
                      <p className="text-gray-500 mt-0.5">
                        Todas las ventas del POS, movimientos de inventario, cierres de caja y abonos a clientes se sincronizarán directamente en tu base de datos PostgreSQL de Supabase.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ESTRUCTURA DE DATOS */}
          {activeTab === 'instructions' && (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Table className="w-4 h-4 text-emerald-600" />
                  13 Tablas Integradas en Supabase
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  Estructura relacional optimizada con claves foráneas, índices de búsqueda y Row Level Security:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { name: 'productos', desc: 'Catálogo, códigos de barras, clasificación fiscal y stock' },
                    { name: 'clientes', desc: 'Directorio de compradores, límites de crédito en USD' },
                    { name: 'proveedores', desc: 'Registro de proveedores y distribuidores comerciales' },
                    { name: 'cajas_turnos', desc: 'Aperturas de caja, fondo inicial y arqueos físicos' },
                    { name: 'ventas_notas', desc: 'Encabezado de notas de entrega, totales e impuestos' },
                    { name: 'ventas_items', desc: 'Detalle línea a línea de productos vendidos' },
                    { name: 'ventas_pagos', desc: 'Desglose multimoneda (USD/VES) y retención IGTF 3%' },
                    { name: 'movimientos_inventario', desc: 'Kardex histórico de entradas, salidas y ajustes' },
                    { name: 'gastos', desc: 'Egresos operativos clasificados y comprobantes' },
                    { name: 'cuentas_por_cobrar', desc: 'Gestión de crédito comercial y abonos' },
                    { name: 'cuentas_por_pagar', desc: 'Compromisos pendientes con proveedores' },
                    { name: 'usuarios', desc: 'Control de acceso de cajeros, administradores y almacén' },
                    { name: 'auditoria_logs', desc: 'Registro inmutable de acciones críticas del sistema' },
                  ].map((t) => (
                    <div key={t.name} className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <code className="font-bold text-emerald-700 font-mono text-[11px]">{t.name}</code>
                      <p className="text-[11px] text-gray-500 mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-gray-500 text-center sm:text-left">
            Base de datos relacional PostgreSQL con Supabase JS SDK
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
