const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();
const Price = require("./models/PriceModel");

  
const Candlestick = require("./models/CandlestickModel");
const priceRoutes = require("./routes/priceRoutes");
const candlestickRoutes = require("./routes/candlestickRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
connectDB();

// Test API
app.get("/", (req, res) => {
  res.send("🚀 Binance Dashboard API is running...");
});

// Định nghĩa API Routes
app.use("/api/price", priceRoutes);
app.use("/api/candles", candlestickRoutes);

// Khởi động server Express
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// Tạo WebSocket Server cho frontend
const WebSocket = require("ws");

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
// Gửi dữ liệu real-time mỗi 2 giây
setInterval(() => {
  ws.send(JSON.stringify({ price: Math.random() * 100, time: new Date().toLocaleTimeString() }));
}, 2000);
});

// Kết nối WebSocket với Binance API
const binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

let candleData = null;
let lastCandleTimestamp = null;

binanceWS.on("message", async (data) => {
  const trade = JSON.parse(data);
  const currentPrice = parseFloat(trade.p);
  const volume = parseFloat(trade.q);
  const timestamp = new Date(trade.T);
  const minuteTimestamp = new Date(timestamp.setSeconds(0, 0));

  // 🔹 Lưu giá real-time vào MongoDB
  const newPrice = {
    symbol: "BTCUSDT",
    price: currentPrice,
    volume: volume,
  };

  try {
    await Price.create(newPrice);
    console.log("✅ Dữ liệu giá đã lưu vào MongoDB:", newPrice);
  } catch (err) {
    console.error("❌ Lỗi khi lưu giá vào MongoDB:", err);
  }

  // 🔹 Xử lý dữ liệu nến
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

  // 🔹 Gửi dữ liệu real-time và nến cho frontend
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ price: currentPrice, candle: candleData }));
    }
  });
});
