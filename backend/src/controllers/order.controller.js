import * as orderService from '../services/order.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const validateCheckoutHandler = async (req, res, next) => {
  try {
    const { addressId, couponCode } = req.body;
    const userId = req.profile.id;

    const result = await orderService.validateCheckout(userId, addressId, couponCode);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const createOrderHandler = async (req, res, next) => {
  try {
    const { addressId, couponCode, customerNotes, paymentMethod } = req.body;
    const userId = req.profile.id;

    const result = await orderService.createOrder(
      userId,
      addressId,
      couponCode,
      customerNotes,
      paymentMethod
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getOrdersHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    const result = await orderService.getOrders(userId, { page, limit, status });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderDetailsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { orderId } = req.params;

    const result = await orderService.getOrderDetails(userId, orderId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getOrderStatusHistoryHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { orderId } = req.params;

    const result = await orderService.getOrderStatusHistory(userId, orderId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const cancelOrderHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { orderId } = req.params;
    const { reason } = req.body;

    const result = await orderService.cancelOrder(userId, orderId, reason);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
};
