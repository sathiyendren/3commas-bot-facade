const cron = require('node-cron');
const https = require('https');
const axios = require('axios');
const logger = require('../config/logger');
const { tradingViewCustomSignalConfig, lunarCrashConfig } = require('../config/lunarcrush');
const { botService } = require('../services');

const getLunarCrashToken = () =>
  new Promise((resolve) => {
    axios
      .get(
        'https://api.lunarcrush.com/v2?requestAccess=lunar&platform=web&deviceId=LDID-eda39c17-d328-4349-a3d9-4cbc0998f753&validator=tr0TpSfOrTvZnTnp0TrpnSuS0ppZhO5T&clientVersion=lunar-20211013&locale=en-US'
      )
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(responseData.token);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve(null);
      });
  });

const getLunarCrashCoinData = (token) =>
  new Promise((resolve) => {
    axios
      .get(`https://api2.lunarcrush.com/v2?data=market&type=fast&key=${token}`)
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(responseData.data);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve([]);
      });
  });

const start3CommasBotDeal = (botId) =>
  new Promise((resolve) => {
    const tradingViewConfig = tradingViewCustomSignalConfig;
    tradingViewConfig.bot_id = parseInt(botId, 10);
    logger.info(`Starting Bot Id: ${tradingViewConfig.bot_id}`);
    axios.post('https://3commas.io/trade_signal/trading_view', tradingViewConfig).then(
      (response) => {
        logger.info(`response: ${response}`);
        resolve(true);
      },
      (error) => {
        logger.info(`Error: ${error.message}`);
        resolve(false);
      }
    );
  });

const getAll3CommasBot = () =>
  new Promise((resolve) => {
    const bots = botService.queryBots({});
    resolve(bots);
  });

const get3CommasBotForPair = (pair) =>
  new Promise((resolve) => {
    const bot = botService.getBotByPair(pair);
    resolve(bot);
  });

const luncarCrashDataCall = async () => {
  try {
    const lunarCrashToken = await getLunarCrashToken();
    if (lunarCrashToken) {
      logger.info(`Lunarcrash Token :: ${lunarCrashToken}`);
      const lunarCrashCoinData = await getLunarCrashCoinData(lunarCrashToken);
      const syncItemCount = lunarCrashConfig.sync_item_count;
      const lunarCrashCoinFinalData = lunarCrashCoinData.slice(0, syncItemCount);
      // const bots3CommasData = await getAll3CommasBot();
      // logger.info(`bots3CommasData :: ${bots3CommasData}`);
      const lunarCrashCoinFinalDataLength = lunarCrashCoinFinalData.length;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < lunarCrashCoinFinalDataLength; i++) {
        // eslint-disable-next-line no-await-in-loop
        const bot3CommasData = await get3CommasBotForPair(lunarCrashCoinFinalData[i].s);
        if (bot3CommasData) {
          // eslint-disable-next-line no-await-in-loop
          const isBotStarted = await start3CommasBotDeal(bot3CommasData.name);
          if (isBotStarted) {
            logger.info(`Started Deal for Trade Pair - ${bot3CommasData.pair} using Bot id ${bot3CommasData.name}`);
          }
        }
      }
    }
  } catch (error) {
    logger.info(error);
  }
};

const cronHandler = () => {
  cron.schedule('* * * * *', () => {
    logger.info('running a task every minute');
    luncarCrashDataCall();
  });
};

module.exports = cronHandler;
