import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { storage } from './storage';
import { logHubspotWhatsAppMessage, updateBitrixLead } from './bitrix';

let sock: ReturnType<typeof makeWASocket>;
let latestQr = '';

const ERIC_PHONE = '22665399292';
const HOT_TRIGGER = ['oui', 'ok', 'd\'accord', 'ça me va', 'interessé', 'intéressé', 'go'];
const HESITATION_TRIGGER = ['cher', 'hésite', 'hesite', 'plus tard', 'réfléchir', 'reflechir', 'pas sûr', 'pas sur'];
const KEYWORDS = [
  'système', 'crm', 'automatisation', 'chatbot', 'setup', 'relance', 'suivi client', 'pipeline', 'leads', 'prospection',
  'perdre des clients', 'gagner des clients', 'plus de clients', 'clients qui ne répondent plus', 'prospects oubliés',
  'ventes qui stagnent', 'manque de suivi', 'organiser mes clients', 'gérer mes clients', 'prix', 'tarif', 'offre', 'plan',
  'combien', 'intéressé', 'comment ça marche', 'votre service', 'que faites-vous', 'comment vous travaillez', 'je veux',
  "j'ai besoin", 'aidez-moi', 'business', 'entreprise', 'activité', 'vente', 'commercial', 'service', 'digital'
];

function includesKeyword(text: string) {
  const normalized = text.toLowerCase();
  return KEYWORDS.some((k) => normalized.includes(k));
}

function extractMessageText(msg: any) {
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || msg.message?.videoMessage?.caption
    || '';
}

function getRecommendedPlan(problem: string) {
  const p = problem.toLowerCase();
  if (p.includes('chaos') || p.includes('stagne') || p.includes('pipeline')) return 'Premium';
  if (p.includes('automatisation') || p.includes('suivi') || p.includes('relance')) return 'Pro';
  return 'Starter';
}

async function updateContactAndHubspot(contactId: string, updates: any) {
  const updated = await storage.updateContact(contactId, updates);
  await updateBitrixLead(updated);
  return updated;
}

function appendHistory(contact: any, line: string) {
  const history = contact.historique_conversation || [];
  return [...history, line].slice(-50);
}

export function getLatestQrCode() {
  return latestQr;
}

export async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }) as any,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = qr;
      console.log('Scannez ce QR code avec WhatsApp :');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      await storage.updateStats({ botStatus: 'disconnected' });
      if (shouldReconnect) startWhatsAppBot();
    } else if (connection === 'open') {
      await storage.updateStats({ botStatus: 'connected' });
      console.log('Bot WhatsApp connecté avec succès !');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const remoteJid = msg.key.remoteJid!;
      const phone = remoteJid.split('@')[0];
      const text = extractMessageText(msg).trim();
      if (!text) continue;

      await logHubspotWhatsAppMessage(phone, text, 'incoming');

      let contact = await storage.getContactByPhone(phone);
      const firstName = contact?.firstName || (msg.pushName?.split(' ')[0] ?? '');

      if (!contact) {
        if (!includesKeyword(text)) continue;
        contact = await storage.createContact({
          id: `wa_${Date.now()}`,
          firstName,
          phone,
          source: 'WhatsApp',
          status: 'contacté',
          lastActionDate: new Date().toISOString(),
          historique_conversation: [`Prospect: ${text}`],
          conversationStep: 1,
        });

        await sock.sendMessage(remoteJid, {
          text: `Bonjour ${firstName || ''} 👋 Je suis l'assistant d'Eric Digi. Je vois que vous cherchez des solutions pour votre business. Quel est votre plus grand défi en ce moment avec vos clients ?`,
        });
        continue;
      }

      if ((contact.conversationStep || 0) === 0 && !includesKeyword(text)) continue;

      if (contact.lastActionDate) {
        const elapsed = Date.now() - new Date(contact.lastActionDate).getTime();
        if (elapsed > 1000 * 60 * 60 * 24 * 2 && contact.problem) {
          const revisit = `Bonjour ${firstName || ''}, on avait parlé de ${contact.problem}. Est-ce que la situation a évolué depuis ?`;
          await sock.sendMessage(remoteJid, { text: revisit });
          await updateContactAndHubspot(contact.id, {
            lastActionDate: new Date().toISOString(),
            historique_conversation: appendHistory(contact, `Bot: ${revisit}`),
          });
          continue;
        }
      }

      const problem = contact.problem || text;
      const recommendedPlan = getRecommendedPlan(problem);
      const history = appendHistory(contact, `Prospect: ${text}`);
      const lowerText = text.toLowerCase();

      if ((contact.conversationStep || 1) === 1) {
        const response = `Je comprends parfaitement. ${problem}. C'est exactement la situation que vivent beaucoup d'entrepreneurs en Afrique francophone et c'est précisément ce qu'on règle.`;
        await sock.sendMessage(remoteJid, { text: response });
        await updateContactAndHubspot(contact.id, {
          status: 'contacté',
          problem,
          conversationStep: 2,
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Bot: ${response}`],
        });
        continue;
      }

      if (contact.conversationStep === 2) {
        const response = "Ce qu'on fait chez EricDigi c'est transformer ce chaos en système organisé. En 5 jours on installe un CRM complet, des relances automatiques qui travaillent pendant que vous dormez, et un chatbot intelligent. Nos clients ne perdent plus aucun prospect et gagnent en moyenne 40% de clients supplémentaires dès le premier mois sans toucher à la technique.";
        await sock.sendMessage(remoteJid, { text: response });
        await updateContactAndHubspot(contact.id, {
          conversationStep: 3,
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Bot: ${response}`],
        });
        continue;
      }

      if (contact.conversationStep === 3) {
        const response = `Bonne nouvelle — vous payez une seule fois et le système est à vous pour toujours. Pas d'abonnement forcé. On a trois formules : Le Plan Starter à 15 000 FCFA soit 25 dollars — installation complète à vie avec CRM simple, relances automatiques WhatsApp et email, tableau de bord de suivi, support WhatsApp. Le Plan Pro à 25 000 FCFA soit 40 dollars — tout le Starter plus chatbot WhatsApp intelligent, rapports hebdomadaires, 2 révisions incluses. Le Plan Premium à 40 000 FCFA soit 65 dollars — la solution complète avec intégration réseaux sociaux, agent IA personnalisé, support prioritaire 7 jours sur 7, révisions illimitées. Et si vous voulez qu'on s'occupe de la maintenance pour vous c'est optionnel à partir de 5 000 FCFA par mois seulement. Selon votre situation je recommande le Plan ${recommendedPlan}. Qu'en pensez-vous ?`;
        await sock.sendMessage(remoteJid, { text: response });
        await updateContactAndHubspot(contact.id, {
          conversationStep: 4,
          plan: recommendedPlan,
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Bot: ${response}`],
        });
        continue;
      }

      if (contact.conversationStep === 4 && HESITATION_TRIGGER.some((t) => lowerText.includes(t))) {
        const price = recommendedPlan === 'Premium' ? '40 000 FCFA' : recommendedPlan === 'Pro' ? '25 000 FCFA' : '15 000 FCFA';
        const response = `Je vous comprends tout à fait. Combien de clients estimez-vous perdre chaque mois par manque de suivi ? Même 2 ou 3 clients perdus par mois représentent souvent bien plus que notre investissement unique de ${price}. La plupart de nos clients récupèrent leur investissement dès la première semaine grâce aux ventes récupérées. Et pour que vous puissiez juger sur pièce Eric peut vous offrir une session découverte totalement gratuite de 15 minutes pour voir exactement ce qu'on peut faire pour VOTRE business spécifiquement. Ça vous tente ?`;
        await sock.sendMessage(remoteJid, { text: response });
        await updateContactAndHubspot(contact.id, {
          conversationStep: 5,
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Bot: ${response}`],
        });
        continue;
      }

      if ([4, 5].includes(contact.conversationStep || 0) && HOT_TRIGGER.some((t) => lowerText.includes(t))) {
        const response = "Parfait 🎉 Eric va vous contacter personnellement très prochainement pour la suite. Juste pour qu'il soit bien préparé — dans quel secteur travaillez-vous exactement ?";
        await sock.sendMessage(remoteJid, { text: response });
        await updateContactAndHubspot(contact.id, {
          conversationStep: 6,
          status: 'chaud',
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Bot: ${response}`],
        });
        continue;
      }

      if ((contact.conversationStep || 0) >= 6) {
        const sector = text;
        const updated = await updateContactAndHubspot(contact.id, {
          sector,
          status: 'chaud',
          lastActionDate: new Date().toISOString(),
          historique_conversation: [...history, `Secteur: ${sector}`],
        });

        await sock.sendMessage(`${ERIC_PHONE}@s.whatsapp.net`, {
          text: `🔥 LEAD CHAUD — Prénom : ${updated.firstName || '-'} — Numéro : ${updated.phone} — Problème exprimé : ${updated.problem || '-'} — Secteur : ${updated.sector || '-'} — Plan intéressé : ${updated.plan || '-'} — Prendre le relais maintenant !`,
        });
        await sock.sendMessage(remoteJid, { text: 'Merci 🙏 Eric a bien reçu vos informations et vous contactera rapidement.' });
        continue;
      }

      const fallback = "Je suis là pour comprendre votre situation et vous aider. Pouvez-vous me dire votre principal défi client actuellement ?";
      await sock.sendMessage(remoteJid, { text: fallback });
      await updateContactAndHubspot(contact.id, {
        lastActionDate: new Date().toISOString(),
        historique_conversation: [...history, `Bot: ${fallback}`],
      });
    }
  });
}

export async function sendMessageToContact(phone: string, message: string) {
  if (sock) {
    try {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
      await logHubspotWhatsAppMessage(phone, message, 'outgoing');
      const stats = await storage.getStats();
      await storage.updateStats({ messagesSentToday: stats.messagesSentToday + 1 });
    } catch (e) {
      console.error(`Erreur lors de l'envoi au ${phone}:`, e);
    }
  }
}
