// routes/market.js
const express = require("express");
const router = express.Router();
const MarketRealTime = require("../models/MarketRealTime");
const { fetchRealTimeData } = require("../services/binanceService");

// API lấy giá real-time từ MongoDB
router.get("/real-time/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    let data = await MarketRealTime.findOne({ symbol });
    
    // Kiểm tra nếu dữ liệu không tồn tại hoặc đã cũ (ví dụ: cũ hơn 2 phút)
    const isDataStale = !data || 
      (new Date() - new Date(data.updatedAt) > 2 * 60 * 1000); // 2 phút
    
    if (isDataStale) {
      // Lấy dữ liệu mới từ Binance
      data = await fetchRealTimeData(symbol);
    }

    res.json(data);
  } catch (error) {
    console.error("Error fetching real-time data:", error);
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu real-time" });
  }
});

module.exports = router;