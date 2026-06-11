import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./routes/index";
import AuthPage from "./routes/auth";
import VideosPage from "./routes/videos";
import MusicsPage from "./routes/musics";
import AccountsPage from "./routes/accounts";
import CampaignsPage from "./routes/campaigns";
import SchedulePage from "./routes/schedule";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/musics" element={<MusicsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
