import React, { useEffect, useState } from "react";
import axios from "axios";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const HeatmapChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/trades/heatmap");
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
        setData(dataArray);
      } catch (error) {
        console.error("Lỗi fetch data:", error);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <p>Giờ: {data.x}h</p>
          <p>Giá: ${formatNumber(data.y)}</p>
          <p>Khối lượng: {data.color}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: '500px', padding: '20px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        📊 Heatmap - Khối lượng giao dịch theo giá
      </h2>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 60, left: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="x" 
              name="Giờ"
              tickFormatter={(value) => `${value}h`}
              label={{ value: 'Thời gian (giờ)', position: 'bottom', offset: 20 }}
            />
            <YAxis 
              dataKey="y" 
              name="Giá"
              tickFormatter={formatNumber}
              domain={['auto', 'auto']}
              label={{ value: 'Giá BTC', angle: -90, position: 'insideLeft', offset: 0 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Scatter
              data={data}
              fill="#ff0000"
              opacity={0.6}
              shape="circle"
            />
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%' 
        }}>
          <p>⏳ Đang tải dữ liệu...</p>
        </div>
      )}
    </div>
  );
};

export default HeatmapChart;