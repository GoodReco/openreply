# This OpenReply installation

- Web app: https://openreply-three-green.vercel.app
- Vercel project: `tech-triad2/openreply`
- Source: https://github.com/GoodReco/openreply
- Mac project directory: `~/openreply`
- Contabo project directory: `/root/openreply` on `217.216.79.143`
- Allowed dashboard users: `samay.p@thegoodreco.com`, `shreyashsampat@gmail.com`

## Private configuration

Secrets are in gitignored, owner-only files. Do not commit or share their contents.

- `.env`: generated authentication, cron, and encryption secrets.
- `.env.infrastructure`: PostgreSQL and Redis passwords.
- `.env.worker`: worker environment, including private Docker connection URLs.
- `.env.vercel`: production web environment, including authenticated TLS URLs.
- `.env.passwords`: salted password hashes for the two approved trial users.
- `.deploy/trial-logins.txt`: the generated trial credentials. Keep these private.
- `.deploy/contabo_ed25519`: this Mac's dedicated SSH key; it is not sent to Vercel or the server.

The web app and worker use the same encryption key and datastores. Keep a secure
backup of these files, especially the encryption key, before changing this installation.

## Contabo services

Run these commands on the server, inside `/root/openreply`:

```sh
deploy/contabo/compose ps
deploy/contabo/compose logs --tail=100 worker
deploy/contabo/compose build worker
deploy/contabo/compose run --rm worker npm run db:migrate
deploy/contabo/compose up -d worker
```

Data is stored in `/root/openreply/data/postgres` and `/root/openreply/data/redis`.
PostgreSQL has its own database and Redis has its own password-protected instance.
Public ports are `15432` for PostgreSQL with TLS and `16379` for Redis with TLS.
Redis's plain port is available only inside the Docker network. PostgreSQL rejects
unencrypted connections from outside that network.

Caddy manages the certificate for `openreply.217-216-79-143.sslip.io`. Its site block
was added to `/srv/baatchit/infra/caddy/Caddyfile`; the previous configuration is
saved in `/root/openreply/.deploy/Caddyfile.before-openreply`.
The `openreply-certificates.timer` systemd timer checks hourly and copies renewed
certificates into OpenReply's datastores, reloading their TLS configuration.

```sh
systemctl status openreply-certificates.timer
systemctl start openreply-certificates.service
```

## Vercel

Production uses `npm ci` followed by `npm run vercel-build`, including Prisma
migrations. Functions run in Frankfurt. Deployment configuration is in `vercel.json`.
The Vercel environment contains production secrets; preview environments are not
connected to the production datastores.

```sh
npx vercel deploy --prod --scope tech-triad2
```

## Trial sign-in

The two approved users sign in with their email address and password at
https://openreply-three-green.vercel.app/login. View the generated credentials on
your Mac:

```sh
cat ~/openreply/.deploy/trial-logins.txt
```

Only configured addresses in `ALLOWED_EMAILS` can sign in. Passwords are stored as
salted scrypt hashes in the Vercel `LOGIN_PASSWORD_HASHES` setting. Sessions expire
after 24 hours. Login attempts are limited to ten per address every five minutes.
No email service or sender-domain verification is required. To reset a trial
password, replace its salted hash in `LOGIN_PASSWORD_HASHES` and redeploy.

After deploying, check `/api/health`. A complete infrastructure check returns HTTP
200, `status: "ok"`, and a healthy worker. An Instagram connection
must also be configured before campaigns can send messages. Use `docs/setup.md`
for direct Meta setup, or `docs/zernio.md` for the optional paid provider.
