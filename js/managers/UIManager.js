// js/managers/UIManager.js

class UIManager {
    constructor(scene) {
        this.scene = scene;
        this.logContainer = document.getElementById('log-content');
        this.costDisplay = document.getElementById('cost-display');
        this.timelineSlider = document.getElementById('timeline-slider');
        this.timeDisplay = document.getElementById('time-display');
    }

    // ============================================================
    // 📜 로그 시스템
    // ============================================================
    addLog(msg, colorClass = '') {
        if (!this.logContainer) return;

        const entry = document.createElement('div');
        entry.className = `log-entry ${colorClass}`;
        const timeStr = this.scene.battleTime ? this.scene.battleTime.toFixed(1) : "0.0";
        entry.innerText = `[${timeStr}s] ${msg}`;
        
        this.logContainer.insertBefore(entry, this.logContainer.firstChild);

        if (this.logContainer.children.length > 50) {
            this.logContainer.removeChild(this.logContainer.lastChild);
        }
    }

    // ============================================================
    // 📊 상단 바 및 정보 갱신
    // ============================================================
    updateCostUI() {
        if (this.costDisplay) {
            this.costDisplay.innerText = `⚡ Cost: ${this.scene.playerCost} / ${MAX_COST}`;
        }
    }

    updateTimeUI() {
        if (this.timelineSlider) {
            this.timelineSlider.value = this.scene.battleTime * 100;
        }
        if (this.timeDisplay) {
            this.timeDisplay.innerText = this.scene.battleTime.toFixed(1) + "s";
        }
    }

    // ============================================================
    // 🎛️ 컨트롤 패널 (속도, 버튼)
    // ============================================================
    setupSpeedControls() {
        const getBtn = (id) => document.getElementById(id);
        if (!getBtn('btn-pause') || !getBtn('btn-1x') || !getBtn('btn-2x')) return;

        const setSpeed = (speed, clickedId) => {
            this.scene.timeSpeed = speed;
            ['btn-pause', 'btn-1x', 'btn-2x'].forEach(id => {
                const btn = getBtn(id);
                if (btn) btn.classList.remove('active');
            });
            const activeBtn = getBtn(clickedId);
            if (activeBtn) activeBtn.classList.add('active');
        };

        const replaceBtn = (id) => {
            const oldBtn = getBtn(id);
            if(!oldBtn) return null;
            const newBtn = oldBtn.cloneNode(true);
            oldBtn.parentNode.replaceChild(newBtn, oldBtn);
            return newBtn;
        };

        const btnPause = replaceBtn('btn-pause');
        const btn1x = replaceBtn('btn-1x');
        const btn2x = replaceBtn('btn-2x');

        if(btnPause) btnPause.onclick = () => setSpeed(0, 'btn-pause');
        if(btn1x) btn1x.onclick = () => setSpeed(1.0, 'btn-1x');
        if(btn2x) btn2x.onclick = () => setSpeed(2.0, 'btn-2x');
    }

    setupTimelineEvents() {
        const slider = document.getElementById('timeline-slider');
        if (!slider) return;
        
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        this.timelineSlider = newSlider; 
        
        newSlider.addEventListener('input', (e) => {
            if(!this.scene.isPlaying) {
                if (this.timeDisplay) {
                    this.timeDisplay.innerText = (e.target.value/100).toFixed(1)+"s";
                }
                this.scene.updateGhostSimulation();
if (this.scene.cardManager && this.scene.cardManager.updateHandCosts) {
                    this.scene.cardManager.updateHandCosts();
                }
            }
        });
    }

    toggleBattleUI(isBattle) {
        const speedPanel = document.getElementById('speed-panel');
        const goBtn = document.getElementById('btn-turn-end');
        const resetBtn = document.getElementById('btn-reset');
        const btnPause = document.getElementById('btn-pause');
        const btn1x = document.getElementById('btn-1x');
        const btn2x = document.getElementById('btn-2x');
    
        if (speedPanel && goBtn && resetBtn) {
            if (isBattle) {
                speedPanel.style.display = 'flex';
                goBtn.style.display = 'none';
                resetBtn.disabled = true;
                resetBtn.style.opacity = 0.5;
                
                if (btnPause && btn1x && btn2x) {
                    btnPause.classList.remove('active');
                    btn1x.classList.remove('active');
                    btn2x.classList.remove('active');
                    if (this.scene.timeSpeed === 0) btnPause.classList.add('active');
                    else if (this.scene.timeSpeed === 2.0) btn2x.classList.add('active');
                    else btn1x.classList.add('active');
                }
            } else {
                speedPanel.style.display = 'none';
                goBtn.style.display = 'block';
                resetBtn.disabled = false;
                resetBtn.style.opacity = 1;
            }
        }
    }

    // ============================================================
    // 💬 팝업창
    // ============================================================
    showPopup(title, msg, onConfirm, isConfirm = false) {
        const popup = document.getElementById('game-popup');
        const titleEl = document.getElementById('popup-title');
        const msgEl = document.getElementById('popup-message');
        const btnConfirm = document.getElementById('btn-popup-confirm');
        const btnCancel = document.getElementById('btn-popup-cancel');

        if (!popup) return;

        titleEl.innerText = title;
        msgEl.innerText = msg;
        
        btnCancel.style.display = isConfirm ? 'inline-block' : 'none';

        const cleanup = () => {
            popup.style.display = 'none';
            window.removeEventListener('keydown', keyHandler); 
        };

        const keyHandler = (e) => {
            if (popup.style.display === 'none') return;
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault(); 
                cleanup();          
                if (onConfirm) onConfirm(); 
            } else if (e.code === 'Escape') {
                if (isConfirm) {
                    e.preventDefault();
                    cleanup(); 
                }
            }
        };

        window.addEventListener('keydown', keyHandler);

        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);
        
        newConfirm.onclick = () => {
            cleanup();
            if (onConfirm) onConfirm();
        };

        const newCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        newCancel.onclick = () => {
            cleanup();
        };

        popup.style.display = 'flex';
    }

    // ============================================================
    // 🛡️ 유닛 툴팁
    // ============================================================
    showUnitTooltip(unit) {
        const tooltip = document.getElementById('unit-tooltip');
        if (!tooltip) return;

        const stats = unit.stats;
        const hpPercent = Math.floor((unit.currentHp / stats.hp) * 100);
        const traits = stats.traits && stats.traits.length > 0 ? stats.traits.join(', ') : '없음';

        tooltip.innerHTML = `
            <div class="tooltip-header" style="color: ${unit.team === 'ALLY' ? '#00ff00' : '#ff4444'}">
                <b>${unit.name}</b> (${unit.team === 'ALLY' ? '아군' : '적군'})
            </div>
            <hr>
            <div class="tooltip-body">
                <div>❤️ 체력: ${Math.floor(unit.currentHp)} / ${stats.hp} (${hpPercent}%)</div>
                <div>⚔️ 공격력: ${stats.damage} | ⚡ 공속: ${stats.attackSpeed}s</div>
                <div>🎯 킬 수: <span style="color: #ffcc00">${unit.killCount} KILLS</span></div>
                <div style="font-size: 12px; color: #aaa; margin-top: 5px;">✨ 특성: ${traits}</div>
            </div>
        `;

        tooltip.style.display = 'block';
        
        this.scene.input.on('pointermove', (pointer) => {
            tooltip.style.left = (pointer.event.pageX + 15) + 'px';
            tooltip.style.top = (pointer.event.pageY + 15) + 'px';
        });
    }

    hideUnitTooltip() {
        const tooltip = document.getElementById('unit-tooltip');
        if (tooltip) tooltip.style.display = 'none';
        this.scene.input.off('pointermove');
    }


toggleArtifactUI(show) {
        const artifactContainer = document.getElementById('artifact-container');
        if (artifactContainer) {
            // flex 레이아웃을 유지하면서 끄고 켜기
            artifactContainer.style.display = show ? 'flex' : 'none';
        }
    }
}