const express = require("express");
const axios = require("axios");
const router = express.Router();
const AggregatedTrade = require("../models/AggregatedTrade");

// Hàm xử lý dữ liệu giao dịch (tính khối lượng theo price range cho từng period)
const processTradeData = (klineData, priceRanges, expectedPeriodCount, timeframe) => {
  // Tạo template cho mỗi period
  const buyData = Array.from({ length: expectedPeriodCount }, (_, idx) => {
    const obj = { period: idx };
    priceRanges.forEach(range => {
      obj[range] = 0;
    });
    return obj;
  });
  const sellData = Array.from({ length: expectedPeriodCount }, (_, idx) => {
    const obj = { period: idx };
    priceRanges.forEach(range => {
      obj[range] = 0;
    });
    return obj;
  });

  // Chuyển đổi priceRanges thành mảng các object
  const buckets = priceRanges.map(range => {
    const [minStr, maxStr] = range.split(" - ");
    return { label: range, min: Number(minStr), max: Number(maxStr) };
  }).sort((a, b) => a.min - b.min);

  klineData.forEach(kline => {
    const klineTime = new Date(kline.openTime);
    let period;
    if (timeframe === "day") {
      period = klineTime.getUTCHours();
    } else if (timeframe === "month") {
      period = klineTime.getUTCDate() - 1;
    } else if (timeframe === "year") {
      period = klineTime.getUTCMonth();
    }

    const high = parseFloat(kline.highPrice);
    const low = parseFloat(kline.lowPrice);
    const buyVolume = parseFloat(kline.buyVolume);
    const sellVolume = parseFloat(kline.sellVolume);

    // Tìm tất cả các bucket mà price range đi qua
    const affectedBuckets = buckets.filter(bucket => 
      (low <= bucket.max && high >= bucket.min)
    );

    if (affectedBuckets.length > 0) {
      // Tính tổng range mà giá đã đi qua
      const totalPriceRange = high - low;
      
      affectedBuckets.forEach(bucket => {
        // Tính phần overlap giữa price range và bucket
        const overlapStart = Math.max(low, bucket.min);
        const overlapEnd = Math.min(high, bucket.max);
        const overlapRange = overlapEnd - overlapStart;
        
        // Tính tỷ lệ volume dựa trên overlap
        const volumeRatio = overlapRange / totalPriceRange;
        
        // Phân bổ volume theo tỷ lệ
        buyData[period][bucket.label] += buyVolume * volumeRatio;
        sellData[period][bucket.label] += sellVolume * volumeRatio;
      });
    } else {
      // Trường hợp không tìm thấy bucket phù hợp
      // Tìm bucket gần nhất
      let nearestBucket = buckets[0];
      let smallestDiff = Infinity;
      const avgPrice = (high + low) / 2;

      buckets.forEach(bucket => {
        const bucketMid = (bucket.min + bucket.max) / 2;
        const diff = Math.abs(avgPrice - bucketMid);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          nearestBucket = bucket;
        }
      });

      buyData[period][nearestBucket.label] += buyVolume;
      sellData[period][nearestBucket.label] += sellVolume;
    }
  });

  return { buyData, sellData };
};

router.get("/:timeframe/:date?", async (req, res) => {
  try {
    const { timeframe, date } = req.params;
    let startTime, endTime;
    let groups = []; // Mảng nhóm (periods)
    let lastDay;
    const year = date.split("-")[0];
    const month = date.split("-")[1];

    // Xác định khoảng thời gian và mảng nhóm theo timeframe
    if (timeframe === "day") {
      startTime = new Date(`${date}T00:00:00.000Z`);
      endTime = new Date(`${date}T23:59:59.999Z`);
      groups = Array.from({ length: 24 }, (_, i) => i); // giờ: 0-23
    } else if (timeframe === "month") {
      // Định dạng "YYYY-MM"
      lastDay = new Date(year, Number(month), 0).getDate();
      startTime = new Date(`${date}-01T00:00:00.000Z`);
      endTime = new Date(`${date}-${lastDay.toString().padStart(2, "0")}T23:59:59.999Z`);
      groups = Array.from({ length: lastDay }, (_, i) => i + 1); // ngày: 1 đến lastDay
    } else if (timeframe === "year") {
      startTime = new Date(`${date}-01-01T00:00:00.000Z`);
      endTime = new Date(`${date}-12-31T23:59:59.999Z`);
      groups = Array.from({ length: 12 }, (_, i) => i + 1); // tháng: 1-12
    } else {
      return res.status(400).json({ error: "Invalid timeframe" });
    }

    // Số period mong đợi
    let expectedPeriodCount = timeframe === "day" ? 24 : 
                              timeframe === "month" ? groups.length : 12;

    console.log("Query time range:", {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    });

    // Lấy dữ liệu từ Binance
    const klineData = await fetchBinanceData(startTime, endTime, timeframe);
    if (klineData.length === 0) {
      return res.status(404).json({ error: "No data available" });
    }

    // Tính giá cao nhất và thấp nhất từ klineData (chỉ tính những kline không rỗng)
    let highestPrice = -Infinity;
    let lowestPrice = Infinity;
    klineData.forEach(kline => {
      if (!kline.isEmpty) {
        const high = parseFloat(kline.highPrice);
        const low = parseFloat(kline.lowPrice);
        if (high > highestPrice) highestPrice = high;
        if (low < lowestPrice) lowestPrice = low;
      }
    });
    console.log("Price range:", { highestPrice, lowestPrice });

    // Tạo khoảng giá thành 5 phần
    const rangeSize = (highestPrice - lowestPrice) / 5;
    const priceRanges = Array.from({ length: 5 }, (_, i) => {
      const min = lowestPrice + i * rangeSize;
      const max = lowestPrice + (i + 1) * rangeSize;
      return `${Math.round(min)} - ${Math.round(max)}`;
    });

    // Sắp xếp priceRanges theo thứ tự giảm dần (để cột cao nhất hiển thị ở trên cùng)
    const sortedPriceRanges = [...priceRanges].sort((a, b) => {
      const aMin = Number(a.split(" - ")[0]);
      const bMin = Number(b.split(" - ")[0]);
      return bMin - aMin;
    });

    // Xử lý dữ liệu giao dịch
    const processedData = processTradeData(klineData, sortedPriceRanges, expectedPeriodCount, timeframe);
    console.log("Processed data summary:", {
      totalBuyPeriods: processedData.buyData.length,
      totalSellPeriods: processedData.sellData.length
    });

    // Chuẩn bị time labels dựa vào timeframe
    let timeLabels;
    if (timeframe === "day") {
      timeLabels = Array.from({ length: 24 }, (_, i) => i);
    } else if (timeframe === "month") {
      timeLabels = Array.from({ length: expectedPeriodCount }, (_, i) => i + 1);
    } else {
      timeLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    }

    // Đổi key của mỗi period theo timeframe
    let keyName = "group";
    if (timeframe === "day") {
      keyName = "hour";
    } else if (timeframe === "month") {
      keyName = "day";
    } else if (timeframe === "year") {
      keyName = "month";
    }
    const buyDataWithKey = processedData.buyData.map(item => ({
      [keyName]: timeframe === "day" ? item.period : item.period + 1,
      ...item
    }));
    const sellDataWithKey = processedData.sellData.map(item => ({
      [keyName]: timeframe === "day" ? item.period : item.period + 1,
      ...item
    }));

    const result = {
      timeLabels,
      priceRanges: sortedPriceRanges,
      buyData: buyDataWithKey,
      sellData: sellDataWithKey
    };

    // Cập nhật hoặc tạo mới document trong MongoDB
    await AggregatedTrade.findOneAndUpdate(
      { timeframe, date },
      {
        timeframe,
        date,
        timeKey: date,
        interval: timeframe,
        priceRanges: sortedPriceRanges,
        buyData: buyDataWithKey,
        sellData: sellDataWithKey,
        lastUpdated: new Date()
      },
      { upsert: true, new: true }
    );
    console.log("MongoDB update completed");

    res.json(result);

  } catch (err) {
    console.error("❌ Error in heatmap route:", err);
    res.status(500).json({ 
      error: "Server Error",
      message: err.message 
    });
  }
});

// Hàm lấy dữ liệu từ Binance (chuyển đổi thời gian về UTC, tạo map cho 24 giờ, điền dữ liệu từ API)
// Sửa lại hàm fetchBinanceData
const fetchBinanceData = async (startTime, endTime, timeframe) => {
  try {
    // Đảm bảo startTime và endTime là UTC
    const utcStartTime = new Date(startTime);
    const utcEndTime = new Date(endTime);
    const now = new Date();

    // Điều chỉnh thời gian kết thúc nếu vượt quá hiện tại
    const actualEndTime = utcEndTime > now ? now : utcEndTime;

    // Xác định interval dựa vào timeframe
    let interval;
    if (timeframe === "day") {
      interval = "1h";  // Lấy dữ liệu theo giờ cho view ngày
    } else if (timeframe === "month") {
      interval = "1d";  // Lấy dữ liệu theo ngày cho view tháng
    } else if (timeframe === "year") {
      interval = "1M";  // Lấy dữ liệu theo tháng cho view năm
    } else {
      throw new Error("Invalid timeframe");
    }

    // Khởi tạo dataMap
    let dataMap = new Map();
    
    if (timeframe === "day") {
      // Khởi tạo 24 giờ
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(utcStartTime);
        timestamp.setUTCHours(hour, 0, 0, 0);
        dataMap.set(timestamp.getTime(), {
          openTime: timestamp.getTime(),
          highPrice: '0',
          lowPrice: '0',
          buyVolume: '0',
          sellVolume: '0',
          isEmpty: true,
          hour: hour
        });
      }
    } else if (timeframe === "month") {
      // Khởi tạo các ngày trong tháng
      const daysInMonth = new Date(utcStartTime.getFullYear(), utcStartTime.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const timestamp = new Date(utcStartTime);
        timestamp.setUTCDate(day);
        dataMap.set(timestamp.getTime(), {
          openTime: timestamp.getTime(),
          highPrice: '0',
          lowPrice: '0',
          buyVolume: '0',
          sellVolume: '0',
          isEmpty: true,
          day: day
        });
      }
    } else if (timeframe === "year") {
      // Khởi tạo 12 tháng
      for (let month = 0; month < 12; month++) {
        const timestamp = new Date(utcStartTime);
        timestamp.setUTCMonth(month, 1);
        dataMap.set(timestamp.getTime(), {
          openTime: timestamp.getTime(),
          highPrice: '0',
          lowPrice: '0',
          buyVolume: '0',
          sellVolume: '0',
          isEmpty: true,
          month: month + 1 // Đổi thành 1-12 thay vì 0-11
        });
      }
    }

    console.log("Fetching Binance data for UTC:", 
      utcStartTime.toISOString(), 
      actualEndTime.toISOString(),
      `(Interval: ${interval})`
    );

    // Gọi Binance API với interval đã xác định
    const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&startTime=${utcStartTime.getTime()}&endTime=${actualEndTime.getTime()}`;
    const response = await axios.get(binanceUrl);
    
    console.log(`Received ${response.data.length} klines from Binance`);

    // Xử lý dữ liệu từ Binance
    response.data.forEach(kline => {
      const timestamp = parseInt(kline[0]);
      const date = new Date(timestamp);
      let mapKey;

      if (timeframe === "day") {
        date.setUTCMinutes(0, 0, 0);
        mapKey = date.getTime();
      } else if (timeframe === "month") {
        date.setUTCHours(0, 0, 0, 0);
        mapKey = date.getTime();
      } else if (timeframe === "year") {
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
        mapKey = date.getTime();
      }

      if (dataMap.has(mapKey)) {
        dataMap.set(mapKey, {
          openTime: mapKey,
          highPrice: kline[2],
          lowPrice: kline[3],
          buyVolume: kline[9],
          sellVolume: kline[5],
          isEmpty: false,
          ...(timeframe === "day" && { hour: date.getUTCHours() }),
          ...(timeframe === "month" && { day: date.getUTCDate() }),
          ...(timeframe === "year" && { month: date.getUTCMonth() + 1 })
        });
      }
    });

    // Log các khoảng thời gian không có dữ liệu
    for (let [ts, data] of dataMap) {
      if (data.isEmpty) {
        const timeStr = timeframe === "day" ? `hour ${data.hour}` :
                       timeframe === "month" ? `day ${data.day}` :
                       `month ${data.month}`;
        console.log(`Missing data for ${timeStr}:`, new Date(ts).toISOString());
      }
    }

    // Trả về dữ liệu đã sắp xếp
    return Array.from(dataMap.values())
      .sort((a, b) => a.openTime - b.openTime);

  } catch (err) {
    console.error("❌ Error fetching Binance data:", err);
    throw err;
  }
};

module.exports = router;
