/* Quad app design system: the side bar icons (D40, option E "soft badges"), shared by the staff portal and the console.
   One drawing per item, so no two side bar items share an icon. Each drawing is a set of 2 px round-capped lines on a
   24 px grid, with no fills. In the side bar every icon sits in a 32 px navy badge (`rail-2` with a 1 px `rail-line`
   ring) and is drawn in its section colour (the --nav-* tokens in tokens.css: Quad's palette, never the school
   colour). The selected item keeps the school-colour pill and its badge turns navy. See docs/spec/03-design-system.md#icons.
   QuadNavIcons.svg(name, size)    the bare icon, stroked in currentColor, aria-hidden
   QuadNavIcons.badge(name, colour) the icon in its badge; colour is a section colour name (lime, orange, pink, sky, violet, mist)
   QuadNavIcons.fill(root)          draws every [data-nav-icon="name"] element under root (default: the document)
   Works in the browser (window.QuadNavIcons) and in Node (module.exports). */
(function (root) {
  const ICONS = {
    // Staff portal
    home: 'M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-6h4v6', // Dashboard
    teach: 'M3 4.5h18M5 4.5v10h14v-10M12 14.5V19M8.5 21l3.5-2 3.5 2', // My teaching
    funnel: 'M3.5 5h17l-6.5 7.5V19l-4 2v-8.5z', // Admissions pipeline
    target: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z', // CRM & leads
    chat: 'M4 4.5h11.5v9H8.5L4 17zM15.5 9H20v8.5l-3-2.2h-6V13.5', // Communications
    family: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 9.3-4M17.5 20.5l-3.1-3a2 2 0 0 1 3.1-2.4 2 2 0 0 1 3.1 2.4z', // Family connection
    clip: 'M8.5 5H5.5v15.5h13V5h-3M8.5 3.5h7v3.5h-7zM9 13l2 2 4-4', // Evenings & forms
    cap: 'M2.5 9 12 4.5 21.5 9 12 13.5zM6.5 11v5c3.5 2.7 7.5 2.7 11 0v-5M21.5 9v5', // Students
    alert: 'M12 3.5 21.5 20h-19zM12 9.5v4M12 16.8v.2', // Early warning (staff and console)
    register: 'M4 4.5h16v16H4zM4 9h16M8.5 14.6l2.2 2.2 4.8-4.8M8 3v3M16 3v3', // Attendance
    care: 'M3 14h3l3.5 3H15a1.5 1.5 0 0 0 0-3h-3M6 14v6M9.5 17l6.7 2.3 4.8-3.3M15 11.5l-3-2.9a1.9 1.9 0 0 1 3-2.3 1.9 1.9 0 0 1 3 2.3z', // Pastoral care
    book: 'M12 6.5C10 5 7 4.5 3.5 5v13.5C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V20', // Courses & gradebook
    grid: 'M3.5 4.5h17v16h-17zM3.5 9.5h17M9.5 9.5v11M15 9.5v11M3.5 15h17', // Timetable
    board: 'M13 4h8v7h-8M8 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.5 20.5v-4A3.5 3.5 0 0 1 7 13h2.5l3.5-2', // Teachers & classes
    swap: 'M4 7h13l-3.5-3.5M20 17H7l3.5 3.5', // Staff cover
    exam: 'M5 3.5h9.5L19 8v12.5H5zM14.5 3.5V8H19M8.5 12.5h7M8.5 16.5h4', // Exams
    chart: 'M3.5 20.5h17M7 17v-5M12 17V7M17 17V9', // Reports
    card: 'M3.5 6h17v12.5h-17zM3.5 10.2h17', // Fees & invoicing
    calc: 'M5.5 3.5h13v17h-13zM8.5 6.5h7v3.2h-7zM8.6 13.5h.01M12 13.5h.01M15.4 13.5h.01M8.6 17h.01M12 17h.01M15.4 17h.01', // Accounting
    bus: 'M5 4.5h14v12H5zM5 11h14M8 19.5v-3M16 19.5v-3M8.5 13.8h.01M15.5 13.8h.01', // Transport: Routes
    pickup: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', // Transport: Pickup
    year: 'M4 5.5h16v15H4zM4 10h16M8 3.5v4M16 3.5v4M12 12.7l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z', // Academic year
    shield: 'M12 3.5l7.5 3v5.5c0 4.5-3.2 7.5-7.5 9-4.3-1.5-7.5-4.5-7.5-9V6.5zM12 7.4a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8zM8.6 16.5a3.6 3.6 0 0 1 6.8 0', // Users & roles
    sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4', // School settings
    help: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM9.6 9.6a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7M12 16.8v.2', // Help
    // Console
    tiles: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z', // Overview
    school: 'M3.5 20.5h17M5.5 20.5V9l6.5-4.5L18.5 9v11.5M10 20.5v-5h4v5M12 11.5v.01', // Schools
    tray: 'M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5M5.5 5h13l2 8.5V19h-17v-5.5z', // Leads
    books: 'M4 4.5h4v16H4zM8 4.5h4v16H8zM13.2 6.1l3.8-1 4 15.3-3.8 1z', // Curricula
    receipt: 'M5.5 3.5h13v17l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5zM9 8h6M9 11.2h6', // Plans & billing
    audit: 'M12 20.5H5v-17h9.5L19 8v4M14.5 3.5V8H19M16.5 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18.7 18.2l2.3 2.3', // Audit log
    team: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.6a5.5 5.5 0 0 1 3 5.4', // Platform users
    lifebuoy: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM6 6l3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18', // Support tickets
    server: 'M4 4.5h16v6H4zM4 13.5h16v6H4zM7.5 7.5h.01M7.5 16.5h.01M11 7.5h5.5M11 16.5h5.5', // System
    screen: 'M3 4.5h18v12H3zM8.5 20.5h7M12 16.5v4', // School admin app
    phone: 'M7 2.5h10v19H7zM10.5 18.5h3', // Parent app
    // Side bar footer buttons (drawn bare, in rail-ink)
    signout: 'M9.5 20.5h-5v-17h5M15.5 16.5 20 12l-4.5-4.5M20 12H9', // Sign out
    switch: 'M19.5 9.5A7.5 7.5 0 0 0 6 6.5L4.5 8M4.5 4v4h4M4.5 14.5A7.5 7.5 0 0 0 18 17.5l1.5-1.5M19.5 20v-4h-4' // Switch school
  };
  /** The section colours a badge may take (the --nav-* tokens). */
  const COLOURS = ['lime', 'orange', 'pink', 'sky', 'violet', 'mist'];

  function svg(name, size) {
    const d = ICONS[name], s = size || 20;
    if (!d) return '';
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  }
  function badge(name, colour) {
    const c = COLOURS.includes(colour) ? colour : 'mist';
    return `<span class="nav-badge" style="--nav-sc:var(--nav-${c})">${svg(name, 19)}</span>`;
  }
  function fill(scope) {
    const r = scope || (root.document && root.document); if (!r) return;
    r.querySelectorAll('[data-nav-icon]').forEach(el => { el.innerHTML = svg(el.dataset.navIcon, +el.dataset.navSize || 18); });
  }

  const api = {ICONS, COLOURS, svg, badge, fill, names: () => Object.keys(ICONS)};
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QuadNavIcons = api;
})(typeof window !== 'undefined' ? window : globalThis);
