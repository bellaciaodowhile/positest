import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Smartphone,
  Coins,
  CheckCircle,
  FileText,
  Printer,
  Download,
  AlertCircle,
  UserPlus,
  RefreshCw,
  Percent,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  User as UserIcon,
  X,
  ShoppingCart,
  Wallet,
  ArrowRight,
  Users,
} from 'lucide-react';
import {
  Product,
  Client,
  SaleNote,
  SaleItem,
  PaymentItem,
  PaymentMethodType,
  User,
  CashShift,
} from '../types';
import {
  formatUSD,
  formatVES,
  calculateIGTF,
  calculateExactChange,
  usdToVes,
  vesToUsd,
} from '../services/bcvService';
import { generateSaleNotePDF } from '../services/exportService';
import { generateUUID } from '../services/uuidUtils';
import {
  ActionHelpModal,
  InfoHelpButton,
  HelpTopicKey,
} from './ActionHelpModal';

interface POSModuleProps {
  products: Product[];
  clients: Client[];
  currentUser: User;
  activeShift: CashShift | null;
  bcvRate: number;
  onCompleteSale: (newSale: SaleNote) => void;
  onAddNewClient: (client: Client) => void;
  onGoToCashControl: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export const POSModule: React.FC<POSModuleProps> = ({
  products,
  clients,
  currentUser,
  activeShift,
  bcvRate,
  onCompleteSale,
  onAddNewClient,
  onGoToCashControl,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
}) => {
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('cli-000'); // Consumidor final por defecto

  // Modal de Cobro Multimoneda
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBreakdown, setPaymentBreakdown] = useState<
    { method: PaymentMethodType; amount: number; reference?: string }[]
  >([]);

  // Modal de Pagar Luego (Fiado / Crédito con Deuda Fijada en Bolívares)
  const [showPayLaterModal, setShowPayLaterModal] = useState(false);
  const [payLaterClientMode, setPayLaterClientMode] = useState<'existing' | 'new'>('existing');
  const [payLaterSelectedClientId, setPayLaterSelectedClientId] = useState<string>(selectedClientId);
  const [payLaterNewName, setPayLaterNewName] = useState('');
  const [payLaterNewDoc, setPayLaterNewDoc] = useState('V-');
  const [payLaterNewPhone, setPayLaterNewPhone] = useState('');
  const [payLaterNewAddress, setPayLaterNewAddress] = useState('');
  const [payLaterAbonoVES, setPayLaterAbonoVES] = useState<number>(0);
  const [payLaterAbonoMethod, setPayLaterAbonoMethod] = useState<PaymentMethodType>('pago_movil');
  const [payLaterAbonoRef, setPayLaterAbonoRef] = useState('');

  // Preferencia de vuelto
  const [vueltoPreference, setVueltoPreference] = useState<'VES' | 'USD' | 'MIXTO'>('VES');

  // Modal de creación rápida de cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientDoc, setNewClientDoc] = useState('V-');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  // Última venta completada para imprimir ticket
  const [completedSale, setCompletedSale] = useState<SaleNote | null>(null);

  // Modal Flotante de Explicación de Acciones Clave
  const [helpTopic, setHelpTopic] = useState<HelpTopicKey | null>(null);

  // Estados para el Modal 100% Pantalla de Registrar Pago
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalCategory, setModalCategory] = useState('Todas');
  const [modalBarcodeInput, setModalBarcodeInput] = useState('');
  const [mobileModalTab, setMobileModalTab] = useState<'catalog' | 'checkout'>('checkout');
  const modalBarcodeInputRef = useRef<HTMLInputElement>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.categoria)))];

  const selectedClient =
    clients.find((c) => c.id === selectedClientId) ||
    clients[0] || {
      id: 'cli-000',
      nombre: 'Consumidor Final',
      documento: 'V-00000000',
      telefono: 'N/A',
      direccion: 'Caracas',
      limiteCreditoUSD: 0,
      saldoPendienteUSD: 0,
    };

  // Auto-focus en el escáner
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Manejo de lector de código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = products.find(
      (p) =>
        p.codigoBarras.toLowerCase() === barcodeInput.trim().toLowerCase() ||
        p.nombre.toLowerCase().includes(barcodeInput.trim().toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      alert(`No se encontró ningún producto con el código: ${barcodeInput}`);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stockActual <= 0) {
      alert(`El producto "${product.nombre}" no tiene stock disponible.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockActual) {
          alert(`Stock máximo disponible alcanzado (${product.stockActual} ${product.unidadMedida}s)`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const prod = products.find((p) => p.id === productId);
    if (prod && newQty > prod.stockActual) {
      alert(`Solo hay ${prod.stockActual} unidades disponibles`);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: newQty } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Cálculos de Totales
  const subtotalExentoUSD = cart
    .filter((item) => item.product.clasificacion === 'exento')
    .reduce((sum, item) => sum + item.product.precioUSD * item.quantity, 0);

  const subtotalGravableUSD = cart
    .filter((item) => item.product.clasificacion === 'gravable')
    .reduce((sum, item) => sum + item.product.precioUSD * item.quantity, 0);

  const ivaUSD = Number((subtotalGravableUSD * 0.16).toFixed(2));
  const baseTotalUSD = Number((subtotalExentoUSD + subtotalGravableUSD + ivaUSD).toFixed(2));

  // IGTF 3% sobre pagos en divisas
  const totalDivisasPaidUSD = paymentBreakdown
    .filter((p) => p.method === 'efectivo_usd' || p.method === 'zelle')
    .reduce((sum, p) => sum + p.amount, 0);

  const igtfUSD = calculateIGTF(totalDivisasPaidUSD);
  const granTotalUSD = Number((baseTotalUSD + igtfUSD).toFixed(2));
  const granTotalVES = usdToVes(granTotalUSD, bcvRate);

  // Filtrado de productos en catálogo principal
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigoBarras.includes(searchTerm) ||
      p.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || p.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filtrado de productos en el Modal 100% de Registro de Pago (mitad izquierda con scroll fijo)
  const modalFilteredProducts = products.filter((p) => {
    const term = modalSearchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.nombre.toLowerCase().includes(term) ||
      p.codigoBarras.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term);
    const matchesCategory =
      modalCategory === 'Todas' || p.categoria === modalCategory;
    return matchesSearch && matchesCategory;
  });

  // Manejo de lector de código de barras dentro del Modal 100%
  const handleModalBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBarcodeInput.trim()) return;

    const matched = products.find(
      (p) =>
        p.codigoBarras.toLowerCase() === modalBarcodeInput.trim().toLowerCase() ||
        p.nombre.toLowerCase().includes(modalBarcodeInput.trim().toLowerCase())
    );

    if (matched) {
      addToCart(matched);
      setModalBarcodeInput('');
    } else {
      alert(`No se encontró ningún producto con el código: ${modalBarcodeInput}`);
    }
  };

  // Asignar pago al 100% con un solo clic
  const handleSetFullPayment = (method: PaymentMethodType) => {
    if (method === 'efectivo_usd' || method === 'zelle') {
      setPaymentBreakdown([{ method, amount: granTotalUSD }]);
    } else if (method === 'efectivo_ves') {
      setPaymentBreakdown([{ method, amount: granTotalVES }]);
    } else {
      setPaymentBreakdown([{ method, amount: granTotalVES, reference: '' }]);
    }
  };

  // Abrir modal 100% de registro de cobro y pago
  const handleOpenPayment = () => {
    if (!activeShift || activeShift.estado !== 'abierta') {
      alert('Para procesar ventas, primero debes realizar la apertura de la caja del turno.');
      onGoToCashControl();
      return;
    }

    // Inicializar pago predeterminado con el monto actual
    setPaymentBreakdown([
      {
        method: 'efectivo_usd',
        amount: granTotalUSD > 0 ? granTotalUSD : 0,
      },
    ]);
    setMobileModalTab(cart.length === 0 ? 'catalog' : 'checkout');
    setShowPaymentModal(true);
    setModalSearchTerm('');
    setModalBarcodeInput('');
    setTimeout(() => {
      modalBarcodeInputRef.current?.focus();
    }, 100);
  };

  // Agregar método de pago dividido
  const handleAddPaymentMethod = () => {
    setPaymentBreakdown((prev) => [
      ...prev,
      { method: 'pago_movil', amount: 0, reference: '' },
    ]);
  };

  const handleUpdatePayment = (index: number, field: string, value: any) => {
    setPaymentBreakdown((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemovePayment = (index: number) => {
    setPaymentBreakdown((prev) => prev.filter((_, i) => i !== index));
  };

  // Suma total abonada en USD y en VES
  const totalPagadoUSD = paymentBreakdown.reduce((acc, p) => {
    if (p.method === 'efectivo_usd' || p.method === 'zelle') {
      return acc + (p.amount || 0);
    } else {
      // Monto en Bolívares convertido a USD
      return acc + vesToUsd(p.amount || 0, bcvRate);
    }
  }, 0);

  const totalPagadoVES = usdToVes(totalPagadoUSD, bcvRate);

  // Cálculo de vuelto exacto
  const exactChangeInfo = calculateExactChange({
    totalUSD: granTotalUSD,
    paidUSD: paymentBreakdown
      .filter((p) => p.method === 'efectivo_usd' || p.method === 'zelle')
      .reduce((s, p) => s + (p.amount || 0), 0),
    paidVES: paymentBreakdown
      .filter((p) => p.method !== 'efectivo_usd' && p.method !== 'zelle')
      .reduce((s, p) => s + (p.amount || 0), 0),
    bcvRate,
    preferVueltoEn: vueltoPreference,
  });

  // Procesar y Registrar la Venta
  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      alert('Debe agregar al menos un producto a la venta antes de registrar el pago.');
      return;
    }

    if (totalPagadoUSD < granTotalUSD - 0.01) {
      alert(`El monto ingresado es insuficiente. Faltan ${formatUSD(granTotalUSD - totalPagadoUSD)} (${formatVES((granTotalUSD - totalPagadoUSD) * bcvRate)})`);
      return;
    }

    // Construir items de la nota de venta
    const saleItems: SaleItem[] = cart.map((item) => {
      const p = item.product;
      const subtotalUSD = Number((p.precioUSD * item.quantity).toFixed(2));
      const subtotalVES = usdToVes(subtotalUSD, bcvRate);
      const ivaItemUSD = p.clasificacion === 'gravable' ? Number((subtotalUSD * 0.16).toFixed(2)) : 0;
      const ivaItemVES = usdToVes(ivaItemUSD, bcvRate);
      const totalUSD = subtotalUSD + ivaItemUSD;
      const totalVES = subtotalVES + ivaItemVES;

      return {
        productoId: p.id,
        codigoBarras: p.codigoBarras,
        nombre: p.nombre,
        cantidad: item.quantity,
        precioUnitarioUSD: p.precioUSD,
        precioUnitarioVES: usdToVes(p.precioUSD, bcvRate),
        costoUnitarioUSD: p.costoUSD,
        clasificacion: p.clasificacion,
        subtotalUSD,
        subtotalVES,
        ivaUSD: ivaItemUSD,
        ivaVES: ivaItemVES,
        totalUSD,
        totalVES,
      };
    });

    const costoTotalUSD = saleItems.reduce(
      (acc, it) => acc + it.costoUnitarioUSD * it.cantidad,
      0
    );
    const utilidadBrutaUSD = Number((granTotalUSD - costoTotalUSD).toFixed(2));

    // Desglose de pagos detallado
    const pagosFormatted: PaymentItem[] = paymentBreakdown.map((p) => {
      const isDivisa = p.method === 'efectivo_usd' || p.method === 'zelle';
      const isCash = p.method === 'efectivo_usd' || p.method === 'efectivo_ves';
      const montoOrig = p.amount || 0;
      const montoU = isDivisa ? montoOrig : vesToUsd(montoOrig, bcvRate);
      const montoV = isDivisa ? usdToVes(montoOrig, bcvRate) : montoOrig;
      const igtfPart = isDivisa ? calculateIGTF(montoU) : 0;

      const methodNames: Record<PaymentMethodType, string> = {
        efectivo_usd: 'Efectivo Divisas (USD)',
        efectivo_ves: 'Efectivo Bolívares (VES)',
        punto_venta: 'Punto de Venta / Débito (VES)',
        pago_movil: 'Pago Móvil (VES)',
        zelle: 'Zelle (USD)',
        transferencia: 'Transferencia Bancaria (VES)',
      };

      return {
        metodo: p.method,
        nombreMetodo: methodNames[p.method],
        montoOriginal: montoOrig,
        moneda: isDivisa ? 'USD' : 'VES',
        montoUSD: montoU,
        montoVES: montoV,
        tasaBCV: bcvRate,
        aplicaIGTF: isDivisa,
        montoIGTFUSD: igtfPart,
        montoIGTFVES: usdToVes(igtfPart, bcvRate),
        referencia: isCash ? undefined : (p.reference?.trim() || undefined),
      };
    });

    const noteNumber = `NE-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const horaStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const fechaStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const defaultClientName = `Cliente [${horaStr} - ${fechaStr}]`;

    const newSale: SaleNote = {
      id: generateUUID(),
      numeroNota: noteNumber,
      clienteId: '11111111-1111-1111-1111-111111111100',
      clienteNombre: defaultClientName,
      clienteDocumento: 'V-00000000',
      cajeroId: currentUser.id,
      cajeroNombre: currentUser.nombre,
      turnoId: activeShift ? activeShift.id : 'shift-default',
      fecha: new Date().toISOString(),
      tasaBCV: bcvRate,
      tasaIVA: 0.16,
      items: saleItems,
      subtotalExentoUSD,
      subtotalGravableUSD,
      ivaUSD,
      igtfUSD,
      totalUSD: granTotalUSD,
      totalVES: granTotalVES,
      costoTotalUSD,
      utilidadBrutaUSD,
      pagos: pagosFormatted,
      montoRecibidoUSD: totalPagadoUSD,
      montoRecibidoVES: totalPagadoVES,
      vueltoUSD: exactChangeInfo.vueltoUSD,
      vueltoVES: exactChangeInfo.vueltoVES,
      estado: 'completada',
    };

    onCompleteSale(newSale);
    setCompletedSale(newSale);
    setShowPaymentModal(false);
    setCart([]);
  };

  // Crear cliente rápido
  const handleCreateClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientDoc.trim() || !newClientName.trim()) return;

    const newCli: Client = {
      id: generateUUID(),
      documento: newClientDoc.trim().toUpperCase(),
      nombre: newClientName.trim(),
      telefono: newClientPhone.trim() || 'N/A',
      direccion: newClientAddress.trim() || 'Caracas, Venezuela',
      limiteCreditoUSD: 100,
      saldoPendienteUSD: 0,
    };

    onAddNewClient(newCli);
    setSelectedClientId(newCli.id);
    setShowNewClientModal(false);
    setNewClientDoc('V-');
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
  };

  // Abrir modal Pagar Luego
  const handleOpenPayLater = () => {
    if (!activeShift || activeShift.estado !== 'abierta') {
      alert('Para procesar ventas, primero debes realizar la apertura de la caja del turno.');
      onGoToCashControl();
      return;
    }
    if (cart.length === 0) {
      alert('El carrito de compras está vacío.');
      return;
    }
    setPayLaterAbonoVES(0);
    setPayLaterAbonoMethod('pago_movil');
    setPayLaterAbonoRef('');

    // Si el cliente actual seleccionado no es consumidor final, usarlo
    if (selectedClientId && selectedClientId !== 'cli-000') {
      setPayLaterClientMode('existing');
      setPayLaterSelectedClientId(selectedClientId);
    } else {
      const registeredClients = clients.filter((c) => c.id !== 'cli-000');
      if (registeredClients.length > 0) {
        setPayLaterClientMode('existing');
        setPayLaterSelectedClientId(registeredClients[0].id);
      } else {
        setPayLaterClientMode('new');
      }
    }
    setShowPayLaterModal(true);
  };

  // Procesar venta en modalidad "Pagar Luego" (Crédito con monto fijado en Bolívares)
  const handleFinalizePayLater = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    let targetClient: Client;
    if (payLaterClientMode === 'new') {
      if (!payLaterNewName.trim()) {
        alert('Por favor ingrese el nombre del cliente para registrar la cuenta por cobrar.');
        return;
      }
      const newCli: Client = {
        id: generateUUID(),
        documento: payLaterNewDoc.trim() || 'V-' + Date.now().toString().slice(-6),
        nombre: payLaterNewName.trim(),
        telefono: payLaterNewPhone.trim() || 'N/A',
        direccion: payLaterNewAddress.trim() || 'Venezuela',
        limiteCreditoUSD: 500,
        saldoPendienteUSD: 0,
      };
      onAddNewClient(newCli);
      targetClient = newCli;
      setSelectedClientId(newCli.id);
    } else {
      const found = clients.find((c) => c.id === payLaterSelectedClientId);
      if (!found || found.id === 'cli-000') {
        alert('Por favor seleccione un cliente registrado o cree uno nuevo para la cuenta por cobrar.');
        return;
      }
      targetClient = found;
    }

    const totalVES = usdToVes(baseTotalUSD, bcvRate);
    const initialAbonoVES = Math.min(totalVES, Math.max(0, payLaterAbonoVES));
    const saldoPendienteVES = Math.max(0, totalVES - initialAbonoVES);
    const initialAbonoUSD = Number((initialAbonoVES / bcvRate).toFixed(2));
    const saldoPendienteUSD = Number((saldoPendienteVES / bcvRate).toFixed(2));

    const saleItems: SaleItem[] = cart.map((item) => {
      const p = item.product;
      const subtotalUSD = Number((p.precioUSD * item.quantity).toFixed(2));
      const subtotalVES = usdToVes(subtotalUSD, bcvRate);
      const ivaItemUSD = p.clasificacion === 'gravable' ? Number((subtotalUSD * 0.16).toFixed(2)) : 0;
      const ivaItemVES = usdToVes(ivaItemUSD, bcvRate);
      return {
        productoId: p.id,
        nombre: p.nombre,
        codigoBarras: p.codigoBarras,
        cantidad: item.quantity,
        precioUnitarioUSD: p.precioUSD,
        precioUnitarioVES: usdToVes(p.precioUSD, bcvRate),
        costoUnitarioUSD: p.costoUSD,
        clasificacion: p.clasificacion,
        subtotalUSD,
        subtotalVES,
        ivaUSD: ivaItemUSD,
        ivaVES: ivaItemVES,
        totalUSD: Number((subtotalUSD + ivaItemUSD).toFixed(2)),
        totalVES: Number((subtotalVES + ivaItemVES).toFixed(2)),
      };
    });

    const costoTotalUSD = cart.reduce(
      (sum, item) => sum + item.product.costoUSD * item.quantity,
      0
    );

    const methodNames: Record<PaymentMethodType, string> = {
      efectivo_usd: 'Efectivo Divisas (USD)',
      efectivo_ves: 'Efectivo Bolívares (VES)',
      punto_venta: 'Punto de Venta / Débito (VES)',
      pago_movil: 'Pago Móvil (VES)',
      zelle: 'Zelle (USD)',
      transferencia: 'Transferencia Bancaria (VES)',
    };

    const payments: PaymentItem[] = [];
    if (initialAbonoVES > 0) {
      payments.push({
        metodo: payLaterAbonoMethod,
        nombreMetodo: methodNames[payLaterAbonoMethod],
        montoOriginal: initialAbonoVES,
        moneda: 'VES',
        montoUSD: initialAbonoUSD,
        montoVES: initialAbonoVES,
        tasaBCV: bcvRate,
        aplicaIGTF: false,
        montoIGTFUSD: 0,
        montoIGTFVES: 0,
        referencia: payLaterAbonoMethod === 'efectivo_ves' ? undefined : (payLaterAbonoRef.trim() || undefined),
      });
    }

    const noteNumber = `NE-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSale: SaleNote = {
      id: generateUUID(),
      numeroNota: noteNumber,
      fecha: new Date().toISOString(),
      clienteId: targetClient.id,
      clienteNombre: targetClient.nombre,
      clienteDocumento: targetClient.documento,
      cajeroId: currentUser.id,
      cajeroNombre: currentUser.nombre,
      turnoId: activeShift?.id || 'turno-def',
      tasaBCV: bcvRate,
      tasaIVA: 0.16,
      items: saleItems,
      subtotalExentoUSD,
      subtotalGravableUSD,
      ivaUSD,
      igtfUSD: 0,
      totalUSD: baseTotalUSD,
      totalVES: totalVES,
      costoTotalUSD,
      utilidadBrutaUSD: Number((baseTotalUSD - costoTotalUSD).toFixed(2)),
      pagos: payments,
      montoRecibidoUSD: initialAbonoUSD,
      montoRecibidoVES: initialAbonoVES,
      vueltoUSD: 0,
      vueltoVES: 0,
      estado: 'completada',
      tipoVenta: 'credito_fijado_ves',
      montoAbonadoUSD: initialAbonoUSD,
      saldoPendienteUSD: saldoPendienteUSD,
      montoFijadoVES: totalVES,
      montoAbonadoVES: initialAbonoVES,
      saldoPendienteVES: saldoPendienteVES,
      montoAbonoInicialVES: initialAbonoVES,
    };

    onCompleteSale(newSale);
    setCompletedSale(newSale);
    setShowPayLaterModal(false);
    setCart([]);
  };

  return (
    <div id="pos-module-root" className="relative w-full h-full">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      {/* Barra Superior Discreta de Estado y Menú */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          {onToggleSidebarCollapse && (
            <button
              type="button"
              onClick={onToggleSidebarCollapse}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
              title={isSidebarCollapsed ? 'Expandir menú de opciones' : 'Retraer menú de opciones'}
            >
              {isSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-indigo-600" />
                  <span className="inline">Opciones Rápidas</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-indigo-600" />
                  <span className="inline">Retraer Opciones</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Cajero: <strong className="text-slate-900">{currentUser.nombre}</strong></span>
            <span className="text-slate-300">•</span>
            <span>Turno: <strong className="text-slate-900">{activeShift?.nombre || 'General'}</strong></span>
          </div>
        </div>

        {(!activeShift || activeShift.estado !== 'abierta') && (
          <button
            type="button"
            onClick={onGoToCashControl}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Aperturar Caja de Turno</span>
          </button>
        )}
      </div>

      {/* TARJETA DEL DÓLAR DEL DÍA - DISEÑO LIMPIO Y MINIMALISTA */}
      <div className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200/80 text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Tasa Oficial BCV del Día
        </div>

        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Referencia Oficial de Cambio
          </span>
          <div className="text-4xl sm:text-5xl md:text-6xl font-mono font-black tracking-tight text-slate-900 flex items-center justify-center gap-2 my-2">
            <span className="text-slate-500 text-xl sm:text-2xl font-bold">Bs.</span>
            <span>{formatVES(bcvRate)}</span>
            <span className="text-slate-400 text-base sm:text-xl font-normal">/ REF</span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
          Fijada por el Banco Central de Venezuela para todas las operaciones en Bolívares y Divisas.
        </p>

        {/* Equivalencias Rápidas Limpias */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
          {[1, 5, 10, 20, 50, 100].map((usd) => (
            <div
              key={usd}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/70 text-xs font-mono text-slate-700 transition-colors"
            >
              <span className="font-bold text-slate-900">REF {usd}</span> ={' '}
              <span className="text-emerald-700 font-bold">{formatVES(usd * bcvRate)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTÓN REGISTRAR PAGO - MINIMALISTA Y ELEGANTE */}
      <div className="w-full flex flex-col items-center">
        <div className="w-full max-w-xl flex items-center gap-2">
          <button
            id="btn-home-registrar-pago"
            type="button"
            onClick={handleOpenPayment}
            className="flex-1 py-4 px-6 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl shadow-xs flex items-center justify-center gap-3 transition-all cursor-pointer group"
          >
            <div className="p-2 bg-slate-800 text-emerald-400 rounded-lg group-hover:scale-105 transition-transform shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="text-left">
              <span className="block text-base sm:text-lg font-bold tracking-wide leading-tight">
                REGISTRAR PAGO
              </span>
              <span className="block text-xs text-slate-300 mt-0.5">
                {cart.length > 0
                  ? `${cart.reduce((s, i) => s + i.quantity, 0)} artículos listos • Continuar cobro`
                  : 'Abrir terminal para escanear productos y cobrar'}
              </span>
            </div>
          </button>
          <InfoHelpButton
            topicKey="cobro_multimoneda"
            onOpenHelp={setHelpTopic}
            size="md"
            label="Guía"
            className="py-3 px-3.5 h-[68px] flex-col rounded-xl"
          />
        </div>
      </div>
    </div>

      {/* Modal Pagar Luego (Fiado / Crédito con Deuda Fijada en Bolívares) */}
      {showPayLaterModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[94vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Pagar Luego (Monto Fijado en Bolívares)
                    </h3>
                    <InfoHelpButton
                      topicKey="pagar_luego"
                      onOpenHelp={setHelpTopic}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Registra la cuenta por cobrar en Bs. fijos, sin recálculo cambiario diario.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayLaterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFinalizePayLater} className="space-y-4 mt-4">
              {/* Resumen del Monto Congelado en Bolívares */}
              <div className="bg-slate-950 text-white p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Total Fijado en Bolívares
                    </span>
                    <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                      {formatVES(usdToVes(baseTotalUSD, bcvRate))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400">Referencia hoy en USD:</span>
                    <div className="text-sm font-mono text-slate-200">{formatUSD(baseTotalUSD)}</div>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Tasa BCV: {formatVES(bcvRate)}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-amber-300 flex items-start gap-1.5 font-medium">
                  <span className="font-bold">✓ Regla de Cobro:</span>
                  <span>
                    El cliente cancelará en Bolívares exactamente esta misma cantidad pactada, sin importar si el dólar varía en los próximos días.
                  </span>
                </div>
              </div>

              {/* Registro o Selección del Cliente */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Datos del Cliente que Va a Pagar Luego
                </label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPayLaterClientMode('existing')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      payLaterClientMode === 'existing'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cliente Frecuente / Registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayLaterClientMode('new')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      payLaterClientMode === 'new'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    + Registrar Nuevo Cliente
                  </button>
                </div>

                {payLaterClientMode === 'existing' ? (
                  <div>
                    <select
                      value={payLaterSelectedClientId}
                      onChange={(e) => setPayLaterSelectedClientId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    >
                      {clients
                        .filter((c) => c.id !== 'cli-000')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} ({c.documento}) {c.telefono ? `- Tel: ${c.telefono}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nombre y Apellido de la Persona *
                      </label>
                      <input
                        type="text"
                        value={payLaterNewName}
                        onChange={(e) => setPayLaterNewName(e.target.value)}
                        placeholder="ej. Pedro Pérez"
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Cédula / Documento (Opcional)
                      </label>
                      <input
                        type="text"
                        value={payLaterNewDoc}
                        onChange={(e) => setPayLaterNewDoc(e.target.value)}
                        placeholder="V-12345678"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Teléfono / WhatsApp (Opcional)
                      </label>
                      <input
                        type="text"
                        value={payLaterNewPhone}
                        onChange={(e) => setPayLaterNewPhone(e.target.value)}
                        placeholder="0412-1234567"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ¿Cuánto Paga Hoy? (Todo o Parte) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. ¿Cuánto Cancela o Abona Hoy en Bolívares?
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Total: Bs. {usdToVes(baseTotalUSD, bcvRate).toFixed(2)}
                  </span>
                </div>

                {/* Botones de selección rápida de pago */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayLaterAbonoVES(0)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      payLaterAbonoVES === 0
                        ? 'bg-amber-100 border-amber-300 text-amber-950 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    No paga hoy (Bs. 0)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPayLaterAbonoVES(
                        Math.round((usdToVes(baseTotalUSD, bcvRate) / 2) * 100) / 100
                      )
                    }
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      payLaterAbonoVES > 0 &&
                      payLaterAbonoVES < usdToVes(baseTotalUSD, bcvRate)
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Paga la mitad (50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayLaterAbonoVES(usdToVes(baseTotalUSD, bcvRate))}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      payLaterAbonoVES >= usdToVes(baseTotalUSD, bcvRate)
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-black'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Paga todo hoy (100%)
                  </button>
                </div>

                {/* Input de monto abonado */}
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-black text-slate-400">
                    Bs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={usdToVes(baseTotalUSD, bcvRate)}
                    value={payLaterAbonoVES}
                    onChange={(e) => {
                      const totalMax = usdToVes(baseTotalUSD, bcvRate);
                      const val = parseFloat(e.target.value) || 0;
                      setPayLaterAbonoVES(Math.min(totalMax, Math.max(0, val)));
                    }}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 text-base font-bold font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 bg-white text-slate-900"
                  />
                </div>

                {/* Si abona algo hoy, pedir método de pago */}
                {payLaterAbonoVES > 0 && (
                  <div className={`grid grid-cols-1 ${payLaterAbonoMethod === 'efectivo_ves' ? '' : 'sm:grid-cols-2'} gap-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl`}>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        Método del Abono Hoy
                      </label>
                      <select
                        value={payLaterAbonoMethod}
                        onChange={(e) => {
                          const newM = e.target.value as PaymentMethodType;
                          setPayLaterAbonoMethod(newM);
                          if (newM === 'efectivo_ves') {
                            setPayLaterAbonoRef('');
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white font-medium text-slate-800"
                      >
                        <option value="pago_movil">Pago Móvil (VES)</option>
                        <option value="efectivo_ves">Efectivo Bolívares (VES)</option>
                        <option value="punto_venta">Punto de Venta (VES)</option>
                        <option value="transferencia">Transferencia Bancaria (VES)</option>
                      </select>
                    </div>
                    {payLaterAbonoMethod !== 'efectivo_ves' && (
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">
                          Comprobante / Referencia
                        </label>
                        <input
                          type="text"
                          value={payLaterAbonoRef}
                          onChange={(e) => setPayLaterAbonoRef(e.target.value)}
                          placeholder="ej. PM-88210"
                          className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white text-slate-800"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Tarjeta de Saldo Restante en Tiempo Real */}
                <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-sans font-bold">
                      Resta por Pagar (Saldo que Deberá):
                    </span>
                    <div className="text-xl font-extrabold text-amber-950">
                      Bs.{' '}
                      {Math.max(
                        0,
                        usdToVes(baseTotalUSD, bcvRate) - payLaterAbonoVES
                      ).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-500">Abono hoy: </span>
                    <span className="font-bold text-emerald-600">
                      Bs. {payLaterAbonoVES.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de Confirmación */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayLaterModal(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Confirmar Venta en Bs & Añadir a Finanzas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal al 100% de la Página: Terminal de Cobro & Registro de Pago */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex flex-col w-screen h-[100dvh] overflow-hidden animate-in fade-in duration-150">
          {/* Barra Superior del Terminal - Diseño Limpio y Minimalista */}
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl font-bold shadow-xs shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-white flex items-center gap-2">
                  <span>Terminal de Registro de Pago</span>
                  <InfoHelpButton
                    topicKey="cobro_multimoneda"
                    onOpenHelp={setHelpTopic}
                  />
                  <span className="text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-slate-700">
                    BCV: Bs. {formatVES(bcvRate)}
                  </span>
                </h2>
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span>Cajero: <strong className="text-slate-200 font-medium">{currentUser.nombre}</strong></span>
                  <span>•</span>
                  <span>Turno: <strong className="text-slate-200 font-medium">{activeShift?.nombre || 'General'}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Atajo para registrar como Pagar Luego fijado en Bolívares */}
              <button
                type="button"
                onClick={handleOpenPayLater}
                disabled={cart.length === 0}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 disabled:opacity-40 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Registrar como Pagar Luego con deuda fijada en Bolívares"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Pagar Luego (Bs)</span>
              </button>

              {/* Limpiar carrito */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer border border-slate-700"
                >
                  Vaciar ({cart.length})
                </button>
              )}

              {/* Salir / Volver */}
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                title="Cerrar terminal de pago"
              >
                <X className="w-4 h-4 text-slate-400" />
                <span>Cerrar</span>
              </button>
            </div>
          </div>

          {/* Selector de Pestañas en Responsive (Oculto en pantallas de escritorio grandes lg) */}
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-2 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileModalTab('catalog')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileModalTab === 'catalog'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>1. Catálogo ({modalFilteredProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileModalTab('checkout')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mobileModalTab === 'checkout'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>2. Cobro & Totales ({formatUSD(granTotalUSD)})</span>
              {cart.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>

          {/* Contenedor Principal: 2 columnas en Desktop, 1 vista activa sin scroll fixed en Mobile */}
          <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden bg-slate-100">
            
            {/* MITAD IZQUIERDA: Catálogo de Productos a Buscar */}
            <div
              className={`${
                mobileModalTab === 'catalog' ? 'flex' : 'hidden lg:flex'
              } lg:col-span-6 xl:col-span-6 flex-col h-full bg-slate-50 border-r border-slate-200 overflow-hidden`}
            >
              {/* Barra de Búsqueda y Filtros Fija arriba */}
              <div className="p-3 sm:p-4 bg-white border-b border-slate-200 shadow-2xs shrink-0 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-indigo-600" />
                    Buscar Productos para la Venta
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {modalFilteredProducts.length} productos disponibles
                  </span>
                </div>

                {/* Lector de código de barras */}
                <form onSubmit={handleModalBarcodeSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="w-4 h-4 text-indigo-600 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      ref={modalBarcodeInputRef}
                      type="text"
                      value={modalBarcodeInput}
                      onChange={(e) => setModalBarcodeInput(e.target.value)}
                      placeholder="Escanear código de barras o teclear Enter..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Escanear
                  </button>
                </form>

                {/* Búsqueda por texto */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre de producto..."
                    className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {modalSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setModalSearchTerm('')}
                      className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filtro de Categorías */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setModalCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                        modalCategory === cat
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scroll de Productos */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                {modalFilteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">No se encontraron productos</p>
                    <p className="text-[11px] text-slate-400">Intenta con otro término o categoría</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {modalFilteredProducts.map((p) => {
                      const isOutOfStock = p.stockActual <= 0;
                      const priceVES = usdToVes(p.precioUSD, bcvRate);
                      const inCart = cart.find((i) => i.product.id === p.id);

                      return (
                        <div
                          key={p.id}
                          onClick={() => !isOutOfStock && addToCart(p)}
                          className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                            inCart
                              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400'
                              : isOutOfStock
                              ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {p.categoria}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded border ${
                                  p.stockActual <= 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : p.stockActual <= p.stockMinimo
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                Stock: {p.stockActual} {p.unidadMedida}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight">
                              {p.nombre}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {p.codigoBarras}
                            </p>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-black font-mono text-slate-900">
                                {formatUSD(p.precioUSD)}
                              </div>
                              <div className="text-[11px] font-bold font-mono text-indigo-600">
                                {formatVES(priceVES)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {inCart && (
                                <span className="text-[11px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                  ×{inCart.quantity}
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isOutOfStock) addToCart(p);
                                }}
                                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                  isOutOfStock
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Agregar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botón de acceso directo al cobro en mobile cuando hay items */}
              {cart.length > 0 && (
                <div className="lg:hidden p-3 bg-white border-t border-slate-200 shrink-0 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setMobileModalTab('checkout')}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                      <span>{cart.reduce((s, i) => s + i.quantity, 0)} productos en cuenta</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-emerald-400 font-bold">
                      <span>{formatUSD(granTotalUSD)}</span>
                      <ArrowRight className="w-4 h-4 ml-1 text-white" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* MITAD DERECHA: Cobro & Totales (Sin scroll fixed en responsive) */}
            <div
              className={`${
                mobileModalTab === 'checkout' ? 'flex' : 'hidden lg:flex'
              } lg:col-span-6 xl:col-span-6 flex-col h-full bg-white overflow-y-auto overscroll-contain`}
            >
              {/* Contenido sin scroll fixed interno: el contenedor entero fluye naturalmente */}
              <div className="p-4 sm:p-5 lg:p-6 space-y-4 pb-28 sm:pb-32 lg:pb-8">
                
                {/* 1. SELECCIÓN RÁPIDA DE CLIENTE */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Cliente para la Nota
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {selectedClient.nombre}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {selectedClient.documento}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="text-[11px] p-1.5 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 max-w-[130px] sm:max-w-[160px]"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewClientModal(true)}
                      className="p-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                      title="Crear nuevo cliente"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. PRODUCTOS EN ESTA CUENTA (Flujo natural sin scroll atrapado en responsive) */}
                <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        <ShoppingCart className="w-4 h-4 text-emerald-600" />
                        Productos ({cart.reduce((s, i) => s + i.quantity, 0)} unidades)
                      </span>
                    </div>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={clearCart}
                        className="text-[11px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Vaciar lista
                      </button>
                    )}
                  </div>

                  {/* Listado de Items: en responsive NO tiene scroll fijo interno */}
                  <div className="space-y-1.5 lg:max-h-56 lg:overflow-y-auto pr-0 lg:pr-1">
                    {cart.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <p className="font-semibold text-slate-500">No hay productos agregados</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Seleccione productos desde el catálogo para cargarlos a esta cuenta.
                        </p>
                        <button
                          type="button"
                          onClick={() => setMobileModalTab('catalog')}
                          className="lg:hidden mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Ver Catálogo</span>
                        </button>
                      </div>
                    ) : (
                      cart.map((item) => {
                        const p = item.product;
                        const itemSubtotalUSD = p.precioUSD * item.quantity;
                        const itemSubtotalVES = usdToVes(itemSubtotalUSD, bcvRate);

                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="font-bold text-slate-900 truncate">{p.nombre}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                                <span>{formatUSD(p.precioUSD)} c/u</span>
                                <span>•</span>
                                <span>{p.clasificacion === 'exento' ? 'Exento IVA' : 'IVA 16%'}</span>
                              </div>
                            </div>

                            {/* Controles de Cantidad */}
                            <div className="flex items-center gap-1 shrink-0 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, -1)}
                                className="p-1 hover:bg-white rounded text-slate-700 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center font-bold font-mono text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(p.id, 1)}
                                className="p-1 hover:bg-white rounded text-slate-700 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Subtotal del Item */}
                            <div className="w-24 text-right shrink-0 pl-2">
                              <div className="font-bold font-mono text-slate-900">
                                {formatUSD(itemSubtotalUSD)}
                              </div>
                              <div className="text-[10px] font-mono text-indigo-600">
                                {formatVES(itemSubtotalVES)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(p.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer shrink-0 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. RESUMEN DE TOTALES - DISEÑO LIMPIO, CLARO Y DIRECTO */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3 shadow-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Exento:</span>
                      <strong className="text-white font-mono">{formatUSD(subtotalExentoUSD)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Gravable:</span>
                      <strong className="text-white font-mono">{formatUSD(subtotalGravableUSD)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">IVA (16%):</span>
                      <strong className="text-white font-mono">{formatUSD(ivaUSD)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">IGTF (3%):</span>
                      <strong className="text-amber-300 font-mono">{formatUSD(igtfUSD)}</strong>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Total en Divisas (REF)
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-black text-white">
                        {formatUSD(granTotalUSD)}
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Total en Bolívares (VES @ BCV)
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-black text-emerald-400">
                        {formatVES(granTotalVES)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. CANALES DE PAGO MULTIMONEDA */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Desglose de Formas de Pago
                    </label>

                    {/* Botones de Llenado Rápido */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSetFullPayment('pago_movil')}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
                        title="Pagar 100% en Pago Móvil"
                      >
                        100% Pago Móvil
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFullPayment('efectivo_usd')}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                        title="Pagar 100% en Efectivo Divisas"
                      >
                        100% Efectivo REF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetFullPayment('punto_venta')}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer"
                        title="Pagar 100% en Punto de Venta"
                      >
                        100% Punto
                      </button>
                      <button
                        type="button"
                        onClick={handleAddPaymentMethod}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        + Otro
                      </button>
                    </div>
                  </div>

                  {/* Filas de métodos de pago */}
                  <div className="space-y-2">
                    {paymentBreakdown.map((payment, idx) => {
                      const isDivisa = payment.method === 'efectivo_usd' || payment.method === 'zelle';
                      const isCash = payment.method === 'efectivo_usd' || payment.method === 'efectivo_ves';

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-2"
                        >
                          <select
                            value={payment.method}
                            onChange={(e) => {
                              const newMethod = e.target.value as PaymentMethodType;
                              handleUpdatePayment(idx, 'method', newMethod);
                              if (newMethod === 'efectivo_usd' || newMethod === 'efectivo_ves') {
                                handleUpdatePayment(idx, 'reference', '');
                              }
                            }}
                            className="w-full sm:w-44 text-xs p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
                          >
                            <option value="pago_movil">Pago Móvil (VES)</option>
                            <option value="efectivo_usd">Efectivo Divisas (REF)</option>
                            <option value="punto_venta">Punto de Venta / Débito</option>
                            <option value="efectivo_ves">Efectivo Bolívares (VES)</option>
                            <option value="zelle">Zelle (REF)</option>
                            <option value="transferencia">Transferencia (VES)</option>
                          </select>

                          <div className="relative flex-1 w-full">
                            <span className="absolute left-2.5 top-2 text-[11px] font-bold text-slate-400 font-mono">
                              {isDivisa ? 'REF' : 'Bs.'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={payment.amount || ''}
                              onChange={(e) =>
                                handleUpdatePayment(idx, 'amount', parseFloat(e.target.value) || 0)
                              }
                              placeholder="Monto"
                              className={`w-full ${isDivisa ? 'pl-11' : 'pl-9'} pr-3 py-2 text-xs font-bold font-mono border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500`}
                            />
                          </div>

                          {!isCash && (
                            <input
                              type="text"
                              value={payment.reference || ''}
                              onChange={(e) => handleUpdatePayment(idx, 'reference', e.target.value)}
                              placeholder={payment.method === 'punto_venta' ? 'Lote / Ref' : 'Ref / Comprobante'}
                              className="w-full sm:w-32 text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                            />
                          )}

                          {paymentBreakdown.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePayment(idx)}
                              className="p-2 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 5. CÁLCULO DE VUELTO O SALDO PENDIENTE */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-white">
                    <div className="flex items-center justify-between text-[11px] mb-2.5">
                      <span className="font-bold text-slate-300">Preferencia de Vuelto:</span>
                      <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[10px]">
                        <button
                          type="button"
                          onClick={() => setVueltoPreference('VES')}
                          className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                            vueltoPreference === 'VES' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Bolívares (VES)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVueltoPreference('USD')}
                          className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                            vueltoPreference === 'USD' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Divisas (REF)
                        </button>
                        <button
                          type="button"
                          onClick={() => setVueltoPreference('MIXTO')}
                          className={`px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                            vueltoPreference === 'MIXTO' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Mixto
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400">Total Ingresado:</span>
                        <div className="font-bold text-white font-mono text-sm">
                          {formatUSD(totalPagadoUSD)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatVES(totalPagadoVES)}
                        </div>
                      </div>

                      <div className="text-right">
                        {totalPagadoUSD < granTotalUSD - 0.01 ? (
                          <div>
                            <span className="text-[10px] text-amber-400 font-bold">Faltante por Pagar:</span>
                            <div className="font-bold text-amber-400 font-mono text-sm">
                              {formatUSD(granTotalUSD - totalPagadoUSD)}
                            </div>
                            <div className="text-[10px] text-amber-400/80 font-mono">
                              {formatVES((granTotalUSD - totalPagadoUSD) * bcvRate)}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] text-slate-400">Vuelto Calculado:</span>
                            <div className="font-bold text-emerald-400 font-mono text-sm">
                              {exactChangeInfo.hasChange
                                ? `${exactChangeInfo.vueltoUSD > 0 ? formatUSD(exactChangeInfo.vueltoUSD) : ''} ${
                                    exactChangeInfo.vueltoUSD > 0 && exactChangeInfo.vueltoVES > 0 ? '+ ' : ''
                                  }${exactChangeInfo.vueltoVES > 0 ? formatVES(exactChangeInfo.vueltoVES) : ''}`
                                : 'Pago Exacto'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 6. BOTONES DE ACCIÓN: FLUJO NATURAL SIN SCROLL ATRAPADO */}
                  <div className="pt-2 space-y-2">
                    {/* Botón Principal: Confirmar Venta & Cobrar */}
                    <button
                      id="btn-confirmar-venta"
                      type="button"
                      disabled={cart.length === 0 || totalPagadoUSD < granTotalUSD - 0.01}
                      onClick={handleFinalizeSale}
                      className="w-full py-4 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-transparent disabled:cursor-not-allowed uppercase tracking-wider"
                    >
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {cart.length === 0
                          ? 'Agregue productos para registrar pago'
                          : totalPagadoUSD < granTotalUSD - 0.01
                          ? `Faltan ${formatUSD(granTotalUSD - totalPagadoUSD)} para completar pago`
                          : 'Emitir Nota & Cobrar'}
                      </span>
                    </button>

                    {/* Botón Secundario: Pagar Luego */}
                    <div className="flex items-center gap-1.5">
                      <button
                        id="btn-modal-pagar-luego"
                        type="button"
                        onClick={handleOpenPayLater}
                        disabled={cart.length === 0}
                        className="flex-1 py-3 px-4 bg-amber-50 hover:bg-amber-100/80 disabled:opacity-40 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        title="Pagar luego (fiado en Bolívares fijos con ficha del cliente)"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Pagar Luego (Fiado en Bolívares Fijos)</span>
                      </button>
                      <InfoHelpButton
                        topicKey="pagar_luego"
                        onOpenHelp={setHelpTopic}
                        className="py-3 px-3 h-[42px] rounded-xl bg-amber-50/60 border-amber-200"
                      />
                    </div>

                    {/* Botón Terciario: Cancelar / Seguir Comprando */}
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl cursor-pointer transition-colors text-center"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación Rápida de Cliente */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-1">Registrar Nuevo Cliente</h3>
            <p className="text-xs text-gray-500 mb-4">
              Vincular datos del cliente para control y trazabilidad en la nota de entrega.
            </p>

            <form onSubmit={handleCreateClientSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cédula o RIF
                </label>
                <input
                  type="text"
                  value={newClientDoc}
                  onChange={(e) => setNewClientDoc(e.target.value)}
                  placeholder="V-12345678 o J-12345678-9"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre Completo o Razón Social
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="ej. Elena Castillo"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="0414-1234567"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Dirección
                </label>
                <textarea
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Caracas, Venezuela"
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Venta Exitosa con Ticket / Comprobante */}
      {completedSale && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-gray-900">¡Venta Registrada con Éxito!</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Nota N°: <span className="font-mono font-bold text-gray-800">{completedSale.numeroNota}</span>
            </p>

            <div className="my-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-semibold text-gray-900">{completedSale.clienteNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total REF:</span>
                <span className="font-bold text-gray-900">{formatUSD(completedSale.totalUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Bolívares:</span>
                <span className="font-bold text-blue-700">{formatVES(completedSale.totalVES)}</span>
              </div>
              {completedSale.items && completedSale.items.length > 0 && (
                <div className="pt-2 border-t border-slate-200 mt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    <span>Artículos Vendidos ({completedSale.items.reduce((acc, it) => acc + (it.cantidad || 0), 0)})</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                    {completedSale.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700">
                        <span className="truncate pr-2">
                          <strong className="text-slate-900 font-mono">{it.cantidad}×</strong>{' '}
                          {it.nombre || (it as any).productoNombre || 'Artículo'}
                        </span>
                        <span className="font-mono font-bold text-slate-800 shrink-0">
                          {formatUSD(it.subtotalUSD)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(completedSale.vueltoUSD > 0 || completedSale.vueltoVES > 0) && (
                <div className="flex justify-between pt-1 border-t border-slate-200 text-emerald-700">
                  <span>Vuelto Entregado:</span>
                  <span className="font-bold">
                    {completedSale.vueltoUSD > 0 ? formatUSD(completedSale.vueltoUSD) : ''}{' '}
                    {completedSale.vueltoVES > 0 ? formatVES(completedSale.vueltoVES) : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => generateSaleNotePDF(completedSale)}
                className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Comprobante PDF (80mm)</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
              >
                Continuar Vendiendo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Flotante de Explicación de Acciones Clave */}
      <ActionHelpModal
        isOpen={Boolean(helpTopic)}
        onClose={() => setHelpTopic(null)}
        topicKey={helpTopic}
      />
    </div>
  );
};
