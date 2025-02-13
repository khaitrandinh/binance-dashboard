import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from "recharts";

const TradeBarChart = () => {
  const [tradeData, setTradeData] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/trades/trade-volume")
      .then((response) => {
        console.log("📊 Dữ liệu nhận từ API:", response.data);
        setTradeData(response.data);
      })
      .catch((error) => console.error("❌ Lỗi khi lấy trade-volume:", error));
  }, []);
  

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Phân bổ khối lượng mua & bán theo vùng giá</h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={tradeData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="priceRange" angle={-45} textAnchor="end" label={{ value: "Vùng giá BTC (USDT)", position: "bottom", offset: 60 }} />
          <YAxis label={{ value: "Khối lượng BTC giao dịch", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="buyVolume" stackId="stack" fill="#4CAF50" name="Mua (Buy)" />
          <Bar dataKey="sellVolume" stackId="stack" fill="#F44336" name="Bán (Sell)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TradeBarChart;
