import { AdminSupportService } from '../services/adminSupport.service.js';
import { HTTP_STATUS } from '../config/constants.js';

export const listTicketsAdminHandler = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, category, search } = req.query;

    const result = await AdminSupportService.listTickets({
      page,
      limit,
      status,
      category,
      search
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getTicketDetailsAdminHandler = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const result = await AdminSupportService.getTicketDetailsAdmin(ticketId);

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const addAdminMessageHandler = async (req, res, next) => {
  try {
    const actorId = req.profile.id;
    const { ticketId } = req.params;
    const { message } = req.body;

    const result = await AdminSupportService.addAdminMessage(actorId, ticketId, { message });

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: result,
      message: 'Staff reply submitted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

export const transitionTicketStatusAdminHandler = async (req, res, next) => {
  try {
    const actorId = req.profile.id;
    const { ticketId } = req.params;
    const { status, comment } = req.body;

    const result = await AdminSupportService.transitionTicketStatus(actorId, ticketId, {
      status,
      comment
    });

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result,
      message: `Ticket status updated to ${status}`
    });
  } catch (err) {
    next(err);
  }
};
