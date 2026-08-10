import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./routes/index";
import AuthPage from "./routes/auth";
import VideosPage from "./routes/videos";
import MusicsPage from "./routes/musics";
import AccountsPage from "./routes/accounts";
import CampanhaPage from "./routes/campanha";
import SchedulePage from "./routes/schedule";
import ProcessarPage from "./routes/processar";
import ArtistasPage from "./routes/artistas";
import GarimpoPage from "./routes/garimpo";
import PublicacoesPage from "./routes/publicacoes";
import AnalyticsPage from "./routes/analytics";
import SecurityReportPage from "./routes/security-report";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/musics" element={<MusicsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/campanha" element={<CampanhaPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/processar" element={<ProcessarPage />} />
            <Route path="/artistas" element={<ArtistasPage />} />
            <Route path="/garimpo" element={<GarimpoPage />} />
            <Route path="/publicacoes" element={<PublicacoesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/security-report" element={<SecurityReportPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </>
  );
}

export default App;
