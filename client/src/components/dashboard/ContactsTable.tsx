import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { type Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface ContactsTableProps {
  contacts: Contact[];
  onConvert: (id: string) => void;
}

export function ContactsTable({ contacts, onConvert }: ContactsTableProps) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/90 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-slate-900">
            <TableHead>Prénom</TableHead>
            <TableHead>Numéro</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Problème</TableHead>
            <TableHead>Secteur</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id} className="border-slate-800">
              <TableCell>{contact.firstName || '-'}</TableCell>
              <TableCell>{contact.phone}</TableCell>
              <TableCell>{contact.email || '-'}</TableCell>
              <TableCell><Badge variant="outline">{contact.status}</Badge></TableCell>
              <TableCell>{contact.source}</TableCell>
              <TableCell className="max-w-[220px] truncate">{contact.problem || '-'}</TableCell>
              <TableCell>{contact.sector || '-'}</TableCell>
              <TableCell>{contact.plan || '-'}</TableCell>
              <TableCell>{contact.lastActionDate ? new Date(contact.lastActionDate).toLocaleString('fr-FR') : '-'}</TableCell>
              <TableCell>
                <Button size="sm" onClick={() => onConvert(contact.id)}>Converti</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
