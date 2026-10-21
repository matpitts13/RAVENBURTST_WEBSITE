// The "new version" email for 1.0.0-beta.3, for beta testers only (people
// who signed up from the beta page). Keep it in step with the changelog
// entry in src/pages/changelog.astro.
export default {
  // Only subscribers whose signup source is this one get it.
  audience: "beta",
  subject: "Ravenburst beta 1.0.0-beta.3 is ready",
  heading: "A new beta is ready",
  intro: "Thanks for testing Ravenburst. Version 1.0.0-beta.3 is the biggest update yet: Ravenburst now writes tabletop RPG adventures and runs campaigns, as well as books and scripts.",
  items: [
    "Tabletop Adventure and Tabletop Campaign projects, with their own left bar for encounters, creatures, characters, maps, locations, items, handouts, roll tables and sessions",
    "Encounters with live difficulty for your party",
    "Encounter maps you can draw or generate, with a GM map, a player map and table-size printing",
    "Character sheets, full or quick NPC, for 5e or any game, plus your own bestiary and item compendium",
    "A two-column adventure PDF, with or without the GM notes",
    "Take your custom dictionary and library to another computer",
    "Ravenburst opens on the project picker, and you can pin projects to the top",
  ],
  howToGet: [
    "To update on Windows or with the Linux AppImage: Ravenburst downloads it by itself. When \"Restart to update\" appears in the status bar at the bottom of the window, click it (your work is saved first), or choose Help → Check for Updates.",
    "On a Mac, or with the Linux .deb or .rpm: \"Update available\" appears in the status bar - download the new version from the beta install guide and install it over the old one. Your projects aren't touched.",
    "Installing on another computer? The beta install guide has the downloads: https://ravenburst.com/beta",
    "If anything breaks or feels wrong, Help → Report a Bug sends it straight to us.",
  ],
};
