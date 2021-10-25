const cron = require('node-cron');
const axios = require('axios');
const { API } = require('3commas-typescript'); // https://www.npmjs.com/package/3commas-typescript
const logger = require('../config/logger');
const config = require('../config/config');

const { tradingViewCustomSignalConfig, lunarCrashConfig, listOf3CommasUSDTPair } = require('../config/3commas');
const { botService } = require('../services');

const get3CommasAPI = () => {
  const apiKey = config.threeCommas.api.key;
  const apiSecret = config.threeCommas.api.secret;
  const api = new API({
    key: apiKey, // Optional if only query endpoints with no security requirement
    secrets: apiSecret, // Optional
    timeout: 60000, // Optional, in ms, default to 30000
    forcedMode: 'real',
    errorHandler: (response, reject) => {
      // Optional, Custom handler for 3Commas error
      // eslint-disable-next-line camelcase
      const { error, error_description } = response;
      // eslint-disable-next-line camelcase
      logger.info(`Error: ${error_description}`);
      reject(new Error(error));
    },
  });
  return api;
};

const getLunarCrashToken = () =>
  new Promise((resolve) => {
    axios
      .get(
        'https://api.lunarcrush.com/v2?requestAccess=lunar&platform=web&deviceId=LDID-eda39c17-d328-4349-a3d9-4cbc0998f753&validator=tr0TpSfOrTvZnTnp0TrpnSuS0ppZhO5T&clientVersion=lunar-20211013&locale=en-US'
      )
      .then((response) => {
        const responseData = response.data;
        // logger.info(responseData);
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
        // logger.info(responseData);
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
    // logger.info(`Starting Bot Id: ${tradingViewConfig.bot_id}`);
    axios.post('https://3commas.io/trade_signal/trading_view', tradingViewConfig).then(
      (response) => {
        // logger.info(`response: ${response}`);
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

const update3CommasBotPairs = async (botId, lunarCrashCoins) => {
  const api3Commas = get3CommasAPI();
  const botDetails = await api3Commas.getBot(botId);
  const lunarCrashCoinsLength = lunarCrashCoins.length;
  const final3CommaCoinPairs = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < lunarCrashCoinsLength; i++) {
    const lunarCrashCoinPair = lunarCrashCoins[i].s;
    const actualCoinPairName = `USDT_${lunarCrashCoinPair}`;
    const listOf3CommasUSDTPairs = listOf3CommasUSDTPair;
    if (listOf3CommasUSDTPairs.includes(actualCoinPairName)) {
      final3CommaCoinPairs.push(actualCoinPairName);
    }
  }
  botDetails.pairs = final3CommaCoinPairs;
  logger.info(`final3CommaCoinPairs :: ${final3CommaCoinPairs}`);
  const params = {
    name: botDetails.name,
    pairs: final3CommaCoinPairs,
    base_order_volume: botDetails.base_order_volume,
    take_profit: botDetails.take_profit,
    safety_order_volume: botDetails.safety_order_volume,
    martingale_volume_coefficient: botDetails.martingale_volume_coefficient,
    martingale_step_coefficient: botDetails.martingale_step_coefficient,
    max_safety_orders: botDetails.max_safety_orders,
    active_safety_orders_count: botDetails.active_safety_orders_count,
    safety_order_step_percentage: botDetails.safety_order_step_percentage,
    take_profit_type: botDetails.take_profit_type,
    strategy_list: botDetails.strategy_list,
    bot_id: botId,
  };
  await api3Commas.customRequest('PATCH', 1, `/bots/${botId}/update`, params);
  logger.info(` ** Bot Id :: ${botId} is udpated with Lunar AltRank. **`);
};

const getLunarCrashAltRankCoins = (lunarCrashToken) =>
  new Promise((resolve) => {
    getLunarCrashCoinData(lunarCrashToken).then((lunarCrashCoinData) => {
      let lunarCrashCoinFinalData = [];
      if (lunarCrashCoinData) {
        const syncItemCount = lunarCrashConfig.sync_item_count;
        lunarCrashCoinFinalData = lunarCrashCoinData.slice(0, syncItemCount);
      }
      resolve(lunarCrashCoinFinalData);
    });
  });

const getLunarCrashGalaxy10RankCoins = (lunarCrashToken) =>
  new Promise((resolve) => {
    getLunarCrashCoinData(lunarCrashToken).then((lunarCrashCoinData) => {
      lunarCrashCoinData.sort((a, b) => parseFloat(b.gs) - parseFloat(a.gs));
      let lunarCrashCoinFinalData = [];
      if (lunarCrashCoinData) {
        const syncItemCount = lunarCrashConfig.sync_item_count;
        lunarCrashCoinFinalData = lunarCrashCoinData.slice(0, syncItemCount);
      }
      resolve(lunarCrashCoinFinalData);
    });
  });

const startBotsUsingLunarCrashAltRank = async (lunarCrashToken) => {
  const lunarCrashAltRankCoins = await getLunarCrashAltRankCoins(lunarCrashToken);
  const lunarCrashCoinFinalDataLength = lunarCrashAltRankCoins.length;
  logger.info(`-------------- Trade Summary - START --------------`);
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < lunarCrashCoinFinalDataLength; i++) {
    // eslint-disable-next-line no-await-in-loop
    const bot3CommasData = await get3CommasBotForPair(lunarCrashAltRankCoins[i].s);
    if (bot3CommasData) {
      // eslint-disable-next-line no-await-in-loop
      const isBotStarted = await start3CommasBotDeal(bot3CommasData.name);
      if (isBotStarted) {
        logger.info(`Started Deal for Trade Pair - ${bot3CommasData.pair} using Bot id ${bot3CommasData.name}`);
      }
    }
  }
  logger.info(`-------------- Trade Summary - END --------------`);
};

const startMultiPairBotsUsingLunarCrashAltRank = async (lunarCrashToken) => {
  try {
    const botId = 6551158;
    const lunarCrashAltRankCoins = await getLunarCrashAltRankCoins(lunarCrashToken);
    update3CommasBotPairs(botId, lunarCrashAltRankCoins);
  } catch (error) {
    logger.info(error);
  }
};

const startMultiPairBotsUsingLunarCrashGalaxy10Rank = async (lunarCrashToken) => {
  try {
    const botId = 6551158;
    const lunarCrashGalaxy10RankCoins = await getLunarCrashGalaxy10RankCoins(lunarCrashToken);
    update3CommasBotPairs(botId, lunarCrashGalaxy10RankCoins);
  } catch (error) {
    logger.info(error);
  }
};

const luncarCrashDataCall = async () => {
  try {
    const lunarCrashToken = await getLunarCrashToken();
    logger.info(`Lunarcrash Generated Token :: ${lunarCrashToken}`);
    if (lunarCrashToken) {
      // startBotsUsingLunarCrashAltRank(lunarCrashToken);
      // startMultiPairBotsUsingLunarCrashAltRank(lunarCrashToken);
      startMultiPairBotsUsingLunarCrashGalaxy10Rank(lunarCrashToken);
    }
  } catch (error) {
    logger.info(error);
  }
};

const checkHealth = () =>
  new Promise((resolve) => {
    axios
      .get('https://ci-3commas-bot-manager.herokuapp.com/v1/misc/ping')
      .then((response) => {
        const responseData = response.data;
        logger.info(responseData);
        resolve(true);
      })
      .catch((error) => {
        logger.info(`Error: ${error.message}`);
        resolve(true);
      });
  });

const herokuKeepAliveCall = async () => {
  try {
    const isSuccess = await checkHealth();
    logger.info(`health check :: ${isSuccess}`);
  } catch (error) {
    logger.info('Error Heroku KeepAlive Call');
  }
};

const cronHandler = () => {
  cron.schedule('*/5 * * * *', () => {
    logger.info('running a task every minute');
    luncarCrashDataCall();
  });
  cron.schedule('*/15 * * * *', () => {
    logger.info('running a task every 15 minute');
    herokuKeepAliveCall();
  });
};

module.exports = cronHandler;
