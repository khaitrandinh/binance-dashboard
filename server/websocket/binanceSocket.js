const WebSocket = require("ws");
const MarketRealTime = require("../models/MarketRealTime");

const startBinanceWebSocket = (symbol) => {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`
  );

  ws.on("open", () => {
    console.log(`✅ WebSocket kết nối thành công: ${symbol}`);
  });

  ws.on("message", async (data) => {
    const parsedData = JSON.parse(data);
    const updateData = {
      symbol: parsedData.s,
      price: parseFloat(parsedData.c),
      volume: parseFloat(parsedData.v),
      updatedAt: new Date(),
    };

    // Cập nhật giá vào MongoDB
    await MarketRealTime.findOneAndUpdate({ symbol }, updateData, {
      upsert: true,
      new: true,
    });

    console.log(`🔥 Giá cập nhật: ${updateData.symbol} - ${updateData.price}`);
  });

  ws.on("error", (error) => {
    console.error("❌ Lỗi WebSocket:", error);
  });

  ws.on("close", () => {
    console.log(`❌ WebSocket đóng kết nối: ${symbol}`);
  });
};

module.exports = { startBinanceWebSocket };
