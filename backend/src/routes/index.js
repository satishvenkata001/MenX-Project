import { Router } from 'express';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import catalogRoutes from './catalog.routes.js';
import adminCatalogRoutes from './adminCatalog.routes.js';
import inventoryRoutes from './inventory.routes.js';
import cartRoutes from './cart.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import orderRoutes from './order.routes.js';
import adminOrderRoutes from './adminOrder.routes.js';
import returnRoutes from './return.routes.js';
import addressRoutes from './address.routes.js';

const apiRouter = Router();

// Mount Sub-routers
apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/wishlist', wishlistRoutes);
apiRouter.use('/addresses', addressRoutes);
apiRouter.use('/admin', adminCatalogRoutes);
apiRouter.use('/admin', inventoryRoutes);
apiRouter.use('/', catalogRoutes);
apiRouter.use('/', orderRoutes);
apiRouter.use('/', adminOrderRoutes);
apiRouter.use('/', returnRoutes);

export default apiRouter;
