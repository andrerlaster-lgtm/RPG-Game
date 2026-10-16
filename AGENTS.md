# AGENTS.md: Bellemorne: Paper Thief

Instructions for AI coding agents (Codex and others). Bellemorne: Paper Thief lives at https://bellemorne-rogue-game.vercel.app (login-protected) and in the GitHub repo `andrerlaster-lgtm/RPG-Game`.

## What this is

Plain JavaScript canvas game with Tiled levels.

## Commands

```
No build step. Preview index.html locally.
```

## This app's specifics

- This game is hidden. It must never appear on lasterlab.app or have a public link.
- Keep `THIRD_PARTY_NOTICES.md` current when adding art, sound or code from elsewhere.
- `npm run deploy` runs `vercel deploy` by hand. Don't use it; push to GitHub instead.

## Rules for any AI agent working here (Codex, Claude, or others)

1. **Deploys happen by pushing to GitHub.** A push to `main` on `andrerlaster-lgtm/RPG-Game` deploys to https://bellemorne-rogue-game.vercel.app automatically. Do NOT run `vercel deploy` or `vercel promote` by hand: the studio's Deploy Check can't verify hand deploys.
2. **Use a branch and a pull request.** Work on a new branch and open a pull request. Don't push to `main` unless the owner (Andre) asked you to. He merges.
3. **Keep the site private.** Login protection on every deployment must stay on. Never add public links, public aliases or shared preview links. Don't change Vercel project settings, domains or environment variables.
4. **No secrets in the repo.** Never commit `.env*`, tokens, API keys or passwords, and never print them. Andre adds keys in Vercel himself.
5. **No new AI features or paid APIs** without Andre's approval of the key and a spending cap.
6. **Test before asking for a merge.** Run the commands below and report what passed and what failed, honestly.
7. **Stay inside this app.** Don't edit other apps' folders or repos. If two apps need to share something, ask first.
8. **Keep notes current.** Update the README or project notes when behavior changes, and say what you didn't verify.
9. **After a merge,** check https://studio.lasterlab.app/deploys. This app should show Live. If it shows Failed or No deploy reported, find out why before doing anything else.
