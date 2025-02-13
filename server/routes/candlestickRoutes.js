const express = require("express");
const router = express.Router();
const Candlestick = require("../models/CandlestickModel");

// ✅ API lấy dữ liệu theo khung thời gian (1h, 24h, 7d)
router.get("/history/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const timeFrame = req.query.timeFrame || "1h"; // Mặc định là 1 giờ
    let startTime = new Date();

    if (timeFrame === "1h") {
      startTime.setHours(startTime.getHours() - 1);
    } else if (timeFrame === "24h") {
      startTime.setHours(startTime.getHours() - 24);
    } else if (timeFrame === "7d") {
      startTime.setDate(startTime.getDate() - 7);
    }

    console.log(`📩 API lấy dữ liệu từ ${startTime} cho ${symbol}`);

    // ✅ Truy vấn MongoDB chỉ lấy dữ liệu cần thiết
    const data = await Candlestick.find(
      { symbol, timestamp: { $gte: startTime } },
      { _id: 0, timestamp: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 } // ✅ Chỉ lấy các trường cần thiết
    ).sort({ timestamp: -1 }).lean(); // ✅ Sử dụng `.lean()` để giảm tải hiệu suất

    res.json(data);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu nến:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
