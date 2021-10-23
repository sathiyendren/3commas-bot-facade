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
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getBotByPair = async (pair) => {
  return Bot.findOne({ pair });
};

module.exports = {
  queryBots,
  getBotByPair,
};
