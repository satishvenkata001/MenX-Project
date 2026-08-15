import * as adminOrderService from '../services/adminOrder.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const getOrdersAdminHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, search, storeId } = req.query;

    const result = await adminOrderService.getOrdersAdmin({ page, limit, status, search, storeId });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderDetailsAdminHandler = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await adminOrderService.getOrderDetailsAdmin(orderId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatusHandler = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const performedBy = req.profile.id;

    const result = await adminOrderService.updateOrderStatus(orderId, status, performedBy);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const recordCodCollectionHandler = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { amountCollected } = req.body;
    const performedBy = req.profile.id;

    const result = await adminOrderService.recordCodCollection(orderId, amountCollected, performedBy);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};
