import { z } from "zod";

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string(),
  email: z.string().optional(),
  source: z.string(),
  status: z.string(),
  lastActionDate: z.string().optional(),
  problem: z.string().optional(),
  sector: z.string().optional(),
  plan: z.string().optional(),
  historique_conversation: z.array(z.string()).optional(),
  conversationStep: z.number().optional(),
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
