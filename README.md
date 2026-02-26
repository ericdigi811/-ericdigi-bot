# EricDigi WhatsApp Bot

Bot WhatsApp réel basé sur **Baileys** pour EricDigi avec :
- QR code affiché automatiquement dans l'interface web
- anti-autorépondeur strict par mots-clés business
- conversation commerciale en 6 étapes
- relances automatiques
- synchronisation HubSpot
- tableau de bord français

## Déploiement Render

1. Créez un nouveau repo GitHub `ericdigi-whatsapp-bot` et poussez ce code.
2. Sur Render: **New + > Web Service**.
3. Connectez le repo.
4. Render lit automatiquement `render.yaml`.
5. Variables d'environnement à définir:
   - `HUBSPOT_API_KEY`
   - `PORT` (3000)
   - `NODE_ENV` (`production`)
6. Déployez.
7. Ouvrez l'URL Render: le QR WhatsApp apparaît automatiquement.
8. Scannez avec le numéro **+22664063965**.

## Endpoints

- `GET /` : interface QR + Dashboard
- `GET /ping` : `EricDigi Bot actif 🟢`
- `POST /dust` : réponse basée sur contacts réels + HubSpot
- `GET /api/state` : état dashboard JSON
- `POST /api/contacts` : ajout manuel contact
- `POST /api/import-csv` : import CSV
- `POST /api/contacts/:numero/convert` : statut converti

## Notes

- Session WhatsApp sauvegardée dans `auth_info_baileys` (ignoré par git).
- `contacts.json` démarre vide (aucune donnée fictive).
