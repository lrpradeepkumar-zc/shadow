// auth.js v3 - Supabase Auth only. No localStorage for users/passwords/sessions.
const ShadowAuth = (() => {
  'use strict';
  const SUPABASE_URL  = 'https://ycysvoolkezntbxcfrnq.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeXN2b29sa2V6bnRieGNmcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzY5MjksImV4cCI6MjA5MjAxMjkyOX0.Y0OFF8Bdc3iSp_Bm9G7Io3Szy0amnHVuO3k8nspqxCk';
  const ROLE_COLORS={admin:'#667eea',member:'#48bb78',viewer:'#ed8936'};
  const ROLE_LABELS={admin:'Admin',member:'Member',viewer:'Viewer'};
  const DEFAULT_PERMS={admin:{createTask:true,editTask:true,deleteTask:true,createGroup:true,editGroup:true,deleteGroup:true,assignTask:true,manageUsers:true,viewAll:true},member:{createTask:true,editTask:true,deleteTask:false,createGroup:true,editGroup:true,deleteGroup:false,assignTask:true,manageUsers:false,viewAll:false},viewer:{createTask:false,editTask:false,deleteTask:false,createGroup:false,editGroup:false,deleteGroup:false,assignTask:false,manageUsers:false,viewAll:false}};
  var _sb=null,_cu=null;
  function getSB(){if(_sb)return _sb;if(window.ShadowDB&&ShadowDB._sb){_sb=ShadowDB._sb;return _sb;}if(window.supabase&&supabase.createClient){_sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'shadow_sb_auth'}});return _sb;}return null;}
  function getInitials(n){var p=(n||'').trim().split(/\s+/);return(p[0][0]+(p[1]?p[1][0]:'')).toUpperCase();}
  function genColor(r){return ROLE_COLORS[r]||'#667eea';}
  async function loadProfile(uid){var sb=getSB();if(!sb||!uid)return null;var r=await sb.from('users').select('*').eq('id',uid).maybeSingle();return r.data;}
  async function buildCU(session){if(!session||!session.user)return null;var uid=session.user.id,email=session.user.email,p=await loadProfile(uid);if(p)return{id:uid,name:p.name,email:p.email,role:p.role,avatar:p.avatar||getInitials(p.name),color:p.color||genColor(p.role)};var n=email?email.split('@')[0]:'User';return{id:uid,name:n,email:email,role:'member',avatar:getInitials(n),color:ROLE_COLORS.member};}
  function isLoggedIn(){return!!_cu;}
  function getCurrentUser(){return _cu;}
  function getRole(){return _cu?_cu.role:null;}
  function hasPermission(perm){var r=getRole();if(!r)return false;return!!(DEFAULT_PERMS[r]&&DEFAULT_PERMS[r][perm]);}
  async function login(email,password){var sb=getSB();if(!sb)return{ok:false,error:'Auth not ready'};var r=await sb.auth.signInWithPassword({email:email,password:password});if(r.error)return{ok:false,error:r.error.message};_cu=await buildCU(r.data.session);updateUI();return{ok:true,user:_cu};}
  async function register(name,email,password,role){
    if(!name||!name.trim())return{ok:false,error:'Name is required'};
    if(!email||!email.includes('@'))return{ok:false,error:'Valid email required'};
    if(!password||password.length<6)return{ok:false,error:'Password must be 6+ characters'};
    var sb=getSB();if(!sb)return{ok:false,error:'Auth not ready'};
    var cnt=await sb.from('users').select('*',{count:'exact',head:true});
    var ar=role||(cnt.count===0?'admin':'member');
    var r=await sb.auth.signUp({email:email,password:password,options:{data:{name:name,role:ar}}});
    if(r.error)return{ok:false,error:r.error.message};
    var uid=r.data.user&&r.data.user.id;
    if(uid)await sb.from('users').upsert({id:uid,name:name.trim(),email:email.trim(),role:ar,avatar:getInitials(name),color:genColor(ar)});
    if(r.data.session){_cu=await buildCU(r.data.session);updateUI();}
    return{ok:true,user:{id:uid,name:name.trim(),email:email,role:ar}};
  }
  async function logout(){var sb=getSB();if(sb)await sb.auth.signOut();_cu=null;['shadow_session','shadow_users','shadow_rbac_current_user'].forEach(function(k){localStorage.removeItem(k);});location.reload();}
  async function getOrgMembers(){var sb=getSB();if(!sb)return[];var r=await sb.from('users').select('*').order('name');return(r.data||[]).map(function(u){return{id:u.id,name:u.name,email:u.email,avatar:u.avatar||getInitials(u.name),color:u.color||genColor(u.role),role:u.role};});}
  async function adminCreateUser(n,e,p,r){if(!hasPermission('manageUsers'))return{ok:false,error:'Permission denied'};return register(n,e,p||'Shadow2025!',r||'member');}
  async function adminUpdateUser(id,upd){if(!hasPermission('manageUsers'))return{ok:false,error:'Permission denied'};var sb=getSB(),o={};if(upd.name){o.name=upd.name;o.avatar=getInitials(upd.name);}if(upd.role){o.role=upd.role;o.color=genColor(upd.role);}var r=await sb.from('users').update(o).eq('id',id);return r.error?{ok:false,error:r.error.message}:{ok:true};}
  async function adminDeleteUser(id){if(!hasPermission('manageUsers'))return{ok:false,error:'Permission denied'};if(_cu&&_cu.id===id)return{ok:false,error:'Cannot delete yourself'};var sb=getSB();var r=await sb.from('users').delete().eq('id',id);return r.error?{ok:false,error:r.error.message}:{ok:true};}
  function adminUpdatePerms(){return{ok:true};}
  function updateUI(){var u=_cu;if(!u)return;var el=document.querySelector('.avatar');if(el){el.textContent=u.avatar||u.name[0].toUpperCase();el.title=u.name+' ('+(ROLE_LABELS[u.role]||u.role)+')';el.style.background=u.color||'#667eea';el.style.cursor='pointer';el.onclick=function(){ShadowAuth.logout();};}if(window.state){state.currentUserName=u.name;state.currentUserId=u.id;state.currentUserRole=u.role;}}
  function renderLoginScreen(){
    var old=document.getElementById('shadow-auth-overlay');if(old)old.remove();
    var o=document.createElement('div');o.id='shadow-auth-overlay';
    o.style.cssText='position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95);display:flex;align-items:center;justify-content:center;';
    o.innerHTML="<div style='background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.4);width:100%;max-width:420px;overflow:hidden;'><div style='background:linear-gradient(135deg,#e74c3c,#c0392b);padding:28px 32px 20px;text-align:center;'><div style='font-size:32px;margin-bottom:8px;'>&#x2705;</div><h1 style='color:#fff;margin:0;font-size:22px;font-weight:700;'>Shadow ToDo</h1><p style='color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px;'>Sign in to your workspace</p></div><div style='padding:28px 32px;'><div style='display:flex;gap:0;margin-bottom:20px;border:1.5px solid #e5e7eb;border-radius:10px;overflow:hidden;'><button id=sa-tab-login onclick=\"ShadowAuth._switchTab('login');\" style='flex:1;padding:9px;background:#e74c3c;color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;'>Sign In</button><button id=sa-tab-register onclick=\"ShadowAuth._switchTab('register');\" style='flex:1;padding:9px;background:#fff;color:#374151;border:none;font-size:13px;cursor:pointer;'>Register</button></div><form id=sa-form-login><div style='margin-bottom:14px;'><label>Email</label><input type=email id=sa-login-email placeholder='admin@todo.app' autocomplete=email style='width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;display:block;margin-top:4px;'></div><div style='margin-bottom:6px;'><label>Password</label><input type=password id=sa-login-pass placeholder='Your password' autocomplete=current-password style='width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;display:block;margin-top:4px;'></div><p id=sa-login-error style='color:#ef4444;font-size:12px;min-height:18px;margin:0 0 10px;'></p><button type=button onclick=\"ShadowAuth._submitLogin(event);\" style='width:100%;padding:11px;background:#e74c3c;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;'>Sign In</button></form><form id=sa-form-register style='display:none;'><div style='margin-bottom:12px;'><label>Full Name</label><input type=text id=sa-reg-name placeholder='Your full name' style='width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;display:block;margin-top:4px;'></div><div style='margin-bottom:12px;'><label>Email</label><input type=email id=sa-reg-email placeholder='you@example.com' autocomplete=email style='width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;display:block;margin-top:4px;'></div><div style='margin-bottom:6px;'><label>Password</label><input type=password id=sa-reg-pass placeholder='Create a password' style='width:100%;box-sizing:border-box;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;display:block;margin-top:4px;'></div><p id=sa-reg-error style='color:#ef4444;font-size:12px;min-height:18px;margin:0 0 10px;'></p><button type=button onclick=\"ShadowAuth._submitRegister(event);\" style='width:100%;padding:11px;background:#e74c3c;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;'>Create Account</button></form><p style='text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0;'>Admin: <strong>admin@todo.app</strong> / <strong>Admin@Shadow2025!</strong></p></div></div>";
    document.body.appendChild(o);
  }
  function _switchTab(tab){var lf=document.getElementById('sa-form-login'),rf=document.getElementById('sa-form-register'),lt=document.getElementById('sa-tab-login'),rt=document.getElementById('sa-tab-register');if(!lf)return;if(tab==='login'){lf.style.display='';rf.style.display='none';lt.style.background='#e74c3c';lt.style.color='#fff';rt.style.background='#fff';rt.style.color='#374151';}else{lf.style.display='none';rf.style.display='';rt.style.background='#e74c3c';rt.style.color='#fff';lt.style.background='#fff';lt.style.color='#374151';}}
  async function _submitLogin(e){if(e)e.preventDefault();var email=(document.getElementById('sa-login-email')||{}).value||'',pass=(document.getElementById('sa-login-pass')||{}).value||'',errEl=document.getElementById('sa-login-error'),btn=e&&e.target;if(btn){btn.textContent='Signing in...';btn.disabled=true;}var res=await login(email.trim(),pass);if(!res.ok){if(errEl)errEl.textContent=res.error;if(btn){btn.textContent='Sign In';btn.disabled=false;}return;}var ol=document.getElementById('shadow-auth-overlay');if(ol)ol.remove();location.reload();}
  async function _submitRegister(e){if(e)e.preventDefault();var name=(document.getElementById('sa-reg-name')||{}).value||'',email=(document.getElementById('sa-reg-email')||{}).value||'',pass=(document.getElementById('sa-reg-pass')||{}).value||'',errEl=document.getElementById('sa-reg-error'),btn=e&&e.target;if(btn){btn.textContent='Creating...';btn.disabled=true;}var res=await register(name.trim(),email.trim(),pass);if(!res.ok){if(errEl)errEl.textContent=res.error;if(btn){btn.textContent='Create Account';btn.disabled=false;}return;}var ol=document.getElementById('shadow-auth-overlay');if(ol)ol.remove();location.reload();}
  async function checkAuth(){
    var tries=0;while(!getSB()&&tries++<40){await new Promise(function(r){setTimeout(r,150);});}
  // Login handled by shadow-auth-gate.js
  return false;
    var r=await sb.auth.getSession(),session=r.data&&r.data.session;
    if(session){
      _cu=await buildCU(session);
      if(_cu){
        if(window.state){state.currentUserName=_cu.name;state.currentUserId=_cu.id;state.currentUserRole=_cu.role;}

        updateUI();
        sb.auth.onAuthStateChange(async function(event,sess){if(event==='SIGNED_OUT'){_cu=null;location.reload();}else if(sess){_cu=await buildCU(sess);updateUI();}});
        return true;
      }
    }
    // Login handled by shadow-auth-gate.js
  return false;
  }
  function getUsers(){return[];}function saveUsers(){}function getPerms(){return DEFAULT_PERMS;}function savePerms(){}
  function getSession(){return _cu;}function setSession(){}function clearSession(){}
  function genId(){return 'u_'+Date.now();}function hashPass(p){return p;}
  return{checkAuth:checkAuth,isLoggedIn:isLoggedIn,getCurrentUser:getCurrentUser,getRole:getRole,hasPermission:hasPermission,login:login,logout:logout,register:register,renderLoginScreen:renderLoginScreen,updateUserUI:updateUI,getOrgMembers:getOrgMembers,getSession:getSession,setSession:setSession,clearSession:clearSession,adminCreateUser:adminCreateUser,adminUpdateUser:adminUpdateUser,adminDeleteUser:adminDeleteUser,adminUpdatePerms:adminUpdatePerms,getUsers:getUsers,saveUsers:saveUsers,getPerms:getPerms,savePerms:savePerms,genId:genId,hashPass:hashPass,getInitials:getInitials,ROLE_LABELS:ROLE_LABELS,ROLE_COLORS:ROLE_COLORS,DEFAULT_PERMS:DEFAULT_PERMS,_switchTab:_switchTab,_submitLogin:_submitLogin,_submitRegister:_submitRegister,DEFAULT_USER:null};
})();
document.addEventListener('DOMContentLoaded',function(){ShadowAuth.checkAuth();});
