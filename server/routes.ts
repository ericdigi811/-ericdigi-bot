import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import cron from "node-cron";
import { getNewLeadsFromHubspot, notifyHubspotStatus, syncFromBitrix } from "./bitrix";
import { getLatestQrCode, requestWhatsAppQr, startWhatsAppBot, sendMessageToContact } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  startWhatsAppBot().catch(console.error);

  cron.schedule('0 * * * *', async () => {
    await syncFromBitrix();
  });

  cron.schedule('0 9 * * *', async () => {
    const leads = await getNewLeadsFromHubspot();
    for (const lead of leads) {
      const phone = lead.properties.phone;
      if (!phone) continue;
      const firstName = lead.properties.firstname || '';
      const sector = lead.properties.sector || 'votre activité';
      let contact = await storage.getContactByPhone(phone);
      if (!contact) {
        contact = await storage.createContact({
          id: `hub_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          firstName,
          lastName: lead.properties.lastname || undefined,
          email: lead.properties.email || undefined,
          phone,
          source: 'HubSpot',
          status: 'nouveau',
          sector,
          historique_conversation: [],
          conversationStep: 0,
          lastActionDate: new Date().toISOString(),
        });
      }

      await sendMessageToContact(phone, `Bonjour ${firstName} 👋 J'espère que vous allez bien. J'ai vu que vous développez ${sector}. Quel est votre principal défi en ce moment pour mieux suivre vos prospects et convertir plus de clients ?`);
      const updated = await storage.updateContact(contact.id, { status: 'contacté', lastActionDate: new Date().toISOString() });
      await notifyHubspotStatus(updated, 'contacté');
    }
  });

  cron.schedule('0 10 * * *', async () => {
    const contacts = await storage.getContacts();
    const now = Date.now();

    for (const lead of contacts) {
      if (lead.status === 'contacté' && lead.lastActionDate) {
        const diffHours = (now - new Date(lead.lastActionDate).getTime()) / (1000 * 60 * 60);
        if (diffHours >= 48) {
          await sendMessageToContact(lead.phone, `Bonjour ${lead.firstName || ''}, je voulais juste prendre de vos nouvelles. Avez-vous eu le temps de réfléchir à ce dont on avait parlé ? Je reste disponible si vous avez des questions 🙏`);
          const updated = await storage.updateContact(lead.id, { status: 'relancé', lastActionDate: new Date().toISOString() });
          await notifyHubspotStatus(updated, 'relancé');
        }
      }

      if (lead.status === 'relancé' && lead.lastActionDate) {
        const diffDays = (now - new Date(lead.lastActionDate).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays >= 7) {
          const updated = await storage.updateContact(lead.id, { status: 'froid', lastActionDate: new Date().toISOString() });
          await notifyHubspotStatus(updated, 'froid');
        }
      }
    }
  });

  app.get(api.stats.get.path, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get(api.contacts.list.path, async (_req, res) => {
    const contacts = await storage.getContacts();
    res.json(contacts);
  });

  app.post(api.contacts.create.path, async (req, res) => {
    try {
      const input = api.contacts.create.input.parse(req.body);
      const contact = await storage.createContact({
        ...input,
        id: `local_${Date.now()}`,
        lastActionDate: new Date().toISOString(),
        historique_conversation: input.historique_conversation || [],
        conversationStep: input.conversationStep || 0,
      });
      await notifyHubspotStatus(contact, contact.status);
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch('/api/contacts/:id/status', async (req, res) => {
    const schema = z.object({ status: z.string() });
    const payload = schema.parse(req.body);
    const contact = await storage.updateContact(req.params.id, { status: payload.status, lastActionDate: new Date().toISOString() });
    await notifyHubspotStatus(contact, payload.status);
    res.json(contact);
  });

  app.post('/api/contacts/import-csv', async (_req, res) => {
    res.status(501).json({ message: 'Import CSV à brancher selon votre flux source.' });
  });

  app.get('/api/whatsapp/qr', async (_req, res) => {
    res.json({ qr: getLatestQrCode() });
  });

  app.post('/api/whatsapp/connect', async (_req, res) => {
    await requestWhatsAppQr();
    res.json({ message: 'Connexion WhatsApp lancée. Scannez le QR.', qr: getLatestQrCode() });
  });

  app.post(api.dust.handle.path, async (req, res) => {
    try {
      const input = api.dust.handle.input.parse(req.body);
      const contacts = await storage.getContacts();
      const stats = await storage.getStats();

      res.json({
        message: "Réponse du système EricDigi",
        data: { contacts, stats },
        queryReceived: input.query
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get('/ping', (_req, res) => {
    res.send("EricDigi Bot actif 🟢");
  });

  return httpServer;
}
