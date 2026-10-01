(() => {
  'use strict';

  const cfg = window.GRAPHLAIR_CONFIG || {};
  const DEFAULTS = window.GRAPHLAIR_DEFAULT_CONTENT || {};
  const $ = (s, r=document) => r.querySelector(s);

  const clone = o => JSON.parse(JSON.stringify(o || {}));
  function deepMerge(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? clone(extra) : clone(base);
    if (base && typeof base === 'object') {
      const out = {...base};
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        for (const [k,v] of Object.entries(extra)) out[k] = (k in base) ? deepMerge(base[k], v) : clone(v);
      }
      return out;
    }
    return extra === undefined || extra === null ? base : extra;
  }

  const known = {
    'nafis':'Nafis Tamim',
    'tawhid-taj':'Tawhidul Islam Taj',
    'alimul-firoz':'Alimul Firoz',
    'shuria-shimu':'Shuria Akter Shimu',
    'marian-tanjum':'Tanjum Nahar Maria',
    'faiza':'Faiza Naba'
  };

  function normalizeLink(v='') {
    let s = String(v || '').trim();
    try {
      if (/^https?:/i.test(s)) s = new URL(s).pathname;
    } catch(e) {}
    return s.replace(/^\/+|\/+$/g,'').split('/')[0] || '';
  }

  function escapeHtml(v='') {
    return String(v).replace(/[&<>'"]/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c]));
  }

  async function loadContent() {
    const base = clone(DEFAULTS);
    try {
      if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return base;
      const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const {data, error} = await sb.from('site_content')
        .select('content')
        .eq('id', cfg.CONTENT_ROW_ID || 'main')
        .maybeSingle();
      if (error) throw error;
      return deepMerge(base, data?.content || {});
    } catch (err) {
      console.warn('[Graphlair member profile] using defaults:', err?.message || err);
      return base;
    }
  }

  async function init() {
    const content = await loadContent();
    const slug = document.body.dataset.memberSlug || location.pathname.split('/').filter(Boolean).pop() || '';
    const members = content.team?.members || [];

    const member = members.find(m => normalizeLink(m.link) === slug)
      || members.find(m => m.name === known[slug])
      || members.find(m => String(m.name || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') === slug);

    if (!member) {
      document.title = 'Member not found — Graphlair';
      $('#profileContent').innerHTML = `
        <div class="not-found">
          <div class="eyebrow">GRAPHLAIR / TEAM</div>
          <h1>PROFILE<br>NOT FOUND.</h1>
          <a href="/#team">← Back to team</a>
        </div>`;
      return;
    }

    const accent = content.site?.accentColor || '#98FC1C';
    document.documentElement.style.setProperty('--acid', accent);
    document.title = `${member.name} — Graphlair`;

    const img = String(member.image || '').trim();
    const visual = img
      ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(member.name)}">`
      : `<div class="initials">${escapeHtml(member.initials || '')}</div>`;

    $('#profileContent').innerHTML = `
      <div class="profile-grid">
        <section class="profile-visual">
          ${visual}
          <span class="profile-code">${escapeHtml(member.code || '')}</span>
        </section>

        <section class="profile-info">
          <div class="profile-topline">
            <span>GRAPHLAIR / TEAM PROFILE</span>
            <span>${escapeHtml(member.code || '')}</span>
          </div>

          <div class="profile-main">
            <div class="role">${escapeHtml(member.role || '')}</div>
            <h1>${escapeHtml(member.name || '')}</h1>
            <p>${escapeHtml(member.bio || '')}</p>
          </div>

          <div class="profile-bottom">
            <a class="back" href="/#team">← BACK TO TEAM</a>
            <a class="contact" href="/#contact">START A PROJECT ↗</a>
          </div>
        </section>
      </div>`;

    const cursor = $('#cursor');
    const dot = $('#cursorDot');
    if (cursor && dot && matchMedia('(pointer:fine)').matches) {
      addEventListener('mousemove', e => {
        cursor.style.left = dot.style.left = e.clientX + 'px';
        cursor.style.top = dot.style.top = e.clientY + 'px';
      }, {passive:true});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();