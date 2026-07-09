import { sendError } from '../utils/apiResponse.js';

/**
 * Global error handling middleware.
 * Intercepts all thrown exceptions and returns standardized error payloads.
 */
export const errorHandler = (err, req, res, next) => {
  // Log full stack trace to the console
  console.error('Error Details:', {
    message: err.message,
    status: err.statusCode || 500,
    stack: err.stack,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Format consistent error response
  return sendError(res, message, null, statusCode);
};
