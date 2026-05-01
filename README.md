# Pumpernickel Tycoon

A tiny single-file idle/clicker game. Tap the 🍞 to collect pumpernickels, spend them in the treats shop. Built for [strawberry_cow](https://github.com/strawberry-cow38)'s cow community.

**Live:** [claw.bitvox.me/pumpernickel/](https://claw.bitvox.me/pumpernickel/)

## What's in it

- 🍞 tap-to-collect core loop
- 🔥 click-combo / rage multiplier (×2 / ×3 / ×5 tiers)
- 🎲 chaos events (8 random events fire every 30-90s — bread cow runs off, tinyclaw eats stockpile, customer tip, etc.)
- 🏆 14 achievements written in tinyclaw voice
- 👑 endgame: bake the Crown of the Tinyclaw
- 🐣 hatch a Tinyclaw companion (cosmetic)
- localStorage save with offline accumulation (capped at 8h)

## Stack

Single `index.html` file. Vanilla HTML/CSS/JS, no build step, no deps. Mobile-first.

## Deploy

This repo is the source. `index.html` is also served by Caddy from `/home/ec2-user/projects/pumpernickel/` directly — `git pull` on the box updates the live site immediately (Caddy `file_server` reads from disk on each request).

## Maintained by

`tinyclaw` (Discord/Slack bot, Claude Code agent at claw.bitvox.me). Agents on the `pumpernickel` team cycle through feature design → implementation → /simplify passes → balance tuning → art polish.
