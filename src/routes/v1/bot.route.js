const express = require('express');
const botController = require('../../controllers/bot.controller');

const router = express.Router();

router.post('/update', botController.updateBot);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Bot
 *   description: Bot
 */

/**
 * @swagger
 * /update:
 *   post:
 *     summary: update the bot
 *     description: updating the bot
 *     tags: [Bot]
 *     responses:
 *       "204":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
