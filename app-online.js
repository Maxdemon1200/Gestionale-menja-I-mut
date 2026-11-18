var onlineClient=null, activeUser=null, activeProfile=null;let ownerNoticeTimer=null;
let adminKnownChatNotificationIds=null;const onlineKinds={customers:'customers',orders:'orders',products:'products',priceLists:'pricelists',recipes:'recipes',production:'production',lots:'lots',inventory:'inventory',fidelity:'fidelity',invoices:'invoices',events:'finance',ingredientLots:'ingredient_lots',haccpChecks:'haccp_checks',companyProfile:'settings'};
const buckets=Object.keys(onlineKinds);
function showError(error){console.error('Menja i Mut diagnostic stage:',window.__menjaStage||'non definito',error);const detail=error?.stack?String(error.stack).split('\n').slice(0,5).join('\n'):'';alert(`Operazione non riuscita\nFase: ${window.__menjaStage||'non definita'}\n${error?.message||error}${detail?'\n\n'+detail:''}`)}
function authScreen(message='Accedi o crea il tuo account'){
 if(ownerNoticeTimer){clearInterval(ownerNoticeTimer);ownerNoticeTimer=null}const notice=document.getElementById('ownerNotice');if(notice){notice.hidden=true;notice.innerHTML=''}const orderNotice=document.getElementById('ownerOrderNotice');if(orderNotice){orderNotice.hidden=true;orderNotice.innerHTML=''}window.__menjaPendingOrderCount=0;
 document.body.classList.remove('admin-mode','customer-mode');
 document.getElementById('signoutButton').hidden=true;
 document.getElementById('view').innerHTML=`<div class="box" style="max-width:620px;margin:7vh auto"><div class="brand"><img src="menjaimut.jpg" alt="Logo Menja i Mut"><div><b>MENJA I MUT</b><small>PIZZA LAB</small></div></div><h1>Gestionale online</h1><p class="muted">${message}</p><form id="authForm" class="formgrid"><label class="wide">Email<input class="field" name="email" type="email" autocomplete="username" required></label><label class="wide">Password<input class="field" name="password" type="password" minlength="8" autocomplete="current-password" required></label><div class="wide" id="authRegistrationFields" hidden><label>Tipo di registrazione<select class="field" name="customer_type" id="customerType"><option value="privato">Privato</option><option value="azienda">Azienda</option></select></label><div id="privateRegistrationFields" class="formgrid"><label>Nome<input class="field" name="first_name" autocomplete="given-name"></label><label>Cognome<input class="field" name="last_name" autocomplete="family-name"></label><label class="wide">Numero di telefono<input class="field" name="phone" type="tel" autocomplete="tel"></label></div><div id="companyRegistrationFields" class="formgrid" hidden><label class="wide">Ragione sociale<input class="field" name="company_name" autocomplete="organization"></label><label>Partita IVA<input class="field" name="vat_number"></label><label class="wide">Via e numero civico<input class="field" name="street_address" autocomplete="street-address"></label><label class="wide">Codice univoco oppure PEC<input class="field" name="recipient_code_or_pec" placeholder="Codice SDI o indirizzo PEC"></label><label class="wide">Numero di telefono<input class="field" name="company_phone" type="tel" autocomplete="tel"></label></div></div><label class="wide"><input type="checkbox" name="remember_login" id="rememberLogin" checked> Ricorda login su questo dispositivo</label><div class="wide actions"><button class="btn" type="submit" data-mode="signin">Accedi</button><button class="btn gold" type="submit" data-mode="signup">Crea account cliente</button></div></form><p class="muted">Registrandoti, invii una richiesta al titolare. Dopo l’approvazione potrai accedere al catalogo e inviare ordini.</p></div>`;
 const authForm=document.getElementById('authForm'),savedLogin=(()=>{try{return JSON.parse(localStorage.getItem('menjaRememberLogin')||'null')}catch{return null}})(),registrationFields=document.getElementById('authRegistrationFields'),customerType=document.getElementById('customerType'),privateFields=document.getElementById('privateRegistrationFields'),companyFields=document.getElementById('companyRegistrationFields');if(savedLogin){authForm.elements.email.value=savedLogin.email||'';authForm.elements.remember_login.checked=true}function updateRegistrationFields(){const company=customerType.value==='azienda';privateFields.hidden=company;companyFields.hidden=!company;['first_name','last_name','phone'].forEach(n=>authForm.elements[n].required=!company);['company_name','vat_number','street_address','recipient_code_or_pec','company_phone'].forEach(n=>authForm.elements[n].required=company)}function setAuthMode(mode){const signup=mode==='signup';registrationFields.hidden=!signup;authForm.elements.password.autocomplete=signup?'new-password':'current-password';if(signup)updateRegistrationFields()}customerType.addEventListener('change',updateRegistrationFields);authForm.querySelectorAll('button[data-mode]').forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.mode)));setAuthMode('signin');authForm.addEventListener('submit',async e=>{e.preventDefault();let mode=e.submitter.dataset.mode,data=Object.fromEntries(new FormData(e.currentTarget));try{if(authForm.elements.remember_login.checked){localStorage.setItem('menjaRememberLogin',JSON.stringify({email:data.email,full_name:mode==='signup'?(data.customer_type==='azienda'?data.company_name:[data.first_name,data.last_name].filter(Boolean).join(' ')):(savedLogin?.full_name||'')}))}else{localStorage.removeItem('menjaRememberLogin')}if(mode==='signup'){const company=data.customer_type==='azienda',fullName=company?String(data.company_name||'').trim():[data.first_name,data.last_name].filter(Boolean).join(' ').trim(),phone=company?data.company_phone:data.phone;if(!fullName)throw new Error(company?'Inserisci la ragione sociale.':'Inserisci nome e cognome.');const requiredCompanyFields=[['vat_number','partita IVA'],['street_address','indirizzo'],['recipient_code_or_pec','codice univoco oppure PEC'],['company_phone','numero di telefono']];if(company){for(const [field,label] of requiredCompanyFields){if(!String(data[field]||'').trim())throw new Error('Il campo '+label+' è obbligatorio.')}}else if(!String(data.phone||'').trim())throw new Error('Il numero di telefono è obbligatorio.');window.__menjaStage='registrazione account';const {error}=await onlineClient.auth.signUp({email:data.email,password:data.password,options:{data:{full_name:fullName,category:company?'Aziende':'Privati',customer_type:data.customer_type,vat_number:company?data.vat_number:'',street_address:company?data.street_address:'',recipient_code_or_pec:company?data.recipient_code_or_pec:'',phone}}});if(error)throw error;authScreen('Registrazione completata. Se richiesto, conferma il tuo indirizzo email. Il titolare riceverà la richiesta e dovrà approvare l’account.')}else{window.__menjaStage='accesso: verifica credenziali Supabase';const {error}=await onlineClient.auth.signInWithPassword({email:data.email,password:data.password});if(error)throw error;window.__menjaStage='accesso: caricamento profilo e gestionale';await startOnline()}}catch(err){showError(err)}});
}
async function persistRecord(kind,obj){if(!onlineClient||!activeUser)return;const row={id:obj.id||crypto.randomUUID(),kind,owner_id:activeUser.id,payload:obj};const {error}=await onlineClient.from('records').upsert(row);if(error)throw error}
async function loadOnlineData(){window.__menjaStage='caricamento dati: tabella records';for(const b of buckets)db[b]=[];db.notifications=[];const {data:rows,error}=await onlineClient.from('records').select('id,kind,owner_id,payload,created_at');if(error)throw error;for(const r of rows||[]){let bucket=Object.keys(onlineKinds).find(k=>onlineKinds[k]===r.kind);if(bucket)db[bucket].push({...r.payload,id:r.id,owner_id:r.owner_id,created_at:r.created_at||r.payload?.created_at||null})}if(activeProfile.role==='admin'){window.__menjaStage='caricamento dati: elenco profili clienti';const {data:profiles,error:pe}=await onlineClient.from('profiles').select('id,email,full_name,category,role,approval_status,created_at,customer_code,fidelity_points,price_list_id,price_list_ids,customer_type,vat_number,street_address,recipient_code_or_pec,phone,deleted_at');if(pe)throw pe;db.customers=[...db.customers.filter(c=>!c.isProfile),...(profiles||[]).map(p=>({id:p.id,isProfile:true,role:p.role,name:p.full_name,category:p.category,email:p.email,customer_type:p.customer_type||'privato',vat_number:p.vat_number||'',street_address:p.street_address||'',recipient_code_or_pec:p.recipient_code_or_pec||'',phone:p.phone||'',code:p.customer_code,fidelity_code:p.customer_code,points:p.fidelity_points||0,price_list_id:p.price_list_id||'',price_list_ids:Array.isArray(p.price_list_ids)&&p.price_list_ids.length?p.price_list_ids:(p.price_list_id?[p.price_list_id]:[]),status:({pending:'In attesa di abilitazione',approved:'Attivo',suspended:'Sospeso',rejected:'Rifiutato'})[p.approval_status],approval_status:p.approval_status,phone:p.phone||'',deleted_at:p.deleted_at||null,created_at:p.created_at||null}))]}else{db.customers=[{id:activeProfile.id,isProfile:true,name:activeProfile.full_name,category:activeProfile.category,email:activeProfile.email,customer_type:activeProfile.customer_type||'privato',vat_number:activeProfile.vat_number||'',street_address:activeProfile.street_address||'',recipient_code_or_pec:activeProfile.recipient_code_or_pec||'',phone:activeProfile.phone||'',code:activeProfile.customer_code,fidelity_code:activeProfile.customer_code,points:activeProfile.fidelity_points||0,status:activeProfile.approval_status}]};db.fidelity=[...db.customers.map(c=>({customer:c.name,code:c.fidelity_code||c.code||'',date:'',points:c.points??c.fidelity_points??0,note:'Tessera fidelity assegnata'})),...db.fidelity];const{data:notifications,error:notificationError}=await onlineClient.from('notifications').select('*').order('created_at',{ascending:false}).limit(50);if(notificationError)throw notificationError;db.notifications=notifications||[]}

async function refreshOwnerNotice(){
 const el=document.getElementById('ownerNotice');if(!el)return;
 if(activeProfile?.role!=='admin'){el.hidden=true;el.innerHTML='';return}
 const{data,error}=await onlineClient.from('profiles').select('id,email,full_name,category,created_at').eq('approval_status','pending').order('created_at',{ascending:false});
 if(error){console.error('Notifica nuove registrazioni non disponibile:',error);return}
 const pending=data||[];
 if(!pending.length){el.hidden=true;el.innerHTML='';return}
 const preview=pending.slice(0,3).map(p=>esc(p.full_name||p.email)).join(' · ');
 const extra=pending.length>3?' e altri '+(pending.length-3):'';
 el.innerHTML='<div><strong>🔔 '+pending.length+' NUOV'+(pending.length===1?'A':'E')+' RICHIEST'+(pending.length===1?'A':'E')+' DI REGISTRAZIONE</strong><small>'+preview+extra+' · Da approvare nella sezione Clienti</small></div><button type="button" onclick="openNewCustomerRequests()">VEDI NUOVI CLIENTI →</button>';
 el.hidden=false;
}
let ownerKnownOrderIds=null;
function syncPendingOrderBadge(){
 const count=activeProfile?.role==='admin'?db.orders.filter(o=>o.status==='Da approvare').length:0;
 window.__menjaPendingOrderCount=count;
 if(typeof navHTML==='function')navHTML();
 const el=document.getElementById('ownerOrderNotice');
 if(el&&!count){el.hidden=true;el.innerHTML=''}
}
function dismissOwnerOrderNotice(){
 const el=document.getElementById('ownerOrderNotice');
 if(el){el.hidden=true;el.innerHTML=''}
}
function openNotifiedOrder(id){
 dismissOwnerOrderNotice();
 openAdminOrder(id);
}
async function enableOrderBrowserNotifications(){
 if(!('Notification' in window)){alert('Le notifiche desktop non sono supportate da questo browser.');return}
 try{
  const permission=await Notification.requestPermission();
  if(permission==='granted')alert('Notifiche desktop attivate. Ti avviserò quando arriva un nuovo ordine.');
  else alert('Permesso notifiche non concesso. Continuerai comunque a vedere gli avvisi nel gestionale.');
 }catch(e){console.error('Permesso notifiche:',e)}
}
let menjaSoundContext=null;
function menjaPlayAlertSound(){
 if(localStorage.getItem('menjaSoundEnabled')!=='1')return;
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return;
  menjaSoundContext=menjaSoundContext||new AudioContextClass();
  if(menjaSoundContext.state==='suspended')menjaSoundContext.resume();
  const now=menjaSoundContext.currentTime;
  [0,0.22].forEach((offset,index)=>{
   const oscillator=menjaSoundContext.createOscillator();
   const gain=menjaSoundContext.createGain();
   oscillator.type='sine'; oscillator.frequency.value=index?880:660;
   gain.gain.setValueAtTime(0.0001,now+offset);
   gain.gain.exponentialRampToValueAtTime(0.16,now+offset+0.025);
   gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.18);
   oscillator.connect(gain); gain.connect(menjaSoundContext.destination);
   oscillator.start(now+offset); oscillator.stop(now+offset+0.19);
  });
 }catch(error){console.warn('Avviso sonoro non disponibile:',error)}
}
function menjaToggleAlertSound(){
 const enabled=localStorage.getItem('menjaSoundEnabled')==='1';
 if(enabled){localStorage.setItem('menjaSoundEnabled','0');alert('Avviso sonoro disattivato su questo dispositivo.');}
 else{localStorage.setItem('menjaSoundEnabled','1');menjaPlayAlertSound();alert('Avviso sonoro attivato. Sentirai un suono quando arriva una nuova notifica mentre il gestionale è aperto.');}
 const button=document.getElementById('menjaSoundToggle');
 if(button)button.textContent=localStorage.getItem('menjaSoundEnabled')==='1'?'Disattiva avviso sonoro':'Attiva avviso sonoro';
}
function menjaSoundToggleButton(){
 const enabled=localStorage.getItem('menjaSoundEnabled')==='1';
 return '<button id="menjaSoundToggle" class="btn" type="button" onclick="menjaToggleAlertSound()">'+(enabled?'Disattiva avviso sonoro':'Attiva avviso sonoro')+'</button>';
}
function showNewOrderNotice(newOrders){
 const el=document.getElementById('ownerOrderNotice');if(!el||!newOrders.length)return;
 const first=newOrders[0];
 const title=newOrders.length===1?'È ARRIVATO UN NUOVO ORDINE':'SONO ARRIVATI '+newOrders.length+' NUOVI ORDINI';
 const detail=newOrders.length===1?(first.customer||'Nuovo cliente')+' · '+(first.code||'Ordine'):'Controlla le nuove richieste dei clienti';
 el.innerHTML='<div><strong>🔴 '+title+'</strong><small>'+esc(detail)+' · Da approvare</small></div><div class="order-notice-actions"><button type="button" onclick="openNotifiedOrder(\''+first.id+'\')">VEDI ORDINE →</button>'+(('Notification' in window&&Notification.permission!=='granted'&&Notification.permission!=='denied')?'<button type="button" class="order-notice-enable" onclick="enableOrderBrowserNotifications()">Attiva notifiche desktop</button>':'')+'<button type="button" class="order-notice-close" aria-label="Chiudi notifica" onclick="dismissOwnerOrderNotice()">×</button></div>'+menjaSoundToggleButton();
 el.hidden=false;
 menjaPlayAlertSound();
 if('Notification' in window&&Notification.permission==='granted'){
  try{new Notification('Menja i Mut · Nuovo ordine',{body:detail,tag:'menja-order-'+first.id})}catch(e){console.warn('Notifica desktop non disponibile:',e)}
 }
}
async function refreshOwnerOrders(){
 if(activeProfile?.role!=='admin'||!onlineClient)return;
 try{
  const {data,error}=await onlineClient.from('records').select('id,kind,owner_id,payload,created_at').eq('kind','orders');
  if(error)throw error;
  const fresh=(data||[]).map(r=>({...r.payload,id:r.id,owner_id:r.owner_id,created_at:r.created_at||r.payload?.created_at||null}));
  const previousSnapshot=JSON.stringify(db.orders.map(o=>({id:o.id,status:o.status,lines:o.lines,items:o.items,updated_at:o.updated_at,created_at:o.created_at})));
  const ids=new Set(fresh.map(o=>String(o.id)));
  const newlyArrived=ownerKnownOrderIds===null?[]:fresh.filter(o=>o.status==='Da approvare'&&!ownerKnownOrderIds.has(String(o.id)));
  ownerKnownOrderIds=ids;
  db.orders=fresh;
  syncPendingOrderBadge();
  const freshSnapshot=JSON.stringify(fresh.map(o=>({id:o.id,status:o.status,lines:o.lines,items:o.items,updated_at:o.updated_at,created_at:o.created_at})));
  if(previousSnapshot!==freshSnapshot&&['Magazzino','Ordini','Lotti produzione'].includes(page))render();
  if(newlyArrived.length)showNewOrderNotice(newlyArrived);
 }catch(e){console.error('Controllo nuovi ordini non riuscito:',e)}
}
async function refreshAdminChatNotifications(){
 if(activeProfile?.role!=='admin'||!onlineClient)return;
 try{
  const{data,error}=await onlineClient.from('chat_messages').select('id,customer_id,created_at,read_at').eq('sender_role','customer').is('read_at',null).order('created_at',{ascending:false}).limit(1000);
  if(error)throw error;
  const fresh=data||[],unreadByCustomer={};
  for(const message of fresh){const id=String(message.customer_id);if(!unreadByCustomer[id])unreadByCustomer[id]={count:0,latest:message.created_at||''};unreadByCustomer[id].count++;if(String(message.created_at||'')>String(unreadByCustomer[id].latest||''))unreadByCustomer[id].latest=message.created_at||'';}
  const previous=JSON.stringify(window.__menjaUnreadByCustomer||{});
  window.__menjaUnreadByCustomer=unreadByCustomer;
  window.__menjaUnreadChatCount=fresh.length;
  if(typeof navHTML==='function')navHTML();
  const newItems=adminKnownChatNotificationIds===null?[]:fresh.filter(n=>!adminKnownChatNotificationIds.has(String(n.id)));
  adminKnownChatNotificationIds=new Set(fresh.map(n=>String(n.id)));
  if(newItems.length){
   const latest=newItems[0],sender=db.customers.find(c=>String(c.id)===String(latest.customer_id));
   menjaPlayAlertSound();
   if('Notification' in window&&Notification.permission==='granted'){
    try{new Notification('Nuovo messaggio da '+(sender?.name||'un cliente'),{body:'Hai ricevuto un nuovo messaggio',tag:'menja-chat-'+latest.id})}catch(e){console.warn('Notifica chat amministratore non disponibile:',e)}
   }
  }
  if(['Clienti','Chat clienti'].includes(page)&&previous!==JSON.stringify(unreadByCustomer))render();
 }catch(e){console.error('Aggiornamento notifiche chat amministratore non riuscito:',e)}
}
function startOwnerNoticeMonitoring(){
 if(ownerNoticeTimer){clearInterval(ownerNoticeTimer);ownerNoticeTimer=null}
 ownerKnownOrderIds=null;
 if(activeProfile?.role==='admin'){
  adminKnownChatNotificationIds=null;
  refreshOwnerNotice();
  refreshOwnerOrders();
  refreshAdminChatNotifications();
  ownerNoticeTimer=setInterval(()=>{refreshOwnerNotice();refreshOwnerOrders();refreshAdminChatNotifications()},15000);
 }else{
  const el=document.getElementById('ownerNotice');if(el){el.hidden=true;el.innerHTML=''}
  const orderEl=document.getElementById('ownerOrderNotice');if(orderEl){orderEl.hidden=true;orderEl.innerHTML=''}
  window.__menjaPendingOrderCount=0;
  if(customerNotificationTimer)clearInterval(customerNotificationTimer);
  customerKnownNotificationIds=new Set((db.notifications||[]).map(n=>String(n.id)));
  customerNotificationTimer=setInterval(refreshCustomerNotifications,15000);
 }
}
async function openNewCustomerRequests(){
 try{await loadOnlineData();page='Clienti';render();await refreshOwnerNotice()}catch(e){showError(e)}
}
async function startOnline(){
 window.__menjaStage='inizializzazione collegamento Supabase';
 const cfg=window.MENJA_CONFIG||{};
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){document.getElementById('view').innerHTML=`<div class="box"><h1>Configurazione necessaria</h1><p>Inserisci Project URL e chiave anon/publishable Supabase in <code>config.js</code>, esegui lo schema SQL e ricarica la pagina. Non usare mai la chiave service_role.</p></div>`;return}
 if(!onlineClient)onlineClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 window.__menjaStage='lettura sessione Supabase';const {data:{session},error}=await onlineClient.auth.getSession();if(error){showError(error);return}activeUser=session?.user||null;
 if(!activeUser){authScreen();return}
 window.__menjaStage='lettura profilo utente';const {data:profile,error:pe}=await onlineClient.from('profiles').select('*').eq('id',activeUser.id).single();if(pe){showError(pe);return}activeProfile=profile;document.body.classList.toggle('admin-mode',profile.role==='admin');document.body.classList.toggle('customer-mode',profile.role!=='admin');document.querySelector('header .actions button[onclick="importBackup()"]').hidden=profile.role!=='admin';document.querySelector('header .actions button[onclick="exportData()"]').hidden=profile.role!=='admin';document.getElementById('signoutButton').hidden=false;document.getElementById('sessionInfo').textContent=`${profile.full_name||profile.email} · ${profile.role==='admin'?'Amministratore':profile.category+(profile.customer_code?(profile.customer_type==='azienda'?' · Codice cliente '+profile.customer_code:' · Codice '+profile.customer_code+' · Fidelity '+profile.customer_code):'')}`;
 if(profile.approval_status!=='approved'){document.getElementById('view').innerHTML=`<div class="box"><h1>Account in attesa</h1><p>Registrazione completata per ${esc(profile.email)}. Il titolare deve approvare manualmente il tuo account prima di accedere a catalogo e ordini.</p><button class="btn" onclick="signOut()">Esci</button></div>`;return}
 try{window.__menjaStage='caricamento dati gestionali';await loadOnlineData();startOwnerNoticeMonitoring();const all=[['OPERATIVITÀ',['Dashboard','Ordini','Clienti','Chat clienti']],['CATALOGO',['Prodotti','Listini']],['PRODUZIONE',['Produzione','Lotti produzione','Magazzino']],['CLIENTI',['Fidelity']],['AMMINISTRAZIONE',['Finanza','Statistiche','ASL','Impostazioni','Sicurezza']]];const isCompany=profile.customer_type==='azienda';const customer=[['IL TUO SPAZIO',['Home','Nuovo ordine','Storico ordini','I miei listini',...(isCompany?['Resoconto aziendale']:[])]],...(isCompany?[['CONTATTI',['Chat col titolare']]]:[['FIDELITY E CONTATTI',['Punti fidelity','Chat col titolare']]]),['ACCOUNT',['Impostazioni']]];sections.splice(0,sections.length,...(profile.role==='admin'?all:customer));if(profile.role!=='admin')page='Home';window.__menjaStage='visualizzazione schermata gestionale';render();window.__menjaStage='gestionale caricato';}catch(err){showError(err)}
}
let selectedChatCustomer=null;
const menjaBaseModulePage=baseModulePage;function menjaChatPanel(customerId,title){return '<style>.menja-chat-shell{padding:0!important;overflow:hidden;background:#050505!important;border:1px solid #333333}.menja-chat-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;background:#e0ad22;color:#111111}.menja-chat-top h2{margin:0;color:#111111;font-size:17px;font-weight:800}.menja-chat-top h2,.menja-chat-top h2 *{color:#111111!important;-webkit-text-fill-color:#111111!important;text-shadow:none!important}.menja-chat-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.menja-chat-tools .btn{padding:7px 10px;font-size:12px}.menja-chat-messages{display:flex;flex-direction:column;gap:8px;height:min(58vh,620px);min-height:300px;overflow:auto;padding:16px 12px;background-color:#050505;background-image:radial-gradient(rgba(255,255,255,.035) .7px,transparent .7px);background-size:13px 13px}.menja-chat-row{display:flex;width:100%}.menja-chat-row.mine{justify-content:flex-end}.menja-chat-row.theirs{justify-content:flex-start}.menja-chat-bubble{max-width:min(82%,520px);padding:8px 10px 6px;border-radius:10px;box-shadow:0 1px 1px rgba(0,0,0,.12);color:#f5f5f5;overflow-wrap:anywhere}.menja-chat-row.mine .menja-chat-bubble{background:#f4c542;color:#111111;border-top-right-radius:3px}.menja-chat-row.theirs .menja-chat-bubble{background:#252525;border-top-left-radius:3px}.menja-chat-text{white-space:pre-wrap;font-size:14px;line-height:1.45}.menja-chat-row.mine .menja-chat-text{color:#111111!important;font-weight:700}.menja-chat-meta{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin-top:3px;color:#b8b8b8;font-size:10px}.menja-chat-row.mine .menja-chat-meta{color:#454545!important;font-weight:700}.menja-chat-ticks{font-size:15px;letter-spacing:-4px;padding-right:4px;color:#8696a0}.menja-chat-ticks.read{color:#34a9e5}.menja-chat-compose{position:relative;display:flex;align-items:flex-end;gap:9px;padding:10px;background:#111111}.menja-chat-emoji-toggle{width:42px;height:44px;flex:0 0 42px;border:0;border-radius:50%;background:#252525;color:#fff;font-size:23px;cursor:pointer}.menja-chat-emoji-picker{position:absolute;z-index:20;left:10px;bottom:62px;display:grid;grid-template-columns:repeat(8,38px);gap:4px;padding:9px;background:#202020;border:1px solid #555;border-radius:12px;box-shadow:0 6px 22px #0009}.menja-chat-emoji-picker[hidden]{display:none!important}.menja-chat-emoji-picker button{width:38px;height:38px;padding:0;border:0;border-radius:7px;background:#333;color:#fff;font-size:22px;cursor:pointer}.menja-chat-emoji-picker button:hover{background:#555}.menja-chat-compose textarea{flex:1;min-height:44px;max-height:120px;resize:vertical;border-radius:22px!important;padding:11px 15px!important;background:#fff!important}.menja-chat-send{width:45px;height:45px;flex:0 0 45px;border:0;border-radius:50%;background:#e0ad22;color:#111111;font-size:20px;font-weight:800;cursor:pointer}.menja-chat-empty{align-self:center;background:rgba(255,255,255,.85);padding:9px 14px;border-radius:9px;color:#dddddd;font-size:12px}@media(max-width:700px){html.touch-mobile body.customer-mode .menja-chat-shell{display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important;min-width:0!important;height:calc(100dvh - 205px)!important;min-height:420px!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#050505!important;border:1px solid #333333!important;border-radius:14px!important;box-shadow:0 5px 18px #0002!important}html.touch-mobile body.customer-mode .menja-chat-top{flex:0 0 auto!important;min-height:58px!important;padding:10px 12px!important;background:#e0ad22!important;color:#111111!important}html.touch-mobile body.customer-mode .menja-chat-top h2{color:#111111!important;font-size:16px!important;font-weight:800!important;margin:0!important}html.touch-mobile body.customer-mode .menja-chat-tools{gap:5px!important}html.touch-mobile body.customer-mode .menja-chat-tools .btn{min-height:34px!important;padding:5px 7px!important;font-size:10px!important;border-radius:8px!important;background:#11111122!important;border:1px solid #11111155!important;color:#111111!important}html.touch-mobile body.customer-mode .menja-chat-messages{flex:1 1 auto!important;height:auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:12px 9px!important;background-color:#050505;background-image:radial-gradient(rgba(255,255,255,.035) .7px,transparent .7px)!important;background-size:13px 13px!important}html.touch-mobile body.customer-mode .menja-chat-row{display:flex!important;width:100%!important}html.touch-mobile body.customer-mode .menja-chat-bubble{max-width:86%!important;padding:8px 10px 6px!important;border-radius:10px!important;color:#f5f5f5!important;box-shadow:0 1px 1px #0002!important}html.touch-mobile body.customer-mode .menja-chat-row.mine .menja-chat-bubble{background:#f4c542!important;color:#111111!important;border-top-right-radius:3px!important}html.touch-mobile body.customer-mode .menja-chat-row.theirs .menja-chat-bubble{background:#252525!important;border-top-left-radius:3px!important}html.touch-mobile body.customer-mode .menja-chat-text{color:#f5f5f5!important;font-size:15px!important;line-height:1.4!important}html.touch-mobile body.customer-mode .menja-chat-row.mine .menja-chat-text{color:#111111!important;font-weight:700!important}html.touch-mobile body.customer-mode .menja-chat-meta{color:#b8b8b8!important;font-size:10px!important}html.touch-mobile body.customer-mode .menja-chat-row.mine .menja-chat-meta{color:#454545!important;font-weight:700!important}html.touch-mobile body.customer-mode .menja-chat-compose{position:relative!important;display:flex!important;flex:0 0 auto!important;align-items:flex-end!important;gap:6px!important;padding:8px!important;background:#111111!important;border-top:1px solid #ddd!important}html.touch-mobile body.customer-mode .menja-chat-emoji-toggle{width:40px!important;height:44px!important;min-height:44px!important;flex:0 0 40px!important;padding:0!important;background:#252525!important;color:#fff!important;font-size:22px!important}html.touch-mobile body.customer-mode .menja-chat-emoji-picker{left:7px!important;bottom:62px!important;grid-template-columns:repeat(4,42px)!important;max-width:calc(100vw - 45px)!important;padding:8px!important}html.touch-mobile body.customer-mode .menja-chat-emoji-picker button{width:42px!important;height:42px!important;font-size:23px!important}html.touch-mobile body.customer-mode .menja-chat-compose textarea{flex:1 1 auto!important;width:0!important;min-width:0!important;min-height:44px!important;max-height:100px!important;margin:0!important;padding:11px 14px!important;border:0!important;border-radius:22px!important;background:#fff!important;color:#f5f5f5!important;font-size:16px!important}html.touch-mobile body.customer-mode .menja-chat-send{display:flex!important;align-items:center!important;justify-content:center!important;width:44px!important;height:44px!important;min-height:44px!important;flex:0 0 44px!important;padding:0!important;border:0!important;border-radius:50%!important;background:#e0ad22!important;color:#111111!important;font-size:20px!important}html.touch-mobile body.customer-mode .menja-chat-compose textarea{background:#ffffff!important;color:#17212b!important;-webkit-text-fill-color:#17212b!important;caret-color:#e0ad22!important;border:1px solid #c6d0d7!important;box-shadow:0 1px 3px #00000012!important}html.touch-mobile body.customer-mode .menja-chat-compose textarea::placeholder{color:#596873!important;opacity:1!important;-webkit-text-fill-color:#596873!important}html.touch-mobile body.customer-mode .menja-chat-empty{color:#dddddd!important;background:#222222!important}}</style><section class="box menja-chat-shell"><div class="menja-chat-top"><h2>'+esc(title)+'</h2><div class="menja-chat-tools"><button class="btn" type="button" onclick="enableCustomerPushNotifications()">🔔 Notifiche</button>'+menjaSoundToggleButton()+'</div></div><div id="chatMessages" class="menja-chat-messages"><div class="menja-chat-empty">Caricamento messaggi…</div></div><form class="menja-chat-compose" data-customer="'+customerId+'" onsubmit="sendChatMessage(event,this.dataset.customer)"><input id="chatAttachmentInput" type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx" hidden onchange="sendChatAttachment(event,this.parentElement.dataset.customer)"><button class="menja-chat-emoji-toggle" type="button" aria-label="Allega file" title="Allega immagini o documenti" onclick="document.getElementById(&quot;chatAttachmentInput&quot;).click()">📎</button><button class="menja-chat-emoji-toggle" type="button" aria-label="Apri emoji" title="Inserisci emoji" onclick="toggleChatEmojiPicker(event)">😊</button><div id="chatEmojiPicker" class="menja-chat-emoji-picker" hidden><button type="button" onclick="insertChatEmoji(&quot;😀&quot;)">😀</button><button type="button" onclick="insertChatEmoji(&quot;😂&quot;)">😂</button><button type="button" onclick="insertChatEmoji(&quot;😍&quot;)">😍</button><button type="button" onclick="insertChatEmoji(&quot;🥰&quot;)">🥰</button><button type="button" onclick="insertChatEmoji(&quot;😉&quot;)">😉</button><button type="button" onclick="insertChatEmoji(&quot;😊&quot;)">😊</button><button type="button" onclick="insertChatEmoji(&quot;😎&quot;)">😎</button><button type="button" onclick="insertChatEmoji(&quot;😘&quot;)">😘</button><button type="button" onclick="insertChatEmoji(&quot;❤️&quot;)">❤️</button><button type="button" onclick="insertChatEmoji(&quot;👍&quot;)">👍</button><button type="button" onclick="insertChatEmoji(&quot;👏&quot;)">👏</button><button type="button" onclick="insertChatEmoji(&quot;🙏&quot;)">🙏</button><button type="button" onclick="insertChatEmoji(&quot;🎉&quot;)">🎉</button><button type="button" onclick="insertChatEmoji(&quot;🍕&quot;)">🍕</button><button type="button" onclick="insertChatEmoji(&quot;🔥&quot;)">🔥</button><button type="button" onclick="insertChatEmoji(&quot;👌&quot;)">👌</button></div><textarea id="chatMessageInput" class="field" name="body" rows="1" maxlength="2000" required placeholder="Scrivi un messaggio…" style="background:#ffffff!important;color:#111827!important;-webkit-text-fill-color:#111827!important;caret-color:#075e54!important;opacity:1!important;font-weight:500!important;border:1px solid #b8c4cc!important;color-scheme:light!important"></textarea><button class="menja-chat-send" aria-label="Invia messaggio">➤</button></form></section>'}
function toggleChatEmojiPicker(event){event.preventDefault();event.stopPropagation();const picker=document.getElementById("chatEmojiPicker");if(picker)picker.hidden=!picker.hidden}function insertChatEmoji(emoji){const field=document.getElementById("chatMessageInput"),picker=document.getElementById("chatEmojiPicker");if(!field)return;const start=field.selectionStart??field.value.length,end=field.selectionEnd??start;field.setRangeText(emoji,start,end,"end");field.focus();if(picker)picker.hidden=true}let chatRefreshTimer=null;const chatSignedUrlCache=new Map();
function startChatRefresh(customerId){if(chatRefreshTimer)clearInterval(chatRefreshTimer);loadChatMessages(customerId);chatRefreshTimer=setInterval(()=>{if(document.getElementById('chatMessages'))loadChatMessages(customerId);else{clearInterval(chatRefreshTimer);chatRefreshTimer=null}},5000)}
async function loadChatMessages(customerId){const box=document.getElementById('chatMessages');if(!box||box.dataset.chatLoading==='1')return;box.dataset.chatLoading='1';try{const incomingRole=activeProfile?.role==='admin'?'customer':'admin';const{error:readError}=await onlineClient.from('chat_messages').update({read_at:new Date().toISOString()}).eq('customer_id',customerId).eq('sender_role',incomingRole).is('read_at',null);if(readError)console.warn('Aggiornamento conferma lettura chat:',readError);const{data,error}=await onlineClient.from('chat_messages').select('id,sender_id,sender_role,body,created_at,read_at,attachment_path,attachment_name,attachment_type,attachment_size').eq('customer_id',customerId).order('created_at',{ascending:true});if(error)throw error;const rendered=await Promise.all((data||[]).map(async m=>{const mine=m.sender_id===activeUser.id;const time=new Date(m.created_at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});const ticks=mine?'<span class="menja-chat-ticks '+(m.read_at?'read':'received')+'" title="'+(m.read_at?'Letto':'Ricevuto')+'">'+(m.read_at?'✓✓':'✓')+'</span>':'';let attachment='';if(m.attachment_path){let cached=chatSignedUrlCache.get(m.attachment_path);if(!cached||cached.expiresAt<Date.now()){const{data:signed,error:signError}=await onlineClient.storage.from('chat-attachments').createSignedUrl(m.attachment_path,3600);if(signError)console.warn('Link allegato non disponibile:',signError);else if(signed?.signedUrl){cached={url:signed.signedUrl,expiresAt:Date.now()+50*60*1000};chatSignedUrlCache.set(m.attachment_path,cached)}}if(cached?.url){const url=esc(cached.url),name=esc(m.attachment_name||'Allegato'),type=String(m.attachment_type||'');attachment=type.startsWith('image/')?'<a href="'+url+'" target="_blank" rel="noopener"><img src="'+url+'" alt="'+name+'" onload="if(this.closest(&quot;.menja-chat-messages&quot;).dataset.chatStickBottom==1)this.closest(&quot;.menja-chat-messages&quot;).scrollTop=this.closest(&quot;.menja-chat-messages&quot;).scrollHeight" style="display:block;max-width:260px;max-height:240px;object-fit:contain;border-radius:8px;margin-bottom:5px"></a>':'<a href="'+url+'" target="_blank" rel="noopener" download style="display:flex;align-items:center;gap:8px;padding:9px;border-radius:8px;background:#00000012;color:inherit;text-decoration:underline">📄 '+name+' <small>('+Math.max(1,Math.round((Number(m.attachment_size)||0)/1024))+' KB)</small></a>'}}const body=m.attachment_path?'':'<div class="menja-chat-text">'+esc(m.body)+'</div>';return '<div class="menja-chat-row '+(mine?'mine':'theirs')+'" data-message-id="'+esc(m.id)+'"><div class="menja-chat-bubble">'+attachment+body+'<div class="menja-chat-meta"><span>'+time+'</span>'+ticks+'</div></div></div>'}));const keepAtBottom=box.dataset.chatLoaded!=='1'||box.dataset.chatStickBottom==='1'||(box.scrollHeight-box.scrollTop-box.clientHeight<90);let changed=false;if(!rendered.length){const empty='<div class="menja-chat-empty">Nessun messaggio. Inizia tu la conversazione 👋</div>';if(box.innerHTML!==empty){box.innerHTML=empty;changed=true}}else{const existing=new Map([...box.querySelectorAll('.menja-chat-row[data-message-id]')].map(node=>[node.dataset.messageId,node]));const wanted=new Set();for(const markup of rendered){const holder=document.createElement('div');holder.innerHTML=markup;const node=holder.firstElementChild,id=node.dataset.messageId;wanted.add(id);const current=existing.get(id);if(current){if(current.outerHTML!==node.outerHTML){current.replaceWith(node);changed=true}}else{box.appendChild(node);changed=true}}for(const [id,node] of existing){if(!wanted.has(id)){node.remove();changed=true}}}if(changed&&keepAtBottom)requestAnimationFrame(()=>{if(box.isConnected){box.scrollTop=box.scrollHeight;box.dataset.chatStickBottom='1'}});box.dataset.chatLoaded='1';box.dataset.chatStickBottom=keepAtBottom?'1':'0';if(activeProfile?.role==='admin')refreshAdminChatNotifications()}catch(error){console.error('Caricamento chat:',error);box.innerHTML='<div class="menja-chat-empty">Chat temporaneamente non disponibile. Riprova tra poco.</div>'}finally{box.dataset.chatLoading='0'}}
async function sendChatAttachment(event,customerId){const input=event.currentTarget,files=[...(input.files||[])];if(!files.length)return;input.disabled=true;try{for(const file of files){if(file.size>15*1024*1024)throw new Error('Il file "'+file.name+'" supera il limite di 15 MB.');const allowed=['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'];if(!allowed.includes(file.type))throw new Error('Formato non supportato: '+file.name);const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)||'allegato';const path=customerId+'/'+crypto.randomUUID()+'-'+safeName;const{error:uploadError}=await onlineClient.storage.from('chat-attachments').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;const{data:message,error:insertError}=await onlineClient.from('chat_messages').insert({customer_id:customerId,sender_id:activeUser.id,sender_role:activeProfile.role==='admin'?'admin':'customer',body:'📎 '+file.name,attachment_path:path,attachment_name:file.name,attachment_type:file.type,attachment_size:file.size}).select('id').single();if(insertError){await onlineClient.storage.from('chat-attachments').remove([path]);throw insertError}const{error:pushError}=await onlineClient.functions.invoke('send-order-push',{body:{event_type:'chat_message',message_id:message.id}});if(pushError)console.warn('Allegato inviato ma notifica push non inviata:',pushError)}input.value='';await loadChatMessages(customerId)}catch(error){showError(error)}finally{input.disabled=false}}async function sendChatMessage(event,customerId){event.preventDefault();const form=event.currentTarget;const body=String(new FormData(form).get('body')||'').trim();if(!body)return;const{data,error}=await onlineClient.from('chat_messages').insert({customer_id:customerId,sender_id:activeUser.id,sender_role:activeProfile.role==='admin'?'admin':'customer',body}).select('id').single();if(error){showError(error);return}form.reset();const{error:pushError}=await onlineClient.functions.invoke('send-order-push',{body:{event_type:'chat_message',message_id:data.id}});if(pushError)console.warn('Messaggio inviato ma notifica push non inviata:',pushError);if(activeProfile.role==='admin')selectedChatCustomer=customerId;await loadChatMessages(customerId)}
function openAdminChat(id){selectedChatCustomer=id;page='Chat clienti';render()}
function formatCustomerPickupDate(value){if(!value)return '—';const datePart=String(value).split('T')[0];const parts=datePart.split('-');return parts.length===3?parts[2]+'/'+parts[1]+'/'+parts[0]:datePart}
function customerOrderCatalog(){const ids=Array.isArray(activeProfile?.price_list_ids)&&activeProfile.price_list_ids.length?activeProfile.price_list_ids:(activeProfile?.price_list_id?[activeProfile.price_list_id]:[]);return db.priceLists.filter(list=>ids.includes(list.id)).flatMap(list=>priceListProducts(list).map(line=>({...line,list_id:list.id,list_name:list.name||'Listino',product:String(line.product||db.products.find(p=>p.id===line.product_id)?.name||'Prodotto'),price:Number(line.price)||0}))).filter(line=>line.product)}function menjaCustomerOrderForm(){const catalog=customerOrderCatalog();let catalogHtml=catalog.length?catalog.map((item,index)=>'<label class="customer-order-product" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;margin:8px 0"><input type="checkbox" name="order_product" value="'+index+'" style="width:20px;height:20px"><span><strong>'+esc(item.product)+'</strong><small class="muted" style="display:block">'+esc(item.list_name)+'</small><small class="muted">€ '+item.price.toFixed(2)+'</small></span><span><small class="muted">Quantità</small><input class="field" type="number" name="customer_quantity_'+index+'" min="0" step="1" value="0" autocomplete="off" style="width:76px"></span></label>').join(''):'<div class="empty">Non ci sono prodotti nei listini assegnati al tuo account. Contatta il titolare per farti assegnare un listino con i prodotti.</div>';return '<form class="box formgrid" autocomplete="off" onsubmit="submitCustomerOrder(event)"><h2 class="wide">Nuovo ordine</h2><label class="wide">Giorno di ritiro<input class="field" type="date" name="pickup" min="'+new Date().toISOString().slice(0,10)+'" required></label><div class="wide"><h3>Seleziona i prodotti</h3><p class="muted">Spunta i prodotti che desideri e indica la quantità.</p>'+catalogHtml+'</div><label class="wide">Note per il titolare<textarea class="field" name="notes" rows="2" placeholder="Eventuali indicazioni per il tuo ordine"></textarea></label><div class="wide actions"><button class="btn gold" '+(!catalog.length?'disabled':'')+'>Invia ordine</button></div><p class="wide muted">L’orario verrà concordato con il titolare. La richiesta sarà approvata manualmente.</p></form>'}
async function submitCustomerOrder(event){event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));const catalog=customerOrderCatalog();const selected=[...form.querySelectorAll('input[name="order_product"]:checked')];if(!selected.length){alert('Seleziona almeno un prodotto.');return}const lines=selected.map(input=>{const item=catalog[Number(input.value)];const quantity=Number(form.elements['customer_quantity_'+input.value]?.value||0);if(!item||!Number.isInteger(quantity)||quantity<1)throw new Error('Inserisci una quantità maggiore di zero per ogni prodotto selezionato.');return {product:item.product,product_id:item.product_id||null,quantity,unit_price:item.price,price_list_id:item.list_id,price_list_name:item.list_name,line_total:Number((quantity*item.price).toFixed(2))}});const total=Number(lines.reduce((sum,line)=>sum+line.line_total,0).toFixed(2));const obj={id:crypto.randomUUID(),code:'ORD-'+String(Date.now()).slice(-6),customer:activeProfile.full_name||activeProfile.email,customer_id:activeProfile.id,customer_email:activeProfile.email||'',customer_code:activeProfile.customer_code||'',pickup:values.pickup,items:lines.map(line=>line.quantity+' × '+line.product).join(', '),lines,total:total.toFixed(2),notes:values.notes||'',status:'Da approvare',created_at:new Date().toISOString()};try{await persistRecord('orders',obj);db.orders.push(obj);page='Storico ordini';render()}catch(e){showError(e)}}


/* Creazione rapida ordini dalla dashboard amministratore */
function adminNewOrderCustomerChanged(value){
 const field=document.getElementById('adminNewOrderCustomerName');
 if(field)field.closest('label').hidden=value!=='new';
}
function menjaLotAvailableQty(lot,allocations){return Math.max(0,(Number(lot?.qty)||0)-(allocations.get(String(lot?.id))||0))}
function menjaLotsForProduct(product){
 const key=String(product||'').trim().toLocaleLowerCase('it-IT');
 const allocations=menjaLotSoldAllocations();
 return db.lots.filter(l=>String(l.product||'').trim().toLocaleLowerCase('it-IT')===key&&menjaLotAvailableQty(l,allocations)>0).sort((a,b)=>String(a.production_date||a.date||a.created_at||'').localeCompare(String(b.production_date||b.date||b.created_at||'')));
}
function menjaLotOptions(product){
 const allocations=menjaLotSoldAllocations();
 const lots=menjaLotsForProduct(product);
 return '<option value="">Seleziona lotto da scaricare</option>'+lots.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.code||'Lotto')+' · '+esc(l.production_date||l.date||'')+' · disponibili '+menjaLotAvailableQty(l,allocations)+'</option>').join('');
}
function renderAdminOrderBaseLines(listId){
 const target=document.getElementById('adminNewOrderBases');if(!target)return;
 const list=db.priceLists.find(x=>String(x.id)===String(listId)),lines=list?priceListProducts(list):[];
 target.innerHTML=lines.length?lines.map((line,index)=>{
  const product=db.products.find(p=>p.id===line.product_id),name=String(line.product||product?.name||'Prodotto');
  const lots=menjaLotsForProduct(name);
  return '<div style="display:grid;grid-template-columns:auto minmax(0,1fr) 76px 100px;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:10px;margin:7px 0"><input type="checkbox" name="admin_base" value="'+index+'" style="width:19px;height:19px"><span><strong>'+esc(name)+'</strong><small class="muted" style="display:block">'+esc(list.name||'Listino')+'</small><select class="field" name="admin_lot_'+index+'" required style="margin-top:6px">'+menjaLotOptions(name)+'</select></span><input class="field" aria-label="Quantità '+esc(name)+'" type="number" name="admin_qty_'+index+'" min="1" step="1" value="1"><input class="field" aria-label="Prezzo '+esc(name)+'" type="number" name="admin_price_'+index+'" min="0" step="0.01" value="'+esc(line.price??0)+'"></div>';
 }).join(''):'<div class="empty">Questo listino non contiene prodotti. Puoi aggiungere una base manualmente, scegliendo il lotto.</div>';
}
function openAdminNewOrder(){
 if(activeProfile?.role!=='admin')return;
 const customers=db.customers.filter(c=>!c.deleted_at).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
 const lists=db.priceLists.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
 const customerOptions=customers.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name||c.email||'Cliente')+(c.code?' · '+esc(c.code):'')+'</option>').join('');
 const listOptions=lists.map(l=>'<option value="'+esc(l.id)+'">'+esc(l.name||'Listino senza nome')+'</option>').join('');
 document.getElementById('modal').innerHTML='<div class="modal" onclick="if(event.target===this)closeModal()"><form class="dialog" style="width:min(760px,96vw);max-height:90vh;overflow:auto" onsubmit="saveDashboardAdminOrder(event)"><h2>＋ Nuovo ordine</h2><div class="formgrid"><label class="wide">Cliente<select class="field" name="customer_choice" onchange="adminNewOrderCustomerChanged(this.value)"><option value="">Cliente occasionale / non registrato</option>'+customerOptions+'<option value="new">＋ Inserisci nuovo cliente</option></select></label><label class="wide" hidden>Nome o ragione sociale<input class="field" id="adminNewOrderCustomerName" name="customer_name" placeholder="Nome del cliente"></label><label class="wide">Giorno di consegna / ritiro<input class="field" type="date" name="pickup" min="'+lotDateToday()+'" required></label><label class="wide">Listino prezzi<select class="field" name="price_list_id" onchange="renderAdminOrderBaseLines(this.value)"><option value="">Seleziona un listino (facoltativo)</option>'+listOptions+'</select></label><div class="wide"><h3>Basi disponibili nel listino</h3><p class="muted">Seleziona le basi da inserire e modifica quantità o prezzo per questo ordine.</p><div id="adminNewOrderBases"><div class="empty">Seleziona un listino per visualizzare le basi.</div></div></div><div class="wide" style="border-top:1px solid var(--line);padding-top:14px"><h3>Aggiungi una base manualmente</h3><div class="formgrid"><label>Nome base<input class="field" name="manual_product" placeholder="Es. Base classica 30 cm"></label><label>Quantità<input class="field" type="number" name="manual_qty" min="1" step="1" value="1"></label><label>Prezzo unitario (€)<input class="field" type="number" name="manual_price" min="0" step="0.01" placeholder="0,00"></label><label class="wide">Lotto da scaricare<select class="field" name="manual_lot_id"><option value="">Seleziona lotto</option>'+db.lots.slice().sort((a,b)=>String(b.production_date||b.date||'').localeCompare(String(a.production_date||a.date||''))).map(l=>'<option value="'+esc(l.id)+'">'+esc(l.code||'Lotto')+' · '+esc(l.product||'')+' · '+esc(l.production_date||l.date||'')+'</option>').join('')+'</select></label></div></div><label class="wide">Note<textarea class="field" name="notes" rows="2" placeholder="Note per la produzione o la consegna"></textarea></label><div class="wide notice">L’ordine verrà registrato nel gestionale con stato “Confermato”. Il totale sarà calcolato dalle basi selezionate.</div></div><div class="dialogfoot"><button type="button" class="btn" onclick="closeModal()">Annulla</button><button class="btn gold" type="submit">Crea ordine</button></div></form></div>';
}
async function saveDashboardAdminOrder(event){
 event.preventDefault();if(activeProfile?.role!=='admin')return;
 const form=event.currentTarget,values=Object.fromEntries(new FormData(form));
 const choice=String(values.customer_choice||''),customer=customersForDashboardOrder(choice);
 let customerName=customer?.name||customer?.email||'';
 if(choice==='new'||!choice)customerName=String(values.customer_name||'').trim();
 if((choice==='new'||!choice)&&!customerName){alert('Inserisci il nome del cliente oppure selezionane uno registrato.');return}
 const list=db.priceLists.find(x=>String(x.id)===String(values.price_list_id)),catalog=list?priceListProducts(list):[];
 const selected=[...form.querySelectorAll('input[name="admin_base"]:checked')],lines=[];
 for(const input of selected){
  const index=Number(input.value),item=catalog[index];if(!item)throw new Error('Una base selezionata non è più disponibile.');
  const product=db.products.find(p=>p.id===item.product_id),name=String(item.product||product?.name||'Prodotto');
  const quantity=Number(form.elements['admin_qty_'+index]?.value||1),price=Number(form.elements['admin_price_'+index]?.value||0),lotId=String(form.elements['admin_lot_'+index]?.value||'');
  const lot=db.lots.find(l=>String(l.id)===lotId),available=lot?menjaLotAvailableQty(lot,menjaLotSoldAllocations()):0;
  if(!lot||String(lot.product||'').trim().toLocaleLowerCase('it-IT')!==name.trim().toLocaleLowerCase('it-IT'))throw new Error('Seleziona un lotto valido per la base '+name+'.');
  if(!Number.isInteger(quantity)||quantity<1||quantity>available||!Number.isFinite(price)||price<0)throw new Error('La quantità richiesta per '+name+' supera la giacenza del lotto '+(lot.code||'')+'. Disponibili: '+available+'.');
  lines.push({product:name,product_id:item.product_id||null,quantity,unit_price:price,price_list_id:list.id,price_list_name:list.name||'Listino',line_total:Number((quantity*price).toFixed(2)),lot_id:lot.id,lot_code:lot.code});
 }
 const manualName=String(values.manual_product||'').trim(),manualLotId=String(values.manual_lot_id||'');
 if(manualName||manualLotId){
  const lot=db.lots.find(l=>String(l.id)===manualLotId);
  if(!lot){alert('Se aggiungi una base manuale devi selezionare anche il lotto da scaricare.');return}
  const name=manualName||String(lot.product||'').trim(),quantity=Number(values.manual_qty||1),price=Number(values.manual_price||0),available=menjaLotAvailableQty(lot,menjaLotSoldAllocations());
  if(name.toLocaleLowerCase('it-IT')!==String(lot.product||'').trim().toLocaleLowerCase('it-IT')){alert('Il prodotto inserito non corrisponde al prodotto del lotto selezionato.');return}
  if(!Number.isInteger(quantity)||quantity<1||quantity>available||!Number.isFinite(price)||price<0){alert('Quantità o prezzo non validi. Giacenza disponibile del lotto: '+available+'.');return}
  lines.push({product:name,quantity,unit_price:price,line_total:Number((quantity*price).toFixed(2)),manual:true,lot_id:lot.id,lot_code:lot.code});
 }
 if(!lines.length){alert('Seleziona almeno una base e il relativo lotto da scaricare.');return}
 const total=Number(lines.reduce((sum,line)=>sum+line.line_total,0).toFixed(2));
 const order={id:crypto.randomUUID(),code:'ORD-'+String(Date.now()).slice(-6),customer:customerName,customer_id:customer?.isProfile?customer.id:null,customer_email:customer?.email||'',customer_code:customer?.code||customer?.fidelity_code||'',pickup:values.pickup,items:lines.map(line=>line.quantity+' × '+line.product+' ['+line.lot_code+']').join(', '),lines,total:total.toFixed(2),lot_ids:[...new Set(lines.map(line=>line.lot_id))],notes:String(values.notes||'').trim(),status:'Confermato',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:'admin'};
 try{window.__menjaStage='salvataggio nuovo ordine dalla dashboard';await persistRecord('orders',order);db.orders.push(order);closeModal();page='Ordini';selectedAdminOrderId=order.id;render()}catch(error){showError(error)}
}
function customersForDashboardOrder(id){return id&&id!=='new'?db.customers.find(c=>String(c.id)===String(id)&&!c.deleted_at)||null:null}
const menjaOriginalDashboardNewButton=btn;
btn=function(text,fn='openNew()'){if(text==='Nuovo')return '<button class="btn gold" onclick="openAdminNewOrder()">＋ Nuovo ordine</button>';return menjaOriginalDashboardNewButton(text,fn)};

window.showArchivedCustomers=false;
let selectedAdminCustomerId=null,editingAdminOrderId=null;
async function archiveAdminCustomer(id){
 if(activeProfile?.role!=='admin')return;
 const customer=db.customers.find(c=>c.id===id);if(!customer)return;
 if(!confirm('Archiviare il cliente “'+(customer.name||customer.email)+'”? Non comparirà più tra i clienti attivi e il suo accesso verrà sospeso. Gli ordini e lo storico resteranno conservati.'))return;
 try{
  window.__menjaStage='archiviazione cliente';
  if(customer.isProfile){
   const {data,error}=await onlineClient.from('profiles').update({deleted_at:new Date().toISOString(),approval_status:'suspended'}).eq('id',id).select('id').single();
   if(error)throw error;if(!data)throw new Error('Cliente non archiviato: verifica i permessi.');
  }else{
   const {data:record,error:readError}=await onlineClient.from('records').select('payload').eq('id',id).eq('kind','customers').single();
   if(readError)throw readError;if(!record)throw new Error('Cliente non trovato.');
   const payload={...(record.payload||{}),deleted_at:new Date().toISOString()};
   const {error}=await onlineClient.from('records').update({payload}).eq('id',id).eq('kind','customers');if(error)throw error;
  }
  await menjaWriteAudit('archiviato',customer.isProfile?'profiles':'customers',id,customer,{...customer,deleted_at:new Date().toISOString()});
  selectedAdminCustomerId=null;await loadOnlineData();page='Clienti';render();
 }catch(error){showError(error)}
}
async function restoreAdminCustomer(id){
 if(activeProfile?.role!=='admin')return;
 try{
  window.__menjaStage='ripristino cliente';
  const customer=db.customers.find(c=>String(c.id)===String(id));
  if(customer?.isProfile){
   const {data,error}=await onlineClient.from('profiles').update({deleted_at:null,approval_status:'suspended'}).eq('id',id).select('id').single();
   if(error)throw error;if(!data)throw new Error('Cliente non ripristinato.');
  }else{
   const {data:record,error:readError}=await onlineClient.from('records').select('payload').eq('id',id).eq('kind','customers').single();
   if(readError)throw readError;if(!record)throw new Error('Cliente non trovato.');
   const payload={...(record.payload||{}),deleted_at:null};
   const {error}=await onlineClient.from('records').update({payload}).eq('id',id).eq('kind','customers');if(error)throw error;
  }
  await menjaWriteAudit('ripristinato',customer?.isProfile?'profiles':'customers',id,customer,{...customer,deleted_at:null});
  await loadOnlineData();render();
 }catch(error){showError(error)}
}
function toggleArchivedCustomers(){window.showArchivedCustomers=!window.showArchivedCustomers;render()}

function openAdminCustomer(id){if(activeProfile?.role!=='admin')return;selectedAdminCustomerId=id;editingAdminOrderId=null;page='Scheda cliente';render()}
async function deleteAdminOrder(id){
 if(activeProfile?.role!=='admin')return;
 const order=db.orders.find(o=>String(o.id)===String(id));if(!order)return;
 const customer=orderCustomerName(order);
 if(!confirm('ATTENZIONE: stai per eliminare definitivamente l’ordine '+(order.code||'')+' di '+customer+'.\n\nL’ordine verrà cancellato dallo storico e le quantità dei lotti torneranno disponibili.\n\nConfermi l’eliminazione?'))return;
 try{
  window.__menjaStage='eliminazione ordine';
  const {data,error}=await onlineClient.from('records').delete().eq('id',id).eq('kind','orders').select('id').maybeSingle();
  if(error)throw error;if(!data)throw new Error('Ordine non eliminato: verifica i permessi.');
  await menjaWriteAudit('eliminato','orders',id,order,null);
  db.orders=db.orders.filter(o=>String(o.id)!==String(id));
  const customerProfile=db.customers.find(c=>c.isProfile&&(String(c.id)===String(order.customer_id)||String(c.email||'')===String(order.customer_email||'')||(order.customer_code&&String(c.code||'')===String(order.customer_code))||(order.customer&&String(c.name||'').trim().toLocaleLowerCase('it-IT')===String(order.customer).trim().toLocaleLowerCase('it-IT'))));
  const recipientId=order.customer_id||customerProfile?.id||null;
  if(recipientId){
   const title='Ordine eliminato';
   const body='Il tuo ordine '+(order.code||'')+' è stato eliminato dal titolare.';
   const {error:noticeError}=await onlineClient.from('notifications').insert({user_id:recipientId,order_id:String(id),order_code:String(order.code||''),notification_type:'order_deleted',title,body});
   if(noticeError)console.error('Ordine eliminato ma notifica interna non salvata:',noticeError);
   const {error:pushError}=await onlineClient.functions.invoke('send-order-push',{body:{event_type:'order_deleted',user_id:recipientId,title,body}});
   if(pushError)console.warn('Ordine eliminato ma notifica push non inviata:',pushError);
  }else console.warn('Ordine eliminato senza notifica: cliente associato non identificato.',order);
  await loadOnlineData();render();
 }catch(error){showError(error)}
}
function orderCustomerName(order){if(order?.customer&&String(order.customer).trim())return order.customer;const customer=db.customers.find(c=>String(c.id)===String(order?.customer_id));return customer?.name||order?.customer_name||order?.customer_email||'Cliente non identificato'}
function adminCustomerOrders(customer){const code=String(customer?.code||customer?.fidelity_code||'').trim();const name=String(customer?.name||'').trim().toLocaleLowerCase('it-IT');return db.orders.filter(o=>{if(customer?.isProfile&&o.customer_id)return o.customer_id===customer.id;const orderCode=String(o.customer_code||'').trim();if(code&&orderCode)return code===orderCode;return String(o.customer||'').trim().toLocaleLowerCase('it-IT')===name})}

function adminOrderEditor(order,customer){
 const o=order||{},date=String(o.pickup||'').split('T')[0],statuses=['Da approvare','Confermato','In produzione','Pronto per il ritiro','Consegnato','Ritirato','Pagato','Rifiutato','Annullato'];

 return '<section class="box" style="margin-bottom:16px"><h2>'+(order?'Modifica ordine '+esc(o.code||''):'Aggiungi ordine')+'</h2><form class="formgrid" onsubmit="saveAdminCustomerOrder(event)" data-customer-id="'+esc(customer.id)+'"><label>Giorno di ritiro<input class="field" type="date" name="pickup" value="'+esc(date)+'" required></label><label>Importo totale (€)<input class="field" type="number" name="total" min="0" step="0.01" value="'+esc(o.total??'')+'"></label><label class="wide">Prodotti e quantità<textarea class="field" name="items" rows="4" required placeholder="Es. 2 Margherite, 1 teglia...">'+esc(o.items||'')+'</textarea></label><label class="wide">Note<textarea class="field" name="notes" rows="2" placeholder="Note per la preparazione o il ritiro">'+esc(o.notes||'')+'</textarea></label><label class="wide">Stato ordine<select class="field" name="status">'+statuses.map(st=>'<option value="'+esc(st)+'" '+(String(o.status||'Da approvare')===st?'selected':'')+'>'+esc(st)+'</option>').join('')+'</select></label><div class="wide notice">Il magazzino scala automaticamente le quantità quando l’ordine viene segnato come “Ritirato”. Le basi vengono attribuite ai lotti più vecchi disponibili (FIFO), senza selezionare il lotto a mano.</div><div class="wide dialogfoot"><button type="button" class="btn" onclick="cancelAdminOrderEdit()">Annulla</button><button class="btn gold" type="submit">Salva ordine</button></div></form></section>';
}
function adminCustomerOrderTrend(orders){
 const valid=orders.filter(o=>!['Annullato','Rifiutato'].includes(String(o.status||'')));
 const now=new Date(),months=[];
 for(let offset=11;offset>=0;offset--){const d=new Date(now.getFullYear(),now.getMonth()-offset,1);months.push({key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:d.toLocaleDateString('it-IT',{month:'short'}).replace('.',''),orders:0,revenue:0})}
 const byKey=new Map(months.map(m=>[m.key,m]));
 valid.forEach(o=>{const raw=o.created_at||o.pickup||o.updated_at;if(!raw)return;const d=new Date(raw);if(Number.isNaN(d.getTime()))return;const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),m=byKey.get(key);if(m){m.orders++;m.revenue+=Math.max(0,Number(o.total)||0)}});
 const total=valid.length,monthNow=months[11],previous=months[10],peak=months.reduce((best,m)=>m.orders>best.orders?m:best,months[0]),average=months.reduce((sum,m)=>sum+m.orders,0)/12;
 const delta=monthNow.orders-previous.orders,deltaText=delta>0?'+'+delta+' rispetto al mese scorso':delta<0?delta+' rispetto al mese scorso':'in linea con il mese scorso';
 const max=Math.max(1,...months.map(m=>m.orders)),W=900,H=290,left=42,right=16,top=20,bottom=48,plotW=W-left-right,plotH=H-top-bottom,step=plotW/12,barW=Math.min(42,step*.58);
 const grid=[0,1,2,3,4].map(i=>{const value=Math.ceil(max/4*i),y=top+plotH-(value/max)*plotH;return '<line x1="'+left+'" y1="'+y.toFixed(1)+'" x2="'+(W-right)+'" y2="'+y.toFixed(1)+'" stroke="currentColor" opacity=".12"/><text x="'+(left-10)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-size="11" fill="currentColor" opacity=".7">'+value+'</text>'}).join('');
 const bars=months.map((m,i)=>{const height=m.orders/max*plotH,x=left+i*step+(step-barW)/2,y=top+plotH-height;return '<g><title>'+m.label+': '+m.orders+' ordini · € '+m.revenue.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'</title><rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(0,height).toFixed(1)+'" rx="6" fill="#c89b45" opacity="'+(m===monthNow?1:.78)+'"/>'+(m.orders?'<text x="'+(x+barW/2).toFixed(1)+'" y="'+Math.max(13,y-7).toFixed(1)+'" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">'+m.orders+'</text>':'')+'<text x="'+(left+i*step+step/2).toFixed(1)+'" y="'+(H-18)+'" text-anchor="middle" font-size="11" fill="currentColor" opacity=".8">'+esc(m.label)+'</text></g>'}).join('');
 const status=delta>0?'In aumento':delta<0?'In calo':'Stabile';
 return '<details class="box" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;padding:2px 0">Andamento ordini · ultimi 12 mesi <span class="muted" style="font-weight:400">· Apri grafico e analisi</span></summary><div style="margin-top:16px"><div class="grid four" style="gap:10px;margin-bottom:14px"><div class="box"><small class="muted">ORDINI TOTALI</small><h2 style="margin:5px 0">'+total+'</h2><small class="muted">non annullati / rifiutati</small></div><div class="box"><small class="muted">ULTIMO MESE</small><h2 style="margin:5px 0">'+monthNow.orders+'</h2><small class="muted">'+esc(deltaText)+'</small></div><div class="box"><small class="muted">MEDIA MENSILE</small><h2 style="margin:5px 0">'+average.toLocaleString('it-IT',{maximumFractionDigits:1})+'</h2><small class="muted">ordini / mese · 12 mesi</small></div><div class="box"><small class="muted">MESE PIÙ ATTIVO</small><h2 style="margin:5px 0">'+esc(peak.label)+'</h2><small class="muted">'+peak.orders+' ordini</small></div></div><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><strong>Ordini ricevuti per mese</strong><span class="badge">'+status+'</span></div><div style="width:100%;overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Grafico degli ordini mensili degli ultimi dodici mesi" style="width:100%;min-width:560px;height:auto;display:block;margin-top:8px">'+grid+bars+'</svg></div><div class="muted" style="font-size:12px">Passa il mouse sulle colonne per vedere anche il valore degli ordini del mese. I mesi senza ordini restano visibili a zero. Per il periodo viene usata la data di creazione dell’ordine; se assente, la data di ritiro.</div><div class="grid two" style="margin-top:12px"><div><small class="muted">ORDINI ULTIMO MESE</small><div><strong>'+monthNow.orders+'</strong> · '+(delta>0?'in crescita':delta<0?'in diminuzione':'nessuna variazione')+'</div></div><div><small class="muted">VALORE ULTIMO MESE</small><div><strong>€ '+monthNow.revenue.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong></div></div></div></div></details>';
}
function adminCustomerDetailPage(){
 const customer=db.customers.find(c=>c.id===selectedAdminCustomerId);
 if(!customer)return '<div class="box"><h2>Cliente non trovato</h2><button class="btn" onclick="navigate(\'Clienti\')">Torna ai clienti</button></div>';
 const orders=adminCustomerOrders(customer).slice().sort((a,b)=>String(b.pickup||'').localeCompare(String(a.pickup||'')));
 const editing=editingAdminOrderId&&editingAdminOrderId!=='new'?orders.find(o=>o.id===editingAdminOrderId):null;
 const rows=orders.map(o=>[esc(o.code||'—'),esc(formatCustomerPickupDate(o.pickup)),esc(o.items||'—'),o.total!==undefined&&o.total!==''?'€ '+esc(o.total):'Da definire',`<span class="badge">${esc(o.status||'Da approvare')}</span>`,`<button class="smallbtn" onclick="editAdminCustomerOrder('${o.id}')">Modifica</button>`]);
 const registered=customer.created_at?new Date(customer.created_at).toLocaleString('it-IT'):'—';
 const fields=[
  ['Tipo cliente',customer.customer_type==='azienda'?'Azienda':'Privato'],
  [customer.customer_type==='azienda'?'Ragione sociale':'Nome e cognome',customer.name],
  ['Email',customer.email],
  ['Telefono',customer.phone],
  ['Partita IVA',customer.customer_type==='azienda'?customer.vat_number:'—'],
  ['Indirizzo',customer.customer_type==='azienda'?customer.street_address:'—'],
  ['Codice destinatario / PEC',customer.customer_type==='azienda'?customer.recipient_code_or_pec:'—'],
  ['Codice cliente',customer.code||'—'],
  ['Categoria',customer.category||'—'],
  ['Stato account',customer.status||'—'],
  ['Registrato il',registered],
  ['Punti fidelity',String(customer.points??0)]
 ];
 const anagrafica=fields.map(([label,value])=>`<div style="padding:11px 12px;border:1px solid var(--line);border-radius:10px"><small class="muted" style="display:block;margin-bottom:4px">${esc(label)}</small><strong style="overflow-wrap:anywhere">${esc(value||'—')}</strong></div>`).join('');
 const privateLoyalty=String(customer.customer_type||'privato').trim().toLowerCase()!=='azienda'?'<section class="admin-loyalty-card"><div class="admin-loyalty-left"><img class="admin-loyalty-logo" src="./menjaimut.jpg" alt="Logo originale Menja i Mut Pizza Lab"><div class="admin-loyalty-name">'+esc(customer.name||'Cliente')+'</div><div class="admin-loyalty-code-label">CODICE CLIENTE</div><div class="admin-loyalty-code">'+esc(customer.code||'In assegnazione')+'</div></div><div class="admin-loyalty-points"><strong>'+Math.max(0,Number(customer.points??customer.fidelity_points)||0)+'</strong><span>PUNTI</span></div><div class="admin-loyalty-tricolore" aria-hidden="true"></div></section>':'';

 return `<div class="head"><div><h1>${esc(customer.name||customer.email||'Cliente')}</h1><div class="muted">${esc(customer.email||'')} · Codice ${esc(customer.code||'—')}</div></div><div class="actions"><button class="btn" onclick="navigate('Clienti')">← Clienti</button>${customer.isProfile&&!customer.deleted_at?`<button class="btn" onclick="archiveAdminCustomer('${customer.id}')">Archivia cliente</button>`:''}<button class="btn gold" onclick="startAdminOrderCreate()">＋ Aggiungi ordine</button></div></div><details class="box" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;padding:2px 0">Anagrafica cliente <span class="muted" style="font-weight:400">· Mostra o nascondi i dati</span></summary><div class="grid two" style="margin-top:16px">${anagrafica}</div></details>${privateLoyalty}<form class="box" style="margin:16px 0" data-customer-id="${esc(customer.id)}" onsubmit="saveAdminCustomerCode(event)"><h2>Codice cliente</h2><p class="muted">Puoi modificare il codice. Deve essere univoco e avere il formato C seguito da numeri.</p><div class="grid two"><label>Codice cliente<input class="field" name="customer_code" value="${esc(customer.code||'')}" maxlength="20" pattern="C[0-9]+" required placeholder="Es. C031"></label><div class="dialogfoot" style="align-self:end"><button class="btn gold" type="submit">Salva codice</button></div></div></form>${adminCustomerPriceListBlock(customer)}${adminCustomerOrderTrend(orders)}${editing?adminOrderEditor(editing,customer):''}${editingAdminOrderId==='new'?adminOrderEditor(null,customer):''}<div class="box"><h2>Storico ordini · ${orders.length}</h2>${orders.length?table(['Ordine','Ritiro','Prodotti e quantità','Totale','Stato','Azioni'],rows):'<div class="empty">Nessun ordine registrato per questo cliente.</div>'}</div>`
}
function startAdminOrderCreate(){if(activeProfile?.role!=='admin')return;editingAdminOrderId='new';render()}
function editAdminCustomerOrder(id){if(activeProfile?.role!=='admin')return;editingAdminOrderId=id;render()}
function cancelAdminOrderEdit(){editingAdminOrderId=null;render()}
async function saveAdminCustomerOrder(event){event.preventDefault();if(activeProfile?.role!=='admin')return;const form=event.currentTarget;const customer=db.customers.find(c=>c.id===form.dataset.customerId);if(!customer){showError(new Error('Cliente non trovato'));return}const formData=new FormData(form);const values=Object.fromEntries(formData);const previous=editingAdminOrderId&&editingAdminOrderId!=='new'?db.orders.find(o=>o.id===editingAdminOrderId):null;const order={...(previous||{}),id:previous?.id||crypto.randomUUID(),code:previous?.code||'ORD-'+String(Date.now()).slice(-6),customer:customer.name||customer.email||'',customer_id:customer.isProfile?customer.id:(previous?.customer_id||null),customer_email:customer.email||'',customer_code:customer.code||customer.fidelity_code||'',pickup:values.pickup,items:String(values.items||'').trim(),total:values.total===''?'':Number(values.total),notes:String(values.notes||'').trim(),status:values.status||'Da approvare',lot_ids:previous?.lot_ids||[],created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),created_by:'admin'};try{window.__menjaStage=previous?'aggiornamento ordine cliente':'creazione ordine cliente';await persistRecord('orders',order);await loadOnlineData();editingAdminOrderId=null;render()}catch(error){showError(error)}}
function customerIsCompany(){return activeProfile?.role==='customer'&&activeProfile?.customer_type==='azienda'}
function customerCompanySummaryPage(){const allOrders=db.orders.filter(o=>o.customer_id?String(o.customer_id)===String(activeProfile.id):(o.customer_code&&activeProfile.customer_code&&String(o.customer_code)===String(activeProfile.customer_code)));const excluded=['Rifiutato','Annullato','Annullata','Cancellato','Cancellata'];const validOrders=allOrders.filter(o=>!excluded.includes(String(o.status||'')));const unpaid=validOrders.filter(o=>String(o.status||'')!=='Pagato');const balance=unpaid.reduce((sum,o)=>sum+(Number(o.total)||0),0);const money=n=>'€ '+Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});const quantities={};for(const order of validOrders){if(Array.isArray(order.lines)&&order.lines.length){for(const line of order.lines){const name=String(line.product||line.product_name||'Prodotto').trim()||'Prodotto';quantities[name]=(quantities[name]||0)+(Number(line.quantity)||0)}}else{const text=String(order.items||'');const re=/(\d+)\s*[×x]\s*([^,;]+)/gi;let match;while((match=re.exec(text))!==null){const name=match[2].replace(/\s*\[[^\]]*\]\s*$/,'').trim()||'Prodotto';quantities[name]=(quantities[name]||0)+Number(match[1])}}}const quantityRows=Object.entries(quantities).sort((a,b)=>a[0].localeCompare(b[0],'it')).map(([name,count])=>[esc(name),count]);const unpaidRows=unpaid.slice().sort((a,b)=>String(b.created_at||b.pickup||'').localeCompare(String(a.created_at||a.pickup||''))).map(o=>[esc(o.code||'—'),esc(formatCustomerPickupDate(o.pickup)),esc(o.items||'—'),money(o.total),esc(o.status||'Da pagare')]);return '<div class="head"><div><h1>Resoconto aziendale</h1><div class="muted">Situazione ordini e saldo ancora da pagare</div></div></div><div class="grid two" style="margin-bottom:16px"><div class="card"><small>SALDO DA PAGARE</small><div class="metric">'+money(balance)+'</div><small class="muted">'+unpaid.length+' ordini non ancora saldati</small></div><div class="card"><small>BASE TOTALI ORDINATE</small><div class="metric">'+Object.values(quantities).reduce((a,b)=>a+b,0)+'</div><small class="muted">Quantità per prodotto nello storico ordini</small></div></div><section class="box" style="margin-bottom:16px"><h2>Basi ordinate per tipo</h2>'+(quantityRows.length?table(['Tipo di base / prodotto','Quantità'],quantityRows):'<div class="empty">Non risultano ancora basi ordinate.</div>')+'</section><section class="box"><h2>Ordini ancora da pagare · '+unpaid.length+'</h2><p class="muted">Gli ordini già pagati non vengono mostrati in questo resoconto.</p>'+(unpaidRows.length?table(['Ordine','Ritiro','Prodotti e quantità','Importo','Stato'],unpaidRows):'<div class="empty">Non ci sono ordini da pagare.</div>')+'</section>'}

function customerLoyaltyCard(){const name=activeProfile?.full_name||activeProfile?.email||'Cliente Menja i Mut';const code=activeProfile?.customer_code||'In assegnazione';const points=Number(activeProfile?.fidelity_points)||0;return '<section class="loyalty-card"><div class="loyalty-card-top"><div class="loyalty-brand"><img src="menjaimut.jpg" alt="Menja i Mut"><div><strong>MENJA I MUT</strong><small>PIZZA LAB · FIDELITY CLUB</small></div></div><span class="loyalty-chip">CLIENTE</span></div><div class="loyalty-card-middle"><small>TESSERA PERSONALE</small><h2>'+esc(name)+'</h2><div class="loyalty-code-label">CODICE CLIENTE</div><div class="loyalty-code">'+esc(code)+'</div></div><div class="loyalty-card-bottom"><div><small>I TUOI PUNTI</small><strong>'+points+'</strong></div><div class="loyalty-card-mark">M<span>✦</span>M</div></div></section>'}

let selectedPriceListId=null,priceListDraft=null;
function priceListProducts(list){return Array.isArray(list?.products)?list.products:(list?.product?[{product:list.product,price:list.price}]:[])}
function priceListLineHTML(line,products){return '<div class="price-list-line" style="display:grid;grid-template-columns:minmax(0,2fr) minmax(100px,1fr) auto;gap:10px;align-items:end;margin:10px 0"><label>Prodotto<select class="field" name="product_id" required><option value="">Seleziona prodotto</option>'+products.map(p=>'<option value="'+esc(p.id)+'" '+(line.product_id===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></label><label>Prezzo (€)<input class="field" type="number" name="price" min="0" step="0.01" value="'+esc(line.price??'')+'" required></label><button type="button" class="smallbtn" onclick="removePriceListLine(this)">Rimuovi</button></div>'}
function priceListAdminPage(){if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';const lists=db.priceLists.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));if(priceListDraft){const products=db.products.filter(p=>p.active!==false);return '<div class="head"><div><h1>'+(priceListDraft.id?'Modifica listino':'Nuovo listino')+'</h1><div class="muted">Definisci un nome e i prezzi dei prodotti</div></div><button class="btn" onclick="cancelPriceListEdit()">← Indietro</button></div><form class="box" onsubmit="savePriceList(event)"><div class="formgrid"><label class="wide">Nome listino<input class="field" name="name" value="'+esc(priceListDraft.name||'')+'" required placeholder="Es. Listino Hotel"></label><label class="wide">Nota (facoltativa)<input class="field" name="description" value="'+esc(priceListDraft.description||'')+'" placeholder="Condizioni o validità"></label></div><h2 style="margin-top:22px">Prodotti e prezzi</h2><div id="priceListLines">'+priceListDraft.products.map(line=>priceListLineHTML(line,products)).join('')+'</div><div class="actions" style="margin-top:12px"><button type="button" class="btn" onclick="addPriceListLine()">＋ Aggiungi prodotto</button></div><div class="dialogfoot"><button type="button" class="btn" onclick="cancelPriceListEdit()">Annulla</button><button class="btn gold" type="submit">Salva listino</button></div></form>'}const rows=lists.map(l=>[esc(l.name||'Listino senza nome'),priceListProducts(l).length,db.customers.filter(c=>(Array.isArray(c.price_list_ids)&&c.price_list_ids.length?c.price_list_ids:(c.price_list_id?[c.price_list_id]:[])).includes(l.id)).length,'<button class="smallbtn" onclick="editPriceList(\''+l.id+'\')">Modifica</button> <button class="smallbtn" onclick="deletePriceList(\''+l.id+'\')">Elimina</button>']);return '<div class="head"><div><h1>Listini prezzi</h1><div class="muted">Crea listini diversi e assegna a ogni cliente quello corretto</div></div><button class="btn gold" onclick="newPriceList()">＋ Nuovo listino</button></div><div class="box">'+(lists.length?table(['Nome listino','Prodotti','Clienti assegnati','Azioni'],rows):'<div class="empty">Non hai ancora creato listini. Crea il primo listino per iniziare.</div>')+'</div><div class="box"><h2>Catalogo prodotti</h2><p class="muted">I prodotti da inserire nei listini si gestiscono nel catalogo.</p><button class="btn" onclick="navigate(\'Prodotti\')">Apri prodotti e ricette →</button></div>'}
function newPriceList(){selectedPriceListId=null;priceListDraft={name:'',description:'',products:[]};render()}
function editPriceList(id){const list=db.priceLists.find(x=>x.id===id);if(!list)return;selectedPriceListId=id;priceListDraft={...list,products:priceListProducts(list).map(x=>({...x}))};render()}
function cancelPriceListEdit(){priceListDraft=null;selectedPriceListId=null;render()}
function addPriceListLine(){if(!priceListDraft)return;const host=document.getElementById('priceListLines');if(host)host.insertAdjacentHTML('beforeend',priceListLineHTML({},db.products.filter(p=>p.active!==false)))}
function removePriceListLine(button){button.closest('.price-list-line')?.remove()}
async function savePriceList(event){event.preventDefault();if(activeProfile?.role!=='admin'||!priceListDraft)return;const form=event.currentTarget,values=Object.fromEntries(new FormData(form));const ids=[...form.querySelectorAll('select[name="product_id"]')].map(x=>x.value),prices=[...form.querySelectorAll('input[name="price"]')].map(x=>x.value);if(!ids.length){alert('Aggiungi almeno un prodotto al listino.');return}if(ids.some(id=>!id)||new Set(ids).size!==ids.length){alert('Seleziona prodotti validi e non ripetuti.');return}const lines=ids.map((id,i)=>{const p=db.products.find(x=>x.id===id);if(!p)throw new Error('Prodotto non trovato');return {product_id:id,product:p.name,price:Number(prices[i])}});const list={...(db.priceLists.find(x=>x.id===selectedPriceListId)||{}),id:selectedPriceListId||crypto.randomUUID(),name:String(values.name||'').trim(),description:String(values.description||'').trim(),products:lines,updated_at:new Date().toISOString()};try{await persistRecord(onlineKinds.priceLists,list);await loadOnlineData();priceListDraft=null;selectedPriceListId=null;render()}catch(e){showError(e)}}
async function deletePriceList(id){if(activeProfile?.role!=='admin')return;if(db.customers.some(c=>(Array.isArray(c.price_list_ids)&&c.price_list_ids.length?c.price_list_ids:(c.price_list_id?[c.price_list_id]:[])).includes(id))){alert('Questo listino è assegnato a uno o più clienti. Riassegna prima quei clienti.');return}if(!confirm('Eliminare questo listino?'))return;try{const {error}=await onlineClient.from('records').delete().eq('id',id).eq('kind','pricelists');if(error)throw error;await menjaWriteAudit('eliminato','pricelists',id,db.priceLists.find(x=>String(x.id)===String(id)),null);await loadOnlineData();render()}catch(e){showError(e)}}
async function saveCustomerPriceLists(event){event.preventDefault();if(activeProfile?.role!=='admin')return;const form=event.currentTarget,customer=db.customers.find(c=>c.id===form.dataset.customerId);if(!customer)return;const ids=[...form.querySelectorAll('input[name="price_list_ids"]:checked')].map(x=>x.value);try{const{error}=await onlineClient.from('profiles').update({price_list_ids:ids,price_list_id:ids[0]||null}).eq('id',customer.id);if(error)throw error;customer.price_list_ids=ids;customer.price_list_id=ids[0]||'';render()}catch(e){showError(e)}}
async function saveAdminCustomerCode(event){
 event.preventDefault();
 if(activeProfile?.role!=='admin')return;
 const form=event.currentTarget;
 const customerId=String(form?.dataset?.customerId||'');
 const code=String(new FormData(form).get('customer_code')||'').trim().toUpperCase();
 if(!customerId){showError(new Error('Identificativo cliente mancante.'));return}
 if(!/^C[0-9]+$/.test(code)){alert('Inserisci un codice nel formato C031, composto da C e numeri.');return}
 const customer=db.customers.find(c=>String(c.id)===customerId);
 if(!customer){showError(new Error('Il cliente selezionato non è presente nell’elenco aggiornato. Ricarica la pagina e riprova.'));return}
 const duplicate=db.customers.find(c=>String(c.id)!==customerId&&String(c.code||c.fidelity_code||'').trim().toUpperCase()===code);
 if(duplicate){alert('Il codice '+code+' è già assegnato a '+(duplicate.name||duplicate.email||'un altro cliente')+'. Scegli un codice diverso.');return}
 const button=form.querySelector('button[type="submit"]');
 const originalText=button?.textContent||'Salva codice';
 if(button){button.disabled=true;button.textContent='Salvataggio...'}
 window.__menjaStage='salvataggio codice cliente';
 try{
  if(customer.isProfile){
   const {data,error}=await onlineClient.from('profiles').update({customer_code:code}).eq('id',customerId).select('id,customer_code').single();
   if(error)throw error;
   if(!data)throw new Error('Il database non ha restituito il cliente aggiornato.');
  }else{
   const {data:record,error:readError}=await onlineClient.from('records').select('payload').eq('id',customerId).eq('kind','customers').eq('owner_id',activeUser.id).single();
   if(readError)throw readError;
   if(!record)throw new Error('Non trovo la scheda del cliente manuale da aggiornare.');
   const payload={...(record.payload||{}),code,fidelity_code:code};
   const {data,error}=await onlineClient.from('records').update({payload}).eq('id',customerId).eq('kind','customers').eq('owner_id',activeUser.id).select('id').single();
   if(error)throw error;
   if(!data)throw new Error('Il database non ha confermato il salvataggio del cliente manuale.');
  }
  window.__menjaStage='aggiornamento elenco clienti';
  await loadOnlineData();
  render();
  alert('Codice cliente '+code+' salvato correttamente.');
 }catch(error){
  showError(error);
  if(button){button.disabled=false;button.textContent=originalText}
 }
}
function adminCustomerPriceListBlock(customer){const assigned=Array.isArray(customer.price_list_ids)&&customer.price_list_ids.length?customer.price_list_ids:(customer.price_list_id?[customer.price_list_id]:[]);return '<form class="box" style="margin:16px 0" data-customer-id="'+esc(customer.id)+'" onsubmit="saveCustomerPriceLists(event)"><h2>Listini assegnati</h2><p class="muted">Puoi assegnare più listini allo stesso cliente. Seleziona tutti quelli che deve poter consultare.</p>'+(db.priceLists.length?db.priceLists.map(l=>'<label style="display:flex;align-items:center;gap:10px;margin:10px 0"><input type="checkbox" name="price_list_ids" value="'+esc(l.id)+'" '+(assigned.includes(l.id)?'checked':'')+'><span><strong>'+esc(l.name||'Listino senza nome')+'</strong>'+(l.description?'<small class="muted" style="display:block">'+esc(l.description)+'</small>':'')+'</span></label>').join(''):'<div class="empty">Non hai ancora creato listini. Vai nella sezione Listini per crearne uno.</div>')+'<div class="dialogfoot"><button class="btn gold" type="submit" '+(!db.priceLists.length?'disabled':'')+'>Salva assegnazioni</button></div></form>'}
function customerPriceListPage(){const ids=Array.isArray(activeProfile?.price_list_ids)&&activeProfile.price_list_ids.length?activeProfile.price_list_ids:(activeProfile?.price_list_id?[activeProfile.price_list_id]:[]);const lists=db.priceLists.filter(x=>ids.includes(x.id));if(!lists.length)return '<div class="head"><div><h1>I miei listini</h1><div class="muted">Prezzi riservati al tuo account</div></div></div><div class="box empty">Non è ancora stato assegnato un listino al tuo account. Contatta il titolare per informazioni.</div>';return '<div class="head"><div><h1>I miei listini</h1><div class="muted">'+lists.length+' listin'+(lists.length===1?'o':'i')+' riservat'+(lists.length===1?'o':'i')+' al tuo account</div></div></div>'+lists.map(list=>{const products=priceListProducts(list);return '<section class="box" style="margin-bottom:16px"><h2>'+esc(list.name||'Listino senza nome')+'</h2>'+(list.description?'<p class="muted">'+esc(list.description)+'</p>':'')+(products.length?table(['Prodotto','Prezzo unitario'],products.map(p=>[esc(p.product),'€ '+Number(p.price||0).toFixed(2)])):'<div class="empty">Il listino non contiene ancora prodotti.</div>')+'</section>'}).join('')}
let selectedAdminOrderId=null;
let showOnlyNewOrders=false;
function toggleNewOrdersFilter(){showOnlyNewOrders=!showOnlyNewOrders;render()}
let adminOrderLotDraft={counts:{},values:{}};
function openAdminOrder(id){dismissOwnerOrderNotice();selectedAdminOrderId=id;adminOrderLotDraft={counts:{},values:{}};const order=db.orders.find(o=>String(o.id)===String(id));(order?.lines||[]).forEach((line,index)=>adminOrderLotDraft.counts[index]=1);page='Ordini';render()}
function captureAdminOrderLotDraft(){
 const form=document.getElementById('adminOrderLotForm');if(!form)return;
 const data=new FormData(form);adminOrderLotDraft.values={};
 for(const [key,value] of data.entries())adminOrderLotDraft.values[key]=value;
}
function addAdminOrderLotRow(lineIndex){
 captureAdminOrderLotDraft();
 adminOrderLotDraft.counts[lineIndex]=(adminOrderLotDraft.counts[lineIndex]||1)+1;
 render();
}
function adminOrderLotAssignmentPanel(order){
 const lines=Array.isArray(order.lines)?order.lines:[];
 if(!lines.length)return '<section class="box"><h2>Assegnazione lotti obbligatoria</h2><div class="notice">Questo ordine non contiene il dettaglio strutturato dei prodotti. Non è possibile assegnare i lotti in sicurezza: verifica il dettaglio dell’ordine prima di approvarlo.</div></section>';
 const sold=menjaLotSoldAllocations();
 const rows=lines.map((line,index)=>{
  const product=String(line.product||line.name||'Prodotto').trim(),needed=Number(line.quantity??line.qty)||0;
  const candidates=db.lots.filter(l=>String(l.product||'').trim().toLocaleLowerCase('it-IT')===product.toLocaleLowerCase('it-IT')&&!['In quarantena','Bloccato'].includes(String(l.status||''))&&menjaLotAvailableQty(l,sold)>0).sort((a,b)=>String(a.production_date||a.date||'').localeCompare(String(b.production_date||b.date||'')));
  const available=candidates.reduce((sum,l)=>sum+menjaLotAvailableQty(l,sold),0),count=adminOrderLotDraft.counts[index]||1;
  const allocationRows=Array.from({length:count},(_,row)=>{
   const lotName='admin_order_lot_'+index+'_'+row,qtyName='admin_order_lot_qty_'+index+'_'+row;
   const chosen=adminOrderLotDraft.values[lotName]||'',qty=adminOrderLotDraft.values[qtyName]??(row===0?String(needed):'0');
   const options='<option value="">Seleziona lotto</option>'+candidates.map(l=>'<option value="'+esc(l.id)+'" '+(String(chosen)===String(l.id)?'selected':'')+'>'+esc(l.code||'Lotto')+' · '+esc(l.production_date||l.date||'')+' · disponibili '+menjaLotAvailableQty(l,sold)+'</option>').join('');
   return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 105px;gap:8px;margin:7px 0"><select class="field" name="'+lotName+'">'+options+'</select><input class="field" type="number" name="'+qtyName+'" min="0" step="1" value="'+esc(qty)+'" aria-label="Quantità dal lotto"></div>';
  }).join('');
  return '<div style="padding:13px;border:1px solid var(--line);border-radius:12px;margin:10px 0"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>'+esc(product)+'</strong><span>Richieste: <b>'+needed+'</b> · Disponibili: <b>'+available+'</b></span></div>'+allocationRows+'<div class="muted" style="font-size:12px">La somma delle quantità assegnate deve essere esattamente '+needed+'. '+(available<needed?'<strong style="color:#b42318">Quantità insufficiente: mancano '+(needed-available)+' basi.</strong>':'')+'</div><button type="button" class="smallbtn" style="margin-top:8px" onclick="addAdminOrderLotRow('+index+')">＋ Aggiungi un altro lotto</button></div>';
 }).join('');
 return '<section class="box"><h2>Controllo magazzino e assegnazione lotti</h2><p class="muted">Prima di approvare, controlla la disponibilità reale e assegna ogni base a uno o più lotti presenti in magazzino.</p><form id="adminOrderLotForm" onsubmit="event.preventDefault();approveOrderWithLots(\''+order.id+'\')">'+rows+'<div class="notice">L’ordine non verrà approvato se anche una sola quantità non è coperta da lotti disponibili.</div><button class="btn gold" type="submit">✓ Verifica lotti e approva ordine</button></form></section>';
}
async function approveOrderWithLots(id){
 try{
  if(activeProfile?.role!=='admin')throw new Error('Solo il titolare può approvare gli ordini.');
  captureAdminOrderLotDraft();
  const form=document.getElementById('adminOrderLotForm');if(!form)throw new Error('Pannello assegnazione lotti non trovato.');
  const values=new FormData(form);
  await loadOnlineData();
  const order=db.orders.find(o=>String(o.id)===String(id));
  if(!order||order.status!=='Da approvare')throw new Error('L’ordine non è più in attesa di approvazione. Aggiorna la pagina.');
  if(!Array.isArray(order.lines)||!order.lines.length)throw new Error('Ordine senza righe prodotto: impossibile assegnare i lotti in sicurezza.');
  const sold=menjaLotSoldAllocations(),reserved=new Map(),updatedLines=[];
  for(let index=0;index<order.lines.length;index++){
   const line=order.lines[index],product=String(line.product||line.name||'Prodotto').trim(),needed=Number(line.quantity??line.qty)||0;
   if(!Number.isInteger(needed)||needed<1)throw new Error('Quantità non valida per '+product+'.');
   const allocations=[];let sum=0;
   for(let row=0;row<(adminOrderLotDraft.counts[index]||1);row++){
    const lotId=String(values.get('admin_order_lot_'+index+'_'+row)||''),quantity=Number(values.get('admin_order_lot_qty_'+index+'_'+row)||0);
    if(!lotId&&quantity===0)continue;
    if(!lotId||!Number.isInteger(quantity)||quantity<1)throw new Error('Completa lotto e quantità per '+product+' (riga '+(row+1)+').');
    const lot=db.lots.find(l=>String(l.id)===lotId);
    if(!lot||String(lot.product||'').trim().toLocaleLowerCase('it-IT')!==product.toLocaleLowerCase('it-IT'))throw new Error('Il lotto selezionato non corrisponde al prodotto '+product+'.');
    if(['In quarantena','Bloccato'].includes(String(lot.status||'')))throw new Error('Il lotto '+(lot.code||'')+' è bloccato o in quarantena e non può essere assegnato.');
    const already=reserved.get(lotId)||0,available=menjaLotAvailableQty(lot,sold)-already;
    if(quantity>available)throw new Error('Il lotto '+(lot.code||'')+' non ha abbastanza basi. Disponibili ancora: '+available+'.');
    reserved.set(lotId,already+quantity);sum+=quantity;
    allocations.push({lot_id:lot.id,lot_code:lot.code||'',quantity});
   }
   if(sum!==needed)throw new Error('Per '+product+' hai assegnato '+sum+' basi su '+needed+' richieste. Devi coprire esattamente tutta la quantità.');
   updatedLines.push({...line,lot_allocations:allocations,...(allocations.length===1?{lot_id:allocations[0].lot_id,lot_code:allocations[0].lot_code}:{lot_id:null,lot_code:null})});
  }
  const lotIds=[...new Set(updatedLines.flatMap(line=>(line.lot_allocations||[]).map(a=>String(a.lot_id))))];
  const itemText=updatedLines.map(line=>(line.lot_allocations||[]).map(a=>a.quantity+' × '+(line.product||line.name||'Prodotto')+' ['+a.lot_code+']').join(', ')).join(', ');
  const updated={...order,lines:updatedLines,lot_ids:lotIds,items:itemText,status:'Confermato',confirmed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {data,error}=await onlineClient.from('records').update({payload:updated}).eq('id',id).eq('kind','orders').select('id').maybeSingle();
  if(error)throw error;if(!data)throw new Error('Approvazione non salvata dal database. Nessun lotto è stato assegnato.');
  await menjaWriteAudit('approvato','orders',id,order,updated);
  const local=db.orders.find(o=>String(o.id)===String(id));if(local)Object.assign(local,updated);
  let customerId=order.customer_id||null;
  if(!customerId&&order.customer_code){const{data:profile}=await onlineClient.from('profiles').select('id').eq('customer_code',order.customer_code).maybeSingle();customerId=profile?.id||null}
  if(!customerId&&order.customer_email){const{data:profile}=await onlineClient.from('profiles').select('id').eq('email',order.customer_email).maybeSingle();customerId=profile?.id||null}
  if(customerId){
   const title='Ordine accettato',body='Il tuo ordine '+(order.code||'')+' è stato confermato dal titolare.';
   const{error:notificationError}=await onlineClient.from('notifications').insert({user_id:customerId,order_id:String(order.id),order_code:String(order.code||''),notification_type:'order_accepted',title,body});
   if(notificationError)console.error('Ordine approvato ma notifica interna non salvata:',notificationError);
   else{const{error:pushError}=await onlineClient.functions.invoke('send-order-push',{body:{user_id:customerId,title,body}});if(pushError)console.warn('Notifica push non inviata:',pushError)}
  }
  adminOrderLotDraft={counts:{},values:{}};syncPendingOrderBadge();render();
 }catch(error){showError(error)}
}
function closeAdminOrder(){selectedAdminOrderId=null;render()}
function orderPendingIndicator(order){return order?.status==='Da approvare'?'<span class="order-status-dot" title="Ordine nuovo da approvare" aria-label="Da approvare" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px #ef444422;margin-right:7px;vertical-align:middle"></span>':''}
function orderPickupAlertClass(order){
 const status=String(order?.status||'').toLocaleLowerCase('it-IT');
 if(['consegnato','ritirato','annullato','rifiutato','pagato'].includes(status))return '';
 const pickup=String(order?.pickup||'').split('T')[0];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(pickup))return '';
 const today=lotDateToday();
 const day=Date.parse(pickup+'T00:00:00Z'),now=Date.parse(today+'T00:00:00Z');
 if(day===now)return 'today';
 if(day-now===86400000)return 'tomorrow';
 return '';
}
let lotTraceMode=false,lotTraceQuery='';
function openLotTrace(){lotTraceMode=true;selectedAdminOrderId=null;render()}
function closeLotTrace(){lotTraceMode=false;lotTraceQuery='';render()}
function submitLotTrace(event){event.preventDefault();lotTraceQuery=String(new FormData(event.currentTarget).get('lot_code')||'').trim();render()}
function lotTraceResults(code){
 const query=String(code||'').trim().toLocaleLowerCase('it-IT');if(!query)return [];
 const lot=db.lots.find(l=>String(l.code||'').trim().toLocaleLowerCase('it-IT')===query||String(l.id||'').trim().toLocaleLowerCase('it-IT')===query);
 const lotId=String(lot?.id||''),lotCode=String(lot?.code||code).trim().toLocaleLowerCase('it-IT'),results=[];
 for(const order of db.orders){
  const lines=Array.isArray(order.lines)?order.lines:[];
  const expandedLines=lines.flatMap(line=>Array.isArray(line.lot_allocations)&&line.lot_allocations.length?line.lot_allocations.map(part=>({...line,quantity:part.quantity,lot_id:part.lot_id,lot_code:part.lot_code})): [line]);
  const explicitLines=expandedLines.filter(line=>{const c=String(line.lot_code||'').trim().toLocaleLowerCase('it-IT'),id=String(line.lot_id||'').trim().toLocaleLowerCase('it-IT');return c===query||c===lotCode||(lotId&&id===lotId)||id===query});
  const ids=Array.isArray(order.lot_ids)?order.lot_ids.map(String):[];
  const linked=!!(lotId&&ids.includes(lotId))||ids.some(id=>id.toLocaleLowerCase('it-IT')===query||id.toLocaleLowerCase('it-IT')===lotCode);
  const itemText=String(order.items||''),textMatches=[];
  const legacyPattern=/(?:^|[,;\n])\s*([0-9]+(?:[.,][0-9]+)?)\s*[×x*]\s*(.*?)\s*\[([^\]]+)\]/gi;
  let match;while((match=legacyPattern.exec(itemText))!==null){if(String(match[3]).trim().toLocaleLowerCase('it-IT')===query||String(match[3]).trim().toLocaleLowerCase('it-IT')===lotCode)textMatches.push({quantity:Number(match[1].replace(',','.'))||0,product:match[2].trim()})}
  if(!explicitLines.length&&!linked&&!textMatches.length)continue;
  let quantity=0,products=[];
  if(explicitLines.length){for(const line of explicitLines){const qty=Number(line.quantity??line.qty)||0;quantity+=qty;products.push((line.product||line.name||lot?.product||'Prodotto')+' × '+qty)}}
  else if(textMatches.length){for(const item of textMatches){quantity+=item.quantity;products.push(item.product+' × '+item.quantity)}}
  else if(linked&&lines.length){for(const line of lines){const name=String(line.product||line.name||'Prodotto');if(!lot?.product||name.trim().toLocaleLowerCase('it-IT')===String(lot.product).trim().toLocaleLowerCase('it-IT')){const qty=Number(line.quantity??line.qty)||0;quantity+=qty;products.push(name+' × '+qty)}}}
  if(!quantity&&linked)quantity='Collegato';
  results.push({order,quantity,products:products.join(', ')||order.items||lot?.product||'—'});
 }
 return results.sort((a,b)=>String(b.order.created_at||b.order.updated_at||b.order.pickup||'').localeCompare(String(a.order.created_at||a.order.updated_at||a.order.pickup||'')));
}
function lotTracePage(){
 const code=lotTraceQuery.trim(),lot=code?db.lots.find(l=>String(l.code||'').trim().toLocaleLowerCase('it-IT')===code.toLocaleLowerCase('it-IT')||String(l.id||'')===code):null,results=code?lotTraceResults(code):[];
 const rows=results.map(({order,quantity,products})=>{
  const rawDate=order.created_at||order.updated_at||'';
  const orderDate=rawDate?(Number.isNaN(new Date(rawDate).getTime())?'—':new Date(rawDate).toLocaleDateString('it-IT')):(formatCustomerPickupDate(order.pickup)||'—');
  return [esc(order.code||'—'),esc(order.customer||'Cliente non indicato'),esc(order.customer_email||'—'),esc(orderDate),esc(formatCustomerPickupDate(order.pickup)||'—'),esc(products),esc(quantity),'<span class="badge">'+esc(order.status||'Stato non indicato')+'</span>'];
 });
 const totalQuantity=results.reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
 return '<div class="head"><div><h1>Tracciabilità lotto</h1><div class="muted">Chi ha ricevuto il prodotto, in quale data e in quale quantità, anche per clienti archiviati o eliminati</div></div><div class="actions"><button class="btn" onclick="closeLotTrace()">← Torna agli ordini</button></div></div><form class="box" onsubmit="submitLotTrace(event)"><label>Codice lotto<input class="field" name="lot_code" list="lotTraceCodes" required value="'+esc(code)+'" placeholder="Es. L-20261111-001"></label><datalist id="lotTraceCodes">'+db.lots.map(l=>'<option value="'+esc(l.code||'')+'">'+esc(l.product||'')+'</option>').join('')+'</datalist><div class="actions" style="margin-top:12px"><button class="btn gold" type="submit">Cerca lotto</button></div></form>'+(code?'<section class="box"><div class="grid two"><div><small class="muted">LOTTO CERCATO</small><h2>'+esc(lot?.code||code)+'</h2><div class="muted">'+esc(lot?.product||'Codice non presente nell’archivio lotti')+'</div></div><div><small class="muted">RICEVUTO NEGLI ORDINI TROVATI</small><h2>'+totalQuantity+'</h2><div class="muted">'+results.length+' ordini collegati</div></div></div>'+(rows.length?table(['Ordine','Cliente','Email','Data ordine','Data ritiro','Prodotto / quantità','Quantità lotto','Stato'],rows):'<div class="empty">Nessun ordine collegato a questo codice lotto.</div>')+'</section>':'<div class="empty">Inserisci un codice lotto per vedere chi lo ha ricevuto, la data e la quantità.</div>');
}
function menjaOrdersTable(headers,rows,orders){
 const cells=value=>value==null||(typeof value==='string'&&value.trim().toLowerCase()==='undefined')?'—':value;
 return '<div class="tablewrap"><table class="table"><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cells(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function adminOrdersPage(){
 if(lotTraceMode)return lotTracePage();
 const orders=db.orders.filter(o=>o.status!=='Pagato').slice().sort((a,b)=>new Date(b.created_at||b.updated_at||0).getTime()-new Date(a.created_at||a.updated_at||0).getTime());
 const displayedOrders=showOnlyNewOrders?orders.filter(o=>o.status==='Da approvare'):orders;
 const selected=orders.find(o=>o.id===selectedAdminOrderId);
 if(selected){
  const lines=Array.isArray(selected.lines)?selected.lines:[];
  const linesHtml=lines.length
   ?'<div class="tablewrap"><table class="table"><thead><tr><th>Prodotto</th><th>Quantità</th><th>Prezzo unitario</th><th>Totale</th></tr></thead><tbody>'+lines.map(line=>'<tr><td>'+esc(line.product||line.name||'Prodotto')+'</td><td>'+esc(line.quantity??line.qty??'—')+'</td><td>'+(line.unit_price!==undefined?'€ '+Number(line.unit_price||0).toFixed(2):'—')+'</td><td>'+(line.line_total!==undefined?'€ '+Number(line.line_total||0).toFixed(2):(line.unit_price!==undefined?'€ '+(Number(line.unit_price||0)*Number(line.quantity||line.qty||0)).toFixed(2):'—'))+'</td></tr>').join('')+'</tbody></table></div>'
   :'<div class="notice">'+esc(selected.items||'Dettaglio prodotti non presente in questo ordine.')+'</div>';
  const lotAssignmentHtml=selected.status==='Da approvare'?adminOrderLotAssignmentPanel(selected):(lines.length?'<section class="box"><h2>Lotti assegnati</h2>'+lines.map(line=>'<p><strong>'+esc(line.product||line.name||'Prodotto')+'</strong> · '+((line.lot_allocations||[]).length?line.lot_allocations.map(a=>esc(a.lot_code||a.lot_id)+' × '+esc(a.quantity)).join(' · '):(line.lot_code?esc(line.lot_code):'Assegnazione storica non disponibile'))+'</p>').join('')+'</section>':'');
  return '<div class="head"><div><h1>'+orderPendingIndicator(selected)+'Ordine '+esc(selected.code||'')+'</h1><div class="muted">'+esc(selected.customer||'Cliente')+' · '+esc(formatCustomerPickupDate(selected.pickup))+'</div></div><div class="actions"><button class="btn" onclick="closeAdminOrder()">← Torna agli ordini</button></div></div><section class="box"><div class="grid two"><div><small class="muted">CLIENTE</small><h2>'+esc(selected.customer||'—')+'</h2><p>'+esc(selected.customer_email||'')+'</p><p>Codice cliente: '+esc(selected.customer_code||'—')+'</p></div><div><small class="muted">RITIRO</small><h2>'+esc(formatCustomerPickupDate(selected.pickup))+'</h2><p>Stato: '+orderPendingIndicator(selected)+'<span class="badge">'+esc(selected.status||'Da approvare')+'</span></p><p>Ordine: '+esc(selected.code||'—')+'</p></div></div><h2>Prodotti e quantità</h2>'+linesHtml+'<div class="grid two" style="margin-top:16px"><div><small class="muted">NOTE DEL CLIENTE</small><p>'+esc(selected.notes||'Nessuna nota')+'</p></div><div><small class="muted">TOTALE ORDINE</small><h2>€ '+Number(selected.total||0).toFixed(2)+'</h2></div></div>'+lotAssignmentHtml+'<div class="actions" style="margin-top:18px">'+(selected.status==='Da approvare'?'<button class="btn" onclick="setOrderStatus(\''+selected.id+'\',\'Rifiutato\')">Rifiuta ordine</button>':'')+(selected.status!=='Annullato'?'<button class="btn" onclick="setOrderStatus(\''+selected.id+'\',\'Annullato\')">✕ Annulla ordine</button>':'')+(selected.status!=='Pronto per il ritiro'&&selected.status!=='Consegnato'&&selected.status!=='Annullato'?'<button class="btn gold" onclick="setOrderStatus(\''+selected.id+'\',\'Pronto per il ritiro\')">✓ Ordine pronto</button>':'')+(selected.status!=='Consegnato'&&selected.status!=='Annullato'?'<button class="btn gold" onclick="setOrderStatus(\''+selected.id+'\',\'Consegnato\')">✓ Ordine consegnato</button>':'')+'</div></section>';
 }
const rows=displayedOrders.map(o=>{const alert=orderPickupAlertClass(o);const code=esc(o.code||'—');const alertCode=alert?'<span class="order-pickup-alert order-pickup-alert--'+alert+'" title="'+(alert==='today'?'Consegna prevista oggi':'Consegna prevista domani')+'">'+code+'</span>':code;return [alertCode,esc(o.customer||'—'),esc(formatCustomerPickupDate(o.pickup)),o.total!==undefined&&o.total!==''?'€ '+Number(o.total||0).toFixed(2):'Da definire',orderPendingIndicator(o)+'<span class="badge">'+(o.status==='Consegnato'?'Consegnato · DA PAGARE':esc(o.status||'Da approvare'))+'</span>','<button class="smallbtn" onclick="openAdminOrder(\''+o.id+'\')">Apri ordine →</button> '+(o.status==='Pagato'?'<span class="badge" style="background:#e7f5ec;color:#176b3a">✓ Pagato</span>':'<button class="smallbtn" style="color:#176b3a;border-color:#176b3a" onclick="setOrderStatus(\''+o.id+'\',\'Pagato\')">€ Pagato</button>')+' <button class="smallbtn" style="color:#b42318;border-color:#b42318" onclick="deleteAdminOrder(\''+o.id+'\')">Elimina ordine</button>'];});
 const newCount=orders.filter(o=>o.status==='Da approvare').length;
 return head('Ordini','Apri ogni richiesta per controllare prodotti, quantità e totale prima di approvarla', '<button class="btn" onclick="openLotTrace()">⌕ Traccia lotto</button>')+'<div class="box"><div class="order-alert-legend"><span><i style="background:#1e4f91"></i> Consegna domani</span><span><i style="background:#176b43"></i> Consegna oggi</span></div><div class="toolbar"><input class="field" placeholder="Cerca ordine o cliente" oninput="filterRows(this)"><button class="smallbtn" onclick="toggleNewOrdersFilter()">'+(showOnlyNewOrders?'Mostra tutti gli ordini':'Nuovi ordini ('+newCount+')')+'</button><span class="muted">'+displayedOrders.length+' ordini</span></div>'+(rows.length?menjaOrdersTable(['Numero','Cliente','Ritiro','Totale','Stato','Dettaglio'],rows,displayedOrders):'<div class="empty">'+(showOnlyNewOrders?'Non ci sono nuovi ordini da approvare.':'Non ci sono ordini registrati.')+'</div>')+'</div>';
}

let selectedProductionLotId=null;
function lotDateToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function generateProductionLotCode(date){const compact=String(date||lotDateToday()).replace(/-/g,'');const prefix='L-'+compact+'-';const nums=db.lots.filter(x=>String(x.code||'').startsWith(prefix)).map(x=>parseInt(String(x.code).slice(prefix.length),10)||0);return prefix+String(Math.max(0,...nums)+1).padStart(3,'0')}


let aslActiveSection='carichi';
function aslDateToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function aslPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const ingredients=db.ingredientLots.slice().sort((a,b)=>String(b.received_date||'').localeCompare(String(a.received_date||'')));
 const checks=db.haccpChecks.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||'')));
 const expired=ingredients.filter(x=>x.expiry&&x.expiry<aslDateToday()).length;
 const empty=ingredients.filter(x=>Number(x.qty_remaining||0)<=0).length;
 const tab=(id,label)=>'<button class="btn '+(aslActiveSection===id?'gold':'')+'" type="button" onclick="aslSetSection(\''+id+'\')">'+label+'</button>';
 const nav='<div class="actions" style="margin:12px 0 18px;flex-wrap:wrap">'+tab('carichi','1. Materie prime')+tab('controlli','2. Controlli HACCP')+tab('documenti','3. Registri e stampa')+'</div>';
 const intro='<div class="notice"><strong>Come si usa:</strong> registra ogni consegna con i dati del documento e del lotto del fornitore; poi, durante la produzione, collega i lotti realmente utilizzati nella scheda “Lotti produzione”. Per rintracciare le consegne ai clienti, apri la scheda del lotto prodotto. I dati devono corrispondere ai documenti e alle verifiche reali.</div>';
 if(aslActiveSection==='controlli')return head('Sicurezza alimentare · Controlli HACCP','Registra le verifiche previste dal tuo piano HACCP')+nav+intro+aslCheckForm()+(checks.length?'<section class="box"><h2>Registro controlli effettuati</h2>'+table(['Data','Ora','Controllo','Valore / esito rilevato','Esito','Operatore','Azione correttiva'],checks.map(x=>[esc(x.date),esc(x.time||'—'),esc(x.control),esc(x.observed||'—'),'<span class="badge">'+esc(x.result||'Registrato')+'</span>',esc(x.operator||'—'),esc(x.corrective_action||'—')]))+'</section>':'<div class="empty">Nessun controllo registrato. Inserisci solo controlli realmente effettuati e previsti dal piano HACCP.</div>');
 if(aslActiveSection==='documenti')return head('Registri aziendali','Documentazione di tracciabilità e autocontrollo · stampa A4 e archiviazione')+nav+intro+'<div class="grid three"><div class="box"><small class="muted">CARICHI MATERIE PRIME</small><h2>'+ingredients.length+'</h2></div><div class="box"><small class="muted">LOTTI PRODOTTI</small><h2>'+db.lots.length+'</h2></div><div class="box"><small class="muted">CONTROLLI HACCP</small><h2>'+checks.length+'</h2></div></div><section class="box"><h2>Stampa registri e dossier</h2>'+aslReportPeriodControls()+'<div class="grid two"><button class="btn gold" onclick="aslPrintReport(\'all\')">Dossier completo</button><button class="btn" onclick="aslPrintReport(\'ingredient\')">Registro materie prime</button><button class="btn" onclick="aslPrintReport(\'haccp\')">Registro HACCP</button><button class="btn" onclick="aslPrintReport(\'production\')">Lotti produzione</button><button class="btn" onclick="aslPrintReport(\'traceability\')">Rintracciabilità clienti</button><button class="btn" onclick="aslExportCSV()">Esporta CSV</button></div></section><section class="box"><h2>Completezza registrazioni</h2><p>Carichi senza DDT/fattura: <strong>'+ingredients.filter(x=>!x.document_reference).length+'</strong></p><p>Controlli senza operatore: <strong>'+checks.filter(x=>!x.operator).length+'</strong></p><p>Lotti senza materie prime collegate: <strong>'+db.lots.filter(x=>!(x.ingredient_lots_used||[]).length).length+'</strong></p><p class="muted">I dati mancanti non vengono inventati: completarli prima di archiviare.</p></section>';

 return head('Sicurezza alimentare e tracciabilità','Registro di ingresso delle materie prime e collegamento ai lotti prodotti')+nav+intro+aslIngredientForm()+'<section class="box"><div class="toolbar"><h2>Consegne registrate</h2><span class="muted">'+ingredients.length+' carichi</span></div>'+(ingredients.length?table(['Materia prima','Fornitore','Lotto fornitore','Ricevuta il','Scadenza / TMC','Ricevuta','Residua','Unità'],ingredients.map(x=>[esc(x.ingredient),esc(x.supplier),esc(x.supplier_lot),esc(x.received_date),esc(x.expiry||'Non indicata'),Number(x.qty_received||0).toLocaleString('it-IT'),Number(x.qty_remaining||0).toLocaleString('it-IT'),esc(x.unit)])):'<div class="empty">Nessuna consegna registrata. Inserisci il primo carico qui sopra.</div>')+'</section><section class="box"><h2>Collega le materie prime alla produzione</h2><p>Apri una nuova scheda in “Lotti produzione” e indica le quantità effettivamente prelevate da ciascun lotto fornitore. Il gestionale registra lo storico del collegamento e aggiorna la giacenza.</p><button class="btn gold" onclick="navigate(\'Lotti produzione\')">Apri lotti di produzione →</button></section>';
}
function aslSetSection(section){aslActiveSection=section;render()}
function aslIngredientForm(){return '<form class="box formgrid" onsubmit="aslSaveIngredient(event)"><h2 class="wide">Registra una consegna</h2><p class="muted wide">Compila usando etichetta, DDT o fattura. I campi con * sono necessari per identificare la fornitura.</p><label>Materia prima *<input class="field" name="ingredient" required placeholder="Es. Farina di grano tenero"></label><label>Fornitore *<input class="field" name="supplier" required placeholder="Ragione sociale"></label><label>Lotto indicato dal fornitore *<input class="field" name="supplier_lot" required></label><label>Data di ricezione *<input class="field" name="received_date" type="date" required value="'+aslDateToday()+'"></label><label>Quantità ricevuta *<input class="field" name="qty_received" type="number" min="0.001" step="0.001" required></label><label>Unità di misura *<select class="field" name="unit" required><option value="kg">kg</option><option value="g">g</option><option value="l">litri</option><option value="ml">ml</option><option value="pezzi">pezzi</option></select></label><label>Scadenza / TMC riportata<input class="field" name="expiry" type="date"></label><label>Numero DDT / fattura<input class="field" name="document_reference" placeholder="Riferimento documento"></label><details class="wide"><summary>Altri dati della fornitura (facoltativi o previsti dal tuo piano)</summary><div class="formgrid" style="margin-top:12px"><label>Partita IVA / contatto fornitore<input class="field" name="supplier_reference"></label><label>Operatore che ha ricevuto<input class="field" name="operator" value="'+esc(activeProfile?.full_name||'')+'"></label><label class="wide">Controllo all’arrivo / anomalie<textarea class="field" name="receiving_check" rows="2" placeholder="Es. imballo integro; temperatura rilevata se richiesta dal piano"></textarea></label><label class="wide">Allergeni dichiarati / informazioni da scheda tecnica<textarea class="field" name="allergens" rows="2" placeholder="Riporta le informazioni verificate sull’etichetta o sulla scheda tecnica"></textarea></label></div></details><div class="wide dialogfoot"><button class="btn gold" type="submit">Salva consegna</button></div></form>'}
async function aslSaveIngredient(event){
 event.preventDefault();
 const form=event.currentTarget;
 if(activeProfile?.role!=='admin'){alert('Solo il titolare può registrare una fornitura.');return}
 if(!onlineClient||!activeUser?.id){alert('Sessione non valida o connessione non disponibile. Esci e accedi nuovamente.');return}
 const submit=form.querySelector('button[type="submit"]');
 if(submit){submit.disabled=true;submit.textContent='Salvataggio…'}
 const v=Object.fromEntries(new FormData(form));
 const qty=Number(v.qty_received);
 if(!(qty>0)){alert('Inserisci una quantità ricevuta maggiore di zero.');if(submit){submit.disabled=false;submit.textContent='Salva consegna'}return}
 if(v.expiry&&v.expiry<v.received_date){alert('La scadenza/TMC non può precedere la data di ricezione.');if(submit){submit.disabled=false;submit.textContent='Salva consegna'}return}
 const row={id:crypto.randomUUID(),ingredient:String(v.ingredient||'').trim(),supplier:String(v.supplier||'').trim(),supplier_reference:String(v.supplier_reference||'').trim(),received_date:v.received_date,supplier_lot:String(v.supplier_lot||'').trim(),expiry:v.expiry||'',qty_received:qty,qty_remaining:qty,unit:v.unit,document_reference:String(v.document_reference||'').trim(),operator:String(v.operator||activeProfile?.full_name||'').trim(),receiving_check:String(v.receiving_check||'').trim(),allergens:String(v.allergens||'').trim(),movements:[],created_at:new Date().toISOString(),created_by:activeUser.id};
 if(!row.ingredient||!row.supplier||!row.supplier_lot||!row.received_date||!row.unit){alert('Compila tutti i campi obbligatori contrassegnati con *.');if(submit){submit.disabled=false;submit.textContent='Salva consegna'}return}
 try{
  window.__menjaStage='salvataggio fornitura nel database';
  await persistRecord('ingredient_lots',row);
  window.__menjaStage='aggiornamento elenco forniture';
  await loadOnlineData();
  aslActiveSection='carichi';
  render();
  alert('Fornitura registrata correttamente.');
 }catch(e){
  showError(e);
  if(submit){submit.disabled=false;submit.textContent='Riprova a salvare'}
 }
}
function aslCheckForm(){return '<form class="box formgrid" onsubmit="aslSaveCheck(event)"><h2 class="wide">Registra un controllo effettuato</h2><p class="muted wide">Usa i controlli e i limiti previsti dal manuale HACCP della tua attività. Non inserire valori stimati.</p><label>Data *<input class="field" name="date" type="date" required value="'+aslDateToday()+'"></label><label>Ora *<input class="field" name="time" type="time" required></label><label>Tipo di controllo *<select class="field" name="control" required><option value="">Seleziona</option><option>Temperatura frigorifero</option><option>Temperatura congelatore</option><option>Temperatura prodotto</option><option>Cottura / trattamento termico</option><option>Raffreddamento</option><option>Pulizia e sanificazione</option><option>Disinfestazione</option><option>Manutenzione / taratura</option><option>Controllo ricevimento merci</option><option>Altro</option></select></label><label>Area / attrezzatura *<input class="field" name="area" required placeholder="Es. frigorifero materie prime"></label><label>Valore o risultato osservato *<input class="field" name="observed" required placeholder="Misura o verifica realmente eseguita"></label><label>Esito *<select class="field" name="result" required><option value="Conforme">Conforme</option><option value="Non conforme">Non conforme</option><option value="Da verificare">Da verificare</option></select></label><details class="wide"><summary>Dettagli e gestione dell’eventuale anomalia</summary><div class="formgrid" style="margin-top:12px"><label>Limite / criterio previsto dal piano<input class="field" name="limit_reference" placeholder="Trascrivi il criterio applicabile"></label><label>Operatore<input class="field" name="operator" value="'+esc(activeProfile?.full_name||'')+'"></label><label class="wide">Azione correttiva<textarea class="field" name="corrective_action" rows="2" placeholder="Obbligatoria se l’esito è non conforme"></textarea></label><label class="wide">Note<textarea class="field" name="notes" rows="2"></textarea></label></div></details><div class="wide dialogfoot"><button class="btn gold" type="submit">Salva controllo</button></div></form>'}
async function aslSaveCheck(event){event.preventDefault();if(activeProfile?.role!=='admin')return;const v=Object.fromEntries(new FormData(event.currentTarget));if(v.result==='Non conforme'&&!String(v.corrective_action||'').trim()){alert('Per una non conformità devi indicare l’azione correttiva o la gestione adottata.');return}const row={id:crypto.randomUUID(),...v,created_at:new Date().toISOString(),created_by:activeUser.id};try{window.__menjaStage='registrazione controllo HACCP';await persistRecord('haccp_checks',row);await loadOnlineData();render()}catch(e){showError(e)}}
function aslExportCSV(){const rows=[['Materia prima','Fornitore','Riferimento fornitore','Lotto fornitore','Data ricezione','Scadenza/TMC','Quantità ricevuta','Residuo','Unità','DDT/Fattura','Operatore'],...db.ingredientLots.map(x=>[x.ingredient,x.supplier,x.supplier_reference,x.supplier_lot,x.received_date,x.expiry,x.qty_received,x.qty_remaining,x.unit,x.document_reference,x.operator])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='registro-carico-materie-prime.csv';a.click();URL.revokeObjectURL(url)}
function aslReportPeriodControls(){
 const now=new Date(),month=String(now.getMonth()+1).padStart(2,'0'),year=String(now.getFullYear());
 return '<div class="formgrid" style="margin:0 0 18px;align-items:end"><label>Periodo da includere<select class="field" id="aslReportMode" onchange="aslSetReportMode(this.value)"><option value="all">Tutto lo storico</option><option value="month">Un mese specifico</option><option value="year">Un anno specifico</option></select></label><label id="aslReportMonthWrap" hidden>Mese<input class="field" id="aslReportMonth" type="month" value="'+year+'-'+month+'"></label><label id="aslReportYearWrap" hidden>Anno<input class="field" id="aslReportYear" type="number" min="2000" max="2100" step="1" value="'+year+'"></label><div class="wide muted" id="aslReportPeriodHint">Saranno incluse tutte le registrazioni disponibili.</div></div>';
}
function aslSetReportMode(mode){
 const month=document.getElementById('aslReportMonthWrap'),year=document.getElementById('aslReportYearWrap'),hint=document.getElementById('aslReportPeriodHint');
 if(month)month.hidden=mode!=='month';if(year)year.hidden=mode!=='year';
 if(hint)hint.textContent=mode==='month'?'Il documento conterrà solo le registrazioni del mese selezionato.':mode==='year'?'Il documento conterrà solo le registrazioni dell’anno selezionato.':'Saranno incluse tutte le registrazioni disponibili.';
}
function aslGetReportPeriod(){
 const mode=document.getElementById('aslReportMode')?.value||'all';
 if(mode==='month'){
  const value=document.getElementById('aslReportMonth')?.value||'';
  if(!/^\d{4}-\d{2}$/.test(value))throw new Error('Seleziona un mese valido.');
  const parts=value.split('-'),label=new Date(Number(parts[0]),Number(parts[1])-1,1).toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  return {mode,start:value+'-01',end:value+'-'+String(new Date(Number(parts[0]),Number(parts[1]),0).getDate()).padStart(2,'0'),label:'Mese: '+label,file:value};
 }
 if(mode==='year'){
  const value=String(document.getElementById('aslReportYear')?.value||'');
  if(!/^\d{4}$/.test(value)||Number(value)<2000||Number(value)>2100)throw new Error('Inserisci un anno valido.');
  return {mode,start:value+'-01-01',end:value+'-12-31',label:'Anno: '+value,file:value};
 }
 return {mode:'all',start:'',end:'',label:'Tutte le registrazioni disponibili',file:'tutto'};
}
function aslReportDate(value){
 if(!value)return '';
 const raw=String(value).trim(),italian=raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
 if(italian)return italian[3]+'-'+String(italian[2]).padStart(2,'0')+'-'+String(italian[1]).padStart(2,'0');
 const iso=raw.match(/^(\d{4}-\d{2}-\d{2})/);return iso?iso[1]:'';
}
function aslDateMatchesPeriod(value,period){
 if(period.mode==='all')return true;
 const date=aslReportDate(value);return !!date&&date>=period.start&&date<=period.end;
}
function aslPrintReport(type='all'){
 if(activeProfile?.role!=='admin'){alert('Accesso non consentito.');return}
 let period;try{period=aslGetReportPeriod()}catch(e){alert(e.message);return}
 const issued=new Date(),issuedText=issued.toLocaleString('it-IT'),today=aslDateToday();
 const fmt=v=>v?esc(v):'<span class="missing">Non indicato</span>';
 const tableHtml=(headers,rows)=>'<table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(x=>'<td>'+(x||'<span class="missing">—</span>')+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Nessuna registrazione nel periodo selezionato</td></tr>')+'</tbody></table>';
 const ingredients=db.ingredientLots.filter(x=>aslDateMatchesPeriod(x.received_date,period)).slice().sort((a,b)=>String(a.received_date||'').localeCompare(String(b.received_date||'')));
 const checks=db.haccpChecks.filter(x=>aslDateMatchesPeriod(x.date,period)).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
 const lots=db.lots.filter(x=>aslDateMatchesPeriod(x.production_date||x.date,period)).slice().sort((a,b)=>String(a.production_date||a.date||'').localeCompare(String(b.production_date||b.date||'')));
 const orders=db.orders||[];
 const blocks=[];
 if(type==='all'||type==='ingredient')blocks.push('<h2>01 · Registro carico materie prime</h2>'+tableHtml(['Materia prima','Fornitore','Lotto fornitore','Ricezione','Scadenza/TMC','DDT/Fattura','Q.tà ricevuta','Residuo','Operatore'],ingredients.map(x=>[x.ingredient,x.supplier,x.supplier_lot,x.received_date,x.expiry,x.document_reference,String(x.qty_received||0)+' '+(x.unit||''),String(x.qty_remaining||0)+' '+(x.unit||''),x.operator].map(fmt))));
 if(type==='all'||type==='haccp')blocks.push('<h2>02 · Registro controlli HACCP</h2>'+tableHtml(['Data','Ora','Controllo','Area','Valore osservato','Limite/criterio','Esito','Operatore','Azione correttiva','Note'],checks.map(x=>[x.date,x.time,x.control,x.area,x.observed,x.limit_reference,x.result,x.operator,x.corrective_action,x.notes].map(fmt))));
 if(type==='all'||type==='production')blocks.push('<h2>03 · Registro lotti di produzione</h2>'+tableHtml(['Codice lotto','Prodotto','Data','Ora','Quantità','TMC/scadenza','Operatore','Stato'],lots.map(x=>[x.code,x.product,x.production_date||x.date,x.production_time,String(x.qty||'')+' '+(x.unit||''),x.expiry,x.operator,x.status].map(fmt)))+lots.map(lot=>{const used=Array.isArray(lot.ingredient_lots_used)?lot.ingredient_lots_used:[];return '<article><h3>Scheda lotto '+fmt(lot.code)+' · '+fmt(lot.product)+'</h3>'+tableHtml(['Materia prima','Fornitore','Lotto fornitore','Quantità usata','Documento'],used.map(x=>[x.ingredient,x.supplier,x.supplier_lot,String(x.quantity||'')+' '+(x.unit||''),x.document_reference].map(fmt)))+'<p><b>Allergeni:</b> '+fmt(lot.allergens)+' · <b>Processo:</b> '+fmt(lot.process_notes)+' · <b>Conservazione:</b> '+fmt(lot.storage)+'</p><p>Firma operatore: __________________________  Verifica lotto: __________________________</p></article>'}).join(''));
 if(type==='all'||type==='traceability'){const rows=[];for(const lot of lots){const related=orders.filter(o=>(Array.isArray(lot.order_ids)?lot.order_ids:[]).map(String).includes(String(o.id))||(Array.isArray(o.lot_ids)?o.lot_ids:[]).map(String).includes(String(lot.id)));if(related.length)related.forEach(o=>rows.push([lot.code,lot.product,o.code,o.customer,o.pickup||o.date,o.status].map(fmt)));else rows.push([lot.code,lot.product,'Nessun ordine collegato','','',''].map(fmt))}blocks.push('<h2>04 · Registro rintracciabilità in uscita</h2>'+tableHtml(['Lotto prodotto','Prodotto','Ordine','Cliente','Data ordine/ritiro','Stato'],rows))}
 const names={all:'Dossier completo di autocontrollo e tracciabilità',ingredient:'Registro carico materie prime',haccp:'Registro controlli HACCP',production:'Registro lotti di produzione',traceability:'Registro rintracciabilità in uscita'};
 const w=window.open('','_blank');if(!w){alert('Popup bloccato: consenti le finestre popup per questo sito.');return}
 const reportCode='MIM-ASL-'+today.replace(/-/g,'')+'-'+type.toUpperCase()+'-'+period.file.toUpperCase();
 const html='<!doctype html><html lang="it"><head><meta charset="utf-8"><title>'+names[type]+'</title><style>@page{size:A4;margin:14mm}.actions{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:flex-end;padding:12px;background:#26352c;margin:-15mm -15mm 18px}.actions button{border:1px solid #c69d48;background:#f4edda;color:#202720;padding:9px 15px;border-radius:6px;font-weight:700;cursor:pointer}.actions button.primary{background:#c69d48}#reportContent{background:white}body{font:10px/1.4 Arial;color:#202720}header{border-bottom:3px solid #c69d48;padding-bottom:12px;margin-bottom:18px}.brand{font-size:20px;font-weight:800;letter-spacing:2px}.sub{color:#8b6a28;letter-spacing:3px}h1{font-size:18px;margin:12px 0 4px}h2{font-size:13px;background:#eee9dd;border-left:4px solid #c69d48;padding:7px;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:8px;margin:8px 0}th{background:#26352c;color:white;text-align:left}th,td{border:1px solid #cbd0c8;padding:5px;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#f5f6f3}article{border:1px solid #b9c1b7;padding:10px;margin:12px 0;break-inside:avoid}h3{font-size:11px}.missing{color:#9a4d38;font-style:italic}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px}.sign{margin:15px 0;padding:10px;border:1px solid #cbd0c8}.disclaimer{font-size:8px;color:#596258;border:1px solid #d5d9d2;padding:8px;margin-top:20px}footer{border-top:1px solid #ccc;margin-top:20px;padding-top:7px;font-size:8px;color:#667}@media screen{body{max-width:210mm;margin:20px auto;padding:15mm;box-shadow:0 2px 20px #0002}}</style></head><body><div class="actions no-print"><button onclick="window.print()">Stampa</button><button class="primary" id="savePdfBtn" onclick="saveReportPdf()">Scarica PDF</button></div><main id="reportContent"><header><div class="brand">MENJA I MUT</div><div class="sub">PIZZA LAB</div><div>Registro aziendale · Sicurezza alimentare e tracciabilità</div><h1>'+names[type]+'</h1><div class="meta"><div><b>Responsabile indicato:</b> '+fmt(activeProfile?.full_name||'Non indicato')+'</div><div><b>Emesso il:</b> '+issuedText+'</div><div><b>Periodo selezionato:</b> '+esc(period.label)+'</div><div><b>Codice documento:</b> '+reportCode+'</div><div><b>Sede operativa:</b> da completare</div><div><b>Partita IVA:</b> da completare</div></div></header>'+blocks.join('')+'<div class="disclaimer"><b>Nota:</b> documento generato dai dati presenti nel gestionale alla data di emissione. I campi mancanti sono evidenziati e non sono stati inventati. Allegare DDT/fatture, schede tecniche, piano HACCP e documenti originali previsti dalle procedure aziendali. La stampa non costituisce certificazione di conformità né sostituisce il piano di autocontrollo.</div><footer>Menja i Mut Pizza Lab · Registro interno · Generato il '+issuedText+' · '+esc(period.label)+'</footer></main><script>const pdfDate="'+today.replace(/-/g,'')+'",pdfType="'+type+'",pdfPeriod="'+period.file+'";async function saveReportPdf(){const btn=document.getElementById("savePdfBtn");const old=btn.textContent;btn.disabled=true;btn.textContent="Preparazione PDF…";try{if(!window.html2pdf){await new Promise((resolve,reject)=>{const sc=document.createElement("script");sc.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.3/html2pdf.bundle.min.js";sc.onload=resolve;sc.onerror=()=>reject(new Error("Libreria PDF non raggiungibile"));document.head.appendChild(sc)})}const el=document.getElementById("reportContent");await html2pdf().set({margin:[10,9,12,9],filename:"Menja-i-Mut-"+pdfDate+"-"+pdfType+"-"+pdfPeriod+".pdf",image:{type:"jpeg",quality:0.96},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"mm",format:"a4",orientation:"landscape"},pagebreak:{mode:["css","legacy"]}}).from(el).save()}catch(e){alert("PDF diretto non disponibile. Usa Stampa e scegli Salva come PDF. Dettaglio: "+e.message)}finally{btn.disabled=false;btn.textContent=old}}</script></body></html>';
 w.document.open();w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus()}catch(e){console.warn(e)}},250);
}
function productionIngredientUsageEditor(lot){const used=Array.isArray(lot?.ingredient_lots_used)?lot.ingredient_lots_used:[];if(lot)return '<div class="wide box"><strong>Materie prime effettivamente utilizzate (storico)</strong>'+(used.length?table(['Materia prima','Fornitore','Lotto fornitore','Quantità','Data ricezione'],used.map(x=>[esc(x.ingredient),esc(x.supplier),esc(x.supplier_lot),esc(x.quantity)+' '+esc(x.unit),esc(x.received_date)])):'<p class="muted">Questo lotto non contiene ancora una distinta strutturata delle materie prime utilizzate.</p>')+'<p class="muted">La tracciabilità storica non viene modificata quando si riapre una scheda.</p></div>';const available=db.ingredientLots.filter(x=>Number(x.qty_remaining||0)>0&&(!x.expiry||x.expiry>=aslDateToday()));return '<div class="wide box"><strong>Materie prime impiegate in questo lotto</strong><p class="muted">Seleziona solo i lotti realmente usati. La quantità inserita verrà sottratta dalla giacenza al salvataggio.</p>'+(available.length?available.map(x=>'<div class="grid two" style="align-items:center;padding:8px 0;border-top:1px solid var(--line)"><div><strong>'+esc(x.ingredient)+'</strong><div class="muted">'+esc(x.supplier)+' · lotto '+esc(x.supplier_lot)+' · residuo '+Number(x.qty_remaining).toLocaleString('it-IT')+' '+esc(x.unit)+'</div></div><label>Quantità usata ('+esc(x.unit)+')<input class="field" type="number" min="0" max="'+Number(x.qty_remaining)+'" step="0.001" name="ingredient_use_'+esc(x.id)+'" value="0"></label></div>').join(''):'<div class="empty">Non ci sono carichi disponibili. Registra prima le materie prime nella sezione ASL.</div>')+'</div>'}

function productionLotEditor(lot){
 const x=lot||{},date=x.production_date||x.date||lotDateToday();
 const assignedOrders=db.orders.filter(o=>(o.lot_ids||[]).includes(x.id));
 return '<div class="head"><div><h1>'+(lot?'Modifica lotto':'Genera nuovo lotto')+'</h1><div class="muted">Scheda di produzione e rintracciabilità</div></div><button class="btn" onclick="cancelProductionLotEdit()">← Torna ai lotti</button></div><form class="box formgrid" onsubmit="saveProductionLot(event)" data-lot-id="'+esc(x.id||'')+'"><div class="notice wide">Il codice viene generato automaticamente. Ogni lotto deve identificare prodotti realizzati in condizioni di produzione sostanzialmente identiche. Inserisci i dati reali dei fornitori e dei lotti delle materie prime. Il gestionale non stabilisce la shelf-life: inserisci TMC o scadenza solo dopo averla definita e validata nel piano HACCP.</div><label>Codice lotto (modificabile)<input class="field" name="code" required value="'+esc(x.code||generateProductionLotCode(date))+'" pattern="L-[A-Za-z0-9-]+" title="Il codice deve iniziare con L-"></label><label>Prodotto<input class="field" name="product" list="lotProductOptions" required value="'+esc(x.product||'')+'" placeholder="Es. Base pizza precotta 30 cm"><datalist id="lotProductOptions">'+db.products.map(p=>'<option value="'+esc(p.name)+'"></option>').join('')+'</datalist></label><label>Data produzione<input class="field" type="date" name="production_date" required value="'+esc(date)+'"></label><label>Ora / turno<input class="field" type="time" name="production_time" value="'+esc(x.production_time||'')+'"></label><label>Quantità prodotta<input class="field" type="number" name="qty" min="0.001" step="0.001" required value="'+esc(x.qty??'')+'"></label><label>Unità di misura<select class="field" name="unit"><option value="pezzi" '+((x.unit||'pezzi')==='pezzi'?'selected':'')+'>Pezzi</option><option value="confezioni" '+(x.unit==='confezioni'?'selected':'')+'>Confezioni</option><option value="kg" '+(x.unit==='kg'?'selected':'')+'>Kg</option></select></label><label>Termine minimo di conservazione / scadenza<input class="field" type="date" name="expiry" value="'+esc(x.expiry||'')+'"></label><label>Operatore responsabile<input class="field" name="operator" value="'+esc(x.operator||activeProfile?.full_name||'')+'"></label>'+productionIngredientUsageEditor(lot)+'<label class="wide">Lotto materiali di confezionamento<textarea class="field" name="packaging_lot" rows="2" placeholder="Buste, assorbitori, etichette: fornitore e lotto riportato sui materiali">'+esc(x.packaging_lot||'')+'</textarea></label><label class="wide">Allergeni presenti / possibili contaminazioni<textarea class="field" name="allergens" rows="2" placeholder="Indica allergeni e possibili contaminazioni crociate secondo la tua valutazione HACCP">'+esc(x.allergens||'')+'</textarea></label><label class="wide">Controlli e parametri di processo<textarea class="field" name="process_notes" rows="3" placeholder="Impasto, cottura, raffreddamento, controlli effettuati, anomalie e azioni correttive">'+esc(x.process_notes||'')+'</textarea></label><label class="wide">Condizioni di conservazione<textarea class="field" name="storage" rows="2" placeholder="Condizioni di conservazione definite per il prodotto">'+esc(x.storage||'')+'</textarea></label><div class="wide"><strong>Ordini associati</strong><div class="muted">'+(assignedOrders.length?assignedOrders.map(o=>esc(o.code||'Ordine')+' · '+esc(o.customer||'Cliente')).join('<br>'):'Gli ordini vengono associati dalla scheda dell’ordine.')+'</div></div><label>Stato lotto<select class="field" name="status"><option '+((x.status||'Prodotto')==='Prodotto'?'selected':'')+'>Prodotto</option><option '+(x.status==='In quarantena'?'selected':'')+'>In quarantena</option><option '+(x.status==='Rilasciato'?'selected':'')+'>Rilasciato</option><option '+(x.status==='Bloccato'?'selected':'')+'>Bloccato</option></select></label><div class="wide muted">Creato: '+esc(x.created_at?new Date(x.created_at).toLocaleString('it-IT'):'alla conferma')+' · Revisioni registrate: '+(Array.isArray(x.revision_history)?x.revision_history.length:0)+'</div><div class="wide dialogfoot"><button type="button" class="btn" onclick="cancelProductionLotEdit()">Annulla</button><button class="btn gold" type="submit">Salva scheda lotto</button></div></form>';
}
function filterProductionLots(input){
 const query=String(input.value||'').trim().toLocaleLowerCase('it-IT');
 const rows=[...document.querySelectorAll('#productionLotsTable tbody .production-lot-row')];
 let visible=0;
 rows.forEach(row=>{const match=!query||String(row.dataset.search||row.innerText).toLocaleLowerCase('it-IT').includes(query);row.style.display=match?'':'none';if(match)visible++});
 const empty=document.getElementById('productionLotsSearchEmpty');if(empty)empty.hidden=visible!==0;
}
function productionLotsPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 if(selectedProductionLotId==='new')return productionLotEditor(null);if(selectedProductionLotId){if(String(selectedProductionLotId).startsWith('dossier:')){const dossierLot=db.lots.find(x=>String(x.id)===String(selectedProductionLotId).slice(8));return dossierLot?productionLotDossierPage(dossierLot):'<div class="box">Lotto non trovato.<button class="btn" onclick="cancelProductionLotEdit()">Torna ai lotti</button></div>'}const lot=db.lots.find(x=>x.id===selectedProductionLotId);return lot?productionLotEditor(lot):'<div class="box">Lotto non trovato.<button class="btn" onclick="cancelProductionLotEdit()">Torna ai lotti</button></div>'}
 const lotDateValue=value=>{if(!value)return 0;const raw=String(value).trim();let match=raw.match(/^(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{4})$/);if(match)return new Date(Number(match[3]),Number(match[2])-1,Number(match[1])).getTime()||0;const time=Date.parse(raw);return Number.isFinite(time)?time:0};
 const lots=db.lots.slice().sort((a,b)=>lotDateValue(b.production_date||b.date)-lotDateValue(a.production_date||a.date)||lotDateValue(b.created_at)-lotDateValue(a.created_at)||String(b.code||'').localeCompare(String(a.code||''),'it'));
 const rows=lots.map(l=>{
  const linked=db.orders.filter(o=>(o.lot_ids||[]).includes(l.id)||(o.lot_ids||[]).includes(l.code));
  const searchable=[l.code,l.product,l.qty,l.unit,l.production_date,l.date,l.expiry,l.status,l.operator,l.ingredients_lots,l.packaging_lot,l.allergens,l.process_notes,l.storage,...linked.flatMap(o=>[o.code,o.customer,o.items])].join(' ').toLocaleLowerCase('it-IT');
  return '<tr class="production-lot-row" data-search="'+esc(searchable)+'"><td>'+esc(l.code||'—')+'</td><td>'+esc(l.product||'—')+'</td><td>'+esc(l.qty??'—')+' '+esc(l.unit||'')+'</td><td>'+esc(l.production_date||l.date||'—')+'</td><td>'+esc(l.expiry||'—')+'</td><td>'+esc(l.status||'Prodotto')+'</td><td><button class="smallbtn" data-id="'+esc(l.id)+'" onclick="editProductionLot(this.dataset.id)">Apri / modifica</button> <button class="smallbtn" data-id="'+esc(l.id)+'" onclick="openProductionLotDossier(this.dataset.id)">Dossier ASL</button></td></tr>';
 }).join('');
 return head('Lotti produzione','Generatore, schede di tracciabilità e collegamento agli ordini',btn('Genera nuovo lotto','newProductionLot()'))+'<div class="box"><div class="toolbar"><input class="field" placeholder="Cerca nello storico: lotto, prodotto, data, ordine, cliente, fornitore…" oninput="filterProductionLots(this)"><span class="muted">'+lots.length+' lotti archiviati</span></div>'+(lots.length?'<div class="tablewrap"><table class="table" id="productionLotsTable"><thead><tr><th>Codice lotto</th><th>Prodotto</th><th>Quantità</th><th>Produzione</th><th>Conservazione fino al</th><th>Stato</th><th>Scheda</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="productionLotsSearchEmpty" class="empty" hidden>Nessun lotto corrisponde alla ricerca.</div>':'<div class="empty">Nessun lotto ancora registrato. Crea il primo lotto con il pulsante in alto.</div>')+'</div>';
}

function openProductionLotDossier(id){if(activeProfile?.role!=='admin')return;selectedProductionLotId='dossier:'+id;render()}
function productionLotDossierPage(lot){
 const used=Array.isArray(lot.ingredient_lots_used)?lot.ingredient_lots_used:[];
 const linked=lotTraceResults(lot.code||lot.id);
 const ingredientRows=used.map(x=>[esc(x.ingredient),esc(x.supplier),esc(x.supplier_reference||'—'),esc(x.supplier_lot),esc(x.received_date||'—'),esc(x.expiry||'—'),esc(x.quantity)+' '+esc(x.unit),esc(x.document_reference||'—'),esc(x.allergens||'—')]);
 const orderRows=linked.map(({order,quantity,products})=>[esc(order.code||'—'),esc(order.customer||'Cliente non indicato'),esc(order.customer_email||'—'),esc(order.created_at?new Date(order.created_at).toLocaleDateString('it-IT'):(formatCustomerPickupDate(order.pickup)||'—')),esc(products),esc(quantity),esc(order.status||'—')]);
 const revisions=Array.isArray(lot.revision_history)?lot.revision_history:[];
 return '<div class="head"><div><h1>Dossier di lotto · '+esc(lot.code||'—')+'</h1><div class="muted">Fascicolo riepilogativo di produzione e rintracciabilità</div></div><div class="actions"><button class="btn" onclick="cancelProductionLotEdit()">← Torna ai lotti</button><button class="btn gold" onclick="window.print()">Stampa / salva PDF</button></div></div><section class="box"><h2>1. Identificazione lotto</h2><div class="grid two"><div><small class="muted">CODICE LOTTO</small><h2>'+esc(lot.code||'—')+'</h2></div><div><small class="muted">PRODOTTO</small><h2>'+esc(lot.product||'—')+'</h2></div><div><strong>Data produzione</strong><p>'+esc(lot.production_date||lot.date||'—')+' · '+esc(lot.production_time||'ora non indicata')+'</p></div><div><strong>Quantità prodotta</strong><p>'+esc(lot.qty??'—')+' '+esc(lot.unit||'')+'</p></div><div><strong>Operatore</strong><p>'+esc(lot.operator||'—')+'</p></div><div><strong>Stato</strong><p>'+esc(lot.status||'—')+'</p></div><div><strong>TMC / scadenza inserita</strong><p>'+esc(lot.expiry||'—')+'</p></div><div><strong>Creato / aggiornato</strong><p>'+esc(lot.created_at?new Date(lot.created_at).toLocaleString('it-IT'):'—')+' / '+esc(lot.updated_at?new Date(lot.updated_at).toLocaleString('it-IT'):'—')+'</p></div></div></section><section class="box"><h2>2. Tracciabilità materie prime</h2>'+(ingredientRows.length?table(['Ingrediente','Fornitore','Rif. fornitore','Lotto fornitore','Ricezione','TMC / scadenza','Quantità usata','DDT / fattura','Allergeni dichiarati'],ingredientRows):'<div class="notice">Nessuna distinta strutturata delle materie prime è stata registrata per questo lotto. Per i lotti prodotti prima dell’attivazione della funzione, non ricostruire i dati a memoria: recuperali dai documenti originali.</div>')+'</section><section class="box"><h2>3. Materiali di confezionamento</h2><p>'+esc(lot.packaging_lot||'Lotto dei materiali non registrato')+'</p></section><section class="box"><h2>4. Parametri e controlli di processo</h2><p>'+esc(lot.process_notes||'Nessuna registrazione di processo inserita nella scheda lotto')+'</p><p><strong>Conservazione dichiarata:</strong> '+esc(lot.storage||'Non registrata')+'</p><p><strong>Allergeni / contaminazioni:</strong> '+esc(lot.allergens||'Non registrati')+'</p></section><section class="box"><h2>5. Distribuzione e rintracciabilità in uscita</h2>'+(orderRows.length?table(['Ordine','Cliente','Email','Data ordine','Prodotti','Quantità lotto','Stato ordine'],orderRows):'<div class="notice">Non risultano ordini collegati al lotto. Verifica se il prodotto è stato distribuito attraverso altri canali e registra la relativa documentazione nel sistema aziendale.</div>')+'<p><strong>Totale quantità rintracciata negli ordini:</strong> '+linked.reduce((sum,x)=>sum+(Number(x.quantity)||0),0)+'</p></section><section class="box"><h2>6. Storico modifiche</h2>'+(revisions.length?table(['Data modifica','Operatore','Dati precedenti registrati'],revisions.map(x=>[esc(x.edited_at?new Date(x.edited_at).toLocaleString('it-IT'):'—'),esc(x.edited_by||'—'),'<span class="muted">Snapshot conservato nella scheda digitale</span>'])):'<p>Nessuna revisione registrata.</p>')+'</section><div class="notice">Questo dossier è un riepilogo dei dati effettivamente presenti nel gestionale. Non sostituisce DDT, fatture, schede tecniche, piano HACCP, registrazioni di controllo obbligatorie per il processo o documenti originali. I campi non compilati sono evidenziati come mancanti e non vengono completati automaticamente.</div>';
}

function newProductionLot(){if(activeProfile?.role!=='admin')return;selectedProductionLotId='new';render()}
function editProductionLot(id){if(activeProfile?.role!=='admin')return;selectedProductionLotId=id;render()}
function cancelProductionLotEdit(){selectedProductionLotId=null;render()}
async function saveProductionLot(event){
 event.preventDefault();if(activeProfile?.role!=='admin')return;
 const form=event.currentTarget,fd=new FormData(form),id=form.dataset.lotId||null,previous=id&&id!=='new'?db.lots.find(x=>x.id===id):null;
 const values=Object.fromEntries(fd);const code=String(values.code||'').trim().toUpperCase();
 if(!/^L-[A-Z0-9-]+$/.test(code)){alert('Il codice lotto deve iniziare con L- e contenere solo lettere, numeri e trattini.');return}
 if(db.lots.some(x=>x.id!==previous?.id&&String(x.code||'').toUpperCase()===code)){alert('Questo codice lotto esiste già. Genera o inserisci un codice diverso.');return}
 if(values.expiry&&values.production_date&&values.expiry<values.production_date){alert('La data di conservazione non può precedere la produzione.');return}
 const orderIds=[];const ingredientUses=[];if(!previous){for(const [name,value] of fd.entries()){if(!String(name).startsWith('ingredient_use_'))continue;const quantity=Number(value)||0;if(quantity<=0)continue;const rawId=String(name).slice('ingredient_use_'.length),raw=db.ingredientLots.find(x=>String(x.id)===rawId);if(!raw){alert('Un lotto di materia prima selezionato non è più disponibile. Aggiorna la pagina.');return}if(raw.expiry&&raw.expiry<aslDateToday()){alert('Il lotto materia prima '+raw.supplier_lot+' risulta scaduto.');return}if(quantity>Number(raw.qty_remaining||0)){alert('Quantità insufficiente per '+raw.ingredient+' · lotto '+raw.supplier_lot+'.');return}ingredientUses.push({raw,quantity})}if(!ingredientUses.length){alert('Seleziona almeno un lotto di materia prima effettivamente utilizzato.');return}}
 const snapshot=previous?{code:previous.code,product:previous.product,production_date:previous.production_date||previous.date,production_time:previous.production_time,qty:previous.qty,unit:previous.unit,expiry:previous.expiry,operator:previous.operator,ingredients_lots:previous.ingredients_lots,packaging_lot:previous.packaging_lot,allergens:previous.allergens,process_notes:previous.process_notes,storage:previous.storage,status:previous.status,order_ids:previous.order_ids||[]}:null;
 const lot={...(previous||{}),id:previous?.id||crypto.randomUUID(),code,product:String(values.product||'').trim(),production_date:values.production_date,date:values.production_date,production_time:values.production_time||'',qty:Number(values.qty),unit:values.unit||'pezzi',expiry:values.expiry||'',operator:String(values.operator||'').trim(),ingredients_lots:previous?.ingredients_lots||'',ingredient_lots_used:previous?.ingredient_lots_used||ingredientUses.map(({raw,quantity})=>({raw_lot_id:raw.id,ingredient:raw.ingredient,supplier:raw.supplier,supplier_reference:raw.supplier_reference,supplier_lot:raw.supplier_lot,received_date:raw.received_date,expiry:raw.expiry,document_reference:raw.document_reference,quantity,unit:raw.unit,allergens:raw.allergens})),packaging_lot:String(values.packaging_lot||'').trim(),allergens:String(values.allergens||'').trim(),process_notes:String(values.process_notes||'').trim(),storage:String(values.storage||'').trim(),status:values.status||'Prodotto',order_ids:previous?.order_ids||[],created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),created_by:previous?.created_by||activeUser?.id,revision_history:previous?[...(previous.revision_history||[]),{edited_at:new Date().toISOString(),edited_by:activeProfile?.full_name||activeProfile?.email||'Amministratore',snapshot}]:[]};
 try{window.__menjaStage=previous?'aggiornamento scheda lotto':'creazione scheda lotto';for(const use of ingredientUses){const raw=use.raw;const updated={...raw,qty_remaining:Number((Number(raw.qty_remaining)-use.quantity).toFixed(6)),movements:[...(raw.movements||[]),{type:'consumo produzione',lot_id:lot.id,lot_code:lot.code,quantity:use.quantity,unit:raw.unit,date:lot.production_date,created_at:new Date().toISOString()}],updated_at:new Date().toISOString()};await persistRecord('ingredient_lots',updated)}await persistRecord('lots',lot);await loadOnlineData();selectedProductionLotId=null;render()}catch(error){showError(error)}
}

function menjaOrderLineQuantities(order,product){
 const target=String(product||'').trim().toLocaleLowerCase('it-IT');
 const lines=Array.isArray(order?.lines)?order.lines:[];
 if(lines.length)return lines.filter(line=>String(line.product||line.name||'').trim().toLocaleLowerCase('it-IT')===target).reduce((sum,line)=>sum+Math.max(0,Number(line.quantity??line.qty)||0),0);
 const raw=String(order?.items||'');
 let total=0;
 raw.split(/[,;\\n]+/).forEach(part=>{
  const value=part.trim();let match=value.match(/^([0-9]+(?:[.,][0-9]+)?)\\s*(?:×|x|\\*)\\s*(.+)$/i);
  if(match&&match[2].trim().toLocaleLowerCase('it-IT')===target){total+=Number(match[1].replace(',','.'));return}
  match=value.match(/^([0-9]+(?:[.,][0-9]+)?)\\s+(.+)$/);
  if(match&&match[2].trim().toLocaleLowerCase('it-IT')===target){total+=Number(match[1].replace(',','.'));return}
  match=value.match(/^(.+?)\\s*(?:×|x|\\*)\\s*([0-9]+(?:[.,][0-9]+)?)$/i);
  if(match&&match[1].trim().toLocaleLowerCase('it-IT')===target)total+=Number(match[2].replace(',','.'));
 });
 return total;
}
function menjaLotSoldAllocations(){
 const completed=['Confermato','In produzione','Pronto per il ritiro','Ritirato','Consegnato','Completato','Pagato'];
 const soldOrders=db.orders.filter(order=>completed.includes(String(order.status||''))).slice().sort((a,b)=>String(a.updated_at||a.created_at||a.pickup||'').localeCompare(String(b.updated_at||b.created_at||b.pickup||'')));
 const lotsByProduct=new Map(),lotById=new Map();
 db.lots.forEach(lot=>{
  lotById.set(String(lot.id),lot);
  const key=String(lot.product||'').trim().toLocaleLowerCase('it-IT');if(!key)return;
  if(!lotsByProduct.has(key))lotsByProduct.set(key,[]);
  lotsByProduct.get(key).push(lot);
 });
 const allocations=new Map(),remainingById=new Map();
 for(const lots of lotsByProduct.values()){
  lots.sort((a,b)=>String(a.production_date||a.date||a.created_at||'').localeCompare(String(b.production_date||b.date||b.created_at||'')));
  lots.forEach(l=>remainingById.set(String(l.id),Math.max(0,Number(l.qty)||0)));
 }
 const allocate=(lot,quantity,allowNegative=false)=>{
  if(!lot||quantity<=0)return quantity;
  const id=String(lot.id),remaining=remainingById.get(id)||0,used=allowNegative?quantity:Math.min(remaining,quantity);
  if(used>0){allocations.set(id,(allocations.get(id)||0)+used);remainingById.set(id,remaining-used)}
  return quantity-used;
 };
 for(const order of soldOrders){
  if(Array.isArray(order.lines)&&order.lines.length){
   for(const line of order.lines){
    const key=String(line.product||line.name||'').trim().toLocaleLowerCase('it-IT'),quantity=Math.max(0,Number(line.quantity??line.qty)||0);
    if(!key||!quantity)continue;
    const splitAllocations=Array.isArray(line.lot_allocations)?line.lot_allocations:[];
    if(splitAllocations.length){for(const part of splitAllocations)allocate(lotById.get(String(part.lot_id||'')),Math.max(0,Number(part.quantity)||0),true);continue}
    const explicitId=line.lot_id?String(line.lot_id):'';
    if(explicitId){allocate(lotById.get(explicitId),quantity,true);continue}
    let pending=quantity;
    const productLots=lotsByProduct.get(key)||[];
    for(const lot of productLots){if(pending<=0)break;pending=allocate(lot,pending)}
    if(pending>0&&productLots.length)allocate(productLots[productLots.length-1],pending,true);
   }
  }else{
   for(const [key,lots] of lotsByProduct){
    let pending=menjaOrderLineQuantities(order,key);
    for(const lot of lots){if(pending<=0)break;pending=allocate(lot,pending)}
    if(pending>0&&lots.length)allocate(lots[lots.length-1],pending,true);
   }
  }
 }
 return allocations;
}
function menjaLotSoldQuantity(lot,allocations){
 return allocations.get(String(lot.id))||0;
}
function menjaLotExpiryAlerts(){
 if(activeProfile?.role!=='admin')return [];
 const today=new Date();today.setHours(0,0,0,0);
 const horizon=new Date(today);horizon.setDate(horizon.getDate()+7);
 const allocations=menjaLotSoldAllocations();
 const parseDate=value=>{const raw=String(value||'').trim();if(!raw)return null;const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);let d;if(m)d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));else{const x=new Date(raw);if(Number.isNaN(x.getTime()))return null;d=new Date(x.getFullYear(),x.getMonth(),x.getDate())}return Number.isNaN(d.getTime())?null:d};
 return db.lots.filter(lot=>{const expiry=parseDate(lot.expiry);return expiry&&expiry<=horizon&&menjaLotAvailableQty(lot,allocations)>0}).map(lot=>{const expiry=parseDate(lot.expiry),days=Math.round((expiry-today)/86400000);return {...lot,alertExpiry:expiry,daysToExpiry:days,remaining:menjaLotAvailableQty(lot,allocations)}}).sort((a,b)=>a.alertExpiry-b.alertExpiry);
}
function menjaLotExpiryAlertPanel(){
 const alerts=menjaLotExpiryAlerts();if(!alerts.length)return '<section class="box"><h2>Allerte scadenza</h2><div class="empty">Nessun lotto invenduto in scadenza nei prossimi 7 giorni.</div></section>';
 const rows=alerts.map(lot=>'<tr><td><strong>'+esc(lot.product||'Prodotto')+'</strong></td><td>'+esc(lot.code||'—')+'</td><td>'+lot.alertExpiry.toLocaleDateString('it-IT')+'</td><td><strong>'+lot.remaining.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</strong></td><td>'+(lot.daysToExpiry<0?'<span style="color:#b42318;font-weight:800">SCADUTO da '+Math.abs(lot.daysToExpiry)+' gg</span>':lot.daysToExpiry===0?'<span style="color:#b42318;font-weight:800">Scade oggi</span>':'Scade tra '+lot.daysToExpiry+' gg')+'</td></tr>').join('');
 return '<section class="box" style="border:1px solid #dc2626"><h2 style="color:#b42318;margin-top:0">🔴 ALLERTE LOTTI IN SCADENZA ('+alerts.length+')</h2><p class="muted">Sono mostrati solo i lotti con giacenza residua positiva e data TMC/scadenza entro i prossimi 7 giorni. I lotti già scaduti restano segnalati finché hanno quantità invendute.</p><div class="tablewrap"><table class="table"><thead><tr><th>Tipo / prodotto</th><th>Lotto</th><th>Scadenza</th><th>Ancora invendute</th><th>Allerta</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}
function menjaWarehousePage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const lots=db.lots.slice().sort((a,b)=>String(b.production_date||b.date||b.created_at||'').localeCompare(String(a.production_date||a.date||a.created_at||'')));
 const soldAllocations=menjaLotSoldAllocations();
 const rows=lots.map(lot=>{
  const produced=Math.max(0,Number(lot.qty)||0),sold=menjaLotSoldQuantity(lot,soldAllocations),stock=produced-sold;
  const search=[lot.code,lot.product,lot.production_date,lot.date,lot.status,lot.operator].join(' ').toLocaleLowerCase('it-IT');
  return '<tr class="warehouse-row" data-search="'+esc(search)+'"><td>'+esc(lot.code||'—')+'</td><td>'+esc(lot.product||'—')+'</td><td>'+esc(lot.production_date||lot.date||'—')+'</td><td>'+produced.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</td><td>'+sold.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</td><td><strong>'+stock.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</strong></td><td><span class="badge">'+esc(lot.status||'Prodotto')+'</span></td></tr>';
 }).join('');
 const totals=lots.reduce((acc,lot)=>{const p=Math.max(0,Number(lot.qty)||0),s=menjaLotSoldQuantity(lot,soldAllocations);acc.produced+=p;acc.sold+=s;acc.stock+=p-s;return acc},{produced:0,sold:0,stock:0});
 const summary=(label,value)=>'<div class="box"><small class="muted">'+label+'</small><h2 style="margin:6px 0 0">'+value.toLocaleString('it-IT')+'</h2><small class="muted">pezzi</small></div>';
 return head('Magazzino','Giacenza delle basi per lotto: produzione meno ordini confermati; i valori negativi indicano vendite oltre la produzione')+menjaLotExpiryAlertPanel()+'<div class="grid three" style="margin-bottom:16px">'+summary('BASI PRODOTTE',totals.produced)+summary('BASI IMPEGNATE',totals.sold)+summary('GIACENZA NETTA',totals.stock)+'</div><div class="box"><div class="toolbar"><input class="field" placeholder="Cerca per lotto, prodotto o data" oninput="filterWarehouseLots(this)"><span class="muted">'+lots.length+' lotti</span></div>'+(lots.length?'<div class="tablewrap"><table class="table" id="warehouseLotsTable"><thead><tr><th>Lotto</th><th>Prodotto</th><th>Data</th><th>Prodotte</th><th>Vendute</th><th>Giacenza (+ / −)</th><th>Stato lotto</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="empty" id="warehouseSearchEmpty" hidden>Nessun lotto trovato.</div>':'<div class="empty">Non ci sono ancora lotti di produzione. Registra un lotto nell’area Lotti produzione: le quantità compariranno qui.</div>')+'</div><p class="muted">Le basi vengono impegnate automaticamente quando l’ordine passa a “Confermato” (o a uno stato successivo). Se l’ordine viene rifiutato o torna “Da approvare”, le quantità rientrano nella giacenza.</p>';
}
function filterWarehouseLots(input){
 const query=String(input.value||'').trim().toLocaleLowerCase('it-IT');
 const rows=[...document.querySelectorAll('#warehouseLotsTable tbody .warehouse-row')];let visible=0;
 rows.forEach(row=>{const match=!query||String(row.dataset.search||'').includes(query);row.style.display=match?'':'none';if(match)visible++});
 const empty=document.getElementById('warehouseSearchEmpty');if(empty)empty.hidden=visible!==0;
}

let selectedProductId=null,productDraft=null;
function productAdminPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const products=db.products.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
 if(productDraft){
  const p=productDraft;
  return '<div class="head"><div><h1>'+(selectedProductId?'Modifica prodotto':'Nuovo prodotto')+'</h1><div class="muted">Modifica i dati del catalogo</div></div><button class="btn" onclick="cancelProductEdit()">← Torna ai prodotti</button></div><form class="box formgrid" onsubmit="saveProduct(event)"><label class="wide">Nome prodotto<input class="field" name="name" required maxlength="120" value="'+esc(p.name||'')+'" placeholder="Es. Base pizza classica"></label><label>Categoria<input class="field" name="category" value="'+esc(p.category||'')+'" placeholder="Es. Basi precotte"></label><label>Prezzo indicativo (€)<input class="field" type="number" name="price" min="0" step="0.01" value="'+esc(p.price??'')+'"></label><div class="wide notice">La modifica del nome aggiornerà anche i riferimenti nei listini, nelle ricette e nei lotti collegati. Gli ordini già registrati manterranno i dati storici.</div><div class="wide dialogfoot"><button type="button" class="btn" onclick="cancelProductEdit()">Annulla</button><button class="btn gold" type="submit">Salva prodotto</button></div></form>';
 }
 const rows=products.map(p=>[esc(p.name||'—'),esc(p.category||'—'),p.price!==undefined&&p.price!==''?'€ '+Number(p.price||0).toFixed(2):'Da configurare',p.active===false?'<span class="badge">Archiviato</span>':'<span class="badge">Attivo</span>',p.active===false?'<button class="smallbtn" onclick="restoreProduct(\''+p.id+'\')">Ripristina</button>':'<button class="smallbtn" onclick="editProduct(\''+p.id+'\')">Modifica</button> <button class="smallbtn" style="color:#b42318;border-color:#b42318" onclick="deleteProduct(\''+p.id+'\')">Elimina</button>']);
 return '<div class="head"><div><h1>Prodotti</h1><div class="muted">Gestisci il catalogo, modifica i dati o elimina i prodotti non più utilizzati</div></div><button class="btn gold" onclick="openNew(\'Prodotti\')">＋ Nuovo prodotto</button></div><div class="box">'+(rows.length?table(['Prodotto','Categoria','Prezzo','Stato','Azioni'],rows):'<div class="empty">Non hai ancora inserito prodotti.</div>')+'</div>';
}
function editProduct(id){if(activeProfile?.role!=='admin')return;const p=db.products.find(x=>String(x.id)===String(id));if(!p)return;selectedProductId=p.id;productDraft={...p};render()}
function cancelProductEdit(){selectedProductId=null;productDraft=null;render()}
async function saveProduct(event){
 event.preventDefault();if(activeProfile?.role!=='admin'||!productDraft)return;
 const values=Object.fromEntries(new FormData(event.currentTarget));const name=String(values.name||'').trim();
 if(!name){alert('Inserisci il nome del prodotto.');return}
 if(db.products.some(p=>String(p.id)!==String(selectedProductId)&&String(p.name||'').trim().toLocaleLowerCase('it-IT')===name.toLocaleLowerCase('it-IT')&&p.active!==false)){alert('Esiste già un prodotto attivo con questo nome.');return}
 const previous=db.products.find(p=>String(p.id)===String(selectedProductId));
 const product={...(previous||{}),id:selectedProductId||crypto.randomUUID(),name,category:String(values.category||'').trim(),price:values.price===''?'':Number(values.price),active:previous?.active!==false,updated_at:new Date().toISOString()};
 try{
  await persistRecord('products',product);
  if(previous&&String(previous.name||'')!==name){
   const oldName=String(previous.name||'').trim();
   for(const list of db.priceLists){
    let changed=false;
    if(Array.isArray(list.products))list.products=list.products.map(line=>{if(String(line.product_id||'')===String(product.id)||String(line.product||'').trim()===oldName){changed=true;return {...line,product:name,product_id:line.product_id||product.id}}return line});
    if(String(list.product||'').trim()===oldName){list.product=name;changed=true}
    if(changed)await persistRecord('priceLists',list);
   }
   for(const recipe of db.recipes){if(String(recipe.product||'').trim()===oldName){recipe.product=name;await persistRecord('recipes',recipe)}}
   for(const lot of db.lots){if(String(lot.product||'').trim()===oldName){lot.product=name;await persistRecord('lots',lot)}}
   for(const item of db.production){if(String(item.product||'').trim()===oldName){item.product=name;await persistRecord('production',item)}}
  }
  selectedProductId=null;productDraft=null;await loadOnlineData();render();
 }catch(error){showError(error)}
}
function productHasHistory(product){
 const id=String(product.id),name=String(product.name||'').trim().toLocaleLowerCase('it-IT');
 return db.priceLists.some(list=>priceListProducts(list).some(line=>String(line.product_id||'')===id||String(line.product||'').trim().toLocaleLowerCase('it-IT')===name))
 ||db.recipes.some(x=>String(x.product||'').trim().toLocaleLowerCase('it-IT')===name)
 ||db.lots.some(x=>String(x.product||'').trim().toLocaleLowerCase('it-IT')===name)
 ||db.production.some(x=>String(x.product||'').trim().toLocaleLowerCase('it-IT')===name)
 ||db.orders.some(o=>(Array.isArray(o.lines)&&o.lines.some(line=>String(line.product_id||'')===id||String(line.product||'').trim().toLocaleLowerCase('it-IT')===name))||String(o.items||'').toLocaleLowerCase('it-IT').includes(String(product.name||'').toLocaleLowerCase('it-IT')));
}
async function deleteProduct(id){
 if(activeProfile?.role!=='admin')return;const product=db.products.find(p=>String(p.id)===String(id));if(!product)return;
 const history=productHasHistory(product);
 const message=history?'Questo prodotto è già utilizzato in listini, ricette, lotti o ordini. Verrà archiviato per conservare lo storico e non sarà più disponibile nei nuovi listini. Continuare?':'Eliminare definitivamente il prodotto "'+product.name+'"?';
 if(!confirm(message))return;
 try{
  if(history){await persistRecord('products',{...product,active:false,archived_at:new Date().toISOString()})}
  else{const {data,error}=await onlineClient.from('records').delete().eq('id',id).eq('kind','products').eq('owner_id',activeUser.id).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Il prodotto non è stato eliminato. Verifica i permessi.');await menjaWriteAudit('eliminato','products',id,product,null)}
  await loadOnlineData();render();
 }catch(error){showError(error)}
}
async function restoreProduct(id){if(activeProfile?.role!=='admin')return;const p=db.products.find(x=>String(x.id)===String(id));if(!p)return;try{await persistRecord('products',{...p,active:true,archived_at:null});await loadOnlineData();render()}catch(error){showError(error)}}

function adminFinancePage(){const paid=db.orders.filter(o=>o.status==='Pagato').slice().sort((a,b)=>String(b.paid_at||'').localeCompare(String(a.paid_at||'')));const total=paid.reduce((sum,o)=>sum+(Number(o.total)||0),0);const money=n=>'€ '+Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});const rows=paid.map(o=>[esc(o.code||'—'),esc(orderCustomerName(o)),esc(o.paid_at?new Date(o.paid_at).toLocaleDateString('it-IT'):'—'),money(o.total),'<span class="badge">Pagato</span>']);return '<div class="head"><div><h1>Finanza</h1><div class="muted">Ordini incassati e conclusi</div></div></div><div class="grid two" style="margin-bottom:16px"><div class="card"><small>INCASSI TOTALI</small><div class="metric">'+money(total)+'</div></div><div class="card"><small>ORDINI PAGATI</small><div class="metric">'+paid.length+'</div></div></div><section class="box"><h2>Ordini incassati</h2><div class="toolbar" style="margin-bottom:12px"><input class="field" type="search" placeholder="Cerca per numero ordine o nome cliente…" oninput="filterRows(this)" aria-label="Cerca ordini e clienti negli incassi"><span class="muted">'+paid.length+' ordini pagati</span></div>'+(rows.length?table(['Numero ordine','Cliente','Data incasso','Importo','Stato'],rows):'<div class="empty">Non ci sono ancora ordini segnati come pagati.</div>')+'</section>';}
function customerNotificationsPanel(showSettings=true){
 const notifications=Array.isArray(db.notifications)?db.notifications:[];
 const unread=notifications.filter(n=>!n.read_at).length;
 const controls=showSettings?'<p class="muted">Gestisci qui gli avvisi su ordini e messaggi, anche quando il gestionale non è aperto.</p><button class="btn gold" type="button" onclick="enableCustomerPushNotifications()">Attiva notifiche sul dispositivo</button>'+menjaSoundToggleButton():'';
 return '<section class="box" style="margin:16px 0"><h2>🔔 Notifiche'+(unread?' · '+unread+' nuove':'')+'</h2>'+controls+(notifications.length?notifications.slice(0,12).map(n=>'<article style="padding:12px 0;border-top:1px solid var(--line);'+(!n.read_at?'font-weight:600':'')+'"><strong>'+esc(n.title||'Aggiornamento ordine')+'</strong><p style="margin:5px 0">'+esc(n.body||'')+'</p><small class="muted">'+new Date(n.created_at).toLocaleString('it-IT')+'</small>'+(n.read_at?'':' <button class="btn" style="margin-left:8px;padding:5px 9px" onclick="markCustomerNotificationRead(this.dataset.id)" data-id="'+n.id+'">Segna come letta</button>')+'</article>').join(''):'<p class="muted">Non hai ancora ricevuto notifiche.</p>')+'</section>';
}
async function enableCustomerPushNotifications(){
 try{
  if(!activeUser||!['admin','customer'].includes(activeProfile?.role))throw new Error('Accedi al gestionale per attivare le notifiche.');
  if(!('serviceWorker' in navigator)||!('Notification' in window))throw new Error('Questo browser non supporta le notifiche push.');
  if(!window.firebase)throw new Error('Il servizio notifiche non è ancora caricato. Aggiorna la pagina e riprova.');
  if(firebase.messaging?.isSupported&&!await firebase.messaging.isSupported())throw new Error('Questo browser non supporta Firebase Web Push. Su iPhone usa il gestionale installato nella schermata Home e aggiorna iOS.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Permesso notifiche non concesso. Abilitalo nelle impostazioni del browser.');
  const firebaseConfig={apiKey:'AIzaSyCGnhppVUBNrsFimsNgxTHw2cqltMm0fF4',authDomain:'menja-i-mut-gestionale.firebaseapp.com',projectId:'menja-i-mut-gestionale',storageBucket:'menja-i-mut-gestionale.firebasestorage.app',messagingSenderId:'825562456235',appId:'1:825562456235:web:096d370ed9f6cbd5ca17ee',measurementId:'G-Q7MD73ZC1C'};
  if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
  const registration=await navigator.serviceWorker.ready;
  const messaging=firebase.messaging();
  const token=await messaging.getToken({vapidKey:'BGI6IAUpgKYaFy0jW_ofS_JsYU4QAneERCYyk51F1-JPugDMThGNgIVNHfGWUavZYlSZMY32EzEMRQY7I3-7FSw',serviceWorkerRegistration:registration});
  if(!token)throw new Error('Firebase non ha restituito il token del dispositivo.');
  const{error}=await onlineClient.from('fcm_tokens').upsert({user_id:activeUser.id,token,platform:/iPhone|iPad|iPod/i.test(navigator.userAgent)?'ios-web':'web',updated_at:new Date().toISOString()},{onConflict:'token'});
  if(error)throw error;
  alert('Notifiche attivate su questo dispositivo. Riceverai gli aggiornamenti degli ordini anche con il gestionale chiuso, se il browser o il sistema operativo consente le notifiche in background.');
 }catch(error){console.error('Attivazione notifiche push:',error);alert(error?.message||'Non è stato possibile attivare le notifiche.')}
}
async function markCustomerNotificationRead(id){
 const{error}=await onlineClient.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);
 if(error){showError(error);return}
 const item=(db.notifications||[]).find(n=>String(n.id)===String(id));if(item)item.read_at=new Date().toISOString();render();
}
let customerNotificationTimer=null;
let customerKnownNotificationIds=null;
async function refreshCustomerNotifications(){
 if(activeProfile?.role!=='customer'||!onlineClient)return;
 try{const{data,error}=await onlineClient.from('notifications').select('*').order('created_at',{ascending:false}).limit(50);if(error)throw error;const fresh=data||[];const newItems=customerKnownNotificationIds===null?[]:fresh.filter(n=>!customerKnownNotificationIds.has(String(n.id)));customerKnownNotificationIds=new Set(fresh.map(n=>String(n.id)));db.notifications=fresh;if(newItems.length){const latest=newItems[0];menjaPlayAlertSound();if('Notification' in window&&Notification.permission==='granted'){try{new Notification(latest.title||'Menja i Mut',{body:latest.body||'Aggiornamento sul tuo ordine',tag:'menja-notification-'+latest.id})}catch(e){console.warn('Notifica browser non disponibile:',e)}}if(['Home','Storico ordini','Impostazioni'].includes(page))render()}}catch(e){console.error('Aggiornamento notifiche cliente non riuscito:',e)}
}
function adminFormatSection(){return '<div class="box" style="margin-top:18px;border:1px solid #d92d20"><h2 style="color:#b42318">Formatta programma</h2><p>Elimina definitivamente tutti i dati del gestionale: clienti e account cliente, ordini, prodotti, listini, ricette, produzione, lotti, magazzino, fidelity, finanza, fatture, chat, messaggi, notifiche e allegati.</p><p><strong>L’account principale del titolare e il suo accesso resteranno attivi.</strong> Questa operazione non si può annullare.</p><button id="formatProgramButton" class="btn" style="background:#b42318;color:#fff;border-color:#b42318" type="button" onclick="formatProgramFromSettings()">Formatta programma</button></div>'}
async function formatProgramFromSettings(){
 if(activeProfile?.role!=='admin'||!activeUser){alert('Operazione consentita solo al titolare.');return}
 const phrase=window.prompt('ATTENZIONE: verranno cancellati tutti i dati e tutti gli account cliente.\n\nPer continuare, scrivi esattamente FORMATTA.');
 if(phrase!=='FORMATTA')return;
 if(!window.confirm('Confermi definitivamente la formattazione completa? L’operazione non è reversibile.'))return;
 const button=document.getElementById('formatProgramButton');if(button){button.disabled=true;button.textContent='Formattazione in corso…'}
 try{
  window.__menjaStage='formattazione completa del gestionale';
  const{data,error}=await onlineClient.rpc('admin_format_program');
  if(error)throw error;
  const summary=Array.isArray(data)?data[0]:data;
  selectedAdminOrderId=null;selectedChatCustomer=null;ownerKnownOrderIds=null;adminKnownChatNotificationIds=null;
  window.__menjaUnreadByCustomer={};window.__menjaUnreadChatCount=0;window.__menjaPendingOrderCount=0;
  if(activeProfile){activeProfile.fidelity_points=0;activeProfile.customer_code=null;activeProfile.price_list_id=null;activeProfile.price_list_ids=[]}
  await loadOnlineData();
  startOwnerNoticeMonitoring();
  page='Dashboard';render();
  const removed=summary?.customer_accounts_deleted??0;
  alert('Formattazione completata.\n\nAccount cliente eliminati: '+removed+'\nDati, ordini, lotti, chat e notifiche cancellati.\n\nL’account del titolare è stato mantenuto.');
 }catch(error){showError(error);if(button){button.disabled=false;button.textContent='Formatta programma'}}
}
let menjaStatsPeriod='month';
function setMenjaStatsPeriod(period){if(!['week','month','year'].includes(period))return;menjaStatsPeriod=period;render()}
function setMenjaStatsCustomer(id){window.menjaStatsCustomerId=String(id||'');render()}
function setMenjaStatsCustomerType(type){window.menjaStatsCustomerType=['tutti','azienda'].includes(type)?type:'privato';render()}
function menjaStatisticsPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const acceptedStatuses=['Confermato','Pronto per il ritiro','Consegnato','Pagato'];
 const seenOrderIds=new Set();
 const valid=db.orders.filter(o=>{const id=String(o.id||'');if(!id||seenOrderIds.has(id)||!acceptedStatuses.includes(String(o.status||'')))return false;seenOrderIds.add(id);return true;});
 const activeCustomers=db.customers.filter(c=>c.isProfile&&c.role==='customer'&&c.approval_status==='approved'&&!c.deleted_at);
 const privateCount=activeCustomers.filter(c=>c.customer_type!=='azienda').length,companyCount=activeCustomers.filter(c=>c.customer_type==='azienda').length;
 const dateOf=o=>{const raw=o.created_at||o.pickup||o.updated_at;const d=raw?new Date(raw):null;return d&&!Number.isNaN(d.getTime())?d:null};
 const linesOf=o=>{
  if(!Array.isArray(o.lines)||!o.lines.length)return [];
  return o.lines.map(l=>({name:String(l.product||l.product_name||l.name||'').trim(),qty:Number(l.quantity??l.qty)})).filter(l=>l.name&&Number.isFinite(l.qty)&&l.qty>0);
 };
 const totals=valid.reduce((acc,o)=>{for(const l of linesOf(o))acc[l.name]=(acc[l.name]||0)+l.qty;return acc},{});
 const totalBases=Object.values(totals).reduce((a,b)=>a+b,0);
 const byType=Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,n])=>[esc(name),n,totalBases?Math.round(n/totalBases*100)+'%':'0%']);
 const customerById=new Map(db.customers.filter(c=>c.isProfile).map(c=>[String(c.id),c]));
 const customerByCode=new Map(db.customers.filter(c=>c.isProfile&&c.code).map(c=>[String(c.code).toLowerCase(),c]));
 const customerByEmail=new Map(db.customers.filter(c=>c.isProfile&&c.email).map(c=>[String(c.email).toLowerCase(),c]));
 const customerForOrder=o=>customerById.get(String(o.customer_id||''))||customerByCode.get(String(o.customer_code||'').toLowerCase())||customerByEmail.get(String(o.customer_email||'').toLowerCase())||null;
 const rankedMap=new Map();let ordersWithoutCustomer=0,ordersWithoutLines=0;
 valid.forEach(o=>{const lines=linesOf(o),qty=lines.reduce((n,l)=>n+l.qty,0);if(!qty){ordersWithoutLines++;return}const c=customerForOrder(o);if(!c){ordersWithoutCustomer++;return}const id=String(c.id),name=c.name||c.email||'Cliente';const type=c.customer_type==='azienda'||String(c.category||'').toLowerCase().includes('aziend')?'azienda':'privato';if(!rankedMap.has(id))rankedMap.set(id,{id,name,type,total:0,orders:0});const row=rankedMap.get(id);row.total+=qty;row.orders++});
 const ranking=[...rankedMap.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'it'));
 const period=menjaStatsPeriod,now=new Date(),count=period==='year'?5:12;
 const bucketStart=(d,offset)=>{const x=new Date(d);if(period==='week'){const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day+offset*7);x.setHours(0,0,0,0)}else if(period==='month'){x.setDate(1);x.setHours(0,0,0,0);x.setMonth(x.getMonth()+offset)}else{x.setMonth(0,1);x.setHours(0,0,0,0);x.setFullYear(x.getFullYear()+offset)}return x};
 const keyOf=d=>period==='week'?(()=>{const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')})():period==='month'?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'):String(d.getFullYear());
 const buckets=Array.from({length:count},(_,i)=>{const d=bucketStart(now,i-count+1),prev=bucketStart(now,i-count*2+1);return {key:keyOf(d),prevKey:keyOf(prev),label:period==='week'?d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}):period==='month'?d.toLocaleDateString('it-IT',{month:'short'}).replace('.',''):String(d.getFullYear()),current:0,previous:0}});
 const lookup=new Map(buckets.map(b=>[b.key,b])),previousLookup=new Map(buckets.map(b=>[b.prevKey,b]));
 valid.forEach(o=>{const d=dateOf(o);if(!d)return;const q=linesOf(o).reduce((sum,l)=>sum+l.qty,0),k=keyOf(d);if(lookup.has(k))lookup.get(k).current+=q;else if(previousLookup.has(k))previousLookup.get(k).previous+=q});
 const currentTotal=buckets.reduce((s,b)=>s+b.current,0),previousTotal=buckets.reduce((s,b)=>s+b.previous,0),delta=currentTotal-previousTotal,deltaPct=previousTotal?delta/previousTotal*100:null;
 const periodName=period==='week'?'settimane':period==='month'?'mesi':'anni',deltaLabel=previousTotal?(delta>0?'+':'')+delta+' basi ('+(deltaPct>0?'+':'')+deltaPct.toFixed(1)+'%) rispetto al periodo precedente':'Nessun dato nel periodo di confronto';
 const max=Math.max(1,...buckets.flatMap(b=>[b.current,b.previous])),W=920,H=310,L=48,R=16,T=22,B=52,pw=W-L-R,ph=H-T-B,step=pw/count,bw=Math.min(25,step*.28);
 const grid=[0,1,2,3,4].map(i=>{const val=Math.ceil(max*i/4),y=T+ph-val/max*ph;return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="currentColor" opacity=".13"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="currentColor">'+val+'</text>'}).join('');
 const bars=buckets.map((b,i)=>{const cx=L+i*step+step/2,h1=b.current/max*ph,h2=b.previous/max*ph;return '<g><title>'+esc(b.label)+' · periodo attuale: '+b.current+' basi · confronto precedente: '+b.previous+' basi</title><rect x="'+(cx-bw-2)+'" y="'+(T+ph-h1)+'" width="'+bw+'" height="'+h1+'" rx="4" fill="#c99b3b"/><rect x="'+(cx+2)+'" y="'+(T+ph-h2)+'" width="'+bw+'" height="'+h2+'" rx="4" fill="#8b929b"/><text x="'+cx+'" y="'+(H-18)+'" text-anchor="middle" font-size="11" fill="currentColor">'+esc(b.label)+'</text></g>'}).join('');
 const selectedType=window.menjaStatsCustomerType||'privato',filteredRanking=ranking.filter(c=>selectedType==='tutti'||c.type===selectedType);
 const rankingRows=filteredRanking.map((c,i)=>[i+1,esc(c.name),c.total,c.orders]);
 const selectedId=String(window.menjaStatsCustomerId||''),selectedCustomer=ranking.find(c=>c.id===selectedId);
 const selectedOrderIds=new Set(valid.filter(o=>{const c=customerForOrder(o);return c&&String(c.id)===selectedId}).map(o=>String(o.id)));
 const customerBuckets=buckets.map(b=>({...b,current:0,previous:0}));
 valid.forEach(o=>{if(!selectedOrderIds.has(String(o.id)))return;const d=dateOf(o);if(!d)return;const q=linesOf(o).reduce((n,l)=>n+l.qty,0),k=keyOf(d);const target=customerBuckets.find(x=>x.key===k),prev=customerBuckets.find(x=>x.prevKey===k);if(target)target.current+=q;else if(prev)prev.previous+=q});
 const customerCurrent=customerBuckets.reduce((n,b)=>n+b.current,0),customerPrevious=customerBuckets.reduce((n,b)=>n+b.previous,0),customerMax=Math.max(1,...customerBuckets.flatMap(b=>[b.current,b.previous]));
 const customerBars=customerBuckets.map((b,i)=>{const cx=L+i*step+step/2,h1=b.current/customerMax*ph,h2=b.previous/customerMax*ph;return '<g><title>'+esc(b.label)+' · attuale: '+b.current+' · precedente: '+b.previous+'</title><rect x="'+(cx-bw-2)+'" y="'+(T+ph-h1)+'" width="'+bw+'" height="'+h1+'" rx="4" fill="#c99b3b"/><rect x="'+(cx+2)+'" y="'+(T+ph-h2)+'" width="'+bw+'" height="'+h2+'" rx="4" fill="#8b929b"/><text x="'+cx+'" y="'+(H-18)+'" text-anchor="middle" font-size="11" fill="currentColor">'+esc(b.label)+'</text></g>'}).join('');
 const customerOptions=ranking.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selectedId?'selected':'')+'>'+esc(c.name)+' · '+c.total+' basi</option>').join('');
 const typeRows=byType.length?table(['Tipo di base / prodotto','Basi vendute','Incidenza'],byType):'<div class="empty">Non risultano ancora quantità nei prodotti degli ordini confermati.</div>';
 const rankTable=filteredRanking.length?table(['#','Cliente','Basi acquistate','Ordini'],rankingRows):'<div class="empty">Nessun acquisto registrato per questa categoria.</div>';
 return '<div class="head"><div><h1>Statistiche</h1><div class="muted">Clienti e andamento delle basi vendute</div></div></div>'+
 '<div class="grid four" style="margin-bottom:16px"><div class="card"><small>CLIENTI ATTIVI</small><div class="metric">'+activeCustomers.length+'</div></div><div class="card"><small>PRIVATI</small><div class="metric">'+privateCount+'</div></div><div class="card"><small>AZIENDE</small><div class="metric">'+companyCount+'</div></div><div class="card"><small>BASI VENDUTE</small><div class="metric">'+totalBases+'</div><small class="muted">Ordini confermati e successivi</small></div></div>'+
 '<details class="box" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:800;font-size:16px">Classifica clienti per basi acquistate <span class="muted" style="font-size:12px">· '+ranking.length+' clienti con ordini identificati</span></summary><div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"><button class="smallbtn" onclick="setMenjaStatsCustomerType(\'tutti\')" '+(selectedType==='tutti'?'disabled':'')+'>Tutti ('+ranking.length+')</button><button class="smallbtn" onclick="setMenjaStatsCustomerType(\'privato\')" '+(selectedType==='privato'?'disabled':'')+'>Privati ('+ranking.filter(c=>c.type==='privato').length+')</button><button class="smallbtn" onclick="setMenjaStatsCustomerType(\'azienda\')" '+(selectedType==='azienda'?'disabled':'')+'>Aziende ('+ranking.filter(c=>c.type==='azienda').length+')</button></div>'+rankTable+'<p class="muted" style="font-size:12px;margin-bottom:0">Conteggio basato esclusivamente su righe prodotto e clienti riconosciuti tramite ID, codice cliente o email. Ordini senza cliente associabile: '+ordersWithoutCustomer+'. Ordini senza righe prodotto valide: '+ordersWithoutLines+'.</p></details>'+
 '<details class="box" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:800;font-size:16px">Basi vendute per tipo / prodotto</summary><div style="margin-top:14px">'+typeRows+'</div></details>'+
 '<section class="box"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">Confronto vendite</h2><div class="muted">Basi vendute per '+periodName+'</div></div><div class="actions"><button class="smallbtn" onclick="setMenjaStatsPeriod(\'week\')" '+(period==='week'?'disabled':'')+'>Settimana</button><button class="smallbtn" onclick="setMenjaStatsPeriod(\'month\')" '+(period==='month'?'disabled':'')+'>Mese</button><button class="smallbtn" onclick="setMenjaStatsPeriod(\'year\')" '+(period==='year'?'disabled':'')+'>Anno</button></div></div>'+
 '<div class="grid two" style="margin:14px 0"><div><small class="muted">PERIODO ATTUALE</small><div class="metric">'+currentTotal+'</div></div><div><small class="muted">PERIODO PRECEDENTE</small><div class="metric">'+previousTotal+'</div><small class="muted">'+esc(deltaLabel)+'</small></div></div>'+
 '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin:10px 0"><span>🟨 Periodo selezionato</span><span>⬜ Periodo precedente</span></div><div style="width:100%;overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Confronto basi vendute per '+periodName+'" style="width:100%;min-width:560px;height:auto;display:block">'+grid+bars+'</svg></div>'+
 '<p class="muted" style="font-size:12px;margin-bottom:0">Dati calcolati dalle righe prodotto degli ordini con stato Confermato, Pronto per il ritiro, Consegnato o Pagato. Gli ordini senza righe prodotto non vengono stimati dal testo libero.</p>'+
 '<div style="border-top:1px solid var(--line,#ddd);margin-top:18px;padding-top:16px"><h2>Andamento del singolo cliente</h2><label style="display:block;max-width:480px;margin:10px 0">Seleziona cliente<select class="field" style="width:100%;margin-top:6px" onchange="setMenjaStatsCustomer(this.value)"><option value="">Scegli un cliente</option>'+customerOptions+'</select></label>'+
 (selectedCustomer?'<div class="grid two" style="margin:12px 0"><div><small class="muted">BASI ACQUISTATE DA '+esc(selectedCustomer.name).toUpperCase()+'</small><div class="metric">'+selectedCustomer.total+'</div></div><div><small class="muted">ORDINI CON ACQUISTI</small><div class="metric">'+selectedCustomer.orders+'</div></div></div><div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;margin:10px 0"><span>🟨 Periodo selezionato</span><span>⬜ Periodo precedente</span></div><div style="width:100%;overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Andamento acquisti di '+esc(selectedCustomer.name)+'" style="width:100%;min-width:560px;height:auto;display:block">'+[0,1,2,3,4].map(i=>{const val=Math.ceil(customerMax*i/4),y=T+ph-val/customerMax*ph;return '<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="currentColor" opacity=".13"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end" font-size="11" fill="currentColor">'+val+'</text>'}).join('')+customerBars+'</svg></div><small class="muted">Nel periodo visualizzato: '+customerCurrent+' basi; nel periodo di confronto: '+customerPrevious+' basi.</small>':'<div class="empty">Seleziona un cliente per visualizzare il suo andamento settimanale, mensile o annuale.</div>')+'</div></section>';
}
function modulePage(){if(page==='ASL'&&activeProfile?.role==='admin')return aslPage();if(page==='Statistiche'&&activeProfile?.role==='admin')return menjaStatisticsPage();if(page==='Impostazioni'&&activeProfile?.role==='admin')return companyProfileSettingsPage()+adminFormatSection();if(page==='Finanza'&&activeProfile?.role==='admin')return adminFinancePage();if(page==='Prodotti'&&activeProfile?.role==='admin')return productAdminPage();if(page==='Magazzino'&&activeProfile?.role==='admin')return menjaWarehousePage();if(page==='Lotti produzione'&&activeProfile?.role==='admin')return productionLotsPage();if(page==='Ordini'&&(selectedAdminOrderId||activeProfile?.role==='admin'))return adminOrdersPage();if(activeProfile?.role==='customer'){if(page==='Il mio listino'||page==='I miei listini')return customerPriceListPage();if(page==='Resoconto aziendale'&&customerIsCompany())return customerCompanySummaryPage();if(page==='Punti fidelity'&&customerIsCompany())return '<div class="box"><h2>La fidelity non è prevista per gli account aziendali</h2></div>';if(page==='Impostazioni')return '<div class="head"><div><h1>Impostazioni</h1><div class="muted">Preferenze delle notifiche su questo dispositivo</div></div></div>'+customerNotificationsPanel(true);if(page==='Home'){return '<div class="customer-home"><div class="customer-greeting"><div><span>AREA CLIENTI</span><h1>Ciao, '+esc((activeProfile.full_name||'').split(' ')[0]||'benvenuto')+'!</h1><p>La tua esperienza Menja i Mut, tutta qui.</p></div></div>'+(customerIsCompany()?'':customerLoyaltyCard())+'<div class="customer-quick-grid"><button class="customer-action primary" onclick="goCustomerPage(\'Nuovo ordine\')"><span>＋</span><strong>Fai un ordine</strong><small>Invia una nuova richiesta</small></button>'+(customerIsCompany()?'':"<button class=\"customer-action\" onclick=\"goCustomerPage(\\'Punti fidelity\\')\"><span>✧</span><strong>La mia fidelity</strong><small>Consulta tessera e movimenti</small></button>")+'<button class="customer-action" onclick="goCustomerPage(\'Storico ordini\')"><span>▤</span><strong>I miei ordini</strong><small>Controlla le tue richieste</small></button><button class="customer-action" onclick="goCustomerPage(\'Chat col titolare\')"><span>✉</span><strong>Contatta il titolare</strong><small>Scrivici direttamente</small></button></div>'+customerNotificationsPanel(false)+''+(customerIsCompany()?'<p class="customer-footnote">Il resoconto aziendale viene aggiornato in base agli ordini registrati.</p>':'<p class="customer-footnote">I punti e il codice sono associati al tuo account personale.</p>')+'</div>'}if(page==='Nuovo ordine')return '<div class="head"><div><h1>Crea nuovo ordine</h1><div class="muted">Invia la richiesta al titolare</div></div></div>'+menjaCustomerOrderForm();if(page==='Storico ordini'){const rows=db.orders.slice().reverse().map(o=>{const lines=Array.isArray(o.lines)?o.lines:[],lotDetails=lines.flatMap(line=>Array.isArray(line.lot_allocations)&&line.lot_allocations.length?line.lot_allocations.map(a=>(a.lot_code||a.lot_id||'Lotto')+' × '+a.quantity):line.lot_code?[line.lot_code+' × '+(line.quantity??line.qty??'')]:[]);const lotText=lotDetails.length?[...new Set(lotDetails)].join(' · '):'In attesa di assegnazione';return [esc(o.code||''),esc(formatCustomerPickupDate(o.pickup)),esc(o.items||''),esc(lotText),esc(o.status||'Da approvare')]});return '<div class="head"><div><h1>Storico ordini</h1><div class="muted">Le tue richieste, i lotti assegnati e il loro stato</div></div></div>'+customerNotificationsPanel()+'<div class="box">'+(rows.length?table(['Ordine','Giorno di ritiro','Prodotti e quantità','Lotto assegnato','Stato'],rows):'<div class="empty">Non hai ancora inviato ordini.</div>')+'</div>'}if(page==='Punti fidelity'&&!customerIsCompany()){return '<div class="head"><div><h1>La mia fidelity</h1><div class="muted">La tua tessera personale e il saldo punti</div></div></div>'+customerLoyaltyCard()+'<div class="customer-points-summary"><div><small>SALDO DISPONIBILE</small><strong>'+(Number(activeProfile.fidelity_points)||0)+'</strong><span>punti</span></div><p>Mostra questa tessera quando effettui un acquisto da Menja i Mut.</p></div><div class="box"><h2>Movimenti punti</h2>'+(db.fidelity.length?table(['Data','Punti','Nota'],db.fidelity.map(m=>[esc(m.date||'—'),Number(m.points)||0,esc(m.note||'')])):'<div class="empty">Non sono ancora presenti movimenti punti.</div>')+'</div>'}if(page==='Notifiche'){return '<div class="head"><div><h1>Notifiche</h1><div class="muted">Avvisi su ordini e messaggi</div></div><button class="btn" type="button" onclick="goCustomerPage(\'Chat col titolare\')">← Torna alla chat</button></div>'+customerNotificationsPanel(true)}if(page==='Chat col titolare'){setTimeout(()=>startChatRefresh(activeProfile.id),0);const unreadNotifications=(db.notifications||[]).filter(n=>!n.read_at).length;const notificationBadge=unreadNotifications?'<span style="display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 6px;margin-left:6px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:800">'+unreadNotifications+'</span>':'';const notificationButton='<button class="btn" type="button" onclick="goCustomerPage(\'Notifiche\')">🔔 Notifiche'+notificationBadge+'</button>';return '<div class="head"><div><h1>Chat col titolare</h1><div class="muted">Conversazione privata</div></div>'+notificationButton+'</div>'+menjaChatPanel(activeProfile.id,'Messaggi') }}if(page==='Scheda cliente'&&activeProfile?.role==='admin'){return adminCustomerDetailPage()}if(page==='Listini'&&activeProfile?.role==='admin'){return priceListAdminPage()}if(page==='Chat clienti'&&activeProfile?.role==='admin'){const profiles=db.customers.filter(c=>c.isProfile&&c.id!==activeProfile.id).slice().sort((a,b)=>{const ua=window.__menjaUnreadByCustomer?.[String(a.id)]||{count:0,latest:''},ub=window.__menjaUnreadByCustomer?.[String(b.id)]||{count:0,latest:''};if((ua.count||0)!==(ub.count||0))return (ub.count||0)-(ua.count||0);if((ua.count||0)>0&&ua.latest!==ub.latest)return String(ub.latest).localeCompare(String(ua.latest));return String(a.name||a.email||'').localeCompare(String(b.name||b.email||''),'it',{sensitivity:'base'})});const chosen=profiles.find(c=>c.id===selectedChatCustomer);if(chosen)setTimeout(()=>startChatRefresh(chosen.id),0);return '<div class="head"><div><h1>Chat clienti</h1><div class="muted">Messaggi privati con i clienti</div></div></div><div class="grid two"><div class="box"><h2>Clienti</h2>'+profiles.map(c=>{const unread=window.__menjaUnreadByCustomer?.[String(c.id)]?.count||0;return '<button class="btn" style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;margin:6px 0;text-align:left" onclick="openAdminChat(this.dataset.id)" data-id="'+c.id+'"><span>'+esc(c.name||c.email)+' · '+esc(c.code||'')+'</span>'+(unread?'<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:800">'+unread+'</span>':'')+'</button>'}).join('')+'</div>'+(chosen?menjaChatPanel(chosen.id,chosen.name||chosen.email):'<div class="box empty">Seleziona un cliente per aprire la conversazione.</div>')+'</div>'}return menjaBaseModulePage()}
async function signOut(){if(ownerNoticeTimer){clearInterval(ownerNoticeTimer);ownerNoticeTimer=null}if(customerNotificationTimer){clearInterval(customerNotificationTimer);customerNotificationTimer=null}await onlineClient?.auth.signOut();activeUser=null;activeProfile=null;startOnline()}
async function approveProfile(id,status){try{const value=({Attivo:'approved','In attesa di abilitazione':'pending',Sospeso:'suspended',Rifiutato:'rejected'})[status]||'approved';const {error}=await onlineClient.from('profiles').update({approval_status:value}).eq('id',id);if(error)throw error;await loadOnlineData();await refreshOwnerNotice();render()}catch(e){showError(e)}}

async function menjaAwardFidelityForPaidOrder(order){
 window.__menjaStage='accredito fidelity: verifica ordine';
 window.__menjaFidelityAwardLocks=window.__menjaFidelityAwardLocks||{};
 const lockKey=String(order.id);if(window.__menjaFidelityAwardLocks[lockKey])return;window.__menjaFidelityAwardLocks[lockKey]=true;
 try{
 if(activeProfile?.role!=='admin'||!onlineClient)throw new Error('Accredito fidelity non autorizzato.');
 if(String(order.status)!=='Pagato'||!order.paid_at)throw new Error('La fidelity viene accreditata solo dopo la conferma del pagamento. La consegna viene verificata prima di registrare il pagamento.');
 const lines=Array.isArray(order.lines)?order.lines:[];
 let quantity=lines.reduce((sum,line)=>sum+Math.max(0,Number(line.quantity??line.qty)||0),0);
 // Gli ordini inseriti/modificati manualmente possono avere solo il campo testuale "items".
 if(!Number.isFinite(quantity)||quantity<=0){
  const raw=String(order.items||'');const re=/(?:^|[,;\\n])\\s*([0-9]+(?:[.,][0-9]+)?)\\s*[×x*]\\s*([^,;\\n]+)/gi;let match;quantity=0;
  while((match=re.exec(raw))!==null){const product=String(match[2]||'').replace(/\\s*\\[[^\\]]*\\]\\s*$/,'').trim();if(product)quantity+=Math.max(0,Number(String(match[1]).replace(',','.'))||0)}
 }
 if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Non riesco a leggere la quantità delle basi in questo ordine. Controlla i prodotti e le quantità prima di registrare i punti.');
 let customerId=order.customer_id||null;
 let profile=null;
 if(customerId){const result=await onlineClient.from('profiles').select('id,customer_type,fidelity_points').eq('id',customerId).maybeSingle();if(result.error)throw result.error;profile=result.data}
 if(!profile&&order.customer_code){const result=await onlineClient.from('profiles').select('id,customer_type,fidelity_points').eq('customer_code',order.customer_code).maybeSingle();if(result.error)throw result.error;profile=result.data;customerId=profile?.id||null}
 if(!profile&&order.customer_email){const result=await onlineClient.from('profiles').select('id,customer_type,fidelity_points').eq('email',order.customer_email).maybeSingle();if(result.error)throw result.error;profile=result.data;customerId=profile?.id||null}
 if(!profile)throw new Error('Cliente non trovato: impossibile associare i punti alla tessera fidelity. Verifica codice cliente ed email dell’ordine.');
 if(String(profile.customer_type||'privato').trim().toLowerCase()==='azienda')return;
 const movementId='fidelity-order-'+String(order.id);
 const existing=db.fidelity.find(m=>String(m.order_id||'')===String(order.id)||String(m.id||'')===movementId);
 if(existing)return;
 const points=Math.round(quantity);
 const current=Math.max(0,Number(profile.fidelity_points)||0);
 window.__menjaStage='accredito fidelity: registrazione movimento';
 const movement={id:crypto.randomUUID(),order_id:String(order.id),customer_id:String(customerId),customer:orderCustomerName(order),code:order.customer_code||'',date:new Date().toISOString(),points,note:'Accredito automatico: '+points+' '+(points===1?'punto':'punti')+' per '+quantity+' basi dell’ordine '+(order.code||order.id),type:'accredito_ordine'};
 const {data:profileUpdated,error:profileError}=await onlineClient.from('profiles').update({fidelity_points:current+points}).eq('id',customerId).select('id').maybeSingle();
 if(profileError)throw profileError;if(!profileUpdated)throw new Error('Saldo punti non aggiornato: profilo cliente non modificato.');
 try{await persistRecord('fidelity',movement)}catch(error){
  await onlineClient.from('profiles').update({fidelity_points:current}).eq('id',customerId);
  throw error;
 }
 db.fidelity.unshift(movement);
 const customer=db.customers.find(c=>String(c.id)===String(customerId));if(customer){customer.points=current+points;customer.fidelity_points=current+points}
 console.info('Punti fidelity accreditati:',{order_id:order.id,customer_id:customerId,points});
 }finally{delete window.__menjaFidelityAwardLocks[lockKey]}
}

async function setOrderStatus(id,status){
 try{
  if(activeProfile?.role!=='admin')throw new Error('Solo il titolare può modificare lo stato degli ordini.');
  if(!['Confermato','Rifiutato','Annullato','Pronto per il ritiro','Consegnato','Pagato'].includes(status))throw new Error('Stato ordine non valido.');
  const item=db.orders.find(x=>String(x.id)===String(id));
  if(!item)throw new Error('Ordine non trovato. Aggiorna la pagina e riprova.');
  if(status==='Confermato'&&item.status==='Da approvare')throw new Error('Per approvare questo ordine devi prima aprirlo, controllare le disponibilità e assegnare i lotti a tutte le basi.');
  if(status==='Pagato'&&item.status!=='Consegnato'&&!item.delivered_at)throw new Error('Per registrare il pagamento, segna prima l’ordine come Consegnato.');
  if(status==='Pagato'&&!confirm('Confermi di aver ricevuto il pagamento dell’ordine '+(item.code||'')+' di '+orderCustomerName(item)+' per € '+Number(item.total||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+'?\n\nSolo dopo la conferma l’ordine verrà tolto da Ordini e inserito in Finanza.'))return;
  const updatedPayload={...item,status,...(status==='Consegnato'?{delivered_at:item.delivered_at||new Date().toISOString()}:{}),...(status==='Pagato'?{paid_at:new Date().toISOString()}: {})};
  const {data,error}=await onlineClient.from('records').update({payload:updatedPayload}).eq('id',id).eq('kind','orders').select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Ordine non aggiornato: il database non ha confermato la modifica. Verifica i permessi e riprova.');
  await menjaWriteAudit('stato modificato','orders',id,item,updatedPayload);
  if(['Confermato','Rifiutato'].includes(status)&&item.status!==status){
   let customerId=item.customer_id||null;
   if(!customerId&&item.customer_code){const{data:profile}=await onlineClient.from('profiles').select('id').eq('customer_code',item.customer_code).maybeSingle();customerId=profile?.id||null}
   if(!customerId&&item.customer_email){const{data:profile}=await onlineClient.from('profiles').select('id').eq('email',item.customer_email).maybeSingle();customerId=profile?.id||null}
   if(customerId){const accepted=status==='Confermato';const title=accepted?'Ordine accettato':'Ordine rifiutato';const body=accepted?'Il tuo ordine '+(item.code||'')+' è stato confermato dal titolare.':'Il tuo ordine '+(item.code||'')+' non è stato accettato dal titolare.';const{error:notificationError}=await onlineClient.from('notifications').insert({user_id:customerId,order_id:String(item.id),order_code:String(item.code||''),notification_type:accepted?'order_accepted':'order_rejected',title,body});if(notificationError)console.error('Stato ordine aggiornato ma notifica cliente non salvata:',notificationError);else{const{data:pushResult,error:pushError}=await onlineClient.functions.invoke('send-order-push',{body:{user_id:customerId,title,body}});if(pushError)console.warn('Notifica push non inviata; notifica interna comunque salvata:',pushError);else console.info('Risultato notifica push:',pushResult)}}
  }
  item.status=status;if(status==='Consegnato')item.delivered_at=updatedPayload.delivered_at;if(status==='Pagato'){item.paid_at=updatedPayload.paid_at;await menjaAwardFidelityForPaidOrder(item);}
  syncPendingOrderBadge();
  if(status==='Pagato'&&page==='Ordini')selectedAdminOrderId=null;
  render();
 }catch(e){showError(e)}
}
function importBackup(){if(activeProfile?.role!=='admin'){alert('Importazione consentita solo all’amministratore.');return}let input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{try{let parsed=JSON.parse(await input.files[0].text()),data=parsed.data||parsed;if(parsed.app==='pizzalab'&&Array.isArray(data.customers)){let customers=new Map(data.customers.map(c=>[c.id,c]));for(const c of data.customers){const code=String(c.code||'');await persistRecord('customers',{id:c.id,source_id:c.id,name:c.name,phone:c.phone||'',email:c.email||'',address:c.address||'',notes:c.notes||'',created_at:c.created_at,code,fidelity_code:code,points:0,fidelity_points:0,category:'Altre attività',status:'Attivo'})}for(const p of data.products||[])await persistRecord('products',{id:p.id,source_id:p.id,name:p.name,description:p.description||'',price:p.price,unit:p.unit||'',active:p.active!==false,category:'Importato'});const itemsByOrder=new Map;for(const it of data.order_items||[]){if(!itemsByOrder.has(it.order_id))itemsByOrder.set(it.order_id,[]);itemsByOrder.get(it.order_id).push(it)}for(const o of data.orders||[]){const c=customers.get(o.customer_id),lines=itemsByOrder.get(o.id)||[],total=lines.reduce((sum,it)=>sum+(Number(it.quantity)||0)*(Number(it.unit_price)||0),0);await persistRecord('orders',{id:o.id,source_id:o.id,code:'ST-'+o.id.slice(0,6).toUpperCase(),customer:c?.name||'Cliente non trovato',customer_code:c?.code||'',pickup:o.delivery_date||'',total:total.toFixed(2),status:o.status==='consegnato'?'Ritirato':'Da approvare',notes:o.notes||'',items:lines.map(it=>it.product_name+' × '+it.quantity).join(', '),lines:lines.map(it=>({product:it.product_name,quantity:it.quantity,unit_price:it.unit_price,lot:it.lot||''}))})}await loadOnlineData();render();alert('Backup PizzaLab importato: '+data.customers.length+' clienti con tessera fidelity collegata al codice, '+(data.products||[]).length+' prodotti e '+(data.orders||[]).length+' ordini. Saldo punti iniziale: 0 perché il backup non contiene movimenti fidelity.')}else{for(const b of buckets)for(const item of (data[b]||[])){item.id=item.id||crypto.randomUUID();await persistRecord(onlineKinds[b],item)}await loadOnlineData();render();alert('Backup importato.')}}catch(e){showError(e)}};input.click()}const menjaBaseNavigate=navigate;function navigate(target){closeMobileMore();if(activeProfile?.role==='customer'&&customerIsCompany()&&target==='Punti fidelity')target='Resoconto aziendale';if(activeProfile?.role==='customer'&&!['Home','Nuovo ordine','Storico ordini','Punti fidelity','Resoconto aziendale','Il mio listino','I miei listini','Chat col titolare','Impostazioni'].includes(target))target='Nuovo ordine';page=target;render()}function goCustomerPage(target){navigate(target)}const menjaBaseNavHTML=baseNavHTML;function navHTML(){menjaBaseNavHTML();if(activeProfile?.role==='customer'){const items=customerIsCompany()?[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Resoconto aziendale','€'],['I miei listini','€'],['Chat col titolare','✉']]:[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Punti fidelity','✧'],['I miei listini','€'],['Chat col titolare','✉']];document.getElementById('bottom').innerHTML=items.map(([name,icon])=>'<button class="'+(page===name?'active':'')+'" onclick="goCustomerPage(this.dataset.page)" data-page="'+name+'"><span>'+icon+'</span>'+name+'</button>').join('')}}

/* Mobile UI layer v49: trasforma le tabelle in schede senza cambiare i dati o le azioni */
function menjaMobileEnhanceV49(){
 if(!document.documentElement.classList.contains('touch-mobile'))return;
 const root=document.getElementById('view');if(!root)return;
 root.querySelectorAll('.tablewrap').forEach(wrap=>{
  if(wrap.dataset.mobileCards==='1')return;
  const table=wrap.querySelector('table');if(!table)return;
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  const rows=[...table.querySelectorAll('tbody tr')];
  if(!rows.length){wrap.dataset.mobileCards='1';return}
  const list=document.createElement('div');list.className='mobile-record-list';
  rows.forEach(row=>{
   const cells=[...row.children].filter(cell=>cell.tagName==='TD');if(!cells.length)return;
   const card=document.createElement('article');card.className='mobile-record-card';
   cells.forEach((cell,index)=>{
    const field=document.createElement('div');
    const hasActions=!!cell.querySelector('button,a,[role="button"]');
    field.className='mobile-record-field'+(hasActions?' mobile-record-actions':'');
    if(!hasActions){
     const label=document.createElement('span');label.className='mobile-record-label';label.textContent=headers[index]||('Dettaglio '+(index+1));
     field.appendChild(label);
    }
    const value=document.createElement('div');value.className='mobile-record-value';value.innerHTML=cell.innerHTML;
    field.appendChild(value);card.appendChild(field);
   });
   list.appendChild(card);
  });
  wrap.replaceWith(list);
 });
 root.querySelectorAll('form.formgrid').forEach(form=>form.classList.add('mobile-form'));
 /* Su smartphone, ogni nuovo ordine deve aprirsi con tutte le quantità azzerate. */
 if(activeProfile?.role==='customer'&&page==='Nuovo ordine'){
  root.querySelectorAll('input[name^="customer_quantity_"]').forEach(input=>{input.value='0';input.defaultValue='0';input.setAttribute('value','0');input.setAttribute('autocomplete','off')});
 }
 root.dataset.mobilePage=String(page||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
const menjaOriginalRenderV49=render;
render=function menjaRenderWithMobileEnhanceV50(){menjaOriginalRenderV49();menjaMobileEnhanceV49()};
const menjaOriginalNavV49=navHTML;
navHTML=function menjaNavWithMobileEnhanceV50(){
 menjaOriginalNavV49();
 if(!document.documentElement.classList.contains('touch-mobile')||activeProfile?.role!=='customer')return;
 const bottom=document.getElementById('bottom');if(!bottom)return;
 const items=customerIsCompany()?[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Resoconto aziendale','€']]:[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Punti fidelity','✧']];
 bottom.innerHTML=items.map(([name,icon])=>'<button class="'+(page===name?'active':'')+'" onclick="goCustomerPage(this.dataset.page)" data-page="'+name+'"><span>'+icon+'</span><b>'+(name==='Nuovo ordine'?'Ordina':name==='Storico ordini'?'Ordini':name==='Punti fidelity'?'Punti':name)+'</b></button>').join('')+'<button class="mobile-more-button" onclick="openMobileMore()"><span>☰</span><b>Altro</b></button>';
}

/* Ricerca clienti: supporto diretto sia tabella desktop sia schede mobile */
window.filterRows=function(input){
 const clean=value=>String(value??'').toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 const query=clean(input&&input.value);
 const view=document.getElementById('view');
 const list=view?.querySelector('.mobile-record-list');
 if(list){
  const cards=Array.from(list.querySelectorAll('.mobile-record-card'));
  let visible=0;
  cards.forEach(card=>{
   const match=!query||clean(card.textContent).includes(query);
   card.hidden=!match;
   card.style.display=match?'':'none';
   if(match)visible++;
  });
  let empty=view.querySelector('#mobileCustomerSearchEmpty');
  if(!empty){
   empty=document.createElement('div');
   empty.id='mobileCustomerSearchEmpty';
   empty.className='empty';
   empty.textContent='Nessun cliente corrisponde alla ricerca.';
   list.insertAdjacentElement('afterend',empty);
  }
  empty.hidden=visible!==0;
  empty.style.display=visible?'none':'';
  return;
 }
 const rows=view?.querySelectorAll('.table tbody tr')||document.querySelectorAll('.table tbody tr');
 rows.forEach(row=>{
  const match=!query||clean(row.textContent).includes(query);
  row.hidden=!match;
  row.style.display=match?'':'none';
 });
};

const menjaNavBeforeExpiryAlerts=navHTML;
navHTML=function menjaNavWithLotExpiryAlerts(){
 menjaNavBeforeExpiryAlerts();
 if(activeProfile?.role!=='admin')return;
 const count=menjaLotExpiryAlerts().length,nav=document.getElementById('nav');if(!nav)return;
 const button=[...nav.querySelectorAll('button')].find(el=>el.textContent.trim().startsWith('Magazzino'));
 if(!button)return;
 button.querySelector('.lot-expiry-nav-dot')?.remove();
 if(count){const dot=document.createElement('span');dot.className='lot-expiry-nav-dot';dot.title=count+' lotti invenduti in scadenza';dot.textContent=String(count);dot.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 5px;margin-left:auto;border-radius:50px;background:#dc2626;color:#fff;font-size:11px;font-weight:800';button.appendChild(dot)}
};
onlineClient?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){activeUser=null;activeProfile=null;authScreen()}});
startOnline();


let companyProfileEditing=false;
function toggleCompanyIdentity(){
 const fields=document.getElementById('companyIdentityFields'),button=document.getElementById('companyIdentityToggle'),arrow=document.getElementById('companyIdentityArrow');
 if(!fields||!button)return;
 const opening=fields.hidden;fields.hidden=!opening;
 button.setAttribute('aria-expanded',String(opening));
 if(arrow)arrow.textContent=opening?'－':'＋';
}
function editCompanyProfile(){
 companyProfileEditing=true;
 const form=document.getElementById('companyProfileForm');if(!form)return;
 form.querySelectorAll('input').forEach(input=>input.disabled=false);
 const actions=document.getElementById('companyProfileActions');
 if(actions)actions.innerHTML='<span class="muted" style="margin-right:auto">Conferma solo quando hai verificato tutti i dati.</span><button class="btn" type="button" onclick="cancelCompanyProfileEdit()">Annulla</button><button class="btn gold" type="submit">Conferma modifiche</button>';
}
function cancelCompanyProfileEdit(){companyProfileEditing=false;render();}
function companyProfileSettingsPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const d=db.companyProfile?.[0]||{},saved=!!d.business_name;
 companyProfileEditing=false;
 const field=(name,label,type='text',wide=false)=>'<label class="'+(wide?'wide':'')+'">'+label+'<input class="field" name="'+name+'" type="'+type+'" value="'+esc(d[name]||'')+'" '+(saved?'disabled':'')+'></label>';
 const hidden=saved?' hidden':'';
 return head('Anagrafica aziendale','Dati essenziali della tua azienda')+
 '<form class="box formgrid" id="companyProfileForm" onsubmit="saveCompanyProfile(event)">'+
 (saved?'<div class="wide"><button class="btn" type="button" id="companyIdentityToggle" aria-expanded="false" onclick="toggleCompanyIdentity()">DATI IDENTIFICATIVI <span id="companyIdentityArrow">＋</span></button></div>':'')+
 '<div class="wide formgrid" id="companyIdentityFields"'+hidden+'>'+
 field('business_name','Ragione sociale','text',true)+
 field('vat_number','Partita IVA')+field('tax_code','Codice fiscale')+
 field('recipient_code','Codice destinatario SDI/UNIVOCO')+
 field('legal_representative','Titolare / Legale rappresentante')+
 '<div class="wide"><h2>Sede legale</h2></div>'+
 field('registered_address','Via e numero civico','text',true)+
 field('registered_postcode','CAP')+field('registered_city','Comune')+field('registered_province','Provincia')+
 '<div class="wide"><h2>Contatti e fatturazione</h2></div>'+
 field('phone','Telefono','tel')+field('email','Email','email')+field('pec','PEC','email')+
 '</div>'+
 (saved?'<div class="wide actions" id="companyProfileActions" style="justify-content:flex-end"><span class="muted" style="margin-right:auto">Ultimo aggiornamento: '+esc(d.updated_at?new Date(d.updated_at).toLocaleString('it-IT'):'—')+'</span><button class="btn gold" type="button" onclick="editCompanyProfile()">Modifica</button></div>':'<div class="wide actions" id="companyProfileActions" style="justify-content:flex-end"><button class="btn gold" type="submit">Salva anagrafica</button></div>')+
 '</form>'+
 '<div class="notice">'+(saved?'I dati sono protetti. Per modificarli apri DATI IDENTIFICATIVI e seleziona MODIFICA.':'Inserisci i dati riportati nei documenti ufficiali dell’azienda.')+'</div>';
}
async function saveCompanyProfile(event){
 event.preventDefault();
 if(activeProfile?.role!=='admin'||!activeUser)throw new Error('Solo il titolare può modificare l’anagrafica aziendale.');
 const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
 if(db.companyProfile?.[0]?.business_name&&!companyProfileEditing){alert('Seleziona MODIFICA prima di cambiare i dati.');return}
 const data={...(db.companyProfile?.[0]||{}),...Object.fromEntries(new FormData(form))};
 data.id=activeUser.id;data.updated_at=new Date().toISOString();data.updated_by=activeUser.id;
 if(!String(data.business_name||'').trim()){alert('Inserisci la ragione sociale o il nome dell’attività.');return}
 button.disabled=true;button.textContent='Salvataggio…';
 try{
  await persistRecord('settings',data);db.companyProfile=[data];companyProfileEditing=false;render();
  alert('Anagrafica aziendale salvata e confermata.');
 }catch(error){showError(error);button.disabled=false;button.textContent=companyProfileEditing?'Conferma modifiche':'Salva anagrafica'}
}



/* SICUREZZA GESTIONALE: backup locali, registro modifiche e controlli di integrita */
onlineKinds.auditLogs='audit_log';
if(!buckets.includes('auditLogs'))buckets.push('auditLogs');
if(!Array.isArray(db.auditLogs))db.auditLogs=[];
const menjaAuditFields=['code','status','customer','customer_id','customer_code','pickup','items','lines','total','lot_ids','lot_id','lot_code','lot_allocations','qty','product','production_date','date','expiry','ingredient_lots','ingredients','operator','notes'];
function menjaAuditSnapshot(value){
 const out={};if(!value||typeof value!=='object')return out;
 for(const key of menjaAuditFields){if(Object.prototype.hasOwnProperty.call(value,key))out[key]=value[key]}
 return out;
}
async function menjaWriteAudit(action,kind,id,before,after){
 if(!onlineClient||!activeUser||kind==='audit_log')return;
 const oldValue=menjaAuditSnapshot(before),newValue=menjaAuditSnapshot(after),changes={};
 const keys=new Set([...Object.keys(oldValue),...Object.keys(newValue)]);
 for(const key of keys){const oldText=JSON.stringify(oldValue[key]),newText=JSON.stringify(newValue[key]);if(oldText!==newText)changes[key]={prima:oldValue[key]??null,dopo:newValue[key]??null}}
 const entry={id:crypto.randomUUID(),action,record_type:kind,record_id:String(id||''),record_label:String(after?.code||before?.code||after?.name||before?.name||after?.product||before?.product||id||kind),actor_id:activeUser.id,actor_name:activeProfile?.full_name||activeProfile?.email||'Amministratore',occurred_at:new Date().toISOString(),changes};
 const {error}=await onlineClient.from('records').upsert({id:entry.id,kind:'audit_log',owner_id:activeUser.id,payload:entry});
 if(error)console.error('Registro modifiche non aggiornato:',error);
}
const menjaPersistRecordOriginal=persistRecord;
persistRecord=async function(kind,obj){
 const id=String(obj?.id||crypto.randomUUID());obj.id=id;
 let before=null;
 if(onlineClient&&activeUser&&kind!=='audit_log'){
  try{const result=await onlineClient.from('records').select('payload').eq('id',id).eq('kind',kind).maybeSingle();if(!result.error&&result.data)before=result.data.payload||null}catch(e){console.warn('Lettura precedente per registro modifiche:',e)}
 }
 await menjaPersistRecordOriginal(kind,obj);
 if(kind!=='audit_log')await menjaWriteAudit(before?'modificato':'creato',kind,id,before,obj);
};
function menjaBackupOpenDb(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('menjaimut-secure-backups-v1',1);
  request.onupgradeneeded=()=>{const dbx=request.result;if(!dbx.objectStoreNames.contains('snapshots'))dbx.createObjectStore('snapshots',{keyPath:'id'})};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Archivio backup non disponibile'));
 });
}
async function menjaBackupPut(snapshot){
 const dbx=await menjaBackupOpenDb();
 await new Promise((resolve,reject)=>{const tx=dbx.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(snapshot);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Salvataggio backup interrotto'))});
 dbx.close();
}
async function menjaBackupGetAll(){
 const dbx=await menjaBackupOpenDb();
 const rows=await new Promise((resolve,reject)=>{const tx=dbx.transaction('snapshots','readonly'),request=tx.objectStore('snapshots').getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});
 dbx.close();return rows.sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)));
}
async function menjaBackupDelete(id){
 const dbx=await menjaBackupOpenDb();
 await new Promise((resolve,reject)=>{const tx=dbx.transaction('snapshots','readwrite');tx.objectStore('snapshots').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 dbx.close();
}
async function menjaSelectAllRows(table,columns='*'){
 const rows=[];let start=0;
 while(true){
  const {data,error}=await onlineClient.from(table).select(columns).order('id',{ascending:true}).range(start,start+499);
  if(error)throw error;
  const batch=data||[];rows.push(...batch);
  if(batch.length<500)break;
  start+=500;
 }
 return rows;
}
async function menjaBlobToBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(reader.error||new Error('Lettura allegato non riuscita'));reader.readAsDataURL(blob)})}
async function menjaBase64ToBlob(value,type){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type:type||'application/octet-stream'})}
async function menjaCaptureBackup(){
 if(activeProfile?.role!=='admin'||!onlineClient)throw new Error('Backup disponibile solo per l’amministratore connesso.');
 const warnings=[],tables={};
 tables.records=await menjaSelectAllRows('records','id,kind,owner_id,payload,created_at,updated_at');
 tables.profiles=await menjaSelectAllRows('profiles','*');
 tables.chat_messages=await menjaSelectAllRows('chat_messages','*');
 tables.notifications=await menjaSelectAllRows('notifications','*');
 try{tables.fcm_tokens=await menjaSelectAllRows('fcm_tokens','*')}catch(error){tables.fcm_tokens=[];warnings.push('Token notifiche non esportati: '+(error?.message||'permessi non disponibili'))}
 const attachments=[],seen=new Set();
 for(const message of tables.chat_messages){const path=message.attachment_path;if(!path||seen.has(path))continue;seen.add(path);const {data,error}=await onlineClient.storage.from('chat-attachments').download(path);if(error){warnings.push('Allegato non esportato ('+path+'): '+error.message);continue}attachments.push({path,name:message.attachment_name||path.split('/').pop(),type:message.attachment_type||data.type||'application/octet-stream',size:message.attachment_size||data.size,base64:await menjaBlobToBase64(data)})}
 const counts={};for(const [name,rows] of Object.entries(tables))counts[name]=rows.length;counts.storage_attachments=attachments.length;
 return {format:'menja-i-mut-full-backup-v3',app:'Menja i Mut Gestionale',created_at:new Date().toISOString(),created_by:activeUser.id,tables,storage:{bucket:'chat-attachments',files:attachments},auth:{note:'Gli account Auth e le password non sono esportabili dal client. Gli ID/email dei profili sono inclusi nella tabella profiles; gli account esistenti restano in Supabase.'},counts,warnings};
}
function menjaDownloadBackup(snapshot){
 const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='menja-i-mut-backup-'+new Date(snapshot.created_at||Date.now()).toISOString().slice(0,10)+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function menjaManualBackup(){
 try{
  const snapshot=await menjaCaptureBackup();snapshot.id='manual-'+Date.now();snapshot.backup_type='manual';
  await menjaBackupPut(snapshot);menjaDownloadBackup(snapshot);await menjaRefreshBackupList();
  alert('Backup completo creato e scaricato.\n\nRecord: '+snapshot.counts.records+'\nProfili: '+snapshot.counts.profiles+'\nMessaggi: '+snapshot.counts.chat_messages+'\nNotifiche: '+snapshot.counts.notifications+'\nAllegati: '+snapshot.counts.storage_attachments+'\n\n'+(snapshot.warnings.length?'ATTENZIONE:\n'+snapshot.warnings.join('\n')+'\n\n':'')+'Conserva il file anche su un dispositivo o cloud esterno.');
 }catch(error){showError(error)}
}
async function menjaRunDailyBackup(){
 if(activeProfile?.role!=='admin'||!onlineClient)return;
 const day=new Date().toISOString().slice(0,10);
 if(window.__menjaDailyBackupDate===day)return;
 window.__menjaDailyBackupDate=day;
 try{
  const id='auto-'+day,existing=(await menjaBackupGetAll()).some(x=>x.id===id);
  if(existing)return;
  const snapshot=await menjaCaptureBackup();snapshot.id=id;snapshot.backup_type='automatico';
  await menjaBackupPut(snapshot);
  const all=await menjaBackupGetAll(),automatic=all.filter(x=>x.backup_type==='automatico');
  for(const old of automatic.slice(7))await menjaBackupDelete(old.id);
  console.info('Backup automatico locale completato:',day);
 }catch(error){window.__menjaDailyBackupDate=null;console.warn('Backup automatico locale non riuscito:',error)}
}
async function menjaRefreshBackupList(){
 const host=document.getElementById('menjaBackupList');if(!host)return;
 try{
  const rows=await menjaBackupGetAll();
  host.innerHTML=rows.length?rows.map(item=>'<div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)"><span><strong>'+esc(item.backup_type==='automatico'?'Automatico':'Manuale')+'</strong><small class="muted" style="display:block">'+esc(new Date(item.created_at).toLocaleString('it-IT'))+' · '+(item.counts?.records||item.records?.length||0)+' registrazioni</small></span><button class="smallbtn" onclick="menjaRestoreLocalBackup(\''+esc(item.id)+'\')">Ripristina</button></div>').join(''):'<div class="empty">Nessun backup locale ancora disponibile.</div>';
 }catch(error){host.textContent='Archivio locale non disponibile in questo browser.';console.warn(error)}
}
async function menjaRestoreBackupObject(snapshot){
 if(activeProfile?.role!=='admin')throw new Error('Ripristino consentito solo al titolare.');
 if(snapshot?.format==='menja-i-mut-full-backup-v3'){
  const tables=snapshot.tables||{},required=['records','profiles','chat_messages','notifications'];
  for(const key of required)if(!Array.isArray(tables[key]))throw new Error('Backup incompleto: manca la tabella '+key+'.');
  if(!confirm('Ripristinare il backup del '+new Date(snapshot.created_at||Date.now()).toLocaleString('it-IT')+'?\\n\\nVerranno ripristinati anche messaggi, notifiche e allegati. I dati non presenti nel backup non saranno cancellati.'))return;
  for(let start=0;start<tables.records.length;start+=100){const {error}=await onlineClient.from('records').upsert(tables.records.slice(start,start+100),{onConflict:'id'});if(error)throw error}
  const profileFields=['full_name','category','role','approval_status','customer_code','fidelity_points','price_list_id','price_list_ids','customer_type','vat_number','street_address','recipient_code_or_pec','phone','deleted_at'];let profileRestored=0;
  for(const profile of tables.profiles){if(!profile?.id)continue;const patch={};for(const key of profileFields)if(Object.prototype.hasOwnProperty.call(profile,key))patch[key]=profile[key];const {error}=await onlineClient.from('profiles').update(patch).eq('id',profile.id);if(error)throw new Error('Ripristino profilo '+profile.id+' non riuscito: '+error.message);profileRestored++}
  const files=snapshot.storage?.files||[];let attachmentsRestored=0;
  for(const file of files){if(!file.path||!file.base64)continue;const blob=await menjaBase64ToBlob(file.base64,file.type);const {error}=await onlineClient.storage.from(snapshot.storage?.bucket||'chat-attachments').upload(file.path,blob,{contentType:file.type||'application/octet-stream',upsert:true});if(error)throw new Error('Ripristino allegato '+file.name+' non riuscito: '+error.message);attachmentsRestored++}
  for(let start=0;start<tables.chat_messages.length;start+=100){const {error}=await onlineClient.rpc('restore_chat_messages',{p_rows:tables.chat_messages.slice(start,start+100)});if(error)throw new Error('Ripristino chat non riuscito: '+error.message)}
  const notificationRows=tables.notifications||[];for(let start=0;start<notificationRows.length;start+=100){const {error}=await onlineClient.rpc('restore_notifications',{p_rows:notificationRows.slice(start,start+100)});if(error)throw new Error('Ripristino notifiche non riuscito: '+error.message)}
  await menjaWriteAudit('ripristino_backup','backup',snapshot.created_at,null,{code:'Ripristino backup v3',notes:(tables.records.length||0)+' record'});
  await loadOnlineData();render();
  alert('Ripristino v3 completato. Record: '+tables.records.length+'. Profili aggiornati: '+profileRestored+'. Messaggi: '+tables.chat_messages.length+'. Notifiche: '+tables.notifications.length+'. Allegati: '+attachmentsRestored+'. Gli account Auth e le password non vengono ricreati: i profili sono aggiornati solo per account già esistenti. I token push si rigenerano dai dispositivi. Controlla gli eventuali avvisi del backup.');
  return;
 }
 if(snapshot?.format==='menja-i-mut-backup-v1'){
  const legacy=snapshot.data||{},records=[],profiles=[];
  for(const bucket of Object.keys(onlineKinds)){
   if(bucket==='auditLogs')continue;
   for(const item of (legacy[bucket]||[])){
    if(bucket==='customers'&&item.isProfile){profiles.push({id:item.id,full_name:item.name,email:item.email,category:item.category,customer_type:item.customer_type,vat_number:item.vat_number,street_address:item.street_address,recipient_code_or_pec:item.recipient_code_or_pec,phone:item.phone,customer_code:item.code,fidelity_points:item.points,price_list_id:item.price_list_id,price_list_ids:item.price_list_ids,deleted_at:item.deleted_at});continue}
    const id=String(item.id||crypto.randomUUID()),payload={...item};delete payload.owner_id;delete payload.isProfile;
    records.push({id,kind:onlineKinds[bucket],owner_id:activeUser.id,payload,created_at:item.created_at||new Date().toISOString()});
   }
  }
  snapshot={format:'menja-i-mut-full-backup-v2',created_at:snapshot.exportedAt||new Date().toISOString(),id:'legacy-import',records,profiles,chat_messages:[],warnings:['Backup storico convertito: chat non inclusa.']};
 }
 if(snapshot?.format!=='menja-i-mut-full-backup-v2'||!Array.isArray(snapshot.records))throw new Error('File non riconosciuto: serve un backup Menja i Mut (v1 o v2).');
 const records=snapshot.records,profiles=Array.isArray(snapshot.profiles)?snapshot.profiles:[],chats=Array.isArray(snapshot.chat_messages)?snapshot.chat_messages:[];
 if(!confirm('Ripristinare il backup del '+new Date(snapshot.created_at||Date.now()).toLocaleString('it-IT')+'?\n\nI dati saranno uniti a quelli attuali: non verranno cancellati record più recenti o non presenti nel backup.'))return;
 for(let start=0;start<records.length;start+=100){
  const {error}=await onlineClient.from('records').upsert(records.slice(start,start+100),{onConflict:'id'});
  if(error)throw error;
 }
 const allowed=['full_name','category','customer_type','vat_number','street_address','recipient_code_or_pec','phone','deleted_at','customer_code','fidelity_points','price_list_id','price_list_ids'];
 let profileRestored=0;
 for(const profile of profiles){
  if(!profile?.id)continue;
  const patch={};for(const key of allowed)if(Object.prototype.hasOwnProperty.call(profile,key))patch[key]=profile[key];
  if(Object.keys(patch).length){const {error}=await onlineClient.from('profiles').update(patch).eq('id',profile.id);if(error)console.warn('Profilo non ripristinato:',profile.id,error);else profileRestored++}
 }
 let chatsRestored=0;
 if(chats.length){
  for(let start=0;start<chats.length;start+=100){
   const {error}=await onlineClient.from('chat_messages').upsert(chats.slice(start,start+100),{onConflict:'id'});
   if(error){console.warn('Ripristino chat non completato:',error);break}
   chatsRestored+=Math.min(100,chats.length-start);
  }
 }
 await menjaWriteAudit('ripristino_backup','backup',snapshot.id||snapshot.created_at,null,{code:'Ripristino backup',notes:records.length+' record'});
 await loadOnlineData();render();
 alert('Ripristino completato in modalità unione. Record ripristinati: '+records.length+'. Profili aggiornati: '+profileRestored+'. Messaggi chat ripristinati: '+chatsRestored+'. Nessun dato attuale è stato cancellato.');
}
async function menjaRestoreLocalBackup(id){
 try{const snapshot=(await menjaBackupGetAll()).find(x=>x.id===id);if(!snapshot)throw new Error('Backup locale non trovato.');await menjaRestoreBackupObject(snapshot)}catch(error){showError(error)}
}
function exportData(){
 menjaCaptureBackup().then(snapshot=>{menjaDownloadBackup(snapshot);alert('Backup completo scaricato. Conserva una copia esterna al dispositivo.')}).catch(showError);
}
function importBackup(){
 if(activeProfile?.role!=='admin'){alert('Importazione consentita solo all’amministratore.');return}
 const input=document.createElement('input');input.type='file';input.accept='application/json,.json';
 input.onchange=async()=>{try{const file=input.files?.[0];if(!file)return;const snapshot=JSON.parse(await file.text());await menjaRestoreBackupObject(snapshot)}catch(error){showError(error)}};
 input.click();
}
function menjaIntegrityReport(){
 const issues=[],lotsById=new Map((db.lots||[]).map(l=>[String(l.id),l])),orders=db.orders||[],active=['Confermato','In produzione','Pronto per il ritiro','Ritirato','Consegnato','Completato','Pagato'];
 const seenCodes=new Map(),seenLotCodes=new Map();
 for(const order of orders){
  const code=String(order.code||'').trim();if(code){if(seenCodes.has(code))issues.push({level:'warning',where:'Ordine '+code,detail:'Codice ordine duplicato.'});else seenCodes.set(code,order.id)}
  if(!active.includes(String(order.status||'')))continue;
  const lines=Array.isArray(order.lines)?order.lines:[];
  if(!lines.length){if(String(order.items||'').trim())issues.push({level:'warning',where:'Ordine '+(code||order.id),detail:'Prodotti salvati come testo: controllo quantità e lotti incompleto.'});continue}
  for(const line of lines){
   const qty=Number(line.quantity??line.qty);
   if(!Number.isFinite(qty)||qty<=0){issues.push({level:'error',where:'Ordine '+(code||order.id),detail:'Riga prodotto con quantità nulla, negativa o non numerica.'});continue}
   const parts=Array.isArray(line.lot_allocations)?line.lot_allocations:[];
   if(parts.length){
    const allocated=parts.reduce((sum,p)=>sum+Math.max(0,Number(p.quantity)||0),0);
    if(Math.abs(allocated-qty)>0.001)issues.push({level:'error',where:'Ordine '+(code||order.id),detail:'Quantità assegnata ai lotti ('+allocated+') diversa dalla quantità ordinata ('+qty+').'});
    for(const part of parts){const lot=lotsById.get(String(part.lot_id||''));if(!lot)issues.push({level:'error',where:'Ordine '+(code||order.id),detail:'Riferimento a lotto inesistente ('+(part.lot_code||part.lot_id||'senza codice')+').'});else if(String(lot.product||'').trim().toLocaleLowerCase('it-IT')!==String(line.product||line.name||'').trim().toLocaleLowerCase('it-IT'))issues.push({level:'warning',where:'Ordine '+(code||order.id),detail:'Il prodotto della riga non corrisponde al prodotto del lotto '+(lot.code||lot.id)+'.'})}
   }else if(line.lot_id&&!lotsById.has(String(line.lot_id)))issues.push({level:'error',where:'Ordine '+(code||order.id),detail:'Lotto assegnato non trovato ('+line.lot_id+').'});
  }
 }
 for(const lot of db.lots||[]){
  const qty=Number(lot.qty);if(!Number.isFinite(qty)||qty<0)issues.push({level:'error',where:'Lotto '+(lot.code||lot.id),detail:'Quantità prodotta non valida.'});
  const code=String(lot.code||'').trim();if(code){if(seenLotCodes.has(code))issues.push({level:'warning',where:'Lotto '+code,detail:'Codice lotto duplicato.'});else seenLotCodes.set(code,lot.id)}
 }
 if(typeof menjaLotSoldAllocations==='function'){
  const allocations=menjaLotSoldAllocations();
  for(const lot of db.lots||[]){const used=allocations.get(String(lot.id))||0,qty=Math.max(0,Number(lot.qty)||0);if(used>qty+0.001)issues.push({level:'warning',where:'Lotto '+(lot.code||lot.id),detail:'Scarichi calcolati '+used+' superiori alla produzione '+qty+'. Giacenza negativa: verifica se è una vendita senza lotto disponibile o un doppio scarico.'})}
 }
 return {issues,errors:issues.filter(x=>x.level==='error').length,warnings:issues.filter(x=>x.level==='warning').length,checkedOrders:orders.filter(o=>active.includes(String(o.status||''))).length,checkedLots:(db.lots||[]).length};
}
function menjaSafetyPage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const report=menjaIntegrityReport(),audit=(db.auditLogs||[]).slice().sort((x,y)=>String(y.occurred_at||'').localeCompare(String(x.occurred_at||''))).slice(0,60);
 const issueRows=report.issues.map(x=>'<tr><td><span class="badge">'+(x.level==='error'?'ERRORE':'ATTENZIONE')+'</span></td><td>'+esc(x.where)+'</td><td>'+esc(x.detail)+'</td></tr>');
 const auditRows=audit.map(x=>[esc(new Date(x.occurred_at||Date.now()).toLocaleString('it-IT'))+'<br>'+esc(x.actor_name||'Utente'),esc(x.action||''),esc(x.record_type||'')+' · '+esc(x.record_label||x.record_id||''),esc(Object.keys(x.changes||{}).join(', ')||x.notes||'—')]);
 setTimeout(menjaRefreshBackupList,0);
 return head('Sicurezza e controlli','Backup, storico modifiche e verifica coerenza dei dati')+
 '<section class="box"><h2>Backup e ripristino</h2><p class="muted">Viene conservata automaticamente una copia giornaliera in questo browser (ultimi 7 backup automatici). Per proteggerti da guasti o perdita del dispositivo, scarica il backup e conservalo anche altrove.</p><div class="actions" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn gold" onclick="menjaManualBackup()">Crea backup e scarica</button><button class="btn" onclick="importBackup()">Ripristina da file</button><button class="btn" onclick="menjaRefreshBackupList()">Aggiorna elenco</button></div><div id="menjaBackupList" style="margin-top:12px"><div class="muted">Caricamento backup locali…</div></div><div class="notice" style="margin-top:12px">Il backup automatico è locale al browser e non sostituisce una copia esterna. Il ripristino unisce i dati e non cancella quelli già presenti.</div></section>'+
 '<section class="box"><div class="head"><div><h2>Controllo integrità</h2><div class="muted">Verifica ordini, quantità, codici lotto e assegnazioni</div></div><button class="btn" onclick="render()">Ricontrolla</button></div><div class="grid cards"><div class="card"><small>Ordini controllati</small><div class="metric">'+report.checkedOrders+'</div></div><div class="card"><small>Lotti controllati</small><div class="metric">'+report.checkedLots+'</div></div><div class="card"><small>Errori</small><div class="metric">'+report.errors+'</div></div><div class="card"><small>Avvisi</small><div class="metric">'+report.warnings+'</div></div></div>'+(issueRows.length?'<div class="tablewrap"><table class="table"><thead><tr><th>Livello</th><th>Elemento</th><th>Controllo</th></tr></thead><tbody>'+issueRows.join('')+'</tbody></table></div>':'<div class="notice">Nessuna anomalia rilevata nei dati attualmente verificabili.</div>')+'<p class="muted">Le giacenze negative sono segnalate, non bloccate. I vecchi ordini salvati solo come testo non permettono una verifica completa delle quantità. I controlli non possono ricostruire movimenti storici non registrati.</p></section>'+
 '<section class="box"><h2>Registro cronologico modifiche</h2><p class="muted">Nuove creazioni e modifiche ai record gestionali vengono annotate da ora in avanti. Non è possibile ricostruire retroattivamente modifiche precedenti all’attivazione del registro.</p>'+(auditRows.length?table(['Data e operatore','Operazione','Elemento','Campi modificati'],auditRows):'<div class="empty">Nessuna modifica registrata ancora.</div>')+'</section>';
}
const menjaModulePageBeforeSecurity=modulePage;
modulePage=function(){if(page==='Sicurezza')return menjaSafetyPage();return menjaModulePageBeforeSecurity()};
const menjaExportDataBeforeSecurity=exportData;
const menjaImportBackupBeforeSecurity=importBackup;
window.setInterval(()=>{if(activeProfile?.role==='admin'&&onlineClient&&window.__menjaDailyBackupDate!==new Date().toISOString().slice(0,10)&&Array.isArray(db.orders))menjaRunDailyBackup()},2000);


/* Promemoria settimanale backup manuale: avviso persistente nell'area contenuti per il titolare */
window.__menjaWeeklyBackupReminderDue=false;
window.__menjaWeeklyBackupReminderCheckedAt=0;
window.__menjaWeeklyBackupReminderBusy=false;
async function menjaCheckWeeklyBackupReminder(){
 if(activeProfile?.role!=='admin'||!onlineClient||window.__menjaWeeklyBackupReminderBusy||Date.now()-window.__menjaWeeklyBackupReminderCheckedAt<60000)return;
 window.__menjaWeeklyBackupReminderBusy=true;
 window.__menjaWeeklyBackupReminderCheckedAt=Date.now();
 try{
  const rows=await menjaBackupGetAll();
  const manual=rows.filter(x=>x.backup_type==='manual'&&x.created_at).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const latest=manual[0];
  const due=!latest||!Number.isFinite(new Date(latest.created_at).getTime())||(Date.now()-new Date(latest.created_at).getTime())>=7*24*60*60*1000;
  const changed=due!==window.__menjaWeeklyBackupReminderDue;
  window.__menjaWeeklyBackupReminderDue=due;
  if(changed)menjaRenderWeeklyBackupReminder();
 }catch(error){console.warn('Controllo promemoria backup manuale non riuscito:',error)}
 finally{window.__menjaWeeklyBackupReminderBusy=false}
}
function menjaRenderWeeklyBackupReminder(){
 const host=document.getElementById('view');if(!host)return;
 host.querySelector('#menjaWeeklyBackupReminder')?.remove();
 if(activeProfile?.role!=='admin'||!window.__menjaWeeklyBackupReminderDue)return;
 const banner=document.createElement('section');
 banner.id='menjaWeeklyBackupReminder';
 banner.setAttribute('role','alert');
 banner.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 16px;padding:14px 16px;border:1px solid #e3b341;border-left:5px solid #d69e18;border-radius:12px;background:#fff8df;color:#49370b';
 banner.innerHTML='<div><strong style="display:block;margin-bottom:3px">Promemoria backup settimanale</strong><span>È il momento di creare e conservare una nuova copia manuale dei dati.</span></div><button class="btn gold" type="button" onclick="menjaManualBackup()">Crea backup adesso</button>';
 host.insertBefore(banner,host.firstChild);
}
const menjaRenderBeforeWeeklyBackupReminder=render;
render=function menjaRenderWithWeeklyBackupReminder(){menjaRenderBeforeWeeklyBackupReminder();menjaRenderWeeklyBackupReminder()};
const menjaManualBackupBeforeWeeklyReminder=menjaManualBackup;
menjaManualBackup=async function(){await menjaManualBackupBeforeWeeklyReminder();window.__menjaWeeklyBackupReminderCheckedAt=0;await menjaCheckWeeklyBackupReminder();menjaRenderWeeklyBackupReminder()};
window.setInterval(menjaCheckWeeklyBackupReminder,5000);
