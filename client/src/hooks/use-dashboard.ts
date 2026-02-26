import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Stats, type Contact, statsSchema, contactSchema } from "@shared/schema";
import { z } from "zod";

export function useStats() {
  return useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return statsSchema.parse(await res.json());
    },
    refetchInterval: 30000,
  });
}

export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return z.array(contactSchema).parse(await res.json());
    },
    refetchInterval: 30000,
  });
}

export function useWhatsappQr() {
  return useQuery<{ qr: string }>({
    queryKey: ["/api/whatsapp/qr"],
    queryFn: async () => {
      const res = await fetch('/api/whatsapp/qr');
      if (!res.ok) throw new Error('Failed qr');
      return res.json();
    },
    refetchInterval: 5000,
  });
}

export function useStartWhatsappConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      if (!res.ok) throw new Error('Impossible de lancer la connexion WhatsApp');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/whatsapp/qr'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
    }
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/contacts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Status update failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/contacts'] });
      qc.invalidateQueries({ queryKey: ['/api/stats'] });
    }
  });
}
