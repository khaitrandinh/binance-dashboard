const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100");
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("❌ Lỗi lấy dữ liệu nến:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
