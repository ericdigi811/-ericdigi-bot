import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import cron from "node-cron";
import { syncFromBitrix } from "./bitrix";
import { startWhatsAppBot, sendMessageToContact } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Démarrer le bot WhatsApp en tâche de fond
  startWhatsAppBot().catch(console.error);

  // CRON : Toutes les heures pour synchroniser Bitrix24
  cron.schedule('0 * * * *', async () => {
    console.log('Exécution de la synchronisation horaire Bitrix24...');
    await syncFromBitrix();
  });

  // CRON : Chaque matin à 9h pour contacter les nouveaux leads
  cron.schedule('0 9 * * *', async () => {
    console.log('Exécution des contacts 9h...');
    const contacts = await storage.getContacts();
    const newLeads = contacts.filter(c => c.status === 'nouveau' && c.source !== 'WhatsApp');
    
    for (const lead of newLeads) {
      await sendMessageToContact(lead.phone, `Bonjour ${lead.firstName || ''} 👋 Je suis Eric de EricDigi. Nous aidons les business en Afrique à ne plus perdre de clients grâce à un système complet en 5 jours. Intéressé ? Répondez OUI pour en savoir plus.`);
      await storage.updateContact(lead.id, { status: "contacté", lastActionDate: new Date().toISOString() });
    }
  });

  // CRON : Chaque jour à 10h pour les relances
  cron.schedule('0 10 * * *', async () => {
    console.log('Exécution des relances 10h...');
    const contacts = await storage.getContacts();
    const now = Date.now();
    
    for (const lead of contacts) {
      if (lead.status === 'contacté' && lead.lastActionDate) {
        const lastAction = new Date(lead.lastActionDate).getTime();
        const diffHours = (now - lastAction) / (1000 * 60 * 60);
        if (diffHours >= 48) {
          await sendMessageToContact(lead.phone, `Bonjour ${lead.firstName || ''} 🙏 Je voulais juste vérifier si vous avez des questions sur nos services EricDigi. Je suis disponible pour vous aider.`);
          await storage.updateContact(lead.id, { status: "relancé", lastActionDate: new Date().toISOString() });
        }
      }
    }
  });

  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.get(api.contacts.list.path, async (req, res) => {
    const contacts = await storage.getContacts();
    res.json(contacts);
  });

  app.post(api.contacts.create.path, async (req, res) => {
    try {
      const input = api.contacts.create.input.parse(req.body);
      const contact = await storage.createContact({
        ...input,
        id: `local_${Date.now()}`,
        lastActionDate: new Date().toISOString()
      });
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

  // Ping d'UptimeRobot
  app.get('/ping', (req, res) => {
    res.send("EricDigi Bot actif 🟢");
  });

  return httpServer;
}