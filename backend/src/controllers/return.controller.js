import { ReturnService } from '../services/return.service.js';
import { AdminReturnService } from '../services/adminReturn.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const getEligibleItemsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const result = await ReturnService.getEligibleItems(userId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const createReturnRequestHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { orderId, requestType, reason, customerComment, items } = req.body;

    const result = await ReturnService.createReturnRequest(userId, {
      orderId,
      requestType,
      reason,
      customerComment,
      items
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getReturnsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await ReturnService.getReturns(userId, { page, limit });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getReturnDetailsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { returnId } = req.params;

    const result = await ReturnService.getReturnDetails(userId, returnId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const cancelReturnHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { returnId } = req.params;

    const result = await ReturnService.cancelReturn(userId, returnId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
};

export const listReturnsAdminHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, storeId, search } = req.query;

    const result = await AdminReturnService.listReturns(
      { page, limit, status, storeId, search },
      req.profile
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getReturnDetailsAdminHandler = async (req, res, next) => {
  try {
    const { returnId } = req.params;

    const result = await AdminReturnService.getReturnDetailsAdmin(returnId, req.profile);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const transitionReturnStatusHandler = async (req, res, next) => {
  try {
    const { returnId } = req.params;
    const { status, comment, itemsCondition } = req.body;
    const actorId = req.profile.id;

    const result = await AdminReturnService.transitionReturnStatus(
      returnId,
      status,
      { comment, itemsCondition },
      actorId,
      req.profile
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};
