import axios from 'axios';
import { storage } from './storage';
import { Contact } from '../shared/schema';

// Configuration Bitrix24 (URL webhook entrante générée depuis l'interface Bitrix24)
const BITRIX_API = process.env.BITRIX_WEBHOOK_URL || 'https://example.bitrix24.fr/rest/1/webhook/';

export async function syncFromBitrix() {
  try {
    // Requête réelle commentée tant qu'il n'y a pas de clé API valide
    // const response = await axios.get(`${BITRIX_API}crm.lead.list`);
    console.log("Synchronisation Bitrix24 simulée (pas de clé API)");
    
    await storage.updateStats({ lastSync: new Date().toISOString() });
  } catch (error) {
    console.error("Erreur sync Bitrix24:", error);
  }
}

export async function updateBitrixLead(contact: Contact) {
  try {
    // Requête réelle commentée
    // const response = await axios.post(`${BITRIX_API}crm.lead.update`, { 
    //   id: contact.id, 
    //   fields: { STATUS_ID: contact.status } 
    // });
    console.log(`Mise à jour Bitrix24 pour le lead ${contact.id} vers le statut ${contact.status}`);
  } catch (error) {
    console.error("Erreur update Bitrix24:", error);
  }
}