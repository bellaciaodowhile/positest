-- ===================================================================
-- SCRIPT SQL: LIMPIAR BASE DE DATOS EN MODO REAL (PRODUCCIÓN)
-- Sistema de Punto de Venta & Gestión Comercial VentaFlow
-- ===================================================================
-- INSTRUCCIONES DE USO:
-- 1. Abre tu proyecto en Supabase (https://supabase.com/dashboard)
-- 2. Ve a la pestaña "SQL Editor" en el menú lateral izquierdo
-- 3. Haz clic en "New Query" (Nueva Consulta)
-- 4. Copia y pega este script completo
-- 5. Haz clic en el botón "Run" (Ejecutar)
--
-- EFECTOS DE ESTE SCRIPT:
-- ✔ Elimina todas las ventas, notas de entrega, ítems y pagos de prueba
-- ✔ Elimina todos los turnos de caja, arqueos y fondos de prueba
-- ✔ Elimina todos los movimientos de kardex y ajustes de inventario
-- ✔ Elimina todos los gastos y egresos registrados
-- ✔ Elimina todas las cuentas por cobrar y cuentas por pagar
-- ✔ Elimina los logs de auditoría anteriores
-- ✔ Vacía el catálogo de productos para que cargues tu inventario real
-- ✔ Vacía la lista de proveedores de prueba
-- ✔ Limpia clientes secundarios, conservando/reinsertando "Consumidor Final (V-00000000)"
-- ✔ Conserva/reinserta el usuario Administrador Maestro ('admin' con contraseña '123456')
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
-- Usuario: admin  | Contraseña: admin123 (o 123456)
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

-- VERIFICACIÓN DE LIMPIEZA
SELECT 'usuarios' AS tabla, COUNT(*) AS registros FROM usuarios
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL
SELECT 'productos', COUNT(*) FROM productos
UNION ALL
SELECT 'ventas_notas', COUNT(*) FROM ventas_notas
UNION ALL
SELECT 'cajas_turnos', COUNT(*) FROM cajas_turnos;
