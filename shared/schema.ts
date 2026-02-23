import { z } from "zod";

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string(),
  source: z.string(), // "Facebook", "Instagram", "WhatsApp", "Web", etc.
  status: z.string(), // "nouveau", "contacté", "relancé", "répondu", etc.
  lastActionDate: z.string().optional(),
});

export type Contact = z.infer<typeof contactSchema>;

export const statsSchema = z.object({
  botStatus: z.enum(["connected", "disconnected", "connecting"]),
  totalContacts: z.number(),
  messagesSentToday: z.number(),
  conversionRate: z.number(),
  lastSync: z.string().optional(),
});

export type Stats = z.infer<typeof statsSchema>;

export const dustRequestSchema = z.object({
  query: z.string(),
  action: z.string().optional(),
  parameters: z.record(z.any()).optional()
});
