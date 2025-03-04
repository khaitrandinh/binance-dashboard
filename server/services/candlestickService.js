const WebSocket = require("ws");

let binanceWS = null;
let broadcastCallback = null;

function startBinanceStream(callback) {
  broadcastCallback = callback;
  connectBinanceWS();
}

function connectBinanceWS() {
  if (binanceWS) binanceWS.terminate();

  binanceWS = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");

  binanceWS.on("open", () => console.log("✅ Kết nối Binance WebSocket!"));
  binanceWS.on("message", handleBinanceMessage);
  binanceWS.on("close", () => {
    console.warn("⚠️ Binance WebSocket bị đóng! Thử kết nối lại sau 5 giây...");
    setTimeout(connectBinanceWS, 5000);
  });
}

function handleBinanceMessage(data) {
  const message = JSON.parse(data);
  if (message.k) {
    const candle = {
      time: message.k.t / 1000,
      open: parseFloat(message.k.o),
      high: parseFloat(message.k.h),
      low: parseFloat(message.k.l),
      close: parseFloat(message.k.c),
    };

    if (broadcastCallback) {
      broadcastCallback("1m", candle);
    }
  }
}

// 🔹 Xuất đúng module
module.exports = { startBinanceStream };
