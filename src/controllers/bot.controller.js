const catchAsync = require('../utils/catchAsync');
const { botService } = require('../services');
const logger = require('../config/logger');

const updateBot = catchAsync(async (req, res) => {
  logger.info(`req.body.pair: ${req.body.pair}`);
  logger.info(`req.body.isReadyToBuy: ${req.body.isReadyToBuy}`);
  logger.info(`req.body.isReadyToSell: ${req.body.isReadyToSell}`);

  let pair = '';
  if (req.body.pair) {
    const pairArray = req.body.pair.split('USDT');
    pair = `USDT_${pairArray[0]}`;
  }
  const bot = await botService.getBotByPair(pair);
  bot.isReadyToBuy = req.body.isReadyToBuy;
  const botParams = {
    pair,
    // eslint-disable-next-line no-undef
    isReadyToBuy: isReadyToBuy === 1,
    // eslint-disable-next-line no-undef
    isReadyToSell: isReadyToSell === 1,
  };
  const updatedBot = await botService.updateBot(bot.id, botParams);
  res.send(updatedBot);
});

module.exports = {
  updateBot,
};
