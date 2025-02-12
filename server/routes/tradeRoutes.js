const express = require("express");
const Trade = require("../models/tradeModel");
const router = express.Router();

// 📊 API 1: Lấy dữ liệu phân bổ khối lượng theo vùng giá (cho Stacked Bar Chart)
router.get("/stacked", async (req, res) => {
  try {
    const data = await Trade.aggregate([
      {
        $group: {
          _id: { time: { $hour: "$timestamp" } },
          buyVolume: { $sum: { $cond: [{ $eq: ["$type", "buy"] }, "$volume", 0] } },
          sellVolume: { $sum: { $cond: [{ $eq: ["$type", "sell"] }, "$volume", 0] } }
        }
      },
      { $sort: { "_id.time": 1 } }
    ]);

    console.log("📩 API Stacked Bar Data:", data);

    if (!Array.isArray(data)) {
      console.error("❌ API không trả về array!");
      return res.status(500).json({ error: "API không trả về array!" });
    }

    // Chuyển đổi dữ liệu về đúng format
    const formattedData = data.map(item => ({
      time: item._id.time + ":00",  // Format thành chuỗi giờ
      buyVolume: item.buyVolume,
      sellVolume: item.sellVolume
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu Stacked Bar Chart:", err);
    res.status(500).json({ error: "Server Error" });
  }
});


// 📊 API 2: Lấy khối lượng giao dịch theo giờ (cho Bar Chart)
router.get("/trade-volume", async (req, res) => {
  try {
    const data = await Trade.aggregate([
      {
        $group: {
          _id: { $hour: "$timestamp" },
          buyVolume: { $sum: { $cond: [{ $eq: ["$type", "buy"] }, "$volume", 0] } },
          sellVolume: { $sum: { $cond: [{ $eq: ["$type", "sell"] }, "$volume", 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(data.map(item => ({
      hour: `${item._id}:00`,
      buyVolume: item.buyVolume,
      sellVolume: item.sellVolume
    })));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu theo giờ:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 📊 API 3: Heatmap - Lấy khối lượng mua theo vùng giá và thời gian
router.get("/heatmap", async (req, res) => {
  try {
    const data = await Trade.aggregate([
      {
        $group: {
          _id: { price: "$price", time: { $hour: "$timestamp" } },
          volume: { $sum: "$volume" }
        }
      },
      { $sort: { "_id.time": 1, "_id.price": 1 } }
    ]);

    // Kiểm tra dữ liệu trước khi gửi về frontend
    console.log("📩 API Heatmap Data:", data);

    // Chuyển đổi dữ liệu về đúng format
    res.json(data.map(item => ({
      x: item._id.time,
      y: item._id.price,
      size: 10, // Định kích thước dot cố định
      color: item.volume
    })));
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu heatmap:", err);
    res.status(500).json({ error: "Server Error" });
  }
});


module.exports = router;
