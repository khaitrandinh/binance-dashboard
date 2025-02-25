const express = require("express");
const router = express.Router();
const Candlestick = require("../models/CandlestickModel");

// Lấy dữ liệu nến theo timeframe
router.get("/", async (req, res) => {
  try {
    const { timeframe = "1m", limit = 100, startTime, endTime } = req.query;
    
    let query = { timeframe };
    
    if (startTime && endTime) {
      query.timestamp = {
        $gte: new Date(parseInt(startTime)),
        $lte: new Date(parseInt(endTime))
      };
    }
    
    const candles = await Candlestick.find(query)
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .lean();
    
    // Format dữ liệu cho lightweight-charts
    const formattedCandles = candles.map(candle => ({
      time: Math.floor(candle.timestamp.getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
    
    res.json(formattedCandles);
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu nến:", error);
    res.status(500).json({ error: "Lỗi server khi lấy dữ liệu nến" });
  }
});

// Lấy dữ liệu tổng hợp theo ngày
router.get("/daily", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const dailyData = await Candlestick.aggregate([
      {
        $match: {
          timeframe: "1d",
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $sort: { timestamp: 1 }
      }
    ]);
    
    res.json(dailyData);
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu nến theo ngày:", error);
    res.status(500).json({ error: "Lỗi server khi lấy dữ liệu nến theo ngày" });
  }
});

module.exports = router;