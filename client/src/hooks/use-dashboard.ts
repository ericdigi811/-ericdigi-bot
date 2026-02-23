import { useQuery } from "@tanstack/react-query";
import { type Stats, type Contact, statsSchema, contactSchema } from "@shared/schema";
import { z } from "zod";

// Fetch Stats with 5-second polling
export function useStats() {
  return useQuery<Stats>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          // Fallback mock data if endpoint is missing to show UI
          return {
            botStatus: "disconnected",
            totalContacts: 0,
            messagesSentToday: 0,
            conversionRate: 0,
            lastSync: new Date().toISOString()
          } as Stats;
        }
        throw new Error("Failed to fetch stats");
      }
      const data = await res.json();
      return statsSchema.parse(data);
    },
    refetchInterval: 5000, // Poll every 5 seconds as requested
  });
}

// Fetch Contacts
export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          return []; // Empty list if endpoint missing
        }
        throw new Error("Failed to fetch contacts");
      }
      const data = await res.json();
      return z.array(contactSchema).parse(data);
    },
  });
}
