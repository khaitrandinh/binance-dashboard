const mongoose = require("mongoose");

const CandlestickSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
  timestamp: { type: Date, required: true, unique: true },
});

const Candlestick = mongoose.model("Candlestick", CandlestickSchema);
module.exports = Candlestick;
