import React, { useState, useRef, useEffect } from 'react';
import {
  Package,
  Barcode,
  Plus,
  Search,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  Trash,
  Lock,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  TrendingUp,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';
import { Product, TaxClassification, User, InventoryMovement } from '../types';
import { formatUSD, formatVES, usdToVes } from '../services/bcvService';
import { exportInventoryToExcel } from '../services/exportService';
import { generateUUID } from '../services/uuidUtils';
import { CostStructureModal } from './CostStructureModal';

interface ToastMessage {
  id: string;
  title: string;
  productName: string;
  barcode: string;
  priceUSD: number;
  priceVES: number;
  timestamp: number;
}

interface InventoryModuleProps {
  products: Product[];
  bcvRate: number;
  currentUser: User;
  onAddProduct: (prod: Product) => void;
  onUpdateProduct: (prod: Product) => void;
  onDeleteProduct: (prod: Product) => void;
  onStockMovement: (movement: InventoryMovement) => void;
  onImportSampleCatalog?: () => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  bcvRate,
  currentUser,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onStockMovement,
  onImportSampleCatalog,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterClassification, setFilterClassification] = useState<string>('todos');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);

  // Modal Crear / Editar Producto
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sessionAddedCount, setSessionAddedCount] = useState(0);

  // Toast de notificación al registrar / actualizar
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-cierre de Toast a los 4.5 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal Info Estructura de Costos
  const [showCostStructureModal, setShowCostStructureModal] = useState(false);

  // Campos de formulario
  const [codigoBarras, setCodigoBarras] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Alimentos');
  const [clasificacion, setClasificacion] = useState<TaxClassification>('gravable');
  const [costoUSD, setCostoUSD] = useState<string>('');
  const [margenGanancia, setMargenGanancia] = useState<string>('');
  const [unidades, setUnidades] = useState<string>('');
  const [precioUSD, setPrecioUSD] = useState<string>('');
  const [stockActual, setStockActual] = useState<number>(10);
  const [stockMinimo, setStockMinimo] = useState<number>(5);
  const [unidadMedida, setUnidadMedida] = useState('unidad');
  const [descripcion, setDescripcion] = useState('');

  // Modal Ajuste de Stock
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [movementQty, setMovementQty] = useState<number>(1);
  const [movementReason, setMovementReason] = useState('');

  // Verificar si el rol puede editar precios
  const canEditPrices = currentUser.rol === 'admin';
  const canAdjustStock = currentUser.rol === 'admin' || currentUser.rol === 'inventario';

  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.categoria)))];

  // Recalcular precio automáticamente al cambiar costo, margen o unidades
  const handleCostOrMarginChange = (costStr: string, marginStr: string, unitsStr: string = unidades) => {
    setCostoUSD(costStr);
    setMargenGanancia(marginStr);
    setUnidades(unitsStr);
    
    // Fórmula: Costo ÷ (1 - Margen/100) ÷ Unidades
    const cost = parseFloat(costStr);
    const margin = parseFloat(marginStr);
    const units = parseFloat(unitsStr);
    
    if (isNaN(cost) || isNaN(margin) || isNaN(units) || margin >= 100 || units <= 0) {
      setPrecioUSD('');
      return;
    }
    
    const precioTotal = cost / (1 - margin / 100);
    const precioPorUnidad = precioTotal / units;
    setPrecioUSD(Number(precioPorUnidad.toFixed(2)).toString());
  };

  // Recalcular margen si el usuario edita directamente el precio en dólares
  const handlePriceChange = (priceStr: string) => {
    setPrecioUSD(priceStr);
    const cost = parseFloat(costoUSD);
    const units = parseFloat(unidades);
    const price = parseFloat(priceStr);
    
    if (!isNaN(cost) && !isNaN(price) && !isNaN(units) && cost > 0 && units > 0) {
      // Inversa: Margen = (1 - Costo / (Precio * Unidades)) * 100
      const precioTotal = price * units;
      const calculatedMargin = Number(((1 - cost / precioTotal) * 100).toFixed(2));
      setMargenGanancia(calculatedMargin.toString());
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setCodigoBarras(`759${Math.floor(100000000 + Math.random() * 900000000)}`);
    setNombre('');
    setCategoria('Alimentos');
    setClasificacion('gravable');
    setCostoUSD('');
    setMargenGanancia('');
    setUnidades('');
    setPrecioUSD('');
    setStockActual(20);
    setStockMinimo(5);
    setUnidadMedida('unidad');
    setDescripcion('');
    setSessionAddedCount(0);
    setShowProductModal(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 100);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setCodigoBarras(p.codigoBarras);
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setClasificacion(p.clasificacion);
    setCostoUSD(p.costoUSD > 0 ? p.costoUSD.toString() : '');
    setMargenGanancia(p.margenGanancia > 0 ? p.margenGanancia.toString() : '');
    setUnidades(p.unidades > 0 ? p.unidades.toString() : '');
    setPrecioUSD(p.precioUSD > 0 ? p.precioUSD.toString() : '');
    setStockActual(p.stockActual);
    setStockMinimo(p.stockMinimo);
    setUnidadMedida(p.unidadMedida);
    setDescripcion(p.descripcion || '');
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !codigoBarras.trim()) return;

    // Convertir valores string a number
    const costoUSDNum = parseFloat(costoUSD) || 0;
    const margenGananciaNum = parseFloat(margenGanancia) || 0;
    const unidadesNum = parseFloat(unidades) || 1;
    const precioUSDNum = parseFloat(precioUSD) || 0;

    if (editingProduct) {
      const updated: Product = {
        ...editingProduct,
        codigoBarras: codigoBarras.trim(),
        nombre: nombre.trim(),
        categoria: categoria.trim() || 'General',
        clasificacion,
        costoUSD: canEditPrices ? costoUSDNum : editingProduct.costoUSD,
        margenGanancia: canEditPrices ? margenGananciaNum : editingProduct.margenGanancia,
        unidades: canEditPrices ? unidadesNum : editingProduct.unidades,
        precioUSD: canEditPrices ? precioUSDNum : editingProduct.precioUSD,
        stockMinimo,
        unidadMedida,
        descripcion,
        fechaActualizacion: new Date().toISOString().slice(0, 10),
      };
      onUpdateProduct(updated);
      setToast({
        id: generateUUID(),
        title: '¡Producto Actualizado con Éxito!',
        productName: updated.nombre,
        barcode: updated.codigoBarras,
        priceUSD: updated.precioUSD,
        priceVES: updated.precioUSD > 0 ? usdToVes(updated.precioUSD, bcvRate) : 0,
        timestamp: Date.now(),
      });
      setShowProductModal(false);
    } else {
      const newProd: Product = {
        id: generateUUID(),
        codigoBarras: codigoBarras.trim(),
        nombre: nombre.trim(),
        categoria: categoria.trim() || 'General',
        clasificacion,
        costoUSD: costoUSDNum,
        margenGanancia: margenGananciaNum,
        unidades: unidadesNum,
        precioUSD: precioUSDNum,
        stockActual,
        stockMinimo,
        unidadMedida,
        descripcion,
        fechaActualizacion: new Date().toISOString().slice(0, 10),
      };
      onAddProduct(newProd);

      const nextCount = sessionAddedCount + 1;
      setSessionAddedCount(nextCount);

      // Lanzar Toast de confirmación inmediato
      setToast({
        id: generateUUID(),
        title: `¡Producto #${nextCount} Registrado con Éxito!`,
        productName: newProd.nombre,
        barcode: newProd.codigoBarras,
        priceUSD: newProd.precioUSD,
        priceVES: newProd.precioUSD > 0 ? usdToVes(newProd.precioUSD, bcvRate) : 0,
        timestamp: Date.now(),
      });

      // ¡NO CERRAR EL MODAL! Mantener showProductModal abierto para continuar registrando
      // Preparar campos para el siguiente producto:
      setCodigoBarras(`759${Math.floor(100000000 + Math.random() * 900000000)}`);
      setNombre('');
      setDescripcion('');
      // Mantenemos categoría, clasificación y costo base para agilizar la carga rápida en lote
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  };

  // Procesar Ajuste de Stock
  const handleOpenStockMovement = (p: Product) => {
    setSelectedProductForStock(p);
    setMovementType('entrada');
    setMovementQty(1);
    setMovementReason('');
    setShowStockModal(true);
  };

  // Borrar Producto
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const handleDeleteProduct = (p: Product) => {
    setProductToDelete(p);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteProduct = () => {
    if (productToDelete) {
      onDeleteProduct(productToDelete);
      setShowDeleteConfirm(false);
      setProductToDelete(null);
    }
  };

  const handleExecuteStockMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForStock || movementQty <= 0) return;

    let newStock = selectedProductForStock.stockActual;
    if (movementType === 'entrada') {
      newStock += movementQty;
    } else if (movementType === 'salida') {
      if (movementQty > selectedProductForStock.stockActual) {
        alert('La cantidad a descontar no puede superar el stock actual.');
        return;
      }
      newStock -= movementQty;
    } else if (movementType === 'ajuste') {
      newStock = movementQty; // Conteo físico directo
    }

    const movement: InventoryMovement = {
      id: generateUUID(),
      productoId: selectedProductForStock.id,
      productoNombre: selectedProductForStock.nombre,
      tipo: movementType,
      cantidad: movementQty,
      stockAnterior: selectedProductForStock.stockActual,
      stockNuevo: newStock,
      motivo: movementReason || 'Ajuste operativo de inventario',
      usuarioId: currentUser.id,
      usuarioNombre: currentUser.nombre,
      fecha: new Date().toISOString(),
    };

    onStockMovement(movement);
    setShowStockModal(false);
  };

  // Filtrar
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigoBarras.includes(searchTerm) ||
      p.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'Todas' || p.categoria === filterCategory;
    const matchesClassification =
      filterClassification === 'todos' || p.clasificacion === filterClassification;
    const matchesLowStock = !showLowStockOnly || p.stockActual <= p.stockMinimo;

    return matchesSearch && matchesCategory && matchesClassification && matchesLowStock;
  });

  // Métricas de inventario
  const totalArticulos = products.length;
  const valorTotalInventarioUSD = products.reduce(
    (acc, p) => acc + p.stockActual * p.costoUSD,
    0
  );
  const valorTotalVentaUSD = products.reduce(
    (acc, p) => acc + p.stockActual * p.precioUSD,
    0
  );
  const totalGananciaUSD = valorTotalVentaUSD - valorTotalInventarioUSD;
  const margenGeneralPorcentaje = valorTotalInventarioUSD > 0 
    ? Number(((totalGananciaUSD / valorTotalInventarioUSD) * 100).toFixed(2))
    : 0;
  const itemsLowStock = products.filter((p) => p.stockActual <= p.stockMinimo).length;

  return (
    <div id="inventory-module-root" className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Total Artículos
          </span>
          <div className="text-xl font-bold text-gray-900 mt-0.5">{totalArticulos}</div>
          <span className="text-[11px] text-gray-400">En catálogo activo</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Valoración (Costo)
          </span>
          <div className="text-xl font-bold text-blue-600 mt-0.5">
            {formatUSD(valorTotalInventarioUSD)}
          </div>
          <span className="text-[11px] text-gray-400">
            {formatVES(valorTotalInventarioUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Proyección de Venta
          </span>
          <div className="text-xl font-bold text-emerald-600 mt-0.5">
            {formatUSD(valorTotalVentaUSD)}
          </div>
          <span className="text-[11px] text-gray-400">
            {formatVES(valorTotalVentaUSD * bcvRate)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-gray-500 uppercase">
            Margen General
          </span>
          <div
            className={`text-xl font-bold mt-0.5 ${
              margenGeneralPorcentaje >= 30 
                ? 'text-emerald-600' 
                : margenGeneralPorcentaje >= 20 
                  ? 'text-amber-600' 
                  : 'text-rose-600'
            }`}
          >
            {margenGeneralPorcentaje}%
          </div>
          <span className="text-[11px] text-gray-400">
            Ganancia sobre costo
          </span>
        </div>
      </div>

      {/* Controles de Acción y Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-2">
          {/* Búsqueda */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código de barras, nombre o categoría..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* Filtro Categoría */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'Todas' ? 'Todas las Categorías' : c}
              </option>
            ))}
          </select>

          {/* Filtro Fiscal */}
          <select
            value={filterClassification}
            onChange={(e) => setFilterClassification(e.target.value)}
            className="text-xs px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white"
          >
            <option value="todos">Todos (Exento y Gravable)</option>
            <option value="exento">Solo Exentos de IVA</option>
            <option value="gravable">Solo Gravables (16% IVA)</option>
          </select>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showLowStockOnly
                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Stock Crítico</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCostStructureModal(true)}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Guía interactiva: ¿Cómo funciona la Estructura de Costos, Margen y Precios en Dólares?"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Estructura de Costos</span>
          </button>

          <button
            type="button"
            onClick={() => exportInventoryToExcel(products, bcvRate)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Exportar inventario completo a Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCostModal(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Cómo calcular precio</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Artículo</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo si el inventario está vacío */}
      {products.length === 0 && (
        <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>Inventario Real Limpio (Sin Datos Ficticios)</span>
            </h4>
            <p className="text-xs text-indigo-900/80 mt-0.5">
              Puedes comenzar registrando tus propios artículos desde el botón "Nuevo Artículo", o precargar un catálogo base de prueba para víveres si lo requieres.
            </p>
          </div>
          {onImportSampleCatalog && (
            <button
              type="button"
              onClick={onImportSampleCatalog}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold shrink-0 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cargar Catálogo Base</span>
            </button>
          )}
        </div>
      )}

      {/* Tabla de Productos y Precios en USD / BCV */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-slate-50 text-gray-700 uppercase font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="px-4 py-3">Código Barras</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3">Régimen</th>
                <th className="px-3 py-3 text-right">Costo (REF)</th>
                <th className="px-3 py-3 text-center">Margen %</th>
                <th className="px-3 py-3 text-right">Precio (REF)</th>
                <th className="px-3 py-3 text-right">Precio Bolívares (BCV)</th>
                <th className="px-3 py-3 text-center">Stock Actual</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((p) => {
                const isLowStock = p.stockActual <= p.stockMinimo;
                const priceVES = usdToVes(p.precioUSD, bcvRate);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-gray-400" />
                        <span>{p.codigoBarras}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {p.nombre}
                      {p.descripcion && (
                        <div className="text-[10px] text-gray-400 font-normal truncate max-w-[200px]">
                          {p.descripcion}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-gray-600">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-[10px] font-medium">
                        {p.categoria}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          p.clasificacion === 'exento'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {p.clasificacion}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right font-medium text-gray-600">
                      {formatUSD(p.costoUSD)}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                        {p.margenGanancia}%
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-gray-900">
                      {formatUSD(p.precioUSD)} <span className="text-[10px] text-slate-500 font-normal">x {p.unidades} u.</span>
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-blue-700">
                      {formatVES(priceVES)}
                      {p.unidades > 1 && (
                        <div className="text-[10px] text-blue-500 font-normal">
                          Total: {formatVES(usdToVes(p.precioUSD * p.unidades, bcvRate))}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md font-bold text-xs ${
                          isLowStock
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {p.stockActual} {p.unidadMedida}
                      </span>
                      {isLowStock && (
                        <div className="text-[9px] text-rose-600 font-medium">
                          Mín: {p.stockMinimo}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {canAdjustStock && (
                          <button
                            type="button"
                            onClick={() => handleOpenStockMovement(p)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Entrada, Salida o Ajuste de Stock"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar producto o precios"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    <Package className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-sm">
                      {products.length === 0
                        ? 'El catálogo de inventario está vacío'
                        : 'No se encontraron artículos'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {products.length === 0
                        ? 'Agrega nuevos productos usando el botón "Nuevo Artículo" o utiliza el botón "Cargar Catálogo Base" para comenzar.'
                        : 'Prueba cambiando los términos de búsqueda o los filtros aplicados.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Producto */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {editingProduct ? 'Editar Producto & Precios' : 'Registrar Nuevo Artículo'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configura el costo en dólares, porcentaje de ganancia y conversión automática a Bolívares con tasa BCV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingProduct && (
              <div className="mb-4 bg-blue-50/80 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-950 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    <strong>Modo Registro Continuo:</strong> La ventana no se cerrará al guardar para que sigas registrando tus productos rápidamente.
                  </span>
                </div>
                {sessionAddedCount > 0 && (
                  <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-[11px] rounded-full shrink-0 shadow-xs">
                    ✓ {sessionAddedCount} agregado{sessionAddedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-gray-700">
                      Código de Barras / SKU
                    </label>
                    <button
                      type="button"
                      onClick={() => setCodigoBarras(`759${Math.floor(100000000 + Math.random() * 900000000)}`)}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                      title="Generar código automático aleatorio"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Generar</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={codigoBarras}
                      onChange={(e) => setCodigoBarras(e.target.value)}
                      placeholder="Escanea o escribe el código"
                      className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Alimentos, Bebidas, etc."
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre del Artículo
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. Harina Pan 1Kg"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              {/* Clasificación Fiscal */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Clasificación Tributaria Interna
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer text-xs ${
                      clasificacion === 'gravable'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="clasificacion"
                      checked={clasificacion === 'gravable'}
                      onChange={() => setClasificacion('gravable')}
                      className="text-blue-600"
                    />
                    <span>Gravable (16% IVA)</span>
                  </label>
                  <label
                    className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer text-xs ${
                      clasificacion === 'exento'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="clasificacion"
                      checked={clasificacion === 'exento'}
                      onChange={() => setClasificacion('exento')}
                      className="text-emerald-600"
                    />
                    <span>Exento de IVA</span>
                  </label>
                </div>
              </div>

              {/* Costos, Margen y Precio en Dólares */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-gray-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span>Estructura de Costos & Precios en Dólares</span>
                    <button
                      type="button"
                      onClick={() => setShowCostStructureModal(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
                      title="Haz clic para ver la explicación completa y simulador de cómo funciona la estructura de costos"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                      <span>¿Cómo funciona?</span>
                    </button>
                  </div>
                  {!canEditPrices && (
                    <span className="text-[10px] text-amber-700 flex items-center gap-1 font-normal">
                      <Lock className="w-3 h-3" /> Solo Administrador puede alterar precios
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Costo Adquisición (REF)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEditPrices}
                      value={costoUSD === '' ? '' : Number(costoUSD)}
                      onChange={(e) =>
                        handleCostOrMarginChange(
                           e.target.value,
                          margenGanancia,
                          unidades
                        )
                      }
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 placeholder-gray-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      % Margen Ganancia
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      disabled={!canEditPrices}
                      value={margenGanancia === '' ? '' : Number(margenGanancia)}
                      onChange={(e) =>
                        handleCostOrMarginChange(
                          costoUSD,
                          e.target.value,
                          unidades
                        )
                      }
                      placeholder="0"
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 placeholder-gray-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Unidades por Paquete
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      disabled={!canEditPrices}
                      value={unidades === '' ? '' : Number(unidades)}
                      onChange={(e) =>
                        handleCostOrMarginChange(
                          costoUSD,
                          margenGanancia,
                          e.target.value
                        )
                      }
                      placeholder="1"
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg bg-white disabled:bg-gray-100 placeholder-gray-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Precio por Unidad (REF)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!canEditPrices}
                      value={precioUSD === '' ? '' : Number(precioUSD)}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-300 rounded-lg bg-white disabled:bg-gray-100 placeholder-gray-300"
                      required
                    />
                  </div>
                </div>
                
                {/* Fórmula de cálculo */}
                <div className="p-2 bg-indigo-50/60 rounded-lg border border-indigo-100 text-[10px] text-indigo-800">
                  Fórmula: Costo ÷ (1 - %/100) ÷ UDS
                </div>

                {/* Cálculo en Bolívares en vivo */}
                <div className="p-2.5 bg-blue-50/80 rounded-lg border border-blue-200 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-blue-900 font-semibold text-xs">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span>Precio por Unidad en Bolívares (@ Tasa BCV {formatVES(bcvRate)}):</span>
                  </div>
                  {precioUSD && parseFloat(precioUSD) > 0 ? (
                    <>
                      <strong className="text-blue-900 text-base font-bold">
                        {formatVES(usdToVes(parseFloat(precioUSD), bcvRate))}
                      </strong>
                      {unidades && parseFloat(unidades) > 1 && (
                        <div className="text-[10px] text-blue-700 mt-1">
                          Total Paquete: {formatVES(usdToVes(parseFloat(precioUSD) * parseFloat(unidades), bcvRate))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-blue-700 text-sm">Ingresa un precio para calcular</span>
                  )}
                </div>
              </div>

              {/* Control de Stock */}
              <div className="grid grid-cols-3 gap-3">
                {!editingProduct && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Stock Inicial
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={stockActual}
                      onChange={(e) => setStockActual(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={stockMinimo}
                    onChange={(e) => setStockMinimo(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Unidad de Medida
                  </label>
                  <input
                    type="text"
                    value={unidadMedida}
                    onChange={(e) => setUnidadMedida(e.target.value)}
                    placeholder="unidad, kg, litro"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {!editingProduct && sessionAddedCount > 0 ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {sessionAddedCount} producto{sessionAddedCount > 1 ? 's' : ''} registrado{sessionAddedCount > 1 ? 's' : ''} en esta sesión
                    </span>
                  ) : (
                    <span>Presiona Guardar para registrar de inmediato</span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {editingProduct ? 'Cancelar' : (sessionAddedCount > 0 ? 'Terminar y Salir' : 'Cerrar')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {!editingProduct && <Plus className="w-4 h-4" />}
                    <span>{editingProduct ? 'Guardar Cambios' : 'Registrar y Continuar (+)'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste de Stock (Entradas, Salidas, Auditoría) */}
      {showStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Movimiento de Stock en Tiempo Real
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Artículo:{' '}
              <strong className="text-gray-800">{selectedProductForStock.nombre}</strong> (Stock
              actual: {selectedProductForStock.stockActual} {selectedProductForStock.unidadMedida})
            </p>

            <form onSubmit={handleExecuteStockMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMovementType('entrada')}
                    className={`py-2 px-3 rounded-lg font-semibold border ${
                      movementType === 'entrada'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    + Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('salida')}
                    className={`py-2 px-3 rounded-lg font-semibold border ${
                      movementType === 'salida'
                        ? 'bg-rose-50 text-rose-800 border-rose-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    - Salida
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('ajuste')}
                    className={`py-2 px-3 rounded-lg font-semibold border ${
                      movementType === 'ajuste'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    = Conteo Físico
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {movementType === 'ajuste'
                    ? 'Cantidad Real Contada'
                    : 'Cantidad de Unidades'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={movementQty}
                  onChange={(e) => setMovementQty(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Motivo o Justificación del Movimiento
                </label>
                <input
                  type="text"
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="ej. Reposición de proveedor Polar, Merma, Conteo físico mensual"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Confirmar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Informativo y Simulador de Estructura de Costos & Precios en Dólares */}
      <CostStructureModal
        isOpen={showCostStructureModal}
        onClose={() => setShowCostStructureModal(false)}
        bcvRate={bcvRate}
      />

      {/* Toast de Registro Exitoso de Producto */}
      {toast && (
        <div
          id="product-registered-toast"
          className="fixed top-5 right-5 z-[100] max-w-sm w-full bg-white rounded-2xl p-4 shadow-2xl border-2 border-emerald-500 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  {toast.title}
                </span>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 rounded-lg transition-colors cursor-pointer"
                  title="Cerrar notificación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm font-bold text-gray-900 mt-1 truncate">
                {toast.productName}
              </p>

              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 flex-wrap">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-700">
                  {toast.barcode}
                </span>
                <span className="font-bold text-emerald-700">
                  {formatUSD(toast.priceUSD)}
                </span>
                <span className="text-gray-400">•</span>
                <span className="font-semibold text-blue-700">
                  {formatVES(toast.priceVES)}
                </span>
              </div>

              <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Listo para el siguiente artículo.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ayuda: Cálculo de Costos y Precios */}
      {showCostModal && (
        <CostStructureModal
          isOpen={showCostModal}
          onClose={() => setShowCostModal(false)}
          bcvRate={bcvRate}
        />
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && productToDelete && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              Confirmar Eliminación
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de eliminar el producto <strong className="text-gray-900">{productToDelete.nombre}</strong>?
              <br/>
              <span className="text-xs text-gray-500 mt-1 block">
                Código: {productToDelete.codigoBarras}
              </span>
            </p>
            <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded mb-4">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
