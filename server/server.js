const express = require("express");
const cors = require("cors");
const connectDB = require("./database");
require("dotenv").config();
const WebSocket = require("ws");
const Candlestick = require("./models/CandlestickModel");

const priceRoutes = require("./routes/priceRoutes");
const candlestickRoutes = require("./routes/candlestickRoutes");
const tradeRoutes = require("./routes/tradeRoutes");
const marketRoutes = require("./routes/market");
const heatmapRoutes = require("./routes/heatmapRoutes");

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
app.use("/api/heatmap", heatmapRoutes);


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
let binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");

binanceWS.on("open", () => {
  console.log("✅ Kết nối WebSocket Binance thành công!");
});

binanceWS.on("error", (error) => {
  console.error("❌ Lỗi WebSocket Binance:", error);
});

// 🔹 Xử lý dữ liệu từ Binance WebSocket
binanceWS.on("message", async (data) => {
  const trade = JSON.parse(data);
  const currentPrice = parseFloat(trade.p);
  const volume = parseFloat(trade.q);
  const timestamp = new Date(trade.T);
  const minuteTimestamp = new Date(timestamp.setSeconds(0, 0)); // Cắt xuống phút gần nhất

  try {
    // ✅ Sử dụng bulkWrite để giảm số lần gọi DB
    await Candlestick.bulkWrite([
      {
        updateOne: {
          filter: { timestamp: minuteTimestamp },
          update: {
            $max: { high: currentPrice },
            $min: { low: currentPrice },
            $set: { close: currentPrice },
            $inc: { volume: volume }
          },
          upsert: true  // Nếu không tìm thấy, sẽ tạo mới
        }
      }
    ]);

    // console.log("✅ Cập nhật hoặc lưu nến vào MongoDB:", {
    //   timestamp: minuteTimestamp,
    //   price: currentPrice,
    //   volume: volume,
    // });
  } catch (err) {
    console.error("❌ Lỗi khi lưu hoặc cập nhật nến:", err);
  }
});


// 🔹 Xử lý mất kết nối và tự động reconnect
binanceWS.on("close", () => {
  console.log("⚠️ WebSocket Binance bị mất kết nối. Đang thử kết nối lại sau 5 giây...");
  setTimeout(() => {
    binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@trade");
  }, 5000);
});
