import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.querySelector('#admin-app');
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function isAdmin(user){ if(!user) return false; const {data}=await supabase.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle(); return !!data; }

function loginView(msg=''){
 root.innerHTML=`<div class="admin-shell center"><form id="login" class="panel login"><h1>Graphlair Admin</h1>${msg?`<p class="error">${esc(msg)}</p>`:''}<label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button class="btn primary">Login</button></form></div>`;
 document.querySelector('#login').onsubmit=async e=>{e.preventDefault(); const f=new FormData(e.target); const {data,error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')}); if(error) return loginView(error.message); if(!(await isAdmin(data.user))){await supabase.auth.signOut(); return loginView('This account is not an admin.');} dashboard();};
}

async function upload(file, folder='media'){
 const safe=(Date.now()+'-'+file.name).replace(/[^a-zA-Z0-9._-]/g,'-'); const path=`${folder}/${safe}`;
 const {error}=await supabase.storage.from('media').upload(path,file,{upsert:false}); if(error) throw error;
 return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

async function dashboard(){
 const {data:{user}}=await supabase.auth.getUser(); if(!(await isAdmin(user))) return loginView();
 const [{data:s},{data:members=[]},{data:nav=[]},{data:pages=[]}] = await Promise.all([
   supabase.from('site_settings').select('*').eq('id',1).maybeSingle(),
   supabase.from('team_members').select('*').order('sort_order'),
   supabase.from('navigation_items').select('*').order('sort_order'),
   supabase.from('pages').select('*').order('title')
 ]);
 root.innerHTML=`<div class="admin-shell"><aside><h2>GRAPHLair</h2><button data-tab="brand">Brand</button><button data-tab="members">Members</button><button data-tab="nav">Menu</button><button data-tab="pages">Pages</button><button id="logout">Sign out</button></aside><main id="panel"></main></div>`;
 document.querySelector('#logout').onclick=async()=>{await supabase.auth.signOut();loginView();};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>show(b.dataset.tab));
 const panel=document.querySelector('#panel');

 function show(tab){
  if(tab==='brand'){
   panel.innerHTML=`<section class="panel"><h1>Brand & Theme</h1><form id="brand-form"><label>Site name<input name="site_name" value="${esc(s?.site_name||'Graphlair')}"></label><label>Tagline<input name="tagline" value="${esc(s?.tagline||'')}"></label><label>Logo URL<input name="logo_url" value="${esc(s?.logo_url||'')}"></label><label>Upload logo<input id="logo-file" type="file" accept="image/*"></label><div class="form-grid"><label>Primary<input name="primary_color" value="${esc(s?.primary_color||'#7df46a')}"></label><label>Background<input name="background_color" value="${esc(s?.background_color||'#050806')}"></label><label>Card<input name="card_color" value="${esc(s?.card_color||'#0b100d')}"></label><label>Text<input name="text_color" value="${esc(s?.text_color||'#f7faf7')}"></label></div><label>Footer text<input name="footer_text" value="${esc(s?.footer_text||'')}"></label><button class="btn primary">Save</button></form></section>`;
   document.querySelector('#brand-form').onsubmit=async e=>{e.preventDefault(); const f=new FormData(e.target); let logo=f.get('logo_url'); const file=document.querySelector('#logo-file').files[0]; if(file) logo=await upload(file,'logos'); const payload=Object.fromEntries(f.entries()); payload.logo_url=logo; delete payload['']; const {error}=await supabase.from('site_settings').upsert({id:1,...payload}); alert(error?error.message:'Saved'); dashboard();};
  }
  if(tab==='members'){
   panel.innerHTML=`<section class="panel"><div class="row"><h1>Members</h1><button id="add-member" class="btn primary">+ Add</button></div><div class="list">${members.map(m=>`<div class="list-row"><div><strong>${esc(m.name)}</strong><small>/${esc(m.slug)} · ${esc(m.role||'')}</small></div><button data-edit-member="${m.id}">Edit</button><button data-del-member="${m.id}">Delete</button></div>`).join('')}</div></section>`;
   document.querySelector('#add-member').onclick=()=>memberForm(); document.querySelectorAll('[data-edit-member]').forEach(b=>b.onclick=()=>memberForm(members.find(x=>x.id===b.dataset.editMember))); document.querySelectorAll('[data-del-member]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this member?')){await supabase.from('team_members').delete().eq('id',b.dataset.delMember);dashboard();}});
  }
  if(tab==='nav'){
   panel.innerHTML=`<section class="panel"><div class="row"><h1>Navigation</h1><button id="add-nav" class="btn primary">+ Add</button></div>${nav.map(n=>`<form class="inline nav-form" data-id="${n.id}"><input name="label" value="${esc(n.label)}"><input name="url" value="${esc(n.url)}"><input name="sort_order" type="number" value="${n.sort_order||0}"><label><input name="is_visible" type="checkbox" ${n.is_visible?'checked':''}> Visible</label><button>Save</button><button type="button" data-delete-nav="${n.id}">Delete</button></form>`).join('')}</section>`;
   document.querySelector('#add-nav').onclick=async()=>{await supabase.from('navigation_items').insert({label:'New link',url:'/',sort_order:99,is_visible:true});dashboard();}; document.querySelectorAll('.nav-form').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const fd=new FormData(f);await supabase.from('navigation_items').update({label:fd.get('label'),url:fd.get('url'),sort_order:+fd.get('sort_order'),is_visible:fd.get('is_visible')==='on'}).eq('id',f.dataset.id);alert('Saved');}); document.querySelectorAll('[data-delete-nav]').forEach(b=>b.onclick=async()=>{if(confirm('Delete menu item?')){await supabase.from('navigation_items').delete().eq('id',b.dataset.deleteNav);dashboard();}});
  }
  if(tab==='pages'){
   panel.innerHTML=`<section class="panel"><div class="row"><h1>Pages</h1><button id="add-page" class="btn primary">+ Add page</button></div>${pages.map(p=>`<div class="list-row"><div><strong>${esc(p.title)}</strong><small>/${esc(p.slug||'')} · ${esc(p.status)}</small></div><button data-sections="${p.id}">Sections</button></div>`).join('')}</section>`;
   document.querySelector('#add-page').onclick=()=>pageForm(); document.querySelectorAll('[data-sections]').forEach(b=>b.onclick=()=>sectionManager(pages.find(p=>p.id===b.dataset.sections)));
  }
 }

 function memberForm(m={}){panel.innerHTML=`<section class="panel"><h1>${m.id?'Edit':'Add'} Member</h1><form id="member-form"><label>Name<input name="name" required value="${esc(m.name||'')}"></label><label>Slug / URL<input name="slug" required pattern="[a-z0-9-]+" value="${esc(m.slug||'')}"></label><label>Role<input name="role" value="${esc(m.role||'')}"></label><label>Short bio<textarea name="short_bio">${esc(m.short_bio||'')}</textarea></label><label>Full bio<textarea name="full_bio">${esc(m.full_bio||'')}</textarea></label><label>Photo URL<input name="profile_image" value="${esc(m.profile_image||'')}"></label><label>Upload photo<input id="member-photo" type="file" accept="image/*"></label><label>LinkedIn<input name="linkedin" value="${esc(m.linkedin||'')}"></label><label>GitHub<input name="github" value="${esc(m.github||'')}"></label><label>Website<input name="website" value="${esc(m.website||'')}"></label><label><input name="is_visible" type="checkbox" ${m.is_visible!==false?'checked':''}> Visible</label><button class="btn primary">Save</button></form></section>`; document.querySelector('#member-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);let image=fd.get('profile_image');const file=document.querySelector('#member-photo').files[0];if(file)image=await upload(file,'members');const payload={name:fd.get('name'),slug:fd.get('slug').toLowerCase(),role:fd.get('role'),short_bio:fd.get('short_bio'),full_bio:fd.get('full_bio'),profile_image:image,linkedin:fd.get('linkedin'),github:fd.get('github'),website:fd.get('website'),is_visible:fd.get('is_visible')==='on'};const q=m.id?supabase.from('team_members').update(payload).eq('id',m.id):supabase.from('team_members').insert(payload);const {error}=await q;if(error)alert(error.message);else dashboard();}; }

 function pageForm(){panel.innerHTML=`<section class="panel"><h1>Add Page</h1><form id="page-form"><label>Title<input name="title" required></label><label>Slug<input name="slug" pattern="[a-z0-9-]*"></label><label><input name="is_home" type="checkbox"> Homepage</label><button class="btn primary">Create</button></form></section>`;document.querySelector('#page-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const {error}=await supabase.from('pages').insert({title:fd.get('title'),slug:fd.get('slug').toLowerCase(),is_home:fd.get('is_home')==='on',status:'published'});if(error)alert(error.message);else dashboard();};}

 async function sectionManager(page){const {data:secs=[]}=await supabase.from('page_sections').select('*').eq('page_id',page.id).order('sort_order');panel.innerHTML=`<section class="panel"><div class="row"><h1>${esc(page.title)} Sections</h1><button id="add-sec" class="btn primary">+ Add</button></div>${secs.map(s=>`<div class="list-row"><div><strong>${esc(s.title||s.section_type)}</strong><small>${esc(s.section_type)} · order ${s.sort_order}</small></div><button data-edit-sec="${s.id}">Edit</button><button data-del-sec="${s.id}">Delete</button></div>`).join('')}</section>`;document.querySelector('#add-sec').onclick=()=>sectionForm(page);document.querySelectorAll('[data-edit-sec]').forEach(b=>b.onclick=()=>sectionForm(page,secs.find(x=>x.id===b.dataset.editSec)));document.querySelectorAll('[data-del-sec]').forEach(b=>b.onclick=async()=>{if(confirm('Delete section?')){await supabase.from('page_sections').delete().eq('id',b.dataset.delSec);sectionManager(page);}});}

 function sectionForm(page,s={}){panel.innerHTML=`<section class="panel"><h1>${s.id?'Edit':'Add'} Section</h1><p>For cards/stats, edit JSON directly. This keeps the no-build version simple.</p><form id="sec-form"><label>Type<select name="section_type">${['hero','text','image_text','cards','stats','cta'].map(t=>`<option ${s.section_type===t?'selected':''}>${t}</option>`).join('')}</select></label><label>Title<input name="title" value="${esc(s.title||'')}"></label><label>Order<input type="number" name="sort_order" value="${s.sort_order||0}"></label><label>Content JSON<textarea name="content" rows="16">${esc(JSON.stringify(s.content||{},null,2))}</textarea></label><label><input name="is_visible" type="checkbox" ${s.is_visible!==false?'checked':''}> Visible</label><button class="btn primary">Save</button></form></section>`;document.querySelector('#sec-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);let content;try{content=JSON.parse(fd.get('content')||'{}')}catch{alert('Invalid JSON');return}const payload={page_id:page.id,section_type:fd.get('section_type'),title:fd.get('title'),sort_order:+fd.get('sort_order'),content,is_visible:fd.get('is_visible')==='on'};const {error}=s.id?await supabase.from('page_sections').update(payload).eq('id',s.id):await supabase.from('page_sections').insert(payload);if(error)alert(error.message);else sectionManager(page);};}
 show('brand');
}

supabase.auth.onAuthStateChange(()=>{});
const {data:{session}}=await supabase.auth.getSession(); session?dashboard():loginView();
