const mongoose = require("mongoose");

const TradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  price: { type: Number, required: true },
  volume: { type: Number, required: true },
  type: { type: String, enum: ["buy", "sell"], required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Trade", TradeSchema);
