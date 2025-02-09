const express = require("express");
const router = express.Router();
const MarketRealTime = require("../models/MarketRealTime");
const { fetchRealTimeData } = require("../services/binanceService");

// API lấy giá real-time từ MongoDB
router.get("/real-time/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    let data = await MarketRealTime.findOne({ symbol });

    // Nếu không có trong database, lấy từ Binance
    if (!data) {
      data = await fetchRealTimeData(symbol);
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi lấy dữ liệu real-time" });
  }
});

module.exports = router;
