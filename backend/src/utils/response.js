import { HTTP_STATUS } from '../config/constants.js';

export const sendResponse = (res, statusCode, data, message = null, meta = null) => {
  const responseBody = {
    status: `${statusCode}`.startsWith('2') ? 'success' : 'fail',
    statusCode,
    ...(message && { message }),
    ...(data !== undefined && { data }),
    ...(meta && { meta })
  };

  return res.status(statusCode).json(responseBody);
};

export const sendSuccess = (res, data, message = null, meta = null) => {
  return sendResponse(res, HTTP_STATUS.OK, data, message, meta);
};

export const sendCreated = (res, data, message = 'Resource created successfully') => {
  return sendResponse(res, HTTP_STATUS.CREATED, data, message);
};

export const sendNoContent = (res) => {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
};
