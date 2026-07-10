// 🕉️ 在线飞行棋 - 完整版
const CELL=40, COLORS=['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS=['#cc0000','#0055cc','#008800','#cc8800'];
const EMOJIS=['🔴','🔵','🟢','🟡'];

let socket=null, myIdx=-1, roomId='', players=[], game=null, paths={}, isMyTurn=false;
let diceVal=0, isAnimating=false;

function connect(){
  socket = io();
  socket.on('connect',()=>log('已连接'));
  socket.on('roomUpdate',(pl)=>{players=pl;updateLobby();});
  socket.on('gameStart',(data)=>{
    players=data.players; game=data.game; paths=data.paths;
    const me=players.find(p=>p.id===socket.id); myIdx=me?me.idx:-1;
    document.getElementById('lobby').style.display='none';
    document.getElementById('gameArea').style.display='block';
    document.getElementById('roomCodeDisplay').textContent=roomId;
    initBoard();
    updateUI();
  });
  socket.on('diceRolled',(data)=>{
    game=data.game; diceVal=data.value;
    const pd=game.players[data.player]; const from=Math.max(0,pd.pos-diceVal);
    document.getElementById('diceDisplay').textContent=diceVal;
    const d=document.getElementById('boardDice');
    d.style.transform='scale(1.2) rotate(15deg)';
    setTimeout(()=>d.style.transform='scale(1) rotate(0deg)',300);
    isAnimating=true;
    animateMove(data.player+1, from, pd.pos, ()=>{
      isAnimating=false;
      socket.emit('moveDone',{player:data.player, targetPos:pd.pos});
    });
    updateUI();
  });
  socket.on('playerCrash',({crashed,by})=>{
    const el=document.getElementById('piece'+(crashed+1));
    if(el){el.style.transform='scale(0.5)';setTimeout(()=>{el.style.transform='scale(1)';},300);}
    log(`💥 ${EMOJIS[by]}撞飞了${EMOJIS[crashed]}！`);
    updatePieces();
  });
  socket.on('turnChange',(data)=>{
    game=data.game; isMyTurn=(data.cur===myIdx); updateUI();
  });
  socket.on('gameOver',({winner,name})=>{
    game.over=true; isAnimating=false;
    document.getElementById('turnIndicator').innerHTML=`🎉 ${EMOJIS[winner]}${name} 获胜！🎉`;
    setTimeout(()=>alert(`🎉 ${EMOJIS[winner]}${name} 获胜！🎉`),500);
  });
  socket.on('playerLeft',()=>log('有玩家离开'));
  socket.on('disconnect',()=>log('连接断开'));
}

function createRoom(){
  const name=document.getElementById('pName').value||'玩家';
  connect();
  setTimeout(()=>socket.emit('createRoom',name,(res)=>{
    if(!res.ok) return alert(res.err);
    roomId=res.id;
    document.getElementById('createBtn').style.display='none';
    document.getElementById('joinBtn').style.display='none';
    document.getElementById('roomInfo').style.display='block';
    document.getElementById('startBtn').style.display='inline-block';
    document.getElementById('roomCode').textContent=roomId;
  }),300);
}

function joinRoom(){
  const name=document.getElementById('pName').value||'玩家';
  const code=document.getElementById('jCode').value.toUpperCase();
  if(!code) return alert('输入房间码');
  connect();
  setTimeout(()=>socket.emit('joinRoom',{id:code,name},(res)=>{
    if(!res.ok) return alert(res.err);
    roomId=res.id;
    document.getElementById('createBtn').style.display='none';
    document.getElementById('joinBtn').style.display='none';
    document.getElementById('roomInfo').style.display='block';
    document.getElementById('startBtn').style.display='none';
    document.getElementById('roomCode').textContent=roomId;
  }),300);
}

function startGame(){socket.emit('startGame',(res)=>{if(!res.ok)alert(res.err);});}

function updateLobby(){
  const list=document.getElementById('playerList');
  list.innerHTML='';
  players.forEach(p=>{
    const li=document.createElement('li');
    li.textContent=`${p.color||'⚪'} ${p.name}`;
    if(p.id===socket.id) li.textContent+=' (你)';
    list.appendChild(li);
  });
  document.getElementById('roomCode').textContent=roomId;
}

// ===== 棋盘 =====
function initBoard(){
  const board=document.getElementById('gameBoard'); board.innerHTML='';
  board.style.cssText='width:1040px;height:1040px;background:#2d2d2d;position:relative;';

  // 中心光晕
  const ep=paths[1][paths[1].length-1];
  const g=document.createElement('div');
  g.style.cssText=`position:absolute;left:${ep.x-30}px;top:${ep.y-30}px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,0.4),transparent);z-index:0;pointer-events:none;`;
  board.appendChild(g);

  // SVG连线
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 1040 1040');
  svg.setAttribute('width','1040');svg.setAttribute('height','1040');
  svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
  for(let p=1;p<=4;p++){const pt=paths[p];for(let i=0;i<pt.length-1;i++){const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',pt[i].x+CELL/2);l.setAttribute('y1',pt[i].y+CELL/2);l.setAttribute('x2',pt[i+1].x+CELL/2);l.setAttribute('y2',pt[i+1].y+CELL/2);l.setAttribute('stroke',COLORS[p-1]);l.setAttribute('stroke-width','3');l.setAttribute('stroke-linecap','round');l.setAttribute('opacity','0.6');svg.appendChild(l);}}
  board.appendChild(svg);

  // 格子
  for(let p=1;p<=4;p++){const pt=paths[p];pt.forEach((pos,i)=>{
    const c=document.createElement('div');
    c.style.cssText=`position:absolute;left:${pos.x}px;top:${pos.y}px;width:${CELL}px;height:${CELL}px;border:2px solid ${BORDERS[p-1]};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7em;background:linear-gradient(145deg,#fff,#f0f0f0);z-index:2;box-shadow:1px 2px 4px rgba(0,0,0,0.15);`;
    const isEnd=(pos.x===ep.x&&pos.y===ep.y);
    if(isEnd&&p===1){c.style.width='60px';c.style.height='60px';c.style.background='linear-gradient(135deg,#ffd700,#ffaa00)';c.style.border='4px solid #ff6600';c.style.boxShadow='0 0 30px rgba(255,215,0,0.6)';c.style.fontSize='1.2em';c.style.fontWeight='bold';c.style.zIndex='5';c.innerHTML='🏆';}
    else if(i===0){c.style.background=COLORS[p-1];c.style.color='white';c.style.fontWeight='bold';c.style.fontSize='0.8em';c.innerHTML=EMOJIS[p-1]+'起';}
    else{c.innerHTML='<span style="color:#999">'+i+'</span>';}
    board.appendChild(c);
  });}

  // 骰子
  const d=document.createElement('div'); d.id='boardDice';
  d.style.cssText=`position:absolute;left:${1040-110}px;top:${1040-110}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#e8e8e8);border:3px solid #555;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 6px 25px rgba(0,0,0,0.3);z-index:30;cursor:pointer;user-select:none;`;
  d.innerHTML='<span id="diceDisplay">?</span>';
  d.addEventListener('click',()=>{if(isMyTurn&&!game?.rolling&&!game?.over&&!isAnimating){socket.emit('rollDice');}});
  board.appendChild(d);

  // 棋子
  document.querySelectorAll('.piece').forEach(el=>el.remove());
  for(let p=1;p<=4;p++){
    const el=document.createElement('div'); el.id='piece'+p; el.className='piece';
    el.style.cssText=`position:absolute;width:30px;height:30px;background:rgba(255,255,255,0.9);border:3px solid ${BORDERS[p-1]};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:15;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:16px;`;
    el.innerHTML=EMOJIS[p-1]; el.style.display='none';
    document.getElementById('gameBoard').appendChild(el);
  }
  updatePieces();
}

function placePiece(player,idx){
  const el=document.getElementById('piece'+player); if(!el) return;
  const path=paths[player]; if(!path||idx<0||idx>=path.length) return;
  const pos=path[idx]; if(!pos) return;
  const off=Math.round((CELL-30)/2);
  el.style.left=(pos.x+off)+'px'; el.style.top=(pos.y+off)+'px'; el.style.display='flex';
}

function updatePieces(){
  if(!game) return;
  for(let p=0;p<4;p++){const pd=game.players[p]; if(pd) placePiece(p+1,pd.pos);}
}

function animateMove(player,from,to,cb){
  const el=document.getElementById('piece'+player); if(!el) return cb?.();
  const path=paths[player]; if(!path) return cb?.();
  const sc=path[from],ec=path[to]; if(!sc||!ec) return cb?.();
  const off=Math.round((CELL-30)/2);
  const sx=sc.x+off,sy=sc.y+off,ex=ec.x+off,ey=ec.y+off;
  const dur=500,start=performance.now();
  function anim(t){const p=Math.min((t-start)/dur,1),e=1-Math.pow(1-p,3),arc=Math.sin(p*Math.PI)*45;el.style.left=(sx+(ex-sx)*e)+'px';el.style.top=(sy+(ey-sy)*e-arc)+'px';if(p<1)requestAnimationFrame(anim);else{el.style.left=ex+'px';el.style.top=ey+'px';cb?.();}}
  requestAnimationFrame(anim);
}

function updateUI(){
  if(!game) return;
  const curName=players[game.cur]?.name||'';
  document.getElementById('turnIndicator').innerHTML=
    game.over?`🎉 ${EMOJIS[game.winner]}${players[game.winner]?.name} 获胜！`:
    isMyTurn?`🎲 你的回合！点击骰子`:`⏳ 等待 ${EMOJIS[game.cur]}${curName} 操作`;

  // 玩家状态
  const panel=document.getElementById('playerPanel'); if(!panel) return;
  panel.innerHTML='';
  players.forEach((p,i)=>{
    const d=document.createElement('div');
    d.style.cssText=`padding:6px 12px;margin:3px;border-radius:6px;background:${i===game?.cur?'rgba(255,215,0,0.25)':'rgba(255,255,255,0.08)'};border-left:4px solid ${COLORS[i]||'#999'};color:#fff;font-size:0.85em;display:inline-block;`;
    d.innerHTML=`${EMOJIS[i]}${p.name} <span style="color:#aaa">[${game?.players[i]?.pos||0}步]</span>`+
      (i===myIdx?' <span style="color:#ffd700">←你</span>':'');
    panel.appendChild(d);
  });

  // 骰子光标
  const dice=document.getElementById('boardDice');
  if(dice) dice.style.cursor=(isMyTurn&&!game?.rolling&&!game?.over&&!isAnimating)?'pointer':'not-allowed';
}

function log(msg){
  const el=document.getElementById('log');
  if(el){const d=document.createElement('div');d.textContent='• '+msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}
}
