import { BrowserRouter, Route, Routes } from "react-router-dom"
import AppLayout from "@/components/AppLayout"
import DashboardPage from "@/pages/DashboardPage"
import AlertPage from "@/pages/AlertPage"
import HistoryPage from "@/pages/HistoryPage"
import SettingsPage from "@/pages/SettingsPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="alerts" element={<AlertPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
