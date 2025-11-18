export const success = (res, data = {}, message = 'OK', status = 200) => {
  return res.status(status).json({ success: true, message, data });
};

export const error = (res, message = 'Error', status = 500, details = undefined) => {
  return res.status(status).json({ success: false, message, details });
};

export default { success, error };
