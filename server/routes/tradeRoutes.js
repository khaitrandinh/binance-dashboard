const express = require("express");
const Trade = require("../models/tradeModel");
const router = express.Router();
const axios = require("axios");
// 📊 API 1: Lấy dữ liệu phân bổ khối lượng theo vùng giá (cho Stacked Bar Chart)
router.get("/stacked/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const startTime = new Date(`${date}T00:00:00.000Z`);  // 0h ngày được chọn
    const endTime = new Date(`${date}T23:59:59.999Z`);   // 23h59 ngày được chọn

    console.log(`📩 Kiểm tra dữ liệu từ ${startTime} đến ${endTime}`);

    // 🔹 Kiểm tra dữ liệu đã có trong MongoDB
    const existingTrades = await Trade.find({
      timestamp: { $gte: startTime, $lte: endTime }
    });

    // 🔹 Nhóm dữ liệu theo giờ đã có trong MongoDB
    let existingHours = new Set();
    existingTrades.forEach(trade => {
      existingHours.add(new Date(trade.timestamp).getUTCHours());
    });

    console.log(`✅ Dữ liệu đã có trong DB cho các giờ: ${[...existingHours].sort().join(", ")}`);

    let missingHours = [];
    for (let hour = 0; hour < 24; hour++) {
      if (!existingHours.has(hour)) {
        missingHours.push(hour);
      }
    }

    console.log(`⚠️ Giờ chưa có dữ liệu: ${missingHours.length > 0 ? missingHours.join(", ") : "Không có giờ nào thiếu"}`);

    let allTrades = [];

    // 🔹 Nếu thiếu dữ liệu giờ nào, gọi Binance API để cập nhật giờ đó
    if (missingHours.length > 0) {
      for (let hour of missingHours) {
        const hourStart = new Date(`${date}T${hour.toString().padStart(2, "0")}:00:00.000Z`).getTime();
        const hourEnd = new Date(`${date}T${hour.toString().padStart(2, "0")}:59:59.999Z`).getTime();

        console.log(`⏳ Gọi Binance API từ ${new Date(hourStart)} đến ${new Date(hourEnd)}`);

        try {
          const response = await axios.get(
            `https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&startTime=${hourStart}&endTime=${hourEnd}&limit=1000`
          );
          const trades = response.data;

          if (trades.length > 0) {
            allTrades = [...allTrades, ...trades];
          }
        } catch (err) {
          console.error(`❌ Lỗi khi lấy dữ liệu Binance (giờ ${hour}):`, err.message);
        }
      }

      console.log(`📊 Tổng số giao dịch lấy được từ Binance: ${allTrades.length}`);

      // 🔹 Chuyển dữ liệu từ Binance thành format MongoDB
      const formattedTrades = allTrades.map(trade => ({
        symbol: "BTCUSDT",
        price: parseFloat(trade.p),
        volume: parseFloat(trade.q),
        type: trade.m ? "sell" : "buy",
        timestamp: new Date(trade.T)
      }));

      // 🔹 Lưu vào MongoDB nếu có dữ liệu mới
      if (formattedTrades.length > 0) {
        await Trade.insertMany(formattedTrades);
        console.log("✅ Dữ liệu mới đã được cập nhật vào MongoDB.");
      }

      // 🔹 Kết hợp dữ liệu mới với dữ liệu cũ
      existingTrades.push(...formattedTrades);
    }

    // 🔹 Trả dữ liệu đã format cho frontend
    res.json(await formatTradeDataStacked(existingTrades));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ Hàm format dữ liệu theo từng giờ (group by hour)
const formatTradeDataStacked = async (trades) => {
  const fullHours = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    buyVolume: 0,
    sellVolume: 0
  }));

  trades.forEach(trade => {
    const hour = new Date(trade.timestamp).getUTCHours(); // Lấy giờ UTC
    if (trade.type === "buy") {
      fullHours[hour].buyVolume += trade.volume;
    } else {
      fullHours[hour].sellVolume += trade.volume;
    }
  });

  return fullHours;
};


const PAGE_SIZE = 5000; // Giới hạn mỗi lần lấy từ MongoDB

// 📌 Hàm chia vùng giá theo Fibonacci
const getFibonacciPriceRanges = async (minPrice, maxPrice) => {
  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  let priceRanges = [];

  for (let i = 0; i < fibLevels.length - 1; i++) {
    const min = minPrice + (maxPrice - minPrice) * fibLevels[i];
    const max = minPrice + (maxPrice - minPrice) * fibLevels[i + 1];

    priceRanges.push({
      min: Math.round(min),
      max: Math.round(max),
      label: `${Math.round(min)} - ${Math.round(max)} USDT`,
      buyVolume: 0,
      sellVolume: 0
    });
  }

  return priceRanges;
};

// 📌 API lấy dữ liệu giao dịch theo vùng giá
router.get("/trade-volume/:timeframe/:date?", async (req, res) => {
  try {
    const { timeframe, date } = req.params;
    const { start, end } = req.query; // Nhận start & end từ query params
    let startTime, endTime;

    if (timeframe === "day") {
      startTime = new Date(`${date}T00:00:00.000Z`);
      endTime = new Date(`${date}T23:59:59.999Z`);
    } else if (timeframe === "month") {
      startTime = new Date(`${date}-01T00:00:00.000Z`);
      endTime = new Date(`${date}-31T23:59:59.999Z`);
    } else if (timeframe === "year") {
      startTime = new Date(`${date}-01-01T00:00:00.000Z`);
      endTime = new Date(`${date}-12-31T23:59:59.999Z`);
    } else if (timeframe === "range") {
      if (!start || !end) {
        return res.status(400).json({ error: "Thiếu tham số start hoặc end!" });
      }
      startTime = new Date(`${start}T00:00:00.000Z`);
      endTime = new Date(`${end}T23:59:59.999Z`);
    } else if (timeframe === "all") {
      console.log("📩 Lấy toàn bộ lịch sử giao dịch từ MongoDB...");
      const allTrades = await Trade.find().sort({ timestamp: 1 }).limit(5000);

      if (allTrades.length === 0) {
        return res.json({ message: "Không có dữ liệu giao dịch trong hệ thống." });
      }

      return res.json(await formatTradeData(allTrades));
    } else {
      return res.status(400).json({ error: "Invalid timeframe. Dùng 'day', 'month', 'year', 'range' hoặc 'all'." });
    }

    console.log(`📩 Lấy dữ liệu từ ${startTime} đến ${endTime}`);

    // 🔹 Kiểm tra MongoDB trước khi gọi Binance API
    const existingTrades = await Trade.find({
      timestamp: { $gte: startTime, $lte: endTime }
    }).limit(5000);

    let tradeData = existingTrades;

    if (tradeData.length === 0) {
      console.log("⚡ Dữ liệu chưa có, gọi API Binance...");

      let allTrades = [];
      for (let d = new Date(startTime); d <= endTime; d.setDate(d.getDate() + 1)) {
        const dayStart = new Date(d).setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(d).setUTCHours(23, 59, 59, 999);

        console.log(`📩 Fetching Binance API: ${new Date(dayStart)} - ${new Date(dayEnd)}`);

        try {
          const response = await axios.get(
            `https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&startTime=${dayStart}&endTime=${dayEnd}&limit=1000`
          );
          const trades = response.data;

          if (trades.length > 0) {
            const formattedTrades = trades.map(trade => ({
              symbol: "BTCUSDT",
              price: parseFloat(trade.p),
              volume: parseFloat(trade.q),
              type: trade.m ? "sell" : "buy",
              timestamp: new Date(trade.T)
            }));

            await Trade.insertMany(formattedTrades);
            console.log(`✅ Đã lưu ${formattedTrades.length} giao dịch vào MongoDB.`);
          }
        } catch (err) {
          console.error("❌ Lỗi khi lấy dữ liệu Binance:", err.message);
        }
      }
    }

    const minPrice = Math.min(...tradeData.map(trade => trade.price));
    const maxPrice = Math.max(...tradeData.map(trade => trade.price));

    const priceRanges = await getFibonacciPriceRanges(minPrice, maxPrice);

    tradeData.forEach((trade) => {
      priceRanges.forEach((range) => {
        if (trade.price >= range.min && trade.price < range.max) {
          if (trade.type === "buy") {
            range.buyVolume += trade.volume;
          } else {
            range.sellVolume += trade.volume;
          }
        }
      });
    });

    console.log("📊 Dữ liệu gửi đến FE:", priceRanges);
    res.json(priceRanges);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu trade-volume:", err);
    res.status(500).json({ error: "Server Error" });
  }
});




// 📊 API 3: Heatmap - Lấy khối lượng mua theo vùng giá và thời gian
router.get("/heatmap", async (req, res) => {
  try {
    const data = await Trade.aggregate([
      {
        $group: {
          _id: { price: "$price", time: { $hour: "$timestamp" } },
          volume: { $sum: "$volume" }
        }
      },
      { $sort: { "_id.time": 1, "_id.price": 1 } }
    ]);

    // Kiểm tra dữ liệu trước khi gửi về frontend
    console.log("📩 API Heatmap Data:", data);

    // Chuyển đổi dữ liệu về đúng format
    res.json(data.map(item => ({
      x: item._id.time,
      y: item._id.price,
      size: 10, // Định kích thước dot cố định
      color: item.volume
    })));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu heatmap:", err);
    res.status(500).json({ error: "Server Error" });
  }
});


module.exports = router;
