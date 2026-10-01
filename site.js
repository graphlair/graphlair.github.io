(() => {
  'use strict';

  const cfg = window.GRAPHLAIR_CONFIG || {};
  const DEFAULTS = window.GRAPHLAIR_DEFAULT_CONTENT || {};
  let sb = null;
  let content = null;

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const clone = obj => JSON.parse(JSON.stringify(obj || {}));

  function deepMerge(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? clone(extra) : clone(base);
    if (base && typeof base === 'object') {
      const out = {...base};
      if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        for (const [k,v] of Object.entries(extra)) {
          out[k] = (k in base) ? deepMerge(base[k], v) : clone(v);
        }
      }
      return out;
    }
    return extra === undefined || extra === null ? base : extra;
  }

  function esc(v='') {
    return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function safeUrl(v='', fallback='#') {
    const s = String(v || '').trim();
    if (!s) return fallback;
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(s)) return s;
    return fallback;
  }


  function memberProfileUrl(member={}) {
    const raw = String(member.link || '').trim();
    if (raw && raw !== '#' && !/^javascript:/i.test(raw)) {
      const custom = safeUrl(raw, '');
      if (custom) return custom;
    }
    return defaultMemberLink(member.name);
  }

  function imageUrl(v='') {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^(https?:|\/|\.\/|\.\.\/)/i.test(s)) return s;
    return '';
  }

  function nl2br(v='') { return esc(v).replace(/\n/g, '<br>'); }

  function defaultMemberLink(name='') {
    const known = {
      'Nafis Tamim':'/nafis/',
      'Tawhidul Islam Taj':'/tawhid-taj/',
      'Alimul Firoz':'/alimul-firoz/',
      'Shuria Akter Shimu':'/shuria-shimu/',
      'Tanjum Nahar Maria':'/marian-tanjum/',
      'Faiza Naba':'/faiza/'
    };
    if (known[name]) return known[name];
    const slug = String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'');
    return slug ? `/${slug}/` : '';
  }


  async function loadContent() {
    const mergedDefault = clone(DEFAULTS);
    try {
      if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return mergedDefault;
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const {data, error} = await sb.from('site_content').select('content').eq('id', cfg.CONTENT_ROW_ID || 'main').maybeSingle();
      if (error) throw error;
      return deepMerge(mergedDefault, data?.content || {});
    } catch (err) {
      console.warn('[Graphlair CMS] Using built-in content:', err?.message || err);
      return mergedDefault;
    }
  }

  function renderSiteMeta(c) {
    document.title = c.site.pageTitle || 'Graphlair';
    const md = $('meta[name="description"]');
    if (md) md.setAttribute('content', c.site.metaDescription || '');
    document.documentElement.style.setProperty('--acid', c.site.accentColor || '#98FC1C');

    const brand = $('.brand');
    if (brand) {
      const logo=imageUrl(c.site.logoImage);
      brand.innerHTML = logo ? `<img class="header-logo" src="${esc(logo)}" alt="Graphlair">` : `${esc(c.site.brandMain)}<b>${esc(c.site.brandAccent)}</b>`;
    }
  }

  function renderLoader(c) {
    const meta = $$('.loader-small span');
    if (meta[0]) meta[0].textContent = c.loader.metaLeft || '';
    if (meta[1]) meta[1].textContent = c.loader.metaRight || '';
    const statement = $('.loader-statement');
    if (statement) {
      statement.innerHTML = (c.loader.lines || []).map((line,i) =>
        `<span class="scramble ${i === Number(c.loader.accentLine) ? 'loader-acid' : ''}" data-text="${esc(line)}">${esc(line)}</span>`
      ).join('');
    }
    const footer = $$('.loader-footer-line span');
    if (footer[0]) footer[0].textContent = c.loader.footerLeft || '';
    if (footer[1]) footer[1].textContent = c.loader.footerRight || '';
  }

  function renderNavigation(c) {
    const nav = $('.navlinks');
    if (nav) nav.innerHTML = (c.navigation || []).map(i => `<a href="${esc(safeUrl(i.href))}">${esc(i.label)}</a>`).join('');
    const cta = $('.navcta');
    if (cta) {
      cta.textContent = c.navCta?.label || '';
      cta.setAttribute('href', safeUrl(c.navCta?.href));
    }
  }

  function renderHero(c) {
    const meta = $$('.signal-hero-meta span');
    if (meta[0]) meta[0].textContent = c.hero.metaLeft || '';
    if (meta[1]) meta[1].textContent = c.hero.metaRight || '';

    const title = $('#signalTitle');
    if (title) {
      title.innerHTML = (c.hero.titleLines || []).map(line =>
        `<span class="sig-line ${line.accent ? 'acid' : ''}"><i>${esc(line.text)}</i></span>`
      ).join('');
    }
    const p = $('.signal-copy p'); if (p) p.textContent = c.hero.description || '';
    const actions = $$('.signal-actions a');
    if (actions[0]) { actions[0].innerHTML = `${esc(c.hero.primary?.label || '')}`; actions[0].href = safeUrl(c.hero.primary?.href); }
    if (actions[1]) { actions[1].innerHTML = `${esc(c.hero.secondary?.label || '')}`; actions[1].href = safeUrl(c.hero.secondary?.href); }
    const d = $('.signal-disciplines');
    if (d) d.innerHTML = (c.hero.disciplines || []).map(x => `<span>${esc(x)}</span>`).join('');
    const scroll = $('.signal-scroll');
    if (scroll) scroll.innerHTML = `${esc(c.hero.scrollLabel || 'SCROLL')} <i></i>`;
  }

  function applyPosterPalette(palette) {
    const poster = $('#brandPoster');
    if (!poster || !palette) return;
    poster.style.setProperty('--poster-accent', palette.accent || '#98FC1C');
    poster.style.setProperty('--poster-accent2', palette.accent2 || palette.accent || '#C5FF77');
    poster.style.setProperty('--poster-bg', palette.bg || '#090909');
    poster.style.setProperty('--poster-fg', palette.fg || '#F5F5EF');
    poster.style.setProperty('--poster-glow', palette.glow || 'rgba(152,252,28,.21)');
    poster.dataset.palette = palette.id || '';
  }

  function renderPoster(c) {
    const p = c.poster || {};
    const ui = $$('.poster-ui span'); if (ui[0]) ui[0].textContent=p.uiLeft||''; if (ui[1]) ui[1].textContent=p.uiRight||'';
    const top = $$('.poster-top span'); if(top[0]) top[0].textContent=p.topLeft||''; if(top[1]) top[1].textContent=p.topRight||'';
    const title = $('.poster-title');
    if (title) title.innerHTML = (p.titleLines || []).map((x,i)=>`<span class="${i===Number(p.outlineLine)?'poster-outline':''}">${esc(x)}</span>`).join('');
    const sym = $('.poster-symbol'); if(sym) sym.textContent=p.symbol||'';
    const bottom = $$('.poster-bottom > div');
    if(bottom[0]) bottom[0].innerHTML=`<b>${nl2br(p.bottomLeft||'')}</b>`;
    if(bottom[1]) bottom[1].innerHTML=nl2br(p.bottomRight||'');
    const idx=$('.poster-index'); if(idx) idx.textContent=p.index||'';
    const ct=$('.poster-control-copy strong'); if(ct) ct.textContent=p.controlTitle||'';
    const cs=$('.poster-control-copy span'); if(cs) cs.textContent=p.controlSubtitle||'';

    const poster = $('#brandPoster');
    if (poster) {
      $$('.poster-shape', poster).forEach(el => el.remove());
      const before = $('.poster-title', poster);
      (p.shapes || []).forEach((shape,i) => {
        const el = document.createElement('div');
        el.className = 'poster-shape cms-poster-shape';
        el.dataset.shapeIndex = i;
        const x=Number(shape.x)||0,y=Number(shape.y)||0,w=Number(shape.width)||10,h=Number(shape.height)||10,rot=Number(shape.rotate)||0;
        el.style.left = x+'%'; el.style.top=y+'%'; el.style.width=w+'%'; el.style.height=h+'%';
        el.style.transform=`rotate(${rot}deg)`; el.style.opacity=shape.opacity ?? 1;
        el.style.background = shape.filled === false ? 'transparent' : 'var(--poster-accent)';
        el.style.border = shape.filled === false ? `${Number(shape.borderWidth)||2}px solid var(--poster-accent)` : '0';
        el.style.borderRadius = shape.type === 'circle' ? '50%' : shape.type === 'pill' ? '999px' : '0';
        poster.insertBefore(el, before || null);
      });
    }

    const swatches = $('.poster-swatches');
    if (swatches) {
      swatches.innerHTML = (p.palettes || []).map(x => `<button class="poster-swatch ${x.id===p.defaultPalette?'active':''}" data-palette="${esc(x.id)}"><i style="background:${esc(x.accent)}"></i><span>${esc(x.label)}</span></button>`).join('');
    }
    const def = (p.palettes || []).find(x=>x.id===p.defaultPalette) || (p.palettes || [])[0];
    applyPosterPalette(def);
  }

  function renderKinetic(c) {
    const t = c.kinetic?.text || '';
    const track = $('.kinetic-track');
    if (track) track.innerHTML = `<span>${esc(t)}</span><span>${esc(t)}</span>`;
  }

  function renderManifesto(c) {
    const m = c.manifesto || {};
    const section = $('#manifesto'); if (!section) return;
    const eye = $('.man-small', section); if(eye) eye.textContent=m.eyebrow||'';
    const h2=$('h2', section); if(h2) h2.innerHTML=(m.titleLines||[]).map(l=>l.accent?`<em>${esc(l.text)}</em>`:esc(l.text)).join('<br>');
    const p=$('.man-grid p', section); if(p) p.textContent=m.description||'';
    const line=$('.man-line', section); if(line) line.innerHTML=(m.pillars||[]).map(x=>`<div><strong>${esc(x.number)}</strong><span>${esc(x.label)}</span></div>`).join('');
  }

  function renderImpact(c) {
    const sec=$('#impact'); if(!sec) return;
    const d=c.impact||{};
    const eye=$('.section-head .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.section-head h2',sec); if(h) h.textContent=d.title||'';
    const n=$('.data-note',sec); if(n) n.textContent=d.note||'';
    const grid=$('.metrics-grid',sec);
    if(grid) grid.innerHTML=(d.metrics||[]).map(x=>`<article class="metric reveal"><strong><span class="counter" data-target="${Number(x.value)||0}">0</span><span class="unit">${esc(x.suffix||'')}</span></strong><span>${esc(x.label||'')}</span><p>${esc(x.description||'')}</p></article>`).join('');
    const graph=d.graph||{};
    const ge=$('.growth-card .eyebrow',sec); if(ge) ge.textContent=graph.eyebrow||'';
    const gh=$('.growth-card h3',sec); if(gh) gh.textContent=graph.title||'';
    const gr=$('#growthReadout'); if(gr){gr.textContent='0';gr.dataset.target=Number(graph.readoutTarget)||0;}
    const gs=$('.growth-readout b',sec); if(gs) gs.textContent=graph.readoutSuffix||'';
    const gl=$('.growth-readout small',sec); if(gl) gl.textContent=graph.readoutLabel||'';
    const bars=$('.bars',sec);
    if(bars) bars.innerHTML=(graph.bars||[]).map(x=>`<div class="bar-col"><div class="bar-fill" data-value="${Math.max(0,Math.min(100,Number(x.value)||0))}"><span>${Number(x.value)||0}</span></div><small>${esc(x.label||'')}</small></div>`).join('');
    const gf=$('.growth-foot',sec); if(gf) gf.textContent=graph.foot||'';
    const path=$('#trendPath');
    if(path && (graph.bars||[]).length){
      const vals=graph.bars.map(x=>Math.max(0,Math.min(100,Number(x.value)||0)));
      const pts=vals.map((v,i)=>[100+i*(800/Math.max(1,vals.length-1)),280-v*2.55]);
      path.setAttribute('d', pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
    }
  }

  function renderProjects(c) {
    const sec=$('#work'); if(!sec) return;
    const d=c.projects||{};
    const eye=$('.section-head .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.section-head h2',sec); if(h) h.textContent=d.title||'';
    const link=$('.section-link',sec); if(link){link.textContent=d.archiveLabel||'';link.href=safeUrl(d.archiveLink);}
    const list=$('.case-list',sec);
    if(list) list.innerHTML=(d.items||[]).map((x,i)=>{
      const img=imageUrl(x.image);
      const artClass=`pa${(i%4)+1}`;
      const style=img?`style="background-image:url('${esc(img)}');background-size:cover;background-position:center"`:'';
      return `<article class="case ${x.reverse?'reverse':''} reveal-case">
        <div class="case-copy"><small>${esc(x.eyebrow||'')}</small><h3>${esc(x.title||'')}</h3><p>${esc(x.tags||'')}</p><span>${esc(x.description||'')}</span></div>
        <a class="case-media hover" data-label="OPEN" href="${esc(safeUrl(x.link))}"><div class="case-art ${artClass}" ${style}></div></a>
      </article>`;
    }).join('');
  }

  function renderNetwork(c) {
    const sec=$('#world'); if(!sec) return;
    const d=c.network||{};
    const eye=$('.network-copy .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.network-copy h2',sec); if(h) h.innerHTML=`${esc(d.titleLine1||'')}<br><em>${esc(d.titleAccent||'')}</em>`;
    const p=$('.network-copy p',sec); if(p) p.textContent=d.description||'';
    const note=$('.network-note',sec); if(note) note.textContent=d.note||'';
    const canvas=$('.network-canvas',sec); if(!canvas) return;
    const hub=d.hub||{x:48.2,y:51.5,title:'GRAPHLAIR',subtitle:'DHAKA / BD'};
    const hx=Number(hub.x)*11, hy=Number(hub.y)*7.6;
    const countries=d.countries||[];
    const paths=countries.map((x,i)=>{
      const ex=Number(x.x)*11, ey=Number(x.y)*7.6, cx=Number(x.curveX)*11, cy=Number(x.curveY)*7.6;
      const delay=.1+i*.08;
      return `<path class="country-line" style="stroke:${esc(x.lineColor||'rgba(255,255,255,.46)')};animation-delay:${delay}s" d="M${hx} ${hy} Q${cx} ${cy} ${ex} ${ey}"/>`;
    }).join('');
    const dots=countries.filter(x=>x.animated!==false).slice(0,8).map((x,i)=>{
      const ex=Number(x.x)*11, ey=Number(x.y)*7.6, cx=Number(x.curveX)*11, cy=Number(x.curveY)*7.6;
      return `<circle class="travel-dot" style="fill:${esc(x.color||'#98FC1C')}" r="5"><animateMotion dur="${3.6+i*.3}s" begin="${1+i*.12}s" repeatCount="indefinite" path="M${hx} ${hy} Q${cx} ${cy} ${ex} ${ey}"/></circle>`;
    }).join('');
    const labels=countries.map((x,i)=>`<div class="country-label" style="--delay:${(.1+i*.12).toFixed(2)}s;--x:${Number(x.x)}%;--y:${Number(x.y)}%;--country-color:${esc(x.color||'#fff')}"><span>${esc(x.name)}</span><small>${esc(x.index||String(i+1).padStart(2,'0'))}</small></div>`).join('');
    const shapes=(d.shapes||[]).map((x,i)=>`<div class="network-shape ns-${esc(x.type||'rect')}" style="left:${Number(x.x)}%;top:${Number(x.y)}%;width:${Number(x.width)}%;height:${Number(x.height)}%;transform:rotate(${Number(x.rotation)||0}deg);opacity:${x.opacity??.2};--shape-color:${esc(x.color||'#98FC1C')};--shape-border:${Number(x.borderWidth)||1}px;--shape-fill:${x.filled===false?'transparent':esc(x.color||'#98FC1C')}"></div>`).join('');
    canvas.innerHTML=`<svg viewBox="0 0 1100 760" class="network-svg" aria-hidden="true"><defs><filter id="lineGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${paths}<g class="hub"><circle cx="${hx}" cy="${hy}" r="64"/><circle cx="${hx}" cy="${hy}" r="22"/><path d="M${hx-30} ${hy} H${hx+30}"/><path d="M${hx} ${hy-30} V${hy+30}"/></g>${dots}</svg>${shapes}${labels}<div class="hub-label" style="left:${Number(hub.x)}%;top:${Number(hub.y)}%"><strong>${esc(hub.title||'')}</strong><span>${esc(hub.subtitle||'')}</span></div><div class="network-hud"><span>CURVES / LIVE</span><span>COUNTRIES / REVEAL</span><span>HUB / BANGLADESH</span></div>`;
  }

  function renderAwards(c) {
    const sec=$('#awards'); if(!sec) return;
    const d=c.awards||{};
    const eye=$('.section-head .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.section-head h2',sec); if(h) h.textContent=d.title||'';
    const list=$('.award-list',sec);
    if(list) list.innerHTML=(d.items||[]).map(x=>{const img=imageUrl(x.image);return `<a class="award-row reveal" href="${esc(safeUrl(x.link))}"><small>${esc(x.year||'')}</small><h3>${esc(x.title||'')}</h3><span>${esc(x.category||'')}</span>${img?`<span class="award-media"><img src="${esc(img)}" alt="${esc(x.title||'Award')}"></span>`:''}<b>↗</b></a>`}).join('');
  }

  function renderTeam(c) {
    const sec=$('#team'); if(!sec) return;
    const d=c.team||{};
    const eye=$('.section-head .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.section-head h2',sec); if(h) h.innerHTML=nl2br(d.title||'');
    const grid=$('.team-grid',sec);
    if(grid) grid.innerHTML=(d.members||[]).map(x=>{
      const img=imageUrl(x.image); const href=memberProfileUrl(x); const tag=href?'a':'article';
      const media=img?`<img class="member-photo" src="${esc(img)}" alt="${esc(x.name||'Team member')}">`:`<div class="member-id">${esc(x.initials||'')}</div>`;
      return `<${tag} class="member reveal hover" data-label="VIEW" ${href?`href="${esc(href)}" data-member-href="${esc(href)}"`:''}><div class="member-visual"><span class="member-code">${esc(x.code||'')}</span>${media}</div><div class="member-info"><small>${esc(x.role||'')}</small><h3>${esc(x.name||'')}</h3><p>${esc(x.bio||'')}</p></div></${tag}>`;
    }).join('');
  }

  function renderClients(c) {
    const sec=$('#clients'); if(!sec) return;
    const items=c.clients?.items||[];
    const track=$('.client-track',sec); if(!track) return;
    const one=items.map(x=>{const logo=imageUrl(x.logo); return `<a class="client-item" href="${esc(safeUrl(x.link))}">${logo?`<img src="${esc(logo)}" alt="${esc(x.name)}">`:`<span>${esc(x.name)}</span>`}</a>`}).join('');
    track.innerHTML=one+one;
  }

  function renderTestimonials(c) {
    const sec=$('#quotes'); if(!sec) return;
    const d=c.testimonials||{};
    const eye=$('.section-head .eyebrow',sec); if(eye) eye.textContent=d.eyebrow||'';
    const h=$('.section-head h2',sec); if(h) h.textContent=d.title||'';
    const grid=$('.quote-grid',sec);
    if(grid) grid.innerHTML=(d.items||[]).map(x=>`<article class="quote reveal"><p>“${esc(x.quote||'')}”</p><footer>${esc(x.name||'')} / ${esc(x.roleCompany||'')}</footer></article>`).join('');
  }

  function renderContact(c) {
    const sec=$('#contact'); if(!sec) return;
    const d=c.contact||{};
    const h=$('h2',sec); if(h) h.innerHTML=`${esc(d.titleLine1||'')}<br><em>${esc(d.titleAccent||'')}</em>`;
    const cards=$$('.contact-card',sec);
    if(cards[0]){
      const h3=$('h3',cards[0]); if(h3) h3.textContent=d.cardTitle||'';
      const list=$('.contact-list',cards[0]);
      if(list) list.innerHTML=`<div><b>${esc(d.websiteLabel||'Website')}</b> — ${esc(d.website||'')}</div><div><b>${esc(d.locationLabel||'Location')}</b> — ${esc(d.location||'')}</div><div><b>${esc(d.emailLabel||'Email')}</b> — ${esc(d.email||'')}</div><div><b>${esc(d.socialLabel||'Social')}</b> — ${esc(d.socialText||'')}</div>`;
    }
    if(cards[1]){
      const h3=$('h3',cards[1]); if(h3) h3.textContent=d.formTitle||'';
      const inputs=$$('input',cards[1]);
      if(inputs[0]) inputs[0].placeholder=d.namePlaceholder||'Name';
      if(inputs[1]) inputs[1].placeholder=d.emailPlaceholder||'Email';
      if(inputs[2]) inputs[2].placeholder=d.companyPlaceholder||'Company / Project';
      const ta=$('textarea',cards[1]); if(ta) ta.placeholder=d.messagePlaceholder||'Message';
      const submit=$('.submit',cards[1]); if(submit) submit.textContent=d.submitLabel||'Send enquiry ↗';
      const form=$('form',cards[1]); if(form){form.removeAttribute('onsubmit');form.id='graphlair-contact-form';}
    }
  }

  function renderFooter(c) {
    const items=$$('.final-footer .wrap > div');
    if(items[0]) items[0].textContent=c.footer?.left||'';
    if(items[1]) items[1].textContent=c.footer?.middle||'';
    if(items[2]) items[2].textContent=c.footer?.right||'';
  }

  function applySections(c) {
    const mapping={manifesto:$('#manifesto'),impact:$('#impact'),work:$('#work'),world:$('#world'),awards:$('#awards'),team:$('#team'),clients:$('#clients'),quotes:$('#quotes'),contact:$('#contact')};
    const main=$('main'); const anchor=$('.kinetic');
    if(!main||!anchor) return;
    let last=anchor;
    (c.sections||[]).forEach(s=>{
      const el=mapping[s.id]; if(!el) return;
      el.style.display=s.visible===false?'none':'';
      last.after(el); last=el;
    });
  }

  function renderAll(c) {
    renderSiteMeta(c); renderLoader(c); renderNavigation(c); renderHero(c); renderPoster(c); renderKinetic(c);
    renderManifesto(c); renderImpact(c); renderProjects(c); renderNetwork(c); renderAwards(c); renderTeam(c); renderClients(c); renderTestimonials(c); renderContact(c); renderFooter(c); applySections(c);
  }

  function initLoader(c) {
    const loader=$('#loader'), bar=$('#loadBar'), count=$('#loadCount'), status=$('#loaderStatus');
    if(!loader||!bar||!count) return;
    let p=0,done=false;
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    $$('.scramble').forEach((el,idx)=>setTimeout(()=>{
      const final=el.dataset.text||el.textContent; let frame=0, total=18;
      const t=setInterval(()=>{const prog=frame/total;el.textContent=[...final].map((ch,i)=>ch===' '?' ':(i/final.length<prog?final[i]:chars[Math.floor(Math.random()*chars.length)])).join('');frame++;if(frame>total){clearInterval(t);el.textContent=final;}},38);
    },180+idx*100));
    const timer=setInterval(()=>{p=Math.min(100,p+Math.ceil(Math.random()*6));bar.style.width=p+'%';count.textContent=String(p).padStart(3,'0');if(status){if(p>58)status.textContent='ASSEMBLING MOTION SYSTEM';if(p>82)status.textContent='ALMOST THERE';}if(p>=100)clearInterval(timer);},55);
    function finish(){if(done)return;done=true;clearInterval(timer);bar.style.width='100%';count.textContent='100';if(status)status.textContent='ENTER THE LAIR';setTimeout(()=>{loader.classList.add('hide');document.body.classList.remove('lock');setTimeout(()=>loader.style.display='none',1050)},350)}
    setTimeout(finish,2200); window.addEventListener('load',()=>setTimeout(finish,100));
  }

  function initCursorAndMagnetic() {
    const cursor=$('#cursor'), dot=$('#cursorDot'); if(!cursor||!dot) return;
    let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my;
    addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY});
    (function loop(){cx+=(mx-cx)*.18;cy+=(my-cy)*.18;cursor.style.left=cx+'px';cursor.style.top=cy+'px';dot.style.left=mx+'px';dot.style.top=my+'px';requestAnimationFrame(loop)
  // Team-card navigation fallback
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.team-grid .member[data-member-href]');
    if (!card) return;
    const href = card.getAttribute('data-member-href');
    if (!href || href === '#') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    window.location.href = href;
  });

})();
    $$('a,.hover,.member,.case-media,.poster-swatch').forEach(el=>{el.addEventListener('mouseenter',()=>{cursor.classList.add('hot');cursor.dataset.label=el.dataset.label||''});el.addEventListener('mouseleave',()=>{cursor.classList.remove('hot');cursor.dataset.label=''})});
    $$('.magnetic').forEach(el=>{el.addEventListener('mousemove',e=>{const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.1}px,${(e.clientY-r.top-r.height/2)*.1}px)`});el.addEventListener('mouseleave',()=>el.style.transform='')});
  }

  function initReveal() {
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('show');io.unobserve(e.target)}}),{threshold:.12});
    $$('.reveal').forEach(el=>io.observe(el));
    const cio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('case-visible')}),{threshold:.18});
    $$('.reveal-case').forEach(el=>cio.observe(el));
    function parallax(){ $$('.case-media').forEach(media=>{const r=media.getBoundingClientRect();if(r.bottom>0&&r.top<innerHeight){const p=(r.top+r.height/2-innerHeight/2)/innerHeight;const art=$('.case-art',media);if(art)art.style.transform=`scale(1.045) translateY(${p*-24}px)`}})}
    addEventListener('scroll',parallax,{passive:true}); parallax();
  }

  function initCountersGraph(c) {
    const impact=$('#impact'); if(!impact) return;
    let started=false;
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!started){started=true;$$('.counter',impact).forEach(el=>{const target=+el.dataset.target,dur=1450,start=performance.now();function step(now){const q=Math.min(1,(now-start)/dur),ease=1-Math.pow(1-q,3);el.textContent=Math.floor(target*ease);if(q<1)requestAnimationFrame(step)}requestAnimationFrame(step)});const gc=$('#growthCard');if(gc){gc.classList.add('animate');$$('.bar-fill',gc).forEach((bar,i)=>setTimeout(()=>bar.style.height=(+bar.dataset.value)+'%',i*150));const read=$('#growthReadout'),target=+(read?.dataset.target||0),start=performance.now();function grow(now){const q=Math.min(1,(now-start)/1500),ease=1-Math.pow(1-q,3);if(read)read.textContent=Math.floor(target*ease);if(q<1)requestAnimationFrame(grow)}requestAnimationFrame(grow)}}}),{threshold:.35});
    io.observe(impact);
  }

  function initNetwork() {
    const canvas=$('#networkCanvas'); if(!canvas) return;
    let started=false;
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting&&!started){started=true;canvas.classList.add('network-live')}}),{threshold:.28});
    io.observe(canvas);
  }

  function initPoster(c) {
    const poster=$('#brandPoster'), lab=$('#posterLab'); if(!poster||!lab) return;
    const paletteById=id=>(c.poster.palettes||[]).find(x=>x.id===id);
    $$('.poster-swatch').forEach(btn=>btn.addEventListener('click',()=>{ $$('.poster-swatch').forEach(b=>b.classList.remove('active'));btn.classList.add('active');applyPosterPalette(paletteById(btn.dataset.palette));poster.animate([{transform:'scale(1)'},{transform:'scale(.975) rotateY(-2deg)',filter:'brightness(1.35)'},{transform:'scale(1)',filter:'brightness(1)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'}) }));
    lab.addEventListener('mousemove',e=>{const r=lab.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;poster.style.transform=`rotateY(${x*8}deg) rotateX(${-y*7}deg) translate(${x*5}px,${y*4}px)`});
    lab.addEventListener('mouseleave',()=>poster.style.transform='');
  }

  function initContact(c) {
    const form=$('#graphlair-contact-form'); if(!form) return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=$('.submit',form), inputs=$$('input',form), ta=$('textarea',form);
      const payload={name:inputs[0]?.value||'',email:inputs[1]?.value||'',company:inputs[2]?.value||'',message:ta?.value||'',page_url:location.href,user_agent:navigator.userAgent};
      if(btn){btn.disabled=true;btn.textContent='Sending…'}
      try{
        if(!sb) throw new Error('CMS connection unavailable');
        const {error}=await sb.from('contact_messages').insert(payload); if(error) throw error;
        form.reset(); if(btn)btn.textContent=c.contact.successMessage||'Sent ✓';
      }catch(err){console.error(err);if(btn)btn.textContent=c.contact.errorMessage||'Try again';}
      finally{setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent=c.contact.submitLabel||'Send enquiry ↗'}},2600)}
    });
  }

  function addDynamicStyles(){
    const style=document.createElement('style');
    style.textContent=`.header-logo{height:34px;width:auto;display:block}.member-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.92);transition:transform .6s ease}.member:hover .member-photo{transform:scale(1.035)}.client-item{display:flex;align-items:center;justify-content:center;min-width:220px;height:70px;margin:0 24px}.client-item img{max-width:180px;max-height:44px;object-fit:contain;filter:grayscale(1) contrast(1.1)}.award-row{position:relative;grid-template-columns:80px 1.3fr .7fr auto 32px}.award-media{width:78px;height:52px;overflow:hidden;justify-self:end}.award-media img{width:100%;height:100%;object-fit:cover}.network-shape{position:absolute;z-index:0;pointer-events:none;background:var(--shape-fill);border:var(--shape-border) solid var(--shape-color)}.network-shape.ns-circle{border-radius:50%}.network-shape.ns-cross{background:transparent}.network-shape.ns-cross:before,.network-shape.ns-cross:after{content:'';position:absolute;background:var(--shape-color);left:50%;top:50%;transform:translate(-50%,-50%)}.network-shape.ns-cross:before{width:100%;height:1px}.network-shape.ns-cross:after{width:1px;height:100%}.country-label:before{background:var(--country-color,#fff)}.cms-poster-shape{position:absolute;z-index:2;transition:background .5s,border-color .5s}`;
    document.head.appendChild(style);
  }

  async function boot() {
    addDynamicStyles();
    content=await loadContent();
    renderAll(content);
    window.GRAPHLAIR_CONTENT=content;
    initLoader(content); initCursorAndMagnetic(); initReveal(); initCountersGraph(content); initNetwork(); initPoster(content); initContact(content);
    document.dispatchEvent(new CustomEvent('graphlair:ready',{detail:{content}}));
  }

  document.addEventListener('DOMContentLoaded', boot, {once:true});
})();
