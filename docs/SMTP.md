# Configurer un SMTP custom dans Supabase

> Le SMTP par défaut de Supabase free tier est limité à **3 emails / heure** (« email rate limit exceeded »).
> Pour de la prod, brancher un SMTP custom est **gratuit** et débloque les magic links.

---

## Option recommandée : Resend (gratuit, 3 000 mails/mois)

### 1. Créer un compte Resend

→ <https://resend.com> · Sign up · vérifier l'email.

### 2. Vérifier votre domaine d'envoi

Dans Resend → **Domains → Add Domain** → `gociviq.fr`.

Resend affiche 3 enregistrements DNS à ajouter chez votre registrar :
- `TXT` (SPF)
- `CNAME` (DKIM)
- `MX` (optionnel mais recommandé)

Une fois propagés (5-30 min), le domaine passe « Verified ».

### 3. Créer une API key

Resend → **API Keys → Create API Key** → role *Sending access* → copier la clé `re_...`.

### 4. Configurer Supabase

Dashboard Supabase → **Authentication → SMTP Settings** → activer **Enable Custom SMTP** et remplir :

| Champ | Valeur |
|---|---|
| Sender email | `noreply@gociviq.fr` (ou tout email du domaine vérifié) |
| Sender name | `GoCiviQ` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Min interval | `1` (sec) |
| Username | `resend` |
| Password | la clé API `re_...` |

Cliquer **Save**.

### 5. Tester

→ **Authentication → Templates → Magic Link → Send test email** à votre adresse.
Si l'email arrive avec un lien `https://www.gociviq.fr/auth/callback?...`, c'est gagné.

---

## Alternative : Brevo (ex-Sendinblue, 300 emails/jour gratuits)

| Champ | Valeur |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | votre email Brevo |
| Password | la SMTP key Brevo (Settings → SMTP & API) |

---

## Vérification rapide en cas de problème

1. **Domaine vérifié** ? (Resend / Brevo affichent un statut)
2. **Sender email** appartient bien au domaine vérifié (sinon les mails partent en spam ou sont rejetés)
3. **URL Configuration Supabase** → Site URL et Redirect URLs incluent `https://www.gociviq.fr/**`
4. **Vercel env var** `NEXT_PUBLIC_SITE_URL=https://www.gociviq.fr` (sans slash final)
5. **Email Templates Supabase** → corps du Magic Link contient bien `{{ .ConfirmationURL }}`

Une fois le SMTP custom actif, les rate limits Supabase free tier ne s'appliquent plus — c'est votre fournisseur SMTP qui définit la cadence (Resend = ~10/sec).
