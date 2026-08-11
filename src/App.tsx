import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import AgendaPage from "./routes/agenda";
import SecurityReportPage from "./routes/security-report";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { ThemeProvider } from "./components/theme-provider";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="flux-post-theme">
      <>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/biblioteca" element={<VideosPage />} />
              <Route path="/musics" element={<MusicsPage />} />
              <Route path="/musicas" element={<MusicsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/campanha" element={<CampanhaPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/processar" element={<ProcessarPage />} />
              <Route path="/artistas" element={<ArtistasPage />} />
              <Route path="/garimpo" element={<GarimpoPage />} />
              <Route path="/publicacoes" element={<PublicacoesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/security-report" element={<SecurityReportPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </>
    </ThemeProvider>
  );
}

export default App;
