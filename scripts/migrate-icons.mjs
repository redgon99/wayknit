import fs from 'fs';
import path from 'path';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(ent.name) && !ent.name.includes('wayknit-icons')) out.push(p);
  }
  return out;
}

const reps = [
  [/<i className="ti ti-x" aria-hidden="true" \/>/g, '<Icon name="close" />'],
  [/<i className="ti ti-loader-2 spin" aria-hidden="true" \/>/g, '<Icon name="loader" spin />'],
  [/<i className="ti ti-star-filled star" aria-hidden="true" \/>/g, '<Icon name="star" className="star" />'],
  [/<i className="ti ti-star-filled" aria-hidden="true" \/>/g, '<Icon name="star" />'],
  [/<i className="ti ti-search search-icon" aria-hidden="true" \/>/g, '<Icon name="search" className="search-icon" />'],
  [/<i className="ti ti-search origin-icon" aria-hidden="true" \/>/g, '<Icon name="search" className="origin-icon" />'],
  [/<i className="ti ti-current-location origin-icon" aria-hidden="true" \/>/g, '<Icon name="location" className="origin-icon" />'],
  [/<i className="ti ti-map-pin-pin origin-icon" aria-hidden="true" \/>/g, '<Icon name="pinSelect" className="origin-icon" />'],
  [/<i className="ti ti-grip-vertical drag-handle" aria-hidden="true" \/>/g, '<Icon name="grip" className="drag-handle" />'],
  [/<i className="ti ti-grip-vertical" aria-hidden="true" \/>/g, '<Icon name="grip" />'],
  [/<i className="ti ti-zoom-in" \/>/g, '<Icon name="zoomIn" />'],
  [
    /<i className={`ti \$\{presentationMode \? 'ti-arrows-minimize' : 'ti-presentation'\}`} aria-hidden="true" \/>/g,
    '<Icon name={presentationMode ? "minimize" : "presentation"} />',
  ],
];

const simple = {
  'ti-route': 'route',
  'ti-pin': 'pin',
  'ti-plus': 'plus',
  'ti-trash': 'trash',
  'ti-folder': 'folder',
  'ti-note': 'note',
  'ti-photo': 'photo',
  'ti-paperclip': 'attach',
  'ti-file': 'file',
  'ti-upload': 'upload',
  'ti-download': 'download',
  'ti-share': 'share',
  'ti-navigation': 'navigate',
  'ti-refresh': 'refresh',
  'ti-check': 'check',
  'ti-view-360': 'roadview',
  'ti-map-pin': 'mapPin',
  'ti-map-pin-plus': 'pinPlus',
  'ti-map-pin-pin': 'pinSelect',
  'ti-cloud': 'cloud',
  'ti-cloud-check': 'cloudOk',
  'ti-mail-check': 'mailOk',
  'ti-device-floppy': 'save',
  'ti-clock': 'clock',
  'ti-phone': 'phone',
  'ti-world': 'globe',
  'ti-bell': 'bell',
  'ti-trophy': 'trophy',
  'ti-sparkles': 'sparkles',
  'ti-wand': 'wand',
  'ti-chevron-left': 'chevronLeft',
  'ti-chevron-right': 'chevronRight',
  'ti-external-link': 'externalLink',
  'ti-current-location': 'location',
};

for (const [k, v] of Object.entries(simple)) {
  reps.push([
    new RegExp(`<i className="ti ${k}" aria-hidden="true" />`, 'g'),
    `<Icon name="${v}" />`,
  ]);
}

reps.push([
  /<i className={`ti \$\{meta\.icon\}`} aria-hidden="true" \/>/g,
  '<Icon name={meta.icon} />',
]);
reps.push([
  /<i className={`ti \$\{headMeta\.icon\}`} aria-hidden="true" \/>/g,
  '<Icon name={headMeta.icon} />',
]);
reps.push([
  /<i className={`ti \$\{modeMeta\.icon\}`} aria-hidden="true" \/>/g,
  '<Icon name={modeMeta.icon} />',
]);
reps.push([
  /<i className={`ti \$\{item\.icon\}`} aria-hidden="true" \/>/g,
  '<Icon name={item.icon} />',
]);
reps.push([
  /<i className={`ti \$\{SORT_ICONS\[key\]\}`} aria-hidden="true" \/>/g,
  '<Icon name={SORT_ICONS[key]} />',
]);

let count = 0;
for (const file of walk('src')) {
  if (file.includes('Icon.tsx') || file.includes('components\\Icon')) continue;
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('ti ti-') && !s.includes('ti ${') && !s.includes('`ti ')) continue;
  const orig = s;
  for (const [re, rep] of reps) s = s.replace(re, rep);

  if (s !== orig) {
    if (!s.includes("from './Icon'") && !s.includes('from "../components/Icon"')) {
      if (file.includes(`${path.sep}components${path.sep}`)) {
        s = s.replace(/^import /m, "import { Icon } from './Icon';\nimport ");
      } else if (file.includes(`${path.sep}pages${path.sep}`)) {
        s = s.replace(/^import /m, "import { Icon } from '../components/Icon';\nimport ");
      }
    }
    fs.writeFileSync(file, s);
    count++;
    console.log('updated', file);
  }
}
console.log('done', count);
