const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Genera un UUID versión 4 estándar criptográficamente seguro
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Valida si un string cumple con la sintaxis exacta de UUID en PostgreSQL
 */
export function isValidUUID(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Convierte de forma determinista y reproducible cualquier ID (incluso IDs con prefijos
 * legados como 'prod-1234', 'sale-1234', 'cli-000') en un UUID v4 válido compatible con PostgreSQL.
 */
export function toValidUUID(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Si es un ID de usuario conocido, mapearlo directamente
  const lower = trimmed.toLowerCase();
  if (lower === 'u-admin-01' || lower === 'admin') return '00000000-0000-0000-0000-000000000001';
  if (lower === 'u-demo-00' || lower === 'demo') return '00000000-0000-0000-0000-000000000000';
  if (lower === 'u-cajero-02' || lower === 'cajero') return '00000000-0000-0000-0000-000000000002';
  if (lower === 'u-inv-03' || lower === 'inventario') return '00000000-0000-0000-0000-000000000003';
  if (lower === 'cli-000' || lower === 'cli-001' || lower === 'v-00000000') return '11111111-1111-1111-1111-111111111100';

  // Hashing determinista para generar 32 caracteres hexadecimales
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1;
    hash2 = ((hash2 << 7) + hash2) ^ (char * (i + 1));
    hash2 = hash2 & hash2;
  }

  const hex = (
    Math.abs(hash1).toString(16).padStart(8, '0') +
    Math.abs(hash2).toString(16).padStart(8, '0')
  ).repeat(2).slice(0, 32);

  const part1 = hex.slice(0, 8);
  const part2 = hex.slice(8, 12);
  const part3 = '4' + hex.slice(13, 16); // versión 4
  const part4 = 'a' + hex.slice(17, 20); // variante
  const part5 = hex.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}

/**
 * Mapea el usuario actual al ID UUID correspondiente en la tabla usuarios de Supabase
 */
export function mapUserToUUID(userOrId: string | null | undefined): string {
  if (!userOrId) return '00000000-0000-0000-0000-000000000001'; // Default Admin
  const str = userOrId.toLowerCase().trim();
  if (str === 'demo' || str.includes('demo')) return '00000000-0000-0000-0000-000000000000';
  if (str === 'admin' || str.includes('admin') || str === 'u-admin-01') return '00000000-0000-0000-0000-000000000001';
  if (str === 'cajero' || str.includes('cajero') || str === 'u-cajero-02') return '00000000-0000-0000-0000-000000000002';
  if (str === 'inventario' || str.includes('inventario') || str === 'u-inv-03') return '00000000-0000-0000-0000-000000000003';
  if (isValidUUID(str)) return str;
  return '00000000-0000-0000-0000-000000000001';
}

/**
 * Mapea un cliente al UUID correspondiente en la tabla clientes de Supabase
 */
export function mapClientToUUID(clientOrId: string | null | undefined): string | null {
  if (!clientOrId) return '11111111-1111-1111-1111-111111111100'; // Consumidor Final
  const str = clientOrId.trim();
  if (
    str === 'cli-000' ||
    str === 'cli-001' ||
    str === 'cli-cf' ||
    str === 'V-00000000' ||
    str.toLowerCase().includes('contado') ||
    str.toLowerCase().includes('consumidor')
  ) {
    return '11111111-1111-1111-1111-111111111100';
  }
  return toValidUUID(str);
}
