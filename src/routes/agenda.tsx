import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function AgendaPage() {
  const [loading, setLoading] = useState(true);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchAgenda = async () => {
    try {
      const { data, error } = await supabase
        .from('publications')
        .select(`
          *,
          content_library(title, storage_path),
          social_accounts(account_name, username, platform)
        `)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;
      setScheduledPosts(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar agenda: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, []);

  const days = [
    startOfDay(new Date()),
    startOfDay(addDays(new Date(), 1)),
    startOfDay(addDays(new Date(), 2)),
    startOfDay(addDays(new Date(), 3)),
    startOfDay(addDays(new Date(), 4)),
  ];

   const postsForSelectedDate = scheduledPosts.filter(post => 
    post.scheduled_for && isSameDay(new Date(post.scheduled_for), selectedDate)
  );

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white font-space mb-2">Agenda</h1>
            <p className="text-slate-400">Gerencie suas publicações agendadas para os próximos dias.</p>
          </div>
          <Link to="/campanha">
            <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] h-11 px-6 shadow-lg shadow-purple-500/20">
              <Plus className="w-4 h-4 mr-2" /> Agendar Post
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const postCount = scheduledPosts.filter(p => p.scheduled_for && isSameDay(new Date(p.scheduled_for), day)).length;
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex-shrink-0 w-32 p-4 rounded-2xl border transition-all text-center space-y-1 ${
                  isSelected 
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white shadow-lg shadow-purple-500/20" 
                    : "bg-[#13131F] border-white/5 text-slate-400 hover:border-white/10"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className="text-2xl font-bold font-space">
                  {format(day, "dd")}
                </p>
                {postCount > 0 && (
                  <Badge className={`mt-2 ${isSelected ? "bg-white/20 text-white" : "bg-[#7C3AED]/20 text-[#7C3AED]"}`}>
                    {postCount} {postCount === 1 ? 'Post' : 'Posts'}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between">
             <h3 className="text-lg font-bold text-white flex items-center gap-2 font-space">
                <Calendar className="w-5 h-5 text-[#7C3AED]" /> 
                {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
             </h3>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : postsForSelectedDate.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5 text-center">
               <Calendar className="w-12 h-12 text-slate-800 mb-4" />
               <p className="text-slate-500 font-medium">Nenhum post agendado para esta data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postsForSelectedDate.map((post) => (
                <Card key={post.id} className="bg-[#13131F] border-white/5 hover:border-white/10 transition-colors">
                  <CardContent className="p-6 flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/5 rounded-xl flex flex-col items-center justify-center text-slate-500 flex-shrink-0">
                       <Clock size={20} className="mb-1 text-slate-400" />
                       <span className="text-[10px] font-bold">{format(new Date(post.scheduled_for!), "HH:mm")}</span>
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                         <Badge variant="outline" className="border-white/5 text-[10px] text-slate-500 uppercase font-bold tracking-widest">{post.platform}</Badge>
                         <span className="text-xs text-slate-500 font-medium">{post.social_accounts?.account_name}</span>
                      </div>
                      <h4 className="text-white font-medium line-clamp-1">{post.caption || "Sem legenda"}</h4>
                      <p className="text-[10px] text-slate-600 truncate">{post.content_library?.title}</p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                       <Button variant="ghost" size="sm" className="text-slate-500 hover:text-white">Editar</Button>
                       <Link to="/publicacoes">
                         <Button variant="outline" size="icon" className="h-8 w-8 border-white/10 text-slate-500 hover:text-white">
                            <ArrowRight size={14} />
                         </Button>
                       </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
