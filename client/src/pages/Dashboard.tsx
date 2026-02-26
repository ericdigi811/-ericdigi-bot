import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { ContactsTable } from "@/components/dashboard/ContactsTable";
import { useContacts, useStats, useUpdateStatus, useWhatsappQr } from "@/hooks/use-dashboard";
import { Users, Send, Percent, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const FILTERS = ['tous', 'nouveau', 'contacté', 'relancé', 'chaud', 'converti', 'froid'];

export default function Dashboard() {
  const { data: stats } = useStats();
  const { data: contacts = [] } = useContacts();
  const { data: qrData } = useWhatsappQr();
  const updateStatus = useUpdateStatus();
  const [filter, setFilter] = useState('tous');
  const [form, setForm] = useState({ firstName: '', phone: '', email: '', source: 'Manuel', status: 'nouveau' });

  const filtered = useMemo(() => {
    if (filter === 'tous') return contacts;
    return contacts.filter((c) => c.status.toLowerCase() === filter);
  }, [contacts, filter]);

  const createContact = async () => {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-10">
      <Header status={stats?.botStatus} />
      <main className="max-w-7xl mx-auto px-4 pt-8 space-y-6">
        <h1 className="text-3xl font-bold text-blue-300">Tableau de bord EricDigi</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total contacts" value={stats?.totalContacts ?? 0} icon={<Users className="w-6 h-6" />} isLoading={false} description="Base réelle" />
          <StatCard title="Messages envoyés" value={stats?.messagesSentToday ?? 0} icon={<Send className="w-6 h-6" />} isLoading={false} description="Aujourd'hui" />
          <StatCard title="Taux conversion" value={`${stats?.conversionRate ?? 0}%`} icon={<Percent className="w-6 h-6" />} isLoading={false} description="Leads chauds/convertis" />
          <StatCard title="Dernière sync HubSpot" value={stats?.lastSync ? new Date(stats.lastSync).toLocaleString('fr-FR') : '-'} icon={<RefreshCw className="w-6 h-6" />} isLoading={false} description="Toutes les heures" />
        </div>

        <section className="rounded-xl border border-slate-800 p-4 bg-slate-900">
          <h2 className="font-semibold mb-3">QR code WhatsApp</h2>
          {qrData?.qr ? (
            <img alt="QR WhatsApp" src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData.qr)}`} />
          ) : (
            <p className="text-sm text-slate-400">QR indisponible pour le moment.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 p-4 bg-slate-900 space-y-3">
          <h2 className="font-semibold">Ajout manuel + Import CSV</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <input className="bg-slate-800 p-2 rounded" placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className="bg-slate-800 p-2 rounded" placeholder="Numéro" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="bg-slate-800 p-2 rounded" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <button className="bg-blue-700 rounded p-2" onClick={createContact}>Ajouter</button>
            <button className="bg-slate-700 rounded p-2" onClick={() => fetch('/api/contacts/import-csv', { method: 'POST' })}>Import CSV</button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button key={f} className={`px-3 py-1 rounded ${filter === f ? 'bg-blue-700' : 'bg-slate-800'}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <ContactsTable contacts={filtered} onConvert={(id) => updateStatus.mutate({ id, status: 'converti' })} />
        </section>
      </main>
    </div>
  );
}
