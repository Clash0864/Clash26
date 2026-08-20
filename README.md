# CLASH 26 Online Multiplayer

A real-time multiplayer prototype using Node.js, Express and Socket.IO.

## Run locally
1. Install Node.js 18+.
2. In this folder run: `npm install`
3. Run: `npm start`
4. Open `http://localhost:3000`

To test on multiple devices on the same Wi-Fi, use your computer's local IP address, for example `http://192.168.1.20:3000`.

## Put it online
Deploy this folder to any Node-compatible host (for example Render, Railway, Fly.io, or a small VPS). Set the start command to `npm start`. No database is required for this prototype, but rooms disappear when the server restarts.

## Current rules
- Host creates a room and shares a 4-character code.
- 2–8 players can join.
- Host starts the round and reveals one shared letter.
- All players answer the same five categories simultaneously on their own devices.
- First completed submission starts a 10-second final countdown for everyone else.
- Host reviews answers.
- Unique valid answers = 10 points; duplicates = 5 points; rejected/blank = 0.
- Host starts the next round.
