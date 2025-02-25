// In models/CandlestickModel.js
const mongoose = require('mongoose');

const candlestickSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true },
  timeframe: { type: String, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true }, 
  close: { type: Number, required: true },
  volume: { type: Number, default: 0 }
});

// Define a COMPOUND unique index on timestamp AND timeframe
candlestickSchema.index({ timestamp: 1, timeframe: 1 }, { unique: true });

const Candlestick = mongoose.model('Candlestick', candlestickSchema);
module.exports = Candlestick;