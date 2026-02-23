import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import { useStats, useContacts } from "@/hooks/use-dashboard";
import { Users, Send, Percent, RefreshCw, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats, isError: isStatsError } = useStats();
  const { data: contacts, isLoading: isLoadingContacts } = useContacts();

  const formatSyncDate = (dateString?: string) => {
    if (!dateString) return "Aucune synchronisation";
    try {
      return format(parseISO(dateString), "dd MMM à HH:mm", { locale: fr });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12">
      <Header status={stats?.botStatus} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {isStatsError && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur de connexion</AlertTitle>
            <AlertDescription>
              Impossible de récupérer les statistiques en temps réel. Le serveur est peut-être inactif.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Vue d'ensemble
          </h1>
          <p className="text-slate-500 font-medium">
            Gérez vos leads et surveillez l'activité de votre bot WhatsApp.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            title="Total Contacts"
            value={stats?.totalContacts ?? 0}
            icon={<Users className="w-6 h-6" />}
            isLoading={isLoadingStats}
            trend={{ value: 12, isPositive: true }}
            description="Leads synchronisés dans le système"
          />
          <StatCard
            title="Messages Envoyés"
            value={stats?.messagesSentToday ?? 0}
            icon={<Send className="w-6 h-6" />}
            isLoading={isLoadingStats}
            description="Aujourd'hui, interactions proactives"
          />
          <StatCard
            title="Taux de Conversion"
            value={`${stats?.conversionRate ?? 0}%`}
            icon={<Percent className="w-6 h-6" />}
            isLoading={isLoadingStats}
            trend={{ value: 2.4, isPositive: true }}
            description="Leads ayant répondu positivement"
          />
          <StatCard
            title="Dernière Sync Bitrix24"
            value={isLoadingStats ? "" : formatSyncDate(stats?.lastSync).split(" à ")[0]}
            icon={<RefreshCw className="w-6 h-6" />}
            isLoading={isLoadingStats}
            description={isLoadingStats ? "" : `à ${formatSyncDate(stats?.lastSync).split(" à ")[1] || ""}`}
          />
        </div>

        {/* Data Table Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              Contacts Récents
            </h2>
            <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1.5 rounded-md border shadow-sm">
              Mise à jour en temps réel
            </div>
          </div>
          
          <ContactsTable contacts={contacts || []} isLoading={isLoadingContacts} />
        </div>

      </main>
    </div>
  );
}
