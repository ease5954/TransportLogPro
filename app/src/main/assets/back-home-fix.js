// Android Back navigation guard (v1.9.1)
(function(root){
  'use strict';

  if(root.__backHomeFixInstalled)return;
  root.__backHomeFixInstalled=true;

  const originalGo=typeof root.go==='function'?root.go:null;
  if(!originalGo||!root.history||typeof root.history.pushState!=='function')return;

  let handlingPop=false;

  function activeScreen(){
    try{
      const node=root.document&&root.document.querySelector('.screen.active');
      return node&&node.id?String(node.id):'home';
    }catch(e){return 'home';}
  }

  function closeTransientUi(){
    ['drawer','rateModal','insurance','appInfo'].forEach(id=>{
      try{
        const node=root.document&&root.document.getElementById(id);
        if(node&&node.classList&&node.classList.contains('show'))node.classList.remove('show');
      }catch(e){}
    });
  }

  function replaceState(screen){
    try{
      root.history.replaceState({transportScreen:screen},'',root.location.href);
    }catch(e){}
  }

  function pushState(screen){
    try{
      root.history.pushState({transportScreen:screen},'',root.location.href);
      return true;
    }catch(e){return false;}
  }

  // App always starts from Home. This is the entry the Android WebView can
  // return to when the user presses the physical Back button from a menu.
  replaceState(activeScreen()==='home'?'home':activeScreen());

  root.go=function(id){
    const target=String(id||'home');
    const before=activeScreen();
    const result=originalGo(target);

    if(handlingPop)return result;

    const state=root.history.state||{};
    if(target==='home'){
      if(before!=='home'&&state.transportScreen&&state.transportScreen!=='home'&&typeof root.history.back==='function'){
        root.history.back();
      }else{
        replaceState('home');
      }
      return result;
    }

    // Only keep one non-home history level. Moving between app menus replaces
    // that level, so one Back press always returns to Home rather than walking
    // through every menu the driver opened.
    if(before==='home'||!state.transportScreen||state.transportScreen==='home'){
      pushState(target);
    }else{
      replaceState(target);
    }
    return result;
  };

  root.addEventListener('popstate',function(){
    if(handlingPop)return;
    handlingPop=true;
    closeTransientUi();
    try{originalGo('home');}catch(e){}
    replaceState('home');
    handlingPop=false;
  });

  root.__backHomeActiveScreen=activeScreen;
})(window);
