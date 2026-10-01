(() => {
  'use strict';
  const cfg = window.GRAPHLAIR_CONFIG || {};
  const DEFAULTS = window.GRAPHLAIR_DEFAULT_CONTENT || {};
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o || {}));
  const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  let content = clone(DEFAULTS);
  let activeTab = 'site';
  let dirty = false;
  let currentUser = null;

  function deepMerge(base, extra){
    if(Array.isArray(base)) return Array.isArray(extra)?clone(extra):clone(base);
    if(base && typeof base==='object'){
      const out={...base};
      if(extra && typeof extra==='object' && !Array.isArray(extra)) for(const [k,v] of Object.entries(extra)) out[k]=(k in base)?deepMerge(base[k],v):clone(v);
      return out;
    }
    return extra===undefined||extra===null?base:extra;
  }

  function pathParts(path){ return String(path).split('.').map(x=>/^\d+$/.test(x)?Number(x):x); }
  function getPath(path){ let o=content; for(const p of pathParts(path)){ if(o==null)return undefined; o=o[p]; } return o; }
  function setPath(path,value){ const parts=pathParts(path); let o=content; for(let i=0;i<parts.length-1;i++){const key=parts[i];if(o[key]==null)o[key]=typeof parts[i+1]==='number'?[]:{};o=o[key];}o[parts.at(-1)]=value;markDirty(); }
  function getArray(path){ const a=getPath(path); return Array.isArray(a)?a:[]; }
  function getParentArray(path){ const parts=pathParts(path); const idx=parts.pop(); let o=content; parts.forEach(p=>o=o[p]); return {arr:o,idx}; }

  const tabs=[
    ['site','Site + SEO'],['navigation','Navigation'],['home','Home'],['poster','Poster Lab'],['impact','Numbers + Graph'],['projects','Projects'],['network','Global Network'],['awards','Awards'],['team','Team'],['clients','Clients'],['testimonials','Testimonials'],['contact','Contact + Footer'],['sections','Sections'],['messages','Messages'],['advanced','Advanced JSON']
  ];

  const tabHelp={
    site:'Page title, SEO and Graphlair brand colour.',navigation:'Menu names and links.',home:'Loader, hero text, buttons and manifesto.',poster:'Every poster word, palette and shape.',impact:'Animated counters and growing graph.',projects:'Highlighted projects, links and images.',network:'Country names, curved lines, hub and decorative shapes.',awards:'Awards and recognition rows.',team:'Team names, roles, bios, photos and links.',clients:'Client names, logos and links.',testimonials:'Client quotes.',contact:'Contact information, form text and footer.',sections:'Show, hide and reorder page sections.',messages:'Messages submitted through the public contact form.',advanced:'Full CMS JSON. Backup or edit everything at once.'
  };

  const templates={
    navigation:{label:'New link',href:'#'},
    'hero.titleLines':{text:'NEW LINE',accent:false},
    'poster.palettes':{id:'new',label:'NEW',accent:'#98FC1C',accent2:'#C5FF77',bg:'#090909',fg:'#F5F5EF',glow:'rgba(152,252,28,.20)'},
    'poster.shapes':{type:'rect',x:50,y:50,width:15,height:10,rotate:0,filled:true,borderWidth:0,opacity:1},
    'manifesto.titleLines':{text:'NEW LINE',accent:false},
    'manifesto.pillars':{number:'05',label:'New Pillar'},
    'impact.metrics':{value:0,suffix:'+',label:'New Metric',description:''},
    'impact.graph.bars':{label:'Q5',value:50},
    'projects.items':{eyebrow:'05 / PROJECT',title:'New Project',tags:'Design · Digital',description:'Project description.',image:'',link:'#',reverse:false},
    'network.countries':{name:'NEW COUNTRY',index:'13',x:50,y:20,curveX:50,curveY:35,color:'#FFFFFF',lineColor:'rgba(255,255,255,.46)',animated:true},
    'network.shapes':{type:'circle',x:50,y:50,width:6,height:6,rotation:0,color:'#98FC1C',opacity:.2,filled:false,borderWidth:1},
    'awards.items':{year:'2026',title:'New Recognition',category:'Category',link:'#',image:''},
    'team.members':{name:'New Member',role:'Role',bio:'Short bio.',initials:'NM',code:'GL / 07',image:'',link:''},
    'clients.items':{name:'New Client',logo:'',link:'#'},
    'testimonials.items':{quote:'Client quote.',name:'Client name',roleCompany:'Role / Company'},
    sections:{id:'custom',label:'Custom',visible:true}
  };

  function toast(text,type='good'){
    const el=$('#toast'); el.textContent=text; el.className=`toast ${type} show`; setTimeout(()=>el.classList.remove('show'),2600);
  }
  function markDirty(){dirty=true;$('#saveState').textContent='Unsaved changes';}
  function markSaved(){dirty=false;$('#saveState').textContent='Saved';}

  function input(path,label,type='text',extra={}){
    const v=getPath(path);
    if(type==='textarea') return `<div class="field"><label>${esc(label)}</label><textarea data-path="${esc(path)}" ${extra.rows?`style="min-height:${extra.rows*24}px"`:''}>${esc(v??'')}</textarea></div>`;
    if(type==='checkbox') return `<label class="checkbox-row"><input type="checkbox" data-path="${esc(path)}" ${v?'checked':''}> <span>${esc(label)}</span></label>`;
    if(type==='select') return `<div class="field"><label>${esc(label)}</label><select data-path="${esc(path)}">${(extra.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(v)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    if(type==='color') return `<div class="field"><label>${esc(label)}</label><div class="color-field"><input type="color" data-color-path="${esc(path)}" value="${/^#[0-9a-f]{6}$/i.test(v||'')?esc(v):'#98FC1C'}"><input type="text" data-path="${esc(path)}" value="${esc(v??'')}"></div></div>`;
    if(type==='image'){
      const src=String(v||'');
      return `<div class="field"><label>${esc(label)}</label><div class="image-row"><input type="text" data-path="${esc(path)}" value="${esc(src)}" placeholder="Image URL"><button class="secondary tiny" type="button" data-upload-path="${esc(path)}">Upload</button></div>${src?`<img class="preview-img" src="${esc(src)}" alt="preview">`:''}</div>`;
    }
    return `<div class="field"><label>${esc(label)}</label><input type="${type}" data-path="${esc(path)}" value="${esc(v??'')}" ${extra.min!==undefined?`min="${extra.min}"`:''} ${extra.max!==undefined?`max="${extra.max}"`:''} ${extra.step!==undefined?`step="${extra.step}"`:''}></div>`;
  }

  function actions(path,index){
    return `<div class="row-actions"><button class="secondary tiny" data-array-action="up" data-array-path="${esc(path)}" data-index="${index}">↑</button><button class="secondary tiny" data-array-action="down" data-array-path="${esc(path)}" data-index="${index}">↓</button><button class="danger tiny" data-array-action="remove" data-array-path="${esc(path)}" data-index="${index}">Delete</button></div>`;
  }

  function arrayEditor(path,title,fields,labelFn){
    const arr=getArray(path);
    return `<div class="toolbar"><h3>${esc(title)} <span class="muted">(${arr.length})</span></h3><button class="secondary tiny" data-add-array="${esc(path)}">+ Add</button></div>`+
      (arr.length?arr.map((item,i)=>`<div class="array-card"><div class="array-top"><strong>${esc(labelFn?labelFn(item,i):`${title} ${i+1}`)}</strong>${actions(path,i)}</div><div class="grid2">${fields.map(f=>input(`${path}.${i}.${f.key}`,f.label,f.type||'text',f)).join('')}</div></div>`).join(''):`<div class="empty">No items yet.</div>`);
  }

  function simpleStringList(path,label){
    const arr=getArray(path);
    return `<div class="field"><label>${esc(label)}</label><textarea data-list-path="${esc(path)}">${esc(arr.join('\n'))}</textarea><div class="muted" style="font-size:11px">One item per line.</div></div>`;
  }

  function renderSite(){return `<div class="panel-head"><div><h2>Site + SEO</h2><p>${tabHelp.site}</p></div></div><div class="card"><div class="grid2">${input('site.pageTitle','Browser title')}${input('site.metaDescription','Meta description','textarea')}${input('site.brandMain','Brand first part')}${input('site.brandAccent','Brand accent part')}${input('site.accentColor','Main accent','color')}${input('site.logoImage','Header logo (optional)','image')}</div></div>`}

  function renderNavigation(){return `<div class="panel-head"><div><h2>Navigation</h2><p>${tabHelp.navigation}</p></div></div><div class="card"><div class="grid2">${input('navCta.label','CTA label')}${input('navCta.href','CTA link')}</div></div><div class="card">${arrayEditor('navigation','Menu links',[{key:'label',label:'Label'},{key:'href',label:'Link'}],x=>x.label)}</div>`}

  function renderHome(){return `<div class="panel-head"><div><h2>Home</h2><p>${tabHelp.home}</p></div></div>
    <div class="card"><div class="card-title"><h3>Gen-Z loader</h3></div><div class="grid2">${input('loader.metaLeft','Top left')}${input('loader.metaRight','Top right')}${input('loader.lines.0','Line 1')}${input('loader.lines.1','Line 2')}${input('loader.lines.2','Line 3')}${input('loader.accentLine','Accent line index','number',{min:0,max:2})}${input('loader.footerLeft','Footer left')}${input('loader.footerRight','Footer right')}</div></div>
    <div class="card"><div class="card-title"><h3>Hero</h3></div><div class="grid2">${input('hero.metaLeft','Meta left')}${input('hero.metaRight','Meta right')}${input('hero.description','Description','textarea')}${input('hero.scrollLabel','Scroll label')}${input('hero.primary.label','Primary button')}${input('hero.primary.href','Primary link')}${input('hero.secondary.label','Secondary button')}${input('hero.secondary.href','Secondary link')}</div><div style="margin-top:16px">${arrayEditor('hero.titleLines','Hero title lines',[{key:'text',label:'Text'},{key:'accent',label:'Accent',type:'checkbox'}],x=>x.text)}</div><div style="margin-top:16px">${simpleStringList('hero.disciplines','Disciplines')}</div></div>
    <div class="card"><div class="card-title"><h3>Moving ticker</h3></div>${input('kinetic.text','Ticker text','textarea')}</div>
    <div class="card"><div class="card-title"><h3>Manifesto</h3></div><div class="grid2">${input('manifesto.eyebrow','Eyebrow')}${input('manifesto.description','Paragraph','textarea')}</div>${arrayEditor('manifesto.titleLines','Title lines',[{key:'text',label:'Text'},{key:'accent',label:'Accent',type:'checkbox'}],x=>x.text)}<div style="margin-top:14px">${arrayEditor('manifesto.pillars','Pillars',[{key:'number',label:'Number'},{key:'label',label:'Label'}],x=>`${x.number} ${x.label}`)}</div></div>`}

  function renderPoster(){return `<div class="panel-head"><div><h2>Poster Lab</h2><p>${tabHelp.poster}</p></div></div><div class="card"><div class="grid2">${input('poster.uiLeft','UI left')}${input('poster.uiRight','UI right')}${input('poster.topLeft','Poster top left')}${input('poster.topRight','Poster top right')}${input('poster.titleLines.0','Title line 1')}${input('poster.titleLines.1','Title line 2')}${input('poster.titleLines.2','Title line 3')}${input('poster.outlineLine','Outline line index','number',{min:0,max:2})}${input('poster.symbol','Symbol')}${input('poster.index','Index')}${input('poster.bottomLeft','Bottom left','textarea')}${input('poster.bottomRight','Bottom right','textarea')}${input('poster.controlTitle','Control title')}${input('poster.controlSubtitle','Control subtitle')}${input('poster.defaultPalette','Default palette id')}</div></div><div class="card">${arrayEditor('poster.palettes','Colour palettes',[{key:'id',label:'ID'},{key:'label',label:'Label'},{key:'accent',label:'Accent',type:'color'},{key:'accent2',label:'Accent 2',type:'color'},{key:'bg',label:'Background',type:'color'},{key:'fg',label:'Foreground',type:'color'},{key:'glow',label:'Glow CSS'}],x=>x.label)}</div><div class="card">${arrayEditor('poster.shapes','Poster shapes',[{key:'type',label:'Type',type:'select',options:[{value:'rect',label:'Rectangle'},{value:'circle',label:'Circle'},{value:'pill',label:'Pill'}]},{key:'x',label:'X %',type:'number'},{key:'y',label:'Y %',type:'number'},{key:'width',label:'Width %',type:'number'},{key:'height',label:'Height %',type:'number'},{key:'rotate',label:'Rotation',type:'number'},{key:'filled',label:'Filled',type:'checkbox'},{key:'borderWidth',label:'Border width',type:'number'},{key:'opacity',label:'Opacity',type:'number',step:.05,min:0,max:1}],(_,i)=>`Shape ${i+1}`)}</div>`}

  function renderImpact(){return `<div class="panel-head"><div><h2>Numbers + Graph</h2><p>${tabHelp.impact}</p></div></div><div class="card"><div class="grid2">${input('impact.eyebrow','Eyebrow')}${input('impact.title','Title')}${input('impact.note','Note','textarea')}</div></div><div class="card">${arrayEditor('impact.metrics','Animated counters',[{key:'value',label:'Target number',type:'number'},{key:'suffix',label:'Suffix'},{key:'label',label:'Label'},{key:'description',label:'Description',type:'textarea'}],x=>`${x.value}${x.suffix} — ${x.label}`)}</div><div class="card"><div class="grid2">${input('impact.graph.eyebrow','Graph eyebrow')}${input('impact.graph.title','Graph title')}${input('impact.graph.readoutTarget','Readout target','number')}${input('impact.graph.readoutSuffix','Readout suffix')}${input('impact.graph.readoutLabel','Readout label')}${input('impact.graph.foot','Graph footnote','textarea')}</div>${arrayEditor('impact.graph.bars','Growing bars',[{key:'label',label:'Label'},{key:'value',label:'Value 0–100',type:'number',min:0,max:100}],x=>`${x.label}: ${x.value}`)}</div>`}

  function renderProjects(){return `<div class="panel-head"><div><h2>Projects</h2><p>${tabHelp.projects}</p></div></div><div class="card"><div class="grid2">${input('projects.eyebrow','Eyebrow')}${input('projects.title','Section title')}${input('projects.archiveLabel','Archive label')}${input('projects.archiveLink','Archive link')}</div></div><div class="card">${arrayEditor('projects.items','Highlighted projects',[{key:'eyebrow',label:'Project eyebrow'},{key:'title',label:'Title'},{key:'tags',label:'Tags'},{key:'description',label:'Description',type:'textarea'},{key:'image',label:'Image',type:'image'},{key:'link',label:'Project link'},{key:'reverse',label:'Reverse layout',type:'checkbox'}],x=>x.title)}</div>`}

  function renderNetwork(){return `<div class="panel-head"><div><h2>Global Network</h2><p>${tabHelp.network}</p></div></div><div class="notice">X/Y are percentages inside the network box. Curve X/Y control the bend of each line. Change them and save — no SVG coding needed.</div><div class="card"><div class="grid2">${input('network.eyebrow','Eyebrow')}${input('network.titleLine1','Title line')}${input('network.titleAccent','Accent title')}${input('network.description','Description','textarea')}${input('network.note','Note','textarea')}${input('network.hub.title','Hub title')}${input('network.hub.subtitle','Hub subtitle')}${input('network.hub.x','Hub X %','number')}${input('network.hub.y','Hub Y %','number')}</div></div><div class="card">${arrayEditor('network.countries','Countries + curved lines',[{key:'name',label:'Country name'},{key:'index',label:'Index'},{key:'x',label:'End X %',type:'number'},{key:'y',label:'End Y %',type:'number'},{key:'curveX',label:'Curve X %',type:'number'},{key:'curveY',label:'Curve Y %',type:'number'},{key:'color',label:'Marker colour',type:'color'},{key:'lineColor',label:'Line CSS colour'},{key:'animated',label:'Moving dot',type:'checkbox'}],x=>x.name)}</div><div class="card">${arrayEditor('network.shapes','Decorative shapes',[{key:'type',label:'Type',type:'select',options:[{value:'circle',label:'Circle'},{value:'rect',label:'Rectangle'},{value:'cross',label:'Cross'}]},{key:'x',label:'X %',type:'number'},{key:'y',label:'Y %',type:'number'},{key:'width',label:'Width %',type:'number'},{key:'height',label:'Height %',type:'number'},{key:'rotation',label:'Rotation',type:'number'},{key:'color',label:'Colour',type:'color'},{key:'opacity',label:'Opacity',type:'number',step:.05,min:0,max:1},{key:'filled',label:'Filled',type:'checkbox'},{key:'borderWidth',label:'Border width',type:'number'}],(_,i)=>`Shape ${i+1}`)}</div>`}

  function renderAwards(){return `<div class="panel-head"><div><h2>Awards</h2><p>${tabHelp.awards}</p></div></div><div class="card"><div class="grid2">${input('awards.eyebrow','Eyebrow')}${input('awards.title','Title')}</div></div><div class="card">${arrayEditor('awards.items','Recognition',[{key:'year',label:'Year'},{key:'title',label:'Title'},{key:'category',label:'Category'},{key:'link',label:'Link'},{key:'image',label:'Image',type:'image'}],x=>x.title)}</div>`}

  function renderTeam(){return `<div class="panel-head"><div><h2>Team</h2><p>${tabHelp.team}</p></div></div><div class="card"><div class="grid2">${input('team.eyebrow','Eyebrow')}${input('team.title','Title','textarea')}</div></div><div class="card">${arrayEditor('team.members','Team members',[{key:'name',label:'Name'},{key:'role',label:'Role'},{key:'bio',label:'Bio',type:'textarea'},{key:'initials',label:'Initials'},{key:'code',label:'Small code'},{key:'image',label:'Photo',type:'image'},{key:'link',label:'Profile link'}],x=>x.name)}</div>`}

  function renderClients(){return `<div class="panel-head"><div><h2>Clients</h2><p>${tabHelp.clients}</p></div></div><div class="card">${arrayEditor('clients.items','Clients / partners',[{key:'name',label:'Name'},{key:'logo',label:'Logo',type:'image'},{key:'link',label:'Link'}],x=>x.name)}</div>`}

  function renderTestimonials(){return `<div class="panel-head"><div><h2>Testimonials</h2><p>${tabHelp.testimonials}</p></div></div><div class="card"><div class="grid2">${input('testimonials.eyebrow','Eyebrow')}${input('testimonials.title','Title')}</div></div><div class="card">${arrayEditor('testimonials.items','Quotes',[{key:'quote',label:'Quote',type:'textarea'},{key:'name',label:'Name'},{key:'roleCompany',label:'Role / Company'}],x=>x.name)}</div>`}

  function renderContact(){return `<div class="panel-head"><div><h2>Contact + Footer</h2><p>${tabHelp.contact}</p></div></div><div class="card"><div class="grid2">${input('contact.titleLine1','CTA title line')}${input('contact.titleAccent','CTA accent')}${input('contact.cardTitle','Contact card title')}${input('contact.websiteLabel','Website label')}${input('contact.website','Website')}${input('contact.locationLabel','Location label')}${input('contact.location','Location')}${input('contact.emailLabel','Email label')}${input('contact.email','Email')}${input('contact.socialLabel','Social label')}${input('contact.socialText','Social text')}${input('contact.formTitle','Form title')}${input('contact.namePlaceholder','Name placeholder')}${input('contact.emailPlaceholder','Email placeholder')}${input('contact.companyPlaceholder','Company placeholder')}${input('contact.messagePlaceholder','Message placeholder')}${input('contact.submitLabel','Submit button')}${input('contact.successMessage','Success message')}${input('contact.errorMessage','Error message')}</div></div><div class="card"><div class="card-title"><h3>Footer</h3></div><div class="grid2">${input('footer.left','Footer left')}${input('footer.middle','Footer middle')}${input('footer.right','Footer right')}</div></div>`}

  function renderSections(){const arr=getArray('sections');return `<div class="panel-head"><div><h2>Sections</h2><p>${tabHelp.sections}</p></div></div><div class="notice">Use ↑ ↓ to change the public page order. Turn a section off to hide it without deleting its content. Section headings themselves are edited in their own tabs.</div><div class="card">${arr.map((x,i)=>`<div class="array-card"><div class="array-top"><strong>${esc(x.label||x.id)}</strong><div class="row-actions"><button class="secondary tiny" data-array-action="up" data-array-path="sections" data-index="${i}">↑</button><button class="secondary tiny" data-array-action="down" data-array-path="sections" data-index="${i}">↓</button></div></div><div class="grid2">${input(`sections.${i}.label`,'Admin label')}${input(`sections.${i}.visible`,'Visible','checkbox')}<div class="field"><label>Section ID</label><input value="${esc(x.id)}" disabled></div></div></div>`).join('')}</div>`}

  function renderAdvanced(){return `<div class="panel-head"><div><h2>Advanced JSON</h2><p>${tabHelp.advanced}</p></div></div><div class="notice">This is the complete CMS object. Use Backup JSON before large edits.</div><div class="card"><textarea class="codearea" id="jsonEditor">${esc(JSON.stringify(content,null,2))}</textarea><div style="display:flex;gap:8px;margin-top:12px"><button class="primary" id="applyJson">Apply JSON to editor</button><button class="danger" id="resetDefaults">Reset editor to built-in defaults</button></div></div>`}

  async function renderMessages(){
    $('#editor').innerHTML=`<div class="panel-head"><div><h2>Messages</h2><p>${tabHelp.messages}</p></div><button class="secondary tiny" id="refreshMessages">Refresh</button></div><div class="messages" id="messageList"><div class="empty">Loading…</div></div>`;
    await loadMessages();
  }

  const renderers={site:renderSite,navigation:renderNavigation,home:renderHome,poster:renderPoster,impact:renderImpact,projects:renderProjects,network:renderNetwork,awards:renderAwards,team:renderTeam,clients:renderClients,testimonials:renderTestimonials,contact:renderContact,sections:renderSections,advanced:renderAdvanced};

  function renderTabs(){ $('#tabs').innerHTML=tabs.map(([id,label])=>`<button class="tab ${id===activeTab?'active':''}" data-tab="${id}">${esc(label)}</button>`).join(''); }
  function renderEditor(){
    renderTabs(); $('#topTitle').textContent=tabs.find(x=>x[0]===activeTab)?.[1]||'CMS'; $('#topSub').textContent=tabHelp[activeTab]||'';
    if(activeTab==='messages'){renderMessages();return}
    $('#editor').innerHTML=(renderers[activeTab]||renderSite)();
  }

  async function loadMessages(){
    const list=$('#messageList'); if(!list)return;
    const {data,error}=await sb.from('contact_messages').select('*').order('created_at',{ascending:false}).limit(100);
    if(error){list.innerHTML=`<div class="empty">${esc(error.message)}</div>`;return}
    if(!data?.length){list.innerHTML='<div class="empty">No messages yet.</div>';return}
    list.innerHTML=data.map(m=>`<article class="message"><div class="message-head"><div><strong>${esc(m.name||'No name')}</strong> <span class="pill">${esc(m.company||'No company')}</span></div><span class="muted">${new Date(m.created_at).toLocaleString()}</span></div><div class="muted" style="margin-top:6px">${esc(m.email||'')}</div><p>${esc(m.message||'')}</p><button class="danger tiny" data-delete-message="${esc(m.id)}">Delete</button></article>`).join('');
  }

  function handleInput(el){
    const path=el.dataset.path; if(!path)return;
    let v=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='number') v=v===''?0:Number(v);
    setPath(path,v);
    const colorPeer=el.closest('.color-field')?.querySelector('[data-color-path]');
    if(colorPeer && el.type!=='color' && /^#[0-9a-f]{6}$/i.test(v)) colorPeer.value=v;
  }

  async function uploadImage(path,file){
    if(!file)return;
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const name=`${Date.now()}-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}.${ext}`;
    toast('Uploading…');
    const {error}=await sb.storage.from(cfg.STORAGE_BUCKET||'site-assets').upload(name,file,{cacheControl:'3600',upsert:false});
    if(error){toast(error.message,'bad');return}
    const {data}=sb.storage.from(cfg.STORAGE_BUCKET||'site-assets').getPublicUrl(name);
    setPath(path,data.publicUrl); renderEditor(); toast('Image uploaded');
  }

  async function save(){
    const btn=$('#saveBtn'); btn.disabled=true; btn.textContent='Saving…';
    try{
      const {error}=await sb.from('site_content').upsert({id:cfg.CONTENT_ROW_ID||'main',content,updated_by:currentUser.id,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error; markSaved(); toast('Website content saved ✓');
    }catch(err){toast(err.message||'Save failed','bad')}
    finally{btn.disabled=false;btn.textContent='Save changes'}
  }

  async function checkAdmin(user){
    const {data,error}=await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(error)throw error; return !!data;
  }

  async function enterApp(user){
    currentUser=user;
    const ok=await checkAdmin(user);
    if(!ok){await sb.auth.signOut();throw new Error('This account is not in the Graphlair admins table.');}
    const {data,error}=await sb.from('site_content').select('content').eq('id',cfg.CONTENT_ROW_ID||'main').maybeSingle();
    if(error)throw error;
    content=deepMerge(clone(DEFAULTS),data?.content||{});
    $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    renderEditor(); markSaved();
  }

  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault(); const msg=$('#loginMsg');msg.textContent='Signing in…';
    const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error){msg.textContent=error.message;return}
    try{await enterApp(data.user);msg.textContent=''}catch(err){msg.textContent=err.message}
  });

  $('#logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.reload()});
  $('#saveBtn').addEventListener('click',save);
  $('#backupBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`graphlair-cms-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});

  $('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;activeTab=b.dataset.tab;renderEditor()});
  $('#editor').addEventListener('input',e=>{if(e.target.matches('[data-path]'))handleInput(e.target);if(e.target.matches('[data-list-path]')){setPath(e.target.dataset.listPath,e.target.value.split(/\n/).map(x=>x.trim()).filter(Boolean))}});
  $('#editor').addEventListener('change',e=>{if(e.target.matches('[data-path]'))handleInput(e.target);if(e.target.matches('[data-color-path]')){setPath(e.target.dataset.colorPath,e.target.value);const text=e.target.closest('.color-field').querySelector('[data-path]');if(text)text.value=e.target.value}});

  $('#editor').addEventListener('click',async e=>{
    const add=e.target.closest('[data-add-array]');
    if(add){const path=add.dataset.addArray;getArray(path).push(clone(templates[path]||{}));markDirty();renderEditor();return}
    const act=e.target.closest('[data-array-action]');
    if(act){const arr=getArray(act.dataset.arrayPath),i=Number(act.dataset.index),kind=act.dataset.arrayAction;if(kind==='remove')arr.splice(i,1);if(kind==='up'&&i>0)[arr[i-1],arr[i]]=[arr[i],arr[i-1]];if(kind==='down'&&i<arr.length-1)[arr[i+1],arr[i]]=[arr[i],arr[i+1]];markDirty();renderEditor();return}
    const up=e.target.closest('[data-upload-path]');
    if(up){const pick=document.createElement('input');pick.type='file';pick.accept='image/*';pick.onchange=()=>uploadImage(up.dataset.uploadPath,pick.files[0]);pick.click();return}
    const del=e.target.closest('[data-delete-message]');
    if(del){if(!confirm('Delete this message?'))return;const {error}=await sb.from('contact_messages').delete().eq('id',del.dataset.deleteMessage);if(error)toast(error.message,'bad');else{toast('Message deleted');loadMessages()}return}
    if(e.target.id==='refreshMessages'){loadMessages();return}
    if(e.target.id==='applyJson'){try{content=deepMerge(clone(DEFAULTS),JSON.parse($('#jsonEditor').value));markDirty();renderEditor();toast('JSON applied to editor')}catch(err){toast('Invalid JSON: '+err.message,'bad')}return}
    if(e.target.id==='resetDefaults'){if(confirm('Reset the editor to built-in defaults? This is not saved until you click Save.')){content=clone(DEFAULTS);markDirty();renderEditor();toast('Defaults loaded')}}
  });

  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});

  (async()=>{
    const {data:{session}}=await sb.auth.getSession();
    if(session?.user){try{await enterApp(session.user)}catch(err){$('#loginMsg').textContent=err.message}}
  })();
})();
