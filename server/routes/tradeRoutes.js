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


// 📌 Hàm chia vùng giá theo Fibonacci
const getFibonacciPriceRangesHeatmap = async (minPrice, maxPrice) => {
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

// 📌 API lấy dữ liệu Heatmap
router.get("/heatmap/:timeframe/:date?", async (req, res) => {
  try {
    const { timeframe, date } = req.params;
    let startTime, endTime, interval, timeGroupKey;

    if (timeframe === "day") {
      startTime = new Date(`${date}T00:00:00.000Z`);
      endTime = new Date(`${date}T23:59:59.999Z`);
      interval = "hour";
      timeGroupKey = (timestamp) => new Date(timestamp).getUTCHours();
    } else if (timeframe === "month") {
      startTime = new Date(`${date}-01T00:00:00.000Z`);
      endTime = new Date(`${date}-31T23:59:59.999Z`);
      interval = "day";
      timeGroupKey = (timestamp) => new Date(timestamp).getUTCDate();
    } else if (timeframe === "year") {
      startTime = new Date(`${date}-01-01T00:00:00.000Z`);
      endTime = new Date(`${date}-12-31T23:59:59.999Z`);
      interval = "month";
      timeGroupKey = (timestamp) => new Date(timestamp).getUTCMonth() + 1;
    } else {
      return res.status(400).json({ error: "Invalid timeframe" });
    }

    console.log(`📩 Lấy dữ liệu từ ${startTime} đến ${endTime}`);

    // 🔸 Áp dụng giới hạn kích thước dữ liệu
    const MAX_DATA_POINTS = 100000; // Giới hạn số lượng giao dịch
    let tradeData = await Trade.find(
      { timestamp: { $gte: startTime, $lte: endTime } }
    ).limit(MAX_DATA_POINTS).lean();

    let expectedTimes = generateExpectedTimes(startTime, interval);
    let availableTimes = new Set(tradeData.map(trade => timeGroupKey(trade.timestamp)));
    let missingTimes = expectedTimes.filter(time => !availableTimes.has(time));

    if (missingTimes.length > 0) {
      console.log(`⚠️ Thiếu dữ liệu tại: ${missingTimes.join(", ")}. Tiến hành cập nhật...`);

      // 🔸 Giới hạn số lượng thời điểm cần cập nhật để tránh quá tải
      const MAX_UPDATE_TIMES = 5;
      const timesToUpdate = missingTimes.slice(0, MAX_UPDATE_TIMES);
      
      if (missingTimes.length > MAX_UPDATE_TIMES) {
        console.log(`⚠️ Quá nhiều thời điểm cần cập nhật, chỉ cập nhật ${MAX_UPDATE_TIMES} thời điểm đầu tiên`);
      }

      for (let missingTime of timesToUpdate) {
        let missingStart, missingEnd;

        if (interval === "hour") {
          missingStart = new Date(`${date}T${missingTime.toString().padStart(2, "0")}:00:00.000Z`).getTime();
          missingEnd = new Date(`${date}T${missingTime.toString().padStart(2, "0")}:59:59.999Z`).getTime();
        } else if (interval === "day") {
          missingStart = new Date(`${date}-${missingTime.toString().padStart(2, "0")}T00:00:00.000Z`).getTime();
          missingEnd = new Date(`${date}-${missingTime.toString().padStart(2, "0")}T23:59:59.999Z`).getTime();
        } else if (interval === "month") {
          missingStart = new Date(`${date}-${missingTime.toString().padStart(2, "0")}-01T00:00:00.000Z`).getTime();
          missingEnd = new Date(`${date}-${missingTime.toString().padStart(2, "0")}-31T23:59:59.999Z`).getTime();
        }

        // 🔸 Giới hạn số lượng giao dịch được lấy từ Binance
        const MAX_BINANCE_TRADES = 1000;
        let newTrades = await fetchBinanceData(missingStart, missingEnd, MAX_BINANCE_TRADES);
        
        if (newTrades.length > 0) {
          // 🔸 Xử lý dữ liệu theo lô để tránh tràn bộ nhớ
          const BATCH_SIZE = 1000;
          for (let i = 0; i < newTrades.length; i += BATCH_SIZE) {
            const batch = newTrades.slice(i, i + BATCH_SIZE);
            await Trade.insertMany(batch);
          }
          
          // 🔸 Chỉ thêm vào tradeData số lượng giới hạn để tránh tràn bộ nhớ
          const tradesToAdd = newTrades.slice(0, Math.min(newTrades.length, 1000));
          tradeData.push(...tradesToAdd);
          
          console.log(`✅ Đã cập nhật ${newTrades.length} giao dịch cho thời điểm: ${missingTime}`);
        }
      }
    }

    // 🔸 Xử lý dữ liệu theo lô nếu quá lớn
    if (tradeData.length > MAX_DATA_POINTS) {
      console.log(`⚠️ Dữ liệu quá lớn (${tradeData.length} giao dịch), lấy mẫu xuống ${MAX_DATA_POINTS} giao dịch`);
      // Lấy mẫu dữ liệu thay vì xử lý tất cả
      const samplingRate = MAX_DATA_POINTS / tradeData.length;
      tradeData = tradeData.filter(() => Math.random() < samplingRate);
    }

    // 🔸 Sử dụng mảng tạm thời để tính min/max thay vì map toàn bộ
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const trade of tradeData) {
      if (trade.price < minPrice) minPrice = trade.price;
      if (trade.price > maxPrice) maxPrice = trade.price;
    }
    
    const priceRanges = await getFibonacciPriceRangesHeatmap(minPrice, maxPrice);

    // 🔸 Khởi tạo cấu trúc dữ liệu tối ưu hơn
    let heatmapData = {};
    expectedTimes.forEach(time => {
      heatmapData[time] = {};
      priceRanges.forEach(range => {
        heatmapData[time][range.label] = { buy: 0, sell: 0 };
      });
    });

    // 🔸 Xử lý dữ liệu theo lô
    const BATCH_SIZE = 5000;
    for (let i = 0; i < tradeData.length; i += BATCH_SIZE) {
      const batch = tradeData.slice(i, i + BATCH_SIZE);
      
      for (const trade of batch) {
        const timeKey = timeGroupKey(trade.timestamp);
        const priceRange = priceRanges.find(range => trade.price >= range.min && trade.price < range.max);

        if (priceRange && heatmapData[timeKey]) {
          const volume = trade.type === "buy" ? "buy" : "sell";
          heatmapData[timeKey][priceRange.label][volume] += trade.volume;
        }
      }
    }

    const formattedData = {
      timeLabels: expectedTimes.map(time => time.toString()),
      priceRanges: priceRanges.map(range => range.label),
      data: Object.entries(heatmapData).map(([time, prices]) => ({
        time: parseInt(time),
        ...Object.fromEntries(Object.entries(prices).map(([price, volumes]) => [price, volumes]))
      }))
    };

    res.json(formattedData);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu Heatmap:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 🔹 **Hàm tạo danh sách thời gian kỳ vọng**
function generateExpectedTimes(startTime, interval) {
  let times = [];

  if (interval === "hour") {
    for (let i = 0; i < 24; i++) times.push(i);
  } else if (interval === "day") {
    let daysInMonth = new Date(startTime.getFullYear(), startTime.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) times.push(i);
  } else if (interval === "month") {
    for (let i = 1; i <= 12; i++) times.push(i);
  }

  return times;
}

// 📌 Hàm fetch dữ liệu từ Binance (đã cải tiến với giới hạn)
const fetchBinanceData = async (startTime, endTime, maxTrades = 10000) => {
  let allTrades = [];
  let lastTradeTime = startTime;
  let fetchCount = 0;
  const MAX_FETCH_COUNT = 10;

  while (lastTradeTime < endTime && allTrades.length < maxTrades) {
    try {
      // 🔸 Điều chỉnh limit để tránh lấy quá nhiều dữ liệu mỗi lần
      const limit = Math.min(1000, maxTrades - allTrades.length);
      const url = `https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT&startTime=${lastTradeTime}&endTime=${endTime}&limit=${limit}`;
      const response = await axios.get(url);
      const trades = response.data;

      if (!Array.isArray(trades) || trades.length === 0) {
        console.warn("🚨 Không có dữ liệu từ Binance.");
        break;
      }

      // 🔸 Thêm dữ liệu theo lô
      allTrades = allTrades.concat(trades);
      lastTradeTime = trades[trades.length - 1].T + 1;
      fetchCount++;

      if (fetchCount >= MAX_FETCH_COUNT) {
        console.warn(`⚠️ Đã đạt giới hạn ${MAX_FETCH_COUNT} lần gọi API.`);
        break;
      }
      
      // 🔸 Thêm độ trễ giữa các lần gọi API
      await new Promise(resolve => setTimeout(resolve, 100)); 
      
    } catch (err) {
      console.error("❌ Lỗi khi lấy dữ liệu Binance:", err.message);
      break;
    }
  }

  return allTrades.length > 0 ? allTrades.map(trade => ({
    symbol: "BTCUSDT",
    price: parseFloat(trade.p),
    volume: parseFloat(trade.q),
    type: trade.m ? "sell" : "buy",
    timestamp: new Date(trade.T),
  })) : [];
};



module.exports = router;
