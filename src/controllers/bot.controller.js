const catchAsync = require('../utils/catchAsync');
const { botService } = require('../services');
const logger = require('../config/logger');

const updateBot = catchAsync(async (req, res) => {
  logger.info(`req.body.pair: ${req.body.pair}`);
  logger.info(`req.body.isReadyToBuy: ${req.body.isReadyToBuy}`);
  const bot = await botService.getBotByPair(req.body.pair);
  bot.isReadyToBuy = req.body.isReadyToBuy;
  const updatedBot = await botService.updateBot(bot.id, req.body);
  res.send(updatedBot);
});

module.exports = {
  updateBot,
};
