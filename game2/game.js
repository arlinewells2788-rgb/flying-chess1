// 游戏配置
const CONFIG = {
    CELL_WIDTH: 84,  // 格子宽84px
    CELL_HEIGHT: 42, // 格子高42px
    BOARD_SIZE: 1040, // 棋盘大小1040px
};

// 游戏状态
let gameState = {
    currentPlayer: 1,
    diceValue: 0,
    isRolling: false,
    gameOver: false,
    players: {
        1: { position: -1, skipTurn: false },
        2: { position: -1, skipTurn: false }
    },
    cellEffects: {},
    cellPopups: {},
    pieceIcon1: '👠',
    pieceIcon2: '🚗',
    pieceImage1: null,
    pieceImage2: null
};

// 路径坐标 - 宝塔形状
const gamePath = [];
const playerRunways = {
    1: [] // 玩家1的终点跑道
};

// 回字型棋盘配置（连续方形螺旋）
const TOTAL_CELLS = 60; // 60格（编号0-59，第60格终点在中心）

// 初始化回字型棋盘
function initPaths() {
    gamePath.length = 0;
    playerRunways[1].length = 0;

    const cellW = CONFIG.CELL_WIDTH; // 84px
    const cellH = CONFIG.CELL_HEIGHT; // 42px
    const boardSize = CONFIG.BOARD_SIZE;
    const centerX = boardSize / 2;
    const centerY = boardSize / 2;

    // 方形螺旋：模拟移动方式，每次转向时缩短步数
    // 方向：0=右，1=下，2=左，3=上
    // 从左上角开始，向右走N步，向下走N-1步，向左走N-1步，向上走N-2步...
    // 每次走完两个方向后步数减1

    const startX = centerX - 380;
    const startY = centerY - 380;
    const gapX = 12;  // 水平间隙
    const gapY = 36;  // 垂直间隙（横向的三倍）
    const stepX = cellW + gapX; // 水平步长96
    const stepY = cellH + gapY; // 垂直步长78

    let x = startX;
    let y = startY;
    let step = 8; // 初始步数
    let dir = 0; // 0=右, 1=下, 2=左, 3=上
    let remain = 1;
    let pathIndex = 0;
    let turnCount = 0;

    // 方向向量
    const dx = [stepX, 0, -stepX, 0];
    const dy = [0, stepY, 0, -stepY];

    // 先生成59格（0-58），最后1格（59）手动放在中心
    const generateCount = TOTAL_CELLS;

    // 先走第一行（向右）
    const firstRowSteps = 8;
    for (let i = 0; i < firstRowSteps && pathIndex < generateCount; i++) {
        gamePath.push({
            x: Math.round(x),
            y: Math.round(y),
            type: pathIndex === 0 ? 'player1-start' : 'path',
            number: pathIndex
        });
        x += dx[0];
        pathIndex++;
    }
    x -= dx[0]; // 退回到最后一个格子
    dir = 1; // 改为向下
    step = 7;
    remain = step;

    while (pathIndex < generateCount) {
        x += dx[dir];
        y += dy[dir];

        gamePath.push({
            x: Math.round(x),
            y: Math.round(y),
            type: 'path',
            number: pathIndex
        });
        pathIndex++;
        remain--;

        if (remain <= 0) {
            dir = (dir + 1) % 4;
            turnCount++;
            if (turnCount % 2 === 0) step--;
            if (step < 1) step = 1;
            remain = step;
        }
    }

    // 计算回字形的正中心（所有路径格子的平均位置）
    let sumX = 0, sumY = 0, count = 0;
    for (const p of gamePath) {
        sumX += p.x + cellW / 2;
        sumY += p.y + cellH / 2;
        count++;
    }
    window.spiralCenterX = Math.round(sumX / count);
    window.spiralCenterY = Math.round(sumY / count);

    // 第60格就是螺旋最后一格，标记为终点
    if (gamePath.length > 0) {
        const last = gamePath[gamePath.length - 1];
        last.type = 'center';
        last.number = 59;
    }

    playerRunways[1] = [];
}

// 创建棋盘
function initBoard() {
    initPaths();

    const board = document.getElementById('board');
    board.innerHTML = '';

    // 先绘制连线（在格子下面，避免遮挡）
    drawConnections();

    // 创建路径格子
    for (let i = 0; i < gamePath.length; i++) {
        const pos = gamePath[i];
        const cell = document.createElement('div');
        cell.className = `cell ${pos.type}`;
        cell.dataset.index = i;
        cell.dataset.number = pos.number; // 保存实际编号
        cell.style.left = pos.x + 'px';
        cell.style.top = pos.y + 'px';

                // 终点格子特殊显示
        if (pos.type === 'center') {
            cell.style.width = '100px';
            cell.style.height = '60px';
            cell.innerHTML = `<span class="cell-number" style="font-size:1.2em">终点</span>`;
        } else {
            cell.innerHTML = `<span class="cell-number">${pos.number}</span>`;
        }

        cell.addEventListener('click', () => openCellEditor(i));
        board.appendChild(cell);
    }

    // 在回字中心放置骰子（简约风格）
    const diceEl = document.createElement('div');
    diceEl.id = 'boardDice';
    diceEl.style.cssText = `position:absolute;left:${window.spiralCenterX - 40}px;top:${window.spiralCenterY - 40}px;width:80px;height:80px;background:linear-gradient(145deg,#fff,#f0f0f0);border:3px solid #444;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:2.5em;font-weight:bold;color:#333;box-shadow:0 4px 15px rgba(0,0,0,0.2),inset 0 2px 5px rgba(255,255,255,0.5);z-index:20;cursor:pointer;transition:all 0.3s;user-select:none;`;
    diceEl.innerHTML = '<span id="diceDisplay">?</span>';
    diceEl.addEventListener('click', rollDice);
    diceEl.addEventListener('mouseenter', () => { diceEl.style.transform = 'scale(1.1)'; diceEl.style.boxShadow = '0 6px 25px rgba(0,0,0,0.3)'; });
    diceEl.addEventListener('mouseleave', () => { diceEl.style.transform = 'scale(1)'; diceEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)'; });
    board.appendChild(diceEl);

    // 创建棋子
    createPieces();
    placePiece(1, -1);
    placePiece(2, -1);
}

// 绘制格子之间的连线（思维导图风格）
function drawConnections() {
    const board = document.getElementById('board');

    // 创建SVG
    let svg = board.querySelector('.connection-lines');
    if (svg) svg.remove();

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'connection-lines');
    svg.setAttribute('viewBox', '0 0 1040 1040');
    svg.setAttribute('width', '1040');
    svg.setAttribute('height', '1040');
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:0;';

    const cellW = CONFIG.CELL_WIDTH;
    const cellH = CONFIG.CELL_HEIGHT;

    // 在相邻格子之间画线
    for (let i = 0; i < gamePath.length - 1; i++) {
        const curr = gamePath[i];
        const next = gamePath[i + 1];

        // 两个格子的中心坐标
        const x1 = curr.x + cellW / 2;
        const y1 = curr.y + cellH / 2;
        const x2 = next.x + cellW / 2;
        const y2 = next.y + cellH / 2;

        // 渐变色：从起点红色渐变到终点金色
        const ratio = i / (gamePath.length - 1);
        const r = Math.round(255 - ratio * 200);
        const g = Math.round(150 + ratio * 100);
        const b = Math.round(150 - ratio * 100);
        const color = `rgb(${r},${g},${b})`;

        // 线条透明度逐渐增加
        const opacity = 0.4 + ratio * 0.5;

        // 画线
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', opacity);
        svg.appendChild(line);
    }

    board.insertBefore(svg, board.firstChild); // 插入到最前面
}

// 创建棋子
function createPieces() {
    document.querySelectorAll('.piece').forEach(p => p.remove());

    [1, 2].forEach(p => {
        const piece = document.createElement('div');
        piece.id = `piece${p}`;
        piece.className = 'piece';
        const color = p === 1 ? '#ff4444' : '#4488ff';
        const borderColor = p === 1 ? '#cc0000' : '#0055cc';
        piece.style.cssText = `position:absolute;width:32px;height:32px;background:rgba(255,255,255,0.85);border:2px solid ${borderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:18px;`;
        // 使用自定义图标或图片
        const img = gameState[`pieceImage${p}`];
        if (img) {
            piece.innerHTML = `<img src="${img}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">`;
        } else {
            piece.innerHTML = gameState[`pieceIcon${p}`];
        }
        piece.style.display = 'none';
        document.getElementById('board').appendChild(piece);
    });
}

// 放置棋子到指定位置
function placePiece(player, position) {
    const piece = document.getElementById(`piece${player}`);
    if (!piece) return;

    const cellW = CONFIG.CELL_WIDTH;
    const cellH = CONFIG.CELL_HEIGHT;
    const pieceSize = 32;
    const pieceOffset = player === 2 ? 4 : 0; // 玩家2的棋子微偏移，避免重叠

    let posX, posY;

    if (position === -1 || position === 0) {
        const startPos = gamePath[0];
        posX = startPos.x;
        posY = startPos.y;
    } else if (position > 0 && position < gamePath.length) {
        const pos = gamePath[position];
        if (!pos) return;
        posX = pos.x;
        posY = pos.y;
    } else {
        return;
    }

    const offsetX = Math.round((cellW - pieceSize) / 2) + pieceOffset;
    const offsetY = Math.round((cellH - pieceSize) / 2) + pieceOffset;

    piece.style.left = (posX + offsetX) + 'px';
    piece.style.top = (posY + offsetY) + 'px';
    piece.style.display = 'flex';
}

// 掷骰子
function rollDice() {
    if (gameState.isRolling || gameState.gameOver) return;
    if (document.getElementById('rollBtn').disabled) return; // 防止骰子在切换玩家前被点击

    const player = gameState.currentPlayer;

    if (gameState.players[player].skipTurn) {
        gameState.players[player].skipTurn = false;
        updateMessage(`玩家 ${player} 跳过本轮！`);
        gameState.isRolling = false;
        setTimeout(() => switchPlayer(), 1000);
        return;
    }

    gameState.isRolling = true;
    const diceEl = document.getElementById('boardDice');
    const diceDisplay = document.getElementById('diceDisplay');
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = true;

    let rollCount = 0;
    const rollInterval = setInterval(() => {
        diceDisplay.textContent = Math.floor(Math.random() * 6) + 1;
        diceEl.style.transform = `scale(${1 + Math.random() * 0.3}) rotate(${Math.random() * 20 - 10}deg)`;
        rollCount++;

        if (rollCount >= 10) {
            clearInterval(rollInterval);

            gameState.diceValue = Math.floor(Math.random() * 6) + 1;
            diceDisplay.textContent = gameState.diceValue;
            diceEl.style.transform = 'scale(1) rotate(0deg)';

            updateMessage(`投出 ${gameState.diceValue} 点`);

            // 移动棋子
            setTimeout(() => movePiece(player, gameState.diceValue), 300);
        }
    }, 100);
}

// 移动棋子（跳跃跨越动画）
function movePiece(player, steps) {
    const playerData = gameState.players[player];
    let startPos = playerData.position;
    const pathLength = gamePath.length;

    if (startPos === -1) {
        startPos = 0;
    }

    let targetPos = startPos + steps;
    let isGameOver = false;
    let overshootAmount = 0;

    if (targetPos >= pathLength - 1) {
        overshootAmount = targetPos - (pathLength - 1);
        if (overshootAmount > 0) {
            targetPos = pathLength - 1 - overshootAmount;
            updateMessage(`投出 ${steps} 点，超过终点，回退 ${overshootAmount} 步！`);
        } else if (overshootAmount === 0) {
            targetPos = pathLength - 1;
            isGameOver = true;
        }
    }

    const piece = document.getElementById(`piece${player}`);
    if (!piece) return;

    // 获取起点和终点坐标
    const cellW = CONFIG.CELL_WIDTH;
    const cellH = CONFIG.CELL_HEIGHT;
    const pieceSize = 32;
    const offsetX = Math.round((cellW - pieceSize) / 2);
    const offsetY = Math.round((cellH - pieceSize) / 2);

    const startCell = gamePath[startPos];
    const endCell = gamePath[targetPos];

    const startX = startCell.x + offsetX;
    const startY = startCell.y + offsetY;
    const endX = endCell.x + offsetX;
    const endY = endCell.y + offsetY;

    // 抛物线跳跃动画
    const jumpDuration = 600;
    const jumpHeight = 60;
    const startTime = performance.now();

    function jumpAnimation(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / jumpDuration, 1);

        // 缓出函数（先快后慢）
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const x = startX + (endX - startX) * easeOut;
        // 抛物线高度：中间最高
        const arc = Math.sin(progress * Math.PI) * jumpHeight;
        const y = startY + (endY - startY) * easeOut - arc;

        piece.style.left = x + 'px';
        piece.style.top = y + 'px';

        if (progress < 1) {
            requestAnimationFrame(jumpAnimation);
        } else {
            // 到达终点
            piece.style.left = endX + 'px';
            piece.style.top = endY + 'px';

            // 落地小弹跳
            piece.style.transform = 'scale(1.1)';
            setTimeout(() => {
                piece.style.transform = 'scale(1)';
            }, 100);

            playerData.position = targetPos;

            // 🎯 碰撞检测：如果目标格有对方棋子，对方回到起点
            const otherPlayer = player === 1 ? 2 : 1;
            const otherData = gameState.players[otherPlayer];
            if (otherData.position === targetPos && targetPos > 0 && targetPos < pathLength - 1) {
                otherData.position = -1;
                placePiece(otherPlayer, -1);
                updateMessage(`💥 玩家${player}撞飞了玩家${otherPlayer}！`);
                setTimeout(() => {
                    const statusEl = document.querySelector(`.player${otherPlayer} .player-status`);
                    if (statusEl) statusEl.textContent = '被撞回起点';
                }, 100);
            }

            if (isGameOver) {
                updateMessage(`🎉 精确到达终点！获胜！🎉`);
                setTimeout(() => gameOver(player), 500);
                return;
            }

            setTimeout(() => {
                if (targetPos < pathLength - 1) {
                    handleCellEffect(player, targetPos);
                } else {
                    finishMove();
                }
            }, 400);
        }
    }

    requestAnimationFrame(jumpAnimation);
}

// 处理格子效果
function handleCellEffect(player, position) {
    const effect = gameState.cellEffects[position];
    const popupText = gameState.cellPopups[position];

    // 显示弹窗（如果有弹窗文字）
    if (popupText) {
        showPopup(popupText);
    }

    if (effect) {
        const playerData = gameState.players[player];
        const pathLength = gamePath.length;

        if (effect.customText) {
            // 显示自定义文字
            updateMessage(effect.customText);
        }

        switch (effect.type) {
            case 'forward':
                updateMessage(`踩到奖励格，前进 ${effect.steps} 步！`);
                setTimeout(() => {
                    playerData.position = Math.min(playerData.position + effect.steps, pathLength - 1);
                    placePiece(player, playerData.position);
                    finishMove();
                }, 1000);
                return;

            case 'backward':
                updateMessage(`踩到惩罚格，后退 ${effect.steps} 步！`);
                setTimeout(() => {
                    playerData.position = Math.max(0, playerData.position - effect.steps);
                    placePiece(player, playerData.position);
                    finishMove();
                }, 1000);
                return;

            case 'skip':
                updateMessage(`踩到陷阱格，下一轮跳过！`);
                playerData.skipTurn = true;
                break;
        }
    }

    finishMove();
}

// 显示弹窗
function showPopup(text) {
    const overlay = document.getElementById('popupOverlay');
    const popupTextElement = document.getElementById('popupText');

    popupTextElement.textContent = text;
    overlay.classList.add('show');

    // 3秒后自动关闭
    setTimeout(() => {
        closePopup();
    }, 3000);
}

// 关闭弹窗
function closePopup() {
    const overlay = document.getElementById('popupOverlay');
    overlay.classList.remove('show');
}

// 切换玩家
function switchPlayer() {
    if (gameState.gameOver) return;
    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
    updatePlayerDisplay();
    document.getElementById('rollBtn').disabled = false;
    updateMessage(`轮到玩家 ${gameState.currentPlayer} 掷骰子`);
}

// 完成移动
function finishMove() {
    gameState.isRolling = false;
    setTimeout(() => switchPlayer(), 800);
}

// 更新玩家显示
function updatePlayerDisplay() {
    document.querySelectorAll('.player').forEach(p => p.classList.remove('active'));
    document.querySelector(`.player${gameState.currentPlayer}`).classList.add('active');

    for (let p = 1; p <= 2; p++) {
        const status = document.querySelector(`.player${p} .player-status`);
        if (status) {
            const pos = gameState.players[p].position;
            status.textContent = pos === -1 ? '在基地' : `位置: ${pos}`;
        }
    }
}

// 更新消息
function updateMessage(msg) {
    document.getElementById('gameMessage').textContent = msg;
}

// 游戏结束
function gameOver(winner) {
    gameState.gameOver = true;
    document.getElementById('rollBtn').disabled = true;
    updateMessage(`🎉 玩家 ${winner} 获胜！🎉`);

    setTimeout(() => {
        alert(`🎉 恭喜玩家 ${winner} 获胜！🎉`);
    }, 500);
}

// 格子编辑器
function openCellEditor(index) {
    if (index < 0 || index >= gamePath.length) return;

    const editor = document.getElementById('cellEditor');
    let overlay = document.querySelector('.overlay');
    if (!overlay) {
        overlay = createOverlay();
    }

    const cellNumber = gamePath[index].number;
    document.getElementById('cellNumber').textContent = cellNumber;

    // 加载当前效果
    const effect = gameState.cellEffects[index];
    if (effect) {
        const radio = document.querySelector(`input[name="cellEffect"][value="${effect.type}"]`);
        if (radio) radio.checked = true;
        if (effect.steps) {
            document.getElementById('forwardSteps').value = effect.steps;
            document.getElementById('backwardSteps').value = effect.steps;
        }
        if (effect.customText) {
            document.getElementById('customText').value = effect.customText;
        } else {
            document.getElementById('customText').value = '';
        }
    } else {
        document.querySelector('input[name="cellEffect"][value="none"]').checked = true;
        document.getElementById('customText').value = '';
    }

    // 加载弹窗文字
    const popupText = gameState.cellPopups[index];
    if (popupText) {
        document.getElementById('cellPopupText').value = popupText;
    } else {
        document.getElementById('cellPopupText').value = '';
    }

    overlay.classList.add('show');
    editor.classList.add('show');

    // 保存当前编辑的格子
    editor.dataset.cellIndex = index;
}

// 创建遮罩层
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', closeCellEditor);
    return overlay;
}

// 关闭格子编辑器
function closeCellEditor() {
    const editor = document.getElementById('cellEditor');
    const overlay = document.querySelector('.overlay');

    editor.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
}

// 保存格子效果
function saveCellEffect() {
    const editor = document.getElementById('cellEditor');
    const cellIndex = parseInt(editor.dataset.cellIndex);

    const effectType = document.querySelector('input[name="cellEffect"]:checked').value;
    const customText = document.getElementById('customText').value.trim();
    const popupText = document.getElementById('cellPopupText').value.trim();

    // 保存格子效果
    if (effectType === 'none' && !customText) {
        delete gameState.cellEffects[cellIndex];
    } else {
        const effect = { type: effectType };

        if (customText) {
            effect.customText = customText;
        }

        if (effectType === 'forward') {
            effect.steps = parseInt(document.getElementById('forwardSteps').value);
        } else if (effectType === 'backward') {
            effect.steps = parseInt(document.getElementById('backwardSteps').value);
        }

        gameState.cellEffects[cellIndex] = effect;
    }

    // 保存弹窗文字
    if (popupText) {
        gameState.cellPopups[cellIndex] = popupText;
    } else {
        delete gameState.cellPopups[cellIndex];
    }

    // 保存到localStorage（持久化保存）
    localStorage.setItem('g2_cellEffects', JSON.stringify(gameState.cellEffects));
    localStorage.setItem('g2_cellPopups', JSON.stringify(gameState.cellPopups));

    // 更新格子显示
    updateCellDisplay(cellIndex);
    closeCellEditor();
}

// 更新格子显示
function updateCellDisplay(index) {
    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    if (!cell) return;

    // 移除旧的效果标记和自定义文字
    const oldEffect = cell.querySelector('.cell-effect');
    if (oldEffect) oldEffect.remove();
    const oldCustomText = cell.querySelector('.cell-custom-text');
    if (oldCustomText) oldCustomText.remove();

    // 添加新效果标记
    const effect = gameState.cellEffects[index];
    if (effect) {
        // 显示自定义文字
        if (effect.customText) {
            const textDiv = document.createElement('div');
            textDiv.className = 'cell-custom-text';
            textDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.7em; color: #333; font-weight: bold; width: 90%; text-align: center;';
            textDiv.textContent = effect.customText;
            cell.appendChild(textDiv);

            // 如果有自定义文字，隐藏格子编号
            const cellNumber = cell.querySelector('.cell-number');
            if (cellNumber) cellNumber.style.display = 'none';
        }

        // 显示效果标记
        if (effect.type !== 'none') {
            const effectDiv = document.createElement('div');
            effectDiv.className = `cell-effect ${effect.type}`;

            let text = '';
            if (effect.type === 'forward') text = `+${effect.steps}`;
            else if (effect.type === 'backward') text = `-${effect.steps}`;
            else if (effect.type === 'skip') text = '停';

            effectDiv.textContent = text;
            cell.appendChild(effectDiv);
        }
    } else {
        // 没有效果时恢复格子编号显示
        const cellNumber = cell.querySelector('.cell-number');
        if (cellNumber) cellNumber.style.display = '';
    }
}

// 重新开始游戏
function restartGame() {
    const savedEffects = gameState.cellEffects;
    const savedPopups = gameState.cellPopups;
    const savedPieceIcon1 = gameState.pieceIcon1;
    const savedPieceIcon2 = gameState.pieceIcon2;
    const savedPieceImage1 = gameState.pieceImage1;
    const savedPieceImage2 = gameState.pieceImage2;

    gameState = {
        currentPlayer: 1,
        diceValue: 0,
        isRolling: false,
        gameOver: false,
        players: {
            1: { position: -1, skipTurn: false },
            2: { position: -1, skipTurn: false }
        },
        cellEffects: savedEffects,
        cellPopups: savedPopups,
        pieceIcon1: savedPieceIcon1,
        pieceIcon2: savedPieceIcon2,
        pieceImage1: savedPieceImage1,
        pieceImage2: savedPieceImage2
    };

    // 重置棋子到起点
    document.querySelectorAll('.piece').forEach(p => p.style.display = 'none');
    placePiece(1, -1);
    placePiece(2, -1);

    // 重置骰子
    const rd = document.getElementById('diceDisplay');
    if (rd) rd.textContent = '?';
    document.getElementById('rollBtn').disabled = false;

    // 更新显示
    updatePlayerDisplay();
    updateMessage('点击"掷骰子"开始游戏');
}

// 清除所有保存的数据
function clearAllData() {
    localStorage.removeItem('g2_cellEffects');
    localStorage.removeItem('g2_cellPopups');
    ['g2_Icon1','g2_Icon2','g2_Image1','g2_Image2'].forEach(k => localStorage.removeItem('piece' + k));
    gameState.cellEffects = {};
    gameState.cellPopups = {};
    gameState.pieceIcon1 = '👠';
    gameState.pieceIcon2 = '🚗';
    gameState.pieceImage1 = null;
    gameState.pieceImage2 = null;
    initBoard();
    updateMessage('所有自定义设置已清除！');
}

// 事件监听
document.getElementById('rollBtn').addEventListener('click', rollDice);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('saveCellEffect').addEventListener('click', saveCellEffect);
document.getElementById('closeEditor').addEventListener('click', closeCellEditor);
document.getElementById('closePopup').addEventListener('click', closePopup);
document.getElementById('clearBtn').addEventListener('click', clearAllData);

// 棋盘背景图片自定义
document.getElementById('boardImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const board = document.getElementById('board');
            board.style.backgroundImage = `url(${event.target.result})`;
            board.style.backgroundSize = 'cover';
            board.style.backgroundPosition = 'center';
        };
        reader.readAsDataURL(file);
    }
});

// 棋子自定义（双人版）
function setupPieceCustomization(player) {
    const select = document.getElementById(`pieceIcon${player}`);
    const fileInput = document.getElementById(`pieceImage${player}`);

    select.addEventListener('change', function(e) {
        if (e.target.value === `image${player}`) {
            fileInput.style.display = 'inline-block';
            fileInput.click();
        } else {
            fileInput.style.display = 'none';
            gameState[`pieceIcon${player}`] = e.target.value;
            gameState[`pieceImage${player}`] = null;
            updatePieceIcon(player);
            localStorage.setItem(`pieceIcon${player}`, e.target.value);
            localStorage.removeItem(`pieceImage${player}`);
        }
    });

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                gameState[`pieceImage${player}`] = event.target.result;
                updatePieceIcon(player, 'image');
                localStorage.setItem(`pieceImage${player}`, event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
}

function updatePieceIcon(player, type) {
    const piece = document.getElementById(`piece${player}`);
    if (!piece) return;
    const img = gameState[`pieceImage${player}`];
    if (type === 'image' && img) {
        piece.innerHTML = `<img src="${img}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;">`;
    } else {
        piece.innerHTML = gameState[`pieceIcon${player}`];
    }
}

// 设置两个玩家的自定义
setupPieceCustomization(1);
setupPieceCustomization(2);

// 初始化游戏
initBoard();

// 从localStorage加载保存的数据
const savedEffects = localStorage.getItem('g2_cellEffects');
const savedPopups = localStorage.getItem('g2_cellPopups');

if (savedEffects) {
    gameState.cellEffects = JSON.parse(savedEffects);
    for (let i = 0; i < gamePath.length; i++) {
        updateCellDisplay(i);
    }
}

if (savedPopups) {
    gameState.cellPopups = JSON.parse(savedPopups);
}

updatePlayerDisplay();
updateMessage('点击"掷骰子"开始游戏');