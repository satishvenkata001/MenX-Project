import { AdminExportService } from '../services/adminExport.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export class AdminExportController {
  /**
   * Handles GET /api/v1/admin/exports/products
   */
  static async exportProducts(req, res, next) {
    try {
      const { format, status, categoryId, stockStatus } = req.query;

      const actorContext = {
        userId: req.user?.id || req.profile?.id,
        role: req.profile?.role || 'ADMIN',
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      const result = await AdminExportService.exportProductsAndStock(
        { format, status, categoryId, stockStatus },
        actorContext
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer.length);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');

      return res.status(HTTP_STATUS.OK).send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles GET /api/v1/admin/exports/orders
   */
  static async exportOrders(req, res, next) {
    try {
      const { format, fromDate, toDate, orderStatus } = req.query;

      const actorContext = {
        userId: req.user?.id || req.profile?.id,
        role: req.profile?.role || 'ADMIN',
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      const result = await AdminExportService.exportOrders(
        { format, fromDate, toDate, orderStatus },
        actorContext
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.buffer.length);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');

      return res.status(HTTP_STATUS.OK).send(result.buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles GET /api/v1/admin/exports/summary
   */
  static async getSummary(req, res, next) {
    try {
      const summary = await AdminExportService.getExportSummary();
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
}
