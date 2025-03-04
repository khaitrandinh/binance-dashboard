// services/binanceService.js
const axios = require("axios");
const MarketRealTime = require("../models/MarketRealTime");

async function fetchRealTimeData(symbol) {
  try {
    // Lấy thông tin giá hiện tại
    const priceResponse = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    
    // Lấy thông tin thống kê 24h
    const statsResponse = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    
    const data = {
      symbol: symbol,
      price: parseFloat(priceResponse.data.price),
      volume: parseFloat(statsResponse.data.volume),
      priceChange: parseFloat(statsResponse.data.priceChange),
      priceChangePercent: parseFloat(statsResponse.data.priceChangePercent),
      // Tính giá tham chiếu = giá hiện tại - sự thay đổi giá
      referencePrice: parseFloat(priceResponse.data.price) - parseFloat(statsResponse.data.priceChange)
    };
    
    // Cập nhật hoặc tạo mới trong database
    const updatedData = await MarketRealTime.findOneAndUpdate(
      { symbol },
      { ...data, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    
    return updatedData;
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    throw error;
  }
}

module.exports = { fetchRealTimeData };