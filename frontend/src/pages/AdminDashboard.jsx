import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';
import { 
  LayoutDashboard, Store, ShoppingBag, RotateCcw, AlertTriangle, 
  Search, Eye, Shield, Check, X, CreditCard, ChevronRight, Plus, 
  Trash2, Image as ImageIcon, Award, ArrowUp, ArrowDown, Settings
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  
  // Dashboard Tabs
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [stores, setStores] = useState([]);
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
  const [returnTransitionStatus, setReturnTransitionStatus] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [returnItemsConditions, setReturnItemsConditions] = useState({}); // itemId -> 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE'
  const [updatingReturnStatus, setUpdatingReturnStatus] = useState(false);

  // Tab - Low Stock
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockTotal, setLowStockTotal] = useState(0);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  // Tab - Product Catalog
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  
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

  // Variants modal
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
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
    isActive: true
  });
  const [savingVariant, setSavingVariant] = useState(false);

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

  // Determine permissions based on exact backend constants
  const hasInventoryRole = user && ['INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);
  const hasOrderRole = user && ['STORE_STAFF', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(user.role);

  // 1. Fetch Overview stats
  async function loadOverviewStats() {
    setLoadingStats(true);
    try {
      // Products count (public)
      const productsRes = await api.get('/products');
      setProductsCount(productsRes.data?.length || 0);

      // Stores count (inventory role required)
      if (hasInventoryRole) {
        const storesRes = await api.get('/admin/stores');
        setStores(storesRes.data || []);
      }

      // Orders stats (order role required)
      if (hasOrderRole) {
        const ordersRes = await api.get('/admin/orders?limit=1');
        setOrdersCount(ordersRes.data?.total || 0);

        const returnsRes = await api.get('/admin/returns?limit=1&status=REQUESTED');
        setReturnsCount(returnsRes.data?.pagination?.total || returnsRes.data?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load overview metrics:', err.message);
    } finally {
      setLoadingStats(false);
    }
  }

  // Load static metadata lists on mount
  async function loadCatalogMetadata() {
    if (!hasInventoryRole) return;
    try {
      const [catRes, subRes, brandRes, sizeRes, colorRes] = await Promise.all([
        api.get('/categories'),
        api.get('/subcategories'),
        api.get('/brands'),
        api.get('/sizes'),
        api.get('/colors')
      ]);
      setCategories(catRes.data || []);
      setSubcategories(subRes.data || []);
      setBrands(brandRes.data || []);
      setSizes(sizeRes.data || []);
      setColors(colorRes.data || []);
    } catch (err) {
      console.error('Failed to load catalog metadata lists:', err.message);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadOverviewStats();
      loadCatalogMetadata();
    }
  }, [user, isAuthenticated]);

  // 2. Fetch Orders
  async function fetchOrdersList() {
    if (!hasOrderRole) return;
    setLoadingOrders(true);
    try {
      const query = `/admin/orders?page=${orderPage}&limit=8${orderStatusFilter ? `&status=${orderStatusFilter}` : ''}${orderSearch ? `&search=${orderSearch}` : ''}`;
      const res = await api.get(query);
      setOrders(res.data?.orders || []);
      setOrdersTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch admin orders list:', err.message);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrdersList();
    }
  }, [activeTab, orderPage, orderStatusFilter, orderSearch]);

  // 3. Fetch Returns
  async function fetchReturnsList() {
    if (!hasOrderRole) return;
    setLoadingReturns(true);
    try {
      const query = `/admin/returns?page=${returnPage}&limit=8${returnStatusFilter ? `&status=${returnStatusFilter}` : ''}${returnSearch ? `&search=${returnSearch}` : ''}`;
      const res = await api.get(query);
      setReturns(res.data?.returns || []);
      setReturnsTotal(res.data?.pagination?.total || res.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch admin returns list:', err.message);
    } finally {
      setLoadingReturns(false);
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
    setLoadingLowStock(true);
    try {
      const res = await api.get(`/admin/inventory/low-stock?page=${lowStockPage}&limit=10`);
      setLowStockItems(res.data || []);
      setLowStockTotal(res.pagination?.total || res.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch low stock items:', err.message);
    } finally {
      setLoadingLowStock(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'low-stock') {
      fetchLowStockList();
    }
  }, [activeTab, lowStockPage]);

  // 5. Fetch Product Catalog
  async function fetchCatalogList() {
    if (!hasInventoryRole) return;
    setLoadingCatalog(true);
    try {
      const query = `/products?page=${catalogPage}&limit=8${catalogSearch ? `&search=${catalogSearch}` : ''}`;
      const res = await api.get(query);
      setCatalogProducts(res.data || []);
      setCatalogTotal(res.pagination?.total || res.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch catalog products:', err.message);
    } finally {
      setLoadingCatalog(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchCatalogList();
    }
  }, [activeTab, catalogPage, catalogSearch]);

  // Handle Order Status transition
  const handleUpdateOrderStatus = async (status) => {
    if (!selectedOrder) return;
    setUpdatingOrderStatus(true);
    try {
      const res = await api.patch(`/admin/orders/${selectedOrder.id}/status`, { status });
      setSelectedOrder(res.data);
      fetchOrdersList();
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
      const res = await api.post(`/admin/orders/${selectedOrder.id}/cod-collection`, {
        amountCollected: amount
      });
      setSelectedOrder(res.data);
      setCodAmount('');
      fetchOrdersList();
      alert('Cash collection recorded successfully');
    } catch (err) {
      alert(err.message || 'Failed to record cash collection');
    } finally {
      setRecordingCod(false);
    }
  };

  // Handle Return Status transition
  const handleUpdateReturnStatus = async (e) => {
    e.preventDefault();
    if (!selectedReturn || !returnTransitionStatus) return;

    const conditionsArray = [];
    if (['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus)) {
      const missingConditions = selectedReturn.items.some(
        item => !returnItemsConditions[item.id]
      );

      if (missingConditions) {
        alert('Please specify the condition on receipt for all items.');
        return;
      }

      selectedReturn.items.forEach(item => {
        conditionsArray.push({
          returnItemId: item.id,
          condition: returnItemsConditions[item.id]
        });
      });
    }

    setUpdatingReturnStatus(true);
    try {
      const res = await api.post(`/admin/returns/${selectedReturn.id}/status`, {
        status: returnTransitionStatus,
        comment: returnComment.trim() || null,
        itemsCondition: conditionsArray.length > 0 ? conditionsArray : null
      });

      setSelectedReturn(res.data);
      setReturnTransitionStatus('');
      setReturnComment('');
      fetchReturnsList();
      alert('Return status transitioned successfully');
    } catch (err) {
      alert(err.message || 'Failed to transition return status');
    } finally {
      setUpdatingReturnStatus(false);
    }
  };

  const openReturnDetailModal = (ret) => {
    setSelectedReturn(ret);
    const initialConds = {};
    (ret.items || []).forEach(i => {
      initialConds[i.id] = i.condition_on_receipt || 'RESELLABLE';
    });
    setReturnItemsConditions(initialConds);
  };

  // Product Catalog CRUD Mutators
  const openProductFormForCreate = () => {
    setProductForm({
      id: '',
      title: '',
      slug: '',
      description: '',
      categoryId: categories.length > 0 ? categories[0].id : '',
      subcategoryId: subcategories.length > 0 ? subcategories[0].id : '',
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

  const openProductFormForEdit = (prod) => {
    setProductForm({
      id: prod.id,
      title: prod.title,
      slug: prod.slug,
      description: prod.description || '',
      categoryId: prod.categoryId || prod.category_id || '',
      subcategoryId: prod.subcategoryId || prod.subcategory_id || '',
      brandId: prod.brandId || prod.brand_id || '',
      baseMrp: prod.baseMrp || prod.base_mrp || '',
      basePrice: prod.basePrice || prod.base_price || '',
      material: prod.material || '',
      careInstructions: prod.careInstructions || prod.care_instructions || '',
      tags: (prod.tags || []).join(', '),
      isFeatured: prod.isFeatured || prod.is_featured || false,
      status: prod.status || 'DRAFT'
    });
    setShowProductModal(true);
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
    if (!productForm.title || !productForm.slug || !productForm.description || !productForm.categoryId || !productForm.subcategoryId || !productForm.baseMrp) {
      alert('Please fill out all required fields.');
      return;
    }

    const mrp = parseFloat(productForm.baseMrp);
    const price = productForm.basePrice ? parseFloat(productForm.basePrice) : mrp;

    if (price > mrp) {
      alert('Base price cannot exceed base MRP.');
      return;
    }

    const tagsArray = productForm.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t !== '');

    const payload = {
      title: productForm.title,
      slug: productForm.slug,
      description: productForm.description,
      categoryId: productForm.categoryId,
      subcategoryId: productForm.subcategoryId,
      brandId: productForm.brandId || null,
      baseMrp: mrp,
      basePrice: price,
      material: productForm.material || null,
      careInstructions: productForm.careInstructions || null,
      tags: tagsArray,
      isFeatured: productForm.isFeatured,
      status: productForm.status
    };

    setSavingProduct(true);
    try {
      if (productForm.id) {
        await api.patch(`/admin/products/${productForm.id}`, payload);
        alert('Product updated successfully');
      } else {
        await api.post('/admin/products', payload);
        alert('Product created successfully');
      }
      setShowProductModal(false);
      fetchCatalogList();
    } catch (err) {
      alert(err.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleArchiveProduct = async (prodId) => {
    if (!window.confirm('Are you sure you want to archive this product? Archived products cannot be returned to draft/published directly.')) {
      return;
    }
    try {
      await api.post(`/admin/products/${prodId}/archive`);
      fetchCatalogList();
      alert('Product archived successfully');
    } catch (err) {
      alert(err.message || 'Failed to archive product');
    }
  };

  // Product Variants Manager
  const openVariantsModal = async (prod) => {
    setSelectedProductForVariants(prod);
    setShowVariantsModal(true);
    setLoadingVariants(true);
    // Reset variant form
    setVariantForm({
      id: '',
      sizeId: sizes.length > 0 ? sizes[0].id : '',
      colorId: colors.length > 0 ? colors[0].id : '',
      sku: `${prod.slug.slice(0, 10).toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`,
      barcode: `${Math.floor(100000000000 + Math.random()*900000000000)}`,
      mrp: prod.baseMrp || prod.base_mrp || '',
      sellingPrice: prod.basePrice || prod.base_price || '',
      weightGrams: 300,
      lowStockThreshold: 5,
      isActive: true
    });

    try {
      const res = await api.get(`/products/${prod.id}/variants`);
      setVariants(res.data || []);
    } catch (err) {
      console.error('Failed to load variants:', err.message);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleVariantSubmit = async (e) => {
    e.preventDefault();
    if (!variantForm.sku || !variantForm.barcode || !variantForm.mrp || !variantForm.sellingPrice) {
      alert('Please fill out all fields.');
      return;
    }

    const mrp = parseFloat(variantForm.mrp);
    const sellingPrice = parseFloat(variantForm.sellingPrice);

    if (sellingPrice > mrp) {
      alert('Selling price cannot exceed MRP.');
      return;
    }

    const payload = {
      sku: variantForm.sku,
      barcode: variantForm.barcode,
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
          colorId: variantForm.colorId
        });
        alert('Product variant created successfully');
      }
      
      // Reload variants list
      const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
      setVariants(res.data || []);

      // Reset variant form
      setVariantForm({
        id: '',
        sizeId: sizes.length > 0 ? sizes[0].id : '',
        colorId: colors.length > 0 ? colors[0].id : '',
        sku: `${selectedProductForVariants.slug.slice(0, 10).toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`,
        barcode: `${Math.floor(100000000000 + Math.random()*900000000000)}`,
        mrp: selectedProductForVariants.baseMrp || selectedProductForVariants.base_mrp || '',
        sellingPrice: selectedProductForVariants.basePrice || selectedProductForVariants.base_price || '',
        weightGrams: 300,
        lowStockThreshold: 5,
        isActive: true
      });
    } catch (err) {
      alert(err.message || 'Failed to save variant');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleToggleVariantStatus = async (variant) => {
    try {
      await api.patch(`/admin/variants/${variant.id}`, {
        isActive: !variant.isActive
      });
      // Reload variants
      const res = await api.get(`/products/${selectedProductForVariants.id}/variants`);
      setVariants(res.data || []);
      alert('Variant status updated');
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const populateVariantFormForEdit = (v) => {
    setVariantForm({
      id: v.id,
      sizeId: v.sizeId || v.size_id || '',
      colorId: v.colorId || v.color_id || '',
      sku: v.sku,
      barcode: v.barcode,
      mrp: v.mrp,
      sellingPrice: v.sellingPrice || v.selling_price || '',
      weightGrams: v.weightGrams || v.weight_grams || 300,
      lowStockThreshold: v.lowStockThreshold || v.low_stock_threshold || 5,
      isActive: v.isActive
    });
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
      alert('Product image uploaded successfully');
      
      // Reload images list
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));

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
      // Reload images
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
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
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
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
      // Reload list
      const res = await api.get(`/products/${selectedProductForImages.id}/images`);
      setImages(mapImagesToCamelCase(res.data || []));
    } catch (err) {
      alert(err.message || 'Failed to reorder images');
    } finally {
      setMovingImageId(null);
    }
  };

  // Status badges helpers
  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'CONFIRMED': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'PACKED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'SHIPPED': return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
      case 'OUT_FOR_DELIVERY': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'DELIVERED': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    }
  };

  const getReturnStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'APPROVED': return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
      case 'REJECTED': return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'PICKUP_SCHEDULED': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
      case 'RECEIVED_IN_STORE': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      case 'COMPLETED': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'CANCELLED': return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-800 pb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-2">
              <LayoutDashboard className="w-8 h-8 text-amber-500" />
              <span>Admin Control Panel</span>
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Authorized session for {user?.first_name} {user?.last_name || ''}.
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-1.5 rounded-lg text-sm font-semibold self-start md:self-auto uppercase tracking-wide">
            <Shield className="w-4 h-4" />
            <span>Role: {user?.role}</span>
          </div>
        </div>

        {/* Dashboard Tabs Navigation Row */}
        <div className="flex border-b border-gray-850 overflow-x-auto text-sm font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-6 border-b-2 transition-all ${
              activeTab === 'overview' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          
          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('catalog')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'catalog' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Product Catalog
            </button>
          )}

          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('stores')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'stores' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Stores
            </button>
          )}

          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'orders' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Fulfillment Orders
            </button>
          )}

          {hasOrderRole && (
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'returns' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Returns & Exchanges
            </button>
          )}

          {hasInventoryRole && (
            <button
              onClick={() => setActiveTab('low-stock')}
              className={`py-3 px-6 border-b-2 transition-all ${
                activeTab === 'low-stock' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Low Stock Warnings
            </button>
          )}
        </div>

        {/* LOADING STATS */}
        {loadingStats ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Stats cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Products Count */}
                  <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                    <div className="space-y-2">
                      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Active Products</h3>
                      <div className="text-3xl font-black text-white">{productsCount}</div>
                    </div>
                    <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Operational Stores */}
                  {hasInventoryRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Operational Stores</h3>
                        <div className="text-3xl font-black text-white">{stores.length}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <Store className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                  {/* Orders Total count */}
                  {hasOrderRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Orders</h3>
                        <div className="text-3xl font-black text-white">{ordersCount}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                  {/* Pending Returns count */}
                  {hasOrderRole && (
                    <div className="bg-gray-900 border border-gray-850 p-6 rounded-2xl flex items-center justify-between shadow-md">
                      <div className="space-y-2">
                        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">Requested Returns</h3>
                        <div className="text-3xl font-black text-white">{returnsCount}</div>
                      </div>
                      <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-xl">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                    </div>
                  )}

                </div>

                {/* Sub-grid: Welcome info or simple shortcuts */}
                <div className="p-6 bg-gray-900 border border-gray-855 rounded-2xl text-center max-w-xl mx-auto space-y-4 shadow-md">
                  <Shield className="w-12 h-12 text-amber-500 mx-auto" />
                  <h3 className="text-lg font-bold text-white">Manager Fulfilment Center</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-medium">
                    Use the tabs above to manage customer delivery operations, record Cash on Delivery collections, verify item-level receipt conditions for returns, and view real-time low-stock inventory warnings.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: PRODUCT CATALOG */}
            {activeTab === 'catalog' && hasInventoryRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Product Catalog Management</h2>
                    <p className="text-xs text-gray-400 mt-1">Manage brand products, active sizes/color variants, and gallery upload assets.</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={catalogSearch}
                        onChange={(e) => { setCatalogSearch(e.target.value); setCatalogPage(1); }}
                        placeholder="Search product title..."
                        className="bg-gray-955 border border-gray-855 rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-700 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-2.5" />
                    </div>

                    <button
                      onClick={openProductFormForCreate}
                      className="inline-flex items-center space-x-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </button>
                  </div>
                </div>

                {loadingCatalog ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : catalogProducts.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No products cataloged in database yet.
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-gray-300">
                        <thead className="bg-gray-955 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
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
                            <tr key={p.id} className="hover:bg-gray-850/20 transition-all font-medium">
                              <td className="py-4 px-4">
                                <div className="text-white font-bold">{p.title}</div>
                                <div className="text-xs text-gray-500 font-mono">{p.slug}</div>
                              </td>
                              <td className="py-4 px-4 text-gray-400">
                                {p.brands?.name || 'Generic'}
                              </td>
                              <td className="py-4 px-4 text-right text-white">₹{p.baseMrp || p.base_mrp}</td>
                              <td className="py-4 px-4 text-center text-xs">
                                <span className={`px-2 py-0.5 rounded border ${
                                  p.status === 'PUBLISHED' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                  p.status === 'ARCHIVED' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                }`}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center text-xs">
                                {p.isFeatured || p.is_featured ? (
                                  <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">YES</span>
                                ) : (
                                  <span className="text-gray-500">NO</span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => openProductFormForEdit(p)}
                                    className="px-2.5 py-1 bg-gray-955 hover:bg-gray-800 border border-gray-800 rounded text-xs font-bold text-amber-500"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => openVariantsModal(p)}
                                    className="px-2.5 py-1 bg-gray-955 hover:bg-gray-800 border border-gray-800 rounded text-xs font-bold text-indigo-400"
                                  >
                                    Sizes
                                  </button>
                                  <button
                                    onClick={() => openImagesModal(p)}
                                    className="px-2.5 py-1 bg-gray-955 hover:bg-gray-800 border border-gray-800 rounded text-xs font-bold text-purple-400"
                                  >
                                    Images
                                  </button>
                                  {p.status !== 'ARCHIVED' && (
                                    <button
                                      onClick={() => handleArchiveProduct(p.id)}
                                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded text-xs font-bold"
                                    >
                                      Archive
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-855">
                      <span className="text-gray-500 font-medium">
                        Showing {catalogProducts.length} of {catalogTotal} products
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={catalogPage === 1}
                          onClick={() => setCatalogPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={catalogPage * 8 >= catalogTotal}
                          onClick={() => setCatalogPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB: STORES */}
            {activeTab === 'stores' && hasInventoryRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl overflow-hidden shadow-md p-6 space-y-6">
                <h2 className="text-xl font-bold tracking-tight text-white">Registered Stores & Warehouses</h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-800">
                      <tr>
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-855">
                      {stores.map((store) => (
                        <tr key={store.id} className="hover:bg-gray-850/20 transition-all font-medium">
                          <td className="py-4 px-4 font-mono text-amber-500">{store.code}</td>
                          <td className="py-4 px-4 text-white">{store.name}</td>
                          <td className="py-4 px-4">
                            <span className="bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                              {store.type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-gray-400">
                            {store.city}, {store.state}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ORDERS */}
            {activeTab === 'orders' && hasOrderRole && (
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white">Fulfillment Orders</h2>
                  
                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    
                    {/* Status filter */}
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => { setOrderStatusFilter(e.target.value); setOrderPage(1); }}
                      className="bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-bold focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PACKED">Packed</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Search bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                        placeholder="Search by Order # or Phone..."
                        className="bg-gray-955 border border-gray-855 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-700 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingOrders ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No orders matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
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
                            <tr key={o.id} className="hover:bg-gray-850/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-amber-500">{o.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white">
                                  {o.customer ? `${o.customer.first_name} ${o.customer.last_name || ''}` : 'Guest'}
                                </div>
                                <div className="text-[11px] text-gray-500 font-mono">{o.customer_phone}</div>
                              </td>
                              <td className="py-4 px-4 text-xs text-gray-400">
                                {new Date(o.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getOrderStatusBadge(o.order_status)}`}>
                                  {o.order_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs">
                                <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 uppercase font-bold text-[9px]">
                                  {o.payment_method} - {o.payment_status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right text-white font-black">₹{o.total_payable}</td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => setSelectedOrder(o)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-gray-955 hover:bg-gray-805 border border-gray-800 rounded-lg text-xs font-bold text-amber-500 transition-colors"
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
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-855">
                      <span className="text-gray-500 font-medium">
                        Showing {orders.length} of {ordersTotal} orders
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={orderPage === 1}
                          onClick={() => setOrderPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-705 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={orderPage * 8 >= ordersTotal}
                          onClick={() => setOrderPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-gray-950 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-705 border border-gray-855 rounded-lg font-bold text-white"
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
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white">Returns & Exchanges</h2>
                  
                  {/* Filters / Search bar */}
                  <div className="flex flex-wrap gap-3 items-center text-xs">
                    
                    {/* Status filter */}
                    <select
                      value={returnStatusFilter}
                      onChange={(e) => { setReturnStatusFilter(e.target.value); setReturnPage(1); }}
                      className="bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-bold focus:outline-none"
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
                        className="bg-gray-955 border border-gray-855 rounded-lg pl-8 pr-3 py-2.5 text-white placeholder-gray-705 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <Search className="w-3.5 h-3.5 text-gray-600 absolute left-2.5 top-3" />
                    </div>

                  </div>
                </div>

                {loadingReturns ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : returns.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No return requests matching search filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-955 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
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
                            <tr key={r.id} className="hover:bg-gray-850/20 transition-all font-medium">
                              <td className="py-4 px-4 font-mono text-amber-500">{r.return_number}</td>
                              <td className="py-4 px-4 font-mono text-white">{r.order_number}</td>
                              <td className="py-4 px-4">
                                <div className="text-white">{r.first_name} {r.last_name || ''}</div>
                                <div className="text-[11px] text-gray-500 font-mono">{r.email}</div>
                              </td>
                              <td className="py-4 px-4 text-xs font-bold uppercase">{r.request_type}</td>
                              <td className="py-4 px-4 text-xs capitalize">{r.reason.replace(/_/g, ' ')}</td>
                              <td className="py-4 px-4 text-xs">
                                <span className={`px-2 py-0.5 rounded border ${getReturnStatusBadge(r.status)}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => openReturnDetailModal(r)}
                                  className="inline-flex items-center space-x-1 py-1.5 px-3 bg-gray-955 hover:bg-gray-855 border border-gray-800 rounded-lg text-xs font-bold text-amber-500 transition-colors"
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
                    <div className="flex justify-between items-center text-xs pt-4 border-t border-gray-855">
                      <span className="text-gray-500 font-medium">
                        Showing {returns.length} of {returnsTotal} return requests
                      </span>
                      <div className="flex gap-2">
                        <button
                          disabled={returnPage === 1}
                          onClick={() => setReturnPage(prev => Math.max(1, prev - 1))}
                          className="px-3.5 py-2 bg-gray-955 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
                        >
                          Prev
                        </button>
                        <button
                          disabled={returnPage * 8 >= returnsTotal}
                          onClick={() => setReturnPage(prev => prev + 1)}
                          className="px-3.5 py-2 bg-gray-955 hover:bg-gray-855 disabled:bg-gray-955 disabled:text-gray-700 border border-gray-855 rounded-lg font-bold text-white"
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
              <div className="bg-gray-900 border border-gray-855 rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                    <span>Low Stock Alerts</span>
                  </h2>
                </div>

                {loadingLowStock ? (
                  <div className="py-20 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t border-amber-500"></div>
                  </div>
                ) : lowStockItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium flex items-center justify-center space-x-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span>All store items are fully stocked. No warnings found.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-gray-950 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-gray-855">
                          <tr>
                            <th className="py-3 px-4">Store Outlet</th>
                            <th className="py-3 px-4">Item SKU</th>
                            <th className="py-3 px-4">Specs</th>
                            <th className="py-3 px-4 text-center">Available Stock</th>
                            <th className="py-3 px-4 text-center">Reserved</th>
                            <th className="py-3 px-4 text-center">Min Threshold</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {lowStockItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-850/20 transition-all font-medium text-xs">
                              <td className="py-4 px-4 text-white font-bold">{item.stores?.name || item.store_name}</td>
                              <td className="py-4 px-4 font-mono">{item.product_variants?.sku || item.sku}</td>
                              <td className="py-4 px-4 text-gray-400">
                                Size: {item.product_variants?.size || item.size} | Color: {item.product_variants?.color || item.color}
                              </td>
                              <td className="py-4 px-4 text-center font-bold text-red-400">
                                {item.quantity_available}
                              </td>
                              <td className="py-4 px-4 text-center font-mono">{item.quantity_reserved}</td>
                              <td className="py-4 px-4 text-center text-gray-500 font-mono">10</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* OVERLAY: Selected Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Manage Order #{selectedOrder.order_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getOrderStatusBadge(selectedOrder.order_status)}`}>
                  {selectedOrder.order_status}
                </span>
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Items details */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Product details */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Line Items</h4>
                  <div className="divide-y divide-gray-855">
                    {(selectedOrder.order_items || []).map((item) => (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">{item.product_title_snapshot}</h5>
                          <p className="text-gray-500 font-mono">
                            SKU: {item.variant_sku_snapshot} | Size: {item.size_snapshot} | Color: {item.color_snapshot}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">₹{item.line_total}</div>
                          <div className="text-[10px] text-gray-500">₹{item.unit_price_snapshot} x {item.quantity}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Snapshot */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-2">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Delivery Snapshot</h4>
                  {selectedOrder.shipping_snapshot ? (
                    <div className="text-xs text-gray-400 leading-relaxed font-medium">
                      <div className="font-bold text-white">{selectedOrder.shipping_snapshot.recipient_name}</div>
                      <div>
                        {selectedOrder.shipping_snapshot.address_line1}
                        {selectedOrder.shipping_snapshot.address_line2 && `, ${selectedOrder.shipping_snapshot.address_line2}`}
                        {selectedOrder.shipping_snapshot.landmark && ` (Near ${selectedOrder.shipping_snapshot.landmark})`}
                      </div>
                      <div>{selectedOrder.shipping_snapshot.city}, {selectedOrder.shipping_snapshot.state} - <span className="font-bold text-amber-500">{selectedOrder.shipping_snapshot.postal_code}</span></div>
                      <div className="pt-1">Phone: {selectedOrder.shipping_snapshot.phone_number}</div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">No snapshot found</div>
                  )}
                </div>

              </div>

              {/* Right column: Fulfilment controls */}
              <div className="space-y-4">
                
                {/* Price Summary */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-2.5">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Financials</h4>
                  <div className="space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{selectedOrder.subtotal_amount}</span>
                    </div>
                    {Number(selectedOrder.discount_amount) > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Discount:</span>
                        <span>-₹{selectedOrder.discount_amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Shipping Fee:</span>
                      <span>₹{selectedOrder.delivery_fee}</span>
                    </div>
                    <div className="border-t border-gray-800 pt-2 flex justify-between font-black text-sm text-white">
                      <span>Authoritative Total:</span>
                      <span className="text-amber-500">₹{selectedOrder.total_payable}</span>
                    </div>
                  </div>
                </div>

                {/* Status Transitions Form */}
                {getValidOrderStatusTransitions(selectedOrder.order_status).length > 0 && (
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2">Transition Order Status</h4>
                    <div className="flex flex-col gap-2">
                      {getValidOrderStatusTransitions(selectedOrder.order_status).map((target) => (
                        <button
                          key={target}
                          disabled={updatingOrderStatus}
                          onClick={() => handleUpdateOrderStatus(target)}
                          className="w-full py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/20 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center space-x-1"
                        >
                          {updatingOrderStatus ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-amber-500" />
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
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2 flex items-center">
                      <CreditCard className="w-4 h-4 text-amber-500 mr-1.5" />
                      <span>Record COD Collection</span>
                    </h4>
                    <form onSubmit={handleRecordCod} className="space-y-2">
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold block mb-1">Cash amount collected (₹) *</label>
                        <input
                          type="number"
                          required
                          value={codAmount}
                          onChange={(e) => setCodAmount(e.target.value)}
                          placeholder={`E.g., ${selectedOrder.total_payable}`}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-bold"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recordingCod}
                        className="w-full py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs transition-colors"
                      >
                        {recordingCod ? 'Processing...' : 'Collect Cash & Mark Paid'}
                      </button>
                    </form>
                  </div>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

      {/* OVERLAY: Selected Return Details Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Manage Return {selectedReturn.return_number}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getReturnStatusBadge(selectedReturn.status)}`}>
                  {selectedReturn.status}
                </span>
              </h3>
              <button
                onClick={() => setSelectedReturn(null)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Items details */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Product details */}
                <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Return Items</h4>
                  <div className="divide-y divide-gray-855">
                    {(selectedReturn.items || []).map((item) => (
                      <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs">
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">{item.product_title_snapshot}</h5>
                          <p className="text-gray-500 font-mono">
                            SKU: {item.variant_sku_snapshot} | Original Size: {item.size_snapshot} | Color: {item.color_snapshot}
                          </p>
                          {selectedReturn.request_type === 'EXCHANGE' && (
                            <p className="text-amber-500 font-bold">
                              Exchanging for Variant: {item.replacement_size || 'Size Code ' + item.replacement_variant_id}
                            </p>
                          )}
                          {item.condition_on_receipt && (
                            <p className="text-gray-400 font-medium">
                              Condition on receipt: <span className="text-white font-bold bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono text-[9px]">{item.condition_on_receipt}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className="font-bold text-white">Qty: {item.quantity}</span>
                          
                          {/* receipt condition input (Only shown when returnTransitionStatus is RECEIVED_IN_STORE or COMPLETED) */}
                          {['RECEIVED_IN_STORE', 'COMPLETED'].includes(returnTransitionStatus) && (
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[10px] text-gray-500 font-bold uppercase">Condition:</span>
                              <select
                                value={returnItemsConditions[item.id] || 'RESELLABLE'}
                                onChange={(e) => setReturnItemsConditions(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="bg-gray-900 border border-gray-800 text-[10px] text-white p-1 rounded font-bold"
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
                  <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl text-xs space-y-1">
                    <h4 className="font-bold text-gray-400 uppercase tracking-wider">Customer Comment</h4>
                    <p className="text-gray-305 italic">"{selectedReturn.customer_comment}"</p>
                  </div>
                )}

              </div>

              {/* Right column: Return status transition control */}
              <div className="space-y-4">
                
                {getValidReturnStatusTransitions(selectedReturn.status).length > 0 && (
                  <form onSubmit={handleUpdateReturnStatus} className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-4">
                    <h4 className="font-bold text-white border-b border-gray-855 pb-2">Transition Return Status</h4>
                    
                    {/* Status select dropdown */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase block">Next Status *</label>
                      <select
                        required
                        value={returnTransitionStatus}
                        onChange={(e) => setReturnTransitionStatus(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="">-- Choose Status --</option>
                        {getValidReturnStatusTransitions(selectedReturn.status).map(target => (
                          <option key={target} value={target}>{target.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    {/* Transition comments */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold uppercase block">Review Comment</label>
                      <textarea
                        rows={3}
                        value={returnComment}
                        onChange={(e) => setReturnComment(e.target.value)}
                        placeholder="E.g., Pickup scheduled with delivery partner, or items checked..."
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={updatingReturnStatus || !returnTransitionStatus}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
                    >
                      {updatingReturnStatus && <div className="animate-spin rounded-full h-3 w-3 border-t border-black mr-1" />}
                      <span>Apply Transition</span>
                    </button>
                  </form>
                )}

              </div>

            </div>

          </div>
        </div>
      )}

      {/* OVERLAY: Product Create/Edit Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white">{productForm.id ? 'Edit Catalog Product' : 'Create New Product'}</h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={productForm.title}
                    onChange={(e) => handleProductTitleChange(e.target.value)}
                    placeholder="E.g., Casual Slim Fit Chinos"
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-bold"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Slug *</label>
                  <input
                    type="text"
                    required
                    value={productForm.slug}
                    onChange={(e) => setProductForm(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="casual-slim-fit-chinos"
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Product Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Write detailed specifications regarding fabric composition, weave, fit..."
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-medium"
                  />
                </div>

                {/* Category ID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Category *</label>
                  <select
                    required
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-bold"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Subcategory ID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Subcategory *</label>
                  <select
                    required
                    value={productForm.subcategoryId}
                    onChange={(e) => setProductForm(prev => ({ ...prev, subcategoryId: e.target.value }))}
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-bold"
                  >
                    <option value="">-- Choose Subcategory --</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Brand ID */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Brand</label>
                  <select
                    value={productForm.brandId}
                    onChange={(e) => setProductForm(prev => ({ ...prev, brandId: e.target.value }))}
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-bold"
                  >
                    <option value="">-- Choose Brand --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Initial Status *</label>
                  <select
                    required
                    value={productForm.status}
                    onChange={(e) => setProductForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-bold"
                  >
                    <option value="DRAFT">DRAFT (Hidden from Shop)</option>
                    <option value="PUBLISHED">PUBLISHED (Active catalog)</option>
                  </select>
                </div>

                {/* Base MRP */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Base MRP (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="0.01"
                    value={productForm.baseMrp}
                    onChange={(e) => setProductForm(prev => ({ ...prev, baseMrp: e.target.value }))}
                    placeholder="MRP price"
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-mono font-bold"
                  />
                </div>

                {/* Base Price */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Base Selling Price (₹)</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={productForm.basePrice}
                    onChange={(e) => setProductForm(prev => ({ ...prev, basePrice: e.target.value }))}
                    placeholder="Selling price (Optional)"
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-mono font-bold"
                  />
                </div>

                {/* Material */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Material Composition</label>
                  <input
                    type="text"
                    value={productForm.material}
                    onChange={(e) => setProductForm(prev => ({ ...prev, material: e.target.value }))}
                    placeholder="E.g., 98% Cotton, 2% Elastane"
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-medium"
                  />
                </div>

                {/* Care Instructions */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Care Instructions</label>
                  <input
                    type="text"
                    value={productForm.careInstructions}
                    onChange={(e) => setProductForm(prev => ({ ...prev, careInstructions: e.target.value }))}
                    placeholder="E.g., Machine wash cold, tumble dry low"
                    className="w-full bg-gray-955 border border-gray-855 rounded-lg p-2.5 text-white font-medium"
                  />
                </div>

                {/* Tags */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={productForm.tags}
                    onChange={(e) => setProductForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="E.g., slimfit, chinos, summer, stretch"
                    className="w-full bg-gray-950 border border-gray-855 rounded-lg p-2.5 text-white font-medium"
                  />
                </div>

              </div>

              {/* Set Featured */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredProduct"
                  checked={productForm.isFeatured}
                  onChange={(e) => setProductForm(prev => ({ ...prev, isFeatured: e.target.checked }))}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-gray-955 border-gray-800"
                />
                <label htmlFor="featuredProduct" className="text-xs text-gray-400 font-bold cursor-pointer">
                  Feature this product on homepage slides
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="py-2.5 px-5 border border-gray-800 hover:bg-gray-800 rounded-lg text-xs font-bold text-gray-450 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black text-xs font-extrabold rounded-lg flex items-center space-x-1"
                >
                  {savingProduct && <div className="animate-spin rounded-full h-3 w-3 border-t border-black mr-1" />}
                  <span>Save Product</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* OVERLAY: Selected Product Variants Modal */}
      {showVariantsModal && selectedProductForVariants && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex flex-col">
                <span>Manage Variant Sizes</span>
                <span className="text-xs text-gray-450 font-normal mt-0.5">Product: {selectedProductForVariants.title}</span>
              </h3>
              <button
                onClick={() => setShowVariantsModal(false)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Variants list */}
              <div className="lg:col-span-2 space-y-4">
                
                <div className="bg-gray-955 border border-gray-855 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Existing Active Variants</h4>
                  
                  {loadingVariants ? (
                    <div className="py-12 flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t border-amber-500"></div>
                    </div>
                  ) : variants.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 font-medium">
                      No sizes/variants listed for this item yet. Use the form to add one.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-855 overflow-x-auto max-h-[350px]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-gray-500 uppercase tracking-wider font-bold">
                            <th className="pb-2">SKU</th>
                            <th className="pb-2">Size</th>
                            <th className="pb-2">Color</th>
                            <th className="pb-2 text-right">Selling Price</th>
                            <th className="pb-2 text-center">Status</th>
                            <th className="pb-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855">
                          {variants.map(v => (
                            <tr key={v.id} className="hover:bg-gray-850/10 font-medium">
                              <td className="py-2.5 font-mono text-amber-500">{v.sku}</td>
                              <td className="py-2.5 text-white">{v.sizes?.name || v.size}</td>
                              <td className="py-2.5 text-gray-400">{v.colors?.name || v.color}</td>
                              <td className="py-2.5 text-right text-white">₹{v.sellingPrice || v.selling_price}</td>
                              <td className="py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleVariantStatus(v)}
                                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] border font-bold ${
                                    v.isActive ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                                  }`}
                                >
                                  {v.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </button>
                              </td>
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => populateVariantFormForEdit(v)}
                                  className="px-2 py-0.5 bg-gray-900 border border-gray-800 rounded font-bold hover:text-white"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Right column: Create variant form */}
              <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-4">
                <h4 className="font-bold text-white border-b border-gray-855 pb-2">
                  {variantForm.id ? 'Edit Variant Specifications' : 'Add New Variant SKU'}
                </h4>
                
                <form onSubmit={handleVariantSubmit} className="space-y-3 text-xs">
                  {/* size select (Hidden in edit mode to preserve catalog keys) */}
                  {!variantForm.id && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold block">Size Option *</label>
                      <select
                        required
                        value={variantForm.sizeId}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, sizeId: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-bold"
                      >
                        {sizes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                      </select>
                    </div>
                  )}

                  {/* color select (Hidden in edit) */}
                  {!variantForm.id && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold block">Color Shade *</label>
                      <select
                        required
                        value={variantForm.colorId}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, colorId: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-bold"
                      >
                        {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* SKU */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">SKU Code *</label>
                    <input
                      type="text"
                      required
                      value={variantForm.sku}
                      onChange={(e) => setVariantForm(prev => ({ ...prev, sku: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono font-bold"
                    />
                  </div>

                  {/* Barcode */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">Barcode UPC *</label>
                    <input
                      type="text"
                      required
                      value={variantForm.barcode}
                      onChange={(e) => setVariantForm(prev => ({ ...prev, barcode: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  {/* MRP */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">Variant MRP (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0.01}
                      step="0.01"
                      value={variantForm.mrp}
                      onChange={(e) => setVariantForm(prev => ({ ...prev, mrp: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  {/* selling price */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0.01}
                      step="0.01"
                      value={variantForm.sellingPrice}
                      onChange={(e) => setVariantForm(prev => ({ ...prev, sellingPrice: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Weight */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold block">Weight (Grams)</label>
                      <input
                        type="number"
                        value={variantForm.weightGrams}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, weightGrams: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono"
                      />
                    </div>

                    {/* Low stock threshold */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold block">Alert Threshold</label>
                      <input
                        type="number"
                        value={variantForm.lowStockThreshold}
                        onChange={(e) => setVariantForm(prev => ({ ...prev, lowStockThreshold: e.target.value }))}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingVariant}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs"
                  >
                    {savingVariant ? 'Saving...' : variantForm.id ? 'Update Variant' : 'Add Variant'}
                  </button>

                  {variantForm.id && (
                    <button
                      type="button"
                      onClick={() => setVariantForm({
                        id: '',
                        sizeId: sizes.length > 0 ? sizes[0].id : '',
                        colorId: colors.length > 0 ? colors[0].id : '',
                        sku: `${selectedProductForVariants.slug.slice(0, 10).toUpperCase()}-${Math.floor(1000 + Math.random()*9000)}`,
                        barcode: `${Math.floor(100000000000 + Math.random()*900000000000)}`,
                        mrp: selectedProductForVariants.baseMrp || selectedProductForVariants.base_mrp || '',
                        sellingPrice: selectedProductForVariants.basePrice || selectedProductForVariants.base_price || '',
                        weightGrams: 300,
                        lowStockThreshold: 5,
                        isActive: true
                      })}
                      className="w-full py-1.5 border border-gray-800 hover:bg-gray-800 rounded-lg text-gray-450 hover:text-white"
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: Selected Product Images Modal */}
      {showImagesModal && selectedProductForImages && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-6">
            
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-white flex flex-col">
                <span>Manage Product Image Assets</span>
                <span className="text-xs text-gray-450 font-normal mt-0.5">Product: {selectedProductForImages.title}</span>
              </h3>
              <button
                disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                onClick={() => setShowImagesModal(false)}
                className="p-1 rounded-lg border border-gray-800 text-gray-400 hover:text-white disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              
              {/* Left two columns: Images grid */}
              <div className="lg:col-span-2 space-y-4">
                
                <div className="bg-gray-955 border border-gray-855 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-white border-b border-gray-855 pb-2">Image Gallery</h4>
                  
                  {loadingImages ? (
                    <div className="py-12 flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t border-amber-500"></div>
                    </div>
                  ) : images.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 font-medium">
                      No images uploaded for this product yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto p-1">
                      {images
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((img, idx) => (
                          <div key={img.id} className="relative group bg-gray-900 border border-gray-850 rounded-xl overflow-hidden p-2 flex flex-col gap-2">
                            <div className="aspect-square bg-black flex items-center justify-center rounded-lg overflow-hidden relative">
                              <img
                                src={img.imageUrl || img.image_url}
                                alt={img.altText || 'Product image'}
                                className="object-cover w-full h-full"
                              />
                              {img.isPrimary && (
                                <span className="absolute top-2 left-2 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <Award className="w-2.5 h-2.5" />
                                  <span>PRIMARY</span>
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                                <span>Order: {img.displayOrder}</span>
                                {img.variantId && (
                                  <span className="text-indigo-400 bg-indigo-500/10 px-1 rounded text-[8px] font-bold">
                                    Variant
                                  </span>
                                )}
                              </div>
                              
                              {img.altText ? (
                                <div className="text-[10px] text-gray-400 truncate" title={img.altText}>
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
                                  className="py-1 bg-gray-955 border border-gray-855 rounded hover:text-white flex items-center justify-center disabled:opacity-30"
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
                                  className="py-1 bg-gray-955 border border-gray-855 rounded hover:text-white flex items-center justify-center disabled:opacity-30"
                                >
                                  {movingImageId === img.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-t border-white" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              <div className="flex gap-1.5 pt-1 border-t border-gray-850">
                                {!img.isPrimary ? (
                                  <button
                                    type="button"
                                    disabled={settingPrimaryImageId !== null || deletingImageId !== null || movingImageId !== null || uploadingImage}
                                    onClick={() => handleSetPrimaryImage(img.id)}
                                    className="flex-grow py-1 bg-amber-500/10 hover:bg-amber-500 disabled:bg-gray-955 text-amber-500 hover:text-black disabled:text-gray-700 rounded text-[10px] font-bold transition-all flex items-center justify-center"
                                  >
                                    {settingPrimaryImageId === img.id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-t border-amber-500" />
                                    ) : (
                                      <span>Primary</span>
                                    )}
                                  </button>
                                ) : (
                                  <span className="flex-grow py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded text-[10px] font-bold text-center flex items-center justify-center space-x-0.5">
                                    <Check className="w-3 h-3" />
                                    <span>Cover</span>
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null || uploadingImage}
                                  onClick={() => handleDeleteImage(img.id)}
                                  className="p-1 text-red-450 hover:bg-red-500/10 disabled:bg-gray-955 disabled:text-gray-705 rounded border border-red-500/10 disabled:border-transparent flex items-center justify-center"
                                >
                                  {deletingImageId === img.id ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-red-500" />
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
              <div className="bg-gray-955 border border-gray-855 p-4 rounded-xl space-y-4">
                <h4 className="font-bold text-white border-b border-gray-855 pb-2 flex items-center">
                  <ImageIcon className="w-4 h-4 text-amber-500 mr-1.5" />
                  <span>Upload Image File</span>
                </h4>
                
                <form onSubmit={handleImageUpload} className="space-y-4 text-xs">
                  {/* File select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">File (JPEG, PNG, WEBP, Max 2MB) *</label>
                    <input
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleImageFileChange(e.target.files[0] || null)}
                      className="w-full text-xs text-gray-405 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-black hover:file:bg-amber-600 disabled:opacity-40"
                      disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                    />

                    {/* Pre-upload local thumbnail preview */}
                    {imagePreviewUrl && (
                      <div className="mt-2.5 p-1.5 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <img src={imagePreviewUrl} alt="Upload preview" className="w-9 h-9 object-cover rounded border border-gray-700" />
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]">{imageFile.name}</span>
                        </div>
                        <button
                          type="button"
                          disabled={uploadingImage}
                          onClick={() => {
                            setImageFile(null);
                            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                            setImagePreviewUrl(null);
                          }}
                          className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Associate Variant (Optional) */}
                  {productVariantsForImages.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 font-bold block">Associate with Variant (Optional)</label>
                      <select
                        value={imageVariantId}
                        onChange={(e) => setImageVariantId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-855 rounded-lg p-2 text-white font-bold disabled:opacity-40"
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
                    <label className="text-[10px] text-gray-500 font-bold block">Alt Text</label>
                    <input
                      type="text"
                      value={imageAltText}
                      onChange={(e) => setImageAltText(e.target.value)}
                      placeholder="E.g., Front view of product model"
                      className="w-full bg-gray-900 border border-gray-850 rounded-lg p-2 text-white disabled:opacity-40"
                      disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                    />
                  </div>

                  {/* Display order */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold block">Display Order</label>
                    <input
                      type="number"
                      min={0}
                      value={imageDisplayOrder}
                      onChange={(e) => setImageDisplayOrder(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-855 rounded-lg p-2 text-white font-mono disabled:opacity-40"
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
                      className="rounded text-amber-500 focus:ring-amber-500 bg-gray-900 border-gray-800 disabled:opacity-40"
                      disabled={uploadingImage || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                    />
                    <label htmlFor="primaryImageCheckbox" className="text-[10px] text-gray-400 font-bold cursor-pointer">
                      Make this the primary catalog cover image
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingImage || !imageFile || deletingImageId !== null || settingPrimaryImageId !== null || movingImageId !== null}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 text-black font-extrabold rounded-lg text-xs flex items-center justify-center"
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

          </div>
        </div>
      )}
    </BaseLayout>
  );
}
