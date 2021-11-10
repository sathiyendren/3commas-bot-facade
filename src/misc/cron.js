const cron = require('node-cron');
const axios = require('axios');
const lodash = require('lodash');
const { API } = require('3commas-typescript'); // https://www.npmjs.com/package/3commas-typescript
const logger = require('../config/logger');
const config = require('../config/config');

const {
  tradingViewCustomStartDealSignalConfig,
  tradingViewCustomStartBotSignalConfig,
  tradingViewCustomStopBotSignalConfig,
  lunarCrashConfig,
  listOf3CommasUSDTPair,
} = require('../config/3commas');
const { botService } = require('../services');

const get3CommasAPI = (mode) => {
  const apiKey = config.threeCommas.api.key;
  const apiSecret = config.threeCommas.api.secret;
  const api = new API({
    key: apiKey, // Optional if only query endpoints with no security requirement
    secrets: apiSecret, // Optional
    timeout: 60000, // Optional, in ms, default to 30000
    // forcedMode: mode || 'real', // 'real' | 'paper'
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
    const tradingViewConfig = tradingViewCustomStartDealSignalConfig;
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

const start3CommasBot = (botId, pair) =>
  new Promise((resolve) => {
    const tradingViewConfig = tradingViewCustomStartBotSignalConfig;
    tradingViewConfig.bot_id = parseInt(botId, 10);
    tradingViewConfig.pair = pair;
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

const stop3CommasBot = (botId, pair) =>
  new Promise((resolve) => {
    const tradingViewConfig = tradingViewCustomStopBotSignalConfig;
    tradingViewConfig.bot_id = parseInt(botId, 10);
    tradingViewConfig.pair = pair;
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

const getAllBots = () =>
  new Promise((resolve) => {
    const bots = botService.queryBots({});
    resolve(bots);
  });

const getAll3CommasBots = (acMode = 'paper', offset = 1) =>
  new Promise((resolve) => {
    const api3Commas = get3CommasAPI(acMode);
    const botParams = {
      limit: 100, // Max 100
      offset,
      account_id: acMode === 'paper' ? 30979086 : 30979248,
      scope: 'enabled',
      strategy: 'long',
      sort_by: 'created_at',
      sort_direction: 'asc',
    };
    const bots = api3Commas.getBots(botParams);
    resolve(bots);
  });

const update3CommasBotPairs = async (botId, lunarCrashCoins, acMode) => {
  const api3Commas = get3CommasAPI(acMode);
  const botDetails = await api3Commas.getBot(botId);
  const maxActiveDeals = lunarCrashConfig.max_active_deals;
  const syncItemCount = lunarCrashConfig.sync_item_count;
  const lunarCrashCoinsLength = lunarCrashCoins.length;
  let lunarCrash3CommaCoinPairs = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < lunarCrashCoinsLength; i++) {
    const lunarCrashCoinPair = lunarCrashCoins[i].s;
    const actualCoinPairName = `USDT_${lunarCrashCoinPair}`;
    const listOf3CommasUSDTPairs = listOf3CommasUSDTPair;
    if (listOf3CommasUSDTPairs.includes(actualCoinPairName)) {
      lunarCrash3CommaCoinPairs.push(actualCoinPairName);
    }
  }
  if (lunarCrash3CommaCoinPairs.length > lunarCrashConfig.max_active_deals) {
    lunarCrash3CommaCoinPairs = lunarCrash3CommaCoinPairs.slice(0, syncItemCount);
  }

  // if (acMode === 'paper') {
  const activeDeals = botDetails.active_deals;
  const activeDealPairs = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < activeDeals.length; i++) {
    const activeDealPair = activeDeals[i].pair;
    activeDealPairs.push(activeDealPair);
  }

  let totalBotPairs = lodash.union(lunarCrash3CommaCoinPairs, activeDealPairs);
  if (totalBotPairs.length > maxActiveDeals) {
    totalBotPairs = totalBotPairs.slice(0, maxActiveDeals);
  }
  const botPairs = lunarCrash3CommaCoinPairs; // totalBotPairs;
  const botMaxActiveDeals = lunarCrash3CommaCoinPairs.length; // botPairs.length;
  // }
  const params = {
    name: botDetails.name,
    pairs: botPairs,
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
    max_active_deals: botMaxActiveDeals,
    bot_id: botId,
  };
  await api3Commas.customRequest('PATCH', 1, `/bots/${botId}/update`, params);
  return { botPairs, botMaxActiveDeals };
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

const getLunarCrashGalaxyScoreCoins = (lunarCrashToken) =>
  new Promise((resolve) => {
    getLunarCrashCoinData(lunarCrashToken).then((lunarCrashCoinData) => {
      lunarCrashCoinData.sort((a, b) => parseFloat(b.gs) - parseFloat(a.gs));
      // let lunarCrashCoinFinalData = [];
      // if (lunarCrashCoinData) {
      //   const syncItemCount = lunarCrashConfig.sync_item_count;
      //   lunarCrashCoinFinalData = lunarCrashCoinData.slice(0, syncItemCount);
      // }
      resolve(lunarCrashCoinData);
    });
  });

// const startBotsUsingLunarCrashAltRank = async (lunarCrashToken) => {
//   const lunarCrashAltRankCoins = await getLunarCrashAltRankCoins(lunarCrashToken);
//   const lunarCrashCoinFinalDataLength = lunarCrashAltRankCoins.length;
//   logger.info(`-------------- Trade Summary - START --------------`);
//   // eslint-disable-next-line no-plusplus
//   for (let i = 0; i < lunarCrashCoinFinalDataLength; i++) {
//     // eslint-disable-next-line no-await-in-loop
//     const bot3CommasData = await get3CommasBotForPair(lunarCrashAltRankCoins[i].s);
//     if (bot3CommasData) {
//       // eslint-disable-next-line no-await-in-loop
//       const isBotStarted = await start3CommasBotDeal(bot3CommasData.name);
//       if (isBotStarted) {
//         logger.info(`Started Deal for Trade Pair - ${bot3CommasData.pair} using Bot id ${bot3CommasData.name}`);
//       }
//     }
//   }
//   logger.info(`-------------- Trade Summary - END --------------`);
// };

const updateBotsUsingLunarCrashGalaxyScore = (api3Commas, bot, lunarCrashGSCheck) => {
  // eslint-disable-next-line no-new
  new Promise(async (resolve) => {
    try {
      logger.info(
        `*** isReadyToBuy - ${bot.pair} using Bot id ${bot.name} and cotains lunarCrashGSCheck : ${lunarCrashGSCheck}`
      );
      logger.info(`*** Trade Pair - ${bot.pair} using Bot id ${bot.name} and Ready Status ${bot.isReadyToBuy}`);

      if (lunarCrashGSCheck || bot.isReadyToBuy) {
        logger.info(`*** isReadyToBuy - ${bot.pair} using Bot id ${bot.name}`);
        // eslint-disable-next-line no-await-in-loop
        const isBotStarted = await start3CommasBot(bot.name, bot.pair);

        // eslint-disable-next-line no-await-in-loop
        const isBotStartedDeal = await start3CommasBotDeal(bot.name);

        // eslint-disable-next-line no-await-in-loop
        const botDetails = await api3Commas.getBot(bot.name);
        const params = {
          name: botDetails.name,
          pairs: botDetails.pairs,
          base_order_volume: botDetails.base_order_volume,
          take_profit: botDetails.take_profit,
          safety_order_volume: botDetails.safety_order_volume,
          martingale_volume_coefficient: botDetails.martingale_volume_coefficient,
          martingale_step_coefficient: botDetails.martingale_step_coefficient,
          max_safety_orders: botDetails.max_safety_orders,
          active_safety_orders_count: botDetails.active_safety_orders_count,
          safety_order_step_percentage: botDetails.safety_order_step_percentage,
          take_profit_type: botDetails.take_profit_type,
          strategy_list: [{ strategy: 'nonstop' }],
          max_active_deals: botDetails.max_active_deals,
          bot_id: botDetails.id,
        };

        // eslint-disable-next-line no-await-in-loop
        await api3Commas.customRequest('PATCH', 1, `/bots/${bot.name}/update`, params);

        if (isBotStarted && isBotStartedDeal) {
          logger.info(`Started Deal for Trade Pair - ${bot.pair} using Bot id ${bot.name}`);
        }
      } else {
        logger.info(`*** Not isReadyToBuy - ${bot.pair} using Bot id ${bot.name}`);
        // eslint-disable-next-line no-await-in-loop
        const botDetails = await api3Commas.getBot(bot.name);
        // logger.info(` active_deals_count :: ${botDetails.active_deals_count}`);

        const params = {
          name: botDetails.name,
          pairs: botDetails.pairs,
          base_order_volume: botDetails.base_order_volume,
          take_profit: botDetails.take_profit,
          safety_order_volume: botDetails.safety_order_volume,
          martingale_volume_coefficient: botDetails.martingale_volume_coefficient,
          martingale_step_coefficient: botDetails.martingale_step_coefficient,
          max_safety_orders: botDetails.max_safety_orders,
          active_safety_orders_count: botDetails.active_safety_orders_count,
          safety_order_step_percentage: botDetails.safety_order_step_percentage,
          take_profit_type: botDetails.take_profit_type,
          strategy_list: [{ strategy: 'manual' }],
          max_active_deals: botDetails.max_active_deals,
          bot_id: botDetails.id,
        };
        // eslint-disable-next-line no-await-in-loop
        await api3Commas.customRequest('PATCH', 1, `/bots/${bot.name}/update`, params);
        logger.info(`Updated Manual Trade Pair - ${bot.pair} using Bot id ${bot.name}`);

        // if (botDetails.active_deals_count === 0) {
        //   // eslint-disable-next-line no-await-in-loop
        //   const isBotStoped = await stop3CommasBot(bot.name, bot.pair);
        //   if (isBotStoped) {
        //     logger.info(`Stopped Deal for Trade Pair - ${bot.pair} using Bot id ${bot.name}`);
        //   }
        // }
      }
      resolve(true);
    } catch (error) {
      logger.info(error);
      resolve(true);
    }
  });
};
const startAndStopBotsUsingLunarCrashGalaxyScore = async (acMode, lunarCrashToken) => {
  try {
    const api3Commas = get3CommasAPI(acMode);
    const lunarCrashGalaxyScoreCoins = await getLunarCrashGalaxyScoreCoins(lunarCrashToken);
    const bots = await getAllBots();
    const botsLength = bots.length;

    const syncItemCount = lunarCrashConfig.min_sync_item_count;
    const lunarCrashCoinsLength = lunarCrashGalaxyScoreCoins.length;
    let lunarCrash3CommaCoinPairs = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < lunarCrashCoinsLength; i++) {
      const lunarCrashCoinPair = lunarCrashGalaxyScoreCoins[i].s;
      const actualCoinPairName = `USDT_${lunarCrashCoinPair}`;
      const listOf3CommasUSDTPairs = listOf3CommasUSDTPair;
      if (listOf3CommasUSDTPairs.includes(actualCoinPairName)) {
        lunarCrash3CommaCoinPairs.push(actualCoinPairName);
      }
    }

    // if (lunarCrash3CommaCoinPairs.length > lunarCrashConfig.syncItemCount) {
    lunarCrash3CommaCoinPairs = lunarCrash3CommaCoinPairs.slice(0, syncItemCount);
    // }
    logger.info(`lunarCrash3CommaCoinPairs :: ${lunarCrash3CommaCoinPairs}`);

    const updateBotsUsingLunarCrashGalaxyScorePromises = [];
    logger.info(`-------------- Trade Summary - START --------------`);
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < botsLength; i++) {
      const bot = bots[i];
      const lunarCrashGSCheck = lunarCrash3CommaCoinPairs.includes(bot.pair);
      updateBotsUsingLunarCrashGalaxyScorePromises.push(
        updateBotsUsingLunarCrashGalaxyScore(api3Commas, bot, lunarCrashGSCheck)
      );
    }
    await Promise.all(updateBotsUsingLunarCrashGalaxyScorePromises);
    logger.info(`-------------- Trade Summary - END --------------`);
  } catch (error) {
    logger.info(error);
  }
};

const startMultiPairBotsUsingLunarCrashAltRank = async (botId, lunarCrashToken, acMode) => {
  try {
    const lunarCrashAltRankCoins = await getLunarCrashAltRankCoins(lunarCrashToken);
    const botInfo = await update3CommasBotPairs(botId, lunarCrashAltRankCoins, acMode);
    logger.info(`--`);
    logger.info(`--`);
    logger.info(`--`);
    logger.info(`----------------------- START -------------------------`);
    logger.info(` Bot Id :: ${botId} is udpated with LunarCrash AltRank.`);
    logger.info(` Bot Pairs :: ${botInfo.botPairs}`);
    logger.info(` Bot Max Active Deals :: ${botInfo.botMaxActiveDeals}`);
    logger.info(`----------------------- END -------------------------`);
  } catch (error) {
    logger.info(error);
  }
};

const startMultiPairBotsUsingLunarCrashGalaxyScore = async (botId, lunarCrashToken, acMode) => {
  try {
    const lunarCrashGalaxyScoreCoins = await getLunarCrashGalaxyScoreCoins(lunarCrashToken);
    const botInfo = await update3CommasBotPairs(botId, lunarCrashGalaxyScoreCoins, acMode);
    logger.info(`--`);
    logger.info(`--`);
    logger.info(`--`);
    logger.info(`----------------------- START -------------------------`);
    logger.info(` Bot Id :: ${botId} is udpated with LunarCrash GalaxyScore.`);
    logger.info(` Bot Pairs :: ${botInfo.botPairs}`);
    logger.info(` Bot Max Active Deals :: ${botInfo.botMaxActiveDeals}`);
    logger.info(`----------------------- END -------------------------`);
  } catch (error) {
    logger.info(error);
  }
};

const lunarCrashDataCall = async () => {
  try {
    const lunarCrashToken = await getLunarCrashToken();
    logger.info(`Lunarcrash Generated Token :: ${lunarCrashToken}`);
    if (lunarCrashToken) {
      // startBotsUsingLunarCrashAltRank(lunarCrashToken);
      // startMultiPairBotsUsingLunarCrashAltRank(6551158, lunarCrashToken);
      startMultiPairBotsUsingLunarCrashGalaxyScore(6551158, lunarCrashToken, 'real'); // Bull Bot
      startMultiPairBotsUsingLunarCrashGalaxyScore(6714616, lunarCrashToken, 'real'); // Safira Bot
      // startMultiPairBotsUsingLunarCrashGalaxyScore(6591241, lunarCrashToken, 'paper');
      // startAndStopBotsUsingLunarCrashGalaxyScore('paper', lunarCrashToken);
    }
    // startAndStopBotsUsingLunarCrashGalaxyScore('paper', null);
  } catch (error) {
    logger.info(error);
  }
};

const herokuKeepAliveCall = async () => {
  try {
    const isSuccess = await checkHealth();
    logger.info(`health check :: ${isSuccess}`);
  } catch (error) {
    logger.info('Error Heroku KeepAlive Call');
  }
};

const createSingleBot = (acMode, pair) => {
  // eslint-disable-next-line no-new
  new Promise(async (resolve) => {
    try {
      const api3Commas = get3CommasAPI(acMode);
      const params = {
        name: `1_GS_Auto_${pair}`,
        account_id: acMode === 'paper' ? 30979086 : 30979248,
        pairs: [pair],
        max_active_deals: 1,
        base_order_volume: 10,
        base_order_volume_type: 'quote_currency',
        take_profit: 0.3,
        safety_order_volume: 10,
        safety_order_volume_type: 'quote_currency',
        martingale_volume_coefficient: 1.01,
        martingale_step_coefficient: 1.11,
        max_safety_orders: 20,
        active_safety_orders_count: 1,
        strategy: 'long',
        safety_order_step_percentage: 0.35,
        take_profit_type: 'total',
        strategy_list: [{ strategy: 'manual' }],
      };
      const botDetails = await api3Commas.customRequest('POST', 1, `/bots/create_bot`, params);
      logger.info(`createSingleBot  botId :: ${botDetails.id}`);
      const botId = botDetails.id;
      // await start3CommasBot(botId, pair);
      // await start3CommasBotDeal(botId);
      const data = {
        name: botId,
        pair,
      };
      const bot = await botService.createBot(data);
      logger.info(`created Bot.. ${bot}`);
      resolve(true);
    } catch (error) {
      logger.info('Error createSingleBot Call');
      resolve(false);
    }
  });
};

const createBots = async (acMode) => {
  try {
    const createSingleBotPromises = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < listOf3CommasUSDTPair.length; i++) {
      const pair = listOf3CommasUSDTPair[i];
      createSingleBotPromises.push(createSingleBot(acMode, pair));
    }
    await Promise.all(createSingleBotPromises);
    logger.info(`createBots :: `);
  } catch (error) {
    logger.info('Error createBots Call');
  }
};

const stopAllBots = async (acMode) => {
  try {
    getAllBots().then(async (bots) => {
      const stopAllBotsPromises = [];
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        // eslint-disable-next-line no-await-in-loop
        const isBotStoped = stop3CommasBot(bot.name, bot.pair);
        stopAllBotsPromises.push(isBotStoped);
        if (isBotStoped) {
          logger.info(`Stopped Deal for Trade Pair - ${bot.pair} using Bot id ${bot.name}`);
        }
      }
      await Promise.all(stopAllBotsPromises);
    });

    logger.info(`getAllBots :: `);
  } catch (error) {
    logger.info('Error getAllBots Call');
  }
};
const cronHandler = () => {
  cron.schedule('* * * * *', () => {
    logger.info('running a task every minute');
    lunarCrashDataCall();
  });

  cron.schedule('*/15 * * * *', () => {
    logger.info('running a task every 15 minute');
    herokuKeepAliveCall();
  });
  lunarCrashDataCall();
  // createBots('paper');
  // stopAllBots('paper');
};

module.exports = cronHandler;
