import React, { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const HistoryChart = ({ symbol = "BTCUSDT" }) => {  // Đặt giá trị mặc định cho symbol
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    if (!symbol) {
      console.error("❌ Lỗi: Symbol không hợp lệ");
      return;
    }

    const fetchHistory = async () => {
      console.log(`📡 Gửi request API: /api/price/history/${symbol}`);

      try {
        const response = await axios.get(`http://localhost:5000/api/price/history/${symbol}`);
        console.log("📩 Dữ liệu lịch sử nhận được từ API:", response.data);

        if (response.data.length > 0) {
          setHistoryData(response.data.reverse()); // Đảo ngược dữ liệu
        }
      } catch (error) {
        console.error("❌ Lỗi khi gọi API:", error);
      }
    };

    fetchHistory();
  }, [symbol]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Biểu đồ lịch sử giá {symbol}</h2>
      {historyData.length > 0 ? (
        <LineChart width={600} height={300} data={historyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="price" stroke="red" strokeWidth={2} />
        </LineChart>
      ) : (
        <p>⏳ Đang tải dữ liệu...</p>
      )}
    </div>
  );
};

export default HistoryChart;
