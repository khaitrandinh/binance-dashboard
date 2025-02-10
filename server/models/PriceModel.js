const mongoose = require("mongoose");

const PriceSchema = new mongoose.Schema({
  symbol: { type: String, required: true }, //cặp giao dịch 
  price: { type: Number, required: true }, //giá của tài sản
  volume: { type: Number, required: true }, // khối lượng giao dịch
  timestamp: { type: Date, default: Date.now } //thời gian lưu dữ liệu
});

const Price = mongoose.model("Price", PriceSchema);
module.exports = Price;
