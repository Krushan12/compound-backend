import { body } from 'express-validator';
import { success } from '../utils/response.js';
import * as UserService from '../services/user.service.js';

export const updateValidators = [body('name').optional().isString(), body('email').optional().isEmail()];

export const profile = async (req, res) => {
  const out = await UserService.getProfile(req.user.id);
  return success(res, out, 'Profile');
};

export const update = async (req, res) => {
  const out = await UserService.updateProfile(req.user.id, req.body);
  return success(res, out, 'Profile updated');
};

export default { profile, update };
