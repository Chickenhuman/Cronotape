class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    create() {
        // [변수 초기화]
        this.currentRound = 1;
        this.playerCost = 10;
        this.isPlaying = false;
        this.battleTime = 0;
        this.timeSpeed = 1.0;
        
        this.myDeck = [];
        this.myHand = [];
        this.myDiscard = [];
        
        this.deployedObjects = [];
        this.enemyWave = [];
        this.activeUnits = [];
        this.activeProjectiles = [];
        this.selectedCardIdx = -1;

        // [그래픽 도구]
        this.graphics = this.add.graphics();
        this.predictionGraphics = this.add.graphics(); 

        // [맵 및 기지 생성]
        this.drawMap();
        this.createBase('ALLY');
        this.createBase('ENEMY');

        // [UI 텍스트]
        this.statusText = this.add.text(10, 10, `Stage ${currentStage} / Round ${this.currentRound}`, { fontSize: '16px', color: '#fff' });

        // HTML UI 패널 보이기
        const uiPanel = document.getElementById('ui-panel');
        if (uiPanel) uiPanel.style.display = 'flex';

        // 로그 창 초기화
        const logContainer = document.getElementById('log-container');
        const logContent = document.getElementById('log-content');
        if (logContainer) {
            logContainer.style.display = 'block';
            logContent.innerHTML = '<div class="log-entry" style="color:yellow">=== 전투 개시 ===</div>';
            
            const btnToggleLog = document.getElementById('btn-toggle-log');
            if (btnToggleLog) {
                const newBtnToggle = btnToggleLog.cloneNode(true);
                btnToggleLog.parentNode.replaceChild(newBtnToggle, btnToggleLog);
                
                newBtnToggle.onclick = () => {
                    if (logContent.style.display === 'none') {
                        logContent.style.display = 'block';
                        newBtnToggle.innerText = '-';
                    } else {
                        logContent.style.display = 'none';
                        newBtnToggle.innerText = '+';
                    }
                };
            }
        }

        // [입력 이벤트: 맵 클릭]
        this.input.on('pointerdown', (pointer) => {
            if (pointer.y > 450 || this.isPlaying) return;
            this.handleMapClick(pointer);
        });

        // [HTML 버튼 이벤트 연결]
        const btnGo = document.getElementById('btn-turn-end');
        const btnReset = document.getElementById('btn-reset');
        
        if (btnGo) {
            const newBtnGo = btnGo.cloneNode(true);
            btnGo.parentNode.replaceChild(newBtnGo, btnGo);
            newBtnGo.addEventListener('click', () => this.startRound());
        }

        if (btnReset) {
            const newBtnReset = btnReset.cloneNode(true);
            btnReset.parentNode.replaceChild(newBtnReset, btnReset);
            newBtnReset.addEventListener('click', () => this.resetAllPlans());
        }
        
        this.setupSpeedControls();
        
        // [게임 시작 설정]
        this.initDeck();
        this.drawCard(5);
        this.updateCostUI();
        this.generateEnemyWave(currentStage);
        
        // 함수 호출
        this.setupTimelineEvents();

        // 씬 시작 시 UI 상태 리셋
        this.toggleBattleUI(false);
    }

    // 로그 출력 함수
    addLog(msg, colorClass = '') {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry ' + colorClass;
        entry.innerText = `[${this.battleTime.toFixed(1)}s] ${msg}`;
        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    update(time, delta) {
        if (!this.isPlaying) return;
        
        const dt = (delta / 1000) * this.timeSpeed;
        this.battleTime += dt;
        
        this.updateUI();

        this.checkSpawns();

        if (this.battleTime >= 10.0) {
            this.endRound();
            return;
        }

        this.activeUnits.forEach(unit => {
            if (unit.active) {
                if (unit.stats.speed > 0) this.updateUnitAI(unit, dt);
                this.updateHpBar(unit);
            }
        });
        this.activeUnits = this.activeUnits.filter(u => u.active);

        this.updateProjectiles(dt);
    }

    // ==========================================
    // [덱 & 핸드 관리]
    // ==========================================
    initDeck() {
        this.myDeck = [...STARTER_DECK];
        this.shuffleDeck(this.myDeck);
        this.myHand = [];
        this.myDiscard = [];
    }

    shuffleDeck(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    drawCard(count) {
        let drew = 0;
        for(let i=0; i<count; i++) {
            if (this.myDeck.length === 0) {
                if (this.myDiscard.length === 0) break;
                this.myDeck = [...this.myDiscard];
                this.myDiscard = [];
                this.shuffleDeck(this.myDeck);
                this.addLog("덱 리필됨", "log-blue");
            }
            if (this.myDeck.length > 0) {
                this.myHand.push(this.myDeck.pop());
                drew++;
            }
        }
        this.renderHand();
    }

    renderHand() {
        const handArea = document.getElementById('hand-area');
        if (!handArea) return;
        handArea.innerHTML = ''; 
        
        this.myHand.forEach((cardStr, index) => {
            const [type, name] = cardStr.split('-');
            const stat = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
            
            let icon = '❓';
            if (name === '검사') icon = '⚔️'; else if (name === '궁수') icon = '🏹';
            else if (name === '힐러') icon = '💖'; else if (name === '방벽') icon = '🧱';
            else if (name === '암살자') icon = '🥷'; else if (name === '화염구') icon = '🔥'; 
            else if (name === '방어막') icon = '🛡️'; else if (name === '얼음') icon = '❄️'; 
            else if (name === '돌멩이') icon = '🪨';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            
            const isSelected = (index === this.selectedCardIdx);
            if (isSelected) cardDiv.classList.add('selected');

            let statsHtml = '';
            if (type === 'Unit') {
                statsHtml = `<div class="card-stats-row"><div class="stat-badge stat-atk">${Math.abs(stat.damage)}</div><div class="stat-badge stat-hp">${stat.hp}</div></div>`;
            }

            let tooltipContent = '';
            const traits = stat.traits || [];
            const traitsHtml = traits.map(t => `<span class="trait-tag">${t}</span>`).join('');

            if (type === 'Unit') {
                tooltipContent = `
                    <div class="tooltip-row"><span>공격력</span> <span class="tooltip-val">${stat.damage}</span></div>
                    <div class="tooltip-row"><span>체력</span> <span class="tooltip-val">${stat.hp}</span></div>
                    <div class="tooltip-row"><span>사거리</span> <span class="tooltip-val">${stat.range}</span></div>
                    <div class="tooltip-row"><span>공격속도</span> <span class="tooltip-val">${stat.attackSpeed}s</span></div>
                    <div class="tooltip-row"><span>이동속도</span> <span class="tooltip-val">${stat.speed}</span></div>
                    ${traits.length > 0 ? `<div style="margin-top:4px;">${traitsHtml}</div>` : ''}
                `;
            } else {
                let desc = "";
                if (stat.damage) desc += `적에게 <span style="color:#ff8888">${stat.damage} 피해</span>. `;
                if (stat.shield) desc += `아군 <span style="color:#8888ff">${stat.shield} 보호막</span>. `;
                if (stat.stun) desc += `적 <span style="color:#88ffff">${stat.stun}초 기절</span>. `;
                tooltipContent = `
                    <div class="tooltip-row"><span>범위</span> <span class="tooltip-val">${stat.radius}</span></div>
                    <div class="tooltip-desc">${desc}</div>
                `;
            }

            const tooltipStyle = isSelected ? 'visibility:visible; opacity:1;' : '';

            cardDiv.innerHTML = `
                <div class="card-cost">${stat.cost}</div>
                <div class="card-img">${icon}</div>
                <div class="card-name">${name}</div>
                <div class="card-traits">${traitsHtml}</div>
                <div class="card-type">${type}</div>
                ${statsHtml}
                <div class="card-tooltip" style="${tooltipStyle}">
                    <div class="tooltip-header">${name} <span style="font-size:10px; color:#aaa;">(${type})</span></div>
                    ${tooltipContent}
                </div>
            `;

            const totalCards = this.myHand.length;
            const centerIndex = (totalCards - 1) / 2;
            const rotateAngle = (index - centerIndex) * 5;
            const translateY = Math.abs(index - centerIndex) * 5;
            
            if (!isSelected) {
                cardDiv.style.transform = `rotate(${rotateAngle}deg) translateY(${translateY}px)`;
            }
            
            cardDiv.onmouseenter = () => { cardDiv.style.transform = ''; };
            cardDiv.onmouseleave = () => { 
                if (index !== this.selectedCardIdx) cardDiv.style.transform = `rotate(${rotateAngle}deg) translateY(${translateY}px)`; 
                else cardDiv.style.transform = ''; 
            };
            
            cardDiv.onclick = (e) => { 
                e.stopPropagation();
                this.selectedCardIdx = index; 
                this.renderHand(); 
            };
            
            cardDiv.oncontextmenu = (e) => {
                e.preventDefault();
                if (confirm(`${name} 카드를 버리시겠습니까?`)) this.discardCardFromHand(index);
            };

            handArea.appendChild(cardDiv);
        });
    }

    discardCardFromHand(index) {
        const card = this.myHand.splice(index, 1)[0];
        this.myDiscard.push(card);
        if (this.selectedCardIdx === index) this.selectedCardIdx = -1;
        if (this.selectedCardIdx > index) this.selectedCardIdx--;
        this.renderHand();
    }

    // ==========================================
    // [라운드 & 전투 제어]
    // ==========================================
    startRound() {
        if (this.isPlaying) return;
        if (this.myHand.length > MAX_HAND) {
            alert(`핸드 초과! (${this.myHand.length}/${MAX_HAND})\n카드를 정리해주세요.`);
            return;
        }
        
        this.isPlaying = true;
        this.battleTime = 0;
        this.statusText.setText(`⚔️ Round ${this.currentRound} 전투 중!`);
        this.toggleBattleUI(true);
        this.addLog(`Round ${this.currentRound} 시작`, "log-blue");
        
        this.deployedObjects.forEach(o => o.spawned = false);
        this.enemyWave.forEach(o => o.spawned = false);
        
        this.selectedCardIdx = -1;
        this.renderHand();
        this.activeProjectiles = []; 
        this.predictionGraphics.clear();
    }

    endRound() {
        this.isPlaying = false;
        this.battleTime = 0;
        this.currentRound++;
        
        this.toggleBattleUI(false);

        let recovered = this.playerCost + RECOVERY_COST;
        if (recovered > MAX_COST) recovered = MAX_COST;
        this.playerCost = recovered;

        this.drawCard(3);
        this.addLog(`라운드 종료. 코스트 회복, 카드 3장 드로우.`);
        
        this.statusText.setText(`Round ${this.currentRound} 준비`);
        
        // ★ [수정] 슬라이더 리셋 시 안전장치
        const slider = document.getElementById('timeline-slider');
        if(slider) slider.value = 0;
        
        const display = document.getElementById('time-display');
        if(display) display.innerText = "0.0s";
        
        this.updateCostUI();
        
        this.deployedObjects = []; 
        this.enemyWave = []; 
        this.generateEnemyWave(currentStage);
        
        this.predictionGraphics.clear();
        this.activeProjectiles.forEach(p => p.destroy());
        this.activeProjectiles = [];
    }

    toggleBattleUI(isBattle) {
        const speedPanel = document.getElementById('speed-panel');
        const goBtn = document.getElementById('btn-turn-end');
        const resetBtn = document.getElementById('btn-reset');

        if (speedPanel && goBtn && resetBtn) {
            if (isBattle) {
                speedPanel.style.display = 'flex';
                goBtn.style.display = 'none';
                resetBtn.disabled = true;
                resetBtn.style.opacity = 0.5;
            } else {
                speedPanel.style.display = 'none';
                goBtn.style.display = 'block';
                resetBtn.disabled = false;
                resetBtn.style.opacity = 1;
                this.timeSpeed = 1.0;
                const btn1x = document.getElementById('btn-1x');
                if(btn1x) btn1x.click();
            }
        }
    }

    handleMapClick(pointer) {
        if (this.selectedCardIdx === -1) return;
        
        const cardNameStr = this.myHand[this.selectedCardIdx];
        const [type, name] = cardNameStr.split('-');
        const stat = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
        
        if (this.playerCost < stat.cost) { alert("코스트 부족!"); return; }

        if (type === 'Unit') {
            const traits = stat.traits || [];
            if (!traits.includes('침투') && pointer.x > DEPLOY_LIMIT) {
                this.showFloatingText(pointer.x, pointer.y, "배치 불가!", '#ff0000');
                return;
            }
        }

        this.playerCost -= stat.cost;
        this.updateCostUI();
        this.discardCardFromHand(this.selectedCardIdx); 

        // ★ [수정] 슬라이더 값 읽을 때 안전장치
        const slider = document.getElementById('timeline-slider');
        let currentTime = 0;
        if (slider) {
            currentTime = (slider.value / 100).toFixed(1);
        }
        
        const marker = this.add.circle(pointer.x, pointer.y, 15, stat.color);
        marker.setAlpha(0.5);
        const text = this.add.text(pointer.x-15, pointer.y-35, `${currentTime}s`, {fontSize:'10px', backgroundColor:'#000'});

        const plan = {
            type: type, name: name, x: pointer.x, y: pointer.y,
            time: parseFloat(currentTime), spawned: false,
            visualMarker: marker, visualText: text
        };
        this.deployedObjects.push(plan);

        marker.setInteractive({ cursor: 'pointer' });
        marker.on('pointerdown', (ptr, localX, localY, event) => {
            if (this.isPlaying || plan.spawned) return;
            if (this.selectedCardIdx !== -1) return; 
            
            this.cancelDeployment(plan);
            if (event) event.stopPropagation();
        });

        this.drawPredictions();
    }

    cancelDeployment(plan) {
        if (this.isPlaying) return; 

        const cardStr = `${plan.type}-${plan.name}`;
        const [type, name] = cardStr.split('-');
        const stat = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
        
        this.playerCost += stat.cost;
        this.updateCostUI();
        this.myHand.push(cardStr);
        this.renderHand();

        if (plan.visualMarker) plan.visualMarker.destroy();
        if (plan.visualText) plan.visualText.destroy();

        const index = this.deployedObjects.indexOf(plan);
        if (index > -1) this.deployedObjects.splice(index, 1);
        
        this.drawPredictions();
    }

    resetAllPlans() {
        if (this.isPlaying) return;
        if (this.deployedObjects.length === 0) return;
        if (!confirm("이번 라운드의 모든 배치를 취소하시겠습니까?")) return;

        for (let i = this.deployedObjects.length - 1; i >= 0; i--) {
            this.cancelDeployment(this.deployedObjects[i]);
        }
        this.drawPredictions();
    }

    checkSpawns() {
        this.deployedObjects.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                if (plan.type === 'Unit') this.spawnUnit(plan.x, plan.y, 'ALLY', plan.name);
                else this.applySkillEffect(plan);
                
                if (plan.visualMarker) plan.visualMarker.destroy();
                if (plan.visualText) plan.visualText.destroy();
                plan.spawned = true;
            }
        });

        this.enemyWave.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                this.spawnUnit(plan.x, plan.y, 'ENEMY', plan.name);
                plan.spawned = true;
            }
        });
    }

    spawnUnit(x, y, team, name) {
        let stats;
        if (team === 'ENEMY') {
            stats = getEnemyStats(name); 
        } else {
            stats = UNIT_STATS[name];
        }
        
        const unit = this.add.circle(x, y, 15, stats.color);
        
        unit.team = team;
        unit.stats = stats;
        unit.currentHp = stats.hp;
        unit.attackCooldown = 0;
        unit.active = true;
        
        unit.traits = stats.traits || [];
        if (unit.traits.includes('은신')) {
            unit.isStealthed = true;
            unit.setAlpha(0.4);
        } else {
            unit.isStealthed = false;
            unit.setAlpha(1.0);
        }

        unit.hpBar = this.add.rectangle(x, y-25, 30, 5, 0x00ff00);
        this.activeUnits.push(unit);
        
        this.addLog(`${name} 소환됨 (${team})`);
        
        return unit;
    }

    updateUnitAI(unit, dt) {
        if(unit.attackCooldown > 0) unit.attackCooldown -= dt;
        
        let target = this.findNearest(unit);
        
        if(target) {
            if(Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y) <= unit.stats.range) {
                if(unit.attackCooldown <= 0) {
                    unit.attackCooldown = unit.stats.attackSpeed;
                    
                    if (unit.isStealthed) {
                        unit.isStealthed = false;
                        unit.setAlpha(1.0);
                        this.showFloatingText(unit.x, unit.y, "은신 해제!", '#ffff00');
                    }

                    if (unit.stats.projectileSpeed > 0) {
                        this.spawnProjectile(unit, target);
                    } else {
                        this.applyDamage(unit, target, unit.stats.damage);
                    }
                }
            } else {
                this.moveTowards(unit, target, dt);
            }
        } else {
            const dir = (unit.team === 'ALLY') ? 1 : -1;
            unit.x += dir * unit.stats.speed * dt;
        }
    }

    findNearest(me) {
        let nearest = null, minDist = 9999;
        this.activeUnits.forEach(o => {
            if(o.active && o.team !== me.team) {
                if (o.isStealthed) return;
                const d = Phaser.Math.Distance.Between(me.x, me.y, o.x, o.y);
                if(d < minDist) { minDist=d; nearest=o; }
            }
        });
        return nearest;
    }

    applySkillEffect(plan) {
        const stats = SKILL_STATS[plan.name];
        this.playSkillAnim(plan);
        this.addLog(`${plan.name} 사용!`, "log-blue");

        setTimeout(() => {
            this.activeUnits.forEach(unit => {
                if(!unit.active) return;
                const dist = Phaser.Math.Distance.Between(plan.x, plan.y, unit.x, unit.y);
                
                if(dist <= stats.radius) {
                    let hit = false;
                    if(plan.name==='화염구' && unit.team==='ENEMY') { 
                        this.applyDamage({scene:this}, unit, stats.damage); hit = true;
                    } else if(plan.name==='돌멩이' && unit.team==='ENEMY') {
                        this.applyDamage({scene:this}, unit, stats.damage); unit.attackCooldown += stats.stun; hit = true;
                    } else if(plan.name==='방어막' && unit.team==='ALLY') { 
                        this.applyDamage({scene:this}, unit, -stats.shield); 
                    } else if(plan.name==='얼음' && unit.team==='ENEMY') {
                        unit.attackCooldown += stats.stun; this.showFloatingText(unit.x, unit.y, "얼음!", '#00ffff');
                    }

                    if (hit && unit.isStealthed) {
                        unit.isStealthed = false; unit.setAlpha(1.0);
                        this.showFloatingText(unit.x, unit.y, "발각됨!", '#ff0000');
                    }
                }
            });
        }, 400);
    }

    spawnProjectile(owner, target) {
        const projectile = this.add.circle(owner.x, owner.y, 4, owner.stats.color);
        projectile.owner = owner;
        projectile.target = target;
        projectile.speed = owner.stats.projectileSpeed;
        projectile.damage = owner.stats.damage;
        projectile.active = true;
        this.activeProjectiles.push(projectile);
    }

    updateProjectiles(dt) {
        this.activeProjectiles.forEach(proj => {
            if (!proj.active) return;
            if (!proj.target.active) {
                proj.destroy();
                proj.active = false;
                return;
            }

            const angle = Phaser.Math.Angle.Between(proj.x, proj.y, proj.target.x, proj.target.y);
            proj.x += Math.cos(angle) * proj.speed * dt;
            proj.y += Math.sin(angle) * proj.speed * dt;

            const dist = Phaser.Math.Distance.Between(proj.x, proj.y, proj.target.x, proj.target.y);
            if (dist < 10) {
                this.applyDamage(proj.owner, proj.target, proj.damage);
                proj.destroy();
                proj.active = false;
            }
        });
        this.activeProjectiles = this.activeProjectiles.filter(p => p.active);
    }

    applyDamage(attacker, target, damage) {
        if (damage > 0) {
            target.currentHp -= damage;
            this.showFloatingText(target.x, target.y, `-${damage}`, '#ff4444');
            
            if (target.isStealthed) {
                target.isStealthed = false;
                target.setAlpha(1.0);
                this.showFloatingText(target.x, target.y - 20, "발각됨!", '#ffff00');
            }
        } else {
            target.currentHp -= damage; // 힐
            this.showFloatingText(target.x, target.y, `+${Math.abs(damage)}`, '#00ff44');
        }

        if (target.currentHp <= 0) {
            this.killUnit(target);
            if (target.isBase) this.checkGameEnd(target.team);
        }
    }

    playSkillAnim(plan) {
        const stats = SKILL_STATS[plan.name];
        if (plan.name === '화염구' || plan.name === '돌멩이') {
            const projectile = this.add.circle(plan.x, plan.y - 300, 10, stats.color);
            this.tweens.add({
                targets: projectile,
                y: plan.y,
                duration: 400,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    projectile.destroy();
                    this.createExplosion(plan.x, plan.y, stats.radius, stats.color);
                }
            });
        } else {
            this.createExplosion(plan.x, plan.y, stats.radius, stats.color);
        }
    }

    createExplosion(x, y, radius, color) {
        const circle = this.add.circle(x, y, 10, color, 0.6);
        this.tweens.add({
            targets: circle,
            scale: radius / 10,
            alpha: 0,
            duration: 500,
            onComplete: () => circle.destroy()
        });
    }

    showFloatingText(x, y, msg, color) {
        const text = this.add.text(x, y-20, msg, {
            fontSize: '16px', fontStyle: 'bold', color: color, stroke: '#000', strokeThickness: 4
        });
        text.setOrigin(0.5);
        this.tweens.add({
            targets: text, y: y - 50, alpha: 0, scale: 1.2, duration: 800, ease: 'Back.easeOut',
            onComplete: () => text.destroy()
        });
    }

    updateHpBar(unit) {
        if (!unit.active) return;
        if (unit.isBase) unit.hpText.setText(unit.currentHp);
        else { unit.hpBar.x = unit.x; unit.hpBar.y = unit.y - 25; }
        const ratio = Math.max(0, unit.currentHp / unit.stats.hp);
        unit.hpBar.width = (unit.isBase ? 60 : 30) * ratio;
        unit.hpBar.fillColor = (ratio > 0.3) ? 0x00ff00 : 0xff0000;
    }

    killUnit(unit) {
        unit.active = false;
        unit.hpBar.destroy();
        if (unit.hpText) unit.hpText.destroy();
        unit.destroy();
        
        const unitName = Object.keys(UNIT_STATS).find(key => UNIT_STATS[key].color === unit.stats.color) || "유닛";
        this.addLog(`${unitName} 사망!`, "log-red");
    }

    createBase(team) {
        const stats = UNIT_STATS['기지'];
        const x = (team === 'ALLY') ? 45 : 755;
        const y = 225;
        const base = this.add.rectangle(x, y, 50, 90, (team === 'ALLY' ? 0x3366ff : 0xff3333));
        base.team = team;
        base.stats = stats;
        base.currentHp = stats.hp;
        base.active = true;
        base.isBase = true;
        base.hpBar = this.add.rectangle(x, y - 55, 60, 8, 0x00ff00);
        base.hpText = this.add.text(x - 20, y - 70, stats.hp, { fontSize: '12px', color: '#fff' });
        this.activeUnits.push(base);
    }

    checkGameEnd(loserTeam) {
        this.isPlaying = false;
        if (loserTeam === 'ENEMY') {
            this.statusText.setText("VICTORY!");
            this.addLog("승리! 다음 스테이지로 이동", "log-green");
            alert("승리! 다음 스테이지로 이동합니다.");
            
            const logContainer = document.getElementById('log-container');
            if(logContainer) logContainer.style.display = 'none';
            
            currentStage++;
            this.scene.start('MapScene');
        } else {
            this.statusText.setText("DEFEAT...");
            this.addLog("패배...", "log-red");
            alert("패배! 다시 도전하세요.");
            this.scene.restart();
        }
    }

    generateEnemyWave(stage) {
        const count = 2 + stage; 
        for(let i=0; i<count; i++) {
            this.enemyWave.push({
                time: 1.0 + (i * 1.5), type: 'Unit', name: '적군',
                x: 750, y: 100 + Math.random() * 250, spawned: false
            });
        }
    }

    drawMap() {
        const g = this.graphics; g.clear(); g.lineStyle(1, 0x444444, 0.5);
        for(let y=0; y<=450; y+=50) { g.moveTo(0,y); g.lineTo(800,y); }
        for(let x=0; x<=800; x+=50) { g.moveTo(x,0); g.lineTo(x,450); }
        g.strokePath();
        g.lineStyle(2, 0x00ff00, 0.3); const dash = 10, gap = 5;
        for(let y=0; y<450; y+=dash+gap) {
            g.moveTo(DEPLOY_LIMIT, y);
            g.lineTo(DEPLOY_LIMIT, y+dash);
        }
        g.strokePath();
        g.fillStyle(0x00ff00, 0.05);
        g.fillRect(0, 0, DEPLOY_LIMIT, 450);
    }

    drawPredictions() {
        if (!this.predictionGraphics) return; 
        
        // ★ [안전장치] 슬라이더 확인
        const slider = document.getElementById('timeline-slider');
        if (!slider) return;

        const g = this.predictionGraphics; 
        g.clear();
        
        if (this.isPlaying) return;
        
        const currentTime = parseFloat(slider.value) / 100;
        
        this.deployedObjects.forEach(plan => {
            if (plan.type === 'Unit') {
                const stats = UNIT_STATS[plan.name];
                const startX = plan.x; const startY = plan.y;
                const moveDuration = 10.0 - plan.time;
                if (moveDuration > 0 && stats.speed > 0) {
                    const endX = startX + (stats.speed * moveDuration);
                    g.lineStyle(2, stats.color, 0.3);
                    let currX = startX;
                    const dash = 10, gap = 5;
                    while (currX < endX && currX < 800) {
                        g.beginPath(); g.moveTo(currX, startY); g.lineTo(Math.min(currX + dash, endX), startY); g.strokePath();
                        currX += dash + gap;
                    }
                }
                let ghostX = startX; let alpha = 0.2;
                if (currentTime >= plan.time && stats.speed > 0) {
                    const travelTime = currentTime - plan.time;
                    ghostX = startX + (stats.speed * travelTime);
                    alpha = 0.8;
                }
                if (ghostX < 800) {
                    g.lineStyle(2, stats.color, alpha); g.fillStyle(stats.color, alpha * 0.3);
                    g.strokeCircle(ghostX, startY, 15); g.fillCircle(ghostX, startY, 15);
                }
            }
        });
    }

    moveTowards(unit, target, dt) {
        const angle = Phaser.Math.Angle.Between(unit.x, unit.y, target.x, target.y);
        unit.x += Math.cos(angle) * unit.stats.speed * dt;
        unit.y += Math.sin(angle) * unit.stats.speed * dt;
    }

    setupSpeedControls() {
        const btnPause = document.getElementById('btn-pause');
        const btn1x = document.getElementById('btn-1x');
        const btn2x = document.getElementById('btn-2x');
        
        if (!btnPause) return;

        const setSpeed = (speed, activeBtn) => {
            this.timeSpeed = speed;
            [btnPause, btn1x, btn2x].forEach(b => b.classList.remove('active'));
            activeBtn.classList.add('active');
        };

        const replaceBtn = (oldBtn) => {
            const newBtn = oldBtn.cloneNode(true);
            oldBtn.parentNode.replaceChild(newBtn, oldBtn);
            return newBtn;
        };

        replaceBtn(btnPause).onclick = () => setSpeed(0, document.getElementById('btn-pause'));
        replaceBtn(btn1x).onclick = () => setSpeed(1.0, document.getElementById('btn-1x'));
        replaceBtn(btn2x).onclick = () => setSpeed(2.0, document.getElementById('btn-2x'));
    }

    setupTimelineEvents() {
        const slider = document.getElementById('timeline-slider');
        // ★ [안전장치] 슬라이더 확인
        if (!slider) return;

        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        
        newSlider.addEventListener('input', (e) => {
            if(!this.isPlaying) {
                const display = document.getElementById('time-display');
                if (display) display.innerText = (e.target.value/100).toFixed(1)+"s";
                this.drawPredictions();
            }
        });
    }

    updateCostUI() {
        const costDisplay = document.getElementById('cost-display');
        if(costDisplay) costDisplay.innerText = `⚡ Cost: ${this.playerCost} / ${MAX_COST}`;
    }

    updateUI() {
        // ★ [안전장치] 슬라이더 확인
        const slider = document.getElementById('timeline-slider');
        if(slider) slider.value = this.battleTime * 100;
        
        const display = document.getElementById('time-display');
        if(display) display.innerText = this.battleTime.toFixed(1) + "s";
    }
}