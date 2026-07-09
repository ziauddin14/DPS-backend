/**
 * Consistent success response helper.
 *
 * @param {object} res - Express response object.
 * @param {string} message - User-friendly message.
 * @param {object|array} [data={}] - Response data payload.
 * @param {number} [statusCode=200] - HTTP status code.
 */
export const sendSuccess = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Consistent error response helper.
 *
 * @param {object} res - Express response object.
 * @param {string} message - Error description.
 * @param {any} [data=null] - Extra error metadata or null.
 * @param {number} [statusCode=500] - HTTP status code.
 */
export const sendError = (res, message, data = null, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
};
