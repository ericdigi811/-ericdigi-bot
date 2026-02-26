import axios from 'axios';
import { storage } from './storage';
import { Contact } from '../shared/schema';

const HUBSPOT_API = 'https://api.hubapi.com';
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;

function headers() {
  return {
    Authorization: `Bearer ${HUBSPOT_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

function normalizePhone(phone?: string) {
  return (phone || '').replace(/\D/g, '');
}

async function findHubspotContactByPhone(phone: string) {
  if (!HUBSPOT_API_KEY || !phone) return null;

  try {
    const response = await axios.post(
      `${HUBSPOT_API}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'phone',
                operator: 'EQ',
                value: phone,
              },
            ],
          },
        ],
        properties: ['firstname', 'lastname', 'phone', 'email', 'lifecyclestage', 'sector', 'plan', 'problem', 'source'],
        limit: 1,
      },
      { headers: headers() },
    );

    return response.data.results?.[0] ?? null;
  } catch (error) {
    console.error('Erreur recherche contact HubSpot par téléphone:', error);
    return null;
  }
}

async function upsertHubspotContact(contact: Contact) {
  if (!HUBSPOT_API_KEY) return;

  const normalizedPhone = normalizePhone(contact.phone);
  if (!normalizedPhone) return;

  const properties = {
    firstname: contact.firstName || '',
    lastname: contact.lastName || '',
    phone: normalizedPhone,
    email: contact.email || '',
    lifecyclestage: contact.status,
    problem: contact.problem || '',
    sector: contact.sector || '',
    plan: contact.plan || '',
    source: contact.source,
  };

  const existing = await findHubspotContactByPhone(normalizedPhone);

  try {
    if (existing?.id) {
      await axios.patch(
        `${HUBSPOT_API}/crm/v3/objects/contacts/${existing.id}`,
        { properties },
        { headers: headers() },
      );
      return;
    }

    await axios.post(
      `${HUBSPOT_API}/crm/v3/objects/contacts`,
      { properties },
      { headers: headers() },
    );
  } catch (error) {
    console.error('Erreur upsert HubSpot contact:', error);
  }
}

export async function logHubspotWhatsAppMessage(phone: string, message: string, direction: 'incoming' | 'outgoing') {
  if (!HUBSPOT_API_KEY) return;

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  const existing = await findHubspotContactByPhone(normalizedPhone);
  if (!existing?.id) return;

  const label = direction === 'incoming' ? 'Reçu' : 'Envoyé';

  try {
    await axios.post(
      `${HUBSPOT_API}/crm/v3/objects/notes`,
      {
        properties: {
          hs_note_body: `[WhatsApp ${label}] ${message}`,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [
          {
            to: { id: existing.id },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202,
              },
            ],
          },
        ],
      },
      { headers: headers() },
    );
  } catch (error) {
    console.error('Erreur log message WhatsApp HubSpot:', error);
  }
}

export async function syncFromBitrix() {
  try {
    if (!HUBSPOT_API_KEY) {
      await storage.updateStats({ lastSync: new Date().toISOString() });
      return;
    }

    const response = await axios.get(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
      headers: headers(),
      params: {
        limit: 100,
        properties: 'firstname,lastname,phone,email,lifecyclestage,sector,plan,problem,source',
      },
    });

    const existing = await storage.getContacts();

    for (const row of response.data.results ?? []) {
      const phone = row.properties.phone;
      if (!phone) continue;
      const existingContact = existing.find((c) => normalizePhone(c.phone) === normalizePhone(phone));
      const payload: Contact = {
        id: existingContact?.id || `hub_${row.id}`,
        firstName: row.properties.firstname || undefined,
        lastName: row.properties.lastname || undefined,
        phone,
        email: row.properties.email || undefined,
        source: row.properties.source || 'HubSpot',
        status: row.properties.lifecyclestage || 'nouveau',
        sector: row.properties.sector || undefined,
        plan: row.properties.plan || undefined,
        problem: row.properties.problem || undefined,
        lastActionDate: new Date().toISOString(),
        historique_conversation: existingContact?.historique_conversation || [],
        conversationStep: existingContact?.conversationStep || 0,
      };

      if (existingContact) {
        await storage.updateContact(existingContact.id, payload);
      } else {
        await storage.createContact(payload);
      }
    }

    await storage.updateStats({ lastSync: new Date().toISOString() });
  } catch (error) {
    console.error('Erreur sync HubSpot:', error);
  }
}

export async function updateBitrixLead(contact: Contact) {
  await upsertHubspotContact(contact);
}

export async function notifyHubspotStatus(contact: Contact, status: string) {
  await upsertHubspotContact({ ...contact, status });
}

export async function getNewLeadsFromHubspot() {
  if (!HUBSPOT_API_KEY) return [];
  try {
    const response = await axios.post(
      `${HUBSPOT_API}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [{
          filters: [{ propertyName: 'lifecyclestage', operator: 'EQ', value: 'nouveau' }],
        }],
        properties: ['firstname', 'lastname', 'phone', 'email', 'sector', 'source'],
        limit: 100,
      },
      { headers: headers() },
    );
    return response.data.results ?? [];
  } catch (error) {
    console.error('Erreur récupération leads HubSpot:', error);
    return [];
  }
}
