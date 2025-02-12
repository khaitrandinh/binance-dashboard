import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const StackedBarChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/trades/volume-distribution");
        console.log("📩 Dữ liệu từ API:", response.data); // Kiểm tra dữ liệu từ API
        setData(response.data);
      } catch (error) {
        console.error("❌ Lỗi khi lấy dữ liệu:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">📊 Phân bổ Mua/Bán theo vùng giá</h2>
      <BarChart width={700} height={400} data={data} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="priceRange" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="buyVolume" stackId="a" fill="green" />
        <Bar dataKey="sellVolume" stackId="a" fill="red" />
      </BarChart>
    </div>
  );
};

export default StackedBarChart;
