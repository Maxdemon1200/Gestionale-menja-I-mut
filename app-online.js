var onlineClient=null, activeUser=null, activeProfile=null;let ownerNoticeTimer=null;const onlineKinds={customers:'customers',orders:'orders',products:'products',priceLists:'pricelists',recipes:'recipes',production:'production',lots:'lots',inventory:'inventory',fidelity:'fidelity',invoices:'invoices',events:'finance'};
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
async function loadOnlineData(){window.__menjaStage='caricamento dati: tabella records';for(const b of buckets)db[b]=[];const {data:rows,error}=await onlineClient.from('records').select('id,kind,owner_id,payload,created_at');if(error)throw error;for(const r of rows||[]){let bucket=Object.keys(onlineKinds).find(k=>onlineKinds[k]===r.kind);if(bucket)db[bucket].push({...r.payload,id:r.id,owner_id:r.owner_id,created_at:r.created_at||r.payload?.created_at||null})}if(activeProfile.role==='admin'){window.__menjaStage='caricamento dati: elenco profili clienti';const {data:profiles,error:pe}=await onlineClient.from('profiles').select('id,email,full_name,category,role,approval_status,created_at,customer_code,fidelity_points,price_list_id,price_list_ids,customer_type,vat_number,street_address,recipient_code_or_pec,phone,deleted_at');if(pe)throw pe;db.customers=[...db.customers.filter(c=>!c.isProfile),...(profiles||[]).map(p=>({id:p.id,isProfile:true,name:p.full_name,category:p.category,email:p.email,customer_type:p.customer_type||'privato',vat_number:p.vat_number||'',street_address:p.street_address||'',recipient_code_or_pec:p.recipient_code_or_pec||'',phone:p.phone||'',code:p.customer_code,fidelity_code:p.customer_code,points:p.fidelity_points||0,price_list_id:p.price_list_id||'',price_list_ids:Array.isArray(p.price_list_ids)&&p.price_list_ids.length?p.price_list_ids:(p.price_list_id?[p.price_list_id]:[]),status:({pending:'In attesa di abilitazione',approved:'Attivo',suspended:'Sospeso',rejected:'Rifiutato'})[p.approval_status],approval_status:p.approval_status,phone:p.phone||'',deleted_at:p.deleted_at||null,created_at:p.created_at||null}))]}else{db.customers=[{id:activeProfile.id,isProfile:true,name:activeProfile.full_name,category:activeProfile.category,email:activeProfile.email,customer_type:activeProfile.customer_type||'privato',vat_number:activeProfile.vat_number||'',street_address:activeProfile.street_address||'',recipient_code_or_pec:activeProfile.recipient_code_or_pec||'',phone:activeProfile.phone||'',code:activeProfile.customer_code,fidelity_code:activeProfile.customer_code,points:activeProfile.fidelity_points||0,status:activeProfile.approval_status}]};db.fidelity=[...db.customers.map(c=>({customer:c.name,code:c.fidelity_code||c.code||'',date:'',points:c.points??c.fidelity_points??0,note:'Tessera fidelity assegnata'})),...db.fidelity]};

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
function showNewOrderNotice(newOrders){
 const el=document.getElementById('ownerOrderNotice');if(!el||!newOrders.length)return;
 const first=newOrders[0];
 const title=newOrders.length===1?'È ARRIVATO UN NUOVO ORDINE':'SONO ARRIVATI '+newOrders.length+' NUOVI ORDINI';
 const detail=newOrders.length===1?(first.customer||'Nuovo cliente')+' · '+(first.code||'Ordine'):'Controlla le nuove richieste dei clienti';
 el.innerHTML='<div><strong>🔴 '+title+'</strong><small>'+esc(detail)+' · Da approvare</small></div><div class="order-notice-actions"><button type="button" onclick="openNotifiedOrder(\''+first.id+'\')">VEDI ORDINE →</button>'+(('Notification' in window&&Notification.permission!=='granted'&&Notification.permission!=='denied')?'<button type="button" class="order-notice-enable" onclick="enableOrderBrowserNotifications()">Attiva notifiche desktop</button>':'')+'<button type="button" class="order-notice-close" aria-label="Chiudi notifica" onclick="dismissOwnerOrderNotice()">×</button></div>';
 el.hidden=false;
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
  const ids=new Set(fresh.map(o=>String(o.id)));
  const newlyArrived=ownerKnownOrderIds===null?[]:fresh.filter(o=>o.status==='Da approvare'&&!ownerKnownOrderIds.has(String(o.id)));
  ownerKnownOrderIds=ids;
  db.orders=fresh;
  syncPendingOrderBadge();
  if(newlyArrived.length)showNewOrderNotice(newlyArrived);
 }catch(e){console.error('Controllo nuovi ordini non riuscito:',e)}
}
function startOwnerNoticeMonitoring(){
 if(ownerNoticeTimer){clearInterval(ownerNoticeTimer);ownerNoticeTimer=null}
 ownerKnownOrderIds=null;
 if(activeProfile?.role==='admin'){
  refreshOwnerNotice();
  refreshOwnerOrders();
  ownerNoticeTimer=setInterval(()=>{refreshOwnerNotice();refreshOwnerOrders()},15000);
 }else{
  const el=document.getElementById('ownerNotice');if(el){el.hidden=true;el.innerHTML=''}
  const orderEl=document.getElementById('ownerOrderNotice');if(orderEl){orderEl.hidden=true;orderEl.innerHTML=''}
  window.__menjaPendingOrderCount=0;
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
 window.__menjaStage='lettura profilo utente';const {data:profile,error:pe}=await onlineClient.from('profiles').select('*').eq('id',activeUser.id).single();if(pe){showError(pe);return}activeProfile=profile;document.body.classList.toggle('admin-mode',profile.role==='admin');document.body.classList.toggle('customer-mode',profile.role!=='admin');document.querySelector('header .actions button[onclick="importBackup()"]').hidden=profile.role!=='admin';document.querySelector('header .actions button[onclick="exportData()"]').hidden=profile.role!=='admin';document.getElementById('signoutButton').hidden=false;document.getElementById('sessionInfo').textContent=`${profile.full_name||profile.email} · ${profile.role==='admin'?'Amministratore':profile.category+(profile.customer_code?' · Codice '+profile.customer_code+' · Fidelity '+profile.customer_code:'')}`;
 if(profile.approval_status!=='approved'){document.getElementById('view').innerHTML=`<div class="box"><h1>Account in attesa</h1><p>Registrazione completata per ${esc(profile.email)}. Il titolare deve approvare manualmente il tuo account prima di accedere a catalogo e ordini.</p><button class="btn" onclick="signOut()">Esci</button></div>`;return}
 try{window.__menjaStage='caricamento dati gestionali';await loadOnlineData();startOwnerNoticeMonitoring();const all=[['OPERATIVITÀ',['Dashboard','Ordini','Clienti']],['CATALOGO',['Prodotti','Listini']],['PRODUZIONE',['Produzione','Lotti produzione','Magazzino']],['CLIENTI',['Fidelity']],['AMMINISTRAZIONE',['Finanza','Fatture','Statistiche','Impostazioni']],['CLIENTI',['Chat clienti']]];const customer=[['IL TUO SPAZIO',['Home','Nuovo ordine','Storico ordini','I miei listini']],['FIDELITY E CONTATTI',['Punti fidelity','Chat col titolare']]];sections.splice(0,sections.length,...(profile.role==='admin'?all:customer));if(profile.role!=='admin')page='Home';window.__menjaStage='visualizzazione schermata gestionale';render();window.__menjaStage='gestionale caricato';}catch(err){showError(err)}
}
let selectedChatCustomer=null;
const menjaBaseModulePage=baseModulePage;function menjaChatPanel(customerId,title){return '<section class="box"><h2>'+esc(title)+'</h2><div id="chatMessages" style="display:grid;gap:10px;max-height:55vh;overflow:auto;margin-bottom:16px"><div class="empty">Caricamento messaggi…</div></div><form class="formgrid" data-customer="'+customerId+'" onsubmit="sendChatMessage(event,this.dataset.customer)"><label class="wide">Scrivi un messaggio<textarea class="field" name="body" rows="3" maxlength="2000" required placeholder="Scrivi qui…"></textarea></label><div class="wide actions"><button class="btn gold">Invia</button></div></form></section>'}
async function loadChatMessages(customerId){const box=document.getElementById('chatMessages');if(!box)return;const{data,error}=await onlineClient.from('chat_messages').select('id,sender_id,sender_role,body,created_at').eq('customer_id',customerId).order('created_at',{ascending:true});if(error){box.innerHTML='<div class="empty">Chat non disponibile: il titolare deve prima applicare l’aggiornamento SQL in Supabase.</div>';return}box.innerHTML=data?.length?data.map(m=>'<div style="justify-self:'+(m.sender_role==='admin'?'start':'end')+';max-width:85%;padding:10px 13px;border:1px solid var(--line);border-radius:10px;background:'+(m.sender_role==='admin'?'var(--panel2)':'#29251a')+'"><small class="muted">'+(m.sender_role==='admin'?'Titolare':'Tu')+' · '+new Date(m.created_at).toLocaleString('it-IT')+'</small><div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(m.body)+'</div></div>').join(''):'<div class="empty">Nessun messaggio. Puoi scrivere qui al titolare.</div>';box.scrollTop=box.scrollHeight}async function sendChatMessage(event,customerId){event.preventDefault();const form=event.currentTarget;const body=String(new FormData(form).get('body')||'').trim();if(!body)return;const{error}=await onlineClient.from('chat_messages').insert({customer_id:customerId,sender_id:activeUser.id,sender_role:activeProfile.role==='admin'?'admin':'customer',body});if(error){showError(error);return}form.reset();if(activeProfile.role==='admin')selectedChatCustomer=customerId;render()}function openAdminChat(id){selectedChatCustomer=id;page='Chat clienti';render()}
function formatCustomerPickupDate(value){if(!value)return '—';const datePart=String(value).split('T')[0];const parts=datePart.split('-');return parts.length===3?parts[2]+'/'+parts[1]+'/'+parts[0]:datePart}
function customerOrderCatalog(){const ids=Array.isArray(activeProfile?.price_list_ids)&&activeProfile.price_list_ids.length?activeProfile.price_list_ids:(activeProfile?.price_list_id?[activeProfile.price_list_id]:[]);return db.priceLists.filter(list=>ids.includes(list.id)).flatMap(list=>priceListProducts(list).map(line=>({...line,list_id:list.id,list_name:list.name||'Listino',product:String(line.product||db.products.find(p=>p.id===line.product_id)?.name||'Prodotto'),price:Number(line.price)||0}))).filter(line=>line.product)}function menjaCustomerOrderForm(){const catalog=customerOrderCatalog();let catalogHtml=catalog.length?catalog.map((item,index)=>'<label class="customer-order-product" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;margin:8px 0"><input type="checkbox" name="order_product" value="'+index+'" style="width:20px;height:20px"><span><strong>'+esc(item.product)+'</strong><small class="muted" style="display:block">'+esc(item.list_name)+'</small><small class="muted">€ '+item.price.toFixed(2)+'</small></span><span><small class="muted">Quantità</small><input class="field" type="number" name="quantity_'+index+'" min="1" step="1" value="1" style="width:76px"></span></label>').join(''):'<div class="empty">Non ci sono prodotti nei listini assegnati al tuo account. Contatta il titolare per farti assegnare un listino con i prodotti.</div>';return '<form class="box formgrid" onsubmit="submitCustomerOrder(event)"><h2 class="wide">Nuovo ordine</h2><label class="wide">Giorno di ritiro<input class="field" type="date" name="pickup" min="'+new Date().toISOString().slice(0,10)+'" required></label><div class="wide"><h3>Seleziona i prodotti</h3><p class="muted">Spunta i prodotti che desideri e indica la quantità.</p>'+catalogHtml+'</div><label class="wide">Note per il titolare<textarea class="field" name="notes" rows="2" placeholder="Eventuali indicazioni per il tuo ordine"></textarea></label><div class="wide actions"><button class="btn gold" '+(!catalog.length?'disabled':'')+'>Invia ordine</button></div><p class="wide muted">L’orario verrà concordato con il titolare. La richiesta sarà approvata manualmente.</p></form>'}
async function submitCustomerOrder(event){event.preventDefault();const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));const catalog=customerOrderCatalog();const selected=[...form.querySelectorAll('input[name="order_product"]:checked')];if(!selected.length){alert('Seleziona almeno un prodotto.');return}const lines=selected.map(input=>{const item=catalog[Number(input.value)];const quantity=Number(form.elements['quantity_'+input.value]?.value||1);if(!item||!Number.isInteger(quantity)||quantity<1)throw new Error('Controlla le quantità dei prodotti selezionati.');return {product:item.product,product_id:item.product_id||null,quantity,unit_price:item.price,price_list_id:item.list_id,price_list_name:item.list_name,line_total:Number((quantity*item.price).toFixed(2))}});const total=Number(lines.reduce((sum,line)=>sum+line.line_total,0).toFixed(2));const obj={id:crypto.randomUUID(),code:'ORD-'+String(Date.now()).slice(-6),customer:activeProfile.full_name||activeProfile.email,customer_id:activeProfile.id,customer_email:activeProfile.email||'',customer_code:activeProfile.customer_code||'',pickup:values.pickup,items:lines.map(line=>line.quantity+' × '+line.product).join(', '),lines,total:total.toFixed(2),notes:values.notes||'',status:'Da approvare',created_at:new Date().toISOString()};try{await persistRecord('orders',obj);db.orders.push(obj);page='Storico ordini';render()}catch(e){showError(e)}}


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
  await loadOnlineData();render();
 }catch(error){showError(error)}
}
function toggleArchivedCustomers(){window.showArchivedCustomers=!window.showArchivedCustomers;render()}

function openAdminCustomer(id){if(activeProfile?.role!=='admin')return;selectedAdminCustomerId=id;editingAdminOrderId=null;page='Scheda cliente';render()}
function orderCustomerName(order){if(order?.customer&&String(order.customer).trim())return order.customer;const customer=db.customers.find(c=>String(c.id)===String(order?.customer_id));return customer?.name||order?.customer_name||order?.customer_email||'Cliente non identificato'}
function adminCustomerOrders(customer){const code=String(customer?.code||customer?.fidelity_code||'').trim();const name=String(customer?.name||'').trim().toLocaleLowerCase('it-IT');return db.orders.filter(o=>{if(customer?.isProfile&&o.customer_id)return o.customer_id===customer.id;const orderCode=String(o.customer_code||'').trim();if(code&&orderCode)return code===orderCode;return String(o.customer||'').trim().toLocaleLowerCase('it-IT')===name})}

function adminOrderEditor(order,customer){
 const o=order||{},date=String(o.pickup||'').split('T')[0],statuses=['Da approvare','Confermato','In produzione','Pronto per il ritiro','Consegnato','Ritirato','Rifiutato','Annullato'];

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
 return `<div class="head"><div><h1>${esc(customer.name||customer.email||'Cliente')}</h1><div class="muted">${esc(customer.email||'')} · Codice ${esc(customer.code||'—')}</div></div><div class="actions"><button class="btn" onclick="navigate('Clienti')">← Clienti</button>${customer.isProfile&&!customer.deleted_at?`<button class="btn" onclick="archiveAdminCustomer('${customer.id}')">Archivia cliente</button>`:''}<button class="btn gold" onclick="startAdminOrderCreate()">＋ Aggiungi ordine</button></div></div><details class="box" style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;padding:2px 0">Anagrafica cliente <span class="muted" style="font-weight:400">· Mostra o nascondi i dati</span></summary><div class="grid two" style="margin-top:16px">${anagrafica}</div></details>${adminCustomerPriceListBlock(customer)}${adminCustomerOrderTrend(orders)}${editing?adminOrderEditor(editing,customer):''}${editingAdminOrderId==='new'?adminOrderEditor(null,customer):''}<div class="box"><h2>Storico ordini · ${orders.length}</h2>${orders.length?table(['Ordine','Ritiro','Prodotti e quantità','Totale','Stato','Azioni'],rows):'<div class="empty">Nessun ordine registrato per questo cliente.</div>'}</div>`
}
function startAdminOrderCreate(){if(activeProfile?.role!=='admin')return;editingAdminOrderId='new';render()}
function editAdminCustomerOrder(id){if(activeProfile?.role!=='admin')return;editingAdminOrderId=id;render()}
function cancelAdminOrderEdit(){editingAdminOrderId=null;render()}
async function saveAdminCustomerOrder(event){event.preventDefault();if(activeProfile?.role!=='admin')return;const form=event.currentTarget;const customer=db.customers.find(c=>c.id===form.dataset.customerId);if(!customer){showError(new Error('Cliente non trovato'));return}const formData=new FormData(form);const values=Object.fromEntries(formData);const previous=editingAdminOrderId&&editingAdminOrderId!=='new'?db.orders.find(o=>o.id===editingAdminOrderId):null;const order={...(previous||{}),id:previous?.id||crypto.randomUUID(),code:previous?.code||'ORD-'+String(Date.now()).slice(-6),customer:customer.name||customer.email||'',customer_id:customer.isProfile?customer.id:(previous?.customer_id||null),customer_email:customer.email||'',customer_code:customer.code||customer.fidelity_code||'',pickup:values.pickup,items:String(values.items||'').trim(),total:values.total===''?'':Number(values.total),notes:String(values.notes||'').trim(),status:values.status||'Da approvare',lot_ids:previous?.lot_ids||[],created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),created_by:'admin'};try{window.__menjaStage=previous?'aggiornamento ordine cliente':'creazione ordine cliente';await persistRecord('orders',order);await loadOnlineData();editingAdminOrderId=null;render()}catch(error){showError(error)}}
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
async function deletePriceList(id){if(activeProfile?.role!=='admin')return;if(db.customers.some(c=>(Array.isArray(c.price_list_ids)&&c.price_list_ids.length?c.price_list_ids:(c.price_list_id?[c.price_list_id]:[])).includes(id))){alert('Questo listino è assegnato a uno o più clienti. Riassegna prima quei clienti.');return}if(!confirm('Eliminare questo listino?'))return;try{const {error}=await onlineClient.from('records').delete().eq('id',id).eq('kind','pricelists');if(error)throw error;await loadOnlineData();render()}catch(e){showError(e)}}
async function saveCustomerPriceLists(event){event.preventDefault();if(activeProfile?.role!=='admin')return;const form=event.currentTarget,customer=db.customers.find(c=>c.id===form.dataset.customerId);if(!customer)return;const ids=[...form.querySelectorAll('input[name="price_list_ids"]:checked')].map(x=>x.value);try{const{error}=await onlineClient.from('profiles').update({price_list_ids:ids,price_list_id:ids[0]||null}).eq('id',customer.id);if(error)throw error;customer.price_list_ids=ids;customer.price_list_id=ids[0]||'';render()}catch(e){showError(e)}}
function adminCustomerPriceListBlock(customer){const assigned=Array.isArray(customer.price_list_ids)&&customer.price_list_ids.length?customer.price_list_ids:(customer.price_list_id?[customer.price_list_id]:[]);return '<form class="box" style="margin:16px 0" data-customer-id="'+esc(customer.id)+'" onsubmit="saveCustomerPriceLists(event)"><h2>Listini assegnati</h2><p class="muted">Puoi assegnare più listini allo stesso cliente. Seleziona tutti quelli che deve poter consultare.</p>'+(db.priceLists.length?db.priceLists.map(l=>'<label style="display:flex;align-items:center;gap:10px;margin:10px 0"><input type="checkbox" name="price_list_ids" value="'+esc(l.id)+'" '+(assigned.includes(l.id)?'checked':'')+'><span><strong>'+esc(l.name||'Listino senza nome')+'</strong>'+(l.description?'<small class="muted" style="display:block">'+esc(l.description)+'</small>':'')+'</span></label>').join(''):'<div class="empty">Non hai ancora creato listini. Vai nella sezione Listini per crearne uno.</div>')+'<div class="dialogfoot"><button class="btn gold" type="submit" '+(!db.priceLists.length?'disabled':'')+'>Salva assegnazioni</button></div></form>'}
function customerPriceListPage(){const ids=Array.isArray(activeProfile?.price_list_ids)&&activeProfile.price_list_ids.length?activeProfile.price_list_ids:(activeProfile?.price_list_id?[activeProfile.price_list_id]:[]);const lists=db.priceLists.filter(x=>ids.includes(x.id));if(!lists.length)return '<div class="head"><div><h1>I miei listini</h1><div class="muted">Prezzi riservati al tuo account</div></div></div><div class="box empty">Non è ancora stato assegnato un listino al tuo account. Contatta il titolare per informazioni.</div>';return '<div class="head"><div><h1>I miei listini</h1><div class="muted">'+lists.length+' listin'+(lists.length===1?'o':'i')+' riservat'+(lists.length===1?'o':'i')+' al tuo account</div></div></div>'+lists.map(list=>{const products=priceListProducts(list);return '<section class="box" style="margin-bottom:16px"><h2>'+esc(list.name||'Listino senza nome')+'</h2>'+(list.description?'<p class="muted">'+esc(list.description)+'</p>':'')+(products.length?table(['Prodotto','Prezzo unitario'],products.map(p=>[esc(p.product),'€ '+Number(p.price||0).toFixed(2)])):'<div class="empty">Il listino non contiene ancora prodotti.</div>')+'</section>'}).join('')}
let selectedAdminOrderId=null;
let showOnlyNewOrders=false;
function toggleNewOrdersFilter(){showOnlyNewOrders=!showOnlyNewOrders;render()}
function openAdminOrder(id){dismissOwnerOrderNotice();selectedAdminOrderId=id;page='Ordini';render()}
function closeAdminOrder(){selectedAdminOrderId=null;render()}
function orderPendingIndicator(order){return order?.status==='Da approvare'?'<span class="order-status-dot" title="Ordine nuovo da approvare" aria-label="Da approvare" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 3px #ef444422;margin-right:7px;vertical-align:middle"></span>':''}
function adminOrdersPage(){
 const orders=db.orders.slice().sort((a,b)=>new Date(b.created_at||b.updated_at||0).getTime()-new Date(a.created_at||a.updated_at||0).getTime());
 const displayedOrders=showOnlyNewOrders?orders.filter(o=>o.status==='Da approvare'):orders;
 const selected=orders.find(o=>o.id===selectedAdminOrderId);
 if(selected){
  const lines=Array.isArray(selected.lines)?selected.lines:[];
  const linesHtml=lines.length
   ?'<div class="tablewrap"><table class="table"><thead><tr><th>Prodotto</th><th>Quantità</th><th>Prezzo unitario</th><th>Totale</th></tr></thead><tbody>'+lines.map(line=>'<tr><td>'+esc(line.product||line.name||'Prodotto')+'</td><td>'+esc(line.quantity??line.qty??'—')+'</td><td>'+(line.unit_price!==undefined?'€ '+Number(line.unit_price||0).toFixed(2):'—')+'</td><td>'+(line.line_total!==undefined?'€ '+Number(line.line_total||0).toFixed(2):(line.unit_price!==undefined?'€ '+(Number(line.unit_price||0)*Number(line.quantity||line.qty||0)).toFixed(2):'—'))+'</td></tr>').join('')+'</tbody></table></div>'
   :'<div class="notice">'+esc(selected.items||'Dettaglio prodotti non presente in questo ordine.')+'</div>';
  return '<div class="head"><div><h1>'+orderPendingIndicator(selected)+'Ordine '+esc(selected.code||'')+'</h1><div class="muted">'+esc(selected.customer||'Cliente')+' · '+esc(formatCustomerPickupDate(selected.pickup))+'</div></div><div class="actions"><button class="btn" onclick="closeAdminOrder()">← Torna agli ordini</button></div></div><section class="box"><div class="grid two"><div><small class="muted">CLIENTE</small><h2>'+esc(selected.customer||'—')+'</h2><p>'+esc(selected.customer_email||'')+'</p><p>Codice cliente: '+esc(selected.customer_code||'—')+'</p></div><div><small class="muted">RITIRO</small><h2>'+esc(formatCustomerPickupDate(selected.pickup))+'</h2><p>Stato: '+orderPendingIndicator(selected)+'<span class="badge">'+esc(selected.status||'Da approvare')+'</span></p><p>Ordine: '+esc(selected.code||'—')+'</p></div></div><h2>Prodotti e quantità</h2>'+linesHtml+'<div class="grid two" style="margin-top:16px"><div><small class="muted">NOTE DEL CLIENTE</small><p>'+esc(selected.notes||'Nessuna nota')+'</p></div><div><small class="muted">TOTALE ORDINE</small><h2>€ '+Number(selected.total||0).toFixed(2)+'</h2></div></div><div class="actions" style="margin-top:18px">'+(selected.status==='Da approvare'?'<button class="btn gold" onclick="setOrderStatus(\''+selected.id+'\',\'Confermato\')">✓ Approva ordine</button><button class="btn" onclick="setOrderStatus(\''+selected.id+'\',\'Rifiutato\')">Rifiuta ordine</button>':'')+(selected.status!=='Annullato'?'<button class="btn" onclick="setOrderStatus(\''+selected.id+'\',\'Annullato\')">✕ Annulla ordine</button>':'')+(selected.status!=='Pronto per il ritiro'&&selected.status!=='Consegnato'&&selected.status!=='Annullato'?'<button class="btn gold" onclick="setOrderStatus(\''+selected.id+'\',\'Pronto per il ritiro\')">✓ Ordine pronto</button>':'')+(selected.status!=='Consegnato'&&selected.status!=='Annullato'?'<button class="btn gold" onclick="setOrderStatus(\''+selected.id+'\',\'Consegnato\')">✓ Ordine consegnato</button>':'')+'</div></section>';
 }
 const rows=displayedOrders.map(o=>[esc(o.code||'—'),esc(o.customer||'—'),esc(formatCustomerPickupDate(o.pickup)),o.total!==undefined&&o.total!==''?'€ '+Number(o.total||0).toFixed(2):'Da definire',orderPendingIndicator(o)+'<span class="badge">'+esc(o.status||'Da approvare')+'</span>','<button class="smallbtn" onclick="openAdminOrder(\''+o.id+'\')">Apri ordine →</button>']);
 const newCount=orders.filter(o=>o.status==='Da approvare').length;
 return head('Ordini','Apri ogni richiesta per controllare prodotti, quantità e totale prima di approvarla')+'<div class="box"><div class="toolbar"><input class="field" placeholder="Cerca ordine o cliente" oninput="filterRows(this)"><button class="smallbtn" onclick="toggleNewOrdersFilter()">'+(showOnlyNewOrders?'Mostra tutti gli ordini':'Nuovi ordini ('+newCount+')')+'</button><span class="muted">'+displayedOrders.length+' ordini</span></div>'+(rows.length?table(['Numero','Cliente','Ritiro','Totale','Stato','Dettaglio'],rows):'<div class="empty">'+(showOnlyNewOrders?'Non ci sono nuovi ordini da approvare.':'Non ci sono ordini registrati.')+'</div>')+'</div>';
}

let selectedProductionLotId=null;
function lotDateToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function generateProductionLotCode(date){const compact=String(date||lotDateToday()).replace(/-/g,'');const prefix='L-'+compact+'-';const nums=db.lots.filter(x=>String(x.code||'').startsWith(prefix)).map(x=>parseInt(String(x.code).slice(prefix.length),10)||0);return prefix+String(Math.max(0,...nums)+1).padStart(3,'0')}

function productionLotEditor(lot){
 const x=lot||{},date=x.production_date||x.date||lotDateToday();
 const assignedOrders=db.orders.filter(o=>(o.lot_ids||[]).includes(x.id));
 return '<div class="head"><div><h1>'+(lot?'Modifica lotto':'Genera nuovo lotto')+'</h1><div class="muted">Scheda di produzione e rintracciabilità</div></div><button class="btn" onclick="cancelProductionLotEdit()">← Torna ai lotti</button></div><form class="box formgrid" onsubmit="saveProductionLot(event)" data-lot-id="'+esc(x.id||'')+'"><div class="notice wide">Il codice viene generato automaticamente. Ogni lotto deve identificare prodotti realizzati in condizioni di produzione sostanzialmente identiche. Inserisci i dati reali dei fornitori e dei lotti delle materie prime. Il gestionale non stabilisce la shelf-life: inserisci TMC o scadenza solo dopo averla definita e validata nel piano HACCP.</div><label>Codice lotto (modificabile)<input class="field" name="code" required value="'+esc(x.code||generateProductionLotCode(date))+'" pattern="L-[A-Za-z0-9-]+" title="Il codice deve iniziare con L-"></label><label>Prodotto<input class="field" name="product" list="lotProductOptions" required value="'+esc(x.product||'')+'" placeholder="Es. Base pizza precotta 30 cm"><datalist id="lotProductOptions">'+db.products.map(p=>'<option value="'+esc(p.name)+'"></option>').join('')+'</datalist></label><label>Data produzione<input class="field" type="date" name="production_date" required value="'+esc(date)+'"></label><label>Ora / turno<input class="field" type="time" name="production_time" value="'+esc(x.production_time||'')+'"></label><label>Quantità prodotta<input class="field" type="number" name="qty" min="0.001" step="0.001" required value="'+esc(x.qty??'')+'"></label><label>Unità di misura<select class="field" name="unit"><option value="pezzi" '+((x.unit||'pezzi')==='pezzi'?'selected':'')+'>Pezzi</option><option value="confezioni" '+(x.unit==='confezioni'?'selected':'')+'>Confezioni</option><option value="kg" '+(x.unit==='kg'?'selected':'')+'>Kg</option></select></label><label>Termine minimo di conservazione / scadenza<input class="field" type="date" name="expiry" value="'+esc(x.expiry||'')+'"></label><label>Operatore responsabile<input class="field" name="operator" value="'+esc(x.operator||activeProfile?.full_name||'')+'"></label><label class="wide">Materie prime e tracciabilità fornitori<textarea class="field" name="ingredients_lots" rows="4" required placeholder="Una riga per ingrediente: materia prima | fornitore | lotto riportato sulla confezione | DDT/fattura | data ricezione.">'+esc(x.ingredients_lots||'')+'</textarea></label><label class="wide">Lotto materiali di confezionamento<textarea class="field" name="packaging_lot" rows="2" placeholder="Buste, assorbitori, etichette: fornitore e lotto riportato sui materiali">'+esc(x.packaging_lot||'')+'</textarea></label><label class="wide">Allergeni presenti / possibili contaminazioni<textarea class="field" name="allergens" rows="2" placeholder="Indica allergeni e possibili contaminazioni crociate secondo la tua valutazione HACCP">'+esc(x.allergens||'')+'</textarea></label><label class="wide">Controlli e parametri di processo<textarea class="field" name="process_notes" rows="3" placeholder="Impasto, cottura, raffreddamento, controlli effettuati, anomalie e azioni correttive">'+esc(x.process_notes||'')+'</textarea></label><label class="wide">Condizioni di conservazione<textarea class="field" name="storage" rows="2" placeholder="Condizioni di conservazione definite per il prodotto">'+esc(x.storage||'')+'</textarea></label><div class="wide"><strong>Ordini associati</strong><div class="muted">'+(assignedOrders.length?assignedOrders.map(o=>esc(o.code||'Ordine')+' · '+esc(o.customer||'Cliente')).join('<br>'):'Gli ordini vengono associati dalla scheda dell’ordine.')+'</div></div><label>Stato lotto<select class="field" name="status"><option '+((x.status||'Prodotto')==='Prodotto'?'selected':'')+'>Prodotto</option><option '+(x.status==='In quarantena'?'selected':'')+'>In quarantena</option><option '+(x.status==='Rilasciato'?'selected':'')+'>Rilasciato</option><option '+(x.status==='Bloccato'?'selected':'')+'>Bloccato</option></select></label><div class="wide muted">Creato: '+esc(x.created_at?new Date(x.created_at).toLocaleString('it-IT'):'alla conferma')+' · Revisioni registrate: '+(Array.isArray(x.revision_history)?x.revision_history.length:0)+'</div><div class="wide dialogfoot"><button type="button" class="btn" onclick="cancelProductionLotEdit()">Annulla</button><button class="btn gold" type="submit">Salva scheda lotto</button></div></form>';
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
 if(selectedProductionLotId==='new')return productionLotEditor(null);if(selectedProductionLotId){const lot=db.lots.find(x=>x.id===selectedProductionLotId);return lot?productionLotEditor(lot):'<div class="box">Lotto non trovato.<button class="btn" onclick="cancelProductionLotEdit()">Torna ai lotti</button></div>'}
 const lotDateValue=value=>{if(!value)return 0;const raw=String(value).trim();let match=raw.match(/^(\\d{1,2})[\\/.](\\d{1,2})[\\/.](\\d{4})$/);if(match)return new Date(Number(match[3]),Number(match[2])-1,Number(match[1])).getTime()||0;const time=Date.parse(raw);return Number.isFinite(time)?time:0};
 const lots=db.lots.slice().sort((a,b)=>lotDateValue(b.production_date||b.date)-lotDateValue(a.production_date||a.date)||lotDateValue(b.created_at)-lotDateValue(a.created_at)||String(b.code||'').localeCompare(String(a.code||''),'it'));
 const rows=lots.map(l=>{
  const linked=db.orders.filter(o=>(o.lot_ids||[]).includes(l.id)||(o.lot_ids||[]).includes(l.code));
  const searchable=[l.code,l.product,l.qty,l.unit,l.production_date,l.date,l.expiry,l.status,l.operator,l.ingredients_lots,l.packaging_lot,l.allergens,l.process_notes,l.storage,...linked.flatMap(o=>[o.code,o.customer,o.items])].join(' ').toLocaleLowerCase('it-IT');
  return '<tr class="production-lot-row" data-search="'+esc(searchable)+'"><td>'+esc(l.code||'—')+'</td><td>'+esc(l.product||'—')+'</td><td>'+esc(l.qty??'—')+' '+esc(l.unit||'')+'</td><td>'+esc(l.production_date||l.date||'—')+'</td><td>'+esc(l.expiry||'—')+'</td><td>'+esc(l.status||'Prodotto')+'</td><td><button class="smallbtn" data-id="'+esc(l.id)+'" onclick="editProductionLot(this.dataset.id)">Apri / modifica</button></td></tr>';
 }).join('');
 return head('Lotti produzione','Generatore, schede di tracciabilità e collegamento agli ordini',btn('Genera nuovo lotto','newProductionLot()'))+'<div class="box"><div class="toolbar"><input class="field" placeholder="Cerca nello storico: lotto, prodotto, data, ordine, cliente, fornitore…" oninput="filterProductionLots(this)"><span class="muted">'+lots.length+' lotti archiviati</span></div>'+(lots.length?'<div class="tablewrap"><table class="table" id="productionLotsTable"><thead><tr><th>Codice lotto</th><th>Prodotto</th><th>Quantità</th><th>Produzione</th><th>Conservazione fino al</th><th>Stato</th><th>Scheda</th></tr></thead><tbody>'+rows+'</tbody></table></div><div id="productionLotsSearchEmpty" class="empty" hidden>Nessun lotto corrisponde alla ricerca.</div>':'<div class="empty">Nessun lotto ancora registrato. Crea il primo lotto con il pulsante in alto.</div>')+'</div>';
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
 const orderIds=[];
 const snapshot=previous?{code:previous.code,product:previous.product,production_date:previous.production_date||previous.date,production_time:previous.production_time,qty:previous.qty,unit:previous.unit,expiry:previous.expiry,operator:previous.operator,ingredients_lots:previous.ingredients_lots,packaging_lot:previous.packaging_lot,allergens:previous.allergens,process_notes:previous.process_notes,storage:previous.storage,status:previous.status,order_ids:previous.order_ids||[]}:null;
 const lot={...(previous||{}),id:previous?.id||crypto.randomUUID(),code,product:String(values.product||'').trim(),production_date:values.production_date,date:values.production_date,production_time:values.production_time||'',qty:Number(values.qty),unit:values.unit||'pezzi',expiry:values.expiry||'',operator:String(values.operator||'').trim(),ingredients_lots:String(values.ingredients_lots||'').trim(),packaging_lot:String(values.packaging_lot||'').trim(),allergens:String(values.allergens||'').trim(),process_notes:String(values.process_notes||'').trim(),storage:String(values.storage||'').trim(),status:values.status||'Prodotto',order_ids:previous?.order_ids||[],created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),created_by:previous?.created_by||activeUser?.id,revision_history:previous?[...(previous.revision_history||[]),{edited_at:new Date().toISOString(),edited_by:activeProfile?.full_name||activeProfile?.email||'Amministratore',snapshot}]:[]};
 try{window.__menjaStage=previous?'aggiornamento scheda lotto':'creazione scheda lotto';await persistRecord('lots',lot);await loadOnlineData();selectedProductionLotId=null;render()}catch(error){showError(error)}
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
 const completed=['Confermato','In produzione','Pronto per il ritiro','Ritirato','Consegnato','Completato'];
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
 const allocate=(lot,quantity)=>{
  if(!lot||quantity<=0)return;
  const id=String(lot.id),remaining=remainingById.get(id)||0,used=Math.min(remaining,quantity);
  if(used>0){allocations.set(id,(allocations.get(id)||0)+used);remainingById.set(id,remaining-used)}
  return quantity-used;
 };
 for(const order of soldOrders){
  if(Array.isArray(order.lines)&&order.lines.length){
   for(const line of order.lines){
    const key=String(line.product||line.name||'').trim().toLocaleLowerCase('it-IT'),quantity=Math.max(0,Number(line.quantity??line.qty)||0);
    if(!key||!quantity)continue;
    const explicitId=line.lot_id?String(line.lot_id):'';
    if(explicitId){allocate(lotById.get(explicitId),quantity);continue}
    let pending=quantity;
    for(const lot of lotsByProduct.get(key)||[]){if(pending<=0)break;pending=allocate(lot,pending)}
   }
  }else{
   for(const [key,lots] of lotsByProduct){
    let pending=menjaOrderLineQuantities(order,key);
    for(const lot of lots){if(pending<=0)break;pending=allocate(lot,pending)}
   }
  }
 }
 return allocations;
}
function menjaLotSoldQuantity(lot,allocations){
 return allocations.get(String(lot.id))||0;
}
function menjaWarehousePage(){
 if(activeProfile?.role!=='admin')return '<div class="box">Accesso non consentito.</div>';
 const lots=db.lots.slice().sort((a,b)=>String(b.production_date||b.date||b.created_at||'').localeCompare(String(a.production_date||a.date||a.created_at||'')));
 const soldAllocations=menjaLotSoldAllocations();
 const rows=lots.map(lot=>{
  const produced=Math.max(0,Number(lot.qty)||0),sold=Math.min(produced,menjaLotSoldQuantity(lot,soldAllocations)),stock=Math.max(0,produced-sold);
  const search=[lot.code,lot.product,lot.production_date,lot.date,lot.status,lot.operator].join(' ').toLocaleLowerCase('it-IT');
  return '<tr class="warehouse-row" data-search="'+esc(search)+'"><td>'+esc(lot.code||'—')+'</td><td>'+esc(lot.product||'—')+'</td><td>'+esc(lot.production_date||lot.date||'—')+'</td><td>'+produced.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</td><td>'+sold.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</td><td><strong>'+stock.toLocaleString('it-IT')+' '+esc(lot.unit||'pezzi')+'</strong></td><td><span class="badge">'+esc(lot.status||'Prodotto')+'</span></td></tr>';
 }).join('');
 const totals=lots.reduce((acc,lot)=>{const p=Math.max(0,Number(lot.qty)||0),s=Math.min(p,menjaLotSoldQuantity(lot,soldAllocations));acc.produced+=p;acc.sold+=s;acc.stock+=Math.max(0,p-s);return acc},{produced:0,sold:0,stock:0});
 const summary=(label,value)=>'<div class="box"><small class="muted">'+label+'</small><h2 style="margin:6px 0 0">'+value.toLocaleString('it-IT')+'</h2><small class="muted">pezzi</small></div>';
 return head('Magazzino','Giacenza delle basi per lotto: produzione meno ordini approvati')+'<div class="grid three" style="margin-bottom:16px">'+summary('BASI PRODOTTE',totals.produced)+summary('BASI IMPEGNATE',totals.sold)+summary('BASI IN GIACENZA',totals.stock)+'</div><div class="box"><div class="toolbar"><input class="field" placeholder="Cerca per lotto, prodotto o data" oninput="filterWarehouseLots(this)"><span class="muted">'+lots.length+' lotti</span></div>'+(lots.length?'<div class="tablewrap"><table class="table" id="warehouseLotsTable"><thead><tr><th>Lotto</th><th>Prodotto</th><th>Data</th><th>Prodotte</th><th>Vendute</th><th>In giacenza</th><th>Stato lotto</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="empty" id="warehouseSearchEmpty" hidden>Nessun lotto trovato.</div>':'<div class="empty">Non ci sono ancora lotti di produzione. Registra un lotto nell’area Lotti produzione: le quantità compariranno qui.</div>')+'</div><p class="muted">Le basi vengono impegnate automaticamente quando l’ordine passa a “Confermato” (o a uno stato successivo). Se l’ordine viene rifiutato o torna “Da approvare”, le quantità rientrano nella giacenza.</p>';
}
function filterWarehouseLots(input){
 const query=String(input.value||'').trim().toLocaleLowerCase('it-IT');
 const rows=[...document.querySelectorAll('#warehouseLotsTable tbody .warehouse-row')];let visible=0;
 rows.forEach(row=>{const match=!query||String(row.dataset.search||'').includes(query);row.style.display=match?'':'none';if(match)visible++});
 const empty=document.getElementById('warehouseSearchEmpty');if(empty)empty.hidden=visible!==0;
}
function modulePage(){if(page==='Magazzino'&&activeProfile?.role==='admin')return menjaWarehousePage();if(page==='Lotti produzione'&&activeProfile?.role==='admin')return productionLotsPage();if(page==='Ordini'&&(selectedAdminOrderId||activeProfile?.role==='admin'))return adminOrdersPage();if(activeProfile?.role==='customer'){if(page==='Il mio listino'||page==='I miei listini')return customerPriceListPage();if(page==='Home'){return '<div class="customer-home"><div class="customer-greeting"><div><span>AREA CLIENTI</span><h1>Ciao, '+esc((activeProfile.full_name||'').split(' ')[0]||'benvenuto')+'!</h1><p>La tua esperienza Menja i Mut, tutta qui.</p></div></div>'+customerLoyaltyCard()+'<div class="customer-quick-grid"><button class="customer-action primary" onclick="goCustomerPage(\'Nuovo ordine\')"><span>＋</span><strong>Fai un ordine</strong><small>Invia una nuova richiesta</small></button><button class="customer-action" onclick="goCustomerPage(\'Punti fidelity\')"><span>✧</span><strong>La mia fidelity</strong><small>Consulta tessera e movimenti</small></button><button class="customer-action" onclick="goCustomerPage(\'Storico ordini\')"><span>▤</span><strong>I miei ordini</strong><small>Controlla le tue richieste</small></button><button class="customer-action" onclick="goCustomerPage(\'Chat col titolare\')"><span>✉</span><strong>Contatta il titolare</strong><small>Scrivici direttamente</small></button></div><p class="customer-footnote">I punti e il codice sono associati al tuo account personale.</p></div>'}if(page==='Nuovo ordine')return '<div class="head"><div><h1>Crea nuovo ordine</h1><div class="muted">Invia la richiesta al titolare</div></div></div>'+menjaCustomerOrderForm();if(page==='Storico ordini'){const rows=db.orders.slice().reverse().map(o=>[esc(o.code||''),esc(formatCustomerPickupDate(o.pickup)),esc(o.items||''),esc(o.status||'Da approvare')]);return '<div class="head"><div><h1>Storico ordini</h1><div class="muted">Le tue richieste e il loro stato</div></div></div><div class="box">'+(rows.length?table(['Ordine','Giorno di ritiro','Prodotti e quantità','Stato'],rows):'<div class="empty">Non hai ancora inviato ordini.</div>')+'</div>'}if(page==='Punti fidelity'){return '<div class="head"><div><h1>La mia fidelity</h1><div class="muted">La tua tessera personale e il saldo punti</div></div></div>'+customerLoyaltyCard()+'<div class="customer-points-summary"><div><small>SALDO DISPONIBILE</small><strong>'+(Number(activeProfile.fidelity_points)||0)+'</strong><span>punti</span></div><p>Mostra questa tessera quando effettui un acquisto da Menja i Mut.</p></div><div class="box"><h2>Movimenti punti</h2>'+(db.fidelity.length?table(['Data','Punti','Nota'],db.fidelity.map(m=>[esc(m.date||'—'),Number(m.points)||0,esc(m.note||'')])):'<div class="empty">Non sono ancora presenti movimenti punti.</div>')+'</div>'}if(page==='Chat col titolare'){setTimeout(()=>loadChatMessages(activeProfile.id),0);return '<div class="head"><div><h1>Chat col titolare</h1><div class="muted">Conversazione privata</div></div></div>'+menjaChatPanel(activeProfile.id,'Messaggi') }}if(page==='Scheda cliente'&&activeProfile?.role==='admin'){return adminCustomerDetailPage()}if(page==='Listini'&&activeProfile?.role==='admin'){return priceListAdminPage()}if(page==='Chat clienti'&&activeProfile?.role==='admin'){const profiles=db.customers.filter(c=>c.isProfile&&c.id!==activeProfile.id);const chosen=profiles.find(c=>c.id===selectedChatCustomer);if(chosen)setTimeout(()=>loadChatMessages(chosen.id),0);return '<div class="head"><div><h1>Chat clienti</h1><div class="muted">Messaggi privati con i clienti</div></div></div><div class="grid two"><div class="box"><h2>Clienti</h2>'+profiles.map(c=>'<button class="btn" style="display:block;width:100%;margin:6px 0;text-align:left" onclick="openAdminChat(this.dataset.id)" data-id="'+c.id+'">'+esc(c.name||c.email)+' · '+esc(c.code||'')+'</button>').join('')+'</div>'+(chosen?menjaChatPanel(chosen.id,chosen.name||chosen.email):'<div class="box empty">Seleziona un cliente per aprire la conversazione.</div>')+'</div>'}return menjaBaseModulePage()}
async function signOut(){if(ownerNoticeTimer){clearInterval(ownerNoticeTimer);ownerNoticeTimer=null}await onlineClient?.auth.signOut();activeUser=null;activeProfile=null;startOnline()}
async function approveProfile(id,status){try{const value=({Attivo:'approved','In attesa di abilitazione':'pending',Sospeso:'suspended',Rifiutato:'rejected'})[status]||'approved';const {error}=await onlineClient.from('profiles').update({approval_status:value}).eq('id',id);if(error)throw error;await loadOnlineData();await refreshOwnerNotice();render()}catch(e){showError(e)}}
async function setOrderStatus(id,status){
 try{
  if(activeProfile?.role!=='admin')throw new Error('Solo il titolare può modificare lo stato degli ordini.');
  if(!['Confermato','Rifiutato','Annullato','Pronto per il ritiro','Consegnato'].includes(status))throw new Error('Stato ordine non valido.');
  const item=db.orders.find(x=>String(x.id)===String(id));
  if(!item)throw new Error('Ordine non trovato. Aggiorna la pagina e riprova.');
  const updatedPayload={...item,status};
  const {data,error}=await onlineClient.from('records').update({payload:updatedPayload}).eq('id',id).eq('kind','orders').select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Ordine non aggiornato: il database non ha confermato la modifica. Verifica i permessi e riprova.');
  item.status=status;
  syncPendingOrderBadge();
  render();
 }catch(e){showError(e)}
}function importBackup(){if(activeProfile?.role!=='admin'){alert('Importazione consentita solo all’amministratore.');return}let input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{try{let parsed=JSON.parse(await input.files[0].text()),data=parsed.data||parsed;if(parsed.app==='pizzalab'&&Array.isArray(data.customers)){let customers=new Map(data.customers.map(c=>[c.id,c]));for(const c of data.customers){const code=String(c.code||'');await persistRecord('customers',{id:c.id,source_id:c.id,name:c.name,phone:c.phone||'',email:c.email||'',address:c.address||'',notes:c.notes||'',created_at:c.created_at,code,fidelity_code:code,points:0,fidelity_points:0,category:'Altre attività',status:'Attivo'})}for(const p of data.products||[])await persistRecord('products',{id:p.id,source_id:p.id,name:p.name,description:p.description||'',price:p.price,unit:p.unit||'',active:p.active!==false,category:'Importato'});const itemsByOrder=new Map;for(const it of data.order_items||[]){if(!itemsByOrder.has(it.order_id))itemsByOrder.set(it.order_id,[]);itemsByOrder.get(it.order_id).push(it)}for(const o of data.orders||[]){const c=customers.get(o.customer_id),lines=itemsByOrder.get(o.id)||[],total=lines.reduce((sum,it)=>sum+(Number(it.quantity)||0)*(Number(it.unit_price)||0),0);await persistRecord('orders',{id:o.id,source_id:o.id,code:'ST-'+o.id.slice(0,6).toUpperCase(),customer:c?.name||'Cliente non trovato',customer_code:c?.code||'',pickup:o.delivery_date||'',total:total.toFixed(2),status:o.status==='consegnato'?'Ritirato':'Da approvare',notes:o.notes||'',items:lines.map(it=>it.product_name+' × '+it.quantity).join(', '),lines:lines.map(it=>({product:it.product_name,quantity:it.quantity,unit_price:it.unit_price,lot:it.lot||''}))})}await loadOnlineData();render();alert('Backup PizzaLab importato: '+data.customers.length+' clienti con tessera fidelity collegata al codice, '+(data.products||[]).length+' prodotti e '+(data.orders||[]).length+' ordini. Saldo punti iniziale: 0 perché il backup non contiene movimenti fidelity.')}else{for(const b of buckets)for(const item of (data[b]||[])){item.id=item.id||crypto.randomUUID();await persistRecord(onlineKinds[b],item)}await loadOnlineData();render();alert('Backup importato.')}}catch(e){showError(e)}};input.click()}const menjaBaseNavigate=navigate;function navigate(target){closeMobileMore();if(activeProfile?.role==='customer'&&!['Home','Nuovo ordine','Storico ordini','Punti fidelity','Il mio listino','Chat col titolare'].includes(target))target='Nuovo ordine';page=target;render()}function goCustomerPage(target){navigate(target)}const menjaBaseNavHTML=baseNavHTML;function navHTML(){menjaBaseNavHTML();if(activeProfile?.role==='customer'){const items=[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Punti fidelity','✧'],['I miei listini','€'],['Chat col titolare','✉']];document.getElementById('bottom').innerHTML=items.map(([name,icon])=>'<button class="'+(page===name?'active':'')+'" onclick="goCustomerPage(this.dataset.page)" data-page="'+name+'"><span>'+icon+'</span>'+name+'</button>').join('')}}

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
 root.dataset.mobilePage=String(page||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
}
const menjaOriginalRenderV49=render;
render=function menjaRenderWithMobileEnhanceV50(){menjaOriginalRenderV49();menjaMobileEnhanceV49()};
const menjaOriginalNavV49=navHTML;
navHTML=function menjaNavWithMobileEnhanceV50(){
 menjaOriginalNavV49();
 if(!document.documentElement.classList.contains('touch-mobile')||activeProfile?.role!=='customer')return;
 const bottom=document.getElementById('bottom');if(!bottom)return;
 const items=[['Home','⌂'],['Nuovo ordine','＋'],['Storico ordini','▤'],['Punti fidelity','✧']];
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

onlineClient?.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){activeUser=null;activeProfile=null;authScreen()}});
startOnline();
