class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

preload() {
        // [1] 유닛 아이콘 (기존 방식 유지)
        // (아이콘도 소프트코딩 가능하지만, 일단 안전하게 기존 리소스 로드 유지)
        /*this.load.image('img_swordman', 'assets/icon/swordman.png');
        this.load.image('img_archer', 'assets/icon/archer.png');
        this.load.image('img_healer', 'assets/icon/healer.png');
        this.load.image('img_wall', 'assets/icon/wall.png');
        this.load.image('img_assassin', 'assets/icon/assassin.png');
        this.load.image('img_enemy', 'assets/icon/enemy.png');
        */
        // [2] 배경 및 기타 리소스
        this.load.image('bg_battle', 'assets/maps/battle_bg1.png');
        this.load.image('cmd_knight', 'assets/commanders/knight.png');
        //this.load.image('base_knight', 'assets/base/base_knight.png');
        
        // ★ [소프트 코딩] 데이터(UNIT_STATS, SKILL_STATS)를 순회하며 일러스트 자동 로드
        // 조건: data.js의 image 속성이 'img_이름' 형태여야 하며, 
        //       assets/chars/ 폴더에 '이름.png' 파일이 있어야 함.
        
        const allStats = { ...UNIT_STATS, ...SKILL_STATS };

        for (const [name, stat] of Object.entries(allStats)) {
            if (stat.image) {
                // 예: 'img_swordman' -> 'swordman' (파일명 추출)
                const fileName = stat.image.replace('img_', '');
                
                // 로드 키: 'illust_swordman', 경로: 'assets/chars/swordman.png'
                this.load.image(`illust_${fileName}`, `assets/chars/${fileName}.png`);
            }
        }
    }
        // (나중에 추가될 리소스 예시)
        // this.load.image('base_mage', 'assets/base/base_mage.png');
    

create() {
        // ★ [UI 복구] 배틀 씬 진입 시 전투 UI 보이기
        const slider = document.getElementById('timeline-slider');
        if (slider) slider.style.display = 'block';
        
        const hand = document.getElementById('hand-container');
        if (hand) hand.style.display = 'flex'; 
        
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        if (topBar) topBar.style.display = 'flex';
        if (bottomBar) bottomBar.style.display = 'flex';

        // ★ [수정] 중복 선언 제거됨 (slider 변수 재사용)
        const timeDisplay = document.getElementById('time-display');
        
        if (typeof SVG_MANAGER !== 'undefined') {
            SVG_MANAGER.initTextures(this);
        }
        if (slider) {
            slider.value = 0; 
        }
        if (timeDisplay) {
            timeDisplay.innerText = "0.0s"; 
        }
        
        // [2] 매니저 초기화
        this.svgManager = new SVGManager(this);
        this.simulator = new GhostSimulator();
        this.enemyAI = new EnemyAI(this);

        this.cardManager = new CardDeckManager(this);
        this.interactionManager = new InteractionManager(this);
        this.combatManager = new CombatManager(this);
        this.uiManager = new UIManager(this);
        this.ghostGroup = this.add.group();
       if (this.svgManager && typeof UNIT_STATS !== 'undefined') {
            this.svgManager.prebakeAllTextures();
        }
        this.fieldGraphics = this.add.graphics();
        this.fieldGraphics.setDepth(10); 
        this.fieldGraphics.setVisible(false); 
        this.uiManager.toggleArtifactUI(true);
        
        // [에디터 초기화]
 
    

        this.uiManager.setupSpeedControls();
        this.uiManager.setupTimelineEvents(); 
        this.uiManager.updateCostUI();

        if (GAME_DATA.deck.length === 0) {
            GAME_DATA.startNewGame();
        }
        
        // [3] 게임 변수 초기화
        this.currentRound = 1;
        this.playerCost = 10;
        this.isPlaying = false;
        this.battleTime = 0;
        this.timeSpeed = 1.0;
        this.commanderCooldown = 0;

        this.deployedObjects = [];
        this.enemyWave = [];
        this.activeUnits = [];
        this.activeProjectiles = [];

        // [4] 맵 데이터 로드
        const stageNum = GAME_DATA.stage || 1; 
        const currentMapId = `Map${stageNum}`;
        if (typeof getMapData === 'function') {
            this.mapData = getMapData(currentMapId); 
} else {
            // ★ [수정] 기본값도 1280x720 화면에 맞게 확장 (32칸 x 18칸)
            this.mapData = { tileSize: 40, mapWidth: 32, mapHeight: 18, image: 'bg_battle' };
        }
        
        this.tileSize = this.mapData.tileSize;
        this.mapWidth = this.mapData.mapWidth;
        this.mapHeight = this.mapData.mapHeight;
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, this.mapData.image);
        bg.setDisplaySize(this.scale.width, this.scale.height);
        bg.setTint(0xaaaaaa);
        
     this.grid = this.mapData.getGrid(this.mapWidth, this.mapHeight); // 1. 그리드를 먼저 생성
        this.createOutfieldLine();

        this.easystar = new EasyStar.js();
        this.easystar.setGrid(this.grid); 
        this.easystar.setAcceptableTiles([0, 2, 3]);
        this.easystar.enableDiagonals(); 
        this.easystar.disableCornerCutting();
        this.easystar.enableSync();
        // ★ [추가할 코드] 시뮬레이션 전용 '터보' EasyStar
this.simEasystar = new EasyStar.js();
this.simEasystar.setGrid(this.grid);
this.simEasystar.setAcceptableTiles([0, 2, 3]);
this.simEasystar.enableDiagonals();
this.simEasystar.disableCornerCutting();
this.simEasystar.enableSync(); // 동기 모드 필수
this.simEasystar.setIterationsPerCalculation(1000000000);

        this.graphics = this.add.graphics();
        this.predictionGraphics = this.add.graphics(); 
        this.skillGraphics = this.add.graphics();
        this.skillGraphics.setDepth(100);

        this.createBase('ALLY');
        this.createBase('ENEMY');

        this.statusText = this.add.text(10, 10, `Stage ${stageNum} / Round ${this.currentRound}`, { fontSize: '16px', color: '#fff' });

        const logContainer = document.getElementById('log-container');
        if (logContainer) logContainer.style.display = 'none';

        // [5] 이벤트 리스너
this.input.on('pointerdown', (pointer) => {
        // ★ [수정] 하드코딩된 Y축 제한(230px) 삭제!
        // 이제 화면 맨 아래쪽까지 자유롭게 클릭하여 유닛을 배치할 수 있습니다.
        if (this.isPlaying) return; 

        // InteractionManager 내부에서 '4번 타일(장외)'인지 체크하므로 안전합니다.
        this.interactionManager.handleMapClick(pointer);
    });
        
        // 버튼 이벤트 복구
        const btnGo = document.getElementById('btn-turn-end');
        if (btnGo) {
            const newBtnGo = btnGo.cloneNode(true);
            btnGo.parentNode.replaceChild(newBtnGo, btnGo);
            newBtnGo.addEventListener('click', () => this.startRound());
        }
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
            const newBtnReset = btnReset.cloneNode(true);
            btnReset.parentNode.replaceChild(newBtnReset, btnReset);
            newBtnReset.addEventListener('click', () => this.interactionManager.resetAllPlans());
        }
        
        const btnPopupCancel = document.getElementById('btn-popup-cancel');
        if (btnPopupCancel) {
            btnPopupCancel.onclick = () => {
                document.getElementById('game-popup').style.display = 'none';
            };
        }

        // 덱/무덤 버튼 이벤트
        const deckBtn = document.getElementById('deck-pile');
        if (deckBtn) deckBtn.onclick = () => this.cardManager.openCardViewer(`덱`, [...this.cardManager.deck].sort());
        const discardBtn = document.getElementById('discard-pile');
        if (discardBtn) discardBtn.onclick = () => this.cardManager.openCardViewer(`무덤`, this.cardManager.discard);
        const sealBtn = document.getElementById('seal-pile');
        if (sealBtn) sealBtn.onclick = (e) => { e.stopPropagation(); this.cardManager.openCardViewer(`봉인`, this.cardManager.sealed); };
        const closeBtn = document.getElementById('btn-viewer-close');
        if (closeBtn) closeBtn.onclick = () => document.getElementById('card-viewer-modal').style.display = 'none';

        // [6] 시작 초기화
        this.cardManager.initDeck(); 
        this.cardManager.drawCard(5);
        this.updateCostUI();
        this.enemyAI.generateWave(GAME_DATA.stage);
        
        this.artifactManager = new ArtifactManager(this);
        this.artifactManager.init(); 
        this.toggleBattleUI(false);
        this.createTimelineUI();

    }

createOutfieldLine() {
        // 1. 유효한 마지막 행(Row) 찾기 (하드코딩 방지: 그리드 스캔)
        let lastPlayableRow = -1;
        for (let y = this.grid.length - 1; y >= 0; y--) {
            // 해당 줄에 4(장외)가 아닌 타일이 하나라도 있으면 유효 행으로 인정
            const hasPlayableTile = this.grid[y].some(tileVal => tileVal !== 4);
            if (hasPlayableTile) {
                lastPlayableRow = y;
                break;
            }
        }

        // 유효한 땅이 없으면 그리지 않음
        if (lastPlayableRow === -1) return;

        // 2. Y좌표 계산 (마지막 유효 타일의 바로 아래쪽 끝)
        // Phaser 좌표계이므로 스케일링 이슈가 자동으로 해결됨
        const limitY = (lastPlayableRow + 1) * this.tileSize;

        // 3. 그래픽 객체 생성 (선 그리기)
        const graphics = this.add.graphics();
        graphics.setDepth(20); // 유닛(Depth 1)보다 위에, UI보단 아래에

        // 네온 효과 (여러 번 겹쳐서 빛나는 느낌)
        graphics.lineStyle(4, 0xff0055, 0.3); // 두껍고 흐린 선
        graphics.lineBetween(0, limitY, this.scale.width, limitY);

        graphics.lineStyle(2, 0xff0055, 0.8); // 중간 선
        graphics.lineBetween(0, limitY, this.scale.width, limitY);
        
        graphics.lineStyle(1, 0xffffff, 1.0); // 중심 흰색 선 (가장 밝음)
        graphics.lineBetween(0, limitY, this.scale.width, limitY);

        // 4. 텍스트 라벨 ("DEPLOYMENT LIMIT")
        const labelBox = this.add.container(this.scale.width / 2, limitY);
        labelBox.setDepth(21);

        const bg = this.add.rectangle(0, 0, 140, 20, 0x000000, 0.8);
        bg.setStrokeStyle(1, 0xff0055);

        const text = this.add.text(0, 0, "DEPLOYMENT LIMIT ▼", {
            fontSize: '11px',
            fontFamily: 'Rajdhani, sans-serif',
            color: '#ff0055',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        labelBox.add([bg, text]);
        
        // (선택 사항) 맵 데이터에 한계선 Y좌표 저장 (다른 로직에서 쓸 수 있게)
        this.mapData.limitPixelY = limitY;
    }
   

    getAdjustedStats(type, name) {
        const base = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
        let stats = JSON.parse(JSON.stringify(base)); 

        const cmd = COMMANDERS[selectedCommander];
        if (cmd.type === 'PASSIVE_BUFF') {
            if (type === 'Unit' && stats.race === '보병') {
                stats.hp = Math.floor(stats.hp * 1.2);
                stats.damage = Math.floor(stats.damage * 1.2);
            }
        } else if (cmd.type === 'PASSIVE_COST') {
            if (type === 'Skill') {
                stats.cost = Math.max(0, stats.cost - 1);
            }
        }
        return stats;
    }

// [3] 업데이트 루프 (10라운드 체크)
update(time, delta) {
        if (!this.isPlaying) {
            // 전투 중이 아닐 때도 UI 갱신 필요 (카드 선택 시 반응해야 하므로)
            this.updateBonusUI();
        } else {
        this.updateGhostSimulation();
        const dt = (delta / 1000) * this.timeSpeed;
        if (this.artifactManager) this.artifactManager.update(dt);
        this.battleTime += dt;
        this.uiManager.updateTimeUI();
        this.easystar.calculate();
        
        this.checkSpawns();

        // 1. 유닛 업데이트 (이동, 공격, 데미지 처리)
        // 이 과정에서 유닛(기지 포함)의 체력이 0이 되어 active = false가 될 수 있습니다.
        this.activeUnits.forEach(unit => {
            if (unit.active) {
                if (unit.update) unit.update(dt); 
            }
        });

        // ★ [핵심 수정] 유닛 목록에서 삭제하기 "전"에 게임 종료 조건을 체크해야 합니다!
        
        // 2-1. 적 기지 파괴 체크
        const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
        if (enemyBase && (enemyBase.currentHp <= 0 || !enemyBase.active)) {
            this.checkGameEnd('ENEMY_DESTROYED');
            return;
        }

        // 2-2. 아군 기지 파괴 체크
        const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (myBase && (myBase.currentHp <= 0 || !myBase.active)) {
            this.checkGameEnd('ALLY_DESTROYED');
            return;
        }

        // ★ 이제 죽은 유닛을 리스트에서 제거합니다.
        this.activeUnits = this.activeUnits.filter(u => u.active);

        // 투사체 업데이트
        this.activeProjectiles.forEach(proj => {
            if (proj.active && proj.update) proj.update(dt);
        });
        this.activeProjectiles = this.activeProjectiles.filter(p => p.active);
        
        // 3. 시간/라운드 종료
        const ROUND_TIME_LIMIT = 10.0; 
        const MAX_ROUNDS = 10; 

        if (this.battleTime >= ROUND_TIME_LIMIT) { 
            if (this.currentRound >= MAX_ROUNDS) {
                this.addLog("전투 종료! 전선 이동 거리 산출...", "log-purple");
                this.checkGameEnd('TIME_OVER');
            } else {
                this.endRound();
            }
            return;
        }
        
        // 지휘관 스킬
        const cmd = COMMANDERS[selectedCommander];
        if (cmd && cmd.type === 'ACTIVE_ATK') {
            if (this.commanderCooldown > 0) {
                this.commanderCooldown -= dt;
            } else {
                const target = this.findNearestEnemy();
                if (target) {
                    const dist = Phaser.Math.Distance.Between(100, this.scale.height/2, target.x, target.y);
                    if (dist <= cmd.range) {
                        this.fireCommanderSkill(target, cmd);
                        this.commanderCooldown = cmd.cooldown;
                    }
                }
            }
        }
        
        this.drawCommanderHUD();
    }
}

updateBonusUI() {
        const indicator = document.getElementById('timeline-bonus-bar');
        if (!indicator) return;

        const mgr = this.cardManager;
        // 카드가 선택되지 않았거나 데이터가 없으면 숨김
        if (!mgr || mgr.selectedCardIdx === -1 || !mgr.hand[mgr.selectedCardIdx]) {
            indicator.style.display = 'none';
            return;
        }

        const cardStr = mgr.hand[mgr.selectedCardIdx];
        const [type, name] = cardStr.split('-');
        const stats = this.getAdjustedStats(type, name);

        if (stats && stats.bonusTime) {
            const [start, end] = stats.bonusTime; 
            const maxTime = 10.0; // 전체 라운드 시간

            // ★ [수정] 복잡한 보정 공식을 제거하고 순수 시간 비율(%) 사용
            // 이렇게 하면 0초는 0%, 10초는 100%에 정확히 매핑되어 양쪽 끝까지 꽉 찹니다.
            const leftPercent = (start / maxTime) * 100;
            const widthPercent = ((end - start) / maxTime) * 100;

            indicator.style.left = `${leftPercent}%`;
            indicator.style.width = `${widthPercent}%`;
            
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }


    findNearestToPoint(x, y, targetTeam) {
        let nearest = null, minDist = 9999;
        this.activeUnits.forEach(u => {
            if (u.active && u.team === targetTeam && !u.isStealthed) {
                const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
                if (d < minDist) { minDist = d; nearest = u; }
            }
        });
        return nearest;
    }
        // [1] 카드 선택 확인

    drawDeploymentZones(shouldDraw) {
        // 1. 그래픽 초기화 (기존에 그려진 것 지우기)
        this.fieldGraphics.clear();
        this.fieldGraphics.setVisible(false);

    // ★ 매니저의 선택 상태 확인
        if (this.isPlaying || !shouldDraw || this.cardManager.selectedCardIdx === -1) {
            return;
        }

        // ★ 매니저의 핸드 확인
        const cardStr = this.cardManager.hand[this.cardManager.selectedCardIdx];
        if (!cardStr) return; 

        const [type, name] = cardStr.split('-');
        if (type !== 'Unit') return;

        const stats = this.getAdjustedStats(type, name);
        const hasInfiltrate = stats.traits && stats.traits.includes('침투');

        this.fieldGraphics.setVisible(true);
        this.fieldGraphics.fillStyle(0x00ff00, 0.3); 

        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tileVal = (this.grid[y] && this.grid[y][x] !== undefined) ? this.grid[y][x] : 1;
                let isDrawable = false;
                if (hasInfiltrate) {
                    if (tileVal !== 1 && tileVal !== 3) isDrawable = true;
                } else {
                    if (tileVal === 2) isDrawable = true;
                }
                if (isDrawable) {
                    this.fieldGraphics.fillRect(
                        x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize
                    );
                }
            }
        }
    }

    cancelDeployment(plan) {
        if (this.isPlaying) return; 
        const cardStr = `${plan.type}-${plan.name}`;
        const [type, name] = cardStr.split('-');
        
        const stat = this.getAdjustedStats(type, name);
        
        this.playerCost += stat.cost;
        this.updateCostUI();
        this.cardManager.hand.push(cardStr);
        this.cardManager.renderHand();

        if (plan.visualMarker) plan.visualMarker.destroy();
        if (plan.visualText) plan.visualText.destroy();
        const index = this.deployedObjects.indexOf(plan);
        if (index > -1) this.deployedObjects.splice(index, 1);
        this.drawPredictions();
    }

// BattleScene.js 내부 checkSpawns 함수 교체

checkSpawns() {
        // 1. 아군(플레이어) 배치 처리
        this.deployedObjects.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                // spawned 체크를 먼저 하여 중복 실행 방지
                plan.spawned = true;

                if (plan.type === 'Unit') {
                    const stats = this.getAdjustedStats('Unit', plan.name); 
                    const spawnCount = stats.count || 1;
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                        const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;
                        
                        // ★ [수정] spawnUnit 대신 spawnUnitWithEffect 사용
                        // 보너스 타임 효과를 적용하기 위함
                        if (this.spawnUnitWithEffect) {
                            this.spawnUnitWithEffect(plan.name, plan.x + offsetX, plan.y + offsetY, plan.time);
                        } else {
                            // 안전장치: 함수가 없으면 기존 방식 사용
                            this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ALLY', plan.name);
                        }
                    }
                } else {
                    // 플레이어 스킬 -> 적군(ENEMY) 타격
                    console.log(`[CheckSpawns] 스킬 발동 시도`);
                    this.applySkillEffect(plan, 'ENEMY');
                }
                
                // 시각적 마커 제거
                if (plan.visualMarker) plan.visualMarker.destroy();
                if (plan.visualText) plan.visualText.destroy();
            }
        });

        // 2. 적군 웨이브 처리
        this.enemyWave.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                plan.spawned = true;
                
                if (plan.type === 'Unit') {
                    const stats = getEnemyStats(plan.name);
                    
                    if (!stats) {
                        console.error(`[Spawns] 유닛 데이터 없음: ${plan.name}`);
                        return;
                    }

                    const spawnCount = stats.count || 1;
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                        const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;

                        // 적군은 보너스 타임 효과를 받지 않으므로 일반 spawnUnit 사용
                        // (만약 적군도 효과를 받게 하려면 여기서도 spawnUnitWithEffect 사용 가능)
                        this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ENEMY', plan.name);
                    }
                } else {
                    // 적군 스킬 -> 아군(ALLY) 타격
                    this.applySkillEffect(plan, 'ALLY');
                }
            }
        });
    }
spawnUnit(x, y, team, name, customStats = null) {
        // 1. 스탯 결정 (수정됨)
        // ★ customStats가 있으면 그걸 쓰고, 없을 때만 데이터를 조회합니다.
        let stats = customStats;
        
        if (!stats) {
            stats = (team === 'ALLY') ? this.getAdjustedStats('Unit', name) : getEnemyStats(name);
        }

        // 데이터가 여전히 없으면 중단 (안전장치)
        if (!stats) {
            console.error(`[Spawn Error] 유닛 데이터를 찾을 수 없습니다: ${name}`);
            return null;
        }

        // 2. 유닛 생성 (Unit 클래스 사용)
        let unit;
        try {
            unit = new Unit(this, x, y, name, team, stats);
        } catch (e) {
            console.error(`[Spawn Error] Unit 생성 실패: ${name}`, e);
            return null;
        }

        // 3. 팀 설정 및 관리 목록 추가
        unit.team = team;
        
        if (this.activeUnits) {
            this.activeUnits.push(unit);
        }

        return unit;
    }

 // js/scenes/BattleScene.js

    // ★ [수정] 보너스 효과를 적용하여 유닛 소환 (+ 이펙트 추가)
    spawnUnitWithEffect(cardName, x, y, time) {
        // 1. 기본 스탯 가져오기
        const baseStats = this.getAdjustedStats('Unit', cardName);
        
        // 2. 원본 보호를 위해 복사
        let finalStats = JSON.parse(JSON.stringify(baseStats));
        let appliedBonus = false;

        // 3. 보너스 타임 체크 및 적용
        if (baseStats.bonusTime && baseStats.bonusEffect) {
            const [start, end] = baseStats.bonusTime;
            
            // 현재 시간이 보너스 구간 내라면
            if (time >= start && time <= end) {
                const effect = baseStats.bonusEffect;
                
                // (A) 퍼센트 연산 (%)
                if (effect.unit === '%') {
                    finalStats[effect.stat] = Math.floor(finalStats[effect.stat] * (1 + effect.val / 100));
                } 
                // (B) 고정값 합산 (+)
                else {
                    finalStats[effect.stat] += effect.val;
                }
                
                appliedBonus = true;
            }
        }

        // 4. 유닛 소환 (수정된 스탯 전달)
        const unit = this.spawnUnit(x, y, 'ALLY', cardName, finalStats);

        // ★ [신규] 보너스 적용 시 화려한 이펙트 출력
        if (appliedBonus && unit) {
            // (1) 로그 출력
            const bonusText = this.cardManager.getBonusText(baseStats.bonusEffect);
            this.addLog(`✨ ${cardName}: 타이밍 보너스! (${bonusText})`, "log-green");

            // (2) 시각 효과: 청록색(Cyan) 파동 (CombatManager의 createExplosion 재활용)
            // createExplosion(x, y, radius, color)
            this.combatManager.createExplosion(unit.x, unit.y, 80, 0x00ffcc); 

            // (3) 텍스트 효과: 유닛 머리 위에 "NICE TIMING!" 등 띄우기
            this.combatManager.showFloatingText(
                unit.x, 
                unit.y - 50, // 유닛 머리 위
                `✨TIMING BONUS!\n${bonusText}`, 
                '#00ffcc',   // 형광 청록색 텍스트
                '18px'
            );
            
            // (4) 유닛 등장 애니메이션: 커졌다가 작아지면서 밝게 빛남
            unit.setAlpha(0.5); // 처음엔 반투명
            unit.setScale(1.5); // 크게 시작
            
            // 흰색으로 번쩍이는 효과 (Tint)
            if (unit.bodySprite) unit.bodySprite.setTint(0xffffff);

            this.tweens.add({
                targets: unit,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 400,
                ease: 'Back.out', // 튕기는 느낌
                onComplete: () => {
                    // 원래 색상으로 복구
                    if (unit && unit.active) unit.resetTint();
                }
            });
        }
    }

addLog(msg, colorClass = '') {
        this.uiManager.addLog(msg, colorClass);
    }
   // [수정] 일반화된 스킬 효과 적용 함수 (변수명 불일치 해결)
applySkillEffect(plan, hostileTeam) {
        if (this.combatManager) {
            this.combatManager.applySkillEffect(plan, hostileTeam);
        } else {
            console.error("[BattleScene] CombatManager가 초기화되지 않았습니다.");
        }
    }

    applyDamage(attacker, target, damage) {
this.combatManager.applyDamage(attacker, target, damage);
    }

    createExplosion(x, y, radius, color) {
this.combatManager.createExplosion(x, y, radius, color);
    }

showFloatingText(x, y, msg, color) {
        this.combatManager.showFloatingText(x, y, msg, color);
    }

killUnit(unit) {
        this.combatManager.killUnit(unit);
    }

 createBase(team) {
    // 1. 위치 설정
    const centerY = this.scale.height / 2;
    // 아군은 왼쪽(100), 적군은 오른쪽(끝에서 100)
    const x = (team === 'ALLY') ? 100 : (this.scale.width - 100); 
    const y = centerY;

    let stats = {};
    let unitName = '';

    // 2. 아군/적군 데이터 로드
    if (team === 'ALLY') {
        // (A) 플레이어 지휘관 데이터
        const cmdKey = (typeof selectedCommander !== 'undefined') ? selectedCommander : 'knight';
        const cmdData = COMMANDERS[cmdKey] || COMMANDERS['knight'];

        unitName = `Base_${cmdKey}`; 
        
stats = {
            hp: cmdData.hp,
            damage: 0,
            speed: 0,
            range: 0,
            isStructure: true,
            
            // ★ 기지 이미지를 '몸통(body)'으로 설정하고, 무기는 없앱니다.
            parts: {
                body: `base_${cmdKey}`, // 예: base_knight
                weapon: null,           // 무기 제거
                acc: null               // 장신구 제거
            }
        };

        // 캠페인 모드 체력 이어하기
        if (GAME_DATA && !(GAME_DATA.stage === 1 && GAME_DATA.campaign.day === 1)) {
            if (GAME_DATA.currentHp) stats.currentHp = GAME_DATA.currentHp;
        }

    } else {
        // (B) 적군 지휘관 데이터
        const currId = GAME_DATA.campaign.currentNodeId;
        const currNode = GAME_DATA.getNode(currId);
        
        let enemyId = currNode ? currNode.enemyId : null;
        let enemyCmd = window.ENEMY_DATA_POOL[enemyId];

        // 데이터 안전장치
        if (!enemyCmd) {
            console.warn(`[Battle] 적군 ID(${enemyId}) 데이터 없음. 기본값 사용.`);
            enemyCmd = window.ENEMY_DATA_POOL['goblin_rookie'] || { hp: 1000, image: 'enemy_base' }; 
        }

        this.currentEnemyData = enemyCmd; 
        unitName = `Base_Enemy`; 
        
stats = {
            hp: enemyCmd.hp,
            damage: 0,
            speed: 0,
            range: 0,
            isStructure: true,
            
            // ★ 적군 기지도 동일하게 설정
            parts: {
                body: 'base_enemy', // SVGData.js에 정의된 키
                weapon: null,
                acc: null
            }
        };
    }

    // 3. 유닛 생성 (spawnUnit 활용)
    const baseUnit = this.spawnUnit(x, y, team, unitName, stats);
    
    // 4. ★ 기지 전용 추가 설정 (이 부분이 보완되었습니다)
    if (baseUnit) {
        baseUnit.isBase = true;     // 기지 식별자
        baseUnit.isSpawned = true;  // 배치 완료 처리

        // (1) 이미지 크기 및 위치 정렬 보정
        if (baseUnit.bodySprite) {
            // 기지는 크니까 100x120으로 설정 (필요시 숫자 조정)
            baseUnit.bodySprite.setDisplaySize(100, 120);
            
            // ★ 중요: 발 밑(1.0)을 기준으로 정렬해야 땅에 딱 붙습니다.
            baseUnit.bodySprite.setOrigin(0.5, 1.0); 
        }

        // (2) 물리 엔진 고정 (유닛이 밀어도 안 밀리게)
        if (baseUnit.body) {
            baseUnit.body.setImmovable(true); // 충돌 시 밀림 방지
            baseUnit.body.moves = false;      // 물리 이동 연산 끔
        }

        // (3) 기지 파괴 시 승리/패배 로직 연결
        // spawnUnit 내부에서 체력이 0이 되면 'dead' 이벤트를 발생시킨다고 가정
        baseUnit.on('dead', () => {
            console.log(`[Battle] ${team} 기지 파괴됨!`);
            
            if (team === 'ALLY') {
                // 아군 기지 파괴 -> 게임 오버
                if (typeof this.handleGameOver === 'function') {
                    this.handleGameOver();
                } else {
                    console.log("게임 오버 함수가 없습니다."); // 디버깅용
                }
            } else {
                // 적군 기지 파괴 -> 승리
                if (typeof this.handleStageClear === 'function') {
                    this.handleStageClear();
                } else {
                    console.log("스테이지 클리어 함수가 없습니다."); // 디버깅용
                }
            }
        });
    }

    return baseUnit; // 생성된 기지 객체 반환
}
    // [2] 게임 종료 및 결과 정산
    // [BattleScene.js] checkGameEnd 함수 수정

checkGameEnd(reason) {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.uiManager.toggleBattleUI(false); // UI 숨김

        if (reason === 'ENEMY_DESTROYED') {
            // [승리] 적 기지 파괴
            console.log("🏆 승리: 적 기지 파괴");
            GAME_DATA.completeCurrentNode(); // 노드 클리어 처리
            this.showRewardPopup("적 기지 파괴!"); 
            
        } else if (reason === 'ALLY_DESTROYED') {
            // [패배] 아군 기지 파괴
            console.log("💀 패배: 아군 기지 파괴");
            this.handleGameOver("아군 기지가 파괴되었습니다.");

        } else if (reason === 'TIME_OVER') {
            // [시간 초과] 체력 판정
            const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
            const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
            const myHp = myBase ? myBase.currentHp : 0;
            const enemyHp = enemyBase ? enemyBase.currentHp : 0;
            
            if (myHp >= enemyHp) {
                // 판정승
                console.log("🏆 판정승: 체력 우위");
                GAME_DATA.completeCurrentNode();
                this.showRewardPopup("제한 시간 종료 (판정승)");
            } else {
                // 판정패
                console.log("💀 판정패: 체력 열세");
                this.handleGameOver("제한 시간 종료 (적 체력이 더 많습니다)");
            }
        }
    }
   // js/scenes/BattleScene.js
// js/scenes/BattleScene.js
showRewardPopup(winMsg) {
        // [1] 기존 UI 숨기기
        const uiIds = ['timeline-slider', 'hand-container', 'ui-top-bar', 'ui-bottom-bar', 'btn-turn-end', 'btn-reset'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // 1. 보상 데이터 생성
        const rewards = this.cardManager.generateRewards ? this.cardManager.generateRewards() : [];
        if (rewards.length === 0) rewards.push('Unit-검사', 'Unit-궁수', 'Skill-화염구');

        // 2. 팝업 컨테이너 생성 (기존 것 제거 후 생성)
        let popup = document.getElementById('reward-popup');
        if (popup) popup.remove();

        popup = document.createElement('div');
        popup.id = 'reward-popup'; // CSS의 #reward-popup 스타일 적용됨

        // 3. 내부 HTML 구조 생성 (CSS 클래스 활용)
        popup.innerHTML = `
            <div class="reward-box">
                <div class="reward-title">VICTORY</div>
                <div class="reward-subtitle">${winMsg || "전투 승리! 보상을 선택하세요."}</div>
                <div class="reward-card-container" id="reward-cards"></div>
                <button class="btn-reward-skip" id="btn-skip-reward">건너뛰기 (골드 +50)</button>
            </div>
        `;
        
        document.body.appendChild(popup);

        // 4. 카드 생성 및 삽입
        const cardContainer = popup.querySelector('#reward-cards');

        rewards.forEach((cardStr) => {
            // CardDeckManager를 통해 카드 요소 생성
            const cardNode = this.cardManager.createCardElement(cardStr);
            const [type, name] = cardStr.split('-');
            const stats = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
            const rarity = stats.rarity || 'COMMON';

            // [보상용 스타일 오버라이딩]
            cardNode.classList.remove('card-in-viewer'); 
            cardNode.style.position = 'relative'; 
            cardNode.style.transform = 'scale(1.0)'; // 기본 크기
            cardNode.style.margin = '0';
            cardNode.style.cursor = 'pointer';
            cardNode.style.opacity = '1';
            
            // 등급별 후광 효과
            if (rarity === 'RARE') cardNode.style.boxShadow = `0 0 15px rgba(0, 255, 0, 0.5)`;
            else if (rarity === 'EPIC') cardNode.style.boxShadow = `0 0 20px rgba(200, 0, 255, 0.6)`;
            else if (rarity === 'LEGENDARY') cardNode.style.boxShadow = `0 0 25px rgba(255, 215, 0, 0.8)`;

            // [클릭 이벤트] 획득 로직
            cardNode.onclick = () => {
                GAME_DATA.addCard(cardStr);
                GAME_DATA.addGold(50);
                
                // 알림 팝업 (상점 스타일)
                if(this.scene.get('ShopScene')) {
                    this.scene.get('ShopScene').showCustomPopup("획득 완료", `[${name}] 카드를 얻었습니다!\n(골드 +50)`);
                } else {
                    alert(`[${name}] 획득!`);
                }

                document.body.removeChild(popup);
                this.scene.start('MapScene');
            };

            // [호버 애니메이션]
            cardNode.onmouseenter = () => { 
                cardNode.style.transform = 'scale(1.1) translateY(-10px)'; 
                cardNode.style.zIndex = '100'; 
            };
            cardNode.onmouseleave = () => { 
                cardNode.style.transform = 'scale(1.0)'; 
                cardNode.style.zIndex = ''; 
              
            };

            cardContainer.appendChild(cardNode);
        });

        // 5. 건너뛰기 버튼 이벤트 연결
        document.getElementById('btn-skip-reward').onclick = () => {
            GAME_DATA.addGold(50);
            document.body.removeChild(popup);
            this.scene.start('MapScene');
        };
    }

    handleGameOver(reason) {
        this.statusText.setText("GAME OVER");
        this.addLog("패배...", "log-red");
        this.showPopup("GAME OVER", `${reason}\n\n모든 데이터가 초기화됩니다.`, () => {
            GAME_DATA.startNewGame();
            this.scene.start('TitleScene'); // 타이틀로 이동
        });
    }

    // ★ [The Eye] 미래 예측 시뮬레이션
runPreSimulation() {
        const simulationResults = this.simulator.run(
            10.0, 
            [],   
            [],   
            this.activeUnits, 
            { 
                width: this.scale.width, 
                height: this.scale.height,
                grid: this.grid,
                tileSize: this.tileSize,
                easystar: this.simEasystar // ★ 여기를 simEasystar로 변경
            }
        );
        return simulationResults; 
    }
    // ★ [Strategy] 유닛 배치 위치 결정
// BattleScene.js 내부 함수 교체

 // js/scenes/BattleScene.js
// js/scenes/BattleScene.js

    updateGhostSimulation() {
        const now = Date.now();
        // 50ms 스로틀링 (성능 최적화)
        if (this.lastSimTime && (now - this.lastSimTime < 50)) {
            return; 
        }
        this.lastSimTime = now;

        // 화면 초기화
        this.ghostGroup.clear(true, true);
        this.predictionGraphics.clear(); 
        
        // ★ [수정 1] 기존의 'if (this.isPlaying) return;' 제거
        // 대신 현재 시간에 대한 기준을 분기 처리합니다.
        
        let currentTime;
        if (this.isPlaying) {
            // 전투 중이면 실제 전투 시간을 기준
            currentTime = this.battleTime; 
        } else {
            // 편집 모드면 슬라이더 시간을 기준
            const slider = document.getElementById('timeline-slider');
            if (!slider) return;
            currentTime = parseFloat(slider.value) / 100;
        }

        // ★ [수정 2] 시뮬레이터(경로 예측)는 '전투 중이 아닐 때'만 실행
        // (전투 중에는 실제 유닛이 움직이므로 예측선이 불필요/혼란 초래)
        if (!this.isPlaying) {
            const allyPlansWithTeam = this.deployedObjects.map(p => ({ ...p, team: 'ALLY' }));
            const enemyPlansWithTeam = this.enemyWave.map(p => ({ ...p, team: 'ENEMY' }));

            const results = this.simulator.run(
                currentTime, 
                allyPlansWithTeam, 
                enemyPlansWithTeam, 
                this.activeUnits, 
                { 
                    width: this.scale.width, 
                    height: this.scale.height,
                    grid: this.grid,          
                    tileSize: this.tileSize,  
                    easystar: this.simEasystar  
                }
            );

            // 시뮬레이션 결과(이미 소환된 유령) 시각화
            results.forEach(vUnit => {
                if (!vUnit.isSpawned) return; 
                
                const color = (vUnit.team === 'ALLY') ? 0x00ff00 : 0xff0000;

                // 경로 그리기
                this.predictionGraphics.lineStyle(2, color, 0.5); 
                this.predictionGraphics.beginPath();

                let hasHistory = false;
                if (vUnit.pathLogs && vUnit.pathLogs.length > 0) {
                    this.predictionGraphics.moveTo(vUnit.pathLogs[0].x, vUnit.pathLogs[0].y);
                    for (let i = 1; i < vUnit.pathLogs.length; i++) {
                        this.predictionGraphics.lineTo(vUnit.pathLogs[i].x, vUnit.pathLogs[i].y);
                    }
                    this.predictionGraphics.lineTo(vUnit.x, vUnit.y);
                    hasHistory = true;
                }
                if (vUnit.path && vUnit.path.length > 0) {
                    if (!hasHistory) this.predictionGraphics.moveTo(vUnit.x, vUnit.y);
                    vUnit.path.forEach(node => {
                        const pixelX = node.x * this.tileSize + this.tileSize / 2;
                        const pixelY = node.y * this.tileSize + this.tileSize / 2;
                        this.predictionGraphics.lineTo(pixelX, pixelY);
                    });
                }
                this.predictionGraphics.strokePath();

                // 유령 표시
                if (vUnit.active) {
                    this.createGhost(vUnit.x, vUnit.y, vUnit.name, color, 0.7, vUnit.currentHp, vUnit.stats.hp, vUnit.isBonus);
                } else {
                    const skull = this.add.text(vUnit.x, vUnit.y, '💀', { fontSize: '24px', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
                    this.ghostGroup.add(skull);
                }
            });
        }

        // ★ [수정 3] 예약된 유닛 표시는 '항상' 실행 (전투 중이어도 보이게)
        // 조건: 아직 시간이 안 됐고(time > currentTime) && 아직 소환 안 된(!plan.spawned) 유닛
        this.deployedObjects.forEach(plan => {
            if (plan.time >= currentTime && !plan.spawned) {
                if (plan.type === 'Unit') {
                    // 보너스 타임 여부 체크
                    let isBonus = false;
                    const stats = this.getAdjustedStats('Unit', plan.name);
                    
                    if (stats.bonusTime) {
                        const [start, end] = stats.bonusTime;
                        if (plan.time >= start && plan.time <= end) {
                            isBonus = true;
                        }
                    }

                    // 반투명 유령 표시 (대기 상태)
                    this.createGhost(
                        plan.x, plan.y, plan.name, 
                        0x00ff00, 
                        0.3, // 투명도 0.3
                        stats.hp, stats.hp, 
                        isBonus
                    );
                    
                    // 예약 시간 텍스트 표시
                    const timeText = this.add.text(plan.x, plan.y + 30, `⏳${plan.time}s`, {
                        fontSize: '12px', color: '#fff', stroke: '#000', strokeThickness: 2
                    }).setOrigin(0.5);
                    this.ghostGroup.add(timeText);
                }
            }
        });

        // 적군 예고 표시 (선택 사항: 적군도 미리 보고 싶다면 유지)
        this.enemyWave.forEach(plan => {
            if (plan.time > currentTime && plan.type === 'Unit' && !plan.spawned) {
                this.createGhost(plan.x, plan.y, plan.name, 0xff0000, 0.3, 100, 100, false);
            }
        });
    }
    // [보조 함수] drawPredictions를 위한 빈 함수 (호환성 유지)
    drawPredictions() {
        this.updateGhostSimulation();
    }
createGhost(x, y, name, color, alpha, currentHp, maxHp, isBonus = false) {
        let imgKey = '';
        if (typeof UNIT_STATS !== 'undefined' && UNIT_STATS[name] && UNIT_STATS[name].image) {
             imgKey = UNIT_STATS[name].image; 
        } else {
             imgKey = 'img_' + name; 
        }

        let ghost;
        if (this.textures.exists(imgKey)) {
            ghost = this.add.sprite(x, y, imgKey);
            ghost.setDisplaySize(40, 40); 
            
            // ★ [핵심] 보너스 타임 적용 시 청록색 틴트, 아니면 회색 틴트
            if (isBonus) {
                ghost.setTint(0x00ffcc); // Cyan (형광 청록색)
            } else {
                ghost.setTint(0x888888); // Grey (기존 유령 색)
            }
        } else {
            // 이미지가 없는 경우 원으로 대체
            ghost = this.add.circle(x, y, 15, color);
            if (isBonus) {
                ghost.setFillStyle(0x00ffcc);
            }
        }
        
        // 기지의 경우 유령 이미지는 숨기고(Alpha=0), 체력바만 보여줍니다.
        if (name === '기지') {
            ghost.setAlpha(0); 
        } else {
            ghost.setAlpha(alpha);
        }
        
        this.ghostGroup.add(ghost);

        // 유령 체력바 표시
        if (currentHp < maxHp) {
            const ratio = Phaser.Math.Clamp(currentHp / maxHp, 0, 1);
            
            // 기지는 체력바를 좀 더 크게 표시
            const barWidth = (name === '기지') ? 60 : 30;
            const yOffset = (name === '기지') ? 65 : 25;

            const bgBar = this.add.rectangle(x, y - yOffset, barWidth, 5, 0x000000);
            this.ghostGroup.add(bgBar);

            const hpColor = (ratio < 0.3) ? 0xff0000 : 0xffff00; 
            const hpBar = this.add.rectangle(x, y - yOffset, barWidth * ratio, 5, hpColor);
            
            this.ghostGroup.add(hpBar);
        }

        return ghost;
    }


updateCostUI() {
        this.uiManager.updateCostUI();
    }
    createTimelineUI() {
        const slider = document.getElementById('timeline-slider');
        if (!slider) return;

        const wrapper = slider.parentElement; 
        
        // 1. 슬라이더 전용 컨테이너 생성
        let trackContainer = document.getElementById('slider-track-container');
        if (!trackContainer) {
            trackContainer = document.createElement('div');
            trackContainer.id = 'slider-track-container';
            
            // 스타일 설정
            trackContainer.style.flexGrow = '1'; 
            trackContainer.style.position = 'relative'; 
            trackContainer.style.height = '100%';
            trackContainer.style.display = 'flex';
            trackContainer.style.alignItems = 'center';
            trackContainer.style.margin = '0 10px'; 

            // DOM 재구성: wrapper > container > elements
            wrapper.insertBefore(trackContainer, slider); 
            trackContainer.appendChild(slider);           
        }

        // 2. [Layer 1] 배경 트랙 (회색 바닥) - 새로 추가!
        // 기존 슬라이더의 배경(#444) 역할을 대신합니다.
        let visualTrack = document.getElementById('timeline-visual-track');
        if (!visualTrack) {
            visualTrack = document.createElement('div');
            visualTrack.id = 'timeline-visual-track';
            trackContainer.appendChild(visualTrack); // 슬라이더보다 먼저 추가 (뒤에 배치)
        }
        
        visualTrack.style.position = 'absolute';
        visualTrack.style.width = '100%';
        visualTrack.style.height = '6px'; // 슬라이더 두께
        visualTrack.style.backgroundColor = '#444'; // 기존 트랙 색상
        visualTrack.style.borderRadius = '3px';
        visualTrack.style.top = '50%';
        visualTrack.style.transform = 'translateY(-50%)';
        visualTrack.style.zIndex = '1'; // 맨 밑

        // 3. [Layer 2] 보너스 인디케이터 (초록색 구간)
        let indicator = document.getElementById('timeline-bonus-bar');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'timeline-bonus-bar';
            trackContainer.appendChild(indicator);
        }

        indicator.style.position = 'absolute';
        indicator.style.height = '6px'; 
        indicator.style.top = '50%';    
        indicator.style.transform = 'translateY(-50%)'; 
        indicator.style.backgroundColor = '#00ffcc'; 
        indicator.style.opacity = '1.0';        // 선명하게 (트랙 위에 있으므로 불투명해도 됨)
        indicator.style.pointerEvents = 'none'; 
        indicator.style.borderRadius = '3px';
        indicator.style.zIndex = '2'; // 트랙 위, 슬라이더 아래
        indicator.style.display = 'none';

        // 4. [Layer 3] 실제 슬라이더 (손잡이 & 터치 영역)
        // ★ 핵심: 배경을 투명하게 하여 뒤의 트랙과 보너스 바가 보이게 함
        slider.style.width = '100%';
        slider.style.margin = '0';
        slider.style.position = 'relative';
        slider.style.zIndex = '3'; // 최상단 (손잡이가 가려지지 않음)
        slider.style.background = 'transparent'; // ★ 배경 투명화
        
        // (참고) 브라우저 기본 스타일 간섭 제거를 위해 appearance 설정이 필요할 수 있음
        // style.css에 이미 -webkit-appearance: none;이 있으므로 잘 작동할 것입니다.
    }

showPopup(title, msg, onConfirm, isConfirm) {
        this.uiManager.showPopup(title, msg, onConfirm, isConfirm);
    }

startRound() {
        if (this.isPlaying) return;

        if (this.cardManager.hand.length > MAX_HAND) {
            this.showPopup("경고", `핸드가 가득 찼습니다!\n(${this.cardManager.hand.length}/${MAX_HAND})\n\n카드를 사용하여 공간을 비워주세요.`);
            return;
        }
        
        this.ghostGroup.clear(true, true);
        this.isPlaying = true;
        
        if (this.artifactManager) this.artifactManager.onRoundStart();
        this.battleTime = 0; 
        
        // ★ [수정] 슬라이더 최대값을 10초(1000)로 설정
        const slider = document.getElementById('timeline-slider');
        if(slider) slider.max = 1000; 

        this.statusText.setText(`⚔️ Round ${this.currentRound} 전투 중!`);
        this.toggleBattleUI(true);
        this.addLog(`Round ${this.currentRound} 시작`, "log-blue");
        
        this.cardManager.selectedCardIdx = -1;
        this.cardManager.renderHand();
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
        this.cardManager.drawCard(3);

        this.addLog(`라운드 종료. 코스트 회복.`);
        this.statusText.setText(`Round ${this.currentRound} 준비`);
        
        const slider = document.getElementById('timeline-slider');
        if(slider) slider.value = 0;
        const display = document.getElementById('time-display');
        if(display) display.innerText = "0.0s";
        
        this.updateCostUI();
        
        this.deployedObjects = this.deployedObjects.filter(plan => !plan.spawned);
        this.enemyWave = this.enemyWave.filter(plan => !plan.spawned);

        // ★ [수정] AI 매니저에게만 요청하고, 옛날 함수 호출(this.generateEnemyWave)은 삭제!
        this.enemyAI.generateWave(GAME_DATA.stage);
        
        this.predictionGraphics.clear();
    }

toggleBattleUI(isBattle) {
        this.uiManager.toggleBattleUI(isBattle);
    }

    findNearestEnemy() {
        let nearest = null;
        let minDist = 9999;
        
        const originX = 100;
        const originY = this.scale.height / 2;

        this.activeUnits.forEach(u => {
            if (u.active && u.team === 'ENEMY' && !u.isStealthed) {
                const dist = Phaser.Math.Distance.Between(originX, originY, u.x, u.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = u;
                }
            }
        });
        return nearest;
    }

fireCommanderSkill(target, cmd) {
        this.combatManager.fireCommanderSkill(target, cmd);
    }

    drawCommanderHUD() {
        this.skillGraphics.clear();
        const cmd = COMMANDERS[selectedCommander];
        if (!cmd || cmd.type !== 'ACTIVE_ATK') return;

        const base = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (!base) return;

        const totalCool = cmd.cooldown;
        const currentCool = this.commanderCooldown;
        const ratio = Phaser.Math.Clamp(1 - (currentCool / totalCool), 0, 1);

        const x = base.x;
        const y = base.y;
        const radius = 60; 

        this.skillGraphics.lineStyle(4, 0x333333, 0.5);
        this.skillGraphics.strokeCircle(x, y, radius);

        const color = (ratio >= 1) ? 0x00ff00 : 0xffff00;
        
        this.skillGraphics.lineStyle(4, color, 0.8);
        this.skillGraphics.beginPath();
        
        const startAngle = Phaser.Math.DegToRad(-90);
        const endAngle = Phaser.Math.DegToRad(-90 + (360 * ratio));
        
        this.skillGraphics.arc(x, y, radius, startAngle, endAngle, false);
        this.skillGraphics.strokePath();
    }
    // [신규 기능] 현재 슬라이더 시간(Ghost Time)에 따른 실시간 코스트 계산
    getRealTimeCost(unitName) {
        const stat = UNIT_STATS[unitName];
        if (!stat) return 0;

        let finalCost = stat.cost;

        // GhostSimulator가 있고, 보너스 타임 설정이 있는 경우 체크
        if (this.ghostSimulator && stat.bonusTime) {
            const currentTime = this.ghostSimulator.currentTime; // 슬라이더 시간 (초 단위)
            const [start, end] = stat.bonusTime;

            // 현재 시간이 보너스 구간(예: 0~3초)에 포함되는지 확인
            if (currentTime >= start && currentTime <= end) {
                // 보너스 효과 적용 (현재는 'cost' 감소만 처리)
                if (stat.bonusEffect && stat.bonusEffect.stat === 'cost') {
                    finalCost += stat.bonusEffect.val; // 예: 3 + (-1) = 2
                }
            }
        }

        return Math.max(0, finalCost); // 코스트가 음수가 되지 않도록 방지
    }
}