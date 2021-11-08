const { Bot } = require('../models');

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryBots = async (filter) => {
  const bots = await Bot.find(filter).sort({
    createdAt: 'desc',
  });
  return bots;
};

/**
 * Get Bot by pair
 * @param {string} pair
 * @returns {Promise<Bot>}
 */
const getBotByPair = async (pair) => {
  return Bot.findOne({ pair });
};

/**
 * Get Bot by name
 * @param {string} name
 * @returns {Promise<Bot>}
 */
 const getBotByName = async (name) => {
  return Bot.findOne({ name });
};

/**
 * Create Bot
 * @param {string} email
 * @returns {Promise<User>}
 */
const createBot = async (data) => {
  const bot = await Bot.create(data);
  return bot;
};

/**
 * Update Bot
 * @param {string} id
 * @param {object} data
 * @returns {Promise<Bot>}
 */
const updateBot = async (id, data) => {
  const bot = await Bot.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
  return bot;
};

module.exports = {
  queryBots,
  getBotByPair,
  getBotByName,
  createBot,
  updateBot,
};
