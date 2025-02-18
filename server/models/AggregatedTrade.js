const mongoose = require('mongoose');

const aggregatedTradeSchema = new mongoose.Schema({
  timeKey: { type: Number, required: true },
  interval: { type: String, required: true, enum: ['hour', 'day', 'month'] },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  avgPrice: { type: Number, default: 0 },
  buyVolume: { type: Number, default: 0 },
  sellVolume: { type: Number, default: 0 },
  minPrice: { type: Number, default: 0 },
  maxPrice: { type: Number, default: 0 },
  tradeCount: { type: Number, default: 0 }
}, { timestamps: true });  // ✅ Thêm timestamps để tự động tạo `createdAt` và `updatedAt`

// ✅ Tạo unique index để tránh dữ liệu trùng lặp
aggregatedTradeSchema.index({ timeKey: 1, interval: 1 }, { unique: true });

// ✅ Tạo index giúp tìm kiếm theo thời gian nhanh hơn
aggregatedTradeSchema.index({ startTime: 1, endTime: 1 });

// ✅ Nếu muốn tự động xóa dữ liệu sau 1 năm, thêm TTL index
aggregatedTradeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 năm

const AggregatedTrade = mongoose.model('AggregatedTrade', aggregatedTradeSchema);

module.exports = AggregatedTrade;
