const axios = require("axios");
const MarketRealTime = require("../models/MarketRealTime");

const fetchRealTimeData = async (symbol) => {
  try {
    const response = await axios.get(
      `${process.env.BINANCE_API_URL}/api/v3/ticker/24hr?symbol=${symbol}`
    );

    const data = {
      symbol,
      price: parseFloat(response.data.lastPrice),
      volume: parseFloat(response.data.volume),
      updatedAt: new Date(),
    };

    // Lưu vào MongoDB (Cập nhật nếu đã tồn tại)
    await MarketRealTime.findOneAndUpdate({ symbol }, data, {
      upsert: true,
      new: true,
    });

    return data;
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu từ Binance:", error);
    throw error;
  }
};

module.exports = { fetchRealTimeData };
