// 🎲 在线飞行棋 · 完整版（融合game1-5全部功能）
const COLORS=['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS=['#cc0000','#0055cc','#008800','#cc8800'];
const EMOJIS=['🔴','🔵','🟢','🟡'];
let socket=null,myIdx=-1,roomId='',players=[],game=null,paths={},isMyTurn=false;
let cellEffects={},cellPopups={},pieceIcons={},pieceImages={},cellSize=40;

// ===== 路径生成 =====
function genPaths(mode){
  const gens={
    double:()=>{
      const CX=520,CY=520,SX=96,SY=78;
      const p=[];let x=CX-380,y=CY-380,s=8,d=0,r=1,t=0;
      const dx=[SX,0,-SX,0],dy=[0,SY,0,-SY];
      for(let i=0;i<8;i++){p.push([Math.round(x),Math.round(y)]);x+=dx[0];}
      x-=dx[0];d=1;s=7;r=s;
      while(p.length<60){x+=dx[d];y+=dy[d];p.push([Math.round(x),Math.round(y)]);r--;if(r<=0){d=(d+1)%4;t++;if(t%2===0)s--;if(s<1)s=1;r=s;}}
      return {paths:{1:[...p],2:[...p]},n:2,st:{1:0,2:30},end:59,cs:84};
    },
    cross:()=>{
      const A=7,W=2,s=50,cx=520,cy=520,cl=84,pts=[];
      const add=(x,y)=>pts.push([x,y]);
      for(let x=-W;x<=W;x++)add(x,-A);for(let y=-A+1;y<=-W;y++)add(W,y);
      for(let x=W+1;x<=A;x++)add(x,-W);for(let y=-W+1;y<=W;y++)add(A,y);
      for(let x=A-1;x>=W+1;x--)add(x,W);for(let y=W+1;y<=A-1;y++)add(W,y);
      for(let x=W;x>=-W;x--)add(x,A);for(let y=A-1;y>=W+1;y--)add(-W,y);
      for(let x=-W-1;x>=-A+1;x--)add(x,W);for(let y=W-1;y>=-W+1;y--)add(-A,y);
      for(let x=-A+1;x<=-W-1;x++)add(x,-W);for(let y=-W-1;y>=-A+1;y--)add(-W,y);
      let mn=Infinity,mx=-Infinity,mny=Infinity,mxy=-Infinity;
      pts.forEach(([gx,gy])=>{mn=Math.min(mn,gx*s);mx=Math.max(mx,gx*s);mny=Math.min(mny,gy*s);mxy=Math.max(mxy,gy*s);});
      const ox=(1040-(mx-mn+cl))/2-mn,oy=(1040-(mxy-mny+cl))/2-mny;
      const p=pts.map(([gx,gy])=>[Math.round(gx*s+ox),Math.round(gy*s+oy)]);
      return {paths:{1:[...p],2:[...p]},n:2,st:{1:0,2:Math.floor(p.length/2)},end:p.length-1,cs:84};
    },
    four:()=>{
      const CX=520,CY=520,SX=96,SY=78;
      const p=[];let x=CX-380,y=CY-380,s=8,d=0,r=1,t=0;
      const dx=[SX,0,-SX,0],dy=[0,SY,0,-SY];
      for(let i=0;i<8;i++){p.push([Math.round(x),Math.round(y)]);x+=dx[0];}
      x-=dx[0];d=1;s=7;r=s;
      while(p.length<60){x+=dx[d];y+=dy[d];p.push([Math.round(x),Math.round(y)]);r--;if(r<=0){d=(d+1)%4;t++;if(t%2===0)s--;if(s<1)s=1;r=s;}}
      const sg=Math.floor(p.length/4);
      return {paths:{1:[...p],2:[...p],3:[...p],4:[...p]},n:4,st:{1:0,2:sg,3:sg*2,4:sg*3},end:p.length-1,cs:84};
    },
    swastika:()=>{
      const A=8,W=3,S=52,CL=40;
      const segs=[{sx:A,sy:-W,ex:A,ey:W},{sx:A,sy:W,ex:0,ey:W},{sx:0,sy:W,ex:0,ey:0},{sx:W,sy:A,ex:-W,ey:A},{sx:-W,sy:A,ex:-W,ey:0},{sx:-W,sy:0,ex:0,ey:0},{sx:-A,sy:W,ex:-A,ey:-W},{sx:-A,sy:-W,ex:0,ey:-W},{sx:0,sy:-W,ex:0,ey:0},{sx:-W,sy:-A,ex:W,ey:-A},{sx:W,sy:-A,ex:W,ey:0},{sx:W,sy:0,ex:0,ey:0}];
      const ps={};
      for(let p=1;p<=4;p++){const pt=[];const st=(p-1)*3;for(let s=st;s<st+3;s++){const{sx,sy,ex,ey}=segs[s];if(sx===ex){const stp=sy<ey?1:-1;for(let y=sy;y!==ey+stp;y+=stp)pt.push([sx,y]);}else{const stp=sx<ex?1:-1;for(let x=sx;x!==ex+stp;x+=stp)pt.push([x,ey]);}}const u=[pt[0]];for(let i=1;i<pt.length;i++)if(pt[i][0]!==pt[i-1][0]||pt[i][1]!==pt[i-1][1])u.push(pt[i]);ps[p]=u;}
      let all=[];for(let p=1;p<=4;p++)all=all.concat(ps[p]);
      let mn=Infinity,mx=-Infinity,mny=Infinity,mxy=-Infinity;
      all.forEach(([gx,gy])=>{mn=Math.min(mn,gx*S);mx=Math.max(mx,gx*S);mny=Math.min(mny,gy*S);mxy=Math.max(mxy,gy*S);});
      const ox=(1040-(mx-mn+CL))/2-mn,oy=(1040-(mxy-mny+CL))/2-mny;
      for(let p=1;p<=4;p++)ps[p]=ps[p].map(([gx,gy])=>[Math.round(gx*S+ox),Math.round(gy*S+oy)]);
      const sg=Math.floor(Object.values(ps)[0].length/4);
      return {paths:ps,n:4,st:{1:0,2:sg,3:sg*2,4:sg*3},end:Object.values(ps)[0].length-1,cs:40};
    }
  };
  return (gens[mode]||gens.swastika)();
}

// ===== 网络连接 =====
let cp=null;
function connect(){
  if(socket&&socket.connected)return Promise.resolve();
  if(cp)return cp;
  cp=new Promise(r=>{
    if(socket)socket.removeAllListeners();
    socket=io();
    socket.on('connect',()=>{log('已连接');r();cp=null;});
    socket.on('roomUpdate',(d)=>{players=d.players||d;updLobby(d.numPlayers);});
    socket.on('gameStart',(d)=>{
      players=d.players;game=d.game;
      const me=players.find(p=>p.id===socket.id);myIdx=me?me.idx:-1;
      const cnt=players.length;
      const mode=(cnt<=2)?'double':(cnt<=3)?'four':'swastika';
      const gd=genPaths(mode);paths=gd.paths;cellSize=gd.cs;
      if(game&&gd.st){game.players.forEach((p,i)=>{p.pos=gd.st[i+1]||0;});}
      isMyTurn=(myIdx===0);
      // 从服务器获取房间设置
      socket.emit('getSettings',(s)=>{
        if(s.cellEffects)cellEffects=s.cellEffects;
        if(s.cellPopups)cellPopups=s.cellPopups;
        if(s.pieceIcons)pieceIcons=s.pieceIcons;
        if(s.pieceImages)pieceImages=s.pieceImages;
        // 重新应用棋子图标到所有棋子
        for(let pp=1;pp<=Object.keys(paths).length;pp++)updPiece(pp);
        // 刷新格子显示
        for(const k in cellEffects){const [pp,idx]=k.split('-');if(pp&&idx!==undefined)updCellDisplay(parseInt(pp),parseInt(idx));}
      });
      document.getElementById('lobby').style.display='none';
      document.getElementById('gameArea').style.display='block';
      document.getElementById('roomCodeDisplay').textContent=roomId;
      initBoard();updUI();
    });
    socket.on('diceRolled',(d)=>{
      game=d.game;const val=d.value;
      const pd=game.players[d.player];const end=Object.values(paths)[0].length-1;
      const from=pd.pos;let to=from+val;
      if(to>end){to=end-(to-end);if(to<0)to=0;}
      document.getElementById('diceDisplay').textContent=val;
      const de=document.getElementById('boardDice');
      de.style.transform='scale(1.2) rotate(15deg)';setTimeout(()=>de.style.transform='scale(1) rotate(0deg)',300);
      const isR=(d.player===myIdx);
      animMove(d.player+1,from,to,()=>{if(isR)socket.emit('moveDone',{player:d.player,targetPos:to});});
      updUI();
    });
    socket.on('playerCrash',({crashed,by})=>{
      log(`💥 ${EMOJIS[by]}撞飞了${EMOJIS[crashed]}！`);
      const el=document.getElementById('piece'+(crashed+1));
      if(el){el.style.transform='scale(0.5)';setTimeout(()=>el.style.transform='scale(1)',300);}
      updPieces();
    });
    socket.on('turnChange',(d)=>{game=d.game;isMyTurn=(d.cur===myIdx);updUI();if(!game?.over)log(`轮到 ${EMOJIS[d.cur]}${players[d.cur]?.name||''}`);});
    socket.on('gameOver',({winner,name})=>{game.over=true;document.getElementById('turnIndicator').innerHTML=`🎉 ${EMOJIS[winner]}${name} 获胜！🎉`;setTimeout(()=>alert(`🎉 ${EMOJIS[winner]}${name} 获胜！🎉`),500);});
    socket.on('cellSettingUpdate',({key,effect,popup})=>{
      if(effect)cellEffects[key]=effect;else delete cellEffects[key];
      if(popup)cellPopups[key]=popup;else delete cellPopups[key];
      const [p,idx]=key.split('-');
      if(p&&idx!==undefined)updCellDisplay(parseInt(p),parseInt(idx));
    });
    socket.on('pieceSettingUpdate',({player,icon,image})=>{
      if(icon)pieceIcons[player]=icon;
      if(image!==undefined)pieceImages[player]=image;
      updPiece(player);
    });
    socket.on('playerLeft',()=>log('有玩家离开'));
    socket.on('disconnect',()=>{log('断开连接');cp=null;});
  });
  return cp;
}

async function createRoom(){
  const name=document.getElementById('pName').value||'玩家';
  await connect();
  socket.emit('createRoom',{name,mode:'cross'},(res)=>{
    if(!res.ok)return alert(res.err);
    roomId=res.id;
    document.getElementById('createBtn').style.display='none';
    document.getElementById('joinBtn').style.display='none';
    document.getElementById('roomInfo').style.display='block';
    document.getElementById('startBtn').style.display='inline-block';
    document.getElementById('roomCode').textContent=roomId;
  });
}
async function joinRoom(){
  const name=document.getElementById('pName').value||'玩家';
  const code=document.getElementById('jCode').value.toUpperCase();
  if(!code)return alert('输入房间码');
  await connect();
  socket.emit('joinRoom',{id:code,name},(res)=>{
    if(!res.ok)return alert(res.err);
    roomId=res.id;
    document.getElementById('createBtn').style.display='none';
    document.getElementById('joinBtn').style.display='none';
    document.getElementById('roomInfo').style.display='block';
    document.getElementById('startBtn').style.display='none';
    document.getElementById('roomCode').textContent=roomId;
  });
}
function startGame(){socket.emit('startGame',(res)=>{if(!res.ok)alert(res.err);});}
function updLobby(np){
  const list=document.getElementById('playerList');list.innerHTML='';
  players.forEach(p=>{const li=document.createElement('li');li.textContent=`${p.color||'⚪'} ${p.name}`;if(p.id===socket.id)li.textContent+=' (你)';list.appendChild(li);});
  document.getElementById('roomCode').textContent=roomId;
}

// ===== 棋盘 =====
function initBoard(){
  const board=document.getElementById('gameBoard');board.innerHTML='';
  board.style.cssText=`width:1040px;height:1040px;background:#2d2d2d;position:relative;overflow:hidden;`;
  const fp=Object.values(paths)[0],ep={x:fp[fp.length-1][0],y:fp[fp.length-1][1]};
  // 光晕
  const g=document.createElement('div');g.style.cssText=`position:absolute;left:${ep.x-30}px;top:${ep.y-30}px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,0.4),transparent);z-index:0;pointer-events:none;`;board.appendChild(g);
  // SVG连线
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1040 1040');svg.setAttribute('width','1040');svg.setAttribute('height','1040');svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
  for(let p=1;p<=Object.keys(paths).length;p++){const pt=paths[p];if(!pt)continue;for(let i=0;i<pt.length-1;i++){const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',pt[i][0]+cellSize/2);l.setAttribute('y1',pt[i][1]+cellSize/2);l.setAttribute('x2',pt[i+1][0]+cellSize/2);l.setAttribute('y2',pt[i+1][1]+cellSize/2);l.setAttribute('stroke',COLORS[p-1]);l.setAttribute('stroke-width','3');l.setAttribute('stroke-linecap','round');l.setAttribute('opacity','0.6');svg.appendChild(l);}}
  board.appendChild(svg);
  // 格子
  for(let p=1;p<=Object.keys(paths).length;p++){const pt=paths[p];if(!pt)continue;pt.forEach((pos,i)=>{
    const c=document.createElement('div');c.className='game-cell';c.dataset.player=p;c.dataset.idx=i;
    c.style.cssText=`position:absolute;left:${pos[0]}px;top:${pos[1]}px;width:${cellSize}px;height:${cellSize}px;border:2px solid ${BORDERS[p-1]};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7em;background:linear-gradient(145deg,#fff,#f0f0f0);z-index:2;box-shadow:1px 2px 4px rgba(0,0,0,0.15);cursor:pointer;`;
    if(p===1&&i===pt.length-1){c.style.width='60px';c.style.height='60px';c.style.background='linear-gradient(135deg,#ffd700,#ffaa00)';c.style.border='4px solid #ff6600';c.style.boxShadow='0 0 30px rgba(255,215,0,0.6)';c.style.fontSize='1.2em';c.style.fontWeight='bold';c.style.zIndex='5';c.innerHTML='🏆';}
    else if(i===0){c.style.background=COLORS[p-1];c.style.color='white';c.style.fontWeight='bold';c.style.fontSize='0.9em';c.innerHTML=EMOJIS[p-1]+'起';}
    else{c.innerHTML=`<span style="color:#999">${i}</span>`;}
    // 格子编辑点击
    c.addEventListener('click',(e)=>{e.stopPropagation();openEditor(p,i);});
    // 显示已保存的文字效果
    const key=p+'-'+i;
    if(cellEffects[key]||cellPopups[key])updCellDisplay(p,i);
    board.appendChild(c);
  });}
  // 骰子
  const d=document.createElement('div');d.id='boardDice';
  d.style.cssText=`position:absolute;left:${1040-110}px;top:${1040-110}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#e8e8e8);border:3px solid #555;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 6px 25px rgba(0,0,0,0.3);z-index:30;cursor:pointer;user-select:none;`;
  d.innerHTML='<span id="diceDisplay">?</span>';
  d.addEventListener('click',()=>{if(isMyTurn&&!game?.rolling&&!game?.over&&!isAnimating){socket.emit('rollDice');}});
  board.appendChild(d);
  // 棋子
  document.querySelectorAll('.piece').forEach(el=>el.remove());
  for(let p=1;p<=Object.keys(paths).length;p++){
    const el=document.createElement('div');el.id='piece'+p;el.className='piece';
    el.style.cssText=`position:absolute;width:30px;height:30px;background:rgba(255,255,255,0.9);border:3px solid ${BORDERS[p-1]};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:15;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:16px;`;
    el.innerHTML=pieceImages[p]?`<img src="${pieceImages[p]}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`:pieceIcons[p]||EMOJIS[p-1];
    el.style.display='none';document.getElementById('gameBoard').appendChild(el);
  }
  updPieces();
}

let isAnimating=false;
function placePiece(player,idx){
  const el=document.getElementById('piece'+player);if(!el)return;
  const pt=paths[player];if(!pt||idx<0||idx>=pt.length)return;
  const pos=pt[idx];if(!pos)return;
  const off=Math.round((cellSize-30)/2);
  el.style.left=(pos[0]+off)+'px';el.style.top=(pos[1]+off)+'px';el.style.display='flex';
}
function updPieces(){if(!game)return;for(let p=0;p<Object.keys(paths).length;p++){const pd=game.players[p];if(pd)placePiece(p+1,pd.pos);}}
function animMove(player,from,to,cb){
  const el=document.getElementById('piece'+player);if(!el)return cb?.();
  const pt=paths[player];if(!pt)return cb?.();
  const sc=pt[from],ec=pt[to];if(!sc||!ec)return cb?.();
  const off=Math.round((cellSize-30)/2);
  const sx=sc[0]+off,sy=sc[1]+off,ex=ec[0]+off,ey=ec[1]+off;
  const dur=500,start=performance.now();
  function a(t){const p=Math.min((t-start)/dur,1),e=1-Math.pow(1-p,3),arc=Math.sin(p*Math.PI)*45;el.style.left=(sx+(ex-sx)*e)+'px';el.style.top=(sy+(ey-sy)*e-arc)+'px';if(p<1)requestAnimationFrame(a);else{el.style.left=ex+'px';el.style.top=ey+'px';cb?.();}}
  requestAnimationFrame(a);
}

// ===== 格子编辑器（game1-5完整功能）=====
let editingCell=null;
function openEditor(player,idx){
  const key=player+'-'+idx;
  document.getElementById('cellEditor').style.display='block';
  document.getElementById('cellOverlay').style.display='block';
  document.getElementById('cellIndex').textContent=`P${player} 第${idx}格`;
  // 加载当前设置
  const eff=cellEffects[key];
  if(eff){
    document.querySelector(`[name="celEff"][value="${eff.type}"]`).checked=true;
    document.getElementById('celCustomText').value=eff.customText||'';
    document.getElementById('celFwd').value=eff.steps||1;
    document.getElementById('celBwd').value=eff.steps||1;
  } else {
    document.querySelector('[name="celEff"][value="none"]').checked=true;
    document.getElementById('celCustomText').value='';
  }
  document.getElementById('celPopup').value=cellPopups[key]||'';
  editingCell=key;
}
function closeEditor(){
  document.getElementById('cellEditor').style.display='none';
  document.getElementById('cellOverlay').style.display='none';
  editingCell=null;
}
function saveCell(){
  if(!editingCell)return;
  const type=document.querySelector('[name="celEff"]:checked').value;
  const txt=document.getElementById('celCustomText').value.trim();
  const pop=document.getElementById('celPopup').value.trim();
  const [p,idx]=editingCell.split('-');
  let effect=null;
  if(type!=='none'||txt){
    effect={type};
    if(txt)effect.customText=txt;
    if(type==='forward')effect.steps=parseInt(document.getElementById('celFwd').value)||1;
    if(type==='backward')effect.steps=parseInt(document.getElementById('celBwd').value)||1;
    if(type==='none'&&!txt)effect=null;
  }
  // 发送到服务器，同步所有人
  socket.emit('saveCellSetting',{key:editingCell,effect,popup:pop||null});
  // 同时本地更新
  if(effect)cellEffects[editingCell]=effect;else delete cellEffects[editingCell];
  if(pop)cellPopups[editingCell]=pop;else delete cellPopups[editingCell];
  updCellDisplay(parseInt(p),parseInt(idx));
  closeEditor();
}
function updCellDisplay(p,idx){
  const key=p+'-'+idx;
  const cell=document.querySelector(`.game-cell[data-player="${p}"][data-idx="${idx}"]`);
  if(!cell)return;
  cell.querySelector('.cel-eff')?.remove();cell.querySelector('.cel-txt')?.remove();
  const eff=cellEffects[key];const pop=cellPopups[key];
  if(eff&&eff.customText){
    const d=document.createElement('div');d.className='cel-txt';
    d.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:0.65em;color:#333;font-weight:bold;width:90%;text-align:center;';
    d.textContent=eff.customText;cell.appendChild(d);
  }
  if(eff&&eff.type!=='none'){
    const d=document.createElement('div');d.className='cel-eff';
    d.style.cssText='position:absolute;bottom:1px;right:1px;font-size:0.6em;padding:1px 3px;border-radius:2px;color:#fff;font-weight:bold;';
    d.style.background=eff.type==='forward'?'#4caf50':eff.type==='backward'?'#ff5722':'#9c27b0';
    d.textContent=eff.type==='forward'?'+'+eff.steps:eff.type==='backward'?'-'+eff.steps:'停';
    cell.appendChild(d);
  }
}
function handleCellEffect(p,idx){
  const key=p+'-'+idx;
  const pop=cellPopups[key];
  if(pop)showPopup(pop);
  const eff=cellEffects[key];
  if(!eff||eff.type==='none')return;
  const pd=game.players[p-1];const end=Object.values(paths)[0].length-1;
  if(eff.type==='forward'){pd.pos=Math.min(pd.pos+eff.steps,end);placePiece(p,pd.pos);}
  if(eff.type==='backward'){pd.pos=Math.max(0,pd.pos-eff.steps);placePiece(p,pd.pos);}
}
function showPopup(t){
  const o=document.getElementById('popupOverlay');if(!o)return;
  document.getElementById('popupText').textContent=t;
  o.classList.add('show');setTimeout(()=>o.classList.remove('show'),3000);
}
function closePopup(){document.getElementById('popupOverlay')?.classList.remove('show');}

// ===== UI更新 =====
function updUI(){
  if(!game)return;
  const curName=players[game.cur]?.name||'';
  document.getElementById('turnIndicator').innerHTML=game.over?`🎉 ${EMOJIS[game.winner]}${players[game.winner]?.name} 获胜！`:
    isMyTurn?`🎲 你的回合！点骰子`:`⏳ ${EMOJIS[game.cur]}${curName} 操作中`;
  const panel=document.getElementById('playerPanel');if(!panel)return;
  panel.innerHTML='';
  players.forEach((p,i)=>{
    const d=document.createElement('div');
    d.style.cssText=`padding:4px 10px;margin:2px;border-radius:4px;background:${i===game?.cur?'rgba(255,215,0,0.25)':'rgba(255,255,255,0.08)'};border-left:4px solid ${COLORS[i]||'#999'};color:#fff;font-size:0.8em;display:inline-block;`;
    d.innerHTML=`${EMOJIS[i]}${p.name} <span style="color:#aaa">[${game?.players[i]?.pos||0}]</span>`+(i===myIdx?' <span style="color:#ffd700">←你</span>':'');
    panel.appendChild(d);
  });
  const de=document.getElementById('boardDice');
  if(de)de.style.cursor=(isMyTurn&&!game?.rolling&&!game?.over&&!isAnimating)?'pointer':'not-allowed';
}

function log(msg){
  const el=document.getElementById('log');
  if(el){const d=document.createElement('div');d.textContent='• '+msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}
}

function restartGame(){
  if(!confirm('确定重新开始？'))return;
  socket.emit('startGame');
}

function clearAllData(){
  cellEffects={};cellPopups={};pieceIcons={};pieceImages={};
  // 通知服务器清除
  socket.emit('saveCellSetting',{key:'all',effect:null,popup:null});
  for(let p=1;p<=4;p++)socket.emit('savePieceSetting',{player:p,icon:EMOJIS[p-1],image:null});
  initBoard();log('已清除所有设置');
}

// 棋子自定义
function setupCustom(p){
  const sel=document.getElementById('pIcon'+p);if(!sel)return;
  const file=document.getElementById('pImg'+p);
  sel.addEventListener('change',function(){
    if(this.value==='img'+p){file.style.display='inline-block';file.click();}
    else{file.style.display='none';pieceIcons[p]=this.value;pieceImages[p]=null;updPiece(p);
      socket.emit('savePieceSetting',{player:p,icon:this.value,image:null});}
  });
  file.addEventListener('change',function(){
    const f=this.files[0];if(!f)return;
    const r=new FileReader();r.onload=function(e){
      pieceImages[p]=e.target.result;updPiece(p);
      socket.emit('savePieceSetting',{player:p,icon:null,image:e.target.result});
    };r.readAsDataURL(f);
  });
}
function updPiece(p){
  const el=document.getElementById('piece'+p);if(!el)return;
  el.innerHTML=pieceImages[p]?`<img src="${pieceImages[p]}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">`:pieceIcons[p]||EMOJIS[p-1];
}
// 棋盘背景
document.getElementById('boardBg')?.addEventListener('change',function(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=function(ev){document.getElementById('gameBoard').style.backgroundImage='url('+ev.target.result+')';document.getElementById('gameBoard').style.backgroundSize='cover';};r.readAsDataURL(f);
});

// 初始化
document.getElementById('rollBtn')?.addEventListener('click',()=>{
  if(isMyTurn&&!game?.rolling&&!game?.over&&!isAnimating)socket.emit('rollDice');
});
for(let p=1;p<=4;p++)setupCustom(p);

['saveCell','closeEditor','closePopup','clearBtn','restartBtn'].forEach(id=>{
  const el=document.getElementById(id);
  if(id==='saveCell')el?.addEventListener('click',saveCell);
  else if(id==='closeEditor')el?.addEventListener('click',closeEditor);
  else if(id==='closePopup')el?.addEventListener('click',closePopup);
  else if(id==='clearBtn')el?.addEventListener('click',clearAllData);
  else if(id==='restartBtn')el?.addEventListener('click',restartGame);
});

document.getElementById('cellOverlay')?.addEventListener('click',closeEditor);

// 恢复保存
try{
  const e=localStorage.getItem('ol_eff');if(e)cellEffects=JSON.parse(e);
  const p=localStorage.getItem('ol_pop');if(p)cellPopups=JSON.parse(p);
  const ii=localStorage.getItem('ol_icons');if(ii)pieceIcons=JSON.parse(ii);
  const im=localStorage.getItem('ol_imgs');if(im)pieceImages=JSON.parse(im);
}catch(e){}

updLobby();
