/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     PanCheckRequest:
 *       type: object
 *       required: [pan]
 *       properties:
 *         pan:
 *           type: string
 *           example: "ABCDE1234F"
 *     PanStatusDetails:
 *       type: object
 *       properties:
 *         APP_PAN_INQ:
 *           type: object
 *           properties:
 *             APP_PAN_NO:
 *               type: string
 *               example: "ABCDE1234F"
 *             APP_NAME:
 *               type: string
 *               example: "FIRST LAST"
 *             APP_STATUS:
 *               type: string
 *               example: "007"
 *             APP_STATUSDT:
 *               type: string
 *               example: "20-01-2024 14:09:30"
 *         APP_PAN_SUMM:
 *           type: object
 *           properties:
 *             APP_RESPONSE_DATE:
 *               type: string
 *               example: "20-10-2025 17:15:44"
 */

/**
 * @openapi
 * /auth/firebase-login:
 *   post:
 *     tags: [Auth]
 *     summary: Verify Firebase ID token and receive backend JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID token obtained after OTP verification on the client
 *     responses:
 *       200:
 *         description: Login successful
 */

/**
 * @openapi
 * /kyc/pan-check:
 *   post:
 *     tags: [KYC]
 *     summary: Check PAN KYC status (CVL KRA GetPanStatus)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PanCheckRequest'
 *     responses:
 *       200:
 *         description: Decrypted PAN status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PanStatusDetails'
 */

/**
 * NOTE: Other KYC endpoints (start, fetch-details, upload-documents, submit)
 * were intentionally removed to reflect the simplified flow.
 */

/**
 * @openapi
 * /payment/create-order:
 *   post:
 *     tags: [Payment]
 *     summary: Create a Razorpay order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 minimum: 1
 *                 description: Amount in rupees (will be converted to paise)
 *     responses:
 *       200:
 *         description: Order created
 */

/**
 * @openapi
 * /payment/subscription/status:
 *   get:
 *     tags: [Payment]
 *     summary: Get current subscription status for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 */

/**
 * @openapi
 * /user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 */

/**
 * @openapi
 * /user/update-profile:
 *   put:
 *     tags: [User]
 *     summary: Update the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated
 */

/**
 * @openapi
 * /webhooks/payment:
 *   post:
 *     tags: [Webhooks]
 *     summary: Razorpay payment webhook
 *     description: Sends Razorpay event payload. Include HMAC in `x-razorpay-signature` header computed with your webhook secret.
 *     parameters:
 *       - in: header
 *         name: x-razorpay-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC SHA256 over raw request body using Razorpay webhook secret
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Webhook processed
 */

/**
 * @openapi
 * /webhooks/kyc:
 *   post:
 *     tags: [Webhooks]
 *     summary: KYC status webhook (CVL KRA)
 *     description: Sends KYC status updates. Include HMAC in `x-webhook-signature` header computed with the configured secret.
 *     parameters:
 *       - in: header
 *         name: x-webhook-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC SHA256 over raw request body using configured webhook secret
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Webhook processed
 */

// This file only contains OpenAPI annotations for swagger-jsdoc to pick up.
export {};
