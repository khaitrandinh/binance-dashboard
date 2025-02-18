import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Scatter, Line
} from "recharts";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { Select, MenuItem, Button, Paper, Typography, Box } from "@mui/material";

const HeatmapChart = () => {
  const [timeframe, setTimeframe] = useState("day");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [heatmapData, setHeatmapData] = useState([]);
  const [xLabels, setXLabels] = useState([]);
  const [yLabels, setYLabels] = useState([]);
  const [maxX, setMaxX] = useState(0);
  const [maxVolume, setMaxVolume] = useState(10000);
  const [trendData, setTrendData] = useState({ buy: [], sell: [] });

  // useEffect(() => {
  //   fetchData();
  // }, [timeframe, selectedDate]);

  const fetchData = async () => {
    try {
      let dateFormat;
      if (timeframe === "day") dateFormat = selectedDate.format("YYYY-MM-DD");
      else if (timeframe === "month") dateFormat = selectedDate.format("YYYY-MM");
      else if (timeframe === "year") dateFormat = selectedDate.format("YYYY");

      const response = await axios.get(`http://localhost:5000/api/heatmap/${timeframe}/${dateFormat}`);

      console.log("📌 Dữ liệu API trả về:", response.data);

      if (!response.data || !response.data.data) {
        console.warn("🚨 API trả về dữ liệu không hợp lệ!");
        setHeatmapData([]);
        setXLabels([]);
        setYLabels([]);
        setMaxX(0);
        setTrendData({ buy: [], sell: [] });
        return;
      }

      const formattedData = transformData(response.data, timeframe, selectedDate);
      console.log("🔥 Dữ liệu đã xử lý:", formattedData);
      setHeatmapData(formattedData.data);
      setXLabels(formattedData.xLabels);
      setYLabels(formattedData.yLabels);
      setMaxX(formattedData.maxX);
      setMaxVolume(formattedData.maxVolume);
      setTrendData(formattedData.trendData);
    } catch (error) {
      console.error("❌ Lỗi khi lấy dữ liệu heatmap:", error);
      setHeatmapData([]);
      setXLabels([]);
      setYLabels([]);
      setMaxX(0);
      setTrendData({ buy: [], sell: [] });
    }
  };

  // Định nghĩa trước khi gọi nó trong transformData
  const parsePriceRange = (priceRange) => {
    const [low, high] = priceRange.replace(" USDT", "").split(" - ").map(str => Number(str.trim()));
    return (low + high) / 2; 
  };
  
  

const transformData = (dataObj, timeframe, selectedDate) => {
  if (!dataObj || !Array.isArray(dataObj.data) || !Array.isArray(dataObj.timeLabels) || !Array.isArray(dataObj.priceRanges)) {
    return { data: [], xLabels: [], yLabels: [], maxX: 0, maxVolume: 10000, trendData: { buy: [], sell: [] } };
  }
  

  let yLabels = dataObj.priceRanges
  .map(parsePriceRange)
  .sort((a, b) => b - a); // Sắp xếp từ cao xuống thấp



  let xLabels = [];
  let maxX = 0;

  if (timeframe === "day") {
    xLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    maxX = 23;
  } else if (timeframe === "month") {
    const daysInMonth = selectedDate.daysInMonth();
    xLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
    maxX = daysInMonth - 1;
  } else if (timeframe === "year") {
    xLabels = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);
    maxX = 11;
  }

  // Chuẩn bị dữ liệu
  const heatmapData = [];
  let maxVolume = 0;

  // For trend lines
  const volumeByTimePoint = {};

  dataObj.data.forEach(row => {
    const timeValue = parseInt(row.time);

    if (timeValue >= 0 && timeValue <= maxX) {
      dataObj.priceRanges.forEach(priceLabel => {
        if (row[priceLabel]) {
          const buyVolume = row[priceLabel].buy || 0;
          const sellVolume = row[priceLabel].sell || 0;
          const avgPrice = parsePriceRange(priceLabel); // Chuyển thành số

          if (buyVolume > 0) {
            heatmapData.push({
              x: timeValue,
              y: avgPrice, // 🔥 Chuyển y thành số thay vì chuỗi
              volume: buyVolume,
              type: 'buy'
            });
            maxVolume = Math.max(maxVolume, buyVolume);
          }

          if (sellVolume > 0) {
            heatmapData.push({
              x: timeValue,
              y: avgPrice, // 🔥 Chuyển y thành số thay vì chuỗi
              volume: sellVolume,
              type: 'sell'
            });
            maxVolume = Math.max(maxVolume, sellVolume);
          }
        }
      });
    }
  });

  // Create trend data for the lines
  const buyTrendData = [];
  const sellTrendData = [];

  for (let i = 0; i <= maxX; i++) {
    const timePoint = volumeByTimePoint[i] || { buy: 0, sell: 0 };

    buyTrendData.push({
      x: i,
      volume: timePoint.buy
    });

    sellTrendData.push({
      x: i,
      volume: timePoint.sell
    });
  }

  return {
    data: heatmapData,
    xLabels,
    yLabels, // ✅ Dùng `yLabels` đã sắp xếp đúng
    maxX,
    maxVolume,
    trendData: {
      buy: buyTrendData,
      sell: sellTrendData
    }
  };
};


  // Tính toán kích thước và màu sắc dựa trên khối lượng
  const getMarkerProps = (entry) => {
    if (!entry || typeof entry.volume !== "number" || entry.volume <= 0) {
      return { fill: "#888888", fillOpacity: 0.3, r: 5 }; // Giá trị mặc định nếu có lỗi
    }
  
    const minSize = 8;  // Kích thước tối thiểu
    const maxSize = 30; // Kích thước tối đa
  
    // Đảm bảo `maxVolume` luôn hợp lệ
    const safeMaxVolume = Math.max(1, maxVolume); 
    const normalizedVolume = Math.log(entry.volume + 1) / Math.log(safeMaxVolume + 1);
    const size = minSize + (maxSize - minSize) * normalizedVolume;
  
    const fillOpacity = 0.3 + 0.7 * normalizedVolume;
    const fill = entry.type === 'buy' ? '#4CAF50' : '#F44336';
  
    return {
      fill,
      fillOpacity: isNaN(fillOpacity) ? 0.3 : fillOpacity, // Nếu bị NaN, đặt mặc định là 0.3
      r: isNaN(size) ? 5 : size / 2, // Nếu bị NaN, đặt mặc định là 5
    };
  };
  

  // Custom tooltip hiển thị thông tin chi tiết
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Handle both scatter plot data and trend line data
      if (data.y !== undefined) {
        // Scatter plot data (regular heatmap points)
        return (
          <Paper elevation={3} sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.95)' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              {xLabels[data.x]}
            </Typography>
            <Typography>Giá: {data.y} USDT</Typography>
            <Typography>
              Khối lượng: {data.volume.toLocaleString()} BTC
            </Typography>
            <Typography sx={{ color: data.type === 'buy' ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
              Loại: {data.type === 'buy' ? 'Mua' : 'Bán'}
            </Typography>
          </Paper>
        );
      } else if (payload[0].dataKey === 'buyVolume' || payload[0].dataKey === 'sellVolume') {
        // Trend line data
        const dataType = payload[0].dataKey === 'buyVolume' ? 'mua' : 'bán';
        const color = payload[0].dataKey === 'buyVolume' ? '#4CAF50' : '#F44336';
        
        return (
          <Paper elevation={3} sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.95)' }}>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              {xLabels[data.x]}
            </Typography>
            <Typography sx={{ color: color, fontWeight: 'medium' }}>
              Tổng khối lượng {dataType}: {payload[0].value.toLocaleString()} BTC
            </Typography>
          </Paper>
        );
      }
    }
    
    return null;
  };

  // Legend hiển thị ý nghĩa của kích thước và màu sắc
  const VolumeLegend = () => {
    const sizes = [0.25, 0.5, 0.75, 1];
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Khối lượng giao dịch</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sizes.map((size, i) => {
            const circleSize = 8 + 22 * size;
            const volume = Math.floor(Math.pow(maxVolume, size));
            return (
              <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mx: 2 }}>
                <svg width={circleSize + 10} height={circleSize + 10}>
                  <circle
                    cx={(circleSize + 10) / 2}
                    cy={(circleSize + 10) / 2}
                    r={circleSize / 2}
                    fill="#888888"
                    fillOpacity={0.3 + 0.7 * size}
                  />
                </svg>
                <Typography variant="caption">{volume.toLocaleString()}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  // Custom component to format trend line data
  const formatTrendData = () => {
    return heatmapData.map(point => ({
      ...point,
      buyVolume: (point.type === 'buy' ? point.volume : 0),
      sellVolume: (point.type === 'sell' ? point.volume : 0),
    }));
  };

  // Prepare trend line data for each time point
  const formatTrendLineData = () => {
    return Array.from({ length: maxX + 1 }, (_, index) => {
      const buyPoint = trendData.buy.find(p => p.x === index) || { volume: 0 };
      const sellPoint = trendData.sell.find(p => p.x === index) || { volume: 0 };
      
      return {
        x: index,
        buyVolume: buyPoint.volume,
        sellVolume: sellPoint.volume
      };
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center', color: '#333' }}>
        🔥 Heatmap Khối Lượng Giao Dịch BTC/USDT
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3 }}>
        <Select 
          value={timeframe} 
          onChange={(e) => setTimeframe(e.target.value)} 
          size="small"
          sx={{ mr: 2, minWidth: 80 }}
        >
          <MenuItem value="day">Ngày</MenuItem>
          <MenuItem value="month">Tháng</MenuItem>
          <MenuItem value="year">Năm</MenuItem>
        </Select>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            views={timeframe === "year" ? ["year"] : timeframe === "month" ? ["year", "month"] : ["year", "month", "day"]}
            value={selectedDate}
            onChange={(newDate) => setSelectedDate(newDate)}
            slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
          />
        </LocalizationProvider>

        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchData} 
          size="small"
          sx={{ ml: 2 }}
        >
          Lấy dữ liệu
        </Button>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#4CAF50', mr: 1 }}></Box>
          <Typography>Mua</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#F44336', mr: 1 }}></Box>
          <Typography>Bán</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
          <Box sx={{ width: 20, height: 2, bgcolor: '#4CAF50', mr: 1 }}></Box>
          <Typography>Xu hướng mua</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 20, height: 2, bgcolor: '#F44336', mr: 1 }}></Box>
          <Typography>Xu hướng bán</Typography>
        </Box>
      </Box>

      <ResponsiveContainer width="100%" height={700}>
        <ComposedChart
          margin={{ top: 20, right: 30, bottom: 80, left: 80 }}
          data={formatTrendLineData()}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, maxX]}
            ticks={Array.from({ length: xLabels.length }, (_, i) => i)}
            tickFormatter={(tick) => xLabels[tick] || ''}
            label={{ value: 'Thời gian', position: 'bottom', offset: 20, style: { fill: '#666', fontWeight: 500 } }}
            padding={{ left: 20, right: 20 }}
            stroke="#666"
            tick={{ fill: '#666' }}
            angle={timeframe === "month" && xLabels.length > 15 ? -45 : 0}
            textAnchor={timeframe === "month" && xLabels.length > 15 ? "end" : "middle"}
            height={timeframe === "month" && xLabels.length > 15 ? 80 : 60}
          />
          
          <YAxis
            type="number"
            dataKey="y"
            tickFormatter={(value) => `${value.toLocaleString()} USDT`}
            label={{ value: 'Giá (USDT)', angle: -90, position: 'left', offset: -60, style: { fill: '#666', fontWeight: 500 } }}
            width={100}
            stroke="#666"
            tick={{ fill: '#666' }}
            domain={['auto', 'auto']}  // Giữ đúng khoảng giá trị
            reversed  // 🔥 Đảo ngược trục Y
          />


          
          <Tooltip content={<CustomTooltip />} />

          {/* Trend Lines */}
          <Line
          type="monotone"
          dataKey="volume"
          data={trendData.buy}
          stroke="#4CAF50"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
          name="Xu hướng Mua"
        />

        <Line
          type="monotone"
          dataKey="volume"
          data={trendData.sell}
          stroke="#F44336"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
          name="Xu hướng Bán"
        />

          
          {/* Regular scatter plot for heatmap points */}
          <Scatter
            data={heatmapData}
            shape={(props) => {
              const { cx, cy, payload } = props;
              const { r, fill, fillOpacity } = getMarkerProps(payload);
              
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  fillOpacity={fillOpacity}
                  stroke={fill}
                  strokeOpacity={0.8}
                  strokeWidth={1}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      <VolumeLegend />
    </Paper>
  );
};

export default HeatmapChart;