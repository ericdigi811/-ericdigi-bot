const express = require('express');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const pino = require('pino');
const QRCode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const OWNER_NUMBER = '22664063965';
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

let sock;
let qrDataUrl = null;
let connectionState = 'Déconnecté';
let lastHubspotSync = null;
let messagesSent = 0;

const BUSINESS_KEYWORDS = [
  'système', 'crm', 'automatisation', 'chatbot', 'setup', 'relance', 'suivi client', 'pipeline', 'leads',
  'prospection', 'perdre des clients', 'gagner des clients', 'plus de clients', 'clients qui ne répondent plus',
  'prospects oubliés', 'ventes qui stagnent', 'manque de suivi', 'organiser mes clients', 'gérer mes clients',
  'prix', 'tarif', 'offre', 'plan', 'combien', 'intéressé', 'comment ça marche', 'votre service', 'que faites-vous',
  'comment vous travaillez', 'je veux', "j'ai besoin", 'aidez-moi', 'business', 'entreprise', 'activité', 'vente',
  'commercial', 'service', 'digital'
];

function nowIso() {
  return new Date().toISOString();
}

function normalize(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function readContacts() {
  if (!fs.existsSync(CONTACTS_FILE)) {
    fs.writeFileSync(CONTACTS_FILE, '[]');
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeContacts(contacts) {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
}

function inferFirstName(pushName, number) {
  if (pushName && pushName.trim().length > 0) {
    return pushName.split(' ')[0];
  }
  return `Prospect-${number.slice(-4)}`;
}

function getOrCreateContact(number, pushName = '') {
  const contacts = readContacts();
  let c = contacts.find((x) => x.numero === number);
  if (!c) {
    c = {
      prenom: inferFirstName(pushName, number),
      numero: number,
      email: '',
      statut: 'nouveau',
      source: 'whatsapp',
      probleme_exprime: '',
      secteur: '',
      plan_choisi: '',
      historique_conversation: [],
      date_premier_contact: nowIso(),
      derniere_action: nowIso(),
      hubspot_id: null,
      conversation_step: 0
    };
    contacts.push(c);
    writeContacts(contacts);
  }
  return c;
}

function saveContact(updated) {
  const contacts = readContacts();
  const idx = contacts.findIndex((x) => x.numero === updated.numero);
  if (idx >= 0) contacts[idx] = updated;
  else contacts.push(updated);
  writeContacts(contacts);
}

async function sendMessage(number, text) {
  if (!sock) return;
  await sock.sendMessage(`${number}@s.whatsapp.net`, { text });
  messagesSent += 1;
}

function containsBusinessKeyword(text) {
  const n = normalize(text);
  return BUSINESS_KEYWORDS.some((k) => n.includes(normalize(k)));
}

function recommendPlan(problem = '') {
  const p = normalize(problem);
  if (p.includes('beaucoup') || p.includes('chaos') || p.includes('plusieurs') || p.includes('agence')) return 'Premium';
  if (p.includes('automatisation') || p.includes('suivi') || p.includes('chatbot')) return 'Pro';
  return 'Starter';
}

async function hubspotRequest(method, url, data) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) return null;
  try {
    const res = await axios({
      method,
      url: `https://api.hubapi.com${url}`,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      data
    });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function upsertHubspotContact(contact) {
  const properties = {
    firstname: contact.prenom || '',
    phone: `+${contact.numero}`,
    email: contact.email || '',
    lifecyclestage: 'lead',
    ericdigi_statut: contact.statut,
    ericdigi_source: contact.source,
    ericdigi_probleme_exprime: contact.probleme_exprime,
    ericdigi_secteur: contact.secteur,
    ericdigi_plan_choisi: contact.plan_choisi,
    ericdigi_derniere_action: contact.derniere_action
  };

  if (contact.hubspot_id) {
    await hubspotRequest('patch', `/crm/v3/objects/contacts/${contact.hubspot_id}`, { properties });
    return contact.hubspot_id;
  }

  const created = await hubspotRequest('post', '/crm/v3/objects/contacts', { properties });
  if (created && created.id) {
    contact.hubspot_id = created.id;
    saveContact(contact);
    return created.id;
  }
  return null;
}

async function fetchHubspotLeadsByStatus(status) {
  const data = await hubspotRequest('post', '/crm/v3/objects/contacts/search', {
    filterGroups: [{ filters: [{ propertyName: 'ericdigi_statut', operator: 'EQ', value: status }] }],
    properties: ['firstname', 'phone', 'email', 'ericdigi_statut', 'ericdigi_source', 'ericdigi_probleme_exprime', 'ericdigi_secteur', 'ericdigi_plan_choisi'],
    limit: 100
  });
  return data?.results || [];
}

async function markHotAndNotify(contact) {
  contact.statut = 'chaud';
  contact.derniere_action = nowIso();
  saveContact(contact);
  await upsertHubspotContact(contact);
  const msg = `🔥 LEAD CHAUD — Prénom : ${contact.prenom} — Numéro : +${contact.numero} — Problème : ${contact.probleme_exprime || 'non précisé'} — Secteur : ${contact.secteur || 'non précisé'} — Plan : ${contact.plan_choisi || 'à confirmer'} — Prendre le relais maintenant !`;
  await sendMessage(OWNER_NUMBER, msg);
}

function pushHistory(contact, role, text) {
  contact.historique_conversation.push({ role, text, at: nowIso() });
  contact.derniere_action = nowIso();
}

async function handleConversation(contact, text) {
  const lower = normalize(text);

  if (contact.conversation_step === 0) {
    if (!containsBusinessKeyword(text)) return;
    contact.conversation_step = 1;
    pushHistory(contact, 'user', text);
    await sendMessage(contact.numero, `Bonjour ${contact.prenom} 👋 Je suis l'assistant d'Eric Digi. Je vois que vous cherchez des solutions pour votre business. Quel est votre plus grand défi en ce moment avec vos clients ?`);
    pushHistory(contact, 'bot', 'Accueil étape 1');
    saveContact(contact);
    return;
  }

  pushHistory(contact, 'user', text);

  if (contact.conversation_step === 1) {
    contact.probleme_exprime = text;
    contact.conversation_step = 2;
    await sendMessage(contact.numero, `Je comprends parfaitement. ${text}. C'est exactement la situation que vivent beaucoup d'entrepreneurs en Afrique francophone et c'est précisément ce qu'on règle.`);
    await sendMessage(contact.numero, `Ce qu'on fait chez EricDigi c'est transformer ce chaos en système organisé. En 5 jours on installe un CRM complet, des relances automatiques qui travaillent pendant que vous dormez, et un chatbot intelligent. Nos clients ne perdent plus aucun prospect et gagnent en moyenne 40% de clients supplémentaires dès le premier mois sans toucher à la technique.`);
    const plan = recommendPlan(text);
    contact.plan_choisi = plan;
    await sendMessage(contact.numero, `Bonne nouvelle — vous payez une seule fois et le système est à vous pour toujours. Pas d'abonnement forcé. On a trois formules : Le Plan Starter à 15 000 FCFA soit 25 dollars — installation complète à vie avec CRM simple, relances automatiques WhatsApp et email, tableau de bord de suivi, support WhatsApp. Le Plan Pro à 25 000 FCFA soit 40 dollars — tout le Starter plus chatbot WhatsApp intelligent, rapports hebdomadaires, 2 révisions incluses. Le Plan Premium à 40 000 FCFA soit 65 dollars — la solution complète avec intégration réseaux sociaux, agent IA personnalisé, support prioritaire 7 jours sur 7, révisions illimitées. Et si vous voulez qu'on s'occupe de la maintenance pour vous c'est optionnel à partir de 5 000 FCFA par mois seulement. Selon votre situation je recommande le Plan ${plan}. Qu'en pensez-vous ?`);
    contact.conversation_step = 3;
  } else if (contact.conversation_step === 3) {
    if (lower.includes('oui') || lower.includes('ok') || lower.includes('daccord') || lower.includes('ça me va') || lower.includes('interesse')) {
      contact.conversation_step = 4;
      await sendMessage(contact.numero, `Dans quel secteur travaillez-vous exactement ?`);
    } else {
      contact.conversation_step = 5;
      await sendMessage(contact.numero, `Je vous comprends tout à fait. Combien de clients estimez-vous perdre chaque mois par manque de suivi ? Même 2 ou 3 clients perdus par mois représentent souvent bien plus que notre investissement unique. La plupart de nos clients récupèrent leur investissement dès la première semaine grâce aux ventes récupérées. Eric peut vous offrir une session découverte totalement gratuite de 15 minutes pour voir exactement ce qu'on peut faire pour VOTRE business. Ça vous tente ?`);
    }
  } else if (contact.conversation_step === 5) {
    if (lower.includes('oui') || lower.includes('ok') || lower.includes('tente') || lower.includes('interesse')) {
      contact.conversation_step = 4;
      await sendMessage(contact.numero, `Parfait 🙌 Dans quel secteur travaillez-vous exactement ?`);
    }
  } else if (contact.conversation_step === 4) {
    contact.secteur = text;
    await markHotAndNotify(contact);
    await sendMessage(contact.numero, `Merci ${contact.prenom} 🙏 Eric prend le relais personnellement maintenant pour vous proposer la meilleure mise en place.`);
    contact.conversation_step = 6;
  } else {
    if (contact.probleme_exprime) {
      await sendMessage(contact.numero, `Bonjour ${contact.prenom}, on avait parlé de ${contact.probleme_exprime}. Est-ce que la situation a évolué depuis ?`);
    }
  }

  saveContact(contact);
  await upsertHubspotContact(contact);
}

async function bootstrapWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info_baileys'));
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['EricDigi', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrDataUrl = await QRCode.toDataURL(qr, { width: 560, margin: 1 });
      connectionState = 'QR requis';
    }

    if (connection === 'open') {
      connectionState = 'Connecté';
      qrDataUrl = null;
    }

    if (connection === 'close') {
      connectionState = 'Déconnecté';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(bootstrapWhatsApp, 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages?.[0];
    if (!message || message.key.fromMe) return;
    const jid = message.key.remoteJid || '';
    if (!jid.endsWith('@s.whatsapp.net')) return;

    const number = jid.replace('@s.whatsapp.net', '');
    if (number === OWNER_NUMBER) return;

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    if (!text.trim()) return;

    const contact = getOrCreateContact(number, message.pushName || '');
    await handleConversation(contact, text.trim());
  });
}

cron.schedule('0 10 * * *', async () => {
  const contacts = readContacts();
  const now = Date.now();
  for (const c of contacts) {
    const last = new Date(c.derniere_action || c.date_premier_contact || nowIso()).getTime();
    const hours = (now - last) / (1000 * 60 * 60);

    if (c.statut === 'contacté' && hours > 48) {
      await sendMessage(c.numero, `Bonjour ${c.prenom}, je voulais juste prendre de vos nouvelles. Avez-vous eu le temps de réfléchir à ce dont on avait parlé ? Je reste disponible 🙏`);
      c.statut = 'relancé';
      c.derniere_action = nowIso();
      await upsertHubspotContact(c);
    } else if (c.statut === 'relancé' && hours > 24 * 7) {
      c.statut = 'froid';
      c.derniere_action = nowIso();
      await upsertHubspotContact(c);
    }
  }
  writeContacts(contacts);
});

cron.schedule('0 9 * * *', async () => {
  const leads = await fetchHubspotLeadsByStatus('nouveau');
  for (const lead of leads) {
    const props = lead.properties || {};
    const number = (props.phone || '').replace(/\D/g, '').replace(/^226/, '226');
    if (!number) continue;

    const contact = getOrCreateContact(number, props.firstname || '');
    if (contact.statut !== 'nouveau') continue;

    await sendMessage(number, `Bonjour ${contact.prenom} 👋 Je me permets de vous écrire depuis EricDigi. Nous aidons les entrepreneurs à mieux organiser leur suivi client et automatiser leurs relances. Souhaitez-vous que je vous montre comment cela peut s'appliquer à votre activité ?`);
    contact.statut = 'contacté';
    contact.source = contact.source || 'hubspot';
    contact.derniere_action = nowIso();
    if (!contact.hubspot_id) contact.hubspot_id = lead.id;
    saveContact(contact);
    await upsertHubspotContact(contact);
  }
});

cron.schedule('0 * * * *', async () => {
  const contacts = readContacts();
  for (const c of contacts) {
    await upsertHubspotContact(c);
  }
  lastHubspotSync = nowIso();
});

app.get('/ping', (_req, res) => {
  res.send('EricDigi Bot actif 🟢');
});

app.get('/api/state', async (_req, res) => {
  const contacts = readContacts();
  const chaud = contacts.filter((c) => c.statut === 'chaud').length;
  const convertis = contacts.filter((c) => c.statut === 'converti').length;
  const conversionRate = contacts.length ? `${Math.round((convertis / contacts.length) * 100)}%` : '0%';

  res.json({
    connected: connectionState === 'Connecté',
    connectionState,
    qrDataUrl,
    stats: {
      totalContacts: contacts.length,
      messagesSent,
      conversionRate,
      lastHubspotSync: lastHubspotSync || 'Jamais'
    },
    chaud,
    contacts
  });
});

app.post('/api/contacts', (req, res) => {
  const { prenom, numero, email, source } = req.body;
  if (!numero) return res.status(400).json({ error: 'numero requis' });
  const clean = String(numero).replace(/\D/g, '');
  const contact = getOrCreateContact(clean, prenom || '');
  contact.prenom = prenom || contact.prenom;
  contact.email = email || contact.email;
  contact.source = source || contact.source || 'manuel';
  saveContact(contact);
  res.json({ ok: true, contact });
});

app.post('/api/import-csv', (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv requis' });

  const lines = String(csv).trim().split(/\r?\n/);
  if (lines.length < 2) return res.json({ ok: true, imported: 0 });

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  let imported = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i].split(',').map((x) => x.trim());
    const obj = Object.fromEntries(headers.map((h, idx) => [h, row[idx] || '']));
    if (!obj.numero && !obj.phone) continue;
    const numero = String(obj.numero || obj.phone).replace(/\D/g, '');
    const contact = getOrCreateContact(numero, obj.prenom || obj.firstname || '');
    contact.prenom = obj.prenom || obj.firstname || contact.prenom;
    contact.email = obj.email || contact.email;
    contact.source = obj.source || 'csv';
    saveContact(contact);
    imported += 1;
  }

  res.json({ ok: true, imported });
});

app.post('/api/contacts/:numero/convert', async (req, res) => {
  const numero = req.params.numero.replace(/\D/g, '');
  const contacts = readContacts();
  const contact = contacts.find((c) => c.numero === numero);
  if (!contact) return res.status(404).json({ error: 'introuvable' });

  contact.statut = 'converti';
  contact.derniere_action = nowIso();
  writeContacts(contacts);
  await upsertHubspotContact(contact);
  res.json({ ok: true });
});

app.post('/dust', async (req, res) => {
  const contacts = readContacts();
  const hubspotNouveau = await fetchHubspotLeadsByStatus('nouveau');
  const question = req.body?.question || 'Question non fournie';

  res.json({
    question,
    reponse: `Données réelles actuelles: ${contacts.length} contacts locaux, ${hubspotNouveau.length} leads HubSpot au statut nouveau.`,
    contacts,
    hubspot_nouveaux: hubspotNouveau.map((x) => ({ id: x.id, properties: x.properties }))
  });
});

app.get('/', (_req, res) => {
  res.send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EricDigi Bot</title>
  <style>
    body { font-family: Arial, sans-serif; margin:0; background:#061b3a; color:#fff; }
    .center { display:flex; min-height:100vh; align-items:center; justify-content:center; text-align:center; padding:20px; }
    .card { background:#0a2a57; padding:24px; border-radius:16px; max-width:1200px; width:100%; box-shadow:0 10px 30px rgba(0,0,0,.3); }
    .stats { display:grid; grid-template-columns:repeat(4,minmax(160px,1fr)); gap:12px; margin:16px 0; }
    .stat { background:#12376f; border-radius:12px; padding:12px; }
    .status { color:#59ff96; font-weight:bold; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th,td { border-bottom:1px solid #27508e; padding:8px; text-align:left; }
    input,select,button,textarea { border-radius:8px; border:none; padding:10px; margin:4px; }
    button { background:#2d73ff; color:#fff; cursor:pointer; }
    img { max-width:380px; width:100%; height:auto; background:#fff; padding:10px; border-radius:12px; }
  </style>
</head>
<body>
  <div id="app" class="center"></div>
<script>
async function load() {
  const r = await fetch('/api/state');
  const s = await r.json();
  const el = document.getElementById('app');

  if (!s.connected && s.qrDataUrl) {
    el.innerHTML = \`<div class="card"><h1>EricDigi WhatsApp Bot</h1><p>Scannez ce QR code avec le numéro WhatsApp +22664063965 depuis WhatsApp → Appareils liés → Lier un appareil.</p><img src="${s.qrDataUrl}" /><p>Statut: ${s.connectionState}</p></div>\`;
    return;
  }

  const rows = s.contacts.map(c => \`<tr>
      <td>${c.prenom||''}</td><td>+${c.numero||''}</td><td>${c.email||''}</td><td>${c.statut||''}</td>
      <td>${c.source||''}</td><td>${c.probleme_exprime||''}</td><td>${c.secteur||''}</td><td>${c.plan_choisi||''}</td>
      <td>${(c.date_premier_contact||'').slice(0,10)}</td>
      <td><button onclick="convertir('${c.numero}')">Converti</button></td>
    </tr>\`).join('');

  el.className = '';
  el.innerHTML = \`<div class="card">
    <h1>EricDigi — Tableau de bord</h1>
    <p>Statut WhatsApp: <span class="status">${s.connectionState}</span></p>
    <div class="stats">
      <div class="stat"><strong>Total contacts</strong><div>${s.stats.totalContacts}</div></div>
      <div class="stat"><strong>Messages envoyés</strong><div>${s.stats.messagesSent}</div></div>
      <div class="stat"><strong>Taux conversion</strong><div>${s.stats.conversionRate}</div></div>
      <div class="stat"><strong>Dernière sync HubSpot</strong><div>${s.stats.lastHubspotSync}</div></div>
    </div>

    <h3>Ajouter un contact</h3>
    <input id="prenom" placeholder="Prénom" /><input id="numero" placeholder="Numéro" />
    <input id="email" placeholder="Email" /><input id="source" placeholder="Source" />
    <button onclick="ajouter()">Ajouter</button>

    <h3>Import CSV</h3>
    <textarea id="csv" rows="3" style="width:100%" placeholder="prenom,numero,email,source"></textarea>
    <button onclick="importer()">Importer CSV</button>

    <h3>Contacts réels</h3>
    <table><thead><tr><th>Prénom</th><th>Numéro</th><th>Email</th><th>Statut</th><th>Source</th><th>Problème</th><th>Secteur</th><th>Plan</th><th>Date</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
  </div>\`;
}

async function ajouter(){
  await fetch('/api/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prenom:prenom.value,numero:numero.value,email:email.value,source:source.value})});
  load();
}
async function importer(){
  await fetch('/api/import-csv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv:csv.value})});
  load();
}
async function convertir(numero){
  await fetch('/api/contacts/'+numero+'/convert',{method:'POST'});
  load();
}

load();
setInterval(load, 30000);
</script>
</body>
</html>`);
});

bootstrapWhatsApp().catch(() => {
  connectionState = 'Erreur WhatsApp';
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EricDigi Bot actif 🟢 sur le port ${PORT}`);
});
