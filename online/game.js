// 🕉️ 卐字螺旋 · 在线四人版
const CONFIG = { BOARD_SIZE: 1040 };
const NUM_PLAYERS = 4;
const COLORS = ['#ff4444','#4488ff','#44bb44','#ffaa00'];
const BORDERS = ['#cc0000','#0055cc','#008800','#cc8800'];
const COLOR_EMOJI = ['🔴','🔵','🟢','🟡'];

const CELL_SIZE = 40, STEP = 52;
let playerPaths = {1:[],2:[],3:[],4:[]};
let socket = null;
let myIndex = -1; // 自己在房间中的索引
let roomId = '';
let players = [];
let gameState = null;
let isMyTurn = false;

// 路径生成（同game5）
function initPaths() {
    const A=8, W=3, s=STEP;
    const segments = [
        {sx:A, sy:-W, ex:A, ey:W}, {sx:A, sy:W, ex:0, ey:W}, {sx:0, sy:W, ex:0, ey:0},
        {sx:W, sy:A, ex:-W, ey:A}, {sx:-W, sy:A, ex:-W, ey:0}, {sx:-W, sy:0, ex:0, ey:0},
        {sx:-A, sy:W, ex:-A, ey:-W}, {sx:-A, sy:-W, ex:0, ey:-W}, {sx:0, sy:-W, ex:0, ey:0},
        {sx:-W, sy:-A, ex:W, ey:-A}, {sx:W, sy:-A, ex:W, ey:0}, {sx:W, sy:0, ex:0, ey:0}
    ];
    for(let p=1;p<=4;p++){
        const path=[];
        const start=(p-1)*3;
        for(let seg=start;seg<start+3;seg++){
            const {sx,sy,ex,ey}=segments[seg];
            if(sx===ex){const step=sy<ey?1:-1;for(let y=sy;y!==ey+step;y+=step)path.push([sx,y]);}
            else{const step=sx<ex?1:-1;for(let x=sx;x!==ex+step;x+=step)path.push([x,ey]);}
        }
        const unique=[path[0]];
        for(let i=1;i<path.length;i++)if(path[i][0]!==path[i-1][0]||path[i][1]!==path[i-1][1])unique.push(path[i]);
        playerPaths[p]=unique;
    }
    // 居中
    let all=[];for(let p=1;p<=4;p++)all=all.concat(playerPaths[p]);
    let mnX=Infinity,mxX=-Infinity,mnY=Infinity,mxY=-Infinity;
    all.forEach(([gx,gy])=>{mnX=Math.min(mnX,gx*s);mxX=Math.max(mxX,gx*s);mnY=Math.min(mnY,gy*s);mxY=Math.max(mxY,gy*s);});
    const ox=(CONFIG.BOARD_SIZE-(mxX-mnX+CELL_SIZE))/2-mnX;
    const oy=(CONFIG.BOARD_SIZE-(mxY-mnY+CELL_SIZE))/2-mnY;
    for(let p=1;p<=4;p++){playerPaths[p]=playerPaths[p].map(([gx,gy])=>({x:Math.round(gx*s+ox),y:Math.round(gy*s+oy)}));}
}

function initBoard(){
    initPaths();
    const board=document.getElementById('gameBoard');
    board.innerHTML='';
    board.style.background='#2d2d2d';
    board.style.position='relative';
    board.style.width='1040px';board.style.height='1040px';

    // 中心光晕
    const glow=document.createElement('div');
    const endPos=playerPaths[1][playerPaths[1].length-1];
    glow.style.cssText=`position:absolute;left:${endPos.x-30}px;top:${endPos.y-30}px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,0,0.4),transparent);z-index:0;pointer-events:none;`;
    board.appendChild(glow);

    // 连线
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 1040 1040');
    svg.setAttribute('width','1040');svg.setAttribute('height','1040');
    svg.style.cssText='position:absolute;top:0;left:0;pointer-events:none;z-index:0;';
    for(let p=1;p<=4;p++){const path=playerPaths[p];for(let i=0;i<path.length-1;i++){const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',path[i].x+CELL_SIZE/2);l.setAttribute('y1',path[i].y+CELL_SIZE/2);l.setAttribute('x2',path[i+1].x+CELL_SIZE/2);l.setAttribute('y2',path[i+1].y+CELL_SIZE/2);l.setAttribute('stroke',COLORS[p-1]);l.setAttribute('stroke-width','3');l.setAttribute('stroke-linecap','round');l.setAttribute('opacity','0.6');svg.appendChild(l);}}
    board.appendChild(svg);

    // 格子
    for(let p=1;p<=4;p++){const path=playerPaths[p];path.forEach((pos,i)=>{const cell=document.createElement('div');cell.className='cell';cell.style.cssText=`position:absolute;left:${pos.x}px;top:${pos.y}px;width:${CELL_SIZE}px;height:${CELL_SIZE}px;border:2px solid ${BORDERS[p-1]};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7em;background:linear-gradient(145deg,#fff,#f0f0f0);z-index:2;box-shadow:1px 2px 4px rgba(0,0,0,0.15);`;const isEnd=(pos.x===path[path.length-1].x&&pos.y===path[path.length-1].y);if(isEnd&&p===1){cell.style.width='60px';cell.style.height='60px';cell.style.background='linear-gradient(135deg,#ffd700,#ffaa00)';cell.style.border='4px solid #ff6600';cell.style.boxShadow='0 0 30px rgba(255,215,0,0.6)';cell.style.fontSize='1.2em';cell.style.fontWeight='bold';cell.style.zIndex='5';cell.innerHTML='🏆';}else if(i===0){cell.style.background=COLORS[p-1];cell.style.color='white';cell.style.fontWeight='bold';cell.style.fontSize='0.8em';cell.innerHTML=COLOR_EMOJI[p-1]+'起';}else{cell.innerHTML='<span style="color:#999">'+i+'</span>';}
        board.appendChild(cell);});
    }

    // 骰子
    const dice=document.createElement('div');
    dice.id='boardDice';
    dice.style.cssText=`position:absolute;left:${CONFIG.BOARD_SIZE-110}px;top:${CONFIG.BOARD_SIZE-110}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#e8e8e8);border:3px solid #555;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 6px 25px rgba(0,0,0,0.3);z-index:30;cursor:pointer;user-select:none;`;
    dice.innerHTML='<span id="diceDisplay">?</span>';
    dice.addEventListener('click',()=>{if(isMyTurn&&!gameState?.isRolling){socket.emit('rollDice');}});
    board.appendChild(dice);

    // 创建棋子
    document.querySelectorAll('.piece').forEach(el=>el.remove());
    for(let p=1;p<=4;p++){
        const el=document.createElement('div');
        el.id='piece'+p;el.className='piece';
        el.style.cssText=`position:absolute;width:30px;height:30px;background:rgba(255,255,255,0.9);border:3px solid ${BORDERS[p-1]};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:15;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:16px;`;
        el.innerHTML=COLOR_EMOJI[p-1];el.style.display='none';
        document.getElementById('gameBoard').appendChild(el);
    }
    updatePieces();
}

function placePiece(player,idx){
    const el=document.getElementById('piece'+player);if(!el)return;
    const path=playerPaths[player];if(!path||idx<0||idx>=path.length)return;
    const pos=path[idx];if(!pos)return;
    const off=Math.round((CELL_SIZE-30)/2);
    el.style.left=(pos.x+off)+'px';el.style.top=(pos.y+off)+'px';el.style.display='flex';
}

function updatePieces(){
    if(!gameState)return;
    for(let p=1;p<=4;p++){const pd=gameState.players[p-1];if(pd)placePiece(p,pd.pos);}
}

function animateMove(player,fromPos,toPos,callback){
    const el=document.getElementById('piece'+player);if(!el)return callback?.();
    const path=playerPaths[player];if(!path||fromPos<0||toPos<0)return callback?.();
    const sc=path[fromPos],ec=path[toPos];if(!sc||!ec)return callback?.();
    const off=Math.round((CELL_SIZE-30)/2);
    const sx=sc.x+off,sy=sc.y+off,ex=ec.x+off,ey=ec.y+off;
    const dur=500,start=performance.now();
    function anim(t){const p=Math.min((t-start)/dur,1),e=1-Math.pow(1-p,3);const arc=Math.sin(p*Math.PI)*45;el.style.left=(sx+(ex-sx)*e)+'px';el.style.top=(sy+(ey-sy)*e-arc)+'px';if(p<1)requestAnimationFrame(anim);else{el.style.left=ex+'px';el.style.top=ey+'px';el.style.transform='scale(1.2)';setTimeout(()=>el.style.transform='scale(1)',100);callback?.();}}
    requestAnimationFrame(anim);
}

// ===== WebSocket 连接 =====
function connectToServer(){
    const serverUrl = document.getElementById('serverUrl').value || window.location.origin;
    socket = io(serverUrl);

    socket.on('connect',()=>{
        addLog('已连接到服务器');
    });

    socket.on('roomUpdate',(pl)=>{
        players=pl;
        updateLobby();
    });

    socket.on('gameStart',(data)=>{
        players=data.players;
        gameState=data.gameState;
        const myPlayer=players.find(p=>p.id===socket.id);
        myIndex=myPlayer?myPlayer.index:-1;
        document.getElementById('lobby').style.display='none';
        document.getElementById('gameArea').style.display='block';
        document.getElementById('gameArea').style.display='flex';
        document.getElementById('turnIndicator').textContent='游戏开始！';
        initBoard();
        updateUI();
    });

    socket.on('diceRolled',(data)=>{
        gameState=data.gameState;
        const player=data.player;
        const val=data.value;
        document.getElementById('diceDisplay').textContent=val;
        const dice=document.getElementById('boardDice');
        dice.style.transform='scale(1.2) rotate(15deg)';
        setTimeout(()=>dice.style.transform='scale(1) rotate(0deg)',300);

        const pd=gameState.players[player];
        const prevPos=pd.pos-val;
        const newPos=pd.pos;
        animateMove(player+1,Math.max(0,prevPos),newPos,()=>{
            // 通知服务器移动完成
            socket.emit('moveDone',{
                player: player,
                newPos: newPos,
                gameOver: false
            });
        });
        updateUI();
    });

    socket.on('turnChange',(data)=>{
        gameState=data.gameState;
        isMyTurn=(data.currentPlayer===myIndex);
        updateUI();
    });

    socket.on('gameOver',(data)=>{
        gameState.gameOver=true;
        const winner=data.winner;
        document.getElementById('turnIndicator').textContent=`🎉 ${COLOR_EMOJI[winner]}${data.playerName} 获胜！🎉`;
        setTimeout(()=>alert(`🎉 ${COLOR_EMOJI[winner]}${data.playerName} 获胜！🎉`),500);
    });

    socket.on('playerLeft',()=>{
        addLog('有玩家离开了游戏');
    });

    socket.on('disconnect',()=>{
        addLog('与服务器断开连接');
    });
}

function createRoom(){
    const name=document.getElementById('playerName').value||'玩家';
    connectToServer();
    setTimeout(()=>{
        socket.emit('createRoom',name,(res)=>{
            if(res.success){
                roomId=res.roomId;
                document.getElementById('roomCode').textContent=roomId;
                document.getElementById('createBtn').style.display='none';
                document.getElementById('joinBtn').style.display='none';
                document.getElementById('roomInfo').style.display='block';
                document.getElementById('startGameBtn').style.display='inline-block';
            }
        });
    },500);
}

function joinRoom(){
    const name=document.getElementById('playerName').value||'玩家';
    const code=document.getElementById('joinCode').value.toUpperCase();
    if(!code)return alert('请输入房间码');
    connectToServer();
    setTimeout(()=>{
        socket.emit('joinRoom',{roomId:code,playerName:name},(res)=>{
            if(res.success){
                roomId=res.roomId;
                document.getElementById('createBtn').style.display='none';
                document.getElementById('joinBtn').style.display='none';
                document.getElementById('roomInfo').style.display='block';
                document.getElementById('startGameBtn').style.display='none';
            }else{
                alert(res.error);
            }
        });
    },500);
}

function startGame(){
    socket.emit('startGame',(res)=>{
        if(!res.success)alert(res.error);
    });
}

function updateLobby(){
    const list=document.getElementById('playerList');
    list.innerHTML='';
    players.forEach(p=>{
        const li=document.createElement('li');
        li.textContent=`${p.color||'⚪'} ${p.name}`;
        if(players.indexOf(p)===0)li.textContent+=' (房主)';
        list.appendChild(li);
    });
    document.getElementById('roomCode').textContent=roomId;
}

function updateUI(){
    document.getElementById('turnIndicator').textContent=
        gameState.gameOver?`${COLOR_EMOJI[gameState.winner]} 获胜！`:
        `轮到 ${COLOR_EMOJI[gameState.currentPlayer]} ${players[gameState.currentPlayer]?.name||''}`;

    const cur=document.querySelector('#onlinePlayers');
    if(cur){cur.innerHTML='';players.forEach((p,i)=>{const d=document.createElement('div');d.style.cssText=`padding:8px 15px;margin:5px;border-radius:8px;background:${i===gameState?.currentPlayer?'#ffeb3b66':'#f5f5f5'};border-left:4px solid ${COLORS[i]||'#999'};`;d.innerHTML=`${COLOR_EMOJI[i]} ${p.name} <span style="color:#666;font-size:0.85em">步${gameState?.players[i]?.pos||0}</span>`;cur.appendChild(d);});}

    const btn=document.getElementById('boardDice');
    if(btn)btn.style.cursor=isMyTurn?'pointer':'not-allowed';
    if(isMyTurn&&!gameState?.isRolling&&!gameState?.gameOver){
        document.getElementById('turnIndicator').textContent+=` ← 你的回合，点击骰子！`;
    }
}

function addLog(msg){
    const log=document.getElementById('log');
    if(log){const d=document.createElement('div');d.textContent=msg;log.appendChild(d);log.scrollTop=log.scrollHeight;}
}
