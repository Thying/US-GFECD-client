export const createError = (code, message, context = {}) => {
  const error = new Error(message);
  error.code = code;
  error.context = context;
  error.name = 'UsGfecdError';
  return error;
};