import React, { useState } from "react";
import "./Dashboard.css"; // Đảm bảo file này nằm trong thư mục styles hoặc đúng đường dẫn
import MarketTable from "../components/MarketTable";
import RealTimeChart from "../components/RealTimeChart";
import TradeBarChart from "../components/TradeBarChart";
import HeatmapChart from "../components/HeatmapChart";
import CandlestickChart from "../components/CandlestickChart";
import StackedBarChart from "../components/StackedBarChart";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("realtime");

  return (
    <div className="app-wrapper">
      {/* Sidebar nằm bên trái */}
      <aside className="sidebar">
        <div className="logo-container">
          {/* Sử dụng đường dẫn từ public: */}
          <img src="/images.png" alt="Logo" className="logo" /> DASHBOARD
        </div>
        <div className="sidebar-section-title">Dashboard</div>
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-menu-item ${activeTab === "realtime" ? "active" : ""}`}
            onClick={() => setActiveTab("realtime")}
          >
            <i className="icon">📊</i>
            <span>RealTime</span>
          </li>
          <li 
            className={`sidebar-menu-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <i className="icon">👥</i>
            <span>History</span>
          </li>
        </ul>
      </aside>

      {/* Main Content nằm bên phải */}
      <main className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-top">
            <h1 className="page-title">Performance Report</h1>
          </div>
        </header>

        {/* Metrics Row */}
        <div className="metrics-row">
          <div className="metric-card">
            <div className="metric-card-content">
              <div>
                <div className="metric-value">BTCUSDT</div>
                <div className="metric-label">
                  <MarketTable />
                </div>
              </div>
            </div>
          </div>
          {/* Có thể thêm các metric card khác */}
        </div>

        {/* Charts */}
        {activeTab === "realtime" && (
          <div className="charts-container">
            <div className="chart-container full-width">
              <RealTimeChart />
            </div>
            <div className="chart-container full-width">
              {/* <CandlestickChart /> */}
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="charts-container">
            <div className="charts-row">
              <div className="chart-container">
                <TradeBarChart />
              </div>
              <div className="chart-container">
                <HeatmapChart />
              </div>
            </div>
            <div className="chart-container full-width">
              <StackedBarChart />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          {/* Footer content nếu cần */}
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
