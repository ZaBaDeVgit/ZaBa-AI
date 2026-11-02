(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = {
    read(key, fallback) { try { const value = localStorage.getItem('zaba.' + key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
    write(key, value) { try { localStorage.setItem('zaba.' + key, JSON.stringify(value)); } catch {} }
  };
  const providerPresets = {
    openrouter:{label:'OpenRouter · modelos gratuitos',endpoint:'https://openrouter.ai/api/v1/chat/completions',model:'openrouter/free',keyUrl:'https://openrouter.ai/settings/keys'},
    gemini:{label:'Google Gemini API',endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',model:'gemini-2.5-flash',keyUrl:'https://aistudio.google.com/apikey'},
    groq:{label:'Groq API',endpoint:'https://api.groq.com/openai/v1/chat/completions',model:'llama-3.3-70b-versatile',keyUrl:'https://console.groq.com/keys'},
    custom:{label:'Otro endpoint compatible',endpoint:'https://api.openai.com/v1/chat/completions',model:'gpt-4o-mini',keyUrl:''}
  };
  const defaults = {provider:'openrouter',endpoint:providerPresets.openrouter.endpoint, apiKey:'', model:'openrouter/free', defaultModel:'openrouter/free', rememberKey:false, saveHistory:true, voiceReply:false, persona:'Cercano y claro', style:'Natural y cercano'};
  let prefs = {...defaults, ...store.read('settings', {})};
  const previouslySavedSettings=store.read('settings',{});
  if(!previouslySavedSettings.provider && previouslySavedSettings.endpoint) prefs.provider='custom';
  let conversations = store.read('conversations', []);
  let currentId = null, currentAgent = null, attached = [], selectedModel = store.read('activeModel','ZaBa Auto'), directoryHandle = null, recognition = null, toastTimer;
  const welcome = $('#welcome'), thread = $('#chatThread'), input = $('#promptInput'), sendButton = $('#sendButton'), fileInput = $('#fileInput');

  function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
  function saveSettings() {
    const persistent = {...prefs};
    if (!prefs.rememberKey) persistent.apiKey = '';
    store.write('settings', persistent);
    updateConnectionStatus();
  }
  function updateConnectionStatus() {
    const status=$('#modeStatus');
    if(status) status.textContent=prefs.apiKey ? `Proveedor configurado · ${selectedModel==='ZaBa Auto'?(prefs.defaultModel||prefs.model):selectedModel}` : 'Modo demostración · configura un modelo en Ajustes';
  }
  function saveConversations() {
    if (prefs.saveHistory) store.write('conversations', conversations.map(c => ({...c, messages:c.messages.map(m => ({...m, attachments:(m.attachments||[]).map(a=>({name:a.name,type:a.type}))}))})));
  }
  function getCurrent() { return conversations.find(c => c.id === currentId); }
  function newConversation() { currentId = null; currentAgent = null; thread.innerHTML = ''; thread.classList.add('hidden'); welcome.classList.remove('hidden'); $('#breadcrumbTitle').textContent = 'Nueva conversación'; input.focus(); renderConversationList(); }
  function setConversation(id) {
    const conv = conversations.find(c => c.id === id); if (!conv) return;
    currentId = id; $('#breadcrumbTitle').textContent = conv.title; welcome.classList.add('hidden'); thread.classList.remove('hidden'); thread.innerHTML = '';
    conv.messages.forEach(m => renderMessage(m.role, m.content, m.attachments || [], false));
    renderConversationList(); thread.scrollTop = thread.scrollHeight;
    $('#sidebar').classList.remove('mobile-open');
  }
  function renderConversationList() {
    const list = $('#conversationList');
    if (!conversations.length) { list.innerHTML = '<p style="font-size:10px;color:#747b70;padding:4px 9px">Tus chats aparecerán aquí</p>'; return; }
    list.innerHTML = conversations.slice(0, 15).map(c => `<button class="conversation ${c.id === currentId ? 'active':''}" data-id="${escapeHtml(c.id)}"><span class="conversation-dot"></span><span>${escapeHtml(c.title)}</span><span class="more">···</span></button>`).join('');
    $$('.conversation', list).forEach(btn => btn.addEventListener('click', () => setConversation(btn.dataset.id)));
  }
  function renderMessage(role, content, files = [], add = true) {
    const row = document.createElement('article'); row.className = `message ${role}`;
    if (role === 'assistant') {
      const safe = escapeHtml(content).replace(/```([\s\S]*?)```/g, '<pre style="white-space:pre-wrap;background:#151912;border:1px solid #30372b;border-radius:9px;padding:12px;overflow:auto;color:#d1e9ae"><code>$1</code></pre>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code style="color:#c9ec9e;background:#252b21;padding:2px 4px;border-radius:3px">$1</code>').replace(/\n/g,'<br>');
      row.innerHTML = `<div class="assistant-avatar">✳</div><div class="message-content"><div class="message-meta">ZaBa AI${currentAgent ? ' · '+escapeHtml(currentAgent.name) : ''} · ${escapeHtml(selectedModel)}</div><div class="bubble">${safe}</div><div class="message-actions"><button class="copy-response">Copiar</button><button class="speak-response">Escuchar</button><button class="save-code">Guardar respuesta</button></div></div>`;
      $('.copy-response', row).onclick = async () => { await navigator.clipboard?.writeText(content); toast('Respuesta copiada'); };
      $('.speak-response', row).onclick = () => speak(content);
      $('.save-code', row).onclick = () => downloadText('respuesta-zaba.txt', content);
    } else {
      const chips = files.map(f => `<span class="attachment-chip">${f.type?.startsWith('image/') && f.dataUrl ? `<img src="${f.dataUrl}" alt="">` : '<span>▧</span>'}<span>${escapeHtml(f.name)}</span></span>`).join('');
      row.innerHTML = `<div class="bubble">${escapeHtml(content)}</div>` + (chips ? `<div style="display:flex;gap:5px;flex-wrap:wrap;align-self:flex-end">${chips}</div>` : '');
    }
    if (add) thread.appendChild(row);
    return row;
  }
  function ensureConversation(prompt) {
    if (!currentId) {
      currentId = (crypto.randomUUID?.() || String(Date.now()));
      conversations.unshift({id:currentId,title:prompt.slice(0,36)+(prompt.length>36?'…':''),messages:[]});
      $('#breadcrumbTitle').textContent = conversations[0].title;
      welcome.classList.add('hidden'); thread.classList.remove('hidden'); renderConversationList();
    }
    return getCurrent();
  }
  function showTyping() { const el=document.createElement('div'); el.className='message assistant typing'; el.innerHTML='<div class="assistant-avatar">✳</div><div><div class="message-meta">ZaBa está pensando</div><div class="typing-dots"><i></i><i></i><i></i></div></div>'; thread.appendChild(el); thread.scrollTop=thread.scrollHeight; return el; }
  function getDemoReply(text) {
    const low = text.toLowerCase();
    if (/\b(hola|buenas|hey|hello)\b/.test(low)) return `¡Hola! Soy ZaBa AI, tu espacio personal para explorar ideas, crear y resolver. ✳\n\nPuedes cambiar de modelo, adjuntar imágenes o documentos, hablar conmigo y personalizar agentes. ¿Qué te gustaría hacer hoy?`;
    if (/c[oó]digo|program|aplicaci[oó]n|script|web|html|javascript|python/.test(low)) return `¡Vamos a construirlo! Para hacerlo bien, primero aclaremos el objetivo y el entorno.\n\n**Una buena forma de empezar:**\n1. Definimos qué debe hacer y quién lo va a usar.\n2. Elegimos tecnología y estructura del proyecto.\n3. Creo un primer borrador de código para que lo revises.\n4. Iteramos juntos; nada se ejecuta ni modifica en tu dispositivo sin permiso.\n\nCuéntame un poco más sobre lo que imaginas. *Nota: conecta un proveedor en Ajustes para obtener generación real de código.*`;
    if (/imagen|foto|v[ií]deo|video|archivo|documento/.test(low)) return `Puedo ayudarte a analizar archivos que adjuntes. Elige el archivo con **Adjuntar** y revisaremos qué tipo de contenido admite el modelo seleccionado.\n\nEn esta vista de demostración no hay un modelo conectado; configura tu proveedor en ⚙ Ajustes para activar respuestas reales. Los archivos no salen del navegador hasta que los envías a un proveedor configurado.`;
    return `Gracias por compartirlo. Puedo ayudarte a explorar esta idea paso a paso.\n\n**Para avanzar, podemos:**\n- aclarar qué resultado buscas;\n- organizar las ideas en un plan concreto;\n- comparar opciones y sus ventajas;\n- crear un borrador que después revisamos juntos.\n\n> Esta respuesta es una muestra de la interfaz. Para conversar con un modelo real, añade la URL compatible y tu clave API en **Ajustes → Modelo**. La clave se guarda solo en este navegador si así lo eliges.`;
  }
  async function sendMessage(text = input.value) {
    text = text.trim(); if (!text && !attached.length) return;
    const filesForTurn = attached.map(f => ({name:f.name,type:f.type,dataUrl:f.type.startsWith('image/') ? f.dataUrl : undefined,previewDataUrl:f.previewDataUrl,textContent:f.textContent,previewNote:f.previewNote}));
    const userText = text || 'Analiza el archivo adjunto y ayúdame a entenderlo.';
    const conv = ensureConversation(userText); conv.messages.push({role:'user',content:userText,attachments:filesForTurn});
    renderMessage('user', userText, filesForTurn); input.value=''; autoGrow(); clearAttachments(); sendButton.disabled=true;
    const typing=showTyping(); thread.scrollTop=thread.scrollHeight;
    let answer;
    try { answer = prefs.apiKey ? await callModel(conv, userText) : getDemoReply(userText); }
    catch (error) { answer = `No se pudo contactar con el proveedor. **${error.message}**\n\nRevisa el endpoint, la clave y el modelo en Ajustes. Si el proveedor bloquea peticiones desde el navegador (CORS), necesitarás un pequeño servidor proxy: no publiques una clave secreta en un sitio público.`; }
    typing.remove(); conv.messages.push({role:'assistant',content:answer}); renderMessage('assistant',answer); thread.scrollTop=thread.scrollHeight; saveConversations(); sendButton.disabled=false;
    if (prefs.voiceReply) speak(answer);
  }
  async function callModel(conv, latest) {
    const url = prefs.endpoint.trim(); if (!url) throw new Error('Añade la URL del proveedor en Ajustes.');
    const messages = conv.messages.slice(-20).map(m => {
      if (m.role !== 'user' || !m.attachments?.length) return {role:m.role,content:m.content};
      const imgs = m.attachments.map(a => {
        const src = a.dataUrl || a.previewDataUrl;
        return src ? {type:'image_url',image_url:{url:src}} : null;
      }).filter(Boolean);
      const textParts = m.attachments.flatMap(a=>[
        a.textContent ? `[Contenido de ${a.name}]\n${a.textContent.slice(0,80000)}` : '',
        a.previewNote ? `[${a.name}: ${a.previewNote}]` : ''
      ]).filter(Boolean).join('\n\n');
      const fullText = m.content + (textParts ? '\n\n' + textParts : '');
      return imgs.length ? {role:'user',content:[{type:'text',text:fullText},...imgs]} : {role:'user',content:fullText};
    });
    if (currentAgent) messages.unshift({role:'system',content:currentAgent.instructions || `Eres ${currentAgent.name}. ${currentAgent.description}`});
    else messages.unshift({role:'system',content:`Eres ZaBa AI, un asistente útil, claro y honesto. Estilo: ${prefs.style}. ${prefs.persona ? 'Preferencias de la persona: '+prefs.persona+'.' : ''} No afirmes haber ejecutado acciones locales ni tener permisos que no se han concedido.`});
    const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${prefs.apiKey}`},body:JSON.stringify({model:prefs.model,messages,temperature:.7})});
    if (!response.ok) { let msg=`HTTP ${response.status}`; try { const data=await response.json(); msg=data.error?.message || msg; } catch {} throw new Error(msg); }
    const data=await response.json(); const content=data.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(c=>c.text||'').join('');
    throw new Error('El proveedor respondió con un formato no compatible.');
  }
  function autoGrow(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,180)+'px';}
  function clearAttachments(){attached=[];$('#attachmentPreview').innerHTML='';$('#attachmentPreview').classList.add('hidden');}
  function readAsDataUrl(file){return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>resolve(null);r.readAsDataURL(file);});}
  async function videoFrame(file){
    return new Promise(resolve=>{
      const url=URL.createObjectURL(file), video=document.createElement('video');
      video.preload='metadata';video.muted=true;video.playsInline=true;
      const finish=value=>{URL.revokeObjectURL(url);video.removeAttribute('src');resolve(value);};
      const timeout=setTimeout(()=>finish(null),5000);
      video.onloadedmetadata=()=>{video.currentTime=Math.min(.2,Math.max(0,video.duration-.05));};
      video.onseeked=()=>{try{const scale=Math.min(1,1280/video.videoWidth);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);clearTimeout(timeout);finish(canvas.toDataURL('image/jpeg',.78));}catch{clearTimeout(timeout);finish(null);}};
      video.onerror=()=>{clearTimeout(timeout);finish(null);};video.src=url;
    });
  }
  async function addFiles(files){
    for (const file of files) {
      if (file.size > 20*1024*1024){toast(`${file.name}: máximo 20 MB`);continue;}
      const item={name:file.name,type:file.type||'application/octet-stream',size:file.size,file,dataUrl:null};
      if (item.type.startsWith('image/')) item.dataUrl=await readAsDataUrl(file);
      if (item.type.startsWith('video/')) {item.previewUrl=URL.createObjectURL(file);item.previewDataUrl=await videoFrame(file);item.previewNote='se envía solo un fotograma inicial de vista previa; no se procesa el audio ni el resto del vídeo';}
      if (/\.(txt|md|csv|json|js|ts|py|html|css|xml|yaml|yml|log)$/i.test(file.name) || item.type.startsWith('text/')) {
        try {item.textContent=(await file.text()).slice(0,80000);} catch {toast(`No se pudo leer ${file.name}`);}
      }
      attached.push(item);
    }
    renderAttachments();
  }
  function renderAttachments(){const area=$('#attachmentPreview');area.classList.toggle('hidden',!attached.length);area.innerHTML=attached.map((f,i)=>`<div class="attachment-chip">${f.dataUrl?`<img src="${f.dataUrl}" alt="">`:'<span>▧</span>'}<span title="${escapeHtml(f.name)}">${escapeHtml(f.name)} · ${formatBytes(f.size)}</span><button data-remove="${i}" aria-label="Quitar ${escapeHtml(f.name)}">×</button></div>`).join('');$$('[data-remove]',area).forEach(b=>b.onclick=()=>{const rem=attached.splice(+b.dataset.remove,1)[0];if(rem.previewUrl)URL.revokeObjectURL(rem.previewUrl);renderAttachments();});}
  function formatBytes(bytes){return bytes<1024?bytes+' B':(bytes/1024/1024<1?(bytes/1024).toFixed(0)+' KB':(bytes/1024/1024).toFixed(1)+' MB');}
  function downloadText(filename, text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function openModal(html){$('#modalContent').innerHTML=html;$('#modalBackdrop').classList.remove('hidden');$('#modalClose').focus();}
  function closeModal(){$('#modalBackdrop').classList.add('hidden');}
  function settingsModal(tab='general'){
    const tabs=[['general','Preferencias'],['model','Modelo'],['privacy','Privacidad']];
    const tabbar=`<div class="modal-tabs">${tabs.map(([id,label])=>`<button class="modal-tab ${tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</div>`;
    let body='';
    if(tab==='general') body=`<div class="setting-row"><div class="setting-copy"><strong>Estilo de respuesta</strong><small>Elige el tono que ZaBa usará por defecto.</small></div><select class="form-select" style="width:170px" id="styleSelect"><option>Natural y cercano</option><option>Breve y directo</option><option>Detallado y didáctico</option><option>Técnico y preciso</option></select></div><div class="setting-row"><div class="setting-copy"><strong>Leer respuestas en voz alta</strong><small>Usa la voz disponible en tu dispositivo cuando el navegador lo permita.</small></div><button class="toggle ${prefs.voiceReply?'on':''}" id="voiceReplyToggle" aria-label="Leer respuestas en voz alta"></button></div><div class="setting-row"><div class="setting-copy"><strong>Guardar conversaciones en este dispositivo</strong><small>El historial se almacena localmente en este navegador.</small></div><button class="toggle ${prefs.saveHistory?'on':''}" id="historyToggle" aria-label="Guardar conversaciones"></button></div><label class="field-label" for="personaInput">Instrucciones personalizadas</label><textarea id="personaInput" class="form-textarea" placeholder="Por ejemplo: explícamelo con ejemplos cotidianos.">${escapeHtml(prefs.persona||'')}</textarea><p class="field-hint">Las instrucciones personalizan el estilo, nunca habilitan permisos ni acciones locales.</p>`;
    if(tab==='model') body=`<p class="field-hint" style="margin:0 0 12px">Elige un proveedor preconfigurado. ZaBa rellena su endpoint y permite descubrir los modelos publicados. Los planes gratuitos y sus cuotas pueden cambiar; cada proveedor exige tu propia clave.</p><label class="field-label" for="providerSelect">Proveedor</label><select class="form-select" id="providerSelect">${Object.entries(providerPresets).map(([id,p])=>`<option value="${id}" ${prefs.provider===id?'selected':''}>${p.label}</option>`).join('')}</select><div id="providerHelp" class="field-hint"></div><label class="field-label" for="endpointInput">URL del endpoint</label><input class="form-field" id="endpointInput" type="url" value="${escapeHtml(prefs.endpoint)}" placeholder="https://.../v1/chat/completions"><label class="field-label" for="modelInput">ID del modelo</label><div style="display:flex;gap:7px"><input class="form-field" id="modelInput" value="${escapeHtml(prefs.defaultModel||prefs.model)}" placeholder="modelo"><button class="secondary-button" id="discoverModels" style="white-space:nowrap">Descubrir modelos</button></div><select class="form-select hidden" id="discoveredModels" style="margin-top:7px"><option value="">Selecciona un modelo descubierto…</option></select><label class="field-label" for="apiKeyInput">Clave API ${prefs.apiKey?'· configurada':''}</label><input class="form-field" id="apiKeyInput" type="password" autocomplete="new-password" placeholder="Pega aquí tu clave; no la envíes por chat"><div class="setting-row"><div class="setting-copy"><strong>Recordar clave en este navegador</strong><small>Guardarla en este dispositivo es opcional y no equivale a cifrado de servidor.</small></div><button class="toggle ${prefs.rememberKey?'on':''}" id="rememberKeyToggle" aria-label="Recordar clave"></button></div><p class="field-hint">La clave la emite el proveedor, no ZaBa. Nunca se incluye una clave privada en el código público. Puede hacer falta un proxy si el proveedor bloquea CORS.</p>`;
    if(tab==='privacy') body=`<div class="setting-row"><div class="setting-copy"><strong>Procesamiento local</strong><small>Los archivos adjuntos permanecen en este navegador hasta que pulses Enviar. Las respuestas de demostración no envían datos.</small></div><span style="color:#c4ed92;font-size:9px">Activo</span></div><div class="setting-row"><div class="setting-copy"><strong>Permisos del dispositivo</strong><small>El acceso a archivos, micrófono y cámara está desactivado hasta que lo solicites.</small></div><button class="secondary-button" id="privacyPermissions">Gestionar</button></div><div class="setting-row"><div class="setting-copy"><strong>Borrar conversaciones guardadas</strong><small>Elimina el historial local de este navegador.</small></div><button class="secondary-button" id="clearHistory">Borrar datos</button></div><p class="field-hint">Cuando conectas un proveedor, el contenido enviado se procesa según sus términos y política de privacidad. Evita enviar datos sensibles sin revisar esas condiciones.</p>`;
    openModal(`<div class="modal-eyebrow">TU ESPACIO · AJUSTES</div><h2 id="modalTitle">Personaliza ZaBa AI</h2><p class="modal-subtitle">Tú decides cómo funciona y qué se comparte.</p>${tabbar}<div>${body}</div><div class="modal-actions"><button class="secondary-button" id="settingsDone">Cerrar</button><button class="primary-button" id="saveSettings">Guardar cambios</button></div>`);
    $$('.modal-tab').forEach(b=>b.onclick=()=>settingsModal(b.dataset.tab));
    const style=$('#styleSelect');if(style)style.value=prefs.style;
    const setToggle=(id,key)=>{const el=$('#'+id);if(el)el.onclick=()=>{prefs[key]=!prefs[key];el.classList.toggle('on',prefs[key]);};};
    setToggle('voiceReplyToggle','voiceReply');setToggle('historyToggle','saveHistory');setToggle('rememberKeyToggle','rememberKey');
    const providerSelect=$('#providerSelect');
    const updateProviderHelp=()=>{if(!providerSelect)return;const p=providerPresets[providerSelect.value];$('#providerHelp').innerHTML=p.keyUrl?`<a href="${p.keyUrl}" target="_blank" rel="noopener noreferrer" style="color:#c5ed94">Crear/obtener clave en ${p.label} ↗</a> · Se introduce aquí, no en el chat.`:'Endpoint y clave de tu proveedor compatible.';};
    if(providerSelect){updateProviderHelp();providerSelect.onchange=()=>{const p=providerPresets[providerSelect.value];$('#endpointInput').value=p.endpoint;$('#modelInput').value=p.model;$('#apiKeyInput').value='';$('#discoveredModels').classList.add('hidden');prefs.apiKey='';sessionStorage.removeItem('zaba.sessionKey');updateProviderHelp();};}
    $('#discoverModels')?.addEventListener('click',async()=>{
      const btn=$('#discoverModels'),provider=providerSelect.value,endpoint=$('#endpointInput').value.trim(),key=$('#apiKeyInput').value.trim()||prefs.apiKey;
      btn.disabled=true;btn.textContent='Buscando…';
      try{
        const modelsUrl=provider==='openrouter'?'https://openrouter.ai/api/v1/models':endpoint.replace(/\/chat\/completions\/?$/,'/models');
        const headers={};if(key)headers.Authorization=`Bearer ${key}`;
        const response=await fetch(modelsUrl,{headers});if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const result=await response.json();let models=result.data||result.models||[];
        if(provider==='openrouter')models=models.filter(m=>m.pricing?.prompt!=null&&m.pricing?.completion!=null&&Number(m.pricing.prompt)===0&&Number(m.pricing.completion)===0);
        if(!models.length)throw new Error('No se encontraron modelos listables para este endpoint.');
        const select=$('#discoveredModels');select.innerHTML='<option value="">Selecciona un modelo…</option>'+models.slice(0,150).map(m=>`<option value="${escapeHtml(m.id||m.name||'')}">${escapeHtml(m.name||m.id)}${provider==='openrouter'?' · gratis ahora':''}</option>`).join('');select.classList.remove('hidden');select.onchange=()=>{if(select.value)$('#modelInput').value=select.value;};
        toast(`${models.length} modelos ${provider==='openrouter'?'gratuitos ':''}encontrados`);
      }catch(error){toast(`No se pudieron descubrir modelos: ${error.message}. Puedes escribir el ID manualmente.`);}
      finally{btn.disabled=false;btn.textContent='Descubrir modelos';}
    });
    $('#settingsDone').onclick=closeModal;
    $('#saveSettings').onclick=()=>{
      if($('#styleSelect'))prefs.style=$('#styleSelect').value;
      if($('#personaInput'))prefs.persona=$('#personaInput').value;
      if($('#providerSelect'))prefs.provider=$('#providerSelect').value;
      if($('#endpointInput'))prefs.endpoint=$('#endpointInput').value.trim();
      if($('#modelInput')){const preset=providerPresets[prefs.provider]||providerPresets.custom;prefs.defaultModel=$('#modelInput').value.trim()||preset.model;if(selectedModel==='ZaBa Auto')prefs.model=prefs.defaultModel;}
      if(tab==='model'){selectedModel='ZaBa Auto';store.write('activeModel',selectedModel);$('#selectedModel').textContent=selectedModel;}
      if($('#apiKeyInput')){const key=$('#apiKeyInput').value.trim();if(key)prefs.apiKey=key;if(!prefs.rememberKey&&key){} }
      if(!prefs.rememberKey && tab==='model' && $('#apiKeyInput')?.value.trim()) { sessionStorage.setItem('zaba.sessionKey',$('#apiKeyInput').value.trim()); }
      if(prefs.rememberKey)sessionStorage.removeItem('zaba.sessionKey');
      saveSettings();toast('Preferencias guardadas');closeModal();
    };
    $('#privacyPermissions')?.addEventListener('click',permissionModal);
    $('#clearHistory')?.addEventListener('click',()=>{if(confirm('¿Eliminar todas las conversaciones guardadas de este navegador?')){conversations=[];store.write('conversations',[]);newConversation();toast('Historial eliminado');settingsModal('privacy');}});
  }
  function permissionModal(){
    openModal(`<div class="modal-eyebrow">SEGURIDAD · PERMISOS</div><h2 id="modalTitle">Acceso local, bajo tu control</h2><p class="modal-subtitle">ZaBa no accede a tu dispositivo en segundo plano. Elige una capacidad para autorizarla explícitamente.</p><div class="permission-card"><div class="permission-card-top"><strong>📁 Leer archivos de un proyecto</strong><span class="model-dot local-dot"></span></div><p>Selecciona una carpeta con el selector seguro del navegador. El acceso solo dura esta sesión.</p><button class="secondary-button" id="chooseFolder">Elegir carpeta</button><span id="folderStatus" style="font-size:9px;color:#bded8b;margin-left:9px"></span><div id="folderListing" class="field-hint"></div></div><div class="permission-card"><div class="permission-card-top"><strong>🎙 Micrófono</strong><span class="model-dot"></span></div><p>El navegador pedirá permiso cuando pulses el botón de voz. La transcripción se añade al borrador; no se envía automáticamente.</p><span style="font-size:9px;color:#a4ab9e">Permiso puntual al usar voz</span></div><div class="permission-card"><div class="permission-card-top"><strong>✍️ Escribir archivos</strong><span style="font-size:9px;color:#e3c681">Requiere confirmación</span></div><p>ZaBa preparará una descarga o pedirá seleccionar destino al guardar. Nunca sobrescribe archivos sin confirmación.</p><button class="secondary-button" id="revokeFolder">Revocar acceso a carpeta</button></div><div class="modal-actions"><button class="primary-button" id="permissionsDone">Listo</button></div>`);
    $('#chooseFolder').onclick=async()=>{try{if(!window.showDirectoryPicker){toast('Tu navegador no admite selector de carpetas. Usa Adjuntar.');return;}directoryHandle=await window.showDirectoryPicker({mode:'read'});$('#folderStatus').textContent='Carpeta autorizada para esta sesión';const names=[];for await(const [name] of directoryHandle.entries()){names.push(name);if(names.length>=12)break;}$('#folderListing').textContent=names.length?'Elementos visibles: '+names.join(', ')+(names.length===12?'…':''):'La carpeta está vacía.';toast('Acceso concedido solo a la carpeta elegida');}catch(e){if(e.name!=='AbortError')toast('No se pudo autorizar la carpeta');}};
    $('#revokeFolder').onclick=()=>{directoryHandle=null;$('#folderStatus').textContent='';$('#folderListing').textContent='';toast('Acceso revocado');};
    $('#permissionsDone').onclick=closeModal;
  }
  function agentsModal(){
    const agents=store.read('agents',[
      {name:'Compañero creativo',icon:'✳',description:'Explora ideas, encuentra enfoques y crea planes.',instructions:'Eres un compañero creativo. Ayuda a explorar posibilidades, pregunta antes de asumir y convierte ideas en pasos.'},
      {name:'Taller de código',icon:'⌘',description:'Diseña, escribe y explica código contigo.',instructions:'Eres un asistente de programación. Explica las decisiones, propone cambios pequeños y nunca afirmes que has ejecutado código.'},
      {name:'Guía de aprendizaje',icon:'◉',description:'Explica temas complejos de forma clara y gradual.',instructions:'Eres un tutor paciente. Adapta las explicaciones, ofrece ejemplos y verifica la comprensión.'}
    ]);
    openModal(`<div class="modal-eyebrow">AGENTES · PERSONALIZABLES</div><h2 id="modalTitle">Elige tu compañero</h2><p class="modal-subtitle">Cada agente tiene un estilo distinto. Ninguno obtiene permisos locales por defecto.</p><div class="agent-grid">${agents.map((a,i)=>`<button class="agent-card" data-agent="${i}"><span class="agent-icon">${a.icon}</span><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.description)}</small></button>`).join('')}<button class="agent-card" id="createAgent"><span class="agent-icon">＋</span><strong>Crear un agente</strong><small>Define sus instrucciones y personalidad.</small></button></div><div class="modal-actions"><button class="secondary-button" id="agentNone">Continuar sin agente</button></div>`);
    $$('.agent-card[data-agent]').forEach(b=>b.onclick=()=>{currentAgent=agents[+b.dataset.agent];store.write('activeAgent',currentAgent.name);closeModal();toast(`${currentAgent.name} activado`);});
    $('#agentNone').onclick=()=>{currentAgent=null;closeModal();toast('Chat normal activado');};
    $('#createAgent').onclick=()=>createAgentModal();
  }
  function createAgentModal(){openModal(`<div class="modal-eyebrow">DISEÑADOR DE AGENTES</div><h2 id="modalTitle">Crea tu agente</h2><p class="modal-subtitle">Dale una personalidad útil. Las herramientas locales requieren permisos independientes.</p><label class="field-label">Nombre</label><input class="form-field" id="agentName" placeholder="Ej. Mi tutor de idiomas"><label class="field-label">¿En qué te ayuda?</label><input class="form-field" id="agentDescription" placeholder="Describe su especialidad"><label class="field-label">Instrucciones</label><textarea class="form-textarea" id="agentInstructions" placeholder="¿Cómo debe comportarse? ¿Qué tono usar?" style="min-height:120px"></textarea><p class="field-hint">Este prototipo guarda agentes en este dispositivo. No concedas instrucciones que impliquen compartir datos sin consentimiento.</p><div class="modal-actions"><button class="secondary-button" id="cancelAgent">Cancelar</button><button class="primary-button" id="saveAgent">Guardar agente</button></div>`);$('#cancelAgent').onclick=agentsModal;$('#saveAgent').onclick=()=>{const name=$('#agentName').value.trim(),description=$('#agentDescription').value.trim(),instructions=$('#agentInstructions').value.trim();if(!name||!instructions){toast('Añade al menos un nombre e instrucciones');return;}const list=store.read('agents',[]);list.push({name,description:description||'Agente personal',icon:'✦',instructions});store.write('agents',list);currentAgent=list[list.length-1];closeModal();toast('Agente creado y activado');};}
  function projectsModal(){openModal(`<div class="modal-eyebrow">PROYECTOS · ESPACIO DE TRABAJO</div><h2 id="modalTitle">Crea con contexto</h2><p class="modal-subtitle">Un proyecto te ayuda a mantener juntas tus ideas y archivos. Elige una carpeta solo cuando quieras dar acceso.</p><div class="permission-card"><div class="permission-card-top"><strong>📂 Conectar una carpeta de proyecto</strong><span style="font-size:9px;color:#92998c">Opcional</span></div><p>El navegador solicita permiso y solo se accede a la carpeta seleccionada. Para añadir archivos sueltos, usa el botón Adjuntar del chat.</p><button class="primary-button" id="projectFolder">Seleccionar carpeta</button><span id="projectFolderStatus" style="font-size:9px;color:#c3ed91;margin-left:9px"></span></div><label class="field-label">Nombre del proyecto</label><input class="form-field" id="projectName" placeholder="Ej. App de recetas"><div id="projectList" style="margin-top:15px"></div><div class="modal-actions"><button class="secondary-button" id="projectsDone">Cerrar</button><button class="primary-button" id="createProject">Crear proyecto</button></div>`);
    const projects=store.read('projects',[]);$('#projectList').innerHTML=projects.length?`<p class="field-label">TUS PROYECTOS</p>`+projects.map(p=>`<div class="setting-row"><div class="setting-copy"><strong>▱ ${escapeHtml(p.name)}</strong><small>Espacio de trabajo local</small></div><button class="secondary-button" data-openproject="${escapeHtml(p.name)}">Abrir chat</button></div>`).join(''):'';
    $('#projectFolder').onclick=async()=>{try{if(!window.showDirectoryPicker){toast('Navegador sin selector de carpetas');return;}directoryHandle=await window.showDirectoryPicker({mode:'read'});$('#projectFolderStatus').textContent='Acceso concedido esta sesión';}catch(e){if(e.name!=='AbortError')toast('No se pudo abrir la carpeta');}};
    $('#createProject').onclick=()=>{const name=$('#projectName').value.trim();if(!name){toast('Escribe un nombre para el proyecto');return;}const ps=store.read('projects',[]);ps.unshift({name,created:Date.now()});store.write('projects',ps);closeModal();newConversation();toast(`Proyecto «${name}» creado`);};$('#projectsDone').onclick=closeModal;
    $$('[data-openproject]').forEach(b=>b.onclick=()=>{closeModal();newConversation();input.value=`Estoy trabajando en el proyecto «${b.dataset.openproject}». Ayúdame a avanzar.`;input.focus();});
  }
  function speak(text){if(!('speechSynthesis'in window)){toast('La síntesis de voz no está disponible en este navegador');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.slice(0,3500));u.lang='es-ES';speechSynthesis.speak(u);}
  function startVoice(){const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){toast('El reconocimiento de voz no está disponible. Prueba Chrome o Edge.');return;}if(recognition){recognition.stop();return;}recognition=new SpeechRecognition();recognition.lang='es-ES';recognition.interimResults=true;recognition.continuous=false;const btn=$('#voiceButton');btn.classList.add('recording');btn.title='Escuchando… pulsa para detener';let final='';recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript;}input.value=(final+interim).trim();autoGrow();};recognition.onerror=e=>toast(e.error==='not-allowed'?'Permite el micrófono en el navegador para usar voz.':'No se pudo reconocer la voz.');recognition.onend=()=>{btn.classList.remove('recording');btn.title='Hablar';recognition=null;if(final.trim())toast('Transcripción lista para revisar');};try{recognition.start();toast('Escuchando… habla ahora');}catch{recognition=null;btn.classList.remove('recording');}}

  $('#newChat').onclick=newConversation;$('#sendButton').onclick=()=>sendMessage();input.addEventListener('input',autoGrow);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
  $$('.quick-card').forEach(b=>b.onclick=()=>{input.value=b.dataset.prompt;autoGrow();input.focus();});
  $('#attachButton').onclick=()=>fileInput.click();fileInput.onchange=async()=>{await addFiles([...fileInput.files]);fileInput.value='';};
  const composer=$('.composer-shell');composer.addEventListener('dragover',e=>{e.preventDefault();composer.style.borderColor='#bde887';});composer.addEventListener('dragleave',()=>composer.style.borderColor='');composer.addEventListener('drop',async e=>{e.preventDefault();composer.style.borderColor='';await addFiles([...e.dataTransfer.files]);});
  $('#voiceButton').onclick=startVoice;
  $('#modelSelector').onclick=e=>{e.stopPropagation();$('#modelMenu').classList.toggle('hidden');};document.addEventListener('click',e=>{if(!e.target.closest('.model-wrap'))$('#modelMenu').classList.add('hidden');});
  $$('.model-option').forEach(b=>b.onclick=()=>{
    $('#modelMenu').classList.add('hidden');
    if(b.dataset.model==='Añadir proveedor'){settingsModal('model');return;}
    if(b.dataset.model==='ZaBa Auto'){
      selectedModel='ZaBa Auto';prefs.model=prefs.defaultModel||defaults.model;store.write('activeModel',selectedModel);$('#selectedModel').textContent=selectedModel;updateConnectionStatus();toast('Usando el modelo configurado');return;
    }
    const profileMap={'OpenRouter Gratis':'openrouter','Google Gemini':'gemini','Groq':'groq'};
    const provider=profileMap[b.dataset.model];if(!provider)return;
    const preset=providerPresets[provider];if(prefs.provider!==provider){prefs.apiKey='';sessionStorage.removeItem('zaba.sessionKey');}
    prefs.provider=provider;prefs.endpoint=preset.endpoint;prefs.defaultModel=preset.model;prefs.model=preset.model;
    selectedModel=b.dataset.model;store.write('activeModel',selectedModel);saveSettings();$('#selectedModel').textContent=selectedModel;
    if(!prefs.apiKey){settingsModal('model');toast(`Añade tu clave de ${preset.label} para activarlo`);}
    else{updateConnectionStatus();toast(`${preset.label} seleccionado`);}
  });
  $('#openSettings').onclick=()=>settingsModal();$('#openSettingsTop').onclick=()=>settingsModal();$('#openPermissions').onclick=permissionModal;$('#privacyInfo').onclick=permissionModal;$('#learnPrivacy').onclick=permissionModal;$('#agentsNav').onclick=agentsModal;$('#projectsNav').onclick=projectsModal;
  $('#collapseSidebar').onclick=()=>$('#sidebar').classList.toggle('collapsed');$('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('mobile-open');
  $('#modalClose').onclick=closeModal;$('#modalBackdrop').onclick=e=>{if(e.target===$('#modalBackdrop'))closeModal();};document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#sidebar').classList.remove('mobile-open');}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();newConversation();}});
  $('#searchChats').onclick=()=>{const q=prompt('Buscar en tus conversaciones:');if(q){const hit=conversations.find(c=>c.title.toLowerCase().includes(q.toLowerCase()));if(hit)setConversation(hit.id);else toast('No encontramos esa conversación');}};
  $$('.conversation').forEach((b,i)=>b.onclick=()=>{if(conversations[i])setConversation(conversations[i].id);else{input.value=b.innerText;toast('Conversación de ejemplo: empieza un chat nuevo para responder');}});
  if(!prefs.rememberKey){const sessionKey=sessionStorage.getItem('zaba.sessionKey');if(sessionKey)prefs.apiKey=sessionKey;else if(!store.read('settings',{}).rememberKey)prefs.apiKey='';}
  $('#selectedModel').textContent=selectedModel;
  $$('.model-option').forEach(b=>b.classList.toggle('selected',b.dataset.model===selectedModel));
  prefs.model=selectedModel==='ZaBa Auto'?(prefs.defaultModel||prefs.model):({'Llama 3.3':'llama-3.3-70b-versatile','Gemini Flash':'gemini-2.0-flash'}[selectedModel]||prefs.model);
  updateConnectionStatus();
  renderConversationList();
})();
