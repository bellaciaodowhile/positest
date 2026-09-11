import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache del cliente en memoria
let cachedClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'env' | 'localStorage' | 'none';
}

/**
 * Obtiene la configuración activa de Supabase (desde variables de entorno .env o localStorage)
 */
export function getSupabaseConfig(): SupabaseConfig {
  const envObj = (import.meta as unknown as { env?: Record<string, string> }).env || {};
  const procEnv = (typeof process !== 'undefined' && (process as any)?.env) || {};

  const envUrl = (
    envObj.VITE_SUPABASE_URL ||
    envObj.SUPABASE_URL ||
    envObj.NEXT_PUBLIC_SUPABASE_URL ||
    procEnv.VITE_SUPABASE_URL ||
    procEnv.SUPABASE_URL ||
    procEnv.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const envKey = (
    envObj.VITE_SUPABASE_ANON_KEY ||
    envObj.SUPABASE_ANON_KEY ||
    envObj.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    procEnv.VITE_SUPABASE_ANON_KEY ||
    procEnv.SUPABASE_ANON_KEY ||
    procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (envUrl && envKey && isValidHttpUrl(envUrl)) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env',
    };
  }

  // Fallback a localStorage para pruebas interactivas en UI o configuración directa en Vercel
  const localUrl = (typeof window !== 'undefined' ? localStorage.getItem('pos_supabase_url') || '' : '').trim();
  const localKey = (typeof window !== 'undefined' ? localStorage.getItem('pos_supabase_anon_key') || '' : '').trim();

  if (localUrl && localKey && isValidHttpUrl(localUrl)) {
    return {
      url: localUrl,
      anonKey: localKey,
      source: 'localStorage',
    };
  }

  return {
    url: '',
    anonKey: '',
    source: 'none',
  };
}

function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const url = new URL(stringUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Indica si Supabase cuenta con credenciales configuradas
 */
export function isSupabaseConfigured(): boolean {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

/**
 * Retorna la instancia de SupabaseClient o null si no está configurado
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    return null;
  }

  // Reutilizar cliente si no han cambiado las credenciales
  if (cachedClient && lastUsedUrl === config.url && lastUsedKey === config.anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastUsedUrl = config.url;
    lastUsedKey = config.anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Error al inicializar el cliente de Supabase:', err);
    return null;
  }
}

/**
 * Permite guardar y cambiar las credenciales en tiempo de ejecución (localStorage)
 */
export function setRuntimeSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    if (url.trim() && anonKey.trim()) {
      localStorage.setItem('pos_supabase_url', url.trim());
      localStorage.setItem('pos_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('pos_supabase_url');
      localStorage.removeItem('pos_supabase_anon_key');
    }
  }

  // Invalidar caché
  cachedClient = null;
  lastUsedUrl = '';
  lastUsedKey = '';
}

/**
 * Prueba la conexión con el proyecto de Supabase y verifica si las tablas existen
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  source: string;
  tableCount?: number;
  details?: any;
}> {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    return {
      success: false,
      message: 'Faltan las credenciales de Supabase en .env o en la configuración.',
      source: config.source,
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'No fue posible crear la instancia de conexión con Supabase.',
      source: config.source,
    };
  }

  try {
    // Probar consultar la tabla de productos
    const { data: prodData, error: prodError } = await client
      .from('productos')
      .select('id, nombre')
      .limit(5);

    if (prodError) {
      // Código de tabla no encontrada en PostgREST suele ser 42P01 (relation does not exist)
      if (prodError.message && (prodError.message.includes('does not exist') || prodError.code === '42P01')) {
        return {
          success: false,
          message: 'Conexión a Supabase exitosa, pero las tablas aún no están creadas. Ejecuta el script SQL en el SQL Editor de Supabase.',
          source: config.source,
          details: prodError,
        };
      }

      return {
        success: false,
        message: `Error al consultar Supabase: ${prodError.message}`,
        source: config.source,
        details: prodError,
      };
    }

    // Si respondió productos sin error, la conexión y permisos están 100% listos
    return {
      success: true,
      message: '¡Conexión establecida exitosamente con Supabase!',
      source: config.source,
      tableCount: prodData ? prodData.length : 0,
      details: prodData,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Fallo de red o URL inválida al conectar con Supabase: ${err.message || err}`,
      source: config.source,
    };
  }
}
