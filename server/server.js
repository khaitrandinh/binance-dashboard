const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();
const WebSocket = require("ws");

const Price = require("./models/PriceModel");
const Candlestick = require("./models/CandlestickModel");
const Trade = require("./models/tradeModel");

const priceRoutes = require("./routes/priceRoutes");
const candlestickRoutes = require("./routes/candlestickRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const marketRoutes = require("./routes/market");

// 🔹 Khởi tạo Express Server
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Kết nối MongoDB
connectDB();

// 🔹 Test API
app.get("/", (req, res) => {
  res.send("🚀 Binance Dashboard API is running...");
});

app.use("/api/market", marketRoutes);  // Đảm bảo đã đăng ký route

// 🔹 Định nghĩa API Routes
app.use("/api/price", priceRoutes);
app.use("/api/candles", candlestickRoutes);
app.use("/api/trades", tradeRoutes);

// 🔹 Khởi động server Express
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// 🔹 Tạo WebSocket Server cho frontend
const wss = new WebSocket.Server({ port: 5001 });

wss.on("connection", (ws) => {
  console.log("✅ Client WebSocket đã kết nối!");

  ws.send(JSON.stringify({ message: "WebSocket Server sẵn sàng!" }));

  const sendRealTimeData = setInterval(() => {
    ws.send(JSON.stringify({ price: Math.random() * 100, time: new Date().toLocaleTimeString() }));
  }, 2000);

  ws.on("message", (message) => {
    console.log("📩 Nhận tin nhắn từ client:", message);
  });

  ws.on("close", () => {
    console.log("❌ Client WebSocket bị đóng!");
    clearInterval(sendRealTimeData);
  });

  ws.onerror = (error) => {
    console.error("❌ Lỗi WebSocket Server:", error);
  };
});

// 🔹 Kết nối WebSocket với Binance API và xử lý dữ liệu
const binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

let candleData = null;
let lastCandleTimestamp = null;

binanceWS.on("open", () => {
  console.log("✅ Kết nối WebSocket Binance thành công!");
});

binanceWS.on("error", (error) => {
  console.error("❌ Lỗi WebSocket Binance:", error);
});

// 🔹 Xử lý dữ liệu từ Binance WebSocket
binanceWS.on("message", async (data) => {
  try {
    const trade = JSON.parse(data);
    const currentPrice = parseFloat(trade.p);
    const volume = parseFloat(trade.q);
    const timestamp = new Date(trade.T);
    const minuteTimestamp = new Date(timestamp.setSeconds(0, 0));

    // 🔸 Lưu dữ liệu giá real-time vào MongoDB
    const newPrice = {
      symbol: "BTCUSDT",
      price: currentPrice,
      volume: volume,
    };

    await Price.create(newPrice);
    console.log("✅ Dữ liệu giá đã lưu vào MongoDB:", newPrice);

    // 🔸 Xử lý dữ liệu nến
    if (!candleData || minuteTimestamp > lastCandleTimestamp) {
      if (candleData) {
        await Candlestick.create(candleData);
        console.log("✅ Lưu nến vào MongoDB:", candleData);
      }

      candleData = {
        symbol: "BTCUSDT",
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: volume,
        timestamp: minuteTimestamp,
      };
      lastCandleTimestamp = minuteTimestamp;
    } else {
      candleData.high = Math.max(candleData.high, currentPrice);
      candleData.low = Math.min(candleData.low, currentPrice);
      candleData.close = currentPrice;
      candleData.volume += volume;
    }

    // 🔸 Lưu dữ liệu giao dịch vào MongoDB
    const newTrade = new Trade({
      symbol: trade.s,
      price: currentPrice,
      volume: volume,
      type: trade.m ? "sell" : "buy",
      timestamp: timestamp,
    });

    await newTrade.save();
    console.log("✅ Trade đã lưu vào MongoDB:", newTrade);

    // 🔸 Gửi dữ liệu real-time đến client
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ price: currentPrice, candle: candleData, trade: newTrade }));
      }
    });
  } catch (error) {
    console.error("❌ Lỗi xử lý dữ liệu Binance:", error);
  }
});

// 🔹 Xử lý mất kết nối và tự động reconnect
binanceWS.on("close", () => {
  console.log("⚠️ WebSocket Binance bị mất kết nối. Đang thử kết nối lại sau 5 giây...");
  setTimeout(() => {
    binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
  }, 5000);
});
