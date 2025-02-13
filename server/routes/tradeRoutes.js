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

    console.log(`📩 Lấy dữ liệu từ ${startTime} đến ${endTime}`);

    // 🔹 Kiểm tra xem dữ liệu đã có trong MongoDB chưa
    const existingTrades = await Trade.find({
      timestamp: { $gte: startTime, $lte: endTime }
    });

    if (existingTrades.length > 0) {
      console.log("✅ Dữ liệu đã tồn tại trong MongoDB, không cần fetch từ Binance.");
      return res.json(await formatTradeData(existingTrades));
    }

    console.log("⚡ Dữ liệu chưa có, gọi API Binance...");

    // 🔹 Lấy dữ liệu từng giờ từ Binance
    let allTrades = [];

    for (let hour = 0; hour < 24; hour++) {
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

    // 🔹 Lưu vào MongoDB
    if (formattedTrades.length > 0) {
      await Trade.insertMany(formattedTrades);
      console.log("✅ Dữ liệu đã được lưu vào MongoDB.");
    }


    // 🔹 Trả dữ liệu đã format cho frontend
    res.json(await formatTradeData(formattedTrades));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ✅ Hàm format dữ liệu theo từng giờ (group by hour)
const formatTradeData = async (trades) => {
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


// 📌 Hàm lấy giá BTC hiện tại và chia vùng giá hợp lý
const getDynamicPriceRanges = async () => {
  try {
    // 🔹 Lấy giá BTC hiện tại từ Binance API
    const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
    const btcPrice = parseFloat(response.data.price);

    console.log(`📊 Giá BTC hiện tại: ${btcPrice} USDT`);

    // ✅ Chia vùng giá hợp lý dựa trên giá BTC hiện tại
    let step;
    if (btcPrice < 30000) {
      step = 2500;  // Khi BTC thấp, chia nhỏ để rõ hơn
    } else if (btcPrice < 60000) {
      step = 5000;  // Khi BTC trung bình, chia mức vừa
    } else if (btcPrice < 100000) {
      step = 10000; // Khi BTC cao, chia lớn hơn
    } else {
      step = 20000; // Khi BTC rất cao, chia rộng hơn
    }

    // 🔹 Xác định min/max price để chia vùng
    const minPrice = Math.floor(btcPrice / step - 5) * step;
    const maxPrice = Math.ceil(btcPrice / step + 5) * step;

    // 🔹 Tạo danh sách vùng giá
    let priceRanges = [];
    for (let price = minPrice; price < maxPrice; price += step) {
      priceRanges.push({
        min: price,
        max: price + step,
        label: `${price} - ${price + step} USDT`,
        buyVolume: 0,
        sellVolume: 0
      });
    }

    console.log("📊 Vùng giá được chia:", priceRanges);
    return priceRanges;
  } catch (error) {
    console.error("❌ Lỗi khi lấy giá BTC:", error);
    return [];
  }
};


// 📊 API 2: Lấy khối lượng giao dịch theo vùng giá
router.get("/trade-volume", async (req, res) => {
  try {
    // 🔹 Lấy danh sách vùng giá phù hợp với BTC hiện tại
    const priceRanges = await getDynamicPriceRanges();
    if (!priceRanges) return res.status(500).json({ error: "Không thể lấy vùng giá" });

    // 🔹 Lấy dữ liệu từ MongoDB và nhóm theo vùng giá
    const data = await Trade.aggregate([
      {
        $group: {
          _id: {
            priceRange: {
              $switch: {
                branches: priceRanges.map(range => ({
                  case: { $and: [{ $gte: ["$price", range.min] }, { $lt: ["$price", range.max] }] },
                  then: range.label,
                })),
                default: "Khác",
              },
            },
          },
          buyVolume: { $sum: { $cond: [{ $eq: ["$type", "buy"] }, "$volume", 0] } },
          sellVolume: { $sum: { $cond: [{ $eq: ["$type", "sell"] }, "$volume", 0] } }
        }
      },
      { $sort: { "_id.priceRange": 1 } }
    ]);

    // 🔹 Đảm bảo tất cả vùng giá xuất hiện dù không có giao dịch
    const formattedData = priceRanges.map(range => {
      const found = data.find(d => d._id.priceRange === range.label);
      return {
        priceRange: range.label,
        buyVolume: found ? found.buyVolume : 0,
        sellVolume: found ? found.sellVolume : 0
      };
    });

    console.log("📊 Dữ liệu gửi đến FE:", JSON.stringify(formattedData, null, 2));
    res.json(formattedData);
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
