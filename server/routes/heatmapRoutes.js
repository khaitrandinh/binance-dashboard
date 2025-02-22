const express = require("express");
const axios = require("axios");
const router = express.Router();
const AggregatedTrade = require("../models/AggregatedTrade");

router.get("/:timeframe/:date?", async (req, res) => {
  try {
    const { timeframe, date } = req.params;
    let startTime, endTime;
    const year = date.split("-")[0];
    const month = date.split("-")[1];

    // Xác định thời gian bắt đầu và kết thúc
    if (timeframe === "day") {
      startTime = new Date(`${date}T00:00:00.000Z`);
      endTime = new Date(`${date}T23:59:59.999Z`);
    } else if (timeframe === "month") {
      const lastDay = new Date(year, month, 0).getDate(); // Sửa lỗi số ngày trong tháng
      startTime = new Date(`${date}-01T00:00:00.000Z`);
      endTime = new Date(`${date}-${lastDay}T23:59:59.999Z`);
    } else if (timeframe === "year") {
      startTime = new Date(`${date}-01-01T00:00:00.000Z`);
      endTime = new Date(`${date}-12-31T23:59:59.999Z`);
    } else {
      return res.status(400).json({ error: "Invalid timeframe" });
    }

    // Lấy dữ liệu từ Binance
    const klineData = await fetchBinanceData(startTime, endTime);

    if (klineData.length === 0) {
      return res.status(404).json({ error: "No data available" });
    }

    // Tìm giá cao nhất và thấp nhất
    let highestPrice = -Infinity;
    let lowestPrice = Infinity;
    klineData.forEach(kline => {
      highestPrice = Math.max(highestPrice, parseFloat(kline.highPrice));
      lowestPrice = Math.min(lowestPrice, parseFloat(kline.lowPrice));
    });

    // Chia khoảng giá thành 5 phần
    const priceRange = (highestPrice - lowestPrice) / 5;
    const priceRanges = Array.from({ length: 5 }, (_, i) => ({
      min: lowestPrice + (i * priceRange),
      max: lowestPrice + ((i + 1) * priceRange),
      label: `${Math.round(lowestPrice + (i * priceRange))} - ${Math.round(lowestPrice + ((i + 1) * priceRange))}`
    }));

    // Tạo object chứa dữ liệu cho heatmap
    const buyVolumeByHour = {};
    const sellVolumeByHour = {};

    for (let hour = 0; hour < 24; hour++) {
      buyVolumeByHour[hour] = {};
      sellVolumeByHour[hour] = {};
      priceRanges.forEach(range => {
        buyVolumeByHour[hour][range.label] = 0;
        sellVolumeByHour[hour][range.label] = 0;
      });
    }

    // Tổng hợp dữ liệu
    klineData.forEach(kline => {
      const hour = new Date(kline.openTime).getUTCHours();
      const avgPrice = (parseFloat(kline.highPrice) + parseFloat(kline.lowPrice)) / 2;
      const buyVolume = parseFloat(kline.buyVolume || 0);
      const sellVolume = parseFloat(kline.sellVolume || 0);

      const priceRange = priceRanges.find(range => 
        avgPrice >= range.min && avgPrice < range.max
      );

      if (priceRange) {
        buyVolumeByHour[hour][priceRange.label] += buyVolume;
        sellVolumeByHour[hour][priceRange.label] += sellVolume;
      }
    });

    // Trả dữ liệu về FE
    res.json({
      timeLabels: Array.from({ length: 24 }, (_, i) => i),
      priceRanges: priceRanges.map(range => range.label),
      buyData: Object.entries(buyVolumeByHour).map(([hour, volumes]) => ({ ...volumes, hour: parseInt(hour) })),
      sellData: Object.entries(sellVolumeByHour).map(([hour, volumes]) => ({ ...volumes, hour: parseInt(hour) }))
    });

  } catch (err) {
    console.error("❌ Error fetching heatmap data:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Hàm lấy dữ liệu từ Binance
const fetchBinanceData = async (startTime, endTime) => {
  try {
    console.log("Fetching Binance data for:", startTime, endTime);
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&startTime=${startTime.getTime()}&endTime=${endTime.getTime()}`;
    const response = await axios.get(binanceUrl);

    console.log("Binance Data:", response.data); // In dữ liệu ra console
    return response.data.map(kline => ({
      openTime: kline[0],
      highPrice: kline[2],
      lowPrice: kline[3],
      buyVolume: kline[5] ,  
      sellVolume: kline[5]  
    }));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu từ Binance:", err);
    return [];
  }
};


module.exports = router;