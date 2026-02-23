import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { storage } from './storage';
import { updateBitrixLead } from './bitrix';

let sock: ReturnType<typeof makeWASocket>;

export async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }) as any
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('Scannez ce QR code avec WhatsApp :');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      await storage.updateStats({ botStatus: "disconnected" });
      if (shouldReconnect) {
        startWhatsAppBot();
      }
    } else if (connection === 'open') {
      await storage.updateStats({ botStatus: "connected" });
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
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

      let contact = await storage.getContactByPhone(phone);
      
      if (!contact) {
        // C'est un nouveau contact qui nous écrit sur WhatsApp
        contact = await storage.createContact({
          id: `wa_${Date.now()}`,
          phone,
          source: "WhatsApp",
          status: "nouveau",
          lastActionDate: new Date().toISOString()
        });
        
        await sock.sendMessage(remoteJid, { text: "Bonjour 👋 Je suis l'assistant EricDigi. Nous aidons les business en Afrique à ne plus perdre de clients. Tapez 1 pour nos services, tapez 2 pour un rendez-vous, tapez 3 pour parler à Eric directement." });
      } else {
        contact = await storage.updateContact(contact.id, { 
          status: "répondu", 
          lastActionDate: new Date().toISOString() 
        });
        await updateBitrixLead(contact);

        const lowerText = text.trim().toLowerCase();
        if (lowerText === "1") {
          await sock.sendMessage(remoteJid, { text: "🚀 Setup Système Client en 5 jours : CRM complet + Relances automatiques + Chatbot intelligent. À partir de 800€. Tapez 2 pour réserver." });
        } else if (lowerText === "2") {
          await sock.sendMessage(remoteJid, { text: "📅 Parfait, voici le lien pour réserver votre rendez-vous : https://cal.com/ericdigi" });
        } else if (lowerText === "3") {
          await sock.sendMessage(remoteJid, { text: "👨‍💻 Je transfère votre demande à Eric. Il vous répondra très vite !" });
        } else if (lowerText === "oui") {
          await sock.sendMessage(remoteJid, { text: "Génial ! Voici plus d'informations sur notre système client..." });
        }
      }
    }
  });
}

export async function sendMessageToContact(phone: string, message: string) {
  if (sock) {
    try {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
      const stats = await storage.getStats();
      await storage.updateStats({ messagesSentToday: stats.messagesSentToday + 1 });
    } catch (e) {
      console.error(`Erreur lors de l'envoi au ${phone}:`, e);
    }
  }
}