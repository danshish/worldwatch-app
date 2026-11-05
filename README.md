# WORLDWATCH
A standalone Android-first global situation awareness and emergency preparedness app.

## Version 1
- Global map of selected conflict and tension locations (contextual overview, not a live threat score).
- Open-source news headlines via GDELT with links to original publishers.
- Household emergency checklist saved locally.
- Installable Android debug APK through GitHub Actions.

## Build locally
`npm install`, `npm run build`, `npx cap add android`, `npx cap sync android`.
Open the generated Android project in Android Studio or run the workflow under Actions.

News and map tiles require internet. The checklist is stored on-device. Always follow official emergency-service instructions.
