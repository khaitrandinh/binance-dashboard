// models/MarketRealTime.js
const mongoose = require("mongoose");

const marketRealTimeSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  volume: { type: Number, required: true },
  priceChange: { type: Number, default: 0 },
  priceChangePercent: { type: Number, default: 0 },
  referencePrice: { type: Number }, // Giá tham chiếu (giá 24h trước)
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MarketRealTime", marketRealTimeSchema);