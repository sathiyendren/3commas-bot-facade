const catchAsync = require('../utils/catchAsync');
const { botService } = require('../services');
const logger = require('../config/logger');

const updateBot = catchAsync(async (req, res) => {
  logger.info(`req.body.pair: ${req.body.pair}`);
  logger.info(`req.body.isReadyToBuy: ${req.body.isReadyToBuy}`);
  let pair = '';
  if (req.body.pair) {
    const pairArray = req.body.pair.split('USDT');
    pair = `USDT_${pairArray[0]}`;
  }
  const bot = await botService.getBotByPair(pair);
  const updatedBot = await botService.updateBot(bot.id, req.body);
  res.send(updatedBot);
});

module.exports = {
  updateBot,
};


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

bot.isReadyToBuy = (isReadyToBuy === 1) ? true : false
const updatedBot = await botService.updateBot(bot.id, bot);
res.send(updatedBot);
});
