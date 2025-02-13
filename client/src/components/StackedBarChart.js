import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Line, ComposedChart
} from "recharts";

const StackedBarChart = () => {
  const [buyData, setBuyData] = useState([]);
  const [sellData, setSellData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log(`📩 Fetching data for date: ${selectedDate}`);
        const response = await axios.get(`http://localhost:5000/api/trades/stacked/${selectedDate}`);
  
        if (!Array.isArray(response.data)) {
          console.error("❌ API không trả về array!", response.data);
          return;
        }
  
        console.log("📩 Dữ liệu Stacked Bar:", response.data);
        setBuyData(response.data.map(({ time, buyVolume }) => ({ time, buyVolume })));
        setSellData(response.data.map(({ time, sellVolume }) => ({ time, sellVolume })));
      } catch (error) {
        console.error("❌ Lỗi khi lấy dữ liệu:", error);
      }
    };
  
    fetchData();
  }, [selectedDate]);
    // ✅ Chỉ re-run khi `selectedDate` thay đổi
  

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Biểu đồ giao dịch - Lịch sử mua và bán</h2>

      {/* Bộ chọn ngày */}
      <div className="mb-4">
        <label className="font-semibold mr-2">Chọn ngày:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border p-2"
        />
      </div>

      {/* Biểu đồ Mua */}
      <h3 className="text-lg font-bold text-green-600">📈 Khối lượng MUA theo thời gian</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={buyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="buyVolume" fill="#4caf50" barSize={10} name="Khối lượng mua" />
          <Line type="monotone" dataKey="buyVolume" stroke="#2e7d32" strokeWidth={2} dot={false} name="Xu hướng mua" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Biểu đồ Bán */}
      <h3 className="text-lg font-bold text-red-600 mt-8">📉 Khối lượng BÁN theo thời gian</h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={sellData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="sellVolume" fill="#f44336" barSize={10} name="Khối lượng bán" />
          <Line type="monotone" dataKey="sellVolume" stroke="#d32f2f" strokeWidth={2} dot={false} name="Xu hướng bán" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StackedBarChart;
