const express = require('express');
const axios = require('axios');
const router = express.Router();
const AggregatedTrade = require('../models/AggregatedTrade');

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
router.get("/:timeframe/:date?", async (req, res) => {
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

    // 🔸 Lấy dữ liệu đã có trong database
    let existingTradeData = await getAggregatedTradeData(startTime, endTime, interval);
    
    // 🔸 Xác định các thời điểm cần cập nhật
    let expectedTimes = generateExpectedTimes(startTime, interval);
    let availableTimes = new Set(existingTradeData.map(entry => entry.timeKey));
    let missingTimes = expectedTimes.filter(time => !availableTimes.has(time));

    if (missingTimes.length > 0) {
      console.log(`⚠️ Thiếu dữ liệu tại: ${missingTimes.join(", ")}. Tiến hành cập nhật...`);

      // 🔸 Cập nhật tất cả các thời điểm thiếu
      for (let missingTime of missingTimes) {
        let timePeriodStart, timePeriodEnd;

        if (interval === "hour") {
          timePeriodStart = new Date(`${date}T${missingTime.toString().padStart(2, "0")}:00:00.000Z`).getTime();
          timePeriodEnd = new Date(`${date}T${missingTime.toString().padStart(2, "0")}:59:59.999Z`).getTime();
        } else if (interval === "day") {
          timePeriodStart = new Date(`${date}-${missingTime.toString().padStart(2, "0")}T00:00:00.000Z`).getTime();
          timePeriodEnd = new Date(`${date}-${missingTime.toString().padStart(2, "0")}T23:59:59.999Z`).getTime();
        } else if (interval === "month") {
          timePeriodStart = new Date(`${date}-${missingTime.toString().padStart(2, "0")}-01T00:00:00.000Z`).getTime();
          let lastDay = new Date(new Date(timePeriodStart).getFullYear(), new Date(timePeriodStart).getMonth() + 1, 0).getDate();
          timePeriodEnd = new Date(`${date}-${missingTime.toString().padStart(2, "0")}-${lastDay}T23:59:59.999Z`).getTime();
        }

        // 🔸 Lấy dữ liệu tổng hợp từ Binance
        let aggregatedData = await fetchAggregatedBinanceData(timePeriodStart, timePeriodEnd, interval);
        
        if (aggregatedData.tradeCount > 0) {
          // 🔸 Lưu dữ liệu tổng hợp vào database
          await saveAggregatedTradeData(missingTime, interval, timePeriodStart, timePeriodEnd, aggregatedData);
          
          // 🔸 Thêm vào danh sách dữ liệu hiện có
          existingTradeData.push({
            timeKey: missingTime,
            avgPrice: aggregatedData.avgPrice,
            totalBuyVolume: aggregatedData.buyVolume,
            totalSellVolume: aggregatedData.sellVolume,
            minPrice: aggregatedData.minPrice,
            maxPrice: aggregatedData.maxPrice
          });
          
          console.log(`✅ Đã cập nhật dữ liệu tổng hợp cho thời điểm: ${missingTime} (${aggregatedData.tradeCount} giao dịch)`);
        } else {
          console.log(`⚠️ Không có dữ liệu cho thời điểm: ${missingTime}`);
        }
      }
    }

    if (existingTradeData.length === 0) {
      return res.status(404).json({ error: "No data available for the specified timeframe" });
    }

    // 🔸 Tìm min/max price từ dữ liệu tổng hợp
    const minPrice = Math.min(...existingTradeData.map(entry => entry.minPrice));
    const maxPrice = Math.max(...existingTradeData.map(entry => entry.maxPrice));
    
    const priceRanges = await getFibonacciPriceRangesHeatmap(minPrice, maxPrice);

    // 🔸 Tạo dữ liệu heatmap từ dữ liệu tổng hợp
    let heatmapData = {};
    expectedTimes.forEach(time => {
      heatmapData[time] = {};
      priceRanges.forEach(range => {
        heatmapData[time][range.label] = { buy: 0, sell: 0 };
      });
    });

    // 🔸 Điền dữ liệu vào heatmap
    for (const entry of existingTradeData) {
      const timeKey = entry.timeKey;
      const entryPrice = entry.avgPrice;
      
      const priceRange = priceRanges.find(range => entryPrice >= range.min && entryPrice <= range.max);

      
      if (priceRange && heatmapData[timeKey]) {
        heatmapData[timeKey][priceRange.label].buy = entry.totalBuyVolume;
        heatmapData[timeKey][priceRange.label].sell = entry.totalSellVolume;
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

// 🔹 **Lấy dữ liệu tổng hợp đã có trong database**
async function getAggregatedTradeData(startTime, endTime, interval) {
  try {
    // Giả sử bạn có một collection AggregatedTrade để lưu dữ liệu tổng hợp
    const aggregatedData = await AggregatedTrade.find({
      interval: interval,
      startTime: { $gte: startTime },
      endTime: { $lte: endTime }
    }).lean();
    
    // Chuyển đổi dữ liệu sang định dạng phù hợp
    return aggregatedData.map(entry => ({
      timeKey: entry.timeKey,
      avgPrice: entry.avgPrice,
      totalBuyVolume: entry.buyVolume,
      totalSellVolume: entry.sellVolume,
      minPrice: entry.minPrice,
      maxPrice: entry.maxPrice
    }));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu tổng hợp từ database:", err);
    return [];
  }
}

// 🔹 **Lưu dữ liệu tổng hợp vào database**
async function saveAggregatedTradeData(timeKey, interval, startTime, endTime, data) {
  try {
    await AggregatedTrade.findOneAndUpdate(
      { timeKey: timeKey, interval: interval },
      {
        timeKey: timeKey,
        interval: interval,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        avgPrice: data.avgPrice,
        buyVolume: data.buyVolume,
        sellVolume: data.sellVolume,
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        tradeCount: data.tradeCount
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("❌ Lỗi khi lưu dữ liệu tổng hợp vào database:", err);
  }
}

// 🔹 **Lấy dữ liệu tổng hợp từ Binance**
async function fetchAggregatedBinanceData(startTime, endTime, interval) {
  try {
    // Lấy thông tin tổng hợp từ Binance Klines API thay vì aggTrades
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${getBinanceInterval(interval)}&startTime=${startTime}&endTime=${endTime}`;
    const response = await axios.get(binanceUrl);
    const klines = response.data;

    if (!Array.isArray(klines) || klines.length === 0) {
      console.warn(`⚠️ Không có giao dịch từ Binance trong khoảng ${new Date(startTime).toISOString()} - ${new Date(endTime).toISOString()}`);
      return { tradeCount: 0, avgPrice: 0, buyVolume: 0, sellVolume: 0, minPrice: 0, maxPrice: 0 };
    }
    

    // Tính toán giá trị tổng hợp từ klines
    let totalVolume = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalPrice = 0;

    for (const kline of klines) {
      // Kline data theo định dạng Binance API: [openTime, open, high, low, close, volume, closeTime, ...]
      const open = parseFloat(kline[1]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);
      const quoteVolume = parseFloat(kline[7]);
      
      // Tính giá trung bình trong khoảng
      const avgPrice = (high + low) / 2;
      
      // Cập nhật min/max
      if (low < minPrice) minPrice = low;
      if (high > maxPrice) maxPrice = high;
      
      // Tính toán volume
      totalVolume += volume;
      totalPrice += avgPrice * volume;
      
      // Ví dụ cải tiến - phân chia volume theo tỷ lệ biến động giá
        const priceChange = close - open;
        const totalChange = Math.abs(priceChange);

        if (priceChange >= 0) {
          const buyRatio = priceChange / (high - low);
          totalBuyVolume += volume * buyRatio;
          totalSellVolume += volume * (1 - buyRatio);
        } else {
          const sellRatio = Math.abs(priceChange) / (high - low);
          totalSellVolume += volume * sellRatio;
          totalBuyVolume += volume * (1 - sellRatio);
        }
    }

    const avgPrice = totalVolume > 0 ? totalPrice / totalVolume : 0;

    return {
      tradeCount: klines.length,
      avgPrice: avgPrice,
      buyVolume: totalBuyVolume,
      sellVolume: totalSellVolume,
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice === -Infinity ? 0 : maxPrice
    };
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu tổng hợp từ Binance:", err.message);
    return { tradeCount: 0, avgPrice: 0, buyVolume: 0, sellVolume: 0, minPrice: 0, maxPrice: 0 };
  }
}

// 🔹 **Chuyển đổi interval sang định dạng Binance**
function getBinanceInterval(interval) {
  switch (interval) {
    case "hour":
      return "1h";
    case "day":
      return "1d";
    case "month":
      return "1M";
    default:
      return "1h";
  }
}

// 🔹 **Hàm tạo danh sách thời gian kỳ vọng**
function generateExpectedTimes(startTime, interval) {
  let times = [];

  if (interval === "hour") {
    for (let i = 0; i < 24; i++) times.push(i);
  } else if (interval === "day") {
    let year = startTime.getFullYear();
    let month = startTime.getMonth() + 1;
    let daysInMonth = new Date(year, month, 0).getDate();  // ✅ Xác định đúng số ngày trong tháng

    for (let i = 1; i <= daysInMonth; i++) times.push(i);
  } else if (interval === "month") {
    for (let i = 1; i <= 12; i++) times.push(i);
  }

  return times;
}


module.exports = router;