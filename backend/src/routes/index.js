import { Router } from 'express';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import adminCatalogRoutes from './adminCatalog.routes.js';
import inventoryRoutes from './inventory.routes.js';
import cartRoutes from './cart.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import orderRoutes from './order.routes.js';
import adminOrderRoutes from './adminOrder.routes.js';
import returnRoutes from './return.routes.js';
import addressRoutes from './address.routes.js';
import adminCustomerRoutes from './adminCustomer.routes.js';
import supportRoutes from './support.routes.js';
import adminSupportRoutes from './adminSupport.routes.js';
import adminExportRoutes from './adminExport.routes.js';
import adminDeliveryZoneRoutes from './adminDeliveryZone.routes.js';

const apiRouter = Router();

// Mount Sub-routers
apiRouter.use('/auth', authRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/wishlist', wishlistRoutes);
apiRouter.use('/addresses', addressRoutes);
apiRouter.use('/admin', adminCatalogRoutes);
apiRouter.use('/admin', inventoryRoutes);
apiRouter.use('/admin', adminCustomerRoutes);
apiRouter.use('/admin', adminSupportRoutes);
apiRouter.use('/admin', adminExportRoutes);
apiRouter.use('/admin', adminDeliveryZoneRoutes);
apiRouter.use('/', catalogRoutes);
apiRouter.use('/', orderRoutes);
apiRouter.use('/', adminOrderRoutes);
apiRouter.use('/', returnRoutes);
apiRouter.use('/', supportRoutes);

export default apiRouter;
