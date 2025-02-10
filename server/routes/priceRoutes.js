const express = require("express");
const Price = require("../models/PriceModel");

const router = express.Router();

// API lấy lịch sử giá
router.get("/history/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol?.toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: "Symbol không hợp lệ" });
    }

    const timeFrame = req.query.timeFrame || "1h"; // Mặc định lấy dữ liệu trong 1 giờ
    let startTime = new Date();

    if (timeFrame === "1h") {
      startTime.setHours(startTime.getHours() - 1);
    } else if (timeFrame === "24h") {
      startTime.setHours(startTime.getHours() - 24);
    } else if (timeFrame === "7d") {
      startTime.setDate(startTime.getDate() - 7);
    }

    console.log(`📩 API lấy dữ liệu từ ${startTime} cho ${symbol}`);

    const data = await Price.find({
      symbol,
      timestamp: { $gte: startTime },
    }).sort({ timestamp: -1 });

    const formattedData = data.map((item) => ({
      price: item.price,
      time: new Date(item.timestamp).toLocaleTimeString(),
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu lịch sử:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

  

module.exports = router;
