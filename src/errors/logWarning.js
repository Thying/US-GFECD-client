export const logWarning = (code, message, context = {}) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[US-GFECD] ${code}: ${message}`, context);
  }
};