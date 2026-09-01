import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.querySelector('#app');

const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const currentPath = () => decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ''));

async function loadSettings(){
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  return data || {};
}

function applyTheme(s){
  const r = document.documentElement;
  r.style.setProperty('--bg', s.background_color || '#050806');
  r.style.setProperty('--card', s.card_color || '#0b100d');
  r.style.setProperty('--accent', s.primary_color || '#7df46a');
  r.style.setProperty('--text', s.text_color || '#f7faf7');
  r.style.setProperty('--muted', s.muted_color || '#89918c');
  if (s.favicon_url) document.querySelector('#site-favicon').href = s.favicon_url;
}

async function navHtml(){
  const { data=[] } = await supabase.from('navigation_items').select('*').eq('is_visible', true).order('sort_order');
  return data.map(x => `<a href="${esc(x.url || '#')}">${esc(x.label)}</a>`).join('');
}

function sectionHtml(section){
  const c = section.content || {};
  if (section.section_type === 'hero') return `<section class="hero section"><div><div class="eyebrow">${esc(c.eyebrow||'')}</div><h1>${esc(c.title||section.title||'')}</h1><p>${esc(c.description||'')}</p><div class="actions">${c.primary_text ? `<a class="btn primary" href="${esc(c.primary_url||'#')}">${esc(c.primary_text)}</a>`:''}${c.secondary_text ? `<a class="btn" href="${esc(c.secondary_url||'#')}">${esc(c.secondary_text)}</a>`:''}</div></div>${c.image_url?`<img class="hero-img" src="${esc(c.image_url)}" alt="">`:''}</section>`;
  if (section.section_type === 'text') return `<section class="section narrow"><h2>${esc(section.title||c.title||'')}</h2><p>${esc(c.text||'')}</p></section>`;
  if (section.section_type === 'image_text') return `<section class="section split">${c.image_url?`<img src="${esc(c.image_url)}" alt="">`:''}<div><h2>${esc(section.title||c.title||'')}</h2><p>${esc(c.text||'')}</p></div></section>`;
  if (section.section_type === 'cards') return `<section class="section"><h2>${esc(section.title||c.title||'')}</h2><div class="grid">${(c.items||[]).map(i=>`<article class="card"><h3>${esc(i.title||'')}</h3><p>${esc(i.text||'')}</p>${i.url?`<a href="${esc(i.url)}">Explore →</a>`:''}</article>`).join('')}</div></section>`;
  if (section.section_type === 'stats') return `<section class="section stats">${(c.items||[]).map(i=>`<div><strong>${esc(i.value||'')}</strong><span>${esc(i.title||'')}</span></div>`).join('')}</section>`;
  if (section.section_type === 'cta') return `<section class="section cta"><h2>${esc(c.title||section.title||'')}</h2><p>${esc(c.text||'')}</p>${c.button_text?`<a class="btn primary" href="${esc(c.button_url||'#')}">${esc(c.button_text)}</a>`:''}</section>`;
  return '';
}

async function renderMember(slug, settings){
  const { data:m } = await supabase.from('team_members').select('*').eq('slug', slug).eq('is_visible', true).maybeSingle();
  if (!m) return false;
  document.title = `${m.name} — ${settings.site_name || 'Graphlair'}`;
  app.innerHTML = `<header class="nav"><a class="brand" href="/">${settings.logo_url?`<img src="${esc(settings.logo_url)}" alt="">`:`<span>${esc(settings.site_name||'Graphlair')}</span>`}</a><nav>${await navHtml()}</nav></header>
  <main><section class="member-hero section"><img class="avatar" src="${esc(m.profile_image||'')}" alt=""><div><div class="eyebrow">${esc(m.role||'')}</div><h1>${esc(m.name)}</h1><p>${esc(m.short_bio||'')}</p><div class="socials">${m.linkedin?`<a href="${esc(m.linkedin)}" target="_blank">LinkedIn</a>`:''}${m.github?`<a href="${esc(m.github)}" target="_blank">GitHub</a>`:''}${m.website?`<a href="${esc(m.website)}" target="_blank">Website</a>`:''}</div></div></section><section class="section narrow"><h2>About</h2><p>${esc(m.full_bio||'')}</p></section></main>`;
  return true;
}

async function renderPage(slug, settings){
  const q = slug ? supabase.from('pages').select('*').eq('slug', slug).eq('status','published').maybeSingle() : supabase.from('pages').select('*').eq('is_home', true).eq('status','published').maybeSingle();
  const { data:p } = await q;
  if (!p) return false;
  document.title = p.seo_title || `${p.title} — ${settings.site_name || 'Graphlair'}`;
  const { data:sections=[] } = await supabase.from('page_sections').select('*').eq('page_id', p.id).eq('is_visible', true).order('sort_order');
  app.innerHTML = `<header class="nav"><a class="brand" href="/">${settings.logo_url?`<img src="${esc(settings.logo_url)}" alt="">`:`<span>${esc(settings.site_name||'Graphlair')}</span>`}</a><nav>${await navHtml()}</nav><a class="admin-link" href="/admin.html">Admin</a></header><main>${sections.map(sectionHtml).join('')}</main><footer>${esc(settings.footer_text || `© ${new Date().getFullYear()} ${settings.site_name||'Graphlair'}`)}</footer>`;
  return true;
}

async function boot(){
  if (SUPABASE_URL.includes('YOUR_PROJECT')) {
    app.innerHTML = `<div class="setup"><h1>Connect Supabase</h1><p>Edit <code>config.js</code> and paste your Supabase URL and public anon key.</p></div>`;
    return;
  }
  const settings = await loadSettings(); applyTheme(settings);
  const slug = currentPath();
  if (slug && await renderMember(slug, settings)) return;
  if (await renderPage(slug, settings)) return;
  app.innerHTML = `<div class="setup"><h1>404</h1><p>This Graphlair page does not exist.</p><a class="btn primary" href="/">Go home</a></div>`;
}
boot();
