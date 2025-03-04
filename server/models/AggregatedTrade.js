const mongoose = require('mongoose');
const AggregatedTradeSchema = new mongoose.Schema({
  timeframe: { type: String, required: true },
  date: { type: String, required: true },
  timeKey: { type: String, required: true },    // ví dụ: giá trị của date
  interval: { type: String, required: true },     // ví dụ: giá trị của timeframe
  priceRanges: { type: [String], required: true },
  buyData: { type: Array, required: true },
  sellData: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Nếu bạn muốn đảm bảo uniqueness dựa trên timeKey và interval:
AggregatedTradeSchema.index({ timeKey: 1, interval: 1 }, { unique: true });

module.exports = mongoose.model('AggregatedTrade', AggregatedTradeSchema);

