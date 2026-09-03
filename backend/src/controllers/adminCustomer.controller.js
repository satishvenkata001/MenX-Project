import * as adminCustomerService from '../services/adminCustomer.service.js';
import { HTTP_STATUS } from '../config/constants.js';

/**
 * Handler for GET /api/v1/admin/customers
 */
export const getCustomersAdminHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { search } = req.query;

    const result = await adminCustomerService.getCustomersAdmin({ page, limit, search });
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handler for GET /api/v1/admin/customers/:customerId
 */
export const getCustomerDetailsAdminHandler = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const result = await adminCustomerService.getCustomerDetailsAdmin(customerId);
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};
