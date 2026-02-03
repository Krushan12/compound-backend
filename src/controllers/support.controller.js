import { body, query, param } from 'express-validator';
import { success } from '../utils/response.js';
import * as SupportService from '../services/support.service.js';

export const getPublicChatMessagesValidators = [
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
  query('userId').optional().isString().trim().notEmpty().withMessage('userId must be a non-empty string'),
];

export const postPublicChatMessageValidators = [
  body('text').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Text is required'),
  body('replyToId').optional({ nullable: true }).isString().trim().notEmpty().withMessage('replyToId must be a non-empty string'),
  body('userId').optional({ nullable: true }).isString().trim().notEmpty().withMessage('userId must be a non-empty string'),
];

export const getPublicChatMessages = async (req, res) => {
  const userId = req.user.id;
  const mobile = req.user.mobile;
  const isAdmin = SupportService.isAdminUser(mobile);
  await SupportService.assertChatAccess(userId, mobile);

  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
  const selectedUserId = isAdmin ? req.query.userId : null;
  if (isAdmin && !selectedUserId) {
    return success(res, { messages: [] }, 'No conversation selected');
  }
  const messages = await SupportService.listPublicChatMessages({
    limit,
    userId: selectedUserId || userId,
  });

  return success(res, { messages }, 'Public chat messages fetched');
};

export const postPublicChatMessage = async (req, res) => {
  const userId = req.user.id;
  const mobile = req.user.mobile;
  const isAdmin = SupportService.isAdminUser(mobile);
  await SupportService.assertChatAccess(userId, mobile);

  const { text, replyToId, userId: targetUserId } = req.body;
  if (isAdmin && !targetUserId) {
    return res.status(400).json({ success: false, message: 'userId is required for admin messages' });
  }
  const message = await SupportService.createPublicChatMessage(
    isAdmin ? targetUserId : userId,
    mobile,
    text ? String(text).trim() : '',
    replyToId ? String(replyToId).trim() : null,
  );

  return success(res, { message }, 'Message posted');
};

export const getMeAdminStatus = async (req, res) => {
  const isAdmin = SupportService.isAdminUser(req.user.mobile);
  return success(res, { isAdmin }, 'OK');
};

export const deletePublicChatMessageValidators = [
  param('id').isString().trim().notEmpty().withMessage('id is required'),
];

export const deletePublicChatMessage = async (req, res) => {
  const userId = req.user.id;
  const mobile = req.user.mobile;
  await SupportService.assertChatAccess(userId, mobile);
  const isAdmin = SupportService.isAdminUser(mobile);
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Only Compound Team can delete messages' });
  }
  const { id } = req.params;
  await SupportService.deletePublicChatMessage(id);
  return success(res, { id }, 'Message deleted');
};

export const getChatThreads = async (req, res) => {
  const mobile = req.user.mobile;
  const isAdmin = SupportService.isAdminUser(mobile);
  if (!isAdmin) {
    return res.status(403).json({ success: false, message: 'Only Compound Team can access chat threads' });
  }
  const threads = await SupportService.listChatThreads();
  return success(res, { threads }, 'Chat threads fetched');
};

export default {
  getPublicChatMessages,
  postPublicChatMessage,
  getMeAdminStatus,
  getChatThreads,
  deletePublicChatMessage,
};
