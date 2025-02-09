import React, { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const RealTimeChart = () => {
  const [chartData, setChartData] = useState([]);
  const wsRef = useRef(null);

  const connectWebSocket = () => {
    console.log("🔄 Đang kết nối WebSocket...");
    const ws = new WebSocket("ws://127.0.0.1:5001");

    ws.onopen = () => {
      console.log("✅ WebSocket đã kết nối!");
      ws.send("Client đã kết nối!");
    };

    ws.onerror = (error) => {
      console.error("❌ Lỗi kết nối WebSocket:", error);
    };

    ws.onclose = () => {
      console.warn("⚠️ WebSocket bị đóng! Đang thử kết nối lại sau 3s...");
      setTimeout(connectWebSocket, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📩 Dữ liệu nhận được:", data);

        setChartData((prev) => [
          ...prev.slice(-20),
          { time: new Date().toLocaleTimeString(), price: parseFloat(data.price) },
        ]);
      } catch (error) {
        console.error("❌ Lỗi xử lý dữ liệu WebSocket:", error);
      }
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        console.log("🔴 Đóng WebSocket khi component bị unmount");
      }
    };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📈 Biểu đồ giá real-time</h2>
      <LineChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis domain={["auto", "auto"]} />
        <Tooltip />
        <Line type="monotone" dataKey="price" stroke="blue" strokeWidth={2} />
      </LineChart>
    </div>
  );
};

export default RealTimeChart;
