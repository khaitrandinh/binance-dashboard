const express = require("express");
const Candlestick = require("../models/CandlestickModel");

const router = express.Router();

// API lấy lịch sử nến
router.get("/history/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol?.toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Symbol không hợp lệ" });
    }

    console.log(`📩 API lấy dữ liệu nến cho ${symbol}`);

    const candles = await Candlestick.find({ symbol })
      .sort({ timestamp: -1 })
      .limit(50);

    const formattedData = candles.map((item) => ({
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      time: new Date(item.timestamp).toLocaleTimeString(),
    }));

    console.log("📊 API trả về dữ liệu nến:", formattedData);
    res.json(formattedData);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu nến:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
