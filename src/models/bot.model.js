const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const botSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  pair: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// add plugin that converts mongoose to json
botSchema.plugin(toJSON);
botSchema.plugin(paginate);
/**
 * @typedef Bot
 */
const Bot = mongoose.model('Bot', botSchema);

module.exports = Bot;
