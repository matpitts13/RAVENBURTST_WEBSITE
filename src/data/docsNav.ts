// The documentation's table of contents: the sidebar, the phone menu, the
// docs home page and the previous/next links all read this one list.
// scripts/check-site.mjs fails the build if a docs page is missing from it
// or it points at a page that doesn't exist.
export interface DocLink {
  href: string;
  label: string;
  blurb: string;
}
export interface DocSection {
  heading: string;
  links: DocLink[];
}

export const DOCS_NAV: DocSection[] = [
  {
    heading: 'Getting Started',
    links: [
      { href: '/docs', label: 'Overview', blurb: 'Where everything is.' },
      { href: '/docs/getting-started', label: 'First Launch', blurb: 'Install, start the trial and create your first project.' },
      { href: '/docs/project-templates', label: 'Project Templates', blurb: 'The 15 project types and what each one sets up.' },
    ],
  },
  {
    heading: 'Writing',
    links: [
      { href: '/docs/editor', label: 'The Editor', blurb: 'Formatting, inserting, comments, footnotes, find and spelling.' },
      { href: '/docs/navigator', label: 'Navigator & Structure', blurb: 'Parts, chapters, scenes, front and back matter, templates and trash.' },
      { href: '/docs/views', label: 'Views & Layout', blurb: 'Corkboard, Outline, Split View, Split Window and Composition Mode.' },
      { href: '/docs/characters-places', label: 'Characters & Places', blurb: 'Character and place sheets.' },
      { href: '/docs/notes-reference', label: 'Notes & Reference', blurb: 'Notes, reference tables and images.' },
      { href: '/docs/snapshots', label: 'Snapshots & Bookmarks', blurb: 'Save versions of a document and mark places to come back to.' },
      { href: '/docs/writing-targets', label: 'Targets & Statistics', blurb: 'Word count goals, statistics and your writing history.' },
    ],
  },
  {
    heading: 'Import & Export',
    links: [
      { href: '/docs/import', label: 'Importing', blurb: 'Bring in Word, text, Markdown and Fountain files.' },
      { href: '/docs/compile-options', label: 'Compiling', blurb: 'Choose what goes into an export and how it is laid out.' },
      { href: '/docs/export-formats', label: 'Export Formats', blurb: 'Every export format and what it produces.' },
    ],
  },
  {
    heading: 'Keeping Work Safe',
    links: [
      { href: '/docs/backups', label: 'Backups', blurb: 'Git Backup and Google Drive.' },
      { href: '/docs/data-privacy', label: 'Your Files & Privacy', blurb: 'Where your work lives and what the app sends.' },
    ],
  },
  {
    heading: 'Settings & Help',
    links: [
      { href: '/docs/preferences', label: 'Preferences', blurb: 'Themes, fonts, autosave, spelling and academic formats.' },
      { href: '/docs/keyboard-shortcuts', label: 'Keyboard Shortcuts', blurb: 'Every shortcut in one place.' },
      { href: '/docs/menus', label: 'Menu Reference', blurb: 'Every menu item and what it does.' },
      { href: '/docs/accessibility', label: 'Accessibility', blurb: 'High contrast, text size, keyboard use and screen readers.' },
      { href: '/docs/license', label: 'License & Activation', blurb: 'The trial, activating, devices and offline use.' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting', blurb: 'Fixes for common problems, and how to reach us.' },
    ],
  },
];

export const ALL_DOCS: DocLink[] = DOCS_NAV.flatMap((s) => s.links);

export function isCurrent(href: string, path: string): boolean {
  const clean = path.replace(/\/$/, '') || '/';
  return clean === href;
}
