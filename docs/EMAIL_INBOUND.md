# Email → Ticket — Webhook d'ingestion

> Permet de transformer un email reçu (signalement habitant ou élu)
> en ticket dans le module `tickets`.

## Endpoint

```
POST https://www.gociviq.fr/api/tickets/email-inbound
```

## Sécurité

- Header `x-signature: <hex>` — HMAC-SHA256 du body brut, calculé avec
  la clé partagée `EMAIL_INBOUND_SECRET` (env var serveur, à définir
  dans Vercel).
- Comparaison timing-safe — un mauvais hash retourne 401.
- Sans `EMAIL_INBOUND_SECRET` configuré, l'endpoint répond 503.

Pour générer la signature côté worker / service tiers :

```js
const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
```

## Payload JSON

```json
{
  "to": "tickets+chateauneuf@gociviq.fr",
  "from": "habitant@example.fr",
  "fromName": "Marie Dupont",
  "subject": "Lampadaire HS rue de l'Église",
  "body": "Bonjour, le lampadaire est éteint depuis 3 jours.",
  "communeSlug": "chateauneuf",
  "attachments": [
    { "filename": "photo.jpg", "url": "https://…", "contentType": "image/jpeg" }
  ]
}
```

| Champ | Requis | Notes |
|---|---|---|
| `from` | ✓ | Email du demandeur, devient `demandeur_email` |
| `subject` | ✓ | Devient `titre` (tronqué à 200 caractères) |
| `body` | – | Devient `description` |
| `fromName` | – | `demandeur_nom` |
| `communeSlug` | – | Slug de la commune cible. À défaut, parsé depuis `to` (ex : `tickets+slug@…`) |
| `attachments` | – | Ignoré en V1 (à venir : upload Storage + ticket_photos) |

## Comportement

- Crée un ticket : `canal=email`, `statut=nouveau`, `priorite=normale`,
  `categorie=autre`.
- Déclenche une notification push aux agents techniques + adjoints
  travaux + admins de la commune (déclencheur `notifyUrgentUnassigned`
  réutilisé pour signaler une demande non assignée).
- Retourne `{ ticket_id, ticket_numero }`.

## Recommandation pour la mise en place

**Cloudflare Email Workers** (gratuit) :

1. Créer un domaine `tickets.gociviq.fr` (sous-domaine email-only)
2. Routes Cloudflare Email → forward vers un Worker
3. Worker JS : parser le mail, calculer la signature HMAC, POST vers
   l'endpoint ci-dessus
4. Stocker `EMAIL_INBOUND_SECRET` à la fois dans Cloudflare et Vercel

Alternatives : Postmark Inbound Streams, SendGrid Inbound Parse,
Mailgun routes — tous compatibles avec un webhook signé.

## Healthcheck

```
GET /api/tickets/email-inbound
→ { "endpoint": "...", "configured": true|false, "docs": "..." }
```
