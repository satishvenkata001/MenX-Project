import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { getCachedSubcategories, getCachedBrands, getCachedSizes, getCachedColors, invalidateMetadataCache, invalidateProductCache, invalidateOrdersCache, invalidateSupportCache } from '../utils/metadataCache.js';
import { filterSizesForCategory, getCategorySizeRule } from '../utils/categorySizes.js';
import HybridColorSelector from '../components/HybridColorSelector.jsx';
import {
  LayoutDashboard, ShoppingBag, RotateCcw, AlertTriangle,
  Search, Eye, Shield, Check, X, CreditCard, ChevronRight, Plus,
  Trash2, Image as ImageIcon, Award, ArrowUp, ArrowDown, Settings,
  Users, User, ChevronDown, ChevronUp, RefreshCw, AlertCircle,
  Package, MapPin, ArrowRight, HelpCircle, MessageSquare, Send,
  CheckCircle2, Clock, LifeBuoy, Tag, Filter, Sparkles,
  Database, Download, FileSpreadsheet, FileText, Calendar, Lock
} from 'lucide-react';

const RETURN_REASON_LABELS = {
  WRONG_SIZE: 'Product size does not fit / Size issue',
  DEFECTIVE: 'Defective or damaged product',
  NOT_AS_DESCRIBED: 'Product not as described',
  CHANGED_MIND: 'Customer changed mind',
  QUALITY_ISSUE: 'Fabric / Quality issue',
  OTHER: 'Other reason'
};

function getReturnReasonLabel(reason) {
  return RETURN_REASON_LABELS[reason] || (reason ? reason.replace(/_/g, ' ') : 'Not specified');
}

function getSupportCategoryLabel(cat) {
  const map = {
    ORDERS_FULFILLMENT: 'Orders & Fulfillment',
    RETURNS_EXCHANGES: 'Returns & Exchanges',
    PAYMENTS_REFUNDS: 'Payments & Refunds',
    PRODUCT_INQUIRY: 'Product Inquiry',
    ACCOUNT_SETTINGS: 'Account & Settings',
    OTHER: 'Other Support'
  };
  return map[cat] || cat || 'General';
}

function getSupportStatusBadge(status) {
  switch (status) {
    case 'OPEN':
      return 'bg-menx-primary/10 border-menx-primary/30 text-menx-primary';
    case 'IN_PROGRESS':
      return 'bg-menx-info/10 border-menx-info/30 text-menx-info';
    case 'RESOLVED':
      return 'bg-menx-success/10 border-menx-success/30 text-menx-success';
    case 'CLOSED':
      return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
    default:
      return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
  }
}

function getSuggestionStatusBadge(status) {
  switch (status) {
    case 'NEW':
      return 'bg-menx-primary/10 border-menx-primary/30 text-menx-primary';
    case 'IN_REVIEW':
      return 'bg-menx-info/10 border-menx-info/30 text-menx-info';
    case 'ACCEPTED':
      return 'bg-menx-success/10 border-menx-success/30 text-menx-success';
    case 'REJECTED':
      return 'bg-menx-error/10 border-menx-error/30 text-menx-error';
    case 'IMPLEMENTED':
      return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    default:
      return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
  }
}

function groupLowStockVariantsByProduct(items) {
  if (!Array.isArray(items)) return [];
  const map = new Map();
  for (const item of items) {
    if (!item) continue;
    const prodId = item.productId || item.variant?.product?.id || item.variant?.productId || 'unknown-product';
    const prodTitle = item.productTitle || item.variant?.product?.title || item.product_name || 'Product Variant';
    const prodSlug = item.productSlug || item.variant?.product?.slug || '';

    if (!map.has(prodId)) {
      map.set(prodId, {
        productId: prodId,
        productTitle: prodTitle,
        productSlug: prodSlug,
        lowStockVariantCount: 0,
        hasZeroStock: false,
        hasLowStock: false,
        variants: []
      });
    }

    const group = map.get(prodId);
    const avail = item.availableStock ?? item.stock?.available ?? item.quantity_available ?? 0;
    const threshold = item.minThreshold ?? item.threshold ?? item.stock?.threshold ?? item.variant?.low_stock_threshold ?? 5;

    if (avail <= 0) group.hasZeroStock = true;
    if (avail > 0 && avail <= threshold) group.hasLowStock = true;

    group.variants.push(item);
    group.lowStockVariantCount = group.variants.length;
  }
  return Array.from(map.values());
}
import BaseLayout from '../components/BaseLayout.jsx';
import AdminModal from '../components/AdminModal.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';

/**
 * Line item row for Admin Manage Order modal.
 * Displays ordered catalogue details with historical snapshot integrity,
 * product thumbnail, SKU, size, color swatch, and unit price x quantity.
 */
function AdminOrderItemRow({ item, colors = [] }) {
  const [imgError, setImgError] = useState(false);

  // 1. Primary & Catalogue Identity
  const catalogueName = item.product_title_snapshot || item.variant?.product?.title || 'Purchased Item';
  const brandName = item.variant?.product?.brand?.name || '';

  // 2. Product / Catalogue Image resolution
  const imagesList = item.variant?.product?.images || [];
  const primaryImg = [...imagesList].sort(
    (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order ?? 0) - (b.display_order ?? 0)
  )[0];
  const imageUrl = item.product_image_snapshot || primaryImg?.image_url || item.variant?.product?.thumbnailUrl || null;

  // 3. Color name & swatch resolution
  const rawColor = (item.color_snapshot || '').trim();
  let displayColorName = rawColor || '';
  let colorHex = '';

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawColor)) {
    colorHex = rawColor;
    const matched = (colors || []).find(c => (c.hex_code || c.hexCode || '').toLowerCase() === rawColor.toLowerCase());
    if (matched && matched.name) {
      displayColorName = matched.name;
    }
  } else if (rawColor) {
    const matched = (colors || []).find(c => (c.name || '').toLowerCase() === rawColor.toLowerCase());
    if (matched) {
      colorHex = matched.hex_code || matched.hexCode || '';
    }
  }

  return (
    <div className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-start sm:items-center justify-between text-xs">
      <div className="flex items-start space-x-3.5 min-w-0 flex-1">
        {/* Ordered Product Thumbnail (Desktop: 64-80px, Mobile: 56-72px) */}
        <div className="w-16 h-18 sm:w-18 sm:h-20 bg-menx-surface border border-menx-border/80 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={catalogueName}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover select-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-menx-border/60 space-y-1">
              <ShoppingBag className="w-6 h-6 text-menx-text-muted/40" />
              <span className="text-[8px] uppercase font-mono tracking-wider text-menx-text-muted/60 font-bold">MENX</span>
            </div>
          )}
        </div>

        {/* Ordered Product Details */}
        <div className="space-y-1 min-w-0 flex-1">
          {brandName && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-menx-primary truncate block">
              {brandName}
            </span>
          )}

          {/* PRIMARY: Product Name */}
          <h5 className="font-extrabold text-white text-xs sm:text-sm tracking-tight leading-snug break-words">
            {catalogueName}
          </h5>

          {/* SECONDARY: Catalogue Row */}
          <div className="text-[11px] text-menx-text-secondary flex items-baseline gap-1.5 flex-wrap">
            <span className="font-semibold text-menx-text-muted">Catalogue:</span>
            <span className="text-white font-medium">{catalogueName}</span>
          </div>

          {/* VARIANT DETAILS: SKU, Size, Color */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[11px] text-menx-text-muted font-mono">
            {item.variant_sku_snapshot && (
              <span>
                SKU: <span className="text-menx-text-secondary font-mono font-medium">{item.variant_sku_snapshot}</span>
              </span>
            )}
            {item.size_snapshot && (
              <span>
                Size: <span className="text-white font-bold">{item.size_snapshot}</span>
              </span>
            )}
            {displayColorName && (
              <span className="inline-flex items-center gap-1.5 font-sans">
                <span className="font-mono text-menx-text-muted">Color:</span>
                {colorHex && (
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0 border border-white/20 shadow-sm"
                    style={{ backgroundColor: colorHex }}
                    aria-hidden="true"
                  />
                )}
                <span className="text-white font-medium">{displayColorName}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* FINANCIAL: Line Total & Unit Price */}
      <div className="text-right shrink-0 self-end sm:self-center pl-2">
        <div className="font-mono font-extrabold text-white text-sm">
          {formatCurrency(item.line_total)}
        </div>
        <div className="text-[11px] font-mono text-menx-text-muted mt-0.5">
          {formatCurrency(item.unit_price_snapshot)} × {item.quantity}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();

  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [productsCount, setProductsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [returnsCount, setReturnsCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Tab - Orders
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState(null);
  const [codAmount, setCodAmount] = useState('');
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
  const [recordingCod, setRecordingCod] = useState(false);

  // Tab - Returns
  const [returns, setReturns] = useState([]);
  const [returnsTotal, setReturnsTotal] = useState(0);
  const [returnPage, setReturnPage] = useState(1);
  const [returnStatusFilter, setReturnStatusFilter] = useState('');
  const [returnSearch, setReturnSearch] = useState('');
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [loadingReturnDetails, setLoadingReturnDetails] = useState(false);
  const [returnDetailsError, setReturnDetailsError] = useState(null);
  const [returnTransitionStatus, setReturnTransitionStatus] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [returnItemsConditions, setReturnItemsConditions] = useState({}); // itemId -> 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE'
  const [updatingReturnStatus, setUpdatingReturnStatus] = useState(false);

  // Tab - Low Stock
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [lowStockVariantTotal, setLowStockVariantTotal] = useState(0);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [lowStockError, setLowStockError] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Tab - Product Catalog
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Tab - Customers
  const [customers, setCustomers] = useState([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState(null);
  const [loadingCustomerDetails, setLoadingCustomerDetails] = useState(false);
  const [customerDetailsError, setCustomerDetailsError] = useState(null);
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');

  // Tab - Support Tickets
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportTicketsTotal, setSupportTicketsTotal] = useState(0);
  const [supportTicketPage, setSupportTicketPage] = useState(1);
  const [supportStatusFilter, setSupportStatusFilter] = useState('');
  const [supportCategoryFilter, setSupportCategoryFilter] = useState('');
  const [supportSearch, setSupportSearch] = useState('');
  const [debouncedSupportSearch, setDebouncedSupportSearch] = useState('');
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false);
  const [selectedSupportTicket, setSelectedSupportTicket] = useState(null);
  const [loadingSupportTicketDetails, setLoadingSupportTicketDetails] = useState(false);
  const [supportTicketReply, setSupportTicketReply] = useState('');
  const [sendingSupportReply, setSendingSupportReply] = useState(false);
  const [supportReplyError, setSupportReplyError] = useState(null);
  const [supportTransitionStatus, setSupportTransitionStatus] = useState('');
  const [supportTransitionNote, setSupportTransitionNote] = useState('');
  const [updatingSupportTicketStatus, setUpdatingSupportTicketStatus] = useState(false);
  const [supportStatusError, setSupportStatusError] = useState(null);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);

  // Tab - Suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsTotal, setSuggestionsTotal] = useState(0);
  const [suggestionPage, setSuggestionPage] = useState(1);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState('');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [debouncedSuggestionSearch, setDebouncedSuggestionSearch] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedAdminSuggestion, setSelectedAdminSuggestion] = useState(null);
  const [suggestionAdminNote, setSuggestionAdminNote] = useState('');
  const [suggestionStatusUpdate, setSuggestionStatusUpdate] = useState('');
  const [updatingSuggestion, setUpdatingSuggestion] = useState(false);
  const [suggestionUpdateError, setSuggestionUpdateError] = useState(null);
  const [newSuggestionsCount, setNewSuggestionsCount] = useState(0);

  // Tab - Data Center State
  const [datacenterDataset, setDatacenterDataset] = useState('products_stock');
  const [datacenterFormat, setDatacenterFormat] = useState('csv');
  const [datacenterDatePreset, setDatacenterDatePreset] = useState('all');
  const [datacenterFromDate, setDatacenterFromDate] = useState('');
  const [datacenterToDate, setDatacenterToDate] = useState('');
  const [datacenterProductStatus, setDatacenterProductStatus] = useState('ALL');
  const [datacenterStockStatus, setDatacenterStockStatus] = useState('ALL');
  const [datacenterCategoryId, setDatacenterCategoryId] = useState('');
  const [datacenterOrderStatus, setDatacenterOrderStatus] = useState('ALL');
  const [exportingData, setExportingData] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState(null);
  const [exportErrorMessage, setExportErrorMessage] = useState(null);
  const [datacenterSummary, setDatacenterSummary] = useState(null);
  const [loadingDatacenterSummary, setLoadingDatacenterSummary] = useState(false);

  // Tab - Delivery PIN Codes State
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [deliveryZonesTotal, setDeliveryZonesTotal] = useState(0);
  const [deliveryZonesActiveCount, setDeliveryZonesActiveCount] = useState(0);
  const [deliveryZonesInactiveCount, setDeliveryZonesInactiveCount] = useState(0);
  const [deliveryZonesPage, setDeliveryZonesPage] = useState(1);
  const [deliveryZonesSearch, setDeliveryZonesSearch] = useState('');
  const [debouncedDeliveryZonesSearch, setDebouncedDeliveryZonesSearch] = useState('');
  const [deliveryZonesStatusFilter, setDeliveryZonesStatusFilter] = useState('ALL');
  const [deliveryZonesStateFilter, setDeliveryZonesStateFilter] = useState('');
  const [loadingDeliveryZones, setLoadingDeliveryZones] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState(null);
  const [deliveryZoneActionSuccess, setDeliveryZoneActionSuccess] = useState(null);
  const [deliveryZoneActionError, setDeliveryZoneActionError] = useState(null);
  const [togglingZoneId, setTogglingZoneId] = useState(null);
  const [deletingZoneId, setDeletingZoneId] = useState(null);

  // Add PIN Modal State
  const [showAddPinModal, setShowAddPinModal] = useState(false);
  const [pinForm, setPinForm] = useState({
    pincode: '',
    state: 'Andhra Pradesh',
    district: '',
    isActive: true,
    baseDeliveryCharge: '20.00',
    estimatedDaysMin: 5,
    estimatedDaysMax: 9
  });
  const [savingPin, setSavingPin] = useState(false);
  const [pinFormError, setPinFormError] = useState(null);

  // Metadata lists for product/variant creation
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  // Modals under Product Catalog
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    id: '', // Empty for create
    title: '',
    slug: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    brandId: '',
    baseMrp: '',
    basePrice: '',
    material: '',
    careInstructions: '',
    tags: '',
    isFeatured: false,
    status: 'DRAFT'
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState(null);

  // Product Delete Modal State
  const [showDeleteProductModal, setShowDeleteProductModal] = useState(false);
  const [selectedProductForDelete, setSelectedProductForDelete] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [deleteProductError, setDeleteProductError] = useState(null);

  // Category Management Tab & Modal States
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 0,
    isActive: true
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState(null);

  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [selectedCategoryForDelete, setSelectedCategoryForDelete] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState(null);

  // Variants modal
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantsError, setVariantsError] = useState(null);
  const [variantForm, setVariantForm] = useState({
    id: '', // set for edit
    sizeId: '',
    colorId: '',
    sku: '',
    barcode: '',
    mrp: '',
    sellingPrice: '',
    weightGrams: 300,
    lowStockThreshold: 5,
    initialStock: 0,
    isActive: true
  });
  const [savingVariant, setSavingVariant] = useState(false);

  // Color Group Bulk Variant Creation State
  const [colorGroupColorId, setColorGroupColorId] = useState('');
  const [colorGroupMrp, setColorGroupMrp] = useState('');
  const [colorGroupSellingPrice, setColorGroupSellingPrice] = useState('');
  const [colorGroupWeightGrams, setColorGroupWeightGrams] = useState(300);
  const [colorGroupLowStockThreshold, setColorGroupLowStockThreshold] = useState(5);
  const [colorGroupSizes, setColorGroupSizes] = useState({}); // { [sizeId]: { selected: boolean, stock: number|string } }
  const [creatingColorGroup, setCreatingColorGroup] = useState(false);
  const [colorGroupProgress, setColorGroupProgress] = useState({ active: false, current: 0, total: 0, message: '' });
  const [colorGroupStatus, setColorGroupStatus] = useState(null); // { type: 'success'|'partial'|'error', text: string }

  // Edit Variant Inline Stock State
  const [editVariantInventory, setEditVariantInventory] = useState([]);
  const [loadingEditInventory, setLoadingEditInventory] = useState(false);
  const [editStockAdjustment, setEditStockAdjustment] = useState({
    quantity: 10,
    movementType: 'PURCHASE_RECEIPT',
    reason: 'Stock received'
  });
  const [savingEditStockAdjustment, setSavingEditStockAdjustment] = useState(false);
  const [editStockAdjustmentError, setEditStockAdjustmentError] = useState(null);
  const [editStockAdjustmentSuccess, setEditStockAdjustmentSuccess] = useState(null);

  // Adjust Stock Modal State
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [selectedVariantForAdjust, setSelectedVariantForAdjust] = useState(null);
  const [adjustStockForm, setAdjustStockForm] = useState({
    quantity: 25,
    movementType: 'PURCHASE_RECEIPT',
    reason: 'Stock received'
  });
  const [savingStockAdjustment, setSavingStockAdjustment] = useState(false);
  const [adjustStockError, setAdjustStockError] = useState(null);

  // Images modal
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [selectedProductForImages, setSelectedProductForImages] = useState(null);
  const [images, setImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageAltText, setImageAltText] = useState('');
  const [imageDisplayOrder, setImageDisplayOrder] = useState('0');
  const [imageIsPrimary, setImageIsPrimary] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [settingPrimaryImageId, setSettingPrimaryImageId] = useState(null);
  const [movingImageId, setMovingImageId] = useState(null);
  const [imageVariantId, setImageVariantId] = useState('');
  const [productVariantsForImages, setProductVariantsForImages] = useState([]);

  // Request sequence refs to prevent race conditions and out-of-order in-flight responses overwriting state
  const catalogReqId = useRef(0);
  const ordersReqId = useRef(0);
  const returnsReqId = useRef(0);
  const lowStockReqId = useRef(0);
  const customersReqId = useRef(0);
  const supportReqId = useRef(0);
  const suggestionsReqId = useRef(0);
  const deliveryZonesReqId = useRef(0);

  // Determine permissions based on exact backend constants
  const hasInventoryRole = user && ['INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const hasOrderRole = user && ['STORE_STAFF', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  // Revoke image preview URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);
  const hasSupportRole = user && ['STORE_STAFF', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const hasDataCenterRole = user && ['INVENTORY_MANAGER', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const hasDeliveryPinRole = user && ['STORE_STAFF', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const canExportProducts = user && ['INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const canExportOrders = user && ['ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  // Date preset calculator for Data Center
  const applyDatePreset = (preset) => {
    setDatacenterDatePreset(preset);
    const today = new Date();
    const formatDateInput = (d) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setDatacenterFromDate('');
      setDatacenterToDate('');
    } else if (preset === 'last7') {
      const from = new Date();
      from.setDate(today.getDate() - 7);
      setDatacenterFromDate(formatDateInput(from));
      setDatacenterToDate(formatDateInput(today));
    } else if (preset === 'last30') {
      const from = new Date();
      from.setDate(today.getDate() - 30);
      setDatacenterFromDate(formatDateInput(from));
      setDatacenterToDate(formatDateInput(today));
    } else if (preset === 'this_month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setDatacenterFromDate(formatDateInput(from));
      setDatacenterToDate(formatDateInput(today));
    }
  };

  // Fetch Data Center summary metrics
  const fetchDatacenterSummary = async () => {
    if (!hasDataCenterRole) return;
    setLoadingDatacenterSummary(true);
    try {
      const res = await api.get('/admin/exports/summary');
      if (res?.data) {
        setDatacenterSummary(res.data);
      }
    } catch (err) {
      console.error('Failed to load datacenter summary:', err.message);
    } finally {
      setLoadingDatacenterSummary(false);
    }
  };

  // Execute export and trigger browser download
  const handleExecuteExport = async () => {
    setExportErrorMessage(null);
    setExportSuccessMessage(null);

    // Validation for date range on orders
    if (datacenterDataset === 'orders' && datacenterFromDate && datacenterToDate) {
      if (new Date(datacenterFromDate) > new Date(datacenterToDate)) {
        setExportErrorMessage('From Date must be earlier than or equal to To Date.');
        return;
      }
    }

    setExportingData(true);
    try {
      let endpoint = '';
      if (datacenterDataset === 'products_stock') {
        const params = new URLSearchParams();
        params.append('format', datacenterFormat);
        if (datacenterProductStatus && datacenterProductStatus !== 'ALL') {
          params.append('status', datacenterProductStatus);
        }
        if (datacenterStockStatus && datacenterStockStatus !== 'ALL') {
          params.append('stockStatus', datacenterStockStatus);
        }
        if (datacenterCategoryId) {
          params.append('categoryId', datacenterCategoryId);
        }
        endpoint = `/admin/exports/products?${params.toString()}`;
      } else if (datacenterDataset === 'orders') {
        const params = new URLSearchParams();
        params.append('format', datacenterFormat);
        if (datacenterFromDate) {
          params.append('fromDate', datacenterFromDate);
        }
        if (datacenterToDate) {
          params.append('toDate', datacenterToDate);
        }
        if (datacenterOrderStatus && datacenterOrderStatus !== 'ALL') {
          params.append('orderStatus', datacenterOrderStatus);
        }
        endpoint = `/admin/exports/orders?${params.toString()}`;
      }

      const { blob, filename } = await api.download(endpoint);

      // Create a transient download link and click it
      const downloadUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      tempLink.download = filename || `MENX_Export_${Date.now()}.${datacenterFormat}`;
      document.body.appendChild(tempLink);
      tempLink.click();
      tempLink.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportSuccessMessage(`Export ready! File "${filename}" downloaded successfully.`);
    } catch (err) {
      console.error('Export download error:', err);
      setExportErrorMessage(err.message || 'Export failed. Please verify your parameters and try again.');
    } finally {
      setExportingData(false);
    }
  };

  // 1. Fetch Overview stats in parallel
  async function loadOverviewStats() {
    setLoadingStats(true);
    try {
      const promises = [api.get('/products?limit=1')];
      if (hasOrderRole) {
        promises.push(api.get('/admin/orders?limit=1'));
        promises.push(api.get('/admin/returns?limit=1&status=REQUESTED'));
      }
      if (hasSupportRole) {
        promises.push(api.get('/admin/support/tickets?limit=1&status=OPEN').catch(() => ({ data: { pagination: { total: 0 } } })));
        promises.push(api.get('/admin/suggestions?limit=1&status=NEW').catch(() => ({ data: { pagination: { total: 0 } } })));
      }
      if (hasInventoryRole) {
        promises.push(api.get('/admin/inventory/low-stock?limit=1').catch(() => ({ data: { totalProducts: 0, totalVariants: 0 } })));
      }

      const results = await Promise.all(promises);
      const productsRes = results[0];
      setProductsCount(productsRes?.pagination?.total || productsRes?.data?.length || 0);

      let idx = 1;
      if (hasOrderRole) {
        const ordersRes = results[idx++];
        const returnsRes = results[idx++];
        if (ordersRes) setOrdersCount(ordersRes.data?.total || 0);
        if (returnsRes) setReturnsCount(returnsRes.data?.pagination?.total || returnsRes.data?.total || 0);
      }

      if (hasSupportRole) {
        const ticketsRes = results[idx++];
        const suggestionsRes = results[idx++];
        if (ticketsRes) setOpenTicketsCount(ticketsRes.data?.pagination?.total ?? ticketsRes.data?.total ?? 0);
        if (suggestionsRes) setNewSuggestionsCount(suggestionsRes.data?.pagination?.total ?? suggestionsRes.data?.total ?? 0);
      }

      if (hasInventoryRole) {
        const lowStockRes = results[idx++];
        if (lowStockRes?.data) {
          const count = lowStockRes.data.totalProducts ?? lowStockRes.data.total ?? (Array.isArray(lowStockRes.data.products) ? lowStockRes.data.products.length : (Array.isArray(lowStockRes.data) ? lowStockRes.data.length : 0));
          setLowStockCount(Number(count) || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load overview metrics:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }

  const catalogMetadataLoadedRef = React.useRef(false);

  // Load static metadata lists on demand
  async function loadCatalogMetadata(forceRefresh = false) {
    if (!hasInventoryRole) return;
    if (catalogMetadataLoadedRef.current && !forceRefresh && categories.length > 0) return;
    try {
      if (forceRefresh) {
        invalidateMetadataCache();
      }
      const [catRes, subRes, brandRes, sizeRes, colorRes] = await Promise.all([
        api.get('/admin/categories'),
        getCachedSubcategories(forceRefresh),
        getCachedBrands(forceRefresh),
        getCachedSizes(forceRefresh),
        getCachedColors(forceRefresh)
      ]);
      setCategories(catRes.data || []);
      setSubcategories(subRes || []);
      setBrands(brandRes || []);
      setSizes(sizeRes || []);
      setColors(colorRes || []);
      catalogMetadataLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load catalog metadata lists:', err.message);
    }
  }

  // 1. Fetch Overview stats strictly when on overview tab
  useEffect(() => {
    if (isAuthenticated && activeTab === 'overview') {
      loadOverviewStats();
    }
  }, [isAuthenticated, user?.id, user?.role, activeTab]);

  // Load catalog metadata lazily when catalog/categories tabs or related modals are accessed
  useEffect(() => {
    if (activeTab === 'catalog' || activeTab === 'categories' || showProductModal || showCategoryModal || showVariantsModal) {
      loadCatalogMetadata();
    }
  }, [activeTab, showProductModal, showCategoryModal, showVariantsModal]);

  // 2. Fetch Orders
  async function fetchOrdersList() {
    if (!hasOrderRole) return;
    const reqId = ++ordersReqId.current;
    setLoadingOrders(true);
    try {
      const query = `/admin/orders?page=${orderPage}&limit=8${orderStatusFilter ? `&status=${orderStatusFilter}` : ''}${orderSearch ? `&search=${orderSearch}` : ''}`;
      const res = await api.get(query);
      if (reqId !== ordersReqId.current) return;
      setOrders(res.data?.orders || []);
      setOrdersTotal(res.data?.total || 0);
    } catch (err) {
      if (reqId !== ordersReqId.current) return;
      console.error('Failed to fetch admin orders list:', err.message);
    } finally {
      if (reqId === ordersReqId.current) {
        setLoadingOrders(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrdersList();
    }
  }, [activeTab, orderPage, orderStatusFilter, orderSearch]);

  useEffect(() => {
    if (activeTab === 'datacenter') {
      fetchDatacenterSummary();
    }
  }, [activeTab]);

  // 3. Fetch Returns
  async function fetchReturnsList() {
    if (!hasOrderRole) return;
    const reqId = ++returnsReqId.current;
    setLoadingReturns(true);
    try {
      const query = `/admin/returns?page=${returnPage}&limit=8${returnStatusFilter ? `&status=${returnStatusFilter}` : ''}${returnSearch ? `&search=${returnSearch}` : ''}`;
      const res = await api.get(query);
      if (reqId !== returnsReqId.current) return;
      setReturns(res.data?.returns || []);
      setReturnsTotal(res.data?.pagination?.total || res.data?.total || 0);
    } catch (err) {
      if (reqId !== returnsReqId.current) return;
      console.error('Failed to fetch admin returns list:', err.message);
    } finally {
      if (reqId === returnsReqId.current) {
        setLoadingReturns(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'returns') {
      fetchReturnsList();
    }
  }, [activeTab, returnPage, returnStatusFilter, returnSearch]);

  // 4. Fetch Low Stock
  async function fetchLowStockList() {
    if (!hasInventoryRole) return;
    const reqId = ++lowStockReqId.current;
    setLoadingLowStock(true);
    setLowStockError(null);
    try {
      const searchParam = lowStockSearch?.trim() ? `&search=${encodeURIComponent(lowStockSearch.trim())}` : '';
      const res = await api.get(`/admin/inventory/low-stock?page=${lowStockPage}&limit=10${searchParam}`);
      if (reqId !== lowStockReqId.current) return;

      let rawProducts = [];
      let totalProdCount = 0;
      let totalVarCount = 0;

      if (res?.data) {
        if (Array.isArray(res.data.products)) {
          // Canonical grouped format from backend
          rawProducts = res.data.products;
          totalProdCount = res.data.totalProducts ?? res.data.total ?? res.meta?.total ?? rawProducts.length;
          totalVarCount = res.data.totalVariants ?? res.data.totalLowStockVariants ?? 0;
        } else if (Array.isArray(res.data.items)) {
          rawProducts = groupLowStockVariantsByProduct(res.data.items);
          totalProdCount = res.data.totalProducts ?? res.data.total ?? rawProducts.length;
          totalVarCount = res.data.items.length;
        } else if (Array.isArray(res.data)) {
          if (res.data.length > 0 && Array.isArray(res.data[0]?.variants)) {
            rawProducts = res.data;
          } else {
            rawProducts = groupLowStockVariantsByProduct(res.data);
          }
          totalProdCount = rawProducts.length;
          totalVarCount = rawProducts.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
        }
      } else if (Array.isArray(res)) {
        rawProducts = groupLowStockVariantsByProduct(res);
        totalProdCount = rawProducts.length;
        totalVarCount = rawProducts.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
      }

      const normalizedList = Array.isArray(rawProducts) ? rawProducts : [];
      setLowStockProducts(normalizedList);
      setLowStockTotal(Number(totalProdCount) || normalizedList.length);
      setLowStockVariantTotal(Number(totalVarCount) || normalizedList.reduce((acc, p) => acc + (p.variants?.length || 0), 0));
      setLowStockCount(Number(totalProdCount) || normalizedList.length);
    } catch (err) {
      if (reqId !== lowStockReqId.current) return;
      console.error('Failed to fetch low stock items:', err.message);
      setLowStockError(err.message || 'Failed to retrieve low stock alerts');
      setLowStockProducts([]);
    } finally {
      if (reqId === lowStockReqId.current) {
        setLoadingLowStock(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'low-stock') {
      fetchLowStockList();
    }
  }, [activeTab, lowStockPage, lowStockSearch]);

  // 5. Fetch Product Catalog
  async function fetchCatalogList() {
    if (!hasInventoryRole) return;
    const reqId = ++catalogReqId.current;
    setLoadingCatalog(true);
    try {
      const query = `/products?status=ALL&page=${catalogPage}&limit=8${catalogSearch ? `&search=${catalogSearch}` : ''}`;
      const res = await api.get(query);
      if (reqId !== catalogReqId.current) return;
      setCatalogProducts(res.data || []);
      setCatalogTotal(res.meta?.total ?? res.pagination?.total ?? res.data?.length ?? 0);
    } catch (err) {
      if (reqId !== catalogReqId.current) return;
      console.error('Failed to fetch catalog products:', err.message);
    } finally {
      if (reqId === catalogReqId.current) {
        setLoadingCatalog(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalogList();
    }
  }, [activeTab, catalogPage, catalogSearch]);

  // Debounce search input for customers
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch);
    }, 400);
    return () => clearTimeout(handler);
  }, [customerSearch]);

  // Fetch Customers
  async function fetchCustomersList() {
    const reqId = ++customersReqId.current;
    setLoadingCustomers(true);
    try {
      const query = `/admin/customers?page=${customerPage}&limit=10${debouncedCustomerSearch ? `&search=${debouncedCustomerSearch}` : ''}`;
      const res = await api.get(query);
      if (reqId !== customersReqId.current) return;
      setCustomers(res.data?.customers || []);
      setCustomersTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      if (reqId !== customersReqId.current) return;
      console.error('Failed to fetch admin customers list:', err.message);
    } finally {
      if (reqId === customersReqId.current) {
        setLoadingCustomers(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomersList();
    }
  }, [activeTab, customerPage, debouncedCustomerSearch]);

  // Fetch Customer Details
  async function fetchCustomerDetails(customerId) {
    setLoadingCustomerDetails(true);
    setCustomerDetailsError(null);
    try {
      const res = await api.get(`/admin/customers/${customerId}`);
      setSelectedCustomerDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch customer details:', err.message);
      setCustomerDetailsError(err.response?.data?.message || err.message || 'Failed to load details');
    } finally {
      setLoadingCustomerDetails(false);
    }
  }

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer.id);
    } else {
      setSelectedCustomerDetails(null);
      setCustomerDetailsError(null);
    }
  }, [selectedCustomer]);

  // Debounce search input for support tickets
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSupportSearch(supportSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [supportSearch]);

  // Debounce search input for suggestions
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSuggestionSearch(suggestionSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [suggestionSearch]);

  // Fetch Support Tickets
  async function fetchSupportTicketsList() {
    if (!hasSupportRole) return;
    const reqId = ++supportReqId.current;
    setLoadingSupportTickets(true);
    try {
      const query = `/admin/support/tickets?page=${supportTicketPage}&limit=10${supportStatusFilter ? `&status=${supportStatusFilter}` : ''}${supportCategoryFilter ? `&category=${supportCategoryFilter}` : ''}${debouncedSupportSearch ? `&search=${encodeURIComponent(debouncedSupportSearch)}` : ''}`;
      const res = await api.get(query);
      if (reqId !== supportReqId.current) return;
      setSupportTickets(res.data?.tickets || []);
      setSupportTicketsTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      if (reqId !== supportReqId.current) return;
      console.error('Failed to fetch admin support tickets:', err.message);
    } finally {
      if (reqId === supportReqId.current) {
        setLoadingSupportTickets(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'support') {
      fetchSupportTicketsList();
    }
  }, [activeTab, supportTicketPage, supportStatusFilter, supportCategoryFilter, debouncedSupportSearch]);

  // Fetch Suggestions
  async function fetchSuggestionsList() {
    if (!hasSupportRole) return;
    const reqId = ++suggestionsReqId.current;
    setLoadingSuggestions(true);
    try {
      const query = `/admin/suggestions?page=${suggestionPage}&limit=10${suggestionStatusFilter ? `&status=${suggestionStatusFilter}` : ''}${debouncedSuggestionSearch ? `&search=${encodeURIComponent(debouncedSuggestionSearch)}` : ''}`;
      const res = await api.get(query);
      if (reqId !== suggestionsReqId.current) return;
      setSuggestions(res.data?.suggestions || []);
      setSuggestionsTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      if (reqId !== suggestionsReqId.current) return;
      console.error('Failed to fetch admin suggestions:', err.message);
    } finally {
      if (reqId === suggestionsReqId.current) {
        setLoadingSuggestions(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'suggestions') {
      fetchSuggestionsList();
    }
  }, [activeTab, suggestionPage, suggestionStatusFilter, debouncedSuggestionSearch]);

  // Debounce search input for delivery PIN codes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedDeliveryZonesSearch(deliveryZonesSearch);
    }, 350);
    return () => clearTimeout(handler);
  }, [deliveryZonesSearch]);

  // Fetch Delivery Zones
  async function fetchDeliveryZonesList() {
    if (!hasDeliveryPinRole) return;
    const reqId = ++deliveryZonesReqId.current;
    setLoadingDeliveryZones(true);
    setDeliveryZonesError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', deliveryZonesPage);
      params.append('limit', 25);
      if (debouncedDeliveryZonesSearch && debouncedDeliveryZonesSearch.trim()) {
        params.append('search', debouncedDeliveryZonesSearch.trim());
      }
      if (deliveryZonesStatusFilter && deliveryZonesStatusFilter !== 'ALL') {
        params.append('status', deliveryZonesStatusFilter);
      }
      if (deliveryZonesStateFilter && deliveryZonesStateFilter.trim()) {
        params.append('state', deliveryZonesStateFilter.trim());
      }

      const res = await api.get(`/admin/delivery-zones?${params.toString()}`);
      if (reqId !== deliveryZonesReqId.current) return;
      if (res?.data) {
        setDeliveryZones(res.data.zones || []);
        setDeliveryZonesTotal(res.data.pagination?.total || 0);
        if (res.data.summary) {
          setDeliveryZonesActiveCount(res.data.summary.activeCount || 0);
          setDeliveryZonesInactiveCount(res.data.summary.inactiveCount || 0);
        }
      }
    } catch (err) {
      if (reqId !== deliveryZonesReqId.current) return;
      console.error('Failed to fetch delivery zones:', err);
      setDeliveryZonesError(err.response?.data?.message || err.message || 'Failed to load delivery PIN codes');
    } finally {
      if (reqId === deliveryZonesReqId.current) {
        setLoadingDeliveryZones(false);
      }
    }
  }

  useEffect(() => {
    if (activeTab === 'delivery-pincodes') {
      fetchDeliveryZonesList();
    }
  }, [activeTab, deliveryZonesPage, deliveryZonesStatusFilter, deliveryZonesStateFilter, debouncedDeliveryZonesSearch]);

  // Toggle Active / Inactive status for a PIN
  const handleToggleZoneStatus = async (zone) => {
    if (!zone || togglingZoneId) return;
    setTogglingZoneId(zone.id);
    setDeliveryZoneActionError(null);
    setDeliveryZoneActionSuccess(null);

    const newStatus = !zone.isActive;
    try {
      const res = await api.patch(`/admin/delivery-zones/${zone.id}/status`, {
        isActive: newStatus
      });
      if (res?.data) {
        setDeliveryZones(prev => prev.map(z => z.id === zone.id ? { ...z, isActive: newStatus } : z));
        // Update summary counts locally for instant feedback
        setDeliveryZonesActiveCount(prev => newStatus ? prev + 1 : Math.max(0, prev - 1));
        setDeliveryZonesInactiveCount(prev => newStatus ? Math.max(0, prev - 1) : prev + 1);
        setDeliveryZoneActionSuccess(`PIN ${zone.pincode} successfully ${newStatus ? 'activated' : 'deactivated'}.`);
        setTimeout(() => setDeliveryZoneActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Failed to update PIN status:', err);
      setDeliveryZoneActionError(err.response?.data?.message || err.message || 'Failed to update PIN status');
    } finally {
      setTogglingZoneId(null);
    }
  };

  // Delete a PIN zone
  const handleDeleteZone = async (zone) => {
    if (!zone || deletingZoneId) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete PIN code "${zone.pincode}" (${zone.district || zone.state})?\n\nThis will remove it from the delivery zones list.`);
    if (!confirmDelete) return;

    setDeletingZoneId(zone.id);
    setDeliveryZoneActionError(null);
    setDeliveryZoneActionSuccess(null);

    try {
      await api.delete(`/admin/delivery-zones/${zone.id}`);
      setDeliveryZones(prev => prev.filter(z => z.id !== zone.id));
      setDeliveryZonesTotal(prev => Math.max(0, prev - 1));
      if (zone.isActive) {
        setDeliveryZonesActiveCount(prev => Math.max(0, prev - 1));
      } else {
        setDeliveryZonesInactiveCount(prev => Math.max(0, prev - 1));
      }
      setDeliveryZoneActionSuccess(`PIN ${zone.pincode} successfully removed.`);
      setTimeout(() => setDeliveryZoneActionSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to delete PIN code:', err);
      setDeliveryZoneActionError(err.response?.data?.message || err.message || 'Failed to delete PIN code');
    } finally {
      setDeletingZoneId(null);
    }
  };

  // Create / Add New PIN Code
  const handleCreatePin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPinFormError(null);

    const cleanPin = (pinForm.pincode || '').trim();
    if (!cleanPin) {
      setPinFormError('PIN code is required.');
      return;
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      setPinFormError('PIN code must be exactly 6 numeric digits (e.g., 534340).');
      return;
    }
    if (!pinForm.state || !pinForm.state.trim()) {
      setPinFormError('State is required.');
      return;
    }

    setSavingPin(true);
    try {
      const payload = {
        pincode: cleanPin,
        state: pinForm.state.trim(),
        district: pinForm.district ? pinForm.district.trim() : null,
        isActive: Boolean(pinForm.isActive),
        baseDeliveryCharge: parseFloat(pinForm.baseDeliveryCharge) || 20.00,
        estimatedDaysMin: parseInt(pinForm.estimatedDaysMin, 10) || 5,
        estimatedDaysMax: parseInt(pinForm.estimatedDaysMax, 10) || 9
      };

      const res = await api.post('/admin/delivery-zones', payload);
      const createdZone = res.data?.data || res.data;
      if (createdZone) {
        setDeliveryZones(prev => [createdZone, ...prev]);
        setDeliveryZonesTotal(prev => prev + 1);
        if (createdZone.isActive) {
          setDeliveryZonesActiveCount(prev => prev + 1);
        } else {
          setDeliveryZonesInactiveCount(prev => prev + 1);
        }
        setShowAddPinModal(false);
        setPinForm({
          pincode: '',
          state: 'Andhra Pradesh',
          district: '',
          isActive: true,
          baseDeliveryCharge: '20.00',
          estimatedDaysMin: 5,
          estimatedDaysMax: 9
        });
        setDeliveryZoneActionSuccess(`Delivery PIN ${cleanPin} added successfully.`);
        setTimeout(() => setDeliveryZoneActionSuccess(null), 4000);
        // Refresh listing
        fetchDeliveryZonesList();
      }
    } catch (err) {
      console.error('Failed to add PIN code:', err);
      setPinFormError(err.response?.data?.message || err.message || 'Failed to add PIN code');
    } finally {
      setSavingPin(false);
    }
  };

  // Open support ticket details modal
  const openSupportTicketModal = async (ticket) => {
    setSelectedSupportTicket(ticket);
    setSupportTicketReply('');
    setSupportReplyError(null);
    setSupportTransitionStatus(ticket.status || 'OPEN');
    setSupportTransitionNote('');
    setSupportStatusError(null);
    setLoadingSupportTicketDetails(true);

    try {
      const res = await api.get(`/admin/support/tickets/${ticket.id}`);
      setSelectedSupportTicket(res.data);
      setSupportTransitionStatus(res.data.status || 'OPEN');
    } catch (err) {
      console.error('Failed to fetch ticket details:', err.message);
    } finally {
      setLoadingSupportTicketDetails(false);
    }
  };

  // Send admin reply to customer ticket
  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!selectedSupportTicket || !supportTicketReply.trim()) return;

    setSendingSupportReply(true);
    setSupportReplyError(null);
    try {
      const res = await api.post(`/admin/support/tickets/${selectedSupportTicket.id}/reply`, {
        message: supportTicketReply.trim()
      });
      invalidateSupportCache();
      setSupportTicketReply('');
      // Refresh ticket details
      const detailRes = await api.get(`/admin/support/tickets/${selectedSupportTicket.id}`);
      setSelectedSupportTicket(detailRes.data);
      fetchSupportTicketsList();
    } catch (err) {
      console.error('Failed to send admin support reply:', err.message);
      setSupportReplyError(err.data?.message || err.message || 'Failed to send reply');
    } finally {
      setSendingSupportReply(false);
    }
  };

  // Update support ticket status
  const handleUpdateSupportTicketStatus = async (newStatus) => {
    if (!selectedSupportTicket || !newStatus) return;
    setUpdatingSupportTicketStatus(true);
    setSupportStatusError(null);
    try {
      await api.patch(`/admin/support/tickets/${selectedSupportTicket.id}/status`, {
        status: newStatus,
        note: supportTransitionNote.trim() || undefined
      });
      invalidateSupportCache();
      setSupportTransitionNote('');
      // Update local state immediately
      setSupportTickets(prev => prev.map(t => t.id === selectedSupportTicket.id ? { ...t, status: newStatus } : t));
      // Refresh ticket details & list
      const detailRes = await api.get(`/admin/support/tickets/${selectedSupportTicket.id}`);
      setSelectedSupportTicket(detailRes.data);
      setSupportTransitionStatus(detailRes.data.status);
      fetchSupportTicketsList();
      loadOverviewStats();
    } catch (err) {
      console.error('Failed to update ticket status:', err.message);
      setSupportStatusError(err.data?.message || err.message || 'Failed to update status');
    } finally {
      setUpdatingSupportTicketStatus(false);
    }
  };

  // Open suggestion modal
  const openSuggestionModal = (sugg) => {
    setSelectedAdminSuggestion(sugg);
    setSuggestionStatusUpdate(sugg.status || 'NEW');
    setSuggestionAdminNote(sugg.admin_note || '');
    setSuggestionUpdateError(null);
  };

  // Save suggestion update
  const handleSaveSuggestion = async (e) => {
    e?.preventDefault();
    if (!selectedAdminSuggestion || updatingSuggestion) return;

    if (!suggestionStatusUpdate || !suggestionStatusUpdate.trim()) {
      setSuggestionUpdateError('Please select a valid Review Status.');
      return;
    }

    const VALID_SUGGESTION_STATUSES = ['NEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'REVIEWED', 'RESOLVED'];
    if (!VALID_SUGGESTION_STATUSES.includes(suggestionStatusUpdate)) {
      setSuggestionUpdateError('Invalid review status specified.');
      return;
    }

    setUpdatingSuggestion(true);
    setSuggestionUpdateError(null);
    try {
      const res = await api.patch(`/admin/suggestions/${selectedAdminSuggestion.id}`, {
        status: suggestionStatusUpdate,
        adminNote: suggestionAdminNote ? suggestionAdminNote.trim() : ''
      });

      const updatedData = res.data?.data || res.data;

      // 1. Immediately update item in local suggestions list state
      setSuggestions(prev => prev.map(s => s.id === selectedAdminSuggestion.id ? { ...s, ...updatedData } : s));

      // 2. Automatically close the modal on success
      setSelectedAdminSuggestion(null);

      // 3. Clear/reset modal form state
      setSuggestionStatusUpdate('NEW');
      setSuggestionAdminNote('');
      setSuggestionUpdateError(null);

      // 4. Background refresh of list and overview metrics
      fetchSuggestionsList();
      if (typeof loadOverviewStats === 'function') {
        loadOverviewStats();
      }
    } catch (err) {
      console.error('Failed to update suggestion:', err.message);
      // Keep modal open and display the actual error message
      setSuggestionUpdateError(
        err.response?.data?.message || err.data?.message || err.message || 'Failed to update suggestion status'
      );
    } finally {
      setUpdatingSuggestion(false);
    }
  };

  // Prevent background body scroll when any modal overlay is active
  useEffect(() => {
    if (
      showProductModal ||
      showVariantsModal ||
      showAdjustStockModal ||
      showImagesModal ||
      showDeleteProductModal ||
      showCategoryModal ||
      showDeleteCategoryModal ||
      selectedCustomer ||
      selectedOrder ||
      selectedReturn ||
      selectedSupportTicket ||
      selectedAdminSuggestion
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [
    showProductModal,
    showVariantsModal,
    showAdjustStockModal,
    showImagesModal,
    showDeleteProductModal,
    showCategoryModal,
    showDeleteCategoryModal,
    selectedCustomer,
    selectedOrder,
    selectedReturn,
    selectedSupportTicket,
    selectedAdminSuggestion
  ]);

  // Open Order Details Modal with authoritative fetching
  const openOrderDetailModal = async (order) => {
    if (!order) return;
    // Initial summary data to open modal immediately
    setSelectedOrder(order);
    setOrderDetailsError(null);
    setCodAmount('');
    setLoadingOrderDetails(true);

    if (!colors || colors.length === 0) {
      getCachedColors().then(cols => {
        if (Array.isArray(cols) && cols.length > 0) {
          setColors(cols);
        }
      }).catch(() => { });
    }

    try {
      const res = await api.get(`/admin/orders/${order.id}`);
      const orderData = res.data?.data || res.data?.order || res.data;
      if (orderData && typeof orderData === 'object') {
        setSelectedOrder(orderData);
      }
    } catch (err) {
      console.error('Failed to fetch order details:', err.message);
      setOrderDetailsError(err.response?.data?.message || err.message || 'Failed to load order details');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Handle Order Status transition
  const handleUpdateOrderStatus = async (status) => {
    if (!selectedOrder) return;
    setUpdatingOrderStatus(true);
    try {
      await api.patch(`/admin/orders/${selectedOrder.id}/status`, { status });
      // 1. Immediately update matching order in local state for instant UI update
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status } : o));
      // 2. Invalidate customer orders cache so customer view is synchronized
      invalidateOrdersCache();
      // 3. Re-fetch full order details so the modal displays updated state & line items
      const res = await api.get(`/admin/orders/${selectedOrder.id}`);
      const orderData = res.data?.data || res.data?.order || res.data;
      if (orderData && typeof orderData === 'object') {
        setSelectedOrder(orderData);
      }
      fetchOrdersList();
      fetchReturnsList();
      if (typeof loadOverviewStats === 'function') {
        loadOverviewStats();
      }
      alert('Order status transitioned successfully');
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  // Handle COD collection recording
  const handleRecordCod = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !codAmount) return;

    const amount = parseFloat(codAmount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid cash amount.');
      return;
    }

    setRecordingCod(true);
    try {
      await api.post(`/admin/orders/${selectedOrder.id}/cod-collection`, {
        amountCollected: amount
      });
      invalidateOrdersCache();
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, payment_status: 'PAID', paymentStatus: 'PAID' } : o));
      // Re-fetch full order details so the modal displays updated payment state
      const res = await api.get(`/admin/orders/${selectedOrder.id}`);
      const orderData = res.data?.data || res.data?.order || res.data;
      if (orderData && typeof orderData === 'object') {
        setSelectedOrder(orderData);
      }
      setCodAmount('');
      fetchOrdersList();
      if (typeof loadOverviewStats === 'function') {
        loadOverviewStats();
      }
      alert('Cash collection recorded successfully');
    } catch (err) {
      alert(err.message || 'Failed to record cash collection');
    } finally {
      setRecordingCod(false);
    }
  };

  // Open Return Details Modal with authoritative fetching
  const openReturnDetailModal = async (ret) => {
    if (!ret) return;
    // Initial summary data to open modal immediately
    setSelectedReturn(ret);
    setReturnDetailsError(null);
    setReturnTransitionStatus('');
    setReturnComment('');
    setLoadingReturnDetails(true);

    const initialConds = {};
    (ret.items || []).forEach(i => {
      initialConds[i.id] = i.condition_on_receipt || 'RESELLABLE';
    });
    setReturnItemsConditions(initialConds);

    try {
      const res = await api.get(`/admin/returns/${ret.id}`);
      const returnData = res.data?.data || res.data?.return || res.data;
      if (returnData && typeof returnData === 'object') {
        setSelectedReturn(returnData);
        const fetchedConds = {};
        (returnData.items || []).forEach(i => {
          fetchedConds[i.id] = i.condition_on_receipt || 'RESELLABLE';
        });
        setReturnItemsConditions(fetchedConds);
      }
    } catch (err) {
      console.error('Failed to fetch return details:', err.message);
      setReturnDetailsError(err.response?.data?.message || err.message || 'Failed to load return details');
    } finally {
      setLoadingReturnDetails(false);
    }
  };

  // Handle Return Status transition
  const handleUpdateReturnStatus = async (e) => {
    e.preventDefault();
    if (!selectedReturn || !returnTransitionStatus) return;

    const conditionsArray = [];
    if (['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus)) {
      const itemsList = selectedReturn.items || [];
      const missingConditions = itemsList.some(
        item => !returnItemsConditions[item.id]
      );

      if (missingConditions) {
        alert('Please specify the condition on receipt for all items.');
        return;
      }

      itemsList.forEach(item => {
        conditionsArray.push({
          returnItemId: item.id,
          condition: returnItemsConditions[item.id]
        });
      });
    }

    setUpdatingReturnStatus(true);
    try {
      await api.post(`/admin/returns/${selectedReturn.id}/status`, {
        status: returnTransitionStatus,
        comment: returnComment.trim() || null,
        itemsCondition: conditionsArray.length > 0 ? conditionsArray : null
      });

      invalidateOrdersCache();
      setReturns(prev => prev.map(r => r.id === selectedReturn.id ? { ...r, status: returnTransitionStatus } : r));

      // Re-fetch full return details so the modal displays updated status & history
      const res = await api.get(`/admin/returns/${selectedReturn.id}`);
      const returnData = res.data?.data || res.data?.return || res.data;
      if (returnData && typeof returnData === 'object') {
        setSelectedReturn(returnData);
      }
      setReturnTransitionStatus('');
      setReturnComment('');
      fetchReturnsList();
      if (typeof fetchOrdersList === 'function') {
        fetchOrdersList();
      }
      if (typeof loadOverviewStats === 'function') {
        loadOverviewStats();
      }
      alert('Return status transitioned successfully');
    } catch (err) {
      alert(err.message || 'Failed to transition return status');
    } finally {
      setUpdatingReturnStatus(false);
    }
  };

  // Product Catalog CRUD Mutators
  // Defensive Product Normalization for Form Modal
  const normalizeProductForForm = (prod) => {
    if (!prod) return {
      id: '',
      title: '',
      slug: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
      brandId: '',
      baseMrp: '',
      basePrice: '',
      material: '',
      careInstructions: '',
      tags: '',
      isFeatured: false,
      status: 'DRAFT'
    };

    // Category ID extraction (supports categoryId, category_id, category.id)
    const categoryId =
      prod.categoryId ||
      prod.category_id ||
      prod.category?.id ||
      '';

    // Subcategory ID extraction (supports subcategoryId, subcategory_id, subcategory.id)
    const subcategoryId =
      prod.subcategoryId ||
      prod.subcategory_id ||
      prod.subcategory?.id ||
      '';

    // Brand ID extraction (supports brandId, brand_id, brand.id)
    const brandId =
      prod.brandId ||
      prod.brand_id ||
      prod.brand?.id ||
      '';

    // Tags extraction (array to comma-separated string, or preserved string)
    let tags = '';
    if (Array.isArray(prod.tags)) {
      tags = prod.tags.join(', ');
    } else if (typeof prod.tags === 'string') {
      tags = prod.tags;
    }

    // Base MRP extraction (clean number/string for numeric input)
    let baseMrp = '';
    if (prod.baseMrp !== undefined && prod.baseMrp !== null && prod.baseMrp !== '') {
      baseMrp = prod.baseMrp;
    } else if (prod.base_mrp !== undefined && prod.base_mrp !== null && prod.base_mrp !== '') {
      baseMrp = prod.base_mrp;
    } else if (prod.price?.baseMrp !== undefined && prod.price?.baseMrp !== null) {
      baseMrp = prod.price.baseMrp;
    } else if (prod.price?.mrp !== undefined && prod.price?.mrp !== null) {
      baseMrp = prod.price.mrp;
    }

    // Base Price extraction
    let basePrice = '';
    if (prod.basePrice !== undefined && prod.basePrice !== null && prod.basePrice !== '') {
      basePrice = prod.basePrice;
    } else if (prod.base_price !== undefined && prod.base_price !== null && prod.base_price !== '') {
      basePrice = prod.base_price;
    } else if (prod.price?.basePrice !== undefined && prod.price?.basePrice !== null) {
      basePrice = prod.price.basePrice;
    } else if (prod.price?.sellingPrice !== undefined && prod.price?.sellingPrice !== null) {
      basePrice = prod.price.sellingPrice;
    }

    // Description extraction
    const description =
      prod.description ??
      prod.product_description ??
      prod.short_description ??
      '';

    // Material composition extraction
    const material =
      prod.material ??
      prod.material_composition ??
      prod.materialComposition ??
      '';

    // Care instructions extraction
    const careInstructions =
      prod.careInstructions ??
      prod.care_instructions ??
      prod.careInstruction ??
      '';

    // Featured boolean extraction
    const isFeatured = Boolean(
      prod.isFeatured ??
      prod.is_featured ??
      prod.featured ??
      false
    );

    // Status extraction
    const status = prod.status || 'DRAFT';

    return {
      id: prod.id || '',
      title: prod.title || '',
      slug: prod.slug || '',
      description,
      categoryId,
      subcategoryId,
      brandId,
      baseMrp: baseMrp !== '' ? String(baseMrp) : '',
      basePrice: basePrice !== '' ? String(basePrice) : '',
      material,
      careInstructions,
      tags,
      isFeatured,
      status
    };
  };

  // Product Catalog CRUD Mutators
  const openProductFormForCreate = () => {
    setProductFormError(null);
    setProductForm({
      id: '',
      title: '',
      slug: '',
      description: '',
      categoryId: '',
      subcategoryId: '',
      brandId: brands.length > 0 ? brands[0].id : '',
      baseMrp: '',
      basePrice: '',
      material: '',
      careInstructions: '',
      tags: '',
      isFeatured: false,
      status: 'DRAFT'
    });
    setShowProductModal(true);
  };

  const openProductFormForEdit = async (prod) => {
    setProductFormError(null);
    // 1. Ensure catalog metadata is loaded so dropdowns can match immediately
    if (categories.length === 0 || subcategories.length === 0 || brands.length === 0) {
      await loadCatalogMetadata();
    }

    // 2. Set form immediately with normalized product data from row
    const initialNormalized = normalizeProductForForm(prod);
    setProductForm(initialNormalized);
    setShowProductModal(true);

    // 3. Fetch detailed single product record by slug to ensure rich fields are fully loaded
    if (prod.slug) {
      try {
        const res = await api.get(`/products/${prod.slug}`);
        if (res.data) {
          const detailNormalized = normalizeProductForForm(res.data);
          setProductForm(prev => ({
            ...detailNormalized,
            id: detailNormalized.id || prev.id || prod.id,
            title: detailNormalized.title || prev.title,
            slug: detailNormalized.slug || prev.slug,
            status: detailNormalized.status || prev.status || prod.status || 'DRAFT'
          }));
        }
      } catch (err) {
        // Public /products/:slug may 404 for DRAFT/ARCHIVED products; row data already normalized
        console.warn('Could not fetch full product details by slug, using initial normalized row data');
      }
    }
  };

  const handleProductTitleChange = (title) => {
    // Auto-generate slug from title (alphanumeric and hyphens only)
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setProductForm(prev => ({ ...prev, title, slug }));
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setProductFormError(null);

    if (!productForm.title || !productForm.slug || !productForm.description || !productForm.categoryId || !productForm.subcategoryId || !productForm.baseMrp || !productForm.status) {
      setProductFormError('Please fill out all required fields marked with *.');
      return;
    }

    const mrp = parseFloat(productForm.baseMrp);
    const price = productForm.basePrice ? parseFloat(productForm.basePrice) : mrp;

    if (isNaN(mrp) || mrp <= 0) {
      setProductFormError('Base MRP must be a positive number.');
      return;
    }

    if (isNaN(price) || price <= 0) {
      setProductFormError('Base price must be a positive number.');
      return;
    }

    if (price > mrp) {
      setProductFormError('Base price cannot exceed base MRP.');
      return;
    }

    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
    if (!validStatuses.includes(productForm.status)) {
      setProductFormError('Invalid status. Please select DRAFT, PUBLISHED, or ARCHIVED.');
      return;
    }

    const tagsArray = typeof productForm.tags === 'string'
      ? productForm.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      : (productForm.tags || []);

    const payload = {
      title: productForm.title.trim(),
      slug: productForm.slug.trim(),
      description: productForm.description.trim(),
      categoryId: productForm.categoryId,
      subcategoryId: productForm.subcategoryId,
      brandId: productForm.brandId || null,
      baseMrp: mrp,
      basePrice: price,
      material: productForm.material ? productForm.material.trim() : null,
      careInstructions: productForm.careInstructions ? productForm.careInstructions.trim() : null,
      tags: tagsArray,
      isFeatured: Boolean(productForm.isFeatured),
      status: productForm.status
    };

    setSavingProduct(true);
    try {
      if (productForm.id) {
        const res = await api.patch(`/admin/products/${productForm.id}`, payload);
        const updatedProd = res.data?.data || res.data;
        // Invalidate product cache immediately
        invalidateProductCache(productForm.id);
        if (productForm.slug) invalidateProductCache(productForm.slug);
        if (updatedProd?.slug) invalidateProductCache(updatedProd.slug);

        // Optimistically update local catalog state
        setCatalogProducts(prev => prev.map(p => {
          if (p.id === productForm.id) {
            return {
              ...p,
              ...payload,
              ...(updatedProd && typeof updatedProd === 'object' ? updatedProd : {}),
              category: categories.find(c => c.id === payload.categoryId) || p.category,
              subcategory: subcategories.find(s => s.id === payload.subcategoryId) || p.subcategory,
              brand: brands.find(b => b.id === payload.brandId) || p.brand
            };
          }
          return p;
        }));
        alert('Product updated successfully');
      } else {
        const res = await api.post('/admin/products', payload);
        const createdProd = res.data?.data || res.data;
        if (createdProd && createdProd.id) {
          invalidateProductCache(createdProd.id);
          if (createdProd.slug) invalidateProductCache(createdProd.slug);
          setCatalogProducts(prev => [
            {
              ...createdProd,
              category: categories.find(c => c.id === payload.categoryId),
              subcategory: subcategories.find(s => s.id === payload.subcategoryId),
              brand: brands.find(b => b.id === payload.brandId),
              variants: []
            },
            ...prev
          ]);
          setCatalogTotal(prev => prev + 1);
        }
        alert('Product created successfully');
      }
      setShowProductModal(false);
      setProductFormError(null);
      fetchCatalogList();
      loadOverviewStats();
    } catch (err) {
      const errorMsg = err.data?.message || err.message || 'Failed to save product';
      setProductFormError(errorMsg);
      console.error('Product save error:', err);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleArchiveProduct = async (prodId) => {
    if (!window.confirm('Are you sure you want to archive this product? Archived products cannot be returned to draft/published directly.')) {
      return;
    }
    try {
      const res = await api.post(`/admin/products/${prodId}/archive`);
      const updated = res.data?.data || res.data;
      invalidateProductCache(prodId);
      setCatalogProducts(prev => prev.map(p => p.id === prodId ? { ...p, status: 'ARCHIVED', ...(updated && typeof updated === 'object' ? updated : {}) } : p));
      fetchCatalogList();
      loadOverviewStats();
      alert('Product archived successfully');
    } catch (err) {
      alert(err.message || 'Failed to archive product');
    }
  };

  // Product Delete Modal Handlers
  const openDeleteProductModal = (prod) => {
    setSelectedProductForDelete(prod);
    setDeleteProductError(null);
    setShowDeleteProductModal(true);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!selectedProductForDelete) return;
    setDeletingProduct(true);
    setDeleteProductError(null);
    try {
      await api.delete(`/admin/products/${selectedProductForDelete.id}`);
      invalidateProductCache(selectedProductForDelete.id);
      if (selectedProductForDelete.slug) invalidateProductCache(selectedProductForDelete.slug);
      setShowDeleteProductModal(false);
      setSelectedProductForDelete(null);
      setCatalogProducts(prev => prev.filter(p => p.id !== selectedProductForDelete.id));
      setCatalogTotal(prev => Math.max(0, prev - 1));
      fetchCatalogList();
      loadOverviewStats();
    } catch (err) {
      const errorMsg = err.data?.message || err.message || 'Failed to delete product.';
      setDeleteProductError(errorMsg);
    } finally {
      setDeletingProduct(false);
    }
  };

  // Category Management Handlers
  const openCategoryFormForCreate = () => {
    setCategoryForm({
      id: '',
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      displayOrder: categories.length,
      isActive: true
    });
    setCategoryFormError(null);
    setShowCategoryModal(true);
  };

  const openCategoryFormForEdit = (cat) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      imageUrl: cat.image_url || '',
      displayOrder: cat.display_order || 0,
      isActive: cat.is_active !== false
    });
    setCategoryFormError(null);
    setShowCategoryModal(true);
  };

  const handleCategoryNameChange = (val) => {
    const generatedSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setCategoryForm(prev => ({
      ...prev,
      name: val,
      slug: prev.id ? prev.slug : generatedSlug
    }));
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.slug.trim()) {
      setCategoryFormError('Category Name and Slug are required.');
      return;
    }
    setSavingCategory(true);
    setCategoryFormError(null);

    const payload = {
      name: categoryForm.name.trim(),
      slug: categoryForm.slug.trim(),
      description: categoryForm.description.trim() || null,
      imageUrl: categoryForm.imageUrl.trim() || null,
      displayOrder: parseInt(categoryForm.displayOrder, 10) || 0
    };

    try {
      let savedCategory = null;
      if (categoryForm.id) {
        const res = await api.patch(`/admin/categories/${categoryForm.id}`, {
          ...payload,
          isActive: categoryForm.isActive
        });
        savedCategory = res.data?.data || res.data;
        setCategories(prev => prev.map(c => c.id === categoryForm.id ? { ...c, ...payload, isActive: categoryForm.isActive, ...(savedCategory && typeof savedCategory === 'object' ? savedCategory : {}) } : c));
      } else {
        const res = await api.post('/admin/categories', payload);
        savedCategory = res.data?.data || res.data;
        if (savedCategory && savedCategory.id) {
          setCategories(prev => [...prev, savedCategory].sort((a, b) => (a.display_order ?? a.displayOrder ?? 0) - (b.display_order ?? b.displayOrder ?? 0)));
        }
      }
      invalidateMetadataCache('categories');
      setShowCategoryModal(false);
      loadCatalogMetadata(true);
    } catch (err) {
      setCategoryFormError(err.data?.message || err.message || 'Failed to save category');
    } finally {
      setSavingCategory(false);
    }
  };

  const openDeleteCategoryModal = (cat) => {
    setSelectedCategoryForDelete(cat);
    setDeleteCategoryError(null);
    setShowDeleteCategoryModal(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!selectedCategoryForDelete) return;
    setDeletingCategory(true);
    setDeleteCategoryError(null);
    try {
      await api.delete(`/admin/categories/${selectedCategoryForDelete.id}`);
      setCategories(prev => prev.filter(c => c.id !== selectedCategoryForDelete.id));
      invalidateMetadataCache('categories');
      setShowDeleteCategoryModal(false);
      setSelectedCategoryForDelete(null);
      loadCatalogMetadata(true);
    } catch (err) {
      const errorMsg = err.data?.message || err.message || 'Failed to delete category.';
      setDeleteCategoryError(errorMsg);
    } finally {
      setDeletingCategory(false);
    }
  };

  // Selected product's category & subcategory for variant management (memoized)
  const selectedVariantProductCategory = useMemo(() => {
    if (!selectedProductForVariants) return null;
    return categories.find(c =>
      c.id === (selectedProductForVariants?.categoryId || selectedProductForVariants?.category_id || selectedProductForVariants?.category?.id)
    ) || selectedProductForVariants?.category || selectedProductForVariants?.categories || null;
  }, [categories, selectedProductForVariants]);

  const selectedVariantProductSubcategory = useMemo(() => {
    if (!selectedProductForVariants) return null;
    return subcategories.find(s =>
      s.id === (selectedProductForVariants?.subcategoryId || selectedProductForVariants?.subcategory_id || selectedProductForVariants?.subcategory?.id)
    ) || selectedProductForVariants?.subcategory || null;
  }, [subcategories, selectedProductForVariants]);

  // Derived category size rule (memoized)
  const variantCategorySizeRule = useMemo(() =>
    getCategorySizeRule(selectedVariantProductCategory, selectedVariantProductSubcategory),
    [selectedVariantProductCategory, selectedVariantProductSubcategory]
  );

  // Derived filtered sizes according to product's category (memoized)
  const filteredVariantSizes = useMemo(() =>
    filterSizesForCategory(selectedVariantProductCategory, sizes, selectedVariantProductSubcategory),
    [selectedVariantProductCategory, sizes, selectedVariantProductSubcategory]
  );

  // Derived filtered colors (memoized)
  const filteredVariantColors = useMemo(() =>
    colors.filter(c =>
      !/-\d{10,}$/.test(c.name) &&
      !/\b1788\d{9}\b/.test(c.name)
    ),
    [colors]
  );

  // Auto-synchronize variant form sizeId and colorGroupColorId when filters update
  useEffect(() => {
    if (showVariantsModal && selectedProductForVariants && !variantForm.id) {
      if (filteredVariantSizes.length > 0) {
        const isCurrentSizeValid = filteredVariantSizes.some(s => s.id === variantForm.sizeId);
        if (!isCurrentSizeValid) {
          setVariantForm(prev => ({ ...prev, sizeId: filteredVariantSizes[0].id }));
        }
      } else {
        if (variantForm.sizeId !== '') {
          setVariantForm(prev => ({ ...prev, sizeId: '' }));
        }
      }

      if (filteredVariantColors.length > 0) {
        const isCurrentColorValid = filteredVariantColors.some(c => c.id === colorGroupColorId);
        if (!isCurrentColorValid) {
          setColorGroupColorId(filteredVariantColors[0].id);
        }
      } else if (colors.length > 0 && !colorGroupColorId) {
        setColorGroupColorId(colors[0].id);
      }
    }
  }, [showVariantsModal, selectedProductForVariants, sizes, filteredVariantSizes, filteredVariantColors, colors, variantForm.id, colorGroupColorId]);

  // Product Variants Manager
  const openVariantsModal = async (prod) => {
    if (!prod) return;
    setSelectedProductForVariants(prod);
    setShowVariantsModal(true);
    setLoadingVariants(true);
    setVariantsError(null);

    // Determine category-specific sizes for initial form state
    const prodCat = categories.find(c =>
      c.id === (prod.categoryId || prod.category_id || prod.category?.id)
    ) || prod.category || prod.categories;
    const prodSub = subcategories.find(s =>
      s.id === (prod.subcategoryId || prod.subcategory_id || prod.subcategory?.id)
    ) || prod.subcategory;

    const validSizes = filterSizesForCategory(prodCat, sizes, prodSub);
    const validColors = colors.filter(c =>
      !/-\d{10,}$/.test(c.name) &&
      !/\b1788\d{9}\b/.test(c.name)
    );

    const defaultSizeId = validSizes.length > 0 ? validSizes[0].id : '';
    const defaultColorId = validColors.length > 0 ? validColors[0].id : (colors.length > 0 ? colors[0].id : '');
    const safeSlug = (prod.slug || 'PROD').slice(0, 10).toUpperCase();

    setVariantForm({
      id: '',
      sizeId: defaultSizeId,
      colorId: defaultColorId,
      sku: `${safeSlug}-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      mrp: prod.baseMrp || prod.base_mrp || '',
      sellingPrice: prod.basePrice || prod.base_price || '',
      weightGrams: 300,
      lowStockThreshold: 5,
      initialStock: 0,
      isActive: true
    });

    // Initialize Color Group State
    setColorGroupColorId(defaultColorId);
    setColorGroupMrp(prod.baseMrp || prod.base_mrp || '');
    setColorGroupSellingPrice(prod.basePrice || prod.base_price || '');
    setColorGroupWeightGrams(300);
    setColorGroupLowStockThreshold(5);
    setColorGroupSizes({});
    setColorGroupProgress({ active: false, current: 0, total: 0, message: '' });
    setColorGroupStatus(null);

    try {
      const res = await api.get(`/products/${prod.id}/variants`);
      setVariants(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load variants:', err.message);
      setVariantsError(err.message || 'Failed to load product variants');
      setVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  const getVariantSizeLabel = (v) => {
    if (!v) return 'N/A';
    if (v.size && typeof v.size === 'object') return v.size.name || v.size.code || 'N/A';
    if (v.sizes && typeof v.sizes === 'object') return v.sizes.name || v.sizes.code || 'N/A';
    if (typeof v.size === 'string') return v.size;
    if (typeof v.sizeName === 'string') return v.sizeName;
    return 'N/A';
  };

  const getVariantColorLabel = (v) => {
    if (!v) return 'N/A';
    if (v.color && typeof v.color === 'object') return v.color.name || 'N/A';
    if (v.colors && typeof v.colors === 'object') return v.colors.name || 'N/A';
    if (typeof v.color === 'string') return v.color;
    if (typeof v.colorName === 'string') return v.colorName;
    return 'N/A';
  };

  const getVariantColorHex = (v) => {
    if (!v) return null;
    if (v.color && typeof v.color === 'object') return v.color.hex_code || v.color.hexCode || null;
    if (v.colors && typeof v.colors === 'object') return v.colors.hex_code || v.colors.hexCode || null;
    return null;
  };

  const handleCreateCustomColor = async ({ name, hexCode }) => {
    try {
      const res = await api.post('/admin/colors', {
        name,
        hexCode
      });
      const savedColor = res.data?.data || res.data;
      if (!savedColor || !savedColor.id) {
        throw new Error('Failed to create color');
      }

      // 1. Invalidate catalog metadata cache for colors
      invalidateMetadataCache('colors');

      // 2. Add/update in local colors state
      setColors(prev => {
        const exists = prev.some(c => c.id === savedColor.id || c.name.toLowerCase() === savedColor.name.toLowerCase());
        if (exists) {
          return prev.map(c => (c.id === savedColor.id || c.name.toLowerCase() === savedColor.name.toLowerCase()) ? savedColor : c);
        }
        return [...prev, savedColor].sort((a, b) => a.name.localeCompare(b.name));
      });

      // 3. Select this color in variant form and color group
      setColorGroupColorId(savedColor.id);
      setVariantForm(prev => ({ ...prev, colorId: savedColor.id }));

      return savedColor;
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to create color';
      console.error('Failed to create custom color:', msg);
      throw err;
    }
  };

  const generateVariantSku = (prod, colorName, sizeName) => {
    const safeSlug = (prod?.slug || 'PROD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase() || 'PROD';
    const cleanColor = (colorName || 'CLR')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() || 'CLR';
    const cleanSize = (sizeName || 'SZ')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase() || 'SZ';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${safeSlug}-${cleanColor}-${cleanSize}-${rand}`;
  };

  const generateVariantBarcode = () => {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(100 + Math.random() * 900);
    return `890${ts}${rand}`;
  };

  const isSizeExistingForColor = (sizeId, colorId) => {
    if (!colorId || !sizeId || !Array.isArray(variants)) return false;
    return variants.some(v => {
      const isAct = v.is_active !== undefined ? v.is_active : (v.isActive !== undefined ? v.isActive : true);
      if (!isAct) return false;
      const vSizeId = v.size?.id || v.sizeId || v.size_id || (typeof v.size === 'string' ? v.size : '');
      const vColorId = v.color?.id || v.colorId || v.color_id || (typeof v.color === 'string' ? v.color : '');
      return vSizeId === sizeId && vColorId === colorId;
    });
  };

  const handleToggleColorGroupSize = (sizeId) => {
    setColorGroupSizes(prev => {
      const current = prev[sizeId] || { selected: false, stock: 0 };
      return {
        ...prev,
        [sizeId]: {
          selected: !current.selected,
          stock: current.stock !== undefined && current.stock !== '' ? current.stock : 0
        }
      };
    });
  };

  const handleColorGroupStockChange = (sizeId, value) => {
    setColorGroupSizes(prev => {
      const current = prev[sizeId] || { selected: true, stock: 0 };
      return {
        ...prev,
        [sizeId]: {
          ...current,
          stock: value
        }
      };
    });
  };

  const handleSelectAllAvailableSizes = () => {
    const newSizes = { ...colorGroupSizes };
    filteredVariantSizes.forEach(s => {
      if (!isSizeExistingForColor(s.id, colorGroupColorId)) {
        newSizes[s.id] = {
          selected: true,
          stock: newSizes[s.id]?.stock !== undefined && newSizes[s.id]?.stock !== '' ? newSizes[s.id].stock : 0
        };
      }
    });
    setColorGroupSizes(newSizes);
  };

  const handleDeselectAllSizes = () => {
    setColorGroupSizes({});
  };

  const handleColorGroupSubmit = async (e) => {
    if (e) e.preventDefault();
    setColorGroupStatus(null);

    if (!colorGroupColorId) {
      alert('Please select a color shade.');
      return;
    }

    const mrp = parseFloat(colorGroupMrp);
    const sellingPrice = parseFloat(colorGroupSellingPrice);

    if (isNaN(mrp) || mrp <= 0) {
      alert('Please enter a valid MRP greater than 0.');
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      alert('Please enter a valid selling price greater than 0.');
      return;
    }

    if (sellingPrice > mrp) {
      alert('Selling price cannot exceed MRP.');
      return;
    }

    const selectedSizesList = filteredVariantSizes.filter(s =>
      !isSizeExistingForColor(s.id, colorGroupColorId) && colorGroupSizes[s.id]?.selected
    );

    if (selectedSizesList.length === 0) {
      alert('Please select at least one available size.');
      return;
    }

    // Validate stock values
    for (const s of selectedSizesList) {
      const stockVal = colorGroupSizes[s.id]?.stock;
      const stockNum = parseInt(stockVal, 10);
      if (stockVal === undefined || stockVal === null || stockVal === '' || isNaN(stockNum) || stockNum < 0) {
        alert(`Please enter a valid non-negative integer stock quantity for size ${s.name}.`);
        return;
      }
    }

    const selectedColorObj = colors.find(c => c.id === colorGroupColorId);
    const colorName = selectedColorObj?.name || 'Color';

    setCreatingColorGroup(true);
    setColorGroupProgress({
      active: true,
      current: 0,
      total: selectedSizesList.length,
      message: `Creating ${selectedSizesList.length} variants for ${colorName}...`
    });

    const bulkVariants = selectedSizesList.map(sizeObj => {
      const stockNum = parseInt(colorGroupSizes[sizeObj.id]?.stock, 10) || 0;
      const sku = generateVariantSku(selectedProductForVariants, colorName, sizeObj.name);
      const barcode = generateVariantBarcode();
      return {
        sizeId: sizeObj.id,
        colorId: colorGroupColorId,
        sku,
        barcode,
        mrp,
        sellingPrice,
        weightGrams: parseInt(colorGroupWeightGrams, 10) || 300,
        lowStockThreshold: parseInt(colorGroupLowStockThreshold, 10) || 5,
        initialStock: stockNum
      };
    });

    try {
      await api.post(`/admin/products/${selectedProductForVariants.id}/variants/bulk`, {
        variants: bulkVariants
      });
      setColorGroupStatus({
        type: 'success',
        text: `✓ Successfully created ${selectedSizesList.length} variant${selectedSizesList.length === 1 ? '' : 's'} for ${colorName} (${selectedSizesList.map(s => s.name).join(', ')}).`
      });
      // Clear size selections for next group
      setColorGroupSizes({});
    } catch (err) {
      const errMsg = err.data?.message || err.message || 'Failed to create variants';
      setColorGroupStatus({
        type: 'error',
        text: `Failed to create variants: ${errMsg}`
      });
    }

    // Reload variants list from server
    try {
      const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
      setVariants(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to reload variants:', err);
    }

    setCreatingColorGroup(false);
    setColorGroupProgress({ active: false, current: 0, total: 0, message: '' });
  };

  const handleVariantSubmit = async (e) => {
    e.preventDefault();
    if (!variantForm.sku || !variantForm.barcode || !variantForm.mrp || !variantForm.sellingPrice) {
      alert('Please fill out all required fields.');
      return;
    }

    if (!variantForm.id && !variantForm.sizeId) {
      alert('Please select a size option.');
      return;
    }

    if (!variantForm.id && !variantForm.colorId) {
      alert('Please select a color shade.');
      return;
    }

    const mrp = parseFloat(variantForm.mrp);
    const sellingPrice = parseFloat(variantForm.sellingPrice);

    if (isNaN(mrp) || mrp <= 0) {
      alert('Please enter a valid MRP greater than 0.');
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      alert('Please enter a valid selling price greater than 0.');
      return;
    }

    if (sellingPrice > mrp) {
      alert('Selling price cannot exceed MRP.');
      return;
    }

    const initialStockNum = parseInt(variantForm.initialStock, 10) || 0;
    if (isNaN(initialStockNum) || initialStockNum < 0) {
      alert('Initial stock must be a non-negative integer.');
      return;
    }

    const payload = {
      sku: variantForm.sku.trim(),
      barcode: variantForm.barcode.trim(),
      mrp,
      sellingPrice,
      weightGrams: parseInt(variantForm.weightGrams, 10) || 300,
      lowStockThreshold: parseInt(variantForm.lowStockThreshold, 10) || 5
    };

    setSavingVariant(true);
    try {
      if (variantForm.id) {
        // Edit variant (updates properties)
        await api.patch(`/admin/variants/${variantForm.id}`, {
          ...payload,
          isActive: variantForm.isActive
        });
        alert('Product variant updated successfully');
      } else {
        // Create new variant
        await api.post(`/admin/products/${selectedProductForVariants.id}/variants`, {
          ...payload,
          sizeId: variantForm.sizeId,
          colorId: variantForm.colorId,
          initialStock: initialStockNum
        });
        alert('Product variant created successfully');
      }

      if (selectedProductForVariants?.id) {
        invalidateProductCache(selectedProductForVariants.id);
        if (selectedProductForVariants.slug) invalidateProductCache(selectedProductForVariants.slug);
      }

      // Reload variants list
      const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
      setVariants(Array.isArray(res.data) ? res.data : []);
      fetchCatalogList();
      if (activeTab === 'low-stock') {
        fetchLowStockList();
      }
      loadOverviewStats();

      // Reset variant form
      const defaultSizeId = filteredVariantSizes.length > 0 ? filteredVariantSizes[0].id : '';
      const defaultColorId = filteredVariantColors.length > 0 ? filteredVariantColors[0].id : (colors.length > 0 ? colors[0].id : '');
      const safeSlug = (selectedProductForVariants.slug || 'PROD').slice(0, 10).toUpperCase();

      setVariantForm({
        id: '',
        sizeId: defaultSizeId,
        colorId: defaultColorId,
        sku: `${safeSlug}-${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        mrp: selectedProductForVariants.baseMrp || selectedProductForVariants.base_mrp || '',
        sellingPrice: selectedProductForVariants.basePrice || selectedProductForVariants.base_price || '',
        weightGrams: 300,
        lowStockThreshold: 5,
        initialStock: 0,
        isActive: true
      });
    } catch (err) {
      alert(err.message || 'Failed to save variant');
    } finally {
      setSavingVariant(false);
    }
  };

  const openAdjustStockModal = (variant) => {
    setSelectedVariantForAdjust(variant);
    setAdjustStockForm({
      quantity: 25,
      movementType: 'PURCHASE_RECEIPT',
      reason: 'Stock received'
    });
    setAdjustStockError(null);
    setShowAdjustStockModal(true);
  };

  const handleAdjustStockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVariantForAdjust || !selectedVariantForAdjust.id) return;
    const qty = parseInt(adjustStockForm.quantity, 10);
    if (isNaN(qty) || qty === 0) {
      setAdjustStockError('Please enter a non-zero integer quantity.');
      return;
    }

    setSavingStockAdjustment(true);
    setAdjustStockError(null);
    try {
      await api.post('/admin/inventory/adjust', {
        variantId: selectedVariantForAdjust.id,
        quantity: qty,
        movementType: adjustStockForm.movementType,
        reason: adjustStockForm.reason?.trim() || 'Manual stock adjustment'
      });

      if (selectedProductForVariants?.id) {
        invalidateProductCache(selectedProductForVariants.id);
        if (selectedProductForVariants.slug) invalidateProductCache(selectedProductForVariants.slug);
      }

      alert('Stock adjusted successfully');
      setShowAdjustStockModal(false);
      setSelectedVariantForAdjust(null);

      // Reload variants list to refresh stock counts
      if (selectedProductForVariants?.id) {
        const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
        setVariants(Array.isArray(res.data) ? res.data : []);
      }
      fetchLowStockList();
      loadOverviewStats();
      fetchCatalogList();
    } catch (err) {
      const errorMsg = err.data?.message || err.message || 'Failed to adjust stock';
      setAdjustStockError(errorMsg);
    } finally {
      setSavingStockAdjustment(false);
    }
  };

  const handleToggleVariantStatus = async (variant) => {
    if (!variant || !variant.id) return;
    const currentActive = variant.isActive !== undefined ? variant.isActive : (variant.is_active !== undefined ? variant.is_active : true);
    try {
      await api.patch(`/admin/variants/${variant.id}`, {
        isActive: !currentActive
      });
      if (selectedProductForVariants?.id) {
        invalidateProductCache(selectedProductForVariants.id);
        if (selectedProductForVariants.slug) invalidateProductCache(selectedProductForVariants.slug);
      }
      // Reload variants
      if (selectedProductForVariants?.id) {
        const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
        setVariants(Array.isArray(res.data) ? res.data : []);
      }
      fetchCatalogList();
      alert('Variant status updated');
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const fetchVariantInventory = async (variantId) => {
    if (!variantId) return;
    setLoadingEditInventory(true);
    setEditStockAdjustmentError(null);
    try {
      const res = await api.get(`/admin/inventory?variantId=${variantId}&limit=100`);
      const items = res.data?.items || res.data || [];
      setEditVariantInventory(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Failed to fetch variant inventory:', err.message);
      setEditVariantInventory([]);
    } finally {
      setLoadingEditInventory(false);
    }
  };

  const populateVariantFormForEdit = (v) => {
    if (!v) return;
    const sizeId = v.size?.id || v.sizeId || v.size_id || (typeof v.size === 'string' ? v.size : '') || '';
    const colorId = v.color?.id || v.colorId || v.color_id || (typeof v.color === 'string' ? v.color : '') || '';
    const isActive = v.isActive !== undefined ? v.isActive : (v.is_active !== undefined ? v.is_active : true);

    setVariantForm({
      id: v.id,
      sizeId,
      colorId,
      sku: v.sku || '',
      barcode: v.barcode || '',
      mrp: v.mrp ?? '',
      sellingPrice: v.sellingPrice ?? v.selling_price ?? '',
      weightGrams: v.weightGrams ?? v.weight_grams ?? 300,
      lowStockThreshold: v.lowStockThreshold ?? v.low_stock_threshold ?? 5,
      isActive
    });

    setEditStockAdjustment({
      quantity: 10,
      movementType: 'PURCHASE_RECEIPT',
      reason: 'Stock received'
    });
    setEditStockAdjustmentError(null);
    setEditStockAdjustmentSuccess(null);
    fetchVariantInventory(v.id);
  };

  const handleEditStockAdjustmentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!variantForm.id) return;
    const qty = parseInt(editStockAdjustment.quantity, 10);
    if (isNaN(qty) || qty === 0) {
      setEditStockAdjustmentError('Please enter a non-zero integer quantity.');
      return;
    }

    // Client-side negative stock safety check
    const currentAvailable = editVariantInventory[0]?.stock?.available ?? editVariantInventory[0]?.availableStock ?? editVariantInventory[0]?.quantity_available ?? editVariantInventory[0]?.quantityAvailable ?? 0;
    if (qty < 0 && (currentAvailable + qty < 0)) {
      setEditStockAdjustmentError(
        `Adjustment of ${qty} would result in negative available inventory. Current available: ${currentAvailable}`
      );
      return;
    }

    setSavingEditStockAdjustment(true);
    setEditStockAdjustmentError(null);
    setEditStockAdjustmentSuccess(null);
    try {
      await api.post('/admin/inventory/adjust', {
        variantId: variantForm.id,
        quantity: qty,
        movementType: editStockAdjustment.movementType || 'PURCHASE_RECEIPT',
        reason: editStockAdjustment.reason?.trim() || 'Manual stock adjustment'
      });

      if (selectedProductForVariants?.id) {
        invalidateProductCache(selectedProductForVariants.id);
        if (selectedProductForVariants.slug) invalidateProductCache(selectedProductForVariants.slug);
      }

      setEditStockAdjustmentSuccess(`Stock updated by ${qty > 0 ? '+' : ''}${qty} units successfully.`);

      // Refresh inventory breakdown for this variant
      await fetchVariantInventory(variantForm.id);

      // Refresh variants table on the left
      if (selectedProductForVariants?.id) {
        const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
        setVariants(Array.isArray(res.data) ? res.data : []);
      }
      fetchLowStockList();
      loadOverviewStats();
      fetchCatalogList();
    } catch (err) {
      const errorMsg = err.data?.message || err.message || 'Failed to adjust stock';
      setEditStockAdjustmentError(errorMsg);
    } finally {
      setSavingEditStockAdjustment(false);
    }
  };

  const handleImageFileChange = (file) => {
    if (!file) {
      setImageFile(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      return;
    }

    // 1. Size check: 2MB limit (2,097,152 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File size exceeds the 2MB limit (your file: ${(file.size / (1024 * 1024)).toFixed(2)}MB).`);
      return;
    }

    // 2. MIME type & extension check
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const extension = file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();

    if (!allowedMimes.includes(file.type) || !allowedExts.includes('.' + extension)) {
      alert("Unsupported file type. Please select a JPEG, PNG, or WEBP image.");
      return;
    }

    setImageFile(file);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  // Helper to map DB snake_case product_images to frontend camelCase
  const mapImagesToCamelCase = (data) => {
    return (data || []).map(img => ({
      id: img.id,
      productId: img.product_id || img.productId,
      variantId: img.variant_id || img.variantId,
      imageUrl: img.image_url || img.imageUrl,
      altText: img.alt_text || img.altText,
      displayOrder: img.display_order !== undefined ? img.display_order : img.displayOrder,
      isPrimary: img.is_primary !== undefined ? img.is_primary : img.isPrimary,
      createdAt: img.created_at || img.createdAt
    }));
  };

  // Memoized categories list for categories tab search
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categories;
    const lower = categorySearch.toLowerCase();
    return categories.filter(c => (c.name || '').toLowerCase().includes(lower));
  }, [categories, categorySearch]);

  // Product Images Manager
  const openImagesModal = async (prod) => {
    setSelectedProductForImages(prod);
    setShowImagesModal(true);
    setLoadingImages(true);
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setImageAltText('');
    setImageDisplayOrder('0');
    setImageIsPrimary(false);
    setImageVariantId('');
    setProductVariantsForImages([]);

    try {
      const [imagesRes, variantsRes] = await Promise.all([
        api.get(`/products/${prod.id}/images`),
        api.get(`/products/${prod.id}/variants`)
      ]);
      setImages(mapImagesToCamelCase(imagesRes.data || []));
      setProductVariantsForImages(variantsRes.data || []);
    } catch (err) {
      console.error('Failed to load images or variants:', err.message);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (!imageFile || !selectedProductForImages) {
      alert('Please select an image file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('altText', imageAltText.trim() || '');
    formData.append('displayOrder', imageDisplayOrder);
    formData.append('isPrimary', imageIsPrimary ? 'true' : 'false');
    if (imageVariantId && imageVariantId !== '') {
      formData.append('variantId', imageVariantId);
    }

    setUploadingImage(true);
    try {
      await api.post(`/admin/products/${selectedProductForImages.id}/images/upload`, formData);
      if (selectedProductForImages?.id) {
        invalidateProductCache(selectedProductForImages.id);
        if (selectedProductForImages.slug) invalidateProductCache(selectedProductForImages.slug);
      }
      alert('Product image uploaded successfully');

      // Reload images list
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
      fetchCatalogList();

      // Reset form
      setImageFile(null);
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
      setImageAltText('');
      setImageDisplayOrder('0');
      setImageIsPrimary(false);
      setImageVariantId('');
    } catch (err) {
      alert(err.message || 'Failed to upload product image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSetPrimaryImage = async (imageId) => {
    setSettingPrimaryImageId(imageId);
    try {
      await api.post(`/admin/images/${imageId}/primary`);
      if (selectedProductForImages?.id) {
        invalidateProductCache(selectedProductForImages.id);
        if (selectedProductForImages.slug) invalidateProductCache(selectedProductForImages.slug);
      }
      // Reload images
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
      fetchCatalogList();
      alert('Primary image updated');
    } catch (err) {
      alert(err.message || 'Failed to set primary image');
    } finally {
      setSettingPrimaryImageId(null);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this product image?')) {
      return;
    }
    setDeletingImageId(imageId);
    try {
      await api.delete(`/admin/images/${imageId}`);
      if (selectedProductForImages?.id) {
        invalidateProductCache(selectedProductForImages.id);
        if (selectedProductForImages.slug) invalidateProductCache(selectedProductForImages.slug);
      }
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
      fetchCatalogList();
      alert('Image deleted successfully');
    } catch (err) {
      alert(err.message || 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleMoveImageOrder = async (idx, direction) => {
    if (!images || images.length <= 1) return;

    // Copy images array - Standard displayOrder sort works since it is camelCase mapped
    const sorted = [...images].sort((a, b) => a.displayOrder - b.displayOrder);

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    setMovingImageId(sorted[idx].id);
    // Swap displayOrder values
    const tempOrder = sorted[idx].displayOrder;
    sorted[idx].displayOrder = sorted[targetIdx].displayOrder;
    sorted[targetIdx].displayOrder = tempOrder;

    const payloadArray = sorted.map(img => ({
      imageId: img.id,
      displayOrder: img.displayOrder
    }));

    try {
      await api.patch(`/admin/products/${selectedProductForImages.id}/images/reorder`, {
        images: payloadArray
      });
      if (selectedProductForImages?.id) {
        invalidateProductCache(selectedProductForImages.id);
        if (selectedProductForImages.slug) invalidateProductCache(selectedProductForImages.slug);
      }
      // Reload list
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
      fetchCatalogList();
    } catch (err) {
      alert(err.message || 'Failed to reorder images');
    } finally {
      setMovingImageId(null);
    }
  };

  // Status badges helpers
  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-menx-warning/10 border-menx-warning/20 text-menx-warning';
      case 'CONFIRMED': return 'bg-menx-info/10 border-menx-info/20 text-menx-info';
      case 'PACKED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'SHIPPED': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'OUT_FOR_DELIVERY': return 'bg-menx-primary/10 border-menx-primary/20 text-menx-primary';
      case 'DELIVERED': return 'bg-menx-success/10 border-menx-success/20 text-menx-success';
      case 'CANCELLED': return 'bg-menx-error/10 border-menx-error/20 text-menx-error';
      default: return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
    }
  };

  const getReturnStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED': return 'bg-menx-info/10 border-menx-info/20 text-menx-info';
      case 'APPROVED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'REJECTED': return 'bg-menx-error/10 border-menx-error/20 text-menx-error';
      case 'PICKUP_SCHEDULED': return 'bg-menx-warning/10 border-menx-warning/20 text-menx-warning';
      case 'RECEIVED_IN_STORE': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'COMPLETED': return 'bg-menx-success/10 border-menx-success/20 text-menx-success';
      case 'CANCELLED': return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
      default: return 'bg-gray-500/10 border-menx-border text-menx-text-secondary';
    }
  };

  const getValidOrderStatusTransitions = (currentStatus) => {
    const transitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PACKED', 'CANCELLED'],
      PACKED: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED_DELIVERY'],
      OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED_DELIVERY', 'CANCELLED'],
      FAILED_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      DELIVERED: ['RETURN_REQUESTED'],
      RETURN_REQUESTED: ['RETURNED'],
      RETURNED: [],
      CANCELLED: []
    };
    return transitions[currentStatus] || [];
  };

  const getValidReturnStatusTransitions = (currentStatus) => {
    const transitions = {
      REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['PICKUP_SCHEDULED', 'RECEIVED_IN_STORE', 'CANCELLED'],
      PICKUP_SCHEDULED: ['RECEIVED_IN_STORE', 'CANCELLED'],
      RECEIVED_IN_STORE: ['COMPLETED', 'REJECTED'],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: []
    };
    return transitions[currentStatus] || [];
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow space-y-8">

        {/* Control Panel Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-menx-border pb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-menx-primary" />
              <span>Admin Control Panel</span>
            </h1>
            <p className="text-sm text-menx-text-secondary mt-2">
              Authorized session for {user?.first_name} {user?.last_name || ''}.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-menx-primary/10 border border-menx-primary/20 text-menx-primary px-3 py-1.5 rounded-lg text-sm font-semibold self-start md:self-auto uppercase tracking-wide">
            <Shield className="w-4 h-4" />
            <span>Role: {user?.role}</span>
          </div>
        </div>

        {/* Dashboard Tabs Navigation Row */}
        <div className="flex border-b border-menx-border overflow-x-auto text-sm font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'overview' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
              }`}
          >
            Overview
          </button>

          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'catalog' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              Product Catalog
            </button>
          )}

          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'categories' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              Categories
            </button>
          )}



          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'orders' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              Fulfillment Orders
            </button>
          )}

          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'returns' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              Returns & Exchanges
            </button>
          )}

          {hasInventoryRole && (
            <button
              onClick={() => {
                setActiveTab('low-stock');
                setLowStockPage(1);
              }}
              className={`py-3 px-6 border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'low-stock' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              <span>Low Stock Warnings</span>
              {lowStockCount > 0 && (
                <span className="bg-menx-error/20 border border-menx-error/30 text-menx-error text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {lowStockCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab('customers');
              setCustomerPage(1);
            }}
            className={`py-3 px-6 border-b-2 transition-all ${activeTab === 'customers' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
              }`}
          >
            Customers
          </button>

          {hasSupportRole && (
            <button
              onClick={() => {
                setActiveTab('support');
                setSupportTicketPage(1);
              }}
              className={`py-3 px-6 border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'support' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              <span>Support Tickets</span>
              {openTicketsCount > 0 && (
                <span className="bg-menx-primary/20 border border-menx-primary/30 text-menx-primary text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {openTicketsCount}
                </span>
              )}
            </button>
          )}

          {hasSupportRole && (
            <button
              onClick={() => {
                setActiveTab('suggestions');
                setSuggestionPage(1);
              }}
              className={`py-3 px-6 border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'suggestions' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              <span>Feedback & Suggestions</span>
              {newSuggestionsCount > 0 && (
                <span className="bg-menx-primary/20 border border-menx-primary/30 text-menx-primary text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {newSuggestionsCount}
                </span>
              )}
            </button>
          )}

          {hasDataCenterRole && (
            <button
              onClick={() => {
                setActiveTab('datacenter');
                fetchDatacenterSummary();
              }}
              className={`py-3 px-6 border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'datacenter' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              <Database className="w-4 h-4 text-menx-primary" />
              <span>Data Center</span>
            </button>
          )}

          {hasDeliveryPinRole && (
            <button
              onClick={() => setActiveTab('delivery-pincodes')}
              className={`py-3 px-6 border-b-2 transition-all flex items-center space-x-2 ${activeTab === 'delivery-pincodes' ? 'border-menx-primary text-menx-primary bg-menx-primary/5' : 'border-transparent text-menx-text-secondary hover:text-white'
                }`}
            >
              <MapPin className="w-4 h-4 text-menx-primary" />
              <span>Delivery PIN Codes</span>
            </button>
          )}
        </div>

        {/* LOADING STATS */}
        {loadingStats ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
          </div>
        ) : (
          <div className="space-y-8">

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                  {/* Products Count */}
                  <div className="menx-card p-5 rounded-2xl flex items-center justify-between shadow-md">
                    <div className="space-y-1.5">
                      <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">Active Products</h3>
                      <div className="text-2xl font-black text-white">{productsCount}</div>
                    </div>
                    <div className="p-3 bg-menx-primary/10 text-menx-primary rounded-xl">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Low Stock Warnings */}
                  {hasInventoryRole && (
                    <div
                      onClick={() => {
                        setActiveTab('low-stock');
                        setLowStockPage(1);
                      }}
                      className="menx-card-interactive p-5 rounded-2xl flex items-center justify-between shadow-md cursor-pointer"
                    >
                      <div className="space-y-1.5">
                        <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">Low Stock Warnings</h3>
                        <div className={`text-2xl font-black ${lowStockCount > 0 ? 'text-menx-error' : 'text-menx-success'}`}>
                          {lowStockCount}
                        </div>
                      </div>
                      <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-menx-error/10 text-menx-error' : 'bg-menx-success/10 text-menx-success'}`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* Orders Total count */}
                  {hasOrderRole && (
                    <div className="menx-card p-5 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-1.5">
                        <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">Total Orders</h3>
                        <div className="text-2xl font-black text-white">{ordersCount}</div>
                      </div>
                      <div className="p-3 bg-menx-primary/10 text-menx-primary rounded-xl">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* Pending Returns count */}
                  {hasOrderRole && (
                    <div className="menx-card p-5 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-1.5">
                        <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">Requested Returns</h3>
                        <div className="text-2xl font-black text-white">{returnsCount}</div>
                      </div>
                      <div className="p-3 bg-menx-primary/10 text-menx-primary rounded-xl">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* Open Support Tickets */}
                  {hasSupportRole && (
                    <div className="menx-card p-5 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-1.5">
                        <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">Open Tickets</h3>
                        <div className="text-2xl font-black text-menx-primary">{openTicketsCount}</div>
                      </div>
                      <div className="p-3 bg-menx-primary/10 text-menx-primary rounded-xl">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                  {/* New Suggestions */}
                  {hasSupportRole && (
                    <div className="menx-card p-5 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-1.5">
                        <h3 className="text-menx-text-secondary text-[11px] font-bold uppercase tracking-wider">New Feedback</h3>
                        <div className="text-2xl font-black text-menx-info">{newSuggestionsCount}</div>
                      </div>
                      <div className="p-3 bg-menx-info/10 text-menx-info rounded-xl">
                        <Sparkles className="w-5 h-5" />
                      </div>
                    </div>
                  )}

                </div>

                {/* Sub-grid: Welcome info or simple shortcuts */}
                <div className="p-6 menx-card-elevated rounded-2xl text-center max-w-xl mx-auto space-y-4 shadow-md">
                  <Shield className="w-12 h-12 text-menx-primary mx-auto" />
                  <h3 className="text-lg font-bold text-white">Manager Fulfilment Center</h3>
                  <p className="text-sm text-menx-text-secondary leading-relaxed font-medium">
                    Use the tabs above to manage customer delivery operations, record Cash on Delivery collections, verify item-level receipt conditions for returns, and view real-time low-stock inventory warnings.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: PRODUCT CATALOG */}
            {activeTab === 'catalog' && hasInventoryRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-menx-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Product Catalog Management</h2>
                    <p className="text-xs text-menx-text-secondary mt-1">Manage brand products, active sizes/color variants, and gallery upload assets.</p>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={catalogSearch}
                        onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }}
                        placeholder="Search product title..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-2.5" />
                    </div>

                    <button
                      onClick={openProductFormForCreate}
                      className="inline-flex items-center space-x-1 py-2 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-[#0B0F14] font-extrabold rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </div>
                </div>

                {loadingCatalog ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-menx-primary"></div>
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="py-12 text-center text-menx-text-muted font-medium">
                    No products cataloged in database yet.
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-menx-text-secondary">
                        <thead className="bg-menx-surface-elevated text-menx-text-secondary uppercase text-xs font-bold tracking-wider border-b border-menx-border">
                          <tr>
                            <th className="py-3 px-4">Title / Slug</th>
                            <th className="py-3 px-4">Brand</th>
                            <th className="py-3 px-4 text-right">Base MRP</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-center">Featured</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {catalogProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-menx-surface-elevated/20 transition-all font-medium">
                              <td className="py-4 px-4">
                                <div className="text-white font-bold">{p.title}</div>
                                <div className="text-xs text-menx-text-muted font-mono">{p.slug}</div>
                              </td>
                              <td className="py-4 px-4 text-menx-text-secondary">
                                {p.brand?.name || p.brands?.name || 'Generic'}
                              </td>
                              <td className="py-4 px-4 text-right text-white font-mono font-bold">{formatCurrency(p.baseMrp ?? p.base_mrp ?? p.price?.baseMrp ?? p.price?.mrp ?? 0)}</td>
                              <td className="py-4 px-4 text-center text-xs">
                                <span className={`px-2 py-0.5 rounded border ${p.status === 'PUBLISHED' ? 'bg-menx-success/10 border-menx-success/20 text-menx-success' :
                                  p.status === 'ARCHIVED' ? 'bg-menx-error/10 border-menx-error/20 text-menx-error' :
                                    'bg-menx-warning/10 border-menx-warning/20 text-menx-warning'
                                  }`}>
                                  {p.status || 'DRAFT'}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center text-xs">
                                {p.isFeatured || p.is_featured || p.featured ? (
                                  <span className="text-menx-primary bg-menx-primary/10 border border-menx-primary/20 px-2 py-0.5 rounded">YES</span>
                                ) : (
                                  <span className="text-menx-text-muted">NO</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => openProductFormForEdit(p)}
                                    className="px-2.5 py-1 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded text-xs font-bold text-menx-primary"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openVariantsModal(p)}
                                    className="px-2.5 py-1 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded text-xs font-bold text-indigo-400"
                                  >
                                    Sizes
                                  </button>
                                  <button
                                    onClick={() => openImagesModal(p)}
                                    className="px-2.5 py-1 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded text-xs font-bold text-purple-400"
                                  >
                                    Images
                                  </button>
                                  {p.status !== 'ARCHIVED' && (
                                    <button
                                      onClick={() => handleArchiveProduct(p.id)}
                                      className="px-2.5 py-1 bg-menx-primary/10 hover:bg-menx-primary/20 text-menx-primary border border-menx-primary/20 rounded text-xs font-bold"
                                    >
                                      Archive
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openDeleteProductModal(p)}
                                    className="px-2.5 py-1 bg-red-600/10 hover:bg-red-600 text-menx-error hover:text-white border border-menx-error/20 rounded text-xs font-bold transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                      <span className="text-menx-text-muted font-medium">
                        Showing {catalogProducts.length} of {catalogTotal} products
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={catalogPage === 1}
                          onClick={() => setCatalogPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={catalogPage * 8 >= catalogTotal}
                          onClick={() => setCatalogPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: CATEGORIES */}
            {activeTab === 'categories' && hasInventoryRole && (
              <div className="menx-card rounded-2xl overflow-hidden shadow-md p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-menx-border pb-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Category Management</h2>
                    <p className="text-xs text-menx-text-secondary mt-1">Manage catalog categories, taxonomy display order, and active statuses.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className="w-full bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-2.5" />
                    </div>
                    <button
                      onClick={openCategoryFormForCreate}
                      className="inline-flex items-center space-x-1 py-2 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-[#0B0F14] font-extrabold rounded-lg transition-colors text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Category</span>
                    </button>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="py-12 text-center text-menx-text-muted font-medium text-sm">
                    No categories registered in database.
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-menx-text-secondary">
                        <thead className="bg-menx-surface-elevated text-menx-text-secondary uppercase text-xs font-bold tracking-wider border-b border-menx-border">
                          <tr>
                            <th className="py-3 px-4">Name / Slug</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-center">Display Order</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {filteredCategories.map((cat) => (
                              <tr key={cat.id} className="hover:bg-menx-surface-elevated/20 transition-all font-medium">
                                <td className="py-4 px-4">
                                  <div className="flex items-center space-x-3">
                                    {cat.image_url ? (
                                      <img src={cat.image_url} alt={cat.name} className="w-8 h-8 rounded-lg object-cover bg-menx-surface-elevated" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-menx-surface-elevated flex items-center justify-center text-menx-primary font-bold text-xs">
                                        {cat.name.charAt(0)}
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-white font-bold">{cat.name}</div>
                                      <div className="text-xs text-menx-text-muted font-mono">{cat.slug}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-xs text-menx-text-secondary max-w-xs truncate">
                                  {cat.description || 'No description provided.'}
                                </td>
                                <td className="py-4 px-4 text-center text-white font-mono font-bold">
                                  {cat.displayOrder ?? cat.display_order ?? 0}
                                </td>
                                <td className="py-4 px-4 text-center text-xs">
                                  <span className={`px-2 py-0.5 rounded border ${(cat.isActive ?? cat.is_active) ? 'bg-menx-success/10 border-menx-success/20 text-menx-success' : 'bg-menx-error/10 border-menx-error/20 text-menx-error'}`}>
                                    {(cat.isActive ?? cat.is_active) ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => openCategoryFormForEdit(cat)}
                                      className="px-2.5 py-1 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded text-xs font-bold text-menx-primary"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => openDeleteCategoryModal(cat)}
                                      className="px-2.5 py-1 bg-red-600/10 hover:bg-red-600 text-menx-error hover:text-white border border-menx-error/20 rounded text-xs font-bold transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* TAB: ORDERS */}
            {activeTab === 'orders' && hasOrderRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-menx-border pb-4">
                  <h2 className="text-lg font-bold text-white">Fulfillment Orders</h2>

                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">

                    {/* Status filter */}
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-lg p-2.5 text-white font-bold text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PACKED">Packed</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="RETURN_REQUESTED">Return Requested</option>
                      <option value="RETURNED">Returned</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                        placeholder="Search by Order # or Phone..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingOrders ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-menx-primary"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center text-menx-text-muted font-medium">
                    No orders matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-menx-text-secondary">
                        <thead className="bg-menx-bg text-menx-text-secondary uppercase text-xs font-bold tracking-wider border-b border-menx-border">
                          <tr>
                            <th className="py-3 px-4">Order #</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Payment</th>
                            <th className="py-3 px-4 text-right">Total Payable</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {orders.map((o) => (
                            <tr key={o.id} className="hover:bg-menx-surface-elevated/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-menx-primary">{o.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white">
                                  {o.customer ? `${o.customer.first_name} ${o.customer.last_name || ''}` : 'Guest'}
                                </div>
                                <div className="text-[11px] text-menx-text-muted font-mono">{o.customer_phone}</div>
                              </td>
                              <td className="py-4 px-4 text-xs text-menx-text-secondary">
                                {new Date(o.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getOrderStatusBadge(o.order_status)}`}>
                                  {o.order_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className="bg-menx-surface-elevated text-menx-text-secondary px-2 py-0.5 rounded border border-menx-border uppercase font-bold text-[9px]">
                                  {o.payment_method} - {o.payment_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right text-white font-black">{formatCurrency(o.total_payable)}</td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => openOrderDetailModal(o)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-menx-surface-elevated hover:bg-menx-border border border-menx-border rounded-lg text-xs font-bold text-menx-primary transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination buttons */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                      <span className="text-menx-text-muted font-medium">
                        Showing {orders.length} of {ordersTotal} orders
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={orderPage === 1}
                          onClick={() => setOrderPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-gray-705 border border-menx-border rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={orderPage * 8 >= ordersTotal}
                          onClick={() => setOrderPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-gray-705 border border-menx-border rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: RETURNS */}
            {activeTab === 'returns' && hasOrderRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-menx-border pb-4">
                  <h2 className="text-lg font-bold text-white">Returns & Exchanges</h2>

                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">

                    {/* Status filter */}
                    <select
                      value={returnStatusFilter}
                      onChange={(e) => { setReturnStatusFilter(e.target.value); setReturnPage(1); }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-lg p-2.5 text-white font-bold text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All Statuses</option>
                      <option value="REQUESTED">Requested</option>
                      <option value="APPROVED">Approved</option>
                      <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
                      <option value="RECEIVED_IN_STORE">Received in Store</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={returnSearch}
                        onChange={(e) => { setReturnSearch(e.target.value); setReturnPage(1); }}
                        placeholder="Search Return/Order #..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingReturns ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-menx-primary"></div>
                  </div>
                ) : returns.length === 0 ? (
                  <div className="py-12 text-center text-menx-text-muted font-medium">
                    No return requests matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-menx-text-secondary">
                        <thead className="bg-menx-surface-elevated text-menx-text-secondary uppercase text-xs font-bold tracking-wider border-b border-menx-border">
                          <tr>
                            <th className="py-3 px-4">Return #</th>
                            <th className="py-3 px-4">Order #</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Reason</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {returns.map((r) => (
                            <tr key={r.id} className="hover:bg-menx-surface-elevated/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-menx-primary">{r.return_number}</td>
                              <td className="py-4 px-4 font-mono text-white">{r.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white font-medium">
                                  {(r.first_name || r.last_name) ? `${r.first_name || ''} ${r.last_name || ''}`.trim() : (r.email || 'Customer')}
                                </div>
                                {r.email && <div className="text-[11px] text-menx-text-muted font-mono">{r.email}</div>}
                              </td>
                              <td className="py-4 px-4 text-xs font-bold">
                                {r.request_type === 'EXCHANGE' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold tracking-wider">
                                    EXCHANGE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold tracking-wider">
                                    RETURN
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-xs text-menx-text-secondary">{getReturnReasonLabel(r.reason)}</td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getReturnStatusBadge(r.status)}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => openReturnDetailModal(r)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-xs font-bold text-menx-primary transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Review</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                      <span className="text-menx-text-muted font-medium">
                        Showing {returns.length} of {returnsTotal} return requests
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={returnPage === 1}
                          onClick={() => setReturnPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={returnPage * 8 >= returnsTotal}
                          onClick={() => setReturnPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: LOW STOCK */}
            {activeTab === 'low-stock' && hasInventoryRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                {/* Header & Search */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-menx-border pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-menx-primary" />
                      <h2 className="text-lg font-bold text-white">Low Stock Warnings</h2>
                      {lowStockTotal > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-menx-error/10 border border-menx-error/20 text-menx-error">
                          {lowStockTotal} {lowStockTotal === 1 ? 'Product' : 'Products'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-menx-text-secondary mt-1">
                      Catalog items with inventory at or below minimum reorder thresholds. Grouped by product.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={lowStockSearch}
                        onChange={(e) => {
                          setLowStockSearch(e.target.value);
                          setLowStockPage(1);
                        }}
                        placeholder="Search product or SKU..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-2.5" />
                    </div>

                    <button
                      type="button"
                      onClick={fetchLowStockList}
                      disabled={loadingLowStock}
                      className="inline-flex items-center space-x-1.5 py-2 px-3.5 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border text-menx-text-secondary hover:text-white font-bold rounded-lg transition-colors text-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingLowStock ? 'animate-spin text-menx-primary' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Error Banner */}
                {lowStockError && (
                  <div className="p-4 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-menx-error shrink-0" />
                      <span>{lowStockError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchLowStockList}
                      className="px-3 py-1 bg-menx-error/20 hover:bg-menx-error/30 text-red-200 rounded font-bold text-xs transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Loading State */}
                {loadingLowStock ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-menx-primary"></div>
                    <p className="text-xs text-menx-text-secondary font-medium">Checking real-time stock thresholds...</p>
                  </div>
                ) : lowStockProducts.length === 0 ? (
                  <div className="py-16 text-center text-menx-text-muted font-medium flex flex-col items-center justify-center space-y-3">
                    <div className="p-4 rounded-2xl bg-menx-success/10 border border-menx-success/20 text-menx-success">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-white font-bold text-base">All Catalog Items Fully Stocked</h3>
                    <p className="text-xs text-menx-text-secondary max-w-sm">
                      Zero inventory warnings found across active product variants. All stock levels exceed their minimum thresholds.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary Metrics Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="bg-menx-surface-elevated border border-menx-border p-3.5 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-menx-text-secondary tracking-wider">Products Needing Attention</span>
                          <div className="text-xl font-extrabold text-white mt-0.5">{lowStockTotal}</div>
                        </div>
                        <div className="p-2.5 bg-menx-primary/10 text-menx-primary rounded-lg">
                          <Package className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="bg-menx-surface-elevated border border-menx-border p-3.5 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-menx-text-secondary tracking-wider">Critical Variants</span>
                          <div className="text-xl font-extrabold text-menx-error mt-0.5">{lowStockVariantTotal}</div>
                        </div>
                        <div className="p-2.5 bg-menx-error/10 text-menx-error rounded-lg">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="bg-menx-surface-elevated border border-menx-border p-3.5 rounded-xl sm:col-span-2 lg:col-span-1 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-menx-text-secondary tracking-wider">Recommended Action</span>
                          <div className="text-xs font-bold text-menx-text-secondary mt-0.5">Adjust stock or record purchase receipts</div>
                        </div>
                        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
                          <Shield className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Grouped Products List */}
                    <div className="space-y-4">
                      {lowStockProducts.map((prod) => {
                        const prodVariants = Array.isArray(prod.variants) ? prod.variants : [];
                        const hasOos = prod.hasZeroStock || prodVariants.some(v => (v.availableStock ?? v.stock?.available ?? 0) <= 0);

                        return (
                          <div
                            key={prod.productId || prod.id}
                            className="bg-menx-surface-elevated border border-menx-border hover:border-menx-primary/40 rounded-2xl p-5 space-y-4 shadow-sm transition-all"
                          >
                            {/* Product Group Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-menx-border pb-3">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                                  <h3 className="text-white font-bold text-base">{prod.productTitle}</h3>
                                  {hasOos ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-red-500/15 border border-menx-error/30 text-menx-error flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>Out of Stock</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-menx-primary/15 border border-menx-primary/30 text-menx-primary flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>Low Stock</span>
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-menx-surface border border-menx-border text-menx-text-secondary">
                                    {prod.lowStockVariantCount || prodVariants.length} {((prod.lowStockVariantCount || prodVariants.length) === 1) ? 'variant needs restock' : 'variants need restock'}
                                  </span>
                                </div>
                                {prod.productSlug && (
                                  <div className="text-[11px] text-menx-text-muted font-mono">
                                    Slug: {prod.productSlug}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => openVariantsModal({ id: prod.productId, title: prod.productTitle, slug: prod.productSlug })}
                                className="self-start sm:self-center px-3.5 py-1.5 bg-menx-surface hover:bg-menx-surface-elevated border border-menx-border rounded-xl text-xs font-bold text-indigo-300 hover:text-white transition-colors flex items-center space-x-1.5 shrink-0"
                              >
                                <Package className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Manage All Variants & Stock</span>
                              </button>
                            </div>

                            {/* Inner Variants Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-menx-border text-menx-text-secondary uppercase font-bold tracking-wider text-[11px] bg-menx-bg/60">
                                    <th className="py-2.5 px-3">Variant & SKU</th>
                                    <th className="py-2.5 px-3">Size & Color</th>
                                    <th className="py-2.5 px-3 text-center">Available Stock</th>
                                    <th className="py-2.5 px-3 text-center">Reserved</th>
                                    <th className="py-2.5 px-3 text-center">Min Threshold</th>
                                    <th className="py-2.5 px-3 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-855/60 font-medium">
                                  {prodVariants.map((v) => {
                                    const avail = v.availableStock ?? v.stock?.available ?? v.quantity_available ?? 0;
                                    const reserved = v.reservedStock ?? v.stock?.reserved ?? v.quantity_reserved ?? 0;
                                    const threshold = v.minThreshold ?? v.threshold ?? v.stock?.threshold ?? v.variant?.low_stock_threshold ?? 5;
                                    const isOos = avail <= 0;
                                    const sizeLabel = v.sizeDetails?.name || (typeof v.size === 'string' ? v.size : '') || v.variant?.size?.name || 'N/A';
                                    const colorLabel = v.colorDetails?.name || (typeof v.color === 'string' ? v.color : '') || v.variant?.color?.name || 'N/A';
                                    const hexCode = v.colorDetails?.hex_code || v.variant?.color?.hex_code;
                                    const skuCode = v.sku || v.variant?.sku || 'N/A';

                                    return (
                                      <tr key={v.id || v.variantId} className="hover:bg-menx-surface/40 transition-colors">
                                        <td className="py-3 px-3">
                                          <div className="font-mono text-white font-bold">{skuCode}</div>
                                          {v.barcode && <div className="text-[10px] text-menx-text-muted font-mono">Barcode: {v.barcode}</div>}
                                        </td>
                                        <td className="py-3 px-3 text-menx-text-secondary">
                                          <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded bg-menx-surface border border-menx-border font-bold text-menx-text">
                                              Size: {sizeLabel}
                                            </span>
                                            <span className="flex items-center gap-1 text-menx-text-secondary">
                                              {hexCode && (
                                                <span
                                                  className="w-2.5 h-2.5 rounded-full border border-menx-border inline-block"
                                                  style={{ backgroundColor: hexCode }}
                                                />
                                              )}
                                              <span>{colorLabel}</span>
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                          {isOos ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-red-500/15 border border-menx-error/30 text-menx-error">
                                              0 (OUT OF STOCK)
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-menx-primary/15 border border-menx-primary/30 text-menx-primary font-mono">
                                              {avail} units (LOW)
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 px-3 text-center font-mono text-menx-text-secondary">
                                          {reserved}
                                        </td>
                                        <td className="py-3 px-3 text-center font-mono text-menx-text-secondary">
                                          {threshold}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          <button
                                            type="button"
                                            onClick={() => openAdjustStockModal({
                                              id: v.variantId || v.id,
                                              sku: skuCode,
                                              size: sizeLabel,
                                              color: colorLabel,
                                              product: { title: prod.productTitle }
                                            })}
                                            className="px-2.5 py-1 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-[#0B0F14] font-extrabold rounded-lg text-xs transition-colors"
                                          >
                                            Adjust Stock
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {lowStockTotal > 10 && (
                      <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                        <span className="text-menx-text-muted font-medium">
                          Showing {lowStockProducts.length} of {lowStockTotal} products needing attention
                        </span>
                        <div className="flex gap-2">
                          <button
                            disabled={lowStockPage === 1}
                            onClick={() => setLowStockPage(prev => Math.max(1, prev - 1))}
                            className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white transition-colors"
                          >
                            Prev
                          </button>
                          <button
                            disabled={lowStockPage * 10 >= lowStockTotal}
                            onClick={() => setLowStockPage(prev => prev + 1)}
                            className="px-3.5 py-2 bg-menx-bg hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CUSTOMERS */}
            {activeTab === 'customers' && (
              <div className="space-y-6">
                {/* Search & Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="relative flex-grow max-w-md">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-menx-text-muted" />
                    <input
                      type="text"
                      placeholder="Search by name, email, phone..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setCustomerPage(1);
                      }}
                      className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    />
                  </div>
                </div>

                {loadingCustomers ? (
                  <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="menx-card p-12 rounded-xl text-center text-menx-text-muted space-y-2">
                    <Users className="w-12 h-12 mx-auto text-menx-text-muted" />
                    <h3 className="text-white font-semibold">No customers found</h3>
                    <p className="text-sm">Try modifying your search query.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Desktop View Table */}
                    <div className="hidden md:block menx-card rounded-2xl overflow-hidden shadow-md">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-menx-border text-menx-text-secondary font-bold uppercase tracking-wider text-xs bg-menx-bg/40">
                              <th className="py-4 px-6">Customer</th>
                              <th className="py-4 px-6">Contact Info</th>
                              <th className="py-4 px-6 text-center">Status</th>
                              <th className="py-4 px-6 text-right">Orders</th>
                              <th className="py-4 px-6 text-right">Total Spent</th>
                              <th className="py-4 px-6">Joined Date</th>
                              <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-855/50">
                            {customers.map((c) => (
                              <tr key={c.id} className="hover:bg-menx-surface-elevated/20 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="font-extrabold text-white">
                                    {c.first_name} {c.last_name || ''}
                                  </div>
                                  <div className="text-[10px] text-menx-text-muted font-mono select-all">
                                    {c.id}
                                  </div>
                                </td>
                                <td className="py-4 px-6 space-y-0.5">
                                  <div className="text-menx-text-secondary font-semibold">{c.email}</div>
                                  {c.phone && <div className="text-menx-text-muted text-xs font-mono">{c.phone}</div>}
                                </td>
                                <td className="py-4 px-6 text-center">
                                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${c.is_active
                                    ? 'bg-menx-success/10 border-menx-success/20 text-menx-success'
                                    : 'bg-menx-error/10 border-menx-error/20 text-menx-error'
                                    }`}>
                                    {c.is_active ? 'Active' : 'Suspended'}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-menx-text-secondary">
                                  {c.total_orders}
                                </td>
                                <td className="py-4 px-6 text-right font-black text-menx-primary">
                                  {formatCurrency(c.total_spent)}
                                </td>
                                <td className="py-4 px-6 text-menx-text-secondary text-xs">
                                  {new Date(c.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-4 px-6 text-right">
                                  <button
                                    onClick={() => setSelectedCustomer(c)}
                                    className="py-1.5 px-3 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-bold transition-all duration-150 flex items-center space-x-1 ml-auto"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Customer</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-4">
                      {customers.map((c) => (
                        <div key={c.id} className="menx-card rounded-xl p-5 space-y-4 shadow-md">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-extrabold text-white text-base">
                                {c.first_name} {c.last_name || ''}
                              </h4>
                              <span className="text-[9px] text-menx-text-muted font-mono block select-all">{c.id}</span>
                            </div>
                            <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${c.is_active
                              ? 'bg-menx-success/10 border-menx-success/20 text-menx-success'
                              : 'bg-menx-error/10 border-menx-error/20 text-menx-error'
                              }`}>
                              {c.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2 text-xs border-t border-b border-menx-border py-3">
                            <div className="space-y-0.5">
                              <span className="text-menx-text-muted uppercase font-bold text-[9px] tracking-wider">Email</span>
                              <p className="text-menx-text-secondary font-semibold break-all">{c.email}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-menx-text-muted uppercase font-bold text-[9px] tracking-wider">Phone</span>
                              <p className="text-menx-text-secondary font-semibold font-mono">{c.phone || 'N/A'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-menx-text-muted uppercase font-bold text-[9px] tracking-wider">Total Orders</span>
                              <p className="text-menx-text-secondary font-bold">{c.total_orders}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-menx-text-muted uppercase font-bold text-[9px] tracking-wider">Total Spent</span>
                              <p className="text-menx-primary font-black">{formatCurrency(c.total_spent)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-menx-text-secondary">
                            <span>Joined: {new Date(c.created_at).toLocaleDateString()}</span>
                            <button
                              onClick={() => setSelectedCustomer(c)}
                              className="py-1.5 px-3 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-bold transition-all duration-150 flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {customersTotal > 10 && (
                      <div className="flex justify-between items-center menx-card p-4 rounded-xl shadow-md">
                        <button
                          disabled={customerPage === 1}
                          onClick={() => setCustomerPage(p => Math.max(1, p - 1))}
                          className="py-2 px-4 border border-menx-border hover:bg-menx-surface-elevated disabled:bg-menx-bg disabled:border-transparent text-menx-text-secondary hover:text-white disabled:text-menx-text-muted rounded-lg text-xs font-bold transition-all duration-150 uppercase tracking-wider"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-menx-text-secondary font-bold">
                          Page {customerPage} of {Math.ceil(customersTotal / 10)}
                        </span>
                        <button
                          disabled={customerPage >= Math.ceil(customersTotal / 10)}
                          onClick={() => setCustomerPage(p => p + 1)}
                          className="py-2 px-4 border border-menx-border hover:bg-menx-surface-elevated disabled:bg-menx-bg disabled:border-transparent text-menx-text-secondary hover:text-white disabled:text-menx-text-muted rounded-lg text-xs font-bold transition-all duration-150 uppercase tracking-wider"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SUPPORT TICKETS */}
            {activeTab === 'support' && hasSupportRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-menx-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <HelpCircle className="w-5 h-5 text-menx-primary" />
                      <span>Customer Support Tickets</span>
                    </h2>
                    <p className="text-xs text-menx-text-secondary mt-1">
                      Manage customer inquiries, view attached orders, and reply directly through conversation threads.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 items-center text-xs">
                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={supportSearch}
                        onChange={(e) => { setSupportSearch(e.target.value); setSupportTicketPage(1); }}
                        placeholder="Search ticket #, customer, order..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium w-60 text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-2.5" />
                    </div>

                    {/* Status Filter */}
                    <select
                      value={supportStatusFilter}
                      onChange={(e) => { setSupportStatusFilter(e.target.value); setSupportTicketPage(1); }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-lg px-3 py-2 text-white font-medium text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All Statuses</option>
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>

                    {/* Category Filter */}
                    <select
                      value={supportCategoryFilter}
                      onChange={(e) => { setSupportCategoryFilter(e.target.value); setSupportTicketPage(1); }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-lg px-3 py-2 text-white font-medium text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All Categories</option>
                      <option value="ORDERS_FULFILLMENT">Orders & Fulfillment</option>
                      <option value="RETURNS_EXCHANGES">Returns & Exchanges</option>
                      <option value="PAYMENTS_REFUNDS">Payments & Refunds</option>
                      <option value="PRODUCT_INQUIRY">Product Inquiry</option>
                      <option value="ACCOUNT_SETTINGS">Account & Settings</option>
                      <option value="OTHER">Other Support</option>
                    </select>

                    {/* Refresh */}
                    <button
                      onClick={fetchSupportTicketsList}
                      disabled={loadingSupportTickets}
                      className="p-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-menx-text-secondary hover:text-white transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingSupportTickets ? 'animate-spin text-menx-primary' : ''}`} />
                    </button>
                  </div>
                </div>

                {loadingSupportTickets ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-menx-primary"></div>
                  </div>
                ) : supportTickets.length === 0 ? (
                  <div className="py-16 text-center text-menx-text-muted space-y-2">
                    <HelpCircle className="w-12 h-12 mx-auto text-menx-text-muted" />
                    <h3 className="text-white font-semibold">No support tickets found</h3>
                    <p className="text-xs text-menx-text-muted">No tickets match your filter criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-menx-border text-menx-text-secondary font-bold uppercase tracking-wider bg-menx-surface-elevated/60">
                            <th className="py-3 px-4">Ticket</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Order</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4">Created</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {supportTickets.map((ticket) => (
                            <tr key={ticket.id} className="hover:bg-menx-surface-elevated/30 transition-colors font-medium">
                              <td className="py-3.5 px-4">
                                <span className="font-mono font-bold text-menx-primary">{ticket.ticket_number}</span>
                                <p className="text-white font-semibold text-xs mt-0.5 truncate max-w-xs">{ticket.subject}</p>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="text-menx-text font-bold">{ticket.customer?.first_name} {ticket.customer?.last_name || ''}</div>
                                <div className="text-menx-text-muted text-[11px]">{ticket.customer?.email}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded bg-menx-surface-elevated text-menx-text-secondary font-medium text-[11px]">
                                  {getSupportCategoryLabel(ticket.category)}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                {ticket.order?.order_number ? (
                                  <span className="font-mono text-menx-text-secondary bg-menx-bg px-2 py-0.5 rounded border border-menx-border text-[11px]">
                                    #{ticket.order.order_number}
                                  </span>
                                ) : (
                                  <span className="text-menx-text-muted italic text-[11px]">None</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getSupportStatusBadge(ticket.status)}`}>
                                  {ticket.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-menx-text-secondary text-[11px]">
                                {formatDate(ticket.created_at)}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => openSupportTicketModal(ticket)}
                                  className="py-1.5 px-3 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-extrabold transition-colors inline-flex items-center space-x-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Manage</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {supportTickets.map((ticket) => (
                        <div key={ticket.id} className="bg-menx-surface-elevated border border-menx-border rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-mono font-bold text-menx-primary text-xs">{ticket.ticket_number}</span>
                              <h4 className="text-white font-bold text-sm mt-0.5">{ticket.subject}</h4>
                            </div>
                            <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getSupportStatusBadge(ticket.status)}`}>
                              {ticket.status}
                            </span>
                          </div>

                          <div className="text-xs text-menx-text-secondary space-y-1 border-t border-b border-menx-border py-2">
                            <div>Customer: <span className="text-menx-text font-semibold">{ticket.customer?.first_name} {ticket.customer?.last_name || ''}</span> ({ticket.customer?.email})</div>
                            <div>Category: <span className="text-menx-text-secondary">{getSupportCategoryLabel(ticket.category)}</span></div>
                            {ticket.order?.order_number && (
                              <div>Order: <span className="font-mono text-menx-primary">#{ticket.order.order_number}</span></div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-menx-text-muted">
                            <span>{formatDate(ticket.created_at)}</span>
                            <button
                              onClick={() => openSupportTicketModal(ticket)}
                              className="py-1.5 px-3 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Manage</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                      <span className="text-menx-text-muted font-medium">
                        Showing {supportTickets.length} of {supportTicketsTotal} tickets
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={supportTicketPage === 1}
                          onClick={() => setSupportTicketPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={supportTicketPage * 10 >= supportTicketsTotal}
                          onClick={() => setSupportTicketPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SUGGESTIONS & FEEDBACK */}
            {activeTab === 'suggestions' && hasSupportRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-menx-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-menx-primary" />
                      <span>Customer Suggestions & Feedback</span>
                    </h2>
                    <p className="text-xs text-menx-text-secondary mt-1">
                      Review customer feedback, update implementation status, and maintain internal admin notes.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 items-center text-xs">
                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={suggestionSearch}
                        onChange={(e) => { setSuggestionSearch(e.target.value); setSuggestionPage(1); }}
                        placeholder="Search message, customer, notes..."
                        className="bg-menx-surface-elevated border border-menx-border rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium w-60 text-xs"
                      />
                      <Search className="w-3.5 h-3.5 text-menx-text-muted absolute left-2.5 top-2.5" />
                    </div>

                    {/* Status Filter */}
                    <select
                      value={suggestionStatusFilter}
                      onChange={(e) => { setSuggestionStatusFilter(e.target.value); setSuggestionPage(1); }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-lg px-3 py-2 text-white font-medium text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All Statuses</option>
                      <option value="NEW">NEW</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="IMPLEMENTED">IMPLEMENTED</option>
                    </select>

                    {/* Refresh */}
                    <button
                      onClick={fetchSuggestionsList}
                      disabled={loadingSuggestions}
                      className="p-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-menx-text-secondary hover:text-white transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingSuggestions ? 'animate-spin text-menx-primary' : ''}`} />
                    </button>
                  </div>
                </div>

                {loadingSuggestions ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-menx-primary"></div>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="py-16 text-center text-menx-text-muted space-y-2">
                    <MessageSquare className="w-12 h-12 mx-auto text-menx-text-muted" />
                    <h3 className="text-white font-semibold">No feedback suggestions found</h3>
                    <p className="text-xs text-menx-text-muted">No suggestions match your filter criteria.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-menx-border text-menx-text-secondary font-bold uppercase tracking-wider bg-menx-surface-elevated/60">
                            <th className="py-3 px-4">ID / Date</th>
                            <th className="py-3 px-4">Customer</th>
                            <th className="py-3 px-4">Feedback Message</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4">Admin Note</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {suggestions.map((sugg) => (
                            <tr key={sugg.id} className="hover:bg-menx-surface-elevated/30 transition-colors font-medium">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-mono text-menx-text-secondary text-[10px] block select-all">#{sugg.id?.slice(0, 8)}</span>
                                <span className="text-menx-text-muted text-[11px]">{formatDate(sugg.created_at)}</span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {sugg.customer ? (
                                  <div>
                                    <div className="text-menx-text font-bold">{sugg.customer.first_name} {sugg.customer.last_name || ''}</div>
                                    <div className="text-menx-text-muted text-[11px]">{sugg.customer.email}</div>
                                  </div>
                                ) : (
                                  <span className="text-menx-text-muted italic text-[11px]">Anonymous / Guest</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                <p className="text-menx-text-secondary text-xs line-clamp-2 leading-relaxed">
                                  {sugg.message}
                                </p>
                              </td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getSuggestionStatusBadge(sugg.status)}`}>
                                  {sugg.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                {sugg.admin_note ? (
                                  <p className="text-menx-primary/90 text-[11px] line-clamp-1 italic bg-menx-primary/5 px-2 py-0.5 rounded border border-menx-primary/20">
                                    {sugg.admin_note}
                                  </p>
                                ) : (
                                  <span className="text-menx-text-muted italic text-[11px]">None</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => openSuggestionModal(sugg)}
                                  className="py-1.5 px-3 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-extrabold transition-colors inline-flex items-center space-x-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Manage</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {suggestions.map((sugg) => (
                        <div key={sugg.id} className="bg-menx-surface-elevated border border-menx-border rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <span className="font-mono text-menx-text-secondary text-[10px]">#{sugg.id?.slice(0, 8)}</span>
                            <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getSuggestionStatusBadge(sugg.status)}`}>
                              {sugg.status}
                            </span>
                          </div>

                          <div className="text-xs text-menx-text-secondary leading-relaxed bg-menx-surface p-3 rounded-lg border border-menx-border">
                            {sugg.message}
                          </div>

                          <div className="text-[11px] text-menx-text-muted flex items-center justify-between border-t border-menx-border pt-2">
                            <span>
                              {sugg.customer ? `${sugg.customer.first_name} ${sugg.customer.last_name || ''}` : 'Anonymous'} · {formatDate(sugg.created_at)}
                            </span>
                            <button
                              onClick={() => openSuggestionModal(sugg)}
                              className="py-1 px-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Manage</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                      <span className="text-menx-text-muted font-medium">
                        Showing {suggestions.length} of {suggestionsTotal} suggestions
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={suggestionPage === 1}
                          onClick={() => setSuggestionPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={suggestionPage * 10 >= suggestionsTotal}
                          onClick={() => setSuggestionPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-menx-surface-elevated hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: DATA CENTER */}
            {activeTab === 'datacenter' && hasDataCenterRole && (
              <div className="space-y-6">
                {/* Header Card */}
                <div className="menx-card rounded-2xl p-6 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-menx-primary/10 border border-menx-primary/20 rounded-xl text-menx-primary">
                          <Database className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
                            <span>Admin Data Center</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-menx-primary/10 border border-menx-primary/30 text-menx-primary uppercase tracking-wider font-mono">
                              v1.0
                            </span>
                          </h2>
                          <p className="text-xs text-menx-text-secondary">
                            Export authoritative MENX business data in CSV and Excel (.xlsx) formats for operational reporting and financial reconciliation.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                      <div className="inline-flex items-center space-x-1.5 bg-menx-surface-elevated border border-menx-border px-3 py-1.5 rounded-xl text-xs text-menx-text-secondary font-medium">
                        <Lock className="w-3.5 h-3.5 text-menx-primary" />
                        <span>Admin-Only Export</span>
                      </div>
                      <button
                        onClick={fetchDatacenterSummary}
                        disabled={loadingDatacenterSummary}
                        className="p-2 bg-menx-surface-elevated hover:bg-menx-border border border-menx-border rounded-xl text-menx-text-secondary hover:text-white transition-colors"
                        title="Refresh dataset metrics"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingDatacenterSummary ? 'animate-spin text-menx-primary' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 1: Select Dataset */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-menx-text-muted flex items-center space-x-1.5">
                      <span>1. Select Dataset to Export</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Dataset 1: Products & Stock */}
                    <div
                      onClick={() => {
                        if (canExportProducts) {
                          setDatacenterDataset('products_stock');
                          setExportSuccessMessage(null);
                          setExportErrorMessage(null);
                        }
                      }}
                      className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${datacenterDataset === 'products_stock'
                        ? 'bg-menx-primary/5 border-menx-primary ring-1 ring-menx-primary'
                        : 'bg-menx-surface border-menx-border hover:border-menx-border/80 hover:bg-menx-surface-elevated/40'
                        } ${!canExportProducts ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3.5">
                          <div className={`p-2.5 rounded-xl border ${datacenterDataset === 'products_stock'
                            ? 'bg-menx-primary/20 border-menx-primary/40 text-menx-primary'
                            : 'bg-menx-surface-elevated border-menx-border text-menx-text-muted'
                            }`}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                              <span>Products & Stock</span>
                              {datacenterDataset === 'products_stock' && (
                                <span className="bg-menx-primary text-[#0B0F14] text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                                  Selected
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-menx-text-secondary leading-relaxed">
                              Catalog taxonomy, active SKU variants, pricing, live available/reserved stock, and threshold warning statuses.
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${datacenterDataset === 'products_stock'
                            ? 'border-menx-primary bg-menx-primary text-black'
                            : 'border-menx-border bg-menx-surface-elevated'
                            }`}>
                            {datacenterDataset === 'products_stock' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                        </div>
                      </div>

                      {datacenterSummary?.summary && (
                        <div className="mt-4 pt-3 border-t border-menx-border/60 flex flex-wrap items-center gap-3 text-[11px] text-menx-text-muted">
                          <span>Variants: <strong className="text-white font-mono">{datacenterSummary.summary.variantsCount || productsCount}</strong></span>
                          <span>•</span>
                          <span>Total Units in Stock: <strong className="text-menx-primary font-mono">{datacenterSummary.summary.totalStockUnits ?? 'Live'}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Dataset 2: Orders */}
                    <div
                      onClick={() => {
                        if (canExportOrders) {
                          setDatacenterDataset('orders');
                          setExportSuccessMessage(null);
                          setExportErrorMessage(null);
                        }
                      }}
                      className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${datacenterDataset === 'orders'
                        ? 'bg-menx-primary/5 border-menx-primary ring-1 ring-menx-primary'
                        : 'bg-menx-surface border-menx-border hover:border-menx-border/80 hover:bg-menx-surface-elevated/40'
                        } ${!canExportOrders ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3.5">
                          <div className={`p-2.5 rounded-xl border ${datacenterDataset === 'orders'
                            ? 'bg-menx-primary/20 border-menx-primary/40 text-menx-primary'
                            : 'bg-menx-surface-elevated border-menx-border text-menx-text-muted'
                            }`}>
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                              <span>Orders & Line Items</span>
                              {datacenterDataset === 'orders' && (
                                <span className="bg-menx-primary text-[#0B0F14] text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                                  Selected
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-menx-text-secondary leading-relaxed">
                              Order transactions with line-item pricing snapshots, buyer contact info, delivery destinations, and financial totals.
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${datacenterDataset === 'orders'
                            ? 'border-menx-primary bg-menx-primary text-black'
                            : 'border-menx-border bg-menx-surface-elevated'
                            }`}>
                            {datacenterDataset === 'orders' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                        </div>
                      </div>

                      {datacenterSummary?.summary && (
                        <div className="mt-4 pt-3 border-t border-menx-border/60 flex flex-wrap items-center gap-3 text-[11px] text-menx-text-muted">
                          <span>Total Orders: <strong className="text-white font-mono">{datacenterSummary.summary.ordersCount || ordersCount}</strong></span>
                          <span>•</span>
                          <span>Line Items: <strong className="text-menx-primary font-mono">{datacenterSummary.summary.orderItemsCount || 'All'}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2: Filters & Parameters */}
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 shadow-md space-y-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-menx-text-muted flex items-center space-x-1.5">
                    <Filter className="w-3.5 h-3.5 text-menx-primary" />
                    <span>2. Configure Export Filters & Scope</span>
                  </h3>

                  {datacenterDataset === 'products_stock' ? (
                    /* Products & Stock Filters */
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Category Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-menx-text-secondary block">
                          Filter by Category
                        </label>
                        <select
                          value={datacenterCategoryId}
                          onChange={(e) => setDatacenterCategoryId(e.target.value)}
                          className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-menx-primary font-medium"
                        >
                          <option value="">All Categories</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Product Status Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-menx-text-secondary block">
                          Product Status
                        </label>
                        <select
                          value={datacenterProductStatus}
                          onChange={(e) => setDatacenterProductStatus(e.target.value)}
                          className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-menx-primary font-medium"
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="PUBLISHED">PUBLISHED (Live)</option>
                          <option value="DRAFT">DRAFT (Hidden)</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                      </div>

                      {/* Stock Status Filter */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-menx-text-secondary block">
                          Stock Availability Status
                        </label>
                        <select
                          value={datacenterStockStatus}
                          onChange={(e) => setDatacenterStockStatus(e.target.value)}
                          className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-menx-primary font-medium"
                        >
                          <option value="ALL">All Inventory Levels</option>
                          <option value="IN_STOCK">IN STOCK (Healthy)</option>
                          <option value="LOW_STOCK">LOW STOCK (Below Threshold)</option>
                          <option value="OUT_OF_STOCK">OUT OF STOCK (0 Units)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    /* Orders Filters */
                    <div className="space-y-4">
                      {/* Date Presets Row */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-menx-text-secondary block">
                          Date Range Preset
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'all', label: 'All Time' },
                            { id: 'last7', label: 'Last 7 Days' },
                            { id: 'last30', label: 'Last 30 Days' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'custom', label: 'Custom Range' }
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyDatePreset(p.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${datacenterDatePreset === p.id
                                ? 'bg-menx-primary text-[#0B0F14]'
                                : 'bg-menx-surface-elevated hover:bg-menx-border text-menx-text-secondary hover:text-white border border-menx-border'
                                }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date Pickers & Status Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* From Date */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-menx-text-secondary block">
                            From Date
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={datacenterFromDate}
                              onChange={(e) => {
                                setDatacenterFromDate(e.target.value);
                                setDatacenterDatePreset('custom');
                              }}
                              className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-menx-primary font-mono"
                            />
                          </div>
                        </div>

                        {/* To Date */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-menx-text-secondary block">
                            To Date
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={datacenterToDate}
                              onChange={(e) => {
                                setDatacenterToDate(e.target.value);
                                setDatacenterDatePreset('custom');
                              }}
                              className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-menx-primary font-mono"
                            />
                          </div>
                        </div>

                        {/* Order Status */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-menx-text-secondary block">
                            Order Status
                          </label>
                          <select
                            value={datacenterOrderStatus}
                            onChange={(e) => setDatacenterOrderStatus(e.target.value)}
                            className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-menx-primary font-medium"
                          >
                            <option value="ALL">All Order Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PACKED">Packed</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="RETURN_REQUESTED">Return Requested</option>
                            <option value="RETURNED">Returned</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 3: Select Format */}
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-menx-text-muted flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-menx-primary" />
                    <span>3. Choose Export File Format</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* CSV Format */}
                    <div
                      onClick={() => setDatacenterFormat('csv')}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 ${datacenterFormat === 'csv'
                        ? 'bg-menx-primary/5 border-menx-primary ring-1 ring-menx-primary'
                        : 'bg-menx-surface-elevated border-menx-border hover:border-menx-border/80'
                        }`}
                    >
                      <div className={`p-2 rounded-lg border shrink-0 ${datacenterFormat === 'csv'
                        ? 'bg-menx-primary/20 border-menx-primary/40 text-menx-primary'
                        : 'bg-menx-surface border-menx-border text-menx-text-muted'
                        }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white">CSV (.csv)</span>
                          <span className="text-[9px] font-mono bg-menx-surface px-1.5 py-0.5 rounded border border-menx-border text-menx-text-secondary">
                            Universal
                          </span>
                        </div>
                        <p className="text-[11px] text-menx-text-secondary leading-relaxed">
                          RFC 4180 standard with UTF-8 BOM. Directly compatible with Microsoft Excel, Google Sheets, Apple Numbers, and data science tools.
                        </p>
                      </div>
                    </div>

                    {/* Excel Format */}
                    <div
                      onClick={() => setDatacenterFormat('xlsx')}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start space-x-3.5 ${datacenterFormat === 'xlsx'
                        ? 'bg-menx-primary/5 border-menx-primary ring-1 ring-menx-primary'
                        : 'bg-menx-surface-elevated border-menx-border hover:border-menx-border/80'
                        }`}
                    >
                      <div className={`p-2 rounded-lg border shrink-0 ${datacenterFormat === 'xlsx'
                        ? 'bg-menx-primary/20 border-menx-primary/40 text-menx-primary'
                        : 'bg-menx-surface border-menx-border text-menx-text-muted'
                        }`}>
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white">Excel (.xlsx)</span>
                          <span className="text-[9px] font-mono bg-menx-surface px-1.5 py-0.5 rounded border border-menx-border text-menx-text-secondary">
                            Styled Workbook
                          </span>
                        </div>
                        <p className="text-[11px] text-menx-text-secondary leading-relaxed">
                          Formatted Microsoft Excel spreadsheet with frozen bold headers, styled columns, typed numeric values, and auto-fitted column widths.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4: Export Summary & Download Trigger */}
                <div className="bg-menx-surface border border-menx-border rounded-2xl p-6 shadow-md space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-menx-border pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Export Summary & Execution</h3>
                      <p className="text-xs text-menx-text-secondary mt-0.5">
                        Confirm parameters below to generate and stream the download securely.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-menx-text-muted font-medium bg-menx-surface-elevated px-3 py-1.5 rounded-xl border border-menx-border">
                      <Shield className="w-3.5 h-3.5 text-menx-primary" />
                      <span>Formula Injection Sanitized</span>
                    </div>
                  </div>

                  {/* Summary Scope Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-menx-surface-elevated p-3 rounded-xl border border-menx-border space-y-0.5">
                      <span className="text-[10px] text-menx-text-muted uppercase font-bold">Dataset</span>
                      <p className="font-bold text-white">
                        {datacenterDataset === 'products_stock' ? 'Products & Stock' : 'Orders & Line Items'}
                      </p>
                    </div>

                    <div className="bg-menx-surface-elevated p-3 rounded-xl border border-menx-border space-y-0.5">
                      <span className="text-[10px] text-menx-text-muted uppercase font-bold">Format</span>
                      <p className="font-bold text-menx-primary uppercase">{datacenterFormat}</p>
                    </div>

                    <div className="bg-menx-surface-elevated p-3 rounded-xl border border-menx-border space-y-0.5">
                      <span className="text-[10px] text-menx-text-muted uppercase font-bold">Scope / Dates</span>
                      <p className="font-bold text-white truncate">
                        {datacenterDataset === 'orders'
                          ? (datacenterFromDate || datacenterToDate ? `${datacenterFromDate || 'Start'} → ${datacenterToDate || 'Today'}` : 'All Historical Orders')
                          : (datacenterCategoryId ? 'Category Filtered' : 'All Catalog Categories')
                        }
                      </p>
                    </div>

                    <div className="bg-menx-surface-elevated p-3 rounded-xl border border-menx-border space-y-0.5">
                      <span className="text-[10px] text-menx-text-muted uppercase font-bold">Audit Logging</span>
                      <p className="font-bold text-menx-success">Active & Recorded</p>
                    </div>
                  </div>

                  {/* Feedback Messages */}
                  {exportErrorMessage && (
                    <div className="p-3.5 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-xl text-xs font-semibold flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{exportErrorMessage}</span>
                    </div>
                  )}

                  {exportSuccessMessage && (
                    <div className="p-3.5 bg-menx-success/10 border border-menx-success/20 text-menx-success rounded-xl text-xs font-semibold flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{exportSuccessMessage}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] text-menx-text-muted">
                      Downloads are processed on demand. No sensitive files are permanently stored on public cloud storage.
                    </p>

                    <button
                      type="button"
                      disabled={exportingData || (datacenterDataset === 'products_stock' ? !canExportProducts : !canExportOrders)}
                      onClick={handleExecuteExport}
                      className="w-full sm:w-auto px-8 py-3.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-black rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-menx-primary/10 tracking-wide uppercase"
                    >
                      {exportingData ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                          <span>Generating Export...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download Export</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DELIVERY PIN CODES */}
            {activeTab === 'delivery-pincodes' && hasDeliveryPinRole && (
              <div className="menx-card rounded-2xl p-6 shadow-md space-y-6">
                {/* Header & Stat Cards */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-menx-border pb-6">
                  <div>
                    <h2 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
                      <MapPin className="w-6 h-6 text-menx-primary" />
                      <span>Delivery PIN Code Management</span>
                    </h2>
                    <p className="text-xs text-menx-text-secondary mt-1">
                      Configure and manage postal/PIN codes eligible for delivery and checkout across India.
                    </p>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-menx-surface-elevated border border-menx-border rounded-xl px-3.5 py-2 flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-menx-text-muted uppercase">Total:</span>
                      <span className="font-mono font-extrabold text-white text-sm">{deliveryZonesTotal}</span>
                    </div>
                    <div className="bg-menx-surface-elevated border border-menx-success/30 rounded-xl px-3.5 py-2 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-menx-success"></span>
                      <span className="text-[11px] font-bold text-menx-success uppercase">Active:</span>
                      <span className="font-mono font-extrabold text-menx-success text-sm">{deliveryZonesActiveCount}</span>
                    </div>
                    <div className="bg-menx-surface-elevated border border-gray-600/40 rounded-xl px-3.5 py-2 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      <span className="text-[11px] font-bold text-menx-text-muted uppercase">Inactive:</span>
                      <span className="font-mono font-extrabold text-menx-text-muted text-sm">{deliveryZonesInactiveCount}</span>
                    </div>
                  </div>
                </div>

                {/* Success & Error Feedback Banners */}
                {deliveryZoneActionSuccess && (
                  <div className="p-3.5 bg-menx-success/10 border border-menx-success/30 text-menx-success rounded-xl text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{deliveryZoneActionSuccess}</span>
                    </div>
                    <button onClick={() => setDeliveryZoneActionSuccess(null)} className="text-menx-success hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {deliveryZoneActionError && (
                  <div className="p-3.5 bg-menx-error/10 border border-menx-error/30 text-menx-error rounded-xl text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{deliveryZoneActionError}</span>
                    </div>
                    <button onClick={() => setDeliveryZoneActionError(null)} className="text-menx-error hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Filter and Action Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-menx-surface-elevated/40 p-4 rounded-xl border border-menx-border/80">
                  <div className="flex flex-wrap gap-2.5 items-center text-xs flex-1">
                    {/* Search PIN / District */}
                    <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                      <input
                        type="text"
                        value={deliveryZonesSearch}
                        onChange={(e) => {
                          setDeliveryZonesSearch(e.target.value);
                          setDeliveryZonesPage(1);
                        }}
                        placeholder="Search PIN code, district..."
                        className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary font-medium text-xs"
                      />
                      <Search className="w-4 h-4 text-menx-text-muted absolute left-3 top-3" />
                    </div>

                    {/* State Filter */}
                    <select
                      value={deliveryZonesStateFilter}
                      onChange={(e) => {
                        setDeliveryZonesStateFilter(e.target.value);
                        setDeliveryZonesPage(1);
                      }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-xl px-3 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="">All States</option>
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Kerala">Kerala</option>
                      <option value="West Bengal">West Bengal</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      value={deliveryZonesStatusFilter}
                      onChange={(e) => {
                        setDeliveryZonesStatusFilter(e.target.value);
                        setDeliveryZonesPage(1);
                      }}
                      className="bg-menx-surface-elevated border border-menx-border rounded-xl px-3 py-2.5 text-white font-medium text-xs focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="ACTIVE">Active Only</option>
                      <option value="INACTIVE">Inactive Only</option>
                    </select>

                    {/* Refresh Button */}
                    <button
                      onClick={fetchDeliveryZonesList}
                      disabled={loadingDeliveryZones}
                      className="p-2.5 bg-menx-surface-elevated hover:bg-menx-surface-elevated/80 border border-menx-border rounded-xl text-menx-text-secondary hover:text-white transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingDeliveryZones ? 'animate-spin text-menx-primary' : ''}`} />
                    </button>
                  </div>

                  {/* Add PIN Button */}
                  <button
                    onClick={() => {
                      setPinForm({
                        pincode: '',
                        state: 'Andhra Pradesh',
                        district: '',
                        isActive: true,
                        baseDeliveryCharge: '20.00',
                        estimatedDaysMin: 5,
                        estimatedDaysMax: 9
                      });
                      setPinFormError(null);
                      setShowAddPinModal(true);
                    }}
                    className="py-2.5 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-black rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-menx-primary/10 uppercase tracking-wider shrink-0"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Add PIN Code</span>
                  </button>
                </div>

                {/* Table Content */}
                {loadingDeliveryZones ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-3">
                    <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-menx-primary"></div>
                    <span className="text-xs text-menx-text-muted font-medium">Loading delivery PIN codes...</span>
                  </div>
                ) : deliveryZonesError ? (
                  <div className="py-12 text-center text-menx-error space-y-2">
                    <AlertTriangle className="w-10 h-10 mx-auto text-menx-error" />
                    <h3 className="font-bold text-sm">Failed to load PIN codes</h3>
                    <p className="text-xs text-menx-text-muted">{deliveryZonesError}</p>
                    <button
                      onClick={fetchDeliveryZonesList}
                      className="mt-2 py-1.5 px-4 bg-menx-surface-elevated hover:bg-menx-border text-white text-xs font-bold rounded-lg"
                    >
                      Retry
                    </button>
                  </div>
                ) : deliveryZones.length === 0 ? (
                  <div className="py-16 text-center text-menx-text-muted space-y-3">
                    <MapPin className="w-12 h-12 mx-auto text-menx-text-muted/60" />
                    <h3 className="text-white font-bold text-sm">No delivery PIN codes found</h3>
                    <p className="text-xs text-menx-text-muted max-w-sm mx-auto">
                      {deliveryZonesSearch || deliveryZonesStateFilter || deliveryZonesStatusFilter !== 'ALL'
                        ? 'No PIN codes match the current search filters. Try clearing your search or filters.'
                        : 'No delivery PIN codes are configured yet. Click "+ Add PIN Code" to add your first zone.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-menx-border">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-menx-border text-menx-text-secondary font-bold uppercase tracking-wider bg-menx-surface-elevated/80">
                            <th className="py-3 px-4">PIN Code</th>
                            <th className="py-3 px-4">State</th>
                            <th className="py-3 px-4">District / Area</th>
                            <th className="py-3 px-4">Delivery SLA</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {deliveryZones.map((zone) => (
                            <tr key={zone.id} className="hover:bg-menx-surface-elevated/40 transition-colors font-medium">
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-mono font-extrabold text-white text-sm tracking-wide bg-menx-surface-elevated/80 px-2.5 py-1 rounded-lg border border-menx-border">
                                  {zone.pincode}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="text-white font-semibold">{zone.state || 'Andhra Pradesh'}</span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-menx-text-secondary">
                                {zone.district || '—'}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-menx-text-muted font-mono text-[11px]">
                                {formatCurrency(zone.baseDeliveryCharge)} {zone.estimatedDaysMin && zone.estimatedDaysMax ? `• ${zone.estimatedDaysMin}-${zone.estimatedDaysMax} days` : ''}
                              </td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                {zone.isActive ? (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider bg-menx-success/10 border-menx-success/30 text-menx-success">
                                    <span className="w-1.5 h-1.5 rounded-full bg-menx-success"></span>
                                    <span>Active</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider bg-gray-500/10 border-menx-border text-menx-text-secondary">
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                    <span>Inactive</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end space-x-2">
                                  {/* Toggle Active/Inactive */}
                                  <button
                                    onClick={() => handleToggleZoneStatus(zone)}
                                    disabled={togglingZoneId === zone.id}
                                    className={`py-1 px-2.5 rounded-lg border text-[11px] font-bold transition-all ${zone.isActive
                                      ? 'bg-menx-surface-elevated border-menx-border text-menx-text-secondary hover:text-menx-error hover:border-menx-error/40'
                                      : 'bg-menx-success/10 border-menx-success/30 text-menx-success hover:bg-menx-success/20'
                                      } disabled:opacity-50`}
                                    title={zone.isActive ? 'Deactivate PIN for customer checkout' : 'Activate PIN for customer checkout'}
                                  >
                                    {togglingZoneId === zone.id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
                                    ) : zone.isActive ? (
                                      'Disable'
                                    ) : (
                                      'Enable'
                                    )}
                                  </button>

                                  {/* Delete PIN */}
                                  <button
                                    onClick={() => handleDeleteZone(zone)}
                                    disabled={deletingZoneId === zone.id}
                                    className="p-1.5 bg-menx-surface-elevated hover:bg-menx-error/20 border border-menx-border hover:border-menx-error/40 text-menx-text-muted hover:text-menx-error rounded-lg transition-all disabled:opacity-50"
                                    title="Delete PIN code record"
                                  >
                                    {deletingZoneId === zone.id ? (
                                      <div className="animate-spin rounded-full h-3.5 w-3.5 border border-menx-error border-t-transparent" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="md:hidden space-y-3">
                      {deliveryZones.map((zone) => (
                        <div
                          key={zone.id}
                          className="bg-menx-surface-elevated/50 border border-menx-border rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-extrabold text-white text-base tracking-wide bg-menx-surface-elevated px-2.5 py-1 rounded-lg border border-menx-border">
                                {zone.pincode}
                              </span>
                              <span className="text-white text-xs font-semibold">{zone.state || 'Andhra Pradesh'}</span>
                            </div>
                            <div>
                              {zone.isActive ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider bg-menx-success/10 border-menx-success/30 text-menx-success">
                                  <span className="w-1.5 h-1.5 rounded-full bg-menx-success"></span>
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider bg-gray-500/10 border-menx-border text-menx-text-secondary">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                  <span>Inactive</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-menx-text-secondary border-t border-menx-border/60 pt-2">
                            <span>District: <strong className="text-white">{zone.district || '—'}</strong></span>
                            <span className="font-mono text-[11px] text-menx-text-muted">
                              {formatCurrency(zone.baseDeliveryCharge)} {zone.estimatedDaysMin ? `(${zone.estimatedDaysMin}-${zone.estimatedDaysMax}d)` : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-menx-border/60">
                            <button
                              onClick={() => handleToggleZoneStatus(zone)}
                              disabled={togglingZoneId === zone.id}
                              className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold transition-all text-center ${zone.isActive
                                ? 'bg-menx-surface-elevated border-menx-border text-menx-text-secondary hover:text-menx-error'
                                : 'bg-menx-success/10 border-menx-success/30 text-menx-success'
                                } disabled:opacity-50`}
                            >
                              {togglingZoneId === zone.id ? 'Updating...' : zone.isActive ? 'Disable PIN' : 'Enable PIN'}
                            </button>
                            <button
                              onClick={() => handleDeleteZone(zone)}
                              disabled={deletingZoneId === zone.id}
                              className="py-1.5 px-3 bg-menx-surface-elevated hover:bg-menx-error/20 border border-menx-border hover:border-menx-error/40 text-menx-text-muted hover:text-menx-error rounded-lg text-xs font-bold transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Footer */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-menx-border pt-4 text-xs">
                      <div className="text-menx-text-secondary">
                        Showing <span className="font-bold text-white">{(deliveryZonesPage - 1) * 25 + 1}</span> to{' '}
                        <span className="font-bold text-white">{Math.min(deliveryZonesPage * 25, deliveryZonesTotal)}</span> of{' '}
                        <span className="font-bold text-white">{deliveryZonesTotal}</span> PIN codes
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setDeliveryZonesPage(p => Math.max(1, p - 1))}
                          disabled={deliveryZonesPage <= 1 || loadingDeliveryZones}
                          className="py-1.5 px-3 bg-menx-surface-elevated hover:bg-menx-border text-white font-bold rounded-lg disabled:opacity-40 disabled:hover:bg-menx-surface-elevated transition-colors"
                        >
                          Previous
                        </button>
                        <span className="text-menx-text-muted font-mono px-2">
                          Page {deliveryZonesPage} of {Math.max(1, Math.ceil(deliveryZonesTotal / 25))}
                        </span>
                        <button
                          onClick={() => setDeliveryZonesPage(p => p + 1)}
                          disabled={deliveryZonesPage * 25 >= deliveryZonesTotal || loadingDeliveryZones}
                          className="py-1.5 px-3 bg-menx-surface-elevated hover:bg-menx-border text-white font-bold rounded-lg disabled:opacity-40 disabled:hover:bg-menx-surface-elevated transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* OVERLAY: Selected Order Details Modal */}
      <AdminModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidth="max-w-4xl"
        title={`Manage Order #${selectedOrder?.order_number || ''}`}
        badge={selectedOrder && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getOrderStatusBadge(selectedOrder.order_status)}`}>
            {selectedOrder.order_status}
          </span>
        )}
        footer={(
          <button
            type="button"
            onClick={() => setSelectedOrder(null)}
            className="py-2.5 px-5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Close Order
          </button>
        )}
      >
        {selectedOrder && (() => {
          // Resolve latest/active return or exchange request if present
          const activeReturnReq = (selectedOrder.return_requests || []).sort(
            (a, b) => new Date(b.created_at || b.requested_at) - new Date(a.created_at || a.requested_at)
          )[0] || null;

          const isExchange = activeReturnReq?.request_type === 'EXCHANGE';
          const isReturn = activeReturnReq?.request_type === 'RETURN';

          return (
            <div className="space-y-6 text-sm">
              {/* TOP: Prominent Customer Return / Exchange Request Section */}
              {activeReturnReq && (
                <div className={`p-4 sm:p-5 rounded-xl border ${isExchange
                  ? 'bg-gradient-to-r from-menx-primary/15 via-menx-surface-elevated to-menx-surface-elevated border-menx-primary/40 shadow-lg shadow-menx-primary/5'
                  : 'bg-gradient-to-r from-amber-500/15 via-menx-surface-elevated to-menx-surface-elevated border-amber-500/40 shadow-lg shadow-amber-500/5'
                  } space-y-4`}>
                  {/* Top Bar: Header, Type Badge, Return # */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                    <div className="flex items-start sm:items-center space-x-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-md shrink-0 ${isExchange
                        ? 'bg-menx-primary text-[#0B0F14]'
                        : 'bg-amber-400 text-[#0B0F14]'
                        }`}>
                        {isExchange ? (
                          <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                          <RotateCcw className="w-5 h-5 stroke-[2.5] transform -scale-x-100" />
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-menx-text-muted flex items-center gap-1.5">
                          <span>CUSTOMER REQUEST</span>
                          <span className="text-white/30">•</span>
                          <span className="font-mono text-menx-text-secondary">{activeReturnReq.return_number}</span>
                        </div>
                        <div className={`text-base sm:text-lg font-black tracking-tight ${isExchange ? 'text-menx-primary' : 'text-amber-400'
                          }`}>
                          {isExchange ? '🔄 EXCHANGE REQUEST' : '↩ RETURN REQUEST'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase tracking-wider ${getReturnStatusBadge(activeReturnReq.status)}`}>
                        Request: {activeReturnReq.status}
                      </span>
                    </div>
                  </div>

                  {/* Request Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-menx-surface/60 border border-menx-border/80 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">Requested On</span>
                      <span className="text-white font-medium mt-0.5 block">
                        {new Date(activeReturnReq.created_at || activeReturnReq.requested_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="bg-menx-surface/60 border border-menx-border/80 rounded-lg p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">Request Reason</span>
                      <span className="text-white font-bold mt-0.5 block">
                        {getReturnReasonLabel(activeReturnReq.reason)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Comment */}
                  {activeReturnReq.customer_comment && (
                    <div className="bg-menx-surface/80 border border-menx-border rounded-lg p-3 text-xs space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-menx-text-muted block">Customer Note</span>
                      <p className="text-gray-200 italic font-medium leading-relaxed">"{activeReturnReq.customer_comment}"</p>
                    </div>
                  )}

                  {/* Requested Items details */}
                  {activeReturnReq.return_items && activeReturnReq.return_items.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-menx-text-secondary">
                        Requested Item{activeReturnReq.return_items.length > 1 ? 's' : ''} ({activeReturnReq.return_items.length})
                      </div>
                      <div className="space-y-2">
                        {activeReturnReq.return_items.map((ri) => {
                          const matchingOrderItem = (selectedOrder.order_items || []).find(
                            (oi) => oi.id === ri.order_item_id || oi.variant_id === ri.variant_id
                          );
                          const title = matchingOrderItem?.product_title_snapshot || matchingOrderItem?.variant?.product?.title || 'Purchased Item';
                          const originalSize = matchingOrderItem?.size_snapshot || '—';
                          const originalColor = matchingOrderItem?.color_snapshot || '—';

                          const imagesList = matchingOrderItem?.variant?.product?.images || [];
                          const primaryImg = [...imagesList].sort(
                            (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order ?? 0) - (b.display_order ?? 0)
                          )[0];
                          const imgUrl = matchingOrderItem?.product_image_snapshot || primaryImg?.image_url || null;

                          const repSize = ri.replacement_variant?.size?.name;
                          const repColor = ri.replacement_variant?.color?.name;
                          const repSku = ri.replacement_variant?.sku;

                          return (
                            <div
                              key={ri.id}
                              className="bg-menx-surface border border-menx-border rounded-xl p-3 sm:p-3.5 flex items-start space-x-3.5 text-xs shadow-sm"
                            >
                              <div className="w-14 h-16 sm:w-16 sm:h-18 bg-[#0B0F14] border border-menx-border/80 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={title} className="w-full h-full object-cover" />
                                ) : (
                                  <ShoppingBag className="w-5 h-5 text-menx-text-muted/40" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                <h6 className="font-extrabold text-white text-xs sm:text-sm tracking-tight leading-snug truncate">
                                  {title}
                                </h6>

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-menx-text-secondary">
                                  <span>Purchased Size: <strong className="text-white">{originalSize}</strong></span>
                                  <span>•</span>
                                  <span>Color: <strong className="text-white">{originalColor}</strong></span>
                                  <span>•</span>
                                  <span>Qty: <strong className="text-white">{ri.quantity}</strong></span>
                                </div>

                                {/* Exchange Replacement Details */}
                                {isExchange && (
                                  <div className="mt-1.5 p-2 bg-menx-primary/10 border border-menx-primary/25 rounded-lg text-xs text-menx-primary font-semibold flex items-center space-x-2">
                                    <RotateCcw className="w-3.5 h-3.5 shrink-0 text-menx-primary" />
                                    <div>
                                      <span>
                                        Exchanging for: Size <strong className="text-white font-bold">{repSize || 'Replacement Size'}</strong>
                                        {repColor && <span className="text-menx-text-secondary"> • Color <strong className="text-white font-bold">{repColor}</strong></span>}
                                      </span>
                                      {repSku && (
                                        <div className="text-[10px] font-mono text-menx-text-muted">SKU: {repSku}</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left two columns: Items details & Delivery Snapshot */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Product details */}
                  <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-white border-b border-menx-border pb-2">Line Items</h4>
                    <div className="divide-y divide-gray-855">
                      {(selectedOrder.order_items || []).map((item) => (
                        <AdminOrderItemRow key={item.id} item={item} colors={colors} />
                      ))}
                    </div>
                  </div>

                  {/* Delivery Snapshot */}
                  <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-2">
                    <h4 className="font-bold text-white border-b border-menx-border pb-2">Delivery Snapshot</h4>
                    {selectedOrder.shipping_snapshot ? (
                      <div className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                        <div className="font-bold text-white">{selectedOrder.shipping_snapshot.recipient_name}</div>
                        <div>
                          {selectedOrder.shipping_snapshot.address_line1}
                          {selectedOrder.shipping_snapshot.address_line2 && `, ${selectedOrder.shipping_snapshot.address_line2}`}
                          {selectedOrder.shipping_snapshot.landmark && ` (Near ${selectedOrder.shipping_snapshot.landmark})`}
                        </div>
                        <div>{selectedOrder.shipping_snapshot.city}, {selectedOrder.shipping_snapshot.state} - <span className="font-bold text-menx-primary">{selectedOrder.shipping_snapshot.postal_code}</span></div>
                        <div className="pt-1">Phone: {selectedOrder.shipping_snapshot.phone_number}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-menx-text-muted">No snapshot found</div>
                    )}
                  </div>
                </div>

                {/* Right column: Fulfilment controls & Financials */}
                <div className="space-y-4">
                  {/* Price Summary */}
                  <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-2.5">
                    <h4 className="font-bold text-white border-b border-menx-border pb-2">Financials</h4>
                    <div className="space-y-2 text-xs text-menx-text-secondary">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedOrder.subtotal_amount)}</span>
                      </div>
                      {Number(selectedOrder.discount_amount) > 0 && (
                        <div className="flex justify-between text-menx-success">
                          <span>Discount:</span>
                          <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Shipping Fee:</span>
                        <span>{formatCurrency(selectedOrder.delivery_fee)}</span>
                      </div>
                      <div className="border-t border-menx-border pt-2 flex justify-between font-black text-sm text-white">
                        <span>Authoritative Total:</span>
                        <span className="text-menx-primary">{formatCurrency(selectedOrder.total_payable)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Transitions Form */}
                  {getValidOrderStatusTransitions(selectedOrder.order_status).length > 0 && (
                    <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-menx-border pb-2">
                        <h4 className="font-bold text-white">Transition Order Status</h4>
                        {activeReturnReq && (
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${isExchange ? 'bg-menx-primary/10 border-menx-primary/30 text-menx-primary' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                            {isExchange ? 'EXCHANGE' : 'RETURN'}
                          </span>
                        )}
                      </div>

                      {selectedOrder.order_status === 'RETURN_REQUESTED' && (
                        <p className="text-[11px] text-menx-text-muted leading-relaxed">
                          {isExchange
                            ? 'Customer requested an exchange. Transitioning to RETURNED will mark original order returned and fulfill the exchange replacement.'
                            : 'Customer requested a return and refund. Transitioning to RETURNED will restock resellable items.'}
                        </p>
                      )}

                      <div className="flex flex-col gap-2">
                        {getValidOrderStatusTransitions(selectedOrder.order_status).map((target) => (
                          <button
                            key={target}
                            disabled={updatingOrderStatus}
                            onClick={() => handleUpdateOrderStatus(target)}
                            className="w-full py-2.5 bg-menx-primary/10 hover:bg-menx-primary text-menx-primary hover:text-[#0B0F14] border border-menx-primary/20 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center space-x-1"
                          >
                            {updatingOrderStatus ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-menx-primary" />
                            ) : (
                              <>
                                <span>Move to {target}</span>
                                <ChevronRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* COD Cash collection form */}
                  {selectedOrder.payment_method === 'COD' && selectedOrder.payment_status === 'PENDING' && (
                    <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-3">
                      <h4 className="font-bold text-white border-b border-menx-border pb-2 flex items-center">
                        <CreditCard className="w-4 h-4 text-menx-primary mr-1.5" />
                        <span>Record COD Collection</span>
                      </h4>
                      <form onSubmit={handleRecordCod} className="space-y-2">
                        <div>
                          <label className="text-[10px] text-menx-text-muted font-bold block mb-1">Cash amount collected (₹) *</label>
                          <input
                            type="number"
                            required
                            value={codAmount}
                            onChange={(e) => setCodAmount(e.target.value)}
                            placeholder={`E.g., ${selectedOrder.total_payable}`}
                            className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-menx-primary font-mono font-bold"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={recordingCod}
                          className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:bg-menx-surface-elevated text-[#0B0F14] font-extrabold rounded-lg text-xs transition-colors"
                        >
                          {recordingCod ? 'Processing...' : 'Collect Cash & Mark Paid'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </AdminModal>

      {/* OVERLAY: Selected Return Details Modal */}
      <AdminModal
        isOpen={Boolean(selectedReturn)}
        onClose={() => setSelectedReturn(null)}
        maxWidth="max-w-4xl"
        title={`Manage Return ${selectedReturn?.return_number || ''}`}
        badge={selectedReturn && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getReturnStatusBadge(selectedReturn.status)}`}>
            {selectedReturn.status}
          </span>
        )}
        footer={(
          <button
            type="button"
            onClick={() => setSelectedReturn(null)}
            className="py-2.5 px-5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Close Return
          </button>
        )}
      >
        {selectedReturn && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">

            {/* Left two columns: Items details */}
            <div className="lg:col-span-2 space-y-4">

              {/* Product details */}
              <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-3">
                <h4 className="font-bold text-white border-b border-menx-border pb-2">Return Items</h4>
                <div className="divide-y divide-gray-855">
                  {(selectedReturn.items || []).map((item) => (
                    <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                      <div className="space-y-1">
                        <h5 className="font-bold text-white">{item.product_title_snapshot}</h5>
                        <p className="text-menx-text-muted font-mono">
                          SKU: {item.variant_sku_snapshot} | Original Size: {item.size_snapshot} | Color: {item.color_snapshot}
                        </p>
                        {selectedReturn.request_type === 'EXCHANGE' && (
                          <p className="text-menx-primary font-bold">
                            Exchanging for Variant: {item.replacement_size || 'Size Code ' + item.replacement_variant_id}
                          </p>
                        )}
                        {item.condition_on_receipt && (
                          <p className="text-menx-text-secondary font-medium">
                            Condition on receipt: <span className="text-white font-bold bg-menx-surface-elevated border border-menx-border px-1.5 py-0.5 rounded font-mono text-[9px]">{item.condition_on_receipt}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="font-bold text-white">Qty: {item.quantity}</span>

                        {/* receipt condition input (Only shown when returnTransitionStatus is RECEIVED_IN_STORE or COMPLETED) */}
                        {['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus) && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] text-menx-text-muted font-bold uppercase">Condition:</span>
                            <select
                              value={returnItemsConditions[item.id] || 'RESELLABLE'}
                              onChange={(e) => setReturnItemsConditions(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="bg-menx-surface border border-menx-border text-[10px] text-white p-1 rounded font-bold"
                            >
                              <option value="RESELLABLE">Resellable</option>
                              <option value="DAMAGED">Damaged</option>
                              <option value="DEFECTIVE">Defective</option>
                            </select>
                          </div>
                        )}

                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Comment */}
              {selectedReturn.customer_comment && (
                <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl text-xs space-y-1">
                  <h4 className="font-bold text-menx-text-secondary uppercase tracking-wider">Customer Comment</h4>
                  <p className="text-gray-305 italic">"{selectedReturn.customer_comment}"</p>
                </div>
              )}

            </div>

            {/* Right column: Return status transition control */}
            <div className="space-y-4">

              {getValidReturnStatusTransitions(selectedReturn.status).length > 0 && (
                <form onSubmit={handleUpdateReturnStatus} className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-4">
                  <h4 className="font-bold text-white border-b border-menx-border pb-2">Transition Return Status</h4>

                  {/* Status select dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-menx-text-muted font-bold uppercase block">Next Status *</label>
                    <select
                      required
                      value={returnTransitionStatus}
                      onChange={(e) => setReturnTransitionStatus(e.target.value)}
                      className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-xs text-white focus:outline-none focus:border-menx-primary font-bold"
                    >
                      <option value="">-- Choose Status --</option>
                      {getValidReturnStatusTransitions(selectedReturn.status).map(target => (
                        <option key={target} value={target}>{target.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Transition comments */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-menx-text-muted font-bold uppercase block">Review Comment</label>
                    <textarea
                      rows={3}
                      value={returnComment}
                      onChange={(e) => setReturnComment(e.target.value)}
                      placeholder="E.g., Pickup scheduled with delivery partner, or items checked..."
                      className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-menx-primary font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingReturnStatus || !returnTransitionStatus}
                    className="w-full py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated text-[#0B0F14] font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    {updatingReturnStatus && <div className="animate-spin rounded-full h-3 w-3 border-t border-black mr-1" />}
                    <span>Apply Transition</span>
                  </button>
                </form>
              )}

            </div>

          </div>
        )}
      </AdminModal>

      {/* OVERLAY: Selected Customer Details Modal */}
      <AdminModal
        isOpen={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        maxWidth="max-w-5xl"
        title="Customer Profile Details"
        icon={<Users className="w-5 h-5 text-menx-primary" />}
        footer={(
          <button
            type="button"
            onClick={() => setSelectedCustomer(null)}
            className="py-2.5 px-5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Close Profile
          </button>
        )}
      >
        {loadingCustomerDetails ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-menx-primary"></div>
          </div>
        ) : customerDetailsError ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-6 rounded-xl text-center space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="font-bold">Failed to load customer details</p>
            <p className="text-xs text-menx-text-secondary">{customerDetailsError}</p>
          </div>
        ) : selectedCustomerDetails ? (
          <div className="space-y-6 text-sm text-menx-text-secondary">

            {/* Section 1: Customer Profile Overview and Statistics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Customer Information Card */}
              <div className="bg-menx-surface-elevated border border-menx-border rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-white border-b border-menx-border pb-2 text-xs uppercase tracking-wider">Customer Profile</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-menx-text-muted font-semibold">Full Name</span>
                    <span className="text-white font-extrabold">
                      {selectedCustomerDetails.customer.first_name} {selectedCustomerDetails.customer.last_name || ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-menx-text-muted font-semibold">Email</span>
                    <span className="text-menx-text font-bold break-all select-all">{selectedCustomerDetails.customer.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-menx-text-muted font-semibold">Phone</span>
                    <span className="text-menx-text font-bold select-all">{selectedCustomerDetails.customer.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-menx-text-muted font-semibold">Joined Date</span>
                    <span className="text-menx-text-secondary">{new Date(selectedCustomerDetails.customer.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-menx-text-muted font-semibold">Status</span>
                    <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${selectedCustomerDetails.customer.is_active
                      ? 'bg-menx-success/10 border-menx-success/20 text-menx-success'
                      : 'bg-menx-error/10 border-menx-error/20 text-menx-error'
                      }`}>
                      {selectedCustomerDetails.customer.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Statistics Grid Card */}
              <div className="lg:col-span-2 bg-menx-surface-elevated border border-menx-border rounded-xl p-5 space-y-4">
                <h4 className="font-bold text-white border-b border-menx-border pb-2 text-xs uppercase tracking-wider">Shopping & Order Statistics</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

                  <div className="bg-menx-surface border border-menx-border/80 p-3 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider">Total Orders</span>
                    <p className="text-xl font-extrabold text-white">{selectedCustomerDetails.statistics.total_orders}</p>
                  </div>

                  <div className="bg-menx-surface border border-menx-border/80 p-3 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider">Total Spent</span>
                    <p className="text-xl font-black text-menx-primary">₹{selectedCustomerDetails.statistics.total_spent.toLocaleString()}</p>
                  </div>

                  <div className="bg-menx-surface border border-menx-border/80 p-3 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider">Delivered</span>
                    <p className="text-xl font-extrabold text-menx-success">{selectedCustomerDetails.statistics.delivered_orders}</p>
                  </div>

                  <div className="bg-menx-surface border border-menx-border/80 p-3 rounded-lg text-center space-y-1">
                    <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider">Cancelled</span>
                    <p className="text-xl font-extrabold text-menx-error">{selectedCustomerDetails.statistics.cancelled_orders}</p>
                  </div>
                </div>

                {/* Detailed Order Status Breakdown */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 border-t border-menx-border/50 pt-3 text-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-menx-text-muted uppercase font-bold">Pending</span>
                    <p className="font-bold text-menx-warning/90">{selectedCustomerDetails.statistics.pending_orders}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-menx-text-muted uppercase font-bold">Confirmed</span>
                    <p className="font-bold text-menx-info">{selectedCustomerDetails.statistics.confirmed_orders}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-menx-text-muted uppercase font-bold">Packed</span>
                    <p className="font-bold text-indigo-400">{selectedCustomerDetails.statistics.packed_orders}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-menx-text-muted uppercase font-bold">Shipped</span>
                    <p className="font-bold text-purple-400">{selectedCustomerDetails.statistics.shipped_orders}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-menx-text-muted uppercase font-bold">Out for Del.</span>
                    <p className="font-bold text-menx-primary/80">{selectedCustomerDetails.statistics.out_for_delivery_orders}</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Section 2: Order History */}
            <div className="bg-menx-surface-elevated border border-menx-border rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-white border-b border-menx-border pb-2 text-xs uppercase tracking-wider">Customer Order History</h4>

              {selectedCustomerDetails.orders.length === 0 ? (
                <p className="text-xs text-menx-text-muted py-4 text-center">This customer has not placed any orders yet.</p>
              ) : (
                <div className="overflow-x-auto border border-menx-border rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-menx-border text-menx-text-secondary font-bold uppercase tracking-wider text-[10px] bg-menx-bg/60">
                        <th className="py-3 px-4">Order Number</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-right">Total Amount</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-855/30">
                      {selectedCustomerDetails.orders.map((o) => (
                        <tr key={o.id} className="hover:bg-menx-surface-elevated/10 transition-colors">
                          <td className="py-3 px-4 font-bold text-white select-all">{o.order_number}</td>
                          <td className="py-3 px-4 text-menx-text-secondary">{new Date(o.created_at).toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getOrderStatusBadge(o.order_status)}`}>
                              {o.order_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-menx-text-secondary font-medium font-mono text-[10px]">{o.payment_method}</td>
                          <td className="py-3 px-4 text-right font-black text-menx-primary">₹{Number(o.total_payable).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => openOrderDetailModal(o)}
                              className="py-1 px-2.5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded text-[10px] font-bold transition-all duration-150"
                            >
                              View Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 3: Saved Addresses */}
            <div className="bg-menx-surface-elevated border border-menx-border rounded-xl p-5 space-y-4">
              <h4 className="font-bold text-white border-b border-menx-border pb-2 text-xs uppercase tracking-wider">Saved Shipping Addresses</h4>

              {selectedCustomerDetails.addresses.length === 0 ? (
                <p className="text-xs text-menx-text-muted py-4 text-center">No addresses registered for this customer.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedCustomerDetails.addresses.map((addr) => (
                    <div key={addr.id} className="relative bg-menx-surface border border-menx-border/80 rounded-xl p-4 space-y-2.5 text-xs shadow">

                      {/* Title / Badge */}
                      <div className="flex justify-between items-center border-b border-menx-border/65 pb-1.5">
                        <span className="font-bold text-white uppercase tracking-wider text-[10px] font-mono text-menx-primary">{addr.address_type}</span>
                        {addr.is_default && (
                          <span className="bg-menx-success/10 border border-menx-success/20 text-menx-success text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 leading-relaxed text-menx-text-secondary">
                        <div className="font-bold text-menx-text">{addr.recipient_name}</div>
                        <div>
                          {addr.address_line1}
                          {addr.address_line2 && `, ${addr.address_line2}`}
                          {addr.landmark && ` (Near ${addr.landmark})`}
                        </div>
                        <div>
                          {addr.city}, {addr.state} - <span className="font-bold text-menx-text-secondary">{addr.postal_code}</span>
                        </div>
                        <div className="text-[10px] text-menx-text-muted font-mono pt-1">Phone: {addr.phone_number}</div>
                        {addr.alternate_phone && (
                          <div className="text-[10px] text-menx-text-muted font-mono">Alt Phone: {addr.alternate_phone}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : null}
      </AdminModal>

      {/* OVERLAY: Product Create/Edit Modal */}
      <AdminModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        closeDisabled={savingProduct}
        maxWidth="max-w-2xl"
        title={productForm.id ? 'Edit Catalog Product' : 'Create New Product'}
        formProps={{ onSubmit: handleProductSubmit, className: 'space-y-4 text-xs' }}
        footer={(
          <>
            <button
              type="button"
              disabled={savingProduct}
              onClick={() => setShowProductModal(false)}
              className="py-2.5 px-5 border border-menx-border hover:bg-menx-surface-elevated rounded-xl text-xs font-bold text-menx-text-secondary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProduct}
              className="py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated disabled:text-menx-text-muted disabled:cursor-not-allowed text-[#0B0F14] text-xs font-extrabold rounded-xl flex items-center space-x-1.5 transition-colors shadow-lg shadow-menx-primary/10"
            >
              {savingProduct && <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent mr-1" />}
              <span>{productForm.id ? 'Save Changes' : 'Create Product'}</span>
            </button>
          </>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {productFormError && (
            <div className="md:col-span-2 p-3 bg-red-950/80 border border-menx-error/40 rounded-xl text-red-200 text-xs font-semibold leading-relaxed flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-menx-error flex-shrink-0" />
              <span>{productFormError}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Product Title *</label>
            <input
              type="text"
              required
              disabled={savingProduct}
              value={productForm.title}
              onChange={(e) => handleProductTitleChange(e.target.value)}
              placeholder="E.g., Casual Slim Fit Chinos"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Slug *</label>
            <input
              type="text"
              required
              disabled={savingProduct}
              value={productForm.slug}
              onChange={(e) => setProductForm(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="casual-slim-fit-chinos"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-mono font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Product Description *</label>
            <textarea
              required
              rows={3}
              disabled={savingProduct}
              value={productForm.description}
              onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Write detailed specifications regarding fabric composition, weave, fit..."
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors resize-y"
            />
          </div>

          {/* Category ID */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Category *</label>
            <select
              required
              disabled={savingProduct}
              value={productForm.categoryId}
              onChange={(e) => setProductForm(prev => ({ ...prev, categoryId: e.target.value, subcategoryId: '' }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            >
              <option value="" className="bg-menx-surface text-menx-text-secondary">-- Choose Category --</option>
              {categories.map(c => <option key={c.id} value={c.id} className="bg-menx-surface text-white">{c.name}</option>)}
            </select>
          </div>

          {/* Subcategory ID (filtered strictly by category_id === productForm.categoryId) */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Subcategory *</label>
            <select
              required
              disabled={savingProduct || !productForm.categoryId}
              value={productForm.subcategoryId}
              onChange={(e) => setProductForm(prev => ({ ...prev, subcategoryId: e.target.value }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            >
              <option value="" className="bg-menx-surface text-menx-text-secondary">-- Choose Subcategory --</option>
              {subcategories
                .filter(s => s.category_id === productForm.categoryId || s.categoryId === productForm.categoryId)
                .map(s => <option key={s.id} value={s.id} className="bg-menx-surface text-white">{s.name}</option>)}
            </select>
          </div>

          {/* Brand ID */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Brand *</label>
            <select
              required
              disabled={savingProduct}
              value={productForm.brandId}
              onChange={(e) => setProductForm(prev => ({ ...prev, brandId: e.target.value }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            >
              <option value="" className="bg-menx-surface text-menx-text-secondary">-- Choose Brand --</option>
              {brands.map(b => <option key={b.id} value={b.id} className="bg-menx-surface text-white">{b.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Status *</label>
            <select
              required
              disabled={savingProduct}
              value={productForm.status || 'DRAFT'}
              onChange={(e) => setProductForm(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            >
              <option value="DRAFT" className="bg-menx-surface text-white">DRAFT — Hidden from Shop</option>
              <option value="PUBLISHED" className="bg-menx-surface text-white">PUBLISHED — Visible in Shop</option>
              <option value="ARCHIVED" className="bg-menx-surface text-white">ARCHIVED — Hidden/Archived</option>
            </select>
          </div>

          {/* Base Selling Price */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Selling Price (₹) *</label>
            <input
              type="number"
              required
              min={0.01}
              step="0.01"
              disabled={savingProduct}
              value={productForm.basePrice}
              onChange={(e) => setProductForm(prev => ({ ...prev, basePrice: e.target.value }))}
              placeholder="1999.00"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-mono font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Base MRP */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">MRP / Original Price (₹) *</label>
            <input
              type="number"
              required
              min={0.01}
              step="0.01"
              disabled={savingProduct}
              value={productForm.baseMrp}
              onChange={(e) => setProductForm(prev => ({ ...prev, baseMrp: e.target.value }))}
              placeholder="3499.00"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-mono font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Fabric */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Fabric / Material</label>
            <input
              type="text"
              disabled={savingProduct}
              value={productForm.material || ''}
              onChange={(e) => setProductForm(prev => ({ ...prev, material: e.target.value }))}
              placeholder="E.g., 100% Egyptian Cotton Twill"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Fit */}
          <div className="space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Fit Type</label>
            <input
              type="text"
              disabled={savingProduct}
              value={productForm.fit || ''}
              onChange={(e) => setProductForm(prev => ({ ...prev, fit: e.target.value }))}
              placeholder="E.g., Tailored Slim Fit"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Care Instructions */}
          <div className="md:col-span-2 space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Care Instructions</label>
            <input
              type="text"
              disabled={savingProduct}
              value={productForm.careInstructions}
              onChange={(e) => setProductForm(prev => ({ ...prev, careInstructions: e.target.value }))}
              placeholder="E.g., Machine wash warm inside out, dry clean recommended"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

          {/* Tags */}
          <div className="md:col-span-2 space-y-1">
            <label className="block text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">Tags (Comma-separated)</label>
            <input
              type="text"
              disabled={savingProduct}
              value={productForm.tags}
              onChange={(e) => setProductForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="E.g., slimfit, chinos, summer, stretch"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white placeholder-gray-500 font-medium focus:outline-none focus:border-menx-primary focus:ring-1 focus:ring-menx-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-menx-surface/60 transition-colors"
            />
          </div>

        </div>

        {/* Set Featured */}
        <div className="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id="featuredProduct"
            disabled={savingProduct}
            checked={Boolean(productForm.isFeatured)}
            onChange={(e) => setProductForm(prev => ({ ...prev, isFeatured: e.target.checked }))}
            className="rounded text-menx-primary focus:ring-menx-primary bg-menx-bg border-menx-border disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="featuredProduct" className="text-xs text-menx-text-secondary font-bold cursor-pointer">
            Feature this product on homepage slides
          </label>
        </div>
      </AdminModal>

      {/* OVERLAY: Selected Product Variants Modal */}
      <AdminModal
        isOpen={Boolean(showVariantsModal && selectedProductForVariants)}
        onClose={() => {
          setShowVariantsModal(false);
          setSelectedProductForVariants(null);
          setVariantsError(null);
        }}
        maxWidth="max-w-5xl"
        title="Manage Variant Sizes"
        subtitle={`Product: ${selectedProductForVariants?.title || 'Product'}`}
        footer={(
          <button
            type="button"
            onClick={() => {
              setShowVariantsModal(false);
              setSelectedProductForVariants(null);
              setVariantsError(null);
            }}
            className="py-2.5 px-5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Done Managing Variants
          </button>
        )}
      >
        {selectedProductForVariants && (
          <div className="space-y-4">
            {/* Category Sizing Context Banner */}
            <div className="p-3 bg-menx-surface-elevated border border-menx-border rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-menx-primary flex-shrink-0" />
                <span className="text-menx-text-secondary">
                  Category Sizing: <strong className="text-white">{variantCategorySizeRule.label}</strong> ({variantCategorySizeRule.categoryType})
                </span>
              </div>
              <span className="text-[11px] text-menx-text-secondary font-mono">
                Allowed Sizes: [{variantCategorySizeRule.allowedSizes.join(', ')}]
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">

              {/* Left two columns: Variants list */}
              <div className="lg:col-span-2 space-y-4">

                <div className="bg-menx-surface-elevated border border-menx-border rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-menx-border pb-2">
                    <h4 className="font-bold text-white">Existing Active Variants</h4>
                    <span className="text-xs text-menx-text-muted font-mono">
                      {variants.length} {variants.length === 1 ? 'variant' : 'variants'}
                    </span>
                  </div>

                  {loadingVariants ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-menx-primary border-t-transparent"></div>
                      <span className="text-xs text-menx-text-muted">Loading variant sizes...</span>
                    </div>
                  ) : variantsError ? (
                    <div className="py-8 px-4 text-center space-y-3">
                      <AlertTriangle className="w-8 h-8 text-menx-primary mx-auto" />
                      <p className="text-xs text-menx-error font-medium">{variantsError}</p>
                      <button
                        type="button"
                        onClick={() => openVariantsModal(selectedProductForVariants)}
                        className="px-3 py-1.5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded text-xs font-bold transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !variants || variants.length === 0 ? (
                    <div className="py-8 text-center text-menx-text-muted font-medium space-y-1">
                      <p>No sizes/variants listed for this item yet.</p>
                      <p className="text-xs text-menx-text-muted">Use the form on the right to add available size and color combinations.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-855 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-menx-text-muted border-b border-menx-border text-[10px] uppercase font-bold">
                            <th className="py-2 pr-2">Size</th>
                            <th className="py-2 px-2">Color</th>
                            <th className="py-2 px-2">SKU</th>
                            <th className="py-2 px-2 text-right">Price</th>
                            <th className="py-2 px-2 text-right">Stock</th>
                            <th className="py-2 px-2 text-center">Status</th>
                            <th className="py-2 pl-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {variants.map(v => {
                            const isItemActive = v.is_active ?? v.isActive ?? true;
                            return (
                              <tr key={v.id} className="hover:bg-menx-surface-elevated/30 transition-colors">
                                <td className="py-2.5 pr-2 font-bold text-white">
                                  {getVariantSizeLabel(v)}
                                </td>
                                <td className="py-2.5 px-2 text-menx-text-secondary">
                                  <div className="flex items-center space-x-1.5">
                                    {getVariantColorHex(v) && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0 shadow-inner"
                                        style={{ backgroundColor: getVariantColorHex(v) }}
                                      />
                                    )}
                                    <span>{getVariantColorLabel(v)}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-menx-text-secondary font-mono text-[10px]">
                                  {v.sku}
                                </td>
                                <td className="py-2.5 px-2 text-right font-medium text-menx-primary">
                                  ₹{Number(v.selling_price || v.sellingPrice || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  {(() => {
                                    const variantStock = v.availableStock ?? v.quantityAvailable ?? v.quantity_available ?? v.stock?.available ?? v.stock ?? v.inventory?.quantity_available ?? 0;
                                    const threshold = Number(v.low_stock_threshold ?? 5);
                                    const numStock = Number(variantStock);
                                    return (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${numStock <= 0
                                        ? 'bg-menx-error/20 text-menx-error border border-menx-error/30'
                                        : numStock <= threshold
                                          ? 'bg-menx-warning/10 text-menx-warning border border-menx-warning/30'
                                          : 'bg-menx-success/10 text-menx-success border border-menx-success/20'
                                        }`}>
                                        {numStock}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVariantStatus(v)}
                                    className={`px-1.5 py-0.5 rounded font-mono text-[9px] border font-bold transition-colors ${isItemActive ? 'bg-menx-success/10 border-menx-success/20 text-menx-success hover:bg-menx-success/20' : 'bg-menx-error/10 border-menx-error/20 text-menx-error hover:bg-menx-error/20'
                                      }`}
                                  >
                                    {isItemActive ? 'ACTIVE' : 'INACTIVE'}
                                  </button>
                                </td>
                                <td className="py-2.5 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => openAdjustStockModal(v)}
                                    className="px-2 py-0.5 bg-menx-primary/10 border border-menx-primary/30 text-menx-primary hover:bg-menx-primary hover:text-[#0B0F14] rounded font-bold transition-colors"
                                  >
                                    Adjust Stock
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => populateVariantFormForEdit(v)}
                                    className="px-2 py-0.5 bg-menx-surface border border-menx-border rounded font-bold hover:text-white hover:bg-menx-surface-elevated transition-colors"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Right column: Variant Management Panel */}
              <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-menx-border pb-2">
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {variantForm.id ? 'Edit Variant Specifications' : 'Add Variants by Color Group'}
                    </h4>
                    <p className="text-[11px] text-menx-text-muted">
                      {variantForm.id
                        ? 'Update pricing, threshold or adjust stock for this variant.'
                        : 'Select a color, enter pricing, and set stock for multiple sizes.'}
                    </p>
                  </div>
                  {variantForm.id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-menx-primary/10 text-menx-primary border border-menx-primary/20">
                      Edit Mode
                    </span>
                  )}
                </div>

                {/* Status Notification Banner */}
                {!variantForm.id && colorGroupStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-start space-x-2 ${colorGroupStatus.type === 'success'
                      ? 'bg-menx-success/10 border border-menx-success/20 text-menx-success'
                      : colorGroupStatus.type === 'partial'
                        ? 'bg-menx-warning/10 border border-menx-warning/20 text-menx-warning'
                        : 'bg-menx-error/10 border border-menx-error/20 text-menx-error'
                      }`}
                  >
                    {colorGroupStatus.type === 'success' ? (
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-grow">
                      <span>{colorGroupStatus.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setColorGroupStatus(null)}
                      className="text-menx-text-muted hover:text-white ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Progress Bar Banner */}
                {!variantForm.id && colorGroupProgress.active && (
                  <div className="p-3 bg-menx-primary/10 border border-menx-primary/30 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-menx-primary">
                      <span>Creating Variants...</span>
                      <span>{colorGroupProgress.current} / {colorGroupProgress.total}</span>
                    </div>
                    <div className="w-full bg-menx-bg rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-menx-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(colorGroupProgress.current / colorGroupProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-menx-text-secondary font-mono">{colorGroupProgress.message}</p>
                  </div>
                )}

                {/* EDIT FORM (When variantForm.id is set) */}
                {variantForm.id ? (
                  <form onSubmit={handleVariantSubmit} className="space-y-3 text-xs">
                    {/* Selected variant info on edit */}
                    <div className="p-2.5 bg-menx-surface border border-menx-border rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="text-menx-text-secondary block text-[10px] uppercase font-bold">Variant Configuration</span>
                        <div className="flex items-center space-x-2 font-bold text-white mt-0.5">
                          <span>Size: {getVariantSizeLabel(variants.find(v => v.id === variantForm.id))}</span>
                          <span className="text-menx-text-muted">|</span>
                          <div className="flex items-center space-x-1.5">
                            {getVariantColorHex(variants.find(v => v.id === variantForm.id)) && (
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0 shadow-inner"
                                style={{ backgroundColor: getVariantColorHex(variants.find(v => v.id === variantForm.id)) }}
                              />
                            )}
                            <span>Color: {getVariantColorLabel(variants.find(v => v.id === variantForm.id))}</span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-menx-primary/10 text-menx-primary border border-menx-primary/20">
                        Editing
                      </span>
                    </div>

                    {/* SKU */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-menx-text-muted font-bold block">SKU Code *</label>
                      <input
                        type="text"
                        required
                        value={variantForm.sku}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, sku: e.target.value }))}
                        className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono font-bold"
                      />
                    </div>

                    {/* Barcode */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-menx-text-muted font-bold block">Barcode UPC *</label>
                      <input
                        type="text"
                        required
                        value={variantForm.barcode}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, barcode: e.target.value }))}
                        className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono"
                      />
                    </div>

                    {/* MRP */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-menx-text-muted font-bold block">Variant MRP (₹) *</label>
                      <input
                        type="number"
                        required
                        min={0.01}
                        step="0.01"
                        value={variantForm.mrp}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, mrp: e.target.value }))}
                        className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono"
                      />
                    </div>

                    {/* selling price */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-menx-text-muted font-bold block">Selling Price (₹) *</label>
                      <input
                        type="number"
                        required
                        min={0.01}
                        step="0.01"
                        value={variantForm.sellingPrice}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                        className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Weight */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-menx-text-muted font-bold block">Weight (Grams)</label>
                        <input
                          type="number"
                          value={variantForm.weightGrams}
                          onChange={(e) => setVariantForm(prev => ({ ...prev, weightGrams: e.target.value }))}
                          className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono"
                        />
                      </div>

                      {/* Low stock threshold */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-menx-text-muted font-bold block">Alert Threshold</label>
                        <input
                          type="number"
                          value={variantForm.lowStockThreshold}
                          onChange={(e) => setVariantForm(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                          className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Inline Inventory Section */}
                    {(() => {
                      const totalEditAvailable = (editVariantInventory || []).reduce((acc, item) => {
                        const qty = item.stock?.available ?? item.quantity_available ?? 0;
                        return acc + qty;
                      }, 0);

                      return (
                        <div className="pt-3 border-t border-menx-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-menx-primary uppercase tracking-wider">
                              Inventory & Stock
                            </span>
                            {loadingEditInventory ? (
                              <span className="text-[10px] text-menx-text-muted">Loading stock...</span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-menx-text-secondary">
                                Total Available: <strong className="text-white">{totalEditAvailable}</strong>
                              </span>
                            )}
                          </div>

                          {/* Current Stock (Read-Only) */}
                          <div className="bg-menx-surface border border-menx-border rounded-lg p-2.5 space-y-2">
                            <div className="flex justify-between items-center text-[10px] text-menx-text-secondary">
                              <span className="font-bold uppercase tracking-wider">Current Stock:</span>
                              <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${totalEditAvailable === 0
                                ? 'bg-menx-error/10 border border-menx-error/20 text-menx-error'
                                : totalEditAvailable <= (parseInt(variantForm.lowStockThreshold, 10) || 5)
                                  ? 'bg-menx-warning/10 border border-menx-warning/20 text-menx-warning'
                                  : 'bg-menx-success/10 border border-menx-success/20 text-menx-success'
                                }`}>
                                {totalEditAvailable} units ({totalEditAvailable === 0 ? 'OUT OF STOCK' : totalEditAvailable <= (parseInt(variantForm.lowStockThreshold, 10) || 5) ? 'LOW STOCK' : 'IN STOCK'})
                              </span>
                            </div>
                          </div>

                          {/* Inline Stock Adjustment Controls */}
                          <div className="bg-menx-surface border border-menx-border rounded-lg p-2.5 space-y-2">
                            <div className="text-[10px] text-menx-text-secondary font-bold uppercase tracking-wider">
                              Stock Adjustment
                            </div>

                            {editStockAdjustmentError && (
                              <div className="p-2 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded text-[10px] font-bold">
                                {editStockAdjustmentError}
                              </div>
                            )}

                            {editStockAdjustmentSuccess && (
                              <div className="p-2 bg-menx-success/10 border border-menx-success/20 text-menx-success rounded text-[10px] font-bold">
                                {editStockAdjustmentSuccess}
                              </div>
                            )}

                            {/* Quantity & Movement Type */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-menx-text-muted font-bold block">Adjustment (+ / -)</label>
                                <input
                                  type="number"
                                  step="1"
                                  value={editStockAdjustment.quantity}
                                  onChange={(e) => setEditStockAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                                  className="w-full bg-menx-bg border border-menx-border rounded-lg p-1.5 text-white font-mono font-bold text-xs"
                                  placeholder="e.g. 10 or -5"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] text-menx-text-muted font-bold block">Movement Type</label>
                                <select
                                  value={editStockAdjustment.movementType}
                                  onChange={(e) => setEditStockAdjustment(prev => ({ ...prev, movementType: e.target.value }))}
                                  className="w-full bg-menx-bg border border-menx-border rounded-lg p-1.5 text-white font-bold text-xs"
                                >
                                  <option value="PURCHASE_RECEIPT">PURCHASE_RECEIPT (Stock In)</option>
                                  <option value="INVENTORY_ADJUSTMENT">INVENTORY_ADJUSTMENT</option>
                                  <option value="CYCLE_COUNT">CYCLE_COUNT (Audit)</option>
                                  <option value="DAMAGED_WRITEOFF">DAMAGED_WRITEOFF</option>
                                  <option value="INITIAL_STOCK">INITIAL_STOCK</option>
                                </select>
                              </div>
                            </div>

                            {/* Reason */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-menx-text-muted font-bold block">Reason / Reference</label>
                              <input
                                type="text"
                                value={editStockAdjustment.reason}
                                onChange={(e) => setEditStockAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="e.g. Stock received, PO-102"
                                className="w-full bg-menx-bg border border-menx-border rounded-lg p-1.5 text-white text-xs"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={savingEditStockAdjustment}
                              onClick={handleEditStockAdjustmentSubmit}
                              className="w-full py-1.5 bg-menx-primary/10 hover:bg-menx-primary border border-menx-primary/30 text-menx-primary hover:text-[#0B0F14] font-extrabold rounded-lg text-xs transition-all flex items-center justify-center space-x-1"
                            >
                              {savingEditStockAdjustment ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-t border-amber-400 mr-1.5" />
                                  <span>Updating Stock...</span>
                                </>
                              ) : (
                                <span>Update Stock</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    <button
                      type="submit"
                      disabled={savingVariant}
                      className="w-full py-2 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated font-extrabold rounded-lg text-xs transition-colors"
                    >
                      {savingVariant ? 'Saving...' : 'Update Variant'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const defaultSizeId = sizes.length > 0 ? sizes[0].id : '';
                        const defaultColorId = colors.length > 0 ? colors[0].id : '';
                        const safeSlug = (selectedProductForVariants?.slug || 'PROD').slice(0, 10).toUpperCase();
                        setEditVariantInventory([]);
                        setEditStockAdjustmentError(null);
                        setEditStockAdjustmentSuccess(null);
                        setVariantForm({
                          id: '',
                          sizeId: defaultSizeId,
                          colorId: defaultColorId,
                          sku: `${safeSlug}-${Math.floor(1000 + Math.random() * 9000)}`,
                          barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
                          mrp: selectedProductForVariants?.baseMrp || selectedProductForVariants?.base_mrp || '',
                          sellingPrice: selectedProductForVariants?.basePrice || selectedProductForVariants?.base_price || '',
                          weightGrams: 300,
                          lowStockThreshold: 5,
                          initialStock: 0,
                          isActive: true
                        });
                      }}
                      className="w-full py-1.5 border border-menx-border hover:bg-menx-surface-elevated rounded-lg text-gray-450 hover:text-white transition-colors"
                    >
                      Cancel Edit
                    </button>
                  </form>
                ) : (
                  /* COLOR GROUP BULK CREATION WORKFLOW */
                  <form onSubmit={handleColorGroupSubmit} className="space-y-4 text-xs">
                    {/* SECTION 1 — COLOR */}
                    <div className="space-y-1.5 bg-menx-surface border border-menx-border p-3 rounded-xl">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] text-menx-text font-bold uppercase tracking-wider">
                          1. Select Color Shade *
                        </label>
                        {colorGroupColorId && (() => {
                          const cObj = colors.find(c => c.id === colorGroupColorId);
                          return cObj ? (
                            <span className="text-[10px] text-menx-primary font-bold flex items-center space-x-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: cObj.hex_code }}
                              />
                              <span>{cObj.name}</span>
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <HybridColorSelector
                        id="color-group-shade-selector"
                        value={colorGroupColorId}
                        onChange={(colorId) => {
                          setColorGroupColorId(colorId);
                          setColorGroupStatus(null);
                        }}
                        colors={filteredVariantColors}
                        onAddCustomColor={handleCreateCustomColor}
                        disabled={creatingColorGroup || loadingVariants}
                        required
                      />
                    </div>

                    {/* SECTION 2 — PRICING & SPECIFICATIONS */}
                    <div className="space-y-2 bg-menx-surface border border-menx-border p-3 rounded-xl">
                      <label className="text-[11px] text-menx-text font-bold uppercase tracking-wider block">
                        2. Pricing & Specifications (All Sizes)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-menx-text-muted font-bold block">MRP (₹) *</label>
                          <input
                            type="number"
                            required
                            min={0.01}
                            step="0.01"
                            value={colorGroupMrp}
                            onChange={(e) => setColorGroupMrp(e.target.value)}
                            className="w-full bg-menx-bg border border-menx-border rounded-lg p-2 text-white font-mono font-bold"
                            placeholder="e.g. 1999"
                            disabled={creatingColorGroup}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-menx-text-muted font-bold block">Selling Price (₹) *</label>
                          <input
                            type="number"
                            required
                            min={0.01}
                            step="0.01"
                            value={colorGroupSellingPrice}
                            onChange={(e) => setColorGroupSellingPrice(e.target.value)}
                            className="w-full bg-menx-bg border border-menx-border rounded-lg p-2 text-white font-mono font-bold"
                            placeholder="e.g. 1499"
                            disabled={creatingColorGroup}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-menx-text-muted font-bold block">Weight (Grams)</label>
                          <input
                            type="number"
                            min={1}
                            value={colorGroupWeightGrams}
                            onChange={(e) => setColorGroupWeightGrams(e.target.value)}
                            className="w-full bg-menx-bg border border-menx-border rounded-lg p-2 text-white font-mono"
                            placeholder="300"
                            disabled={creatingColorGroup}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-menx-text-muted font-bold block">Low Stock Alert</label>
                          <input
                            type="number"
                            min={0}
                            value={colorGroupLowStockThreshold}
                            onChange={(e) => setColorGroupLowStockThreshold(e.target.value)}
                            className="w-full bg-menx-bg border border-menx-border rounded-lg p-2 text-white font-mono"
                            placeholder="5"
                            disabled={creatingColorGroup}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3 — SIZE + INITIAL STOCK MATRIX */}
                    <div className="space-y-2 bg-menx-surface border border-menx-border p-3 rounded-xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="text-[11px] text-menx-text font-bold uppercase tracking-wider block">
                            3. Size + Initial Stock Matrix
                          </label>
                          <span className="text-[10px] text-menx-text-muted">
                            Category: <strong className="text-menx-primary">{variantCategorySizeRule.label || 'Apparel'}</strong>
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={handleSelectAllAvailableSizes}
                            disabled={creatingColorGroup || filteredVariantSizes.length === 0}
                            className="px-2 py-0.5 text-[10px] font-bold text-menx-primary hover:bg-menx-primary/10 rounded transition-colors disabled:opacity-40"
                          >
                            Select All
                          </button>
                          <span className="text-menx-text-muted">|</span>
                          <button
                            type="button"
                            onClick={handleDeselectAllSizes}
                            disabled={creatingColorGroup}
                            className="px-2 py-0.5 text-[10px] font-bold text-menx-text-secondary hover:text-white rounded transition-colors disabled:opacity-40"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {filteredVariantSizes.length === 0 ? (
                        <div className="py-4 text-center text-menx-text-muted text-xs">
                          No sizes configured for this product category.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {filteredVariantSizes.map(sizeObj => {
                            const alreadyExists = isSizeExistingForColor(sizeObj.id, colorGroupColorId);
                            const isChecked = !alreadyExists && Boolean(colorGroupSizes[sizeObj.id]?.selected);
                            const stockVal = colorGroupSizes[sizeObj.id]?.stock ?? 0;

                            return (
                              <div
                                key={sizeObj.id}
                                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${alreadyExists
                                  ? 'bg-menx-bg/50 border-menx-border/40 opacity-60'
                                  : isChecked
                                    ? 'bg-menx-primary/5 border-menx-primary/40'
                                    : 'bg-menx-bg border-menx-border hover:border-menx-border/80'
                                  }`}
                              >
                                <label className="flex items-center space-x-2 cursor-pointer select-none flex-grow">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={alreadyExists || creatingColorGroup}
                                    onChange={() => handleToggleColorGroupSize(sizeObj.id)}
                                    className="rounded border-menx-border text-menx-primary focus:ring-menx-primary bg-menx-surface w-4 h-4"
                                  />
                                  <span className={`font-bold text-xs ${isChecked ? 'text-menx-primary' : 'text-white'}`}>
                                    {sizeObj.name}
                                  </span>
                                  {sizeObj.category_type && (
                                    <span className="text-[10px] text-menx-text-muted font-mono">
                                      ({sizeObj.category_type})
                                    </span>
                                  )}
                                </label>

                                {alreadyExists ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-menx-warning/10 text-menx-warning font-mono font-bold border border-menx-warning/20">
                                    ALREADY EXISTS
                                  </span>
                                ) : (
                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    <span className="text-[10px] text-menx-text-muted font-bold">Stock:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      disabled={!isChecked || creatingColorGroup}
                                      value={isChecked ? stockVal : ''}
                                      onChange={(e) => handleColorGroupStockChange(sizeObj.id, e.target.value)}
                                      placeholder="0"
                                      className="w-16 bg-menx-surface border border-menx-border rounded p-1 text-right text-xs font-mono font-bold text-white disabled:opacity-40 focus:border-menx-primary focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* CREATE BUTTON */}
                    <button
                      type="submit"
                      disabled={
                        creatingColorGroup ||
                        !colorGroupColorId ||
                        !colorGroupMrp ||
                        !colorGroupSellingPrice ||
                        parseFloat(colorGroupSellingPrice) > parseFloat(colorGroupMrp) ||
                        filteredVariantSizes.filter(s => !isSizeExistingForColor(s.id, colorGroupColorId) && colorGroupSizes[s.id]?.selected).length === 0
                      }
                      className="w-full py-2.5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted disabled:border disabled:border-menx-border text-[#0B0F14] font-extrabold rounded-xl text-xs transition-all shadow-md shadow-menx-primary/20 flex items-center justify-center space-x-2"
                    >
                      {creatingColorGroup ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent" />
                          <span>Creating Variants ({colorGroupProgress.current} / {colorGroupProgress.total})...</span>
                        </>
                      ) : (
                        <span>
                          {(() => {
                            const count = filteredVariantSizes.filter(s => !isSizeExistingForColor(s.id, colorGroupColorId) && colorGroupSizes[s.id]?.selected).length;
                            const colorObj = colors.find(c => c.id === colorGroupColorId);
                            const cName = colorObj?.name || 'Color';
                            if (count === 0) {
                              return `Select sizes for ${cName} to create variants`;
                            }
                            return `Create ${count} Variant${count === 1 ? '' : 's'} for ${cName}`;
                          })()}
                        </span>
                      )}
                    </button>
                  </form>
                )}
              </div>

            </div>
          </div>
        )}
      </AdminModal>

      {/* OVERLAY: Selected Product Images Modal */}
      <AdminModal
        isOpen={Boolean(showImagesModal && selectedProductForImages)}
        onClose={() => setShowImagesModal(false)}
        maxWidth="max-w-4xl"
        title="Manage Product Image Assets"
        subtitle={`Product: ${selectedProductForImages?.title || ''}`}
        closeDisabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
        footer={(
          <button
            type="button"
            onClick={() => setShowImagesModal(false)}
            className="py-2.5 px-5 bg-menx-surface-elevated hover:bg-menx-border text-white rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
          >
            Done Managing Images
          </button>
        )}
      >
        {selectedProductForImages && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">

            {/* Left two columns: Images grid */}
            <div className="lg:col-span-2 space-y-4">

              <div className="bg-menx-surface-elevated border border-menx-border rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-white border-b border-menx-border pb-2">Image Gallery</h4>

                {loadingImages ? (
                  <div className="py-12 flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t border-menx-primary"></div>
                  </div>
                ) : images.length === 0 ? (
                  <div className="py-6 text-center text-menx-text-muted font-medium">
                    No images uploaded for this product yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto p-1">
                    {images
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((img, idx) => (
                        <div key={img.id} className="relative group bg-menx-surface border border-menx-border rounded-xl overflow-hidden p-2 flex flex-col gap-2">
                          <div className="aspect-square bg-black flex items-center justify-center rounded-lg overflow-hidden relative">
                            <img
                              src={img.imageUrl || img.image_url}
                              alt={img.altText || 'Product image'}
                              className="object-cover w-full h-full"
                            />
                            {img.isPrimary && (
                              <span className="absolute top-2 left-2 bg-menx-primary text-[#0B0F14] text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Award className="w-2.5 h-2.5" />
                                <span>PRIMARY</span>
                              </span>
                            )}
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center text-[10px] text-menx-text-muted font-mono">
                              <span>Order: {img.displayOrder}</span>
                              {img.variantId && (
                                <span className="text-indigo-400 bg-indigo-500/10 px-1 rounded text-[8px] font-bold">
                                  Variant
                                </span>
                              )}
                            </div>

                            {img.altText ? (
                              <div className="text-[10px] text-menx-text-secondary truncate" title={img.altText}>
                                Alt: "{img.altText}"
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-650 italic">No alt text</div>
                            )}

                            {img.variantId && productVariantsForImages.length > 0 && (
                              <div className="text-[10px] text-indigo-400 truncate font-semibold" title={(() => {
                                const v = productVariantsForImages.find(varItem => varItem.id === img.variantId);
                                return v ? `${v.size?.name || ''} / ${v.color?.name || ''} (${v.sku})` : '';
                              })()}>
                                {(() => {
                                  const v = productVariantsForImages.find(varItem => varItem.id === img.variantId);
                                  return v ? `${v.size?.name || ''} / ${v.color?.name || ''}` : 'Mapped Variant';
                                })()}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleMoveImageOrder(idx, 'up')}
                                disabled={idx === 0 || movingImageId !== null || deletingImageId !== null || settingPrimaryImageId !== null || uploadingImage}
                                className="py-1 bg-menx-surface-elevated border border-menx-border rounded hover:text-white flex items-center justify-center disabled:opacity-30"
                              >
                                {movingImageId === img.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-t border-white" />
                                ) : (
                                  <ArrowUp className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveImageOrder(idx, 'down')}
                                disabled={idx === images.length - 1 || movingImageId !== null || deletingImageId !== null || settingPrimaryImageId !== null || uploadingImage}
                                className="py-1 bg-menx-surface-elevated border border-menx-border rounded hover:text-white flex items-center justify-center disabled:opacity-30"
                              >
                                {movingImageId === img.id ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-t border-white" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            <div className="flex gap-1.5 pt-1 border-t border-menx-border">
                              {!img.isPrimary ? (
                                <button
                                  type="button"
                                  disabled={settingPrimaryImageId !== null || deletingImageId !== null || movingImageId !== null || uploadingImage}
                                  onClick={() => handleSetPrimaryImage(img.id)}
                                  className="flex-grow py-1 bg-menx-primary/10 hover:bg-menx-primary disabled:bg-menx-surface-elevated text-menx-primary hover:text-[#0B0F14] disabled:text-menx-text-muted rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                >
                                  {settingPrimaryImageId === img.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-t border-menx-primary" />
                                  ) : (
                                    <span>Primary</span>
                                  )}
                                </button>
                              ) : (
                                <span className="flex-grow py-1 bg-menx-success/10 border border-menx-success/20 text-menx-success rounded text-[10px] font-bold text-center flex items-center justify-center space-x-0.5">
                                  <Check className="w-3 h-3" />
                                  <span>Cover</span>
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null || uploadingImage}
                                onClick={() => handleDeleteImage(img.id)}
                                className="p-1 text-red-450 hover:bg-menx-error/10 disabled:bg-menx-surface-elevated disabled:text-gray-705 rounded border border-menx-error/10 disabled:border-transparent flex items-center justify-center"
                              >
                                {deletingImageId === img.id ? (
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-menx-error" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right column: Image uploader */}
            <div className="bg-menx-surface-elevated border border-menx-border p-4 rounded-xl space-y-4">
              <h4 className="font-bold text-white border-b border-menx-border pb-2 flex items-center">
                <ImageIcon className="w-4 h-4 text-menx-primary mr-1.5" />
                <span>Upload Image File</span>
              </h4>

              <form onSubmit={handleImageUpload} className="space-y-4 text-xs">
                {/* File select */}
                <div className="space-y-1">
                  <label className="text-[10px] text-menx-text-muted font-bold block">File (JPEG, PNG, WEBP, Max 2MB) *</label>
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleImageFileChange(e.target.files[0] || null)}
                    className="w-full text-xs text-menx-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-menx-primary file:text-[#0B0F14] hover:file:bg-amber-600 disabled:opacity-40"
                    disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                  />

                  {/* Pre-upload local thumbnail preview */}
                  {imagePreviewUrl && (
                    <div className="mt-2.5 p-1.5 bg-menx-surface border border-menx-border rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={imagePreviewUrl} alt="Upload preview" className="w-9 h-9 object-cover rounded border border-menx-border" />
                        <span className="text-[10px] text-menx-text-secondary font-mono truncate max-w-[120px]">{imageFile.name}</span>
                      </div>
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => {
                          setImageFile(null);
                          if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                          setImagePreviewUrl(null);
                        }}
                        className="p-1 text-menx-text-muted hover:text-white disabled:opacity-30"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Associate Variant (Optional) */}
                {productVariantsForImages.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-menx-text-muted font-bold block">Associate with Variant (Optional)</label>
                    <select
                      value={imageVariantId}
                      onChange={(e) => setImageVariantId(e.target.value)}
                      className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-bold disabled:opacity-40"
                      disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                    >
                      <option value="">-- Generic (All Variants) --</option>
                      {productVariantsForImages.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.size?.name || 'No Size'} / {v.color?.name || 'No Color'} ({v.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Alt text */}
                <div className="space-y-1">
                  <label className="text-[10px] text-menx-text-muted font-bold block">Alt Text</label>
                  <input
                    type="text"
                    value={imageAltText}
                    onChange={(e) => setImageAltText(e.target.value)}
                    placeholder="E.g., Front view of product model"
                    className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white disabled:opacity-40"
                    disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                  />
                </div>

                {/* Display order */}
                <div className="space-y-1">
                  <label className="text-[10px] text-menx-text-muted font-bold block">Display Order</label>
                  <input
                    type="number"
                    min={0}
                    value={imageDisplayOrder}
                    onChange={(e) => setImageDisplayOrder(e.target.value)}
                    className="w-full bg-menx-surface border border-menx-border rounded-lg p-2 text-white font-mono disabled:opacity-40"
                    disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                  />
                </div>

                {/* Set Primary checkbox */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="primaryImageCheckbox"
                    checked={imageIsPrimary}
                    onChange={(e) => setImageIsPrimary(e.target.checked)}
                    className="rounded text-menx-primary focus:ring-menx-primary bg-menx-surface border-menx-border disabled:opacity-40"
                    disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                  />
                  <label htmlFor="primaryImageCheckbox" className="text-[10px] text-menx-text-secondary font-bold cursor-pointer">
                    Make this the primary catalog cover image
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={uploadingImage || !imageFile || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                  className="w-full py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated text-[#0B0F14] font-extrabold rounded-lg text-xs flex items-center justify-center"
                >
                  {uploadingImage ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-black mr-2" />
                      <span>Uploading to Bucket...</span>
                    </>
                  ) : (
                    <span>Upload Image</span>
                  )}
                </button>
              </form>
            </div>

          </div>
        )}
      </AdminModal>

      {/* OVERLAY: Delete Product Confirmation Modal */}
      <AdminModal
        isOpen={Boolean(showDeleteProductModal && selectedProductForDelete)}
        onClose={() => {
          setShowDeleteProductModal(false);
          setSelectedProductForDelete(null);
          setDeleteProductError(null);
        }}
        maxWidth="max-w-md"
        title="Delete Product?"
        icon={<Trash2 className="w-5 h-5 text-menx-error" />}
        closeDisabled={deletingProduct}
        footer={(
          <div className="flex space-x-3 w-full">
            <button
              type="button"
              disabled={deletingProduct}
              onClick={() => {
                setShowDeleteProductModal(false);
                setSelectedProductForDelete(null);
                setDeleteProductError(null);
              }}
              className="flex-1 py-2.5 bg-menx-bg hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingProduct}
              onClick={handleConfirmDeleteProduct}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              {deletingProduct ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-white mr-2" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Permanently Delete</span>
              )}
            </button>
          </div>
        )}
      >
        {selectedProductForDelete && (
          <div className="space-y-3 text-xs text-menx-text-secondary">
            <div className="bg-menx-bg border border-menx-border rounded-xl p-3.5 space-y-1.5 font-medium">
              <div className="text-white font-bold text-sm">{selectedProductForDelete.title}</div>
              <div className="text-menx-text-muted font-mono text-xs">{selectedProductForDelete.slug}</div>
            </div>

            <div className="p-3 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-menx-error mr-1 flex-shrink-0" />
                <span>Warning: Permanent Action</span>
              </div>
              <p className="text-[11px] leading-relaxed text-menx-error/90">
                This action permanently removes this product, its variants, inventory counts, and image assets from the catalog.
              </p>
            </div>

            {deleteProductError && (
              <div className="p-3 bg-red-950/80 border border-menx-error/40 rounded-xl text-red-200 text-xs leading-relaxed font-semibold">
                {deleteProductError}
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {/* OVERLAY: Category Create/Edit Modal */}
      <AdminModal
        isOpen={Boolean(showCategoryModal)}
        onClose={() => setShowCategoryModal(false)}
        maxWidth="max-w-lg"
        title={categoryForm.id ? 'Edit Category' : 'Create Category'}
        closeDisabled={savingCategory}
        formProps={{
          onSubmit: handleCategorySubmit,
        }}
        footer={(
          <div className="flex space-x-3 w-full">
            <button
              type="button"
              disabled={savingCategory}
              onClick={() => setShowCategoryModal(false)}
              className="flex-1 py-2.5 bg-menx-bg hover:bg-menx-surface-elevated border border-menx-border rounded-lg font-bold text-white disabled:opacity-50 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCategory}
              className="flex-1 py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] text-[#0B0F14] font-extrabold rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 text-xs"
            >
              {savingCategory ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-black mr-2" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{categoryForm.id ? 'Save Changes' : 'Create Category'}</span>
              )}
            </button>
          </div>
        )}
      >
        <div className="space-y-4 text-xs">
          {categoryFormError && (
            <div className="p-3 bg-red-950/80 border border-menx-error/40 rounded-xl text-red-200 text-xs font-semibold">
              {categoryFormError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-muted font-bold uppercase">Category Name *</label>
            <input
              type="text"
              required
              value={categoryForm.name}
              onChange={(e) => handleCategoryNameChange(e.target.value)}
              placeholder="E.g., Winter Jackets"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-muted font-bold uppercase">Slug *</label>
            <input
              type="text"
              required
              value={categoryForm.slug}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="winter-jackets"
              className="w-full bg-menx-surface-elevated border border-menx-border rounded-lg p-2.5 text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-muted font-bold uppercase">Description</label>
            <textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of the category..."
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-muted font-bold uppercase">Cover Image URL</label>
            <input
              type="url"
              value={categoryForm.imageUrl}
              onChange={(e) => setCategoryForm(prev => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] text-menx-text-muted font-bold uppercase">Display Order</label>
              <input
                type="number"
                min={0}
                value={categoryForm.displayOrder}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, displayOrder: e.target.value }))}
                className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-mono"
              />
            </div>

            {categoryForm.id && (
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="categoryActiveCheckbox"
                  checked={categoryForm.isActive}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded text-menx-primary focus:ring-menx-primary bg-menx-surface border-menx-border"
                />
                <label htmlFor="categoryActiveCheckbox" className="text-xs text-menx-text-secondary font-bold cursor-pointer">
                  Category Active
                </label>
              </div>
            )}
          </div>
        </div>
      </AdminModal>

      {/* OVERLAY: Category Delete Confirmation Modal */}
      <AdminModal
        isOpen={Boolean(showDeleteCategoryModal && selectedCategoryForDelete)}
        onClose={() => {
          setShowDeleteCategoryModal(false);
          setSelectedCategoryForDelete(null);
          setDeleteCategoryError(null);
        }}
        maxWidth="max-w-md"
        title="Permanently delete this category?"
        icon={<Trash2 className="w-5 h-5 text-menx-error" />}
        closeDisabled={deletingCategory}
        footer={(
          <div className="flex space-x-3 w-full">
            <button
              type="button"
              disabled={deletingCategory}
              onClick={() => {
                setShowDeleteCategoryModal(false);
                setSelectedCategoryForDelete(null);
                setDeleteCategoryError(null);
              }}
              className="flex-1 py-2.5 bg-menx-bg hover:bg-menx-surface-elevated border border-menx-border rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingCategory}
              onClick={handleConfirmDeleteCategory}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900/50 text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              {deletingCategory ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-white mr-2" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Permanently Delete</span>
              )}
            </button>
          </div>
        )}
      >
        {selectedCategoryForDelete && (
          <div className="space-y-3 text-xs text-menx-text-secondary">
            <div className="bg-menx-bg border border-menx-border rounded-xl p-3.5 space-y-1.5 font-medium">
              <div className="text-white font-bold text-sm">{selectedCategoryForDelete.name}</div>
              <div className="text-menx-text-muted font-mono text-xs">{selectedCategoryForDelete.slug}</div>
            </div>

            <div className="p-3 bg-menx-error/10 border border-menx-error/20 rounded-xl text-menx-error space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-menx-error mr-1 flex-shrink-0" />
                <span>Warning: Permanent Hard Delete</span>
              </div>
              <p className="text-[11px] leading-relaxed text-menx-error/90">
                This action permanently deletes the category and its associated catalogue data. This cannot be undone.
              </p>
            </div>

            {deleteCategoryError && (
              <div className="p-3 bg-red-950/80 border border-menx-error/40 rounded-xl text-red-200 text-xs leading-relaxed font-semibold">
                {deleteCategoryError}
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {/* OVERLAY: Adjust Stock Modal */}
      <AdminModal
        isOpen={Boolean(showAdjustStockModal && selectedVariantForAdjust)}
        onClose={() => {
          setShowAdjustStockModal(false);
          setSelectedVariantForAdjust(null);
        }}
        maxWidth="max-w-md"
        title="Adjust Stock"
        subtitle={selectedVariantForAdjust ? `SKU: ${selectedVariantForAdjust.sku} | Size: ${getVariantSizeLabel(selectedVariantForAdjust)} | Color: ${getVariantColorLabel(selectedVariantForAdjust)}` : ''}
        closeDisabled={savingStockAdjustment}
        formProps={{
          onSubmit: handleAdjustStockSubmit,
        }}
        footer={(
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => {
                setShowAdjustStockModal(false);
                setSelectedVariantForAdjust(null);
              }}
              className="flex-1 py-2.5 bg-menx-surface-elevated hover:bg-menx-border text-white font-bold rounded-lg transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingStockAdjustment}
              className="flex-1 py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated text-[#0B0F14] font-extrabold rounded-lg transition-colors text-xs"
            >
              {savingStockAdjustment ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </div>
        )}
      >
        <div className="space-y-3 text-xs">
          {adjustStockError && (
            <div className="p-3 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-lg text-xs font-bold">
              {adjustStockError}
            </div>
          )}

          {/* Quantity adjustment */}
          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-secondary font-bold block">
              Quantity Adjustment * (e.g. 25 for addition, -5 for deduction)
            </label>
            <input
              type="number"
              required
              step="1"
              value={adjustStockForm.quantity}
              onChange={(e) => setAdjustStockForm(prev => ({ ...prev, quantity: e.target.value }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-mono font-bold"
            />
          </div>

          {/* Movement Type */}
          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-secondary font-bold block">Movement Type *</label>
            <select
              required
              value={adjustStockForm.movementType}
              onChange={(e) => setAdjustStockForm(prev => ({ ...prev, movementType: e.target.value }))}
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white font-bold"
            >
              <option value="PURCHASE_RECEIPT">PURCHASE_RECEIPT (Stock In)</option>
              <option value="CYCLE_COUNT">CYCLE_COUNT (Inventory Audit)</option>
              <option value="AUDIT_CORRECTION">AUDIT_CORRECTION</option>
              <option value="DAMAGED_WRITEOFF">DAMAGED_WRITEOFF</option>
              <option value="PROMOTION">PROMOTION</option>
            </select>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-[10px] text-menx-text-secondary font-bold block">Reason / Notes</label>
            <input
              type="text"
              value={adjustStockForm.reason}
              onChange={(e) => setAdjustStockForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Stock received, PO-1024"
              className="w-full bg-menx-bg border border-menx-border rounded-lg p-2.5 text-white"
            />
          </div>
        </div>
      </AdminModal>

      {/* OVERLAY 13: Support Ticket Details & Conversation Modal */}
      <AdminModal
        isOpen={Boolean(selectedSupportTicket)}
        onClose={() => setSelectedSupportTicket(null)}
        maxWidth="max-w-4xl"
        icon={<HelpCircle className="w-6 h-6" />}
        title={selectedSupportTicket ? `Support Ticket #${selectedSupportTicket.ticket_number}` : ''}
        subtitle="Manage customer inquiries, order linkage, and direct staff replies."
        badge={selectedSupportTicket ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getSupportStatusBadge(selectedSupportTicket.status)}`}>
            {selectedSupportTicket.status}
          </span>
        ) : null}
        closeDisabled={updatingSupportTicketStatus || sendingSupportReply}
      >
        {selectedSupportTicket && (
          <div className="space-y-6">
            {/* Ticket Info Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-menx-surface-elevated p-4 rounded-xl border border-menx-border text-xs">
              <div className="space-y-1">
                <span className="text-menx-text-muted font-bold uppercase text-[9px] tracking-wider block">Customer</span>
                <p className="text-white font-bold">{selectedSupportTicket.customer?.first_name} {selectedSupportTicket.customer?.last_name || ''}</p>
                <p className="text-menx-text-secondary text-[11px]">{selectedSupportTicket.customer?.email}</p>
                {selectedSupportTicket.customer?.phone && (
                  <p className="text-menx-text-muted font-mono text-[10px]">{selectedSupportTicket.customer?.phone}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-menx-text-muted font-bold uppercase text-[9px] tracking-wider block">Category & Order</span>
                <p className="text-menx-primary font-semibold">{getSupportCategoryLabel(selectedSupportTicket.category)}</p>
                {selectedSupportTicket.order?.order_number ? (
                  <p className="text-menx-text-secondary">
                    Order: <span className="font-mono text-white font-bold">#{selectedSupportTicket.order.order_number}</span>
                  </p>
                ) : (
                  <p className="text-menx-text-muted italic">No order linked</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-menx-text-muted font-bold uppercase text-[9px] tracking-wider block">Timestamps</span>
                <p className="text-menx-text-secondary">Created: <span className="text-white">{formatDate(selectedSupportTicket.created_at)}</span></p>
                {selectedSupportTicket.resolved_at && (
                  <p className="text-menx-success">Resolved: {formatDate(selectedSupportTicket.resolved_at)}</p>
                )}
                {selectedSupportTicket.closed_at && (
                  <p className="text-menx-text-muted">Closed: {formatDate(selectedSupportTicket.closed_at)}</p>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="bg-menx-bg p-4 rounded-xl border border-menx-border/80 space-y-1.5">
              <span className="text-menx-primary font-bold uppercase text-[10px] tracking-wider">Subject</span>
              <h4 className="text-white font-bold text-sm leading-snug">{selectedSupportTicket.subject}</h4>
            </div>

            {/* Status Transition Control */}
            <div className="bg-menx-surface-elevated p-4 rounded-xl border border-menx-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-menx-primary" />
                  <span>Update Ticket Status</span>
                </span>
                <span className="text-menx-text-secondary text-[11px]">Current: <strong className="text-white">{selectedSupportTicket.status}</strong></span>
              </div>

              {supportStatusError && (
                <div className="p-2.5 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-lg text-xs font-semibold">
                  {supportStatusError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
                  <button
                    key={st}
                    disabled={updatingSupportTicketStatus || selectedSupportTicket.status === st}
                    onClick={() => handleUpdateSupportTicketStatus(st)}
                    className={`py-1.5 px-3.5 rounded-lg font-bold text-xs transition-all ${selectedSupportTicket.status === st
                      ? 'bg-menx-surface-elevated text-menx-text-muted cursor-not-allowed border border-menx-border'
                      : 'bg-menx-bg hover:bg-menx-primary hover:text-[#0B0F14] border border-menx-border text-menx-text-secondary'
                      }`}
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="space-y-3">
              <h4 className="font-bold text-white uppercase tracking-wider text-xs flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-menx-primary" />
                <span>Conversation Thread</span>
              </h4>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {/* Initial Customer Message */}
                <div className="bg-menx-bg border border-menx-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-menx-info flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{selectedSupportTicket.customer?.first_name || 'Customer'} (Original Request)</span>
                    </span>
                    <span className="text-menx-text-muted">{formatDate(selectedSupportTicket.created_at)}</span>
                  </div>
                  <p className="text-menx-text text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedSupportTicket.message}
                  </p>
                </div>

                {/* Messages in thread */}
                {selectedSupportTicket.messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-xl border space-y-2 ${msg.sender_type === 'ADMIN'
                      ? 'bg-menx-primary/5 border-menx-primary/20 ml-4 md:ml-8'
                      : 'bg-menx-bg border-menx-border mr-4 md:mr-8'
                      }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold flex items-center space-x-1 ${msg.sender_type === 'ADMIN' ? 'text-menx-primary' : 'text-menx-info'
                        }`}>
                        {msg.sender_type === 'ADMIN' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        <span>
                          {msg.sender_type === 'ADMIN'
                            ? `MENX Support Staff (${msg.sender?.first_name || 'Admin'})`
                            : (msg.sender?.first_name ? `${msg.sender.first_name} (Customer)` : 'Customer')}
                        </span>
                      </span>
                      <span className="text-menx-text-muted">{formatDate(msg.created_at)}</span>
                    </div>
                    <p className="text-menx-text text-xs leading-relaxed whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Reply Form */}
            {selectedSupportTicket.status !== 'CLOSED' ? (
              <form onSubmit={handleSendAdminReply} className="space-y-3 pt-2 border-t border-menx-border">
                <div className="space-y-1">
                  <label className="text-menx-text-secondary font-bold text-[10px] block uppercase tracking-wider">
                    Reply to Customer
                  </label>
                  <textarea
                    rows="3"
                    required
                    value={supportTicketReply}
                    onChange={(e) => setSupportTicketReply(e.target.value)}
                    placeholder="Type your official support response to the customer..."
                    className="w-full bg-menx-surface-elevated border border-menx-border rounded-xl p-3 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-menx-primary"
                  ></textarea>
                </div>

                {supportReplyError && (
                  <div className="p-2.5 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-lg text-xs font-semibold">
                    {supportReplyError}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingSupportReply || !supportTicketReply.trim()}
                    className="py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl text-xs transition-all flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingSupportReply ? 'Sending Reply...' : 'Send Customer Reply'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-menx-surface-elevated rounded-xl border border-menx-border text-center text-menx-text-muted text-xs">
                This ticket is marked as CLOSED. Transition to OPEN or IN_PROGRESS to send new replies.
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {/* OVERLAY 14: Suggestion & Feedback Review Modal */}
      <AdminModal
        isOpen={Boolean(selectedAdminSuggestion)}
        onClose={() => {
          setSelectedAdminSuggestion(null);
          setSuggestionUpdateError(null);
        }}
        maxWidth="max-w-2xl"
        icon={<Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />}
        title={selectedAdminSuggestion ? `Customer Feedback #${selectedAdminSuggestion.id?.slice(0, 8)}` : ''}
        subtitle="Review feedback submission and record internal staff roadmap notes."
        badge={selectedAdminSuggestion ? (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase flex-shrink-0 ${getSuggestionStatusBadge(selectedAdminSuggestion.status)}`}>
            {selectedAdminSuggestion.status}
          </span>
        ) : null}
        closeDisabled={updatingSuggestion}
        formProps={{
          onSubmit: handleSaveSuggestion,
        }}
        footer={(
          <div className="flex items-center gap-3 w-full">
            <button
              type="button"
              disabled={updatingSuggestion}
              onClick={() => {
                setSelectedAdminSuggestion(null);
                setSuggestionUpdateError(null);
              }}
              className="flex-1 py-2.5 bg-menx-surface-elevated hover:bg-menx-border disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingSuggestion}
              className="flex-1 py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl transition-all text-xs flex items-center justify-center space-x-2 shadow-lg shadow-menx-primary/10"
            >
              {updatingSuggestion ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent" />
                  <span>Saving Status...</span>
                </>
              ) : (
                <span>Save Feedback Status</span>
              )}
            </button>
          </div>
        )}
      >
        {selectedAdminSuggestion && (
          <div className="space-y-4 text-xs">
            {/* Customer Info & Date */}
            <div className="bg-menx-surface-elevated p-3.5 sm:p-4 rounded-xl border border-menx-border flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider block">Submitted By</span>
                {selectedAdminSuggestion.first_name || (selectedAdminSuggestion.customer && selectedAdminSuggestion.customer.first_name) ? (
                  <div className="truncate">
                    <span className="font-bold text-white">
                      {selectedAdminSuggestion.first_name || selectedAdminSuggestion.customer?.first_name}{' '}
                      {selectedAdminSuggestion.last_name || selectedAdminSuggestion.customer?.last_name || ''}
                    </span>
                    <span className="text-menx-text-secondary text-[11px] block truncate">
                      {selectedAdminSuggestion.email || selectedAdminSuggestion.customer?.email}
                    </span>
                  </div>
                ) : (
                  <span className="text-menx-text-secondary italic">Anonymous / Guest Customer</span>
                )}
              </div>
              <div className="sm:text-right shrink-0">
                <span className="text-[10px] text-menx-text-muted font-bold uppercase tracking-wider block">Received On</span>
                <span className="text-menx-text-secondary font-medium">{formatDate(selectedAdminSuggestion.created_at)}</span>
              </div>
            </div>

            {/* Feedback Message */}
            <div className="space-y-1.5">
              <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
                Feedback & Suggestion Message
              </label>
              <div className="bg-menx-bg p-3.5 sm:p-4 rounded-xl border border-menx-border text-menx-text text-xs leading-relaxed whitespace-pre-wrap font-medium break-words">
                {selectedAdminSuggestion.message}
              </div>
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5">
              <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
                Review Status <span className="text-menx-error">*</span>
              </label>
              <select
                required
                value={suggestionStatusUpdate}
                onChange={(e) => {
                  setSuggestionStatusUpdate(e.target.value);
                  if (suggestionUpdateError) setSuggestionUpdateError(null);
                }}
                disabled={updatingSuggestion}
                className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-menx-primary disabled:opacity-50"
              >
                <option value="NEW">NEW - Newly Received</option>
                <option value="IN_REVIEW">IN_REVIEW - Under Product Review</option>
                <option value="ACCEPTED">ACCEPTED - Accepted / Planned</option>
                <option value="REJECTED">REJECTED - Rejected / Out of Scope</option>
                <option value="IMPLEMENTED">IMPLEMENTED - Implemented & Released</option>
              </select>
            </div>

            {/* Admin Internal Note */}
            <div className="space-y-1.5">
              <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider flex items-center justify-between">
                <span>Internal Staff Note (Never shared with customer)</span>
                <span className="text-[9px] text-menx-primary/90 font-mono bg-menx-primary/10 px-1.5 py-0.5 rounded border border-menx-primary/20">Staff Only</span>
              </label>
              <textarea
                rows="3"
                value={suggestionAdminNote}
                onChange={(e) => setSuggestionAdminNote(e.target.value)}
                disabled={updatingSuggestion}
                placeholder="Add internal notes, feature roadmap linkage, or rejection reasons..."
                className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white text-xs placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary disabled:opacity-50"
              ></textarea>
            </div>

            {/* Error Banner */}
            {suggestionUpdateError && (
              <div className="p-3 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-xl text-xs font-semibold flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{suggestionUpdateError}</span>
              </div>
            )}
          </div>
        )}
      </AdminModal>
      {/* OVERLAY: Add Delivery PIN Code Modal */}
      <AdminModal
        isOpen={showAddPinModal}
        onClose={() => {
          if (!savingPin) {
            setShowAddPinModal(false);
            setPinFormError(null);
          }
        }}
        maxWidth="max-w-md"
        title="Add Delivery PIN Code"
        subtitle="Configure a new postal PIN code eligible for customer checkout."
        icon={<MapPin className="w-5 h-5 text-menx-primary" />}
        footer={(
          <div className="flex items-center space-x-3 w-full">
            <button
              type="button"
              disabled={savingPin}
              onClick={() => {
                setShowAddPinModal(false);
                setPinFormError(null);
              }}
              className="flex-1 py-2.5 bg-menx-surface-elevated hover:bg-menx-border disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingPin}
              onClick={handleCreatePin}
              className="flex-1 py-2.5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] disabled:bg-menx-surface-elevated disabled:text-menx-text-muted font-black rounded-xl transition-all text-xs flex items-center justify-center space-x-2 shadow-lg shadow-menx-primary/10 uppercase tracking-wider"
            >
              {savingPin ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-black border-t-transparent" />
                  <span>Adding PIN...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Add PIN Code</span>
                </>
              )}
            </button>
          </div>
        )}
      >
        <form onSubmit={handleCreatePin} className="space-y-4 text-xs">
          {/* PIN Code Field */}
          <div className="space-y-1.5">
            <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
              Postal PIN Code <span className="text-menx-error">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoFocus
              value={pinForm.pincode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPinForm(prev => ({ ...prev, pincode: val }));
                if (pinFormError) setPinFormError(null);
              }}
              placeholder="e.g. 534340"
              className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-menx-primary tracking-widest"
            />
            <p className="text-[10px] text-menx-text-muted">Must be exactly 6 numeric digits.</p>
          </div>

          {/* State Field */}
          <div className="space-y-1.5">
            <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
              State <span className="text-menx-error">*</span>
            </label>
            <select
              required
              value={pinForm.state}
              onChange={(e) => {
                setPinForm(prev => ({ ...prev, state: e.target.value }));
                if (pinFormError) setPinFormError(null);
              }}
              className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-menx-primary"
            >
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Telangana">Telangana</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Delhi">Delhi</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Kerala">Kerala</option>
              <option value="West Bengal">West Bengal</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Bihar">Bihar</option>
              <option value="Punjab">Punjab</option>
              <option value="Haryana">Haryana</option>
              <option value="Odisha">Odisha</option>
              <option value="Assam">Assam</option>
              <option value="Goa">Goa</option>
            </select>
          </div>

          {/* District / Area Field */}
          <div className="space-y-1.5">
            <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
              District / Region Name (Optional)
            </label>
            <input
              type="text"
              value={pinForm.district}
              onChange={(e) => setPinForm(prev => ({ ...prev, district: e.target.value }))}
              placeholder="e.g. West Godavari, Visakhapatnam, Tirupati"
              className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white text-xs focus:outline-none focus:ring-1 focus:ring-menx-primary font-medium"
            />
          </div>

          {/* Delivery Charge & SLA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
                Delivery Charge (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pinForm.baseDeliveryCharge}
                onChange={(e) => setPinForm(prev => ({ ...prev, baseDeliveryCharge: e.target.value }))}
                placeholder="20.00"
                className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-menx-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-menx-text-secondary font-bold text-[10px] uppercase tracking-wider block">
                Estimated Days
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={pinForm.estimatedDaysMin}
                  onChange={(e) => setPinForm(prev => ({ ...prev, estimatedDaysMin: e.target.value }))}
                  className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-menx-primary"
                />
                <span className="text-menx-text-muted font-bold">-</span>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={pinForm.estimatedDaysMax}
                  onChange={(e) => setPinForm(prev => ({ ...prev, estimatedDaysMax: e.target.value }))}
                  className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-menx-primary"
                />
              </div>
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="pt-2">
            <label className="flex items-center space-x-3 p-3 bg-menx-surface-elevated rounded-xl border border-menx-border cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pinForm.isActive}
                onChange={(e) => setPinForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-menx-primary focus:ring-menx-primary"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-white text-xs block">Active for Customer Delivery</span>
                <span className="text-[10px] text-menx-text-muted block">
                  Customers can immediately select and place orders using this PIN code.
                </span>
              </div>
            </label>
          </div>

          {/* Form Error Message */}
          {pinFormError && (
            <div className="p-3 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-xl text-xs font-semibold flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{pinFormError}</span>
            </div>
          )}
        </form>
      </AdminModal>
    </BaseLayout>
  );
}
