import React, { useEffect, useState } from "react";
import axios from "axios";
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Bar, Line } from "recharts";

const CandlestickChart = ({ symbol }) => {
  const [candlestickData, setCandlestickData] = useState([]);

  useEffect(() => {
    const fetchCandles = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/candles/history/BTCUSDT`);
        console.log("📩 Dữ liệu nến nhận được:", response.data);
        setCandlestickData(response.data.reverse());
      } catch (error) {
        console.error("❌ Lỗi khi lấy dữ liệu nến:", error);
      }
    };

    fetchCandles();
  }, [symbol]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Biểu đồ nến {symbol}</h2>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={candlestickData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip />
          <Bar dataKey="volume" fill="#8884d8" />
          <Line type="monotone" dataKey="close" stroke="red" strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CandlestickChart;
