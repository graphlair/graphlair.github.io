import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as THREE from 'https://esm.sh/three@0.181.0';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.querySelector('#app');
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

// Auto-detects GitHub Pages project subpaths. Example:
// user.github.io/graphlair/app.js => APP_BASE = /graphlair
// graphlair.com/app.js          => APP_BASE = ''
const APP_BASE = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
localStorage.setItem('graphlair_app_base', APP_BASE);
const requested = sessionStorage.getItem('graphlair_requested_path');
if (requested) {
  sessionStorage.removeItem('graphlair_requested_path');
  history.replaceState({}, '', requested);
}

function stripBase(pathname){
  let p = pathname || '/';
  if (APP_BASE && p.startsWith(APP_BASE)) p = p.slice(APP_BASE.length) || '/';
  return p;
}
const currentPath = () => decodeURIComponent(stripBase(location.pathname).replace(/^\/+|\/+$/g, ''));
function internalHref(url='/'){
  if (!url) return '#';
  if (/^(https?:|mailto:|tel:|#)/i.test(url)) return url;
  if (url.startsWith('/')) return `${APP_BASE}${url}` || '/';
  return `${APP_BASE}/${url}`;
}

async function loadSettings(){
  const { data } = await supabase.from('site_settings').select('*').eq('id',1).maybeSingle();
  return data || {};
}
function applyTheme(s){
  const r=document.documentElement;
  r.style.setProperty('--bg',s.background_color||'#050806');
  r.style.setProperty('--card',s.card_color||'#0b100d');
  r.style.setProperty('--accent',s.primary_color||'#7df46a');
  r.style.setProperty('--text',s.text_color||'#f7faf7');
  r.style.setProperty('--muted',s.muted_color||'#89918c');
  if(s.favicon_url) document.querySelector('#site-favicon').href=s.favicon_url;
  document.title=s.site_name||'Graphlair';
}
async function loadNav(){
  const {data=[]}=await supabase.from('navigation_items').select('*').eq('is_visible',true).order('sort_order');
  return data;
}
function headerHtml(s,nav){
  const logo=s.logo_url?`<img src="${esc(s.logo_url)}" alt="${esc(s.site_name||'Graphlair')}">`:`<span class="brand-mark">G</span>`;
  const links=nav.map(n=>`<a class="${n.is_cta?'nav-cta':''}" href="${esc(internalHref(n.url))}" ${n.open_new_tab?'target="_blank" rel="noopener"':''}>${esc(n.label)}</a>`).join('');
  return `<header class="site-header"><div class="nav-pill"><a class="brand" href="${esc(internalHref('/'))}">${logo}<span>${esc(s.site_name||'Graphlair')}</span></a><nav class="nav-links">${links}</nav><button class="menu-toggle" aria-label="Menu">☰</button><nav class="mobile-menu">${links}</nav></div></header>`;
}
function footerHtml(s){
  const logo=s.logo_url?`<img src="${esc(s.logo_url)}" alt="" style="width:28px;height:28px;object-fit:contain">`:`<span class="brand-mark" style="width:28px;height:28px">G</span>`;
  return `<footer class="footer"><div class="shell footer-row"><div class="brand">${logo}<span>${esc(s.site_name||'Graphlair')}</span></div><div>${esc(s.footer_text||`© ${new Date().getFullYear()} Graphlair. ${s.tagline||''}`)}</div></div></footer>`;
}

function highlightTitle(title=''){
  const words=esc(title).split(' ');
  if(words.length<2) return words.join(' ');
  const last=words.pop();
  return `${words.join(' ')} <span class="accent">${last}</span>`;
}
function sectionHtml(section,members=[]){
  const c=section.content||{};
  const type=section.section_type;
  if(type==='hero') return `<section class="shell hero section reveal"><div class="hero-copy"><div class="eyebrow">${esc(c.eyebrow||'Enter the Lair')}</div><h1>${c.accent_last_word===false?esc(c.title||section.title||''):highlightTitle(c.title||section.title||'')}</h1><p>${esc(c.description||'')}</p><div class="actions">${c.primary_text?`<a class="btn primary" href="${esc(internalHref(c.primary_url||'#'))}">${esc(c.primary_text)} <span>↗</span></a>`:''}${c.secondary_text?`<a class="btn" href="${esc(internalHref(c.secondary_url||'#'))}">${esc(c.secondary_text)}</a>`:''}</div></div><div class="hero-stage" data-3d-stage>${c.image_url?`<img class="hero-image" src="${esc(c.image_url)}" alt="">`:''}<div class="hero-float one"><strong>${esc(c.float_title||'GRAPHLAIR')}</strong>${esc(c.float_text||'Design × Technology')}</div><div class="hero-float two"><strong>INTERACTIVE / 3D</strong>Move your cursor</div></div></section>`;
  if(type==='marquee'){
    const items=(c.items||['Branding','Graphic Design','Creative Tech','Digital Experiences']);
    const once=items.map(x=>`<span>${esc(x)} <b>✦</b></span>`).join('');
    return `<section class="marquee reveal"><div class="marquee-track">${once}${once}</div></section>`;
  }
  if(type==='manifesto'||type==='text') return `<section class="shell manifesto section reveal"><div class="kicker">${esc(c.kicker||section.title||'Our point of view')}</div><h2 class="display">${esc(c.title||section.title||'').replace(/\[(.*?)\]/g,'<span>$1</span>')}</h2><p class="muted-copy">${esc(c.text||'')}</p></section>`;
  if(type==='cards'||type==='services') return `<section id="${type==='services'?'services':'work'}" class="shell section reveal"><div class="section-head"><div><div class="kicker">${esc(c.kicker||'What we do')}</div><h2>${esc(section.title||c.title||'Built to stand out.')}</h2></div>${c.description?`<p>${esc(c.description)}</p>`:''}</div><div class="grid">${(c.items||[]).map((i,idx)=>`<article class="card tilt-card"><span class="card-index">0${idx+1}</span><h3>${esc(i.title||'')}</h3><p>${esc(i.text||'')}</p>${i.url?`<a href="${esc(internalHref(i.url))}">Explore ↗</a>`:''}</article>`).join('')}</div></section>`;
  if(type==='image_text') return `<section class="shell section split reveal"><div class="split-media">${c.image_url?`<img src="${esc(c.image_url)}" alt="">`:''}</div><div><div class="kicker">${esc(c.kicker||section.title||'')}</div><h2>${esc(c.title||section.title||'')}</h2><p>${esc(c.text||'')}</p>${c.button_text?`<div class="actions"><a class="btn primary" href="${esc(internalHref(c.button_url||'#'))}">${esc(c.button_text)} ↗</a></div>`:''}</div></section>`;
  if(type==='stats') return `<section class="shell section stats reveal">${(c.items||[]).map(i=>`<div class="stat"><strong>${esc(i.value||'')}</strong><span>${esc(i.title||'')}</span></div>`).join('')}</section>`;
  if(type==='team') return `<section class="shell section reveal" id="team"><div class="section-head"><div><div class="kicker">${esc(c.kicker||'People in the lair')}</div><h2>${esc(section.title||c.title||'Meet the team.')}</h2></div>${c.description?`<p>${esc(c.description)}</p>`:''}</div><div class="team-grid">${members.map(m=>`<a class="member-card" href="${esc(internalHref(`/${m.slug}`))}"><div class="member-photo">${m.profile_image?`<img src="${esc(m.profile_image)}" alt="${esc(m.name)}">`:''}</div><div class="member-info"><h3>${esc(m.name)}</h3><p>${esc(m.role||'')}</p></div></a>`).join('')}</div></section>`;
  if(type==='gallery') return `<section id="work" class="shell section reveal"><div class="section-head"><div><div class="kicker">${esc(c.kicker||'Selected visuals')}</div><h2>${esc(section.title||c.title||'In the wild.')}</h2></div></div><div class="gallery">${(c.images||[]).map(x=>`<figure><img src="${esc(typeof x==='string'?x:x.url)}" alt="${esc(typeof x==='string'?'':x.alt||'')}"></figure>`).join('')}</div></section>`;
  if(type==='cta') return `<section class="shell cta reveal"><div class="cta-box"><div class="kicker">${esc(c.kicker||'Next move')}</div><h2>${esc(c.title||section.title||'Have an idea?')}</h2><p>${esc(c.text||'Let’s turn it into something people remember.')}</p>${c.button_text?`<div class="actions" style="justify-content:center"><a class="btn primary" href="${esc(internalHref(c.button_url||'#'))}">${esc(c.button_text)} ↗</a></div>`:''}</div></section>`;
  return '';
}

function init3D(){
  const stage=document.querySelector('[data-3d-stage]');
  if(!stage||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(0,.1,8.4);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  stage.prepend(renderer.domElement);
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#7df46a';
  const green=new THREE.Color(accent), dark=new THREE.Color('#08110b');
  const group=new THREE.Group(); scene.add(group);

  const glass=new THREE.MeshPhysicalMaterial({color:dark,metalness:.2,roughness:.18,transmission:.25,transparent:true,opacity:.88,emissive:green,emissiveIntensity:.045,clearcoat:1,clearcoatRoughness:.16});
  const edge=new THREE.MeshBasicMaterial({color:green,wireframe:true,transparent:true,opacity:.25});
  const panelGeo=new THREE.BoxGeometry(2.45,3.55,.12,6,8,1);
  const center=new THREE.Mesh(panelGeo,glass); center.position.set(.2,.05,.2); center.rotation.set(-.07,-.04,.02); group.add(center);
  const centerWire=new THREE.Mesh(panelGeo,edge); centerWire.position.copy(center.position); centerWire.rotation.copy(center.rotation); centerWire.scale.set(1.015,1.015,1.1); group.add(centerWire);
  const left=new THREE.Mesh(new THREE.BoxGeometry(2.0,2.95,.1),glass.clone()); left.position.set(-2.15,.1,-.45); left.rotation.set(.08,.48,-.08); left.material.opacity=.68; group.add(left);
  const right=new THREE.Mesh(new THREE.BoxGeometry(1.9,2.75,.1),glass.clone()); right.position.set(2.15,-.15,-.7); right.rotation.set(-.08,-.5,.09); right.material.opacity=.62; group.add(right);

  const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.62,.15,120,16),new THREE.MeshStandardMaterial({color:green,metalness:.72,roughness:.22,emissive:green,emissiveIntensity:.22}));
  knot.position.set(.3,.2,1.05); knot.rotation.x=.4; group.add(knot);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(2.7,.018,10,220),new THREE.MeshBasicMaterial({color:green,transparent:true,opacity:.55})); halo.rotation.x=1.15; group.add(halo);
  const halo2=halo.clone();halo2.scale.set(.78,.78,.78);halo2.rotation.set(.25,.9,.4);halo2.material=halo.material.clone();halo2.material.opacity=.28;group.add(halo2);

  for(let i=0;i<9;i++){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.05,.34+Math.random()*.65,.05),new THREE.MeshBasicMaterial({color:green,transparent:true,opacity:.35+Math.random()*.4}));
    const a=(i/9)*Math.PI*2, r=2.8+Math.random()*.65;bar.position.set(Math.cos(a)*r,Math.sin(a)*r*.72,(Math.random()-.5)*1.4);bar.rotation.z=-a;group.add(bar);
  }
  const particlesGeo=new THREE.BufferGeometry(), count=760, pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){const r=3.1+Math.random()*2.9,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);pos[i*3]=r*Math.sin(phi)*Math.cos(theta);pos[i*3+1]=r*Math.sin(phi)*Math.sin(theta);pos[i*3+2]=r*Math.cos(phi)}
  particlesGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const points=new THREE.Points(particlesGeo,new THREE.PointsMaterial({color:green,size:.018,transparent:true,opacity:.62}));scene.add(points);
  scene.add(new THREE.AmbientLight(0xffffff,1.25));
  const key=new THREE.PointLight(green,22,18);key.position.set(3.5,4.2,5);scene.add(key);
  const fill=new THREE.PointLight(0xffffff,7,14);fill.position.set(-4,-2,4);scene.add(fill);

  let tx=0,ty=0,px=0,py=0;
  stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();tx=((e.clientX-r.left)/r.width-.5);ty=((e.clientY-r.top)/r.height-.5)});
  stage.addEventListener('pointerleave',()=>{tx=0;ty=0});
  function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  new ResizeObserver(resize).observe(stage);resize();
  let t=0;function animate(){t+=.008;px+=(tx-px)*.035;py+=(ty-py)*.035;group.rotation.y=px*.5+Math.sin(t*.35)*.06;group.rotation.x=-py*.35+Math.sin(t*.27)*.025;group.position.y=Math.sin(t)*.08;knot.rotation.x+=.007;knot.rotation.y+=.01;halo.rotation.z+=.0024;halo2.rotation.y-=.0035;points.rotation.y+=.00055;points.rotation.x=Math.sin(t*.2)*.05;renderer.render(scene,camera);requestAnimationFrame(animate)}animate();
}
function initInteractions(){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in')}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  document.querySelectorAll('.tilt-card').forEach(card=>{card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(900px) rotateX(${-y*7}deg) rotateY(${x*9}deg) translateY(-4px)`});card.addEventListener('pointerleave',()=>card.style.transform='')});
  const dot=document.querySelector('.cursor-dot'),ring=document.querySelector('.cursor-ring');if(matchMedia('(pointer:fine)').matches){addEventListener('pointermove',e=>{dot.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;ring.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;document.documentElement.style.setProperty('--mx',e.clientX+'px');document.documentElement.style.setProperty('--my',e.clientY+'px')});document.querySelectorAll('a,button,.card').forEach(x=>{x.addEventListener('mouseenter',()=>document.body.classList.add('cursor-hover'));x.addEventListener('mouseleave',()=>document.body.classList.remove('cursor-hover'))})}
  const toggle=document.querySelector('.menu-toggle'),mobile=document.querySelector('.mobile-menu');if(toggle&&mobile)toggle.onclick=()=>mobile.classList.toggle('open');
}

async function renderMember(member,s,nav){
  app.innerHTML=`${headerHtml(s,nav)}<main><section class="shell profile-hero reveal"><div><div class="profile-role">${esc(member.role||'Graphlair')}</div><h1>${esc(member.name)}</h1><p class="profile-bio">${esc(member.full_bio||member.short_bio||'')}</p><div class="social-row">${member.linkedin?`<a class="btn" target="_blank" href="${esc(member.linkedin)}">LinkedIn ↗</a>`:''}${member.github?`<a class="btn" target="_blank" href="${esc(member.github)}">GitHub ↗</a>`:''}${member.website?`<a class="btn primary" target="_blank" href="${esc(member.website)}">Website ↗</a>`:''}</div></div><div class="profile-portrait">${member.profile_image?`<img src="${esc(member.profile_image)}" alt="${esc(member.name)}">`:''}</div></section></main>${footerHtml(s)}`;
  initInteractions();setTimeout(()=>document.querySelector('.reveal')?.classList.add('in'),50);
}
function scrollAfterRender(hash=''){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(hash){ const el=document.querySelector(hash); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }
    else scrollTo(0,0);
  }));
}
function installSpaNavigation(){
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]'); if(!a||a.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    const raw=a.getAttribute('href'); if(!raw||raw.startsWith('mailto:')||raw.startsWith('tel:')||raw.startsWith('#')) return;
    const u=new URL(a.href,location.href); if(u.origin!==location.origin) return;
    if(APP_BASE && !u.pathname.startsWith(APP_BASE)) return;
    e.preventDefault();
    history.pushState({},'',u.pathname+u.search+u.hash);
    render().then(()=>scrollAfterRender(u.hash));
  });
  addEventListener('popstate',()=>render().then(()=>scrollAfterRender(location.hash)));
}
installSpaNavigation();

async function render(){
  try{
    const [s,nav,membersRes]=await Promise.all([loadSettings(),loadNav(),supabase.from('team_members').select('*').eq('is_visible',true).order('sort_order')]);
    applyTheme(s); const members=membersRes.data||[]; const path=currentPath();
    if(path){
      const member=members.find(m=>m.slug===path); if(member){renderMember(member,s,nav);return;}
    }
    let q=supabase.from('pages').select('*,page_sections(*)').eq('status','published'); q=path?q.eq('slug',path):q.eq('is_home',true); const {data:pages=[]}=await q.limit(1); const page=pages[0];
    if(!page){app.innerHTML=`${headerHtml(s,nav)}<main class="not-found"><div><h1>404</h1><p>That path wandered outside the lair.</p><a class="btn primary" href="${esc(internalHref('/'))}">Back home ↗</a></div></main>${footerHtml(s)}`;initInteractions();return;}
    const sections=(page.page_sections||[]).filter(x=>x.is_visible).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    app.innerHTML=`${headerHtml(s,nav)}<main>${sections.map(x=>sectionHtml(x,members)).join('')}</main>${footerHtml(s)}`;
    init3D();initInteractions();
  }catch(err){console.error(err);app.innerHTML=`<div class="not-found"><div><h1>!</h1><p>Could not connect to Graphlair CMS. Check config.js and Supabase.</p></div></div>`}
}
render().then(()=>scrollAfterRender(location.hash));
