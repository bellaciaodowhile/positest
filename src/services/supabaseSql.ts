/**
 * SQL completo para ejecutar en el SQL Editor / Table Editor de Supabase
 * Compatible con Vercel y aplicaciones en producción.
 * Soporta IDs alfanuméricos (prod-001, sale-1725..., u-admin) y UUIDs generados por PostgREST.
 * Incluye DDL para 13 tablas, políticas Row Level Security (RLS) e índices.
 */

export const SUPABASE_SCHEMA_SQL = `-- ===================================================================
-- SISTEMA DE GESTIÓN COMERCIAL Y PUNTO DE VENTA MULTIMONEDA (USD / VES)
-- Script Completo de Creación y Migración de Base de Datos para Supabase
-- Compatible con Vercel y despliegues en producción
-- Soporta IDs alfanuméricos y UUIDs generados automáticamente
-- ===================================================================

-- 1. EXTENSIÓN PARA GENERACIÓN DE UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 2. DEFINICIÓN DE TABLAS PRINCIPALES (VARCHAR(100) PARA COMPATIBILIDAD TOTAL)
-- ===================================================================

-- TABLA: USUARIOS (Autenticación y control de acceso)
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(120),
    rol VARCHAR(30) NOT NULL CHECK (rol IN ('admin', 'cajero', 'inventario')),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    documento VARCHAR(50) UNIQUE NOT NULL, -- V-12345678, J-12345678-9, etc.
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    direccion TEXT,
    email VARCHAR(120),
    limite_credito_usd NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    rif VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    contacto VARCHAR(100),
    telefono VARCHAR(50),
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: PRODUCTOS E INVENTARIO
CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    codigo_barras VARCHAR(100) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    clasificacion VARCHAR(30) NOT NULL CHECK (clasificacion IN ('gravable', 'exento')),
    costo_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    margen_ganancia NUMERIC(6,2) NOT NULL DEFAULT 30.00,
    precio_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stock_actual NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    unidad_medida VARCHAR(30) DEFAULT 'unidad',
    descripcion TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: TURNOS Y CAJA (APERTURA Y ARQUEO)
CREATE TABLE IF NOT EXISTS cajas_turnos (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    cajero_id VARCHAR(100),
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(30) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
    fondo_inicial_usd NUMERIC(10,2) DEFAULT 0.00,
    fondo_inicial_ves NUMERIC(14,2) DEFAULT 0.00,
    tasa_bcv NUMERIC(10,4) NOT NULL,
    arqueo_fisico_usd NUMERIC(10,2),
    arqueo_fisico_ves NUMERIC(14,2),
    diferencia_usd NUMERIC(10,2),
    diferencia_ves NUMERIC(14,2),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: NOTAS DE VENTA
CREATE TABLE IF NOT EXISTS ventas_notas (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    numero_nota VARCHAR(50) UNIQUE NOT NULL,
    cliente_id VARCHAR(100),
    cajero_id VARCHAR(100),
    turno_id VARCHAR(100),
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tasa_bcv NUMERIC(10,4) NOT NULL,
    tasa_iva NUMERIC(5,4) DEFAULT 0.1600,
    subtotal_exento_usd NUMERIC(10,2) DEFAULT 0.00,
    subtotal_gravable_usd NUMERIC(10,2) DEFAULT 0.00,
    iva_usd NUMERIC(10,2) DEFAULT 0.00,
    igtf_usd NUMERIC(10,2) DEFAULT 0.00,
    total_usd NUMERIC(10,2) NOT NULL,
    total_ves NUMERIC(14,2) NOT NULL,
    costo_total_usd NUMERIC(10,2) DEFAULT 0.00,
    utilidad_bruta_usd NUMERIC(10,2) DEFAULT 0.00,
    monto_recibido_usd NUMERIC(10,2) DEFAULT 0.00,
    monto_recibido_ves NUMERIC(14,2) DEFAULT 0.00,
    vuelto_usd NUMERIC(10,2) DEFAULT 0.00,
    vuelto_ves NUMERIC(14,2) DEFAULT 0.00,
    estado VARCHAR(30) DEFAULT 'completada' CHECK (estado IN ('completada', 'anulada')),
    motivo_anulacion TEXT,
    anulada_por VARCHAR(100),
    fecha_anulacion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: DETALLE DE ITEMS DE VENTA
CREATE TABLE IF NOT EXISTS ventas_items (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    venta_id VARCHAR(100) REFERENCES ventas_notas(id) ON DELETE CASCADE,
    producto_id VARCHAR(100),
    nombre_producto VARCHAR(150) NOT NULL,
    codigo_barras VARCHAR(100),
    cantidad NUMERIC(10,2) NOT NULL,
    precio_unitario_usd NUMERIC(10,2) NOT NULL,
    precio_unitario_ves NUMERIC(14,2) NOT NULL,
    costo_unitario_usd NUMERIC(10,2) NOT NULL,
    clasificacion VARCHAR(30) NOT NULL,
    subtotal_usd NUMERIC(10,2) NOT NULL,
    subtotal_ves NUMERIC(14,2) NOT NULL,
    iva_usd NUMERIC(10,2) DEFAULT 0.00,
    total_usd NUMERIC(10,2) NOT NULL,
    total_ves NUMERIC(14,2) NOT NULL
);

-- TABLA: DETALLE DE PAGOS MULTIMONEDA (CON IGTF 3%)
CREATE TABLE IF NOT EXISTS ventas_pagos (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    venta_id VARCHAR(100) REFERENCES ventas_notas(id) ON DELETE CASCADE,
    metodo VARCHAR(50) NOT NULL,
    nombre_metodo VARCHAR(50) NOT NULL,
    moneda VARCHAR(10) NOT NULL CHECK (moneda IN ('USD', 'VES')),
    monto_original NUMERIC(14,2) NOT NULL,
    monto_usd NUMERIC(10,2) NOT NULL,
    monto_ves NUMERIC(14,2) NOT NULL,
    tasa_bcv NUMERIC(10,4) NOT NULL,
    aplica_igtf BOOLEAN DEFAULT FALSE,
    monto_igtf_usd NUMERIC(10,2) DEFAULT 0.00,
    monto_igtf_ves NUMERIC(14,2) DEFAULT 0.00,
    referencia VARCHAR(100)
);

-- TABLA: MOVIMIENTOS DE INVENTARIO (KARDEX / AJUSTES)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    producto_id VARCHAR(100),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
    cantidad NUMERIC(10,2) NOT NULL,
    stock_anterior NUMERIC(10,2) NOT NULL,
    stock_nuevo NUMERIC(10,2) NOT NULL,
    motivo TEXT NOT NULL,
    usuario_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: GASTOS Y EGRESOS
CREATE TABLE IF NOT EXISTS gastos (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    concepto VARCHAR(200) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    monto_usd NUMERIC(10,2) NOT NULL,
    monto_ves NUMERIC(14,2) NOT NULL,
    tasa_bcv NUMERIC(10,4) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    usuario_id VARCHAR(100),
    comprobante_ref VARCHAR(100),
    observaciones TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: CUENTAS POR COBRAR (CRÉDITOS Y ABONOS)
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    cliente_id VARCHAR(100),
    venta_id VARCHAR(100),
    monto_total_usd NUMERIC(10,2) NOT NULL,
    monto_total_ves NUMERIC(14,2),
    monto_abonado_usd NUMERIC(10,2) DEFAULT 0.00,
    monto_abonado_ves NUMERIC(14,2) DEFAULT 0.00,
    saldo_pendiente_usd NUMERIC(10,2) NOT NULL,
    saldo_pendiente_ves NUMERIC(14,2),
    moneda_fijada VARCHAR(10) DEFAULT 'USD',
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida')),
    abonos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: CUENTAS POR PAGAR (PROVEEDORES)
CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    proveedor_id VARCHAR(100),
    numero_factura_proveedor VARCHAR(50),
    monto_total_usd NUMERIC(10,2) NOT NULL,
    monto_abonado_usd NUMERIC(10,2) DEFAULT 0.00,
    saldo_pendiente_usd NUMERIC(10,2) NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'vencida')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLA: AUDITORÍA DE SEGURIDAD
CREATE TABLE IF NOT EXISTS auditoria_logs (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    usuario_id VARCHAR(100),
    usuario_nombre VARCHAR(100),
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- 3. ÍNDICES DE RENDIMIENTO
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);
CREATE INDEX IF NOT EXISTS idx_proveedores_rif ON proveedores(rif);
CREATE INDEX IF NOT EXISTS idx_productos_codigo_barras ON productos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_ventas_numero ON ventas_notas(numero_nota);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas_notas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_cajero ON ventas_notas(cajero_id);
CREATE INDEX IF NOT EXISTS idx_ventas_items_venta ON ventas_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_ventas_pagos_venta ON ventas_pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_cajas_cajero ON cajas_turnos(cajero_id);
CREATE INDEX IF NOT EXISTS idx_cxc_cliente ON cuentas_por_cobrar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cxp_proveedor ON cuentas_por_pagar(proveedor_id);

-- ===================================================================
-- 4. POLÍTICAS DE ACCESO (ROW LEVEL SECURITY PARA SUPABASE)
-- ===================================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajas_turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_por_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Acceso total POS" ON %I;', t);
    EXECUTE format('CREATE POLICY "Acceso total POS" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- ===================================================================
-- 5. DATOS SEMILLA BASE (USUARIOS, CLIENTES, PRODUCTOS)
-- ===================================================================

-- USUARIOS DEL SISTEMA
INSERT INTO usuarios (id, username, password_hash, nombre, email, rol, activo, ultimo_acceso) VALUES
('u-demo', 'demo', 'demo123', 'Usuario Demo (Presentación Clientes)', 'demo@ventaflow.com', 'admin', true, NOW()),
('u-admin', 'admin', 'admin123', 'Carlos Mendoza (Gerente)', 'carlos.mendoza@tienda.com', 'admin', true, NOW()),
('u-cajero', 'cajero', 'caja123', 'Mariana Rivas (Caja Principal)', 'mariana.caja@tienda.com', 'cajero', true, NOW()),
('u-inventario', 'inventario', 'stock123', 'Alejandro Gómez (Almacén)', 'alejandro.inv@tienda.com', 'inventario', true, NOW())
ON CONFLICT (username) DO NOTHING;

-- CLIENTES
INSERT INTO clientes (id, documento, nombre, telefono, direccion, email, limite_credito_usd) VALUES
('cli-001', 'V-00000000', 'Consumidor Final (Contado)', '0000-0000000', 'Mostrador General', 'ventas@tienda.com', 0.00),
('cli-002', 'V-18456789', 'Juan Carlos Pérez', '0414-1234567', 'Av. Bolívar, Res. El Rosal, Piso 3', 'juan.perez@gmail.com', 350.00),
('cli-003', 'V-24589123', 'Elena Castillo', '0424-9876543', 'Urb. El Marqués, Calle 4, Qta. Flor', 'elena.castillo@hotmail.com', 150.00),
('cli-004', 'J-40123456-7', 'Distribuidora Bella Vista C.A.', '0212-7654321', 'Zona Industrial La Yaguara, Galpón 4', 'compras@bellavista.com.ve', 1200.00),
('cli-005', 'V-16892451', 'Roberto Silva', '0416-3344556', 'Calle Sucre, Casa N° 12, Chacao', 'roberto.silva@yahoo.com', 200.00)
ON CONFLICT (documento) DO NOTHING;

-- PROVEEDORES
INSERT INTO proveedores (id, rif, nombre, contacto, telefono, direccion) VALUES
('supp-001', 'J-30987654-1', 'Alimentos Polar Comercial C.A.', 'Pedro Morales', '0212-2022111', 'Av. 4 Los Cortijos de Lourdes, Caracas'),
('supp-002', 'J-50123987-9', 'Mayorista Tecnológico del Caribe', 'Sofía Fuentes', '0412-5551234', 'Centro Lido, Torre B, Piso 7, Chacao'),
('supp-003', 'J-29841235-0', 'Distribuidora El Ávila C.A.', 'Marcos Benítez', '0212-4412389', 'Av. San Martín, Edif. Industrial Ávila')
ON CONFLICT (rif) DO NOTHING;

-- PRODUCTOS E INVENTARIO
INSERT INTO productos (id, codigo_barras, nombre, categoria, clasificacion, costo_usd, margen_ganancia, precio_usd, stock_actual, stock_minimo, unidad_medida) VALUES
('prod-001', '759100100101', 'Harina Pan Tradicional 1Kg', 'Alimentos', 'exento', 1.05, 23.81, 1.30, 85, 20, 'paquete'),
('prod-002', '759100100102', 'Arroz Blanco Primor 1Kg', 'Alimentos', 'exento', 1.10, 27.27, 1.40, 60, 15, 'paquete'),
('prod-003', '759100100103', 'Aceite Vegetal Vatel 1L', 'Alimentos', 'exento', 2.80, 25.00, 3.50, 42, 10, 'botella'),
('prod-004', '759100100201', 'Refresco Coca-Cola 1.5L', 'Bebidas', 'gravable', 1.60, 37.50, 2.20, 35, 12, 'botella'),
('prod-005', '759100100202', 'Agua Mineral Minalba 5L', 'Bebidas', 'gravable', 1.80, 38.89, 2.50, 28, 8, 'botellón'),
('prod-006', '759100100301', 'Detergente Las Llaves 1Kg', 'Limpieza', 'gravable', 2.10, 33.33, 2.80, 19, 10, 'bolsa'),
('prod-007', '759100100401', 'Cable USB Tipo C Reforzado 1m', 'Tecnología', 'gravable', 1.50, 100.00, 3.00, 25, 5, 'unidad'),
('prod-008', '759100100402', 'Cargador Rápido 20W USB-C', 'Tecnología', 'gravable', 5.00, 70.00, 8.50, 14, 5, 'unidad'),
('prod-009', '759100100501', 'Café Molido Fama de América 500g', 'Alimentos', 'exento', 2.20, 27.27, 2.80, 30, 10, 'paquete'),
('prod-010', '759100100502', 'Azúcar Refinada Montalbán 1Kg', 'Alimentos', 'exento', 1.15, 30.43, 1.50, 50, 15, 'paquete')
ON CONFLICT (codigo_barras) DO NOTHING;
`;

/**
 * Script SQL para limpiar la base de datos y prepararla para Modo Real (Producción).
 * Elimina todas las ventas, turnos, movimientos de prueba, gastos, CxC, CxP y productos de muestra.
 * Mantiene intacto el usuario Administrador y el cliente Consumidor Final de mostrador.
 */
export const SUPABASE_CLEAN_REAL_MODE_SQL = `-- ===================================================================
-- SCRIPT SQL: LIMPIAR BASE DE DATOS EN MODO REAL (PRODUCCIÓN)
-- Sistema de Punto de Venta & Gestión Comercial VentaFlow
-- ===================================================================
-- INSTRUCCIONES:
-- Copia este código y ejecútalo en el 'SQL Editor' de tu consola de Supabase.
-- ===================================================================

BEGIN;

-- 1. VACIAR TABLAS TRANSACCIONALES Y OPERATIVAS EN CASCADA
TRUNCATE TABLE
    ventas_pagos,
    ventas_items,
    ventas_notas,
    movimientos_inventario,
    cajas_turnos,
    cuentas_por_cobrar,
    cuentas_por_pagar,
    gastos,
    auditoria_logs,
    productos,
    proveedores,
    clientes,
    usuarios
CASCADE;

-- 2. RESTAURAR USUARIO ADMINISTRADOR PRINCIPAL (UUID Estándar)
-- Usuario: admin  | Contraseña por defecto: 123456
INSERT INTO usuarios (
    id,
    username,
    password_hash,
    nombre,
    email,
    rol,
    activo,
    ultimo_acceso
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '123456',
    'Administrador Principal',
    'admin@ventaflow.com',
    'admin',
    true,
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET
    id = EXCLUDED.id,
    password_hash = EXCLUDED.password_hash,
    nombre = EXCLUDED.nombre,
    rol = 'admin',
    activo = true;

-- 3. RESTAURAR CLIENTE BASE MOSTRADOR (Consumidor Final Contado)
-- Requerido para ventas rápidas en mostrador
INSERT INTO clientes (
    id,
    documento,
    nombre,
    telefono,
    direccion,
    email,
    limite_credito_usd
) VALUES (
    '11111111-1111-1111-1111-111111111100',
    'V-00000000',
    'Consumidor Final (Contado)',
    '0000-0000000',
    'Venta Mostrador General',
    'ventas@tienda.com',
    0.00
)
ON CONFLICT (documento) DO UPDATE
SET
    id = EXCLUDED.id,
    nombre = EXCLUDED.nombre;

-- 4. REGISTRO INICIAL DE AUDITORÍA
INSERT INTO auditoria_logs (
    id,
    usuario_id,
    usuario_nombre,
    modulo,
    accion,
    detalles,
    fecha
) VALUES (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000001',
    'Administrador Principal',
    'Sistema',
    'LIMPIEZA_MODO_REAL',
    'Base de datos limpiada con éxito para Modo Real. Catálogos listos para ingreso de datos reales.',
    NOW()
);

COMMIT;
`;
