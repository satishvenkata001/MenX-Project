import { SupportService } from '../services/support.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const createTicketHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { subject, category, message, orderNumber, orderId } = req.body;

    const result = await SupportService.createTicket(userId, {
      subject,
      category,
      message,
      orderNumber,
      orderId
    });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result,
      message: 'Support request submitted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerTicketsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, category } = req.query;

    const result = await SupportService.getCustomerTickets(userId, {
      page,
      limit,
      status,
      category
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getCustomerTicketDetailsHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { ticketId } = req.params;

    const result = await SupportService.getCustomerTicketDetails(userId, ticketId);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const addCustomerMessageHandler = async (req, res, next) => {
  try {
    const userId = req.profile.id;
    const { ticketId } = req.params;
    const { message } = req.body;

    const result = await SupportService.addCustomerMessage(userId, ticketId, { message });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result,
      message: 'Reply sent successfully.'
    });
  } catch (err) {
    next(err);
  }
};
