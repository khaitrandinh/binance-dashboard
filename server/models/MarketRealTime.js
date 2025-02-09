const mongoose = require("mongoose");

const MarketRealTimeSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  volume: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("MarketRealTime", MarketRealTimeSchema);
