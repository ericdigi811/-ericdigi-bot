import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type Contact } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, Phone, User as UserIcon, Calendar, Clock, Inbox, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ContactsTableProps {
  contacts: Contact[];
  isLoading: boolean;
}

export function ContactsTable({ contacts, isLoading }: ContactsTableProps) {
  
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("nouveau")) return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 shadow-sm"><Inbox className="w-3 h-3 mr-1"/> Nouveau</Badge>;
    if (s.includes("contacté")) return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200"><MessageSquare className="w-3 h-3 mr-1"/> Contacté</Badge>;
    if (s.includes("relancé")) return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700"><Clock className="w-3 h-3 mr-1"/> Relancé</Badge>;
    if (s.includes("répondu")) return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1"/> Répondu</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const getSourceIcon = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes("whatsapp")) return <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-medium border border-emerald-100"><MessageSquare className="w-3 h-3 mr-1"/> WhatsApp</span>;
    if (s.includes("facebook") || s.includes("instagram")) return <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-xs font-medium border border-blue-100"><UserIcon className="w-3 h-3 mr-1"/> {source}</span>;
    return <span className="flex items-center text-slate-600 bg-slate-50 px-2 py-1 rounded-md text-xs font-medium border border-slate-200">{source}</span>;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Jamais";
    try {
      return format(parseISO(dateString), "dd MMM yyyy à HH:mm", { locale: fr });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernière action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-36" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 border-dashed bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
          <UserIcon className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Aucun contact trouvé</h3>
        <p className="text-slate-500 mt-1 max-w-sm">
          Les nouveaux leads apparaîtront ici dès que le bot commencera à interagir.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow className="hover:bg-transparent border-slate-200/80">
            <TableHead className="font-semibold text-slate-700 py-4">Nom complet</TableHead>
            <TableHead className="font-semibold text-slate-700 py-4">Téléphone</TableHead>
            <TableHead className="font-semibold text-slate-700 py-4">Source</TableHead>
            <TableHead className="font-semibold text-slate-700 py-4">Statut</TableHead>
            <TableHead className="font-semibold text-slate-700 py-4 text-right pr-6">Dernière action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id} className="group hover:bg-slate-50/80 transition-colors duration-200 border-slate-100">
              <TableCell className="py-4">
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                    {contact.firstName} {contact.lastName}
                  </span>
                  <span className="text-xs text-slate-500 font-mono mt-0.5">ID: {contact.id.substring(0,8)}...</span>
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex items-center text-slate-700 font-medium">
                  <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  {contact.phone}
                </div>
              </TableCell>
              <TableCell className="py-4">
                {getSourceIcon(contact.source)}
              </TableCell>
              <TableCell className="py-4">
                {getStatusBadge(contact.status)}
              </TableCell>
              <TableCell className="py-4 text-right pr-6 text-slate-600 text-sm flex items-center justify-end">
                <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                {formatDate(contact.lastActionDate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
