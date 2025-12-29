class BattleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BattleScene' });
    }

    preload() {
        // [1] 유닛 아이콘
        this.load.image('img_swordman', 'assets/icon/swordman.png');
        this.load.image('img_archer', 'assets/icon/archer.png');
        this.load.image('img_healer', 'assets/icon/healer.png');
        this.load.image('img_wall', 'assets/icon/wall.png');
        this.load.image('img_assassin', 'assets/icon/assassin.png');
        this.load.image('img_enemy', 'assets/icon/enemy.png');

        // [2] 배경 및 기타
        this.load.image('bg_battle', 'assets/maps/battle_bg1.png');
        this.load.image('cmd_knight', 'assets/commanders/knight.png');
        this.load.image('base_knight', 'assets/base/base_knight.png');
        
        // (나중에 추가될 리소스 예시)
        // this.load.image('base_mage', 'assets/base/base_mage.png');
    }

create() {
        // [1] UI 및 배경 설정
        if (typeof SVG_MANAGER !== 'undefined') {
            SVG_MANAGER.initTextures(this);
        }
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        if (topBar) topBar.style.display = 'flex';
        if (bottomBar) bottomBar.style.display = 'flex';
        const slider = document.getElementById('timeline-slider');
        const timeDisplay = document.getElementById('time-display');
        if (typeof SVG_MANAGER !== 'undefined') {
            SVG_MANAGER.initTextures(this);
        }
        if (slider) {
            slider.value = 0; // 슬라이더 바를 0 위치로
        }
        if (timeDisplay) {
            timeDisplay.innerText = "0.0s"; // 텍스트도 0.0s로
        }
        
        // ★★★ 맵 배경 이미지 로드를 맵 데이터 로드 섹션 [4]로 이동합니다. ★★★

        // [2] 시뮬레이터 및 그래픽 초기화
        this.simulator = new GhostSimulator();
        this.enemyAI = new EnemyAI(this);
        this.cardManager = new CardDeckManager(this);
        // ★ [신규] 인터랙션 매니저 생성
        this.interactionManager = new InteractionManager(this);
        // ★ [신규] 전투 매니저 생성
        this.combatManager = new CombatManager(this);
        // ★ [신규] UI 매니저 생성
        this.uiManager = new UIManager(this);
        this.ghostGroup = this.add.group();
        
        this.fieldGraphics = this.add.graphics();
        this.fieldGraphics.setDepth(10); // 카드보다 위에 표시
        this.fieldGraphics.setVisible(false); // 평소에는 숨김
        // ★ 상단 정보 UI 생성 (실시간 예측용)
        this.createTopInfoUI();
        // ★★★ [에디터 초기화] ★★★
        this.isEditorMode = false;
        this.coordTextGroup = this.add.group();
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.setDepth(5); // 필드 그래픽보다 낮게 설정
        this.gridGraphics.setVisible(false);
        this.uiManager.setupSpeedControls();
        this.uiManager.setupTimelineEvents(); // 슬라이더 이벤트 연결
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

        // [4] 맵 데이터 로드 및 적용
        // ★★★ [맵 로드 로직] ★★★
    const stageNum = GAME_DATA.stage || 1; 
        const currentMapId = `Map${stageNum}`;
        if (typeof getMapData === 'function') {
            this.mapData = getMapData(currentMapId); 
        } else {
            console.warn("getMapData 함수가 없습니다. 기본 맵 데이터를 사용합니다.");
            this.mapData = { 
                tileSize: 40, 
                mapWidth: 25, 
                mapHeight: 15, 
                image: 'bg_battle' 
            };
        }
        // 맵 속성 적용
        this.tileSize = this.mapData.tileSize;
        this.mapWidth = this.mapData.mapWidth;
        this.mapHeight = this.mapData.mapHeight;
        // const DEPLOY_LIMIT = this.mapData.deployLimit; // 전역 변수 DEPLOY_LIMIT가 여기서 정의되거나 this에 할당되어야 합니다.

        // 맵 배경 이미지 설정 (배경 이미지 키도 맵 데이터에서 가져옴)
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, this.mapData.image);
        bg.setDisplaySize(this.scale.width, this.scale.height);
        bg.setTint(0xaaaaaa);
        
        // 맵 그리드 적용
        this.grid = this.mapData.getGrid(this.mapWidth, this.mapHeight); 
        // ★★★ (맵 로드 로직 끝) ★★★
        
        // ★★★ [기존 하드코딩된 그리드 설정 제거됨] ★★★
        
        // EasyStar 설정 (기존과 동일)
        this.easystar = new EasyStar.js();
        this.easystar.setGrid(this.grid); 
        this.easystar.setAcceptableTiles([0, 2, 3]);
        this.easystar.enableDiagonals(); 
        this.easystar.disableCornerCutting();
        this.easystar.enableSync();

        this.graphics = this.add.graphics();
        this.predictionGraphics = this.add.graphics(); 
        this.skillGraphics = this.add.graphics();
        this.skillGraphics.setDepth(100);

        this.createBase('ALLY');
        this.createBase('ENEMY');

        this.statusText = this.add.text(10, 10, `Stage ${currentStage} / Round ${this.currentRound}`, { fontSize: '16px', color: '#fff' });

        const logContainer = document.getElementById('log-container');
        if (logContainer) logContainer.style.display = 'none';

        // [5] 이벤트 리스너 등록
        this.input.on('pointerdown', (pointer) => {
            // pointer.y > this.scale.height - 230: 핸드 영역 제외
            if (pointer.y > this.scale.height - 230 || this.isPlaying) return; 
            // ★ [수정] 매니저에게 입력 위임
            this.interactionManager.handleMapClick(pointer);
        });
        
        // 버튼 이벤트 연결 (기존 코드 유지)
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
        
        // 팝업 취소 버튼 (기존 코드 유지)
        const btnPopupCancel = document.getElementById('btn-popup-cancel');
        if (btnPopupCancel) {
            btnPopupCancel.onclick = () => {
                document.getElementById('game-popup').style.display = 'none';
            };
        }

        // --- 카드 뷰어 버튼 이벤트 (기존 코드 유지) ---
    const deckBtn = document.getElementById('deck-pile');
        if (deckBtn) {
            deckBtn.onclick = () => {
                // ★ [수정] this.cardManager 사용
                const sortedDeck = [...this.cardManager.deck].sort(); 
                this.cardManager.openCardViewer(`덱 (남은 카드: ${sortedDeck.length})`, sortedDeck);
            };
        }

        const discardBtn = document.getElementById('discard-pile');
        if (discardBtn) {
            discardBtn.onclick = () => {
                // ★ [수정] this.cardManager 사용
                this.cardManager.openCardViewer(`버린 카드 (무덤: ${this.cardManager.discard.length})`, this.cardManager.discard);
            };
        }
        
        const sealBtn = document.getElementById('seal-pile');
        if (sealBtn) {
            sealBtn.onclick = (e) => {
                if (e) e.stopPropagation(); 
                // ★ [수정] this.cardManager 사용
                this.cardManager.openCardViewer(`봉인된 카드 (${this.cardManager.sealed.length})`, this.cardManager.sealed);
            };
        }

        const closeBtn = document.getElementById('btn-viewer-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('card-viewer-modal').style.display = 'none';
            };
        }

        // [6] 게임 시작 초기화
        this.cardManager.initDeck(); // ★ 매니저 호출
        this.cardManager.drawCard(5);
        this.updateCostUI();
        this.enemyAI.generateWave(GAME_DATA.stage);
        
        this.artifactManager = new ArtifactManager(this);
        this.artifactManager.init(); 
        this.toggleBattleUI(false);
        
        // ★★★ [추가] 에디터 모드 토글 버튼 추가 ★★★
        const toggleButton = document.createElement('button');
        toggleButton.innerText = '에디터 모드 (OFF)';
        toggleButton.style.position = 'absolute';
        toggleButton.style.top = '10px';
        toggleButton.style.right = '10px';
        toggleButton.style.zIndex = '100'; // 최상단에 표시
        document.body.appendChild(toggleButton);

        toggleButton.onclick = () => {
            this.isEditorMode = !this.isEditorMode;
            toggleButton.innerText = `에디터 모드 (${this.isEditorMode ? 'ON' : 'OFF'})`;
            
            // 모드 변경 시 그리드 및 좌표 표시 업데이트
            this.drawEditorGrid();
            
// ★ [수정] 매니저를 통해 구역 표시 갱신
            if (this.cardManager.selectedCardIdx !== -1) {
                this.interactionManager.drawDeploymentZones(!this.isEditorMode);
            }
        };
        // ★★★ (에디터 모드 토글 버튼 추가 끝) ★★★
    }

createTopInfoUI() {
        // 배경 바
        const barBg = this.add.rectangle(this.scale.width / 2, 30, 400, 40, 0x000000, 0.7);
        barBg.setDepth(100);
        barBg.setStrokeStyle(2, 0x444444);

        // 현재 거리 & 데드라인 정보 가져오기
        const dist = GAME_DATA.campaign.currentDistance;
        const dead = GAME_DATA.campaign.deadline;
        const gap = dist - dead;

        // 텍스트 객체 생성 (변수명: topPredictText)
        this.topPredictText = this.add.text(this.scale.width / 2, 30, "전투 분석 중...", {
            fontSize: '18px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        // 위급 상황(격차가 10km 이하)이면 빨간색으로 깜빡임 효과
        if (gap <= 10) {
            // ★ [수정] this.topDistanceText -> this.topPredictText 로 변경
            this.topPredictText.setColor('#ff5555'); 
            this.tweens.add({
                targets: this.topPredictText, // ★ 여기도 변경
                alpha: 0.5,
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }
    }

drawDeploymentZones(shouldDraw) {
        if (this.interactionManager) this.interactionManager.drawDeploymentZones(shouldDraw);
    }

    // ★ [추가] Unit/GhostSimulator 등에서 호출할 수도 있는 취소 함수 연결
    cancelDeployment(plan) {
        if (this.interactionManager) this.interactionManager.cancelDeployment(plan);
    }

    // ★ [핵심] 실시간 예측 업데이트 로직
    updatePredictionUI() {
        if (!this.topPredictText) return;

        // 1. 기지 유닛 찾기
        const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');

        if (!myBase || !enemyBase) return;

        // 2. 최대 체력 가져오기
        const myMax = GAME_DATA.maxHp || 1000;
        const enemyMax = enemyBase.stats.hp || 1000;

        // 3. 손실율 계산
        const myLoss = (myMax - myBase.currentHp) / myMax;
        const enemyLoss = (enemyMax - enemyBase.currentHp) / enemyMax;

        // 4. 예상 거리 계산 (DataManager 공식과 동일하게)
        // (적 손실 - 내 손실) * 최대거리(10km)
        const diff = enemyLoss - myLoss;
        const maxDist = GAME_DATA.campaign.stageMaxDist || 10;
        
        let predictDist = Math.floor(diff * maxDist);
        
        // 한계값 보정
        if (predictDist > maxDist) predictDist = maxDist;
        if (predictDist < -10) predictDist = -10;

        // 5. 텍스트 표시
        let sign = (predictDist > 0) ? '+' : '';
        let color = '#ffffff';

        if (predictDist > 0) color = '#00ff00'; // 전진 (녹색)
        else if (predictDist < 0) color = '#ff5555'; // 후퇴 (적색)
        else color = '#aaaaaa'; // 제자리 (회색)

        this.topPredictText.setText(`예상 결과: ${sign}${predictDist}km (적 ${Math.floor(enemyLoss*100)}% vs 나 ${Math.floor(myLoss*100)}%)`);
        this.topPredictText.setColor(color);
    }
// BattleScene.js 클래스 내부 (적절한 위치에 추가)
drawEditorGrid() {
        // 기존 그리드 및 좌표 모두 클리어
        this.gridGraphics.clear();
        this.coordTextGroup.clear(true, true);
        
        if (!this.isEditorMode) {
            this.gridGraphics.setVisible(false);
            return;
        }

        this.gridGraphics.setVisible(true);
        this.gridGraphics.lineStyle(1, 0xaaaaaa, 0.5); // 회색 얇은 선
        
        // 맵의 최종 픽셀 크기 (Phaser 캔버스 크기와 일치해야 함)
        const mapPixelWidth = this.scale.width;
        const mapPixelHeight = this.scale.height;

        // 1. 그리드 선 그리기 (맵 전체를 덮도록 확실하게)
        for (let x = 0; x <= this.mapWidth; x++) {
            const worldX = x * this.tileSize;
            this.gridGraphics.beginPath();
            // ★ X축 선: 0부터 맵의 전체 높이까지 그립니다.
            this.gridGraphics.moveTo(worldX, 0); 
            this.gridGraphics.lineTo(worldX, mapPixelHeight);
            this.gridGraphics.strokePath();
        }

        for (let y = 0; y <= this.mapHeight; y++) {
            const worldY = y * this.tileSize;
            this.gridGraphics.beginPath();
            // ★ Y축 선: 0부터 맵의 전체 너비까지 그립니다.
            this.gridGraphics.moveTo(0, worldY);
            this.gridGraphics.lineTo(mapPixelWidth, worldY);
            this.gridGraphics.strokePath();
        }

        // 2. 그리드 좌표 텍스트 및 이동 불가 구역 색상 표시 (맵 전체)
        for (let y = 0; y < this.mapHeight; y++) {
            for (let x = 0; x < this.mapWidth; x++) {
                const tileX = x * this.tileSize + this.tileSize / 2;
                const tileY = y * this.tileSize + this.tileSize / 2;
                
                // 좌표 텍스트 표시
                const coordText = this.add.text(tileX, tileY, `${x},${y}`, { 
                    fontSize: '12px', 
                    color: '#ffffff',
                    backgroundColor: '#000000d0', 
                    padding: { x: 4, y: 2 }
                }).setOrigin(0.5);
                
                coordText.setDepth(50); // 최상단에 표시
                this.coordTextGroup.add(coordText);
                
                // 이동 불가 구역 (grid[y][x] === 1) 표시
if (this.grid[y] && this.grid[y][x] === 1) {
                    // 장애물: 빨강
                    this.gridGraphics.fillStyle(0xff0000, 0.4); 
                    this.gridGraphics.fillRect(tileX - this.tileSize/2, tileY - this.tileSize/2, this.tileSize, this.tileSize);
                } else if (this.grid[y] && this.grid[y][x] === 2) {
                    // 아군 배치 구역: 파랑 (선택사항)
                    this.gridGraphics.fillStyle(0x0000ff, 0.2); 
                    this.gridGraphics.fillRect(tileX - this.tileSize/2, tileY - this.tileSize/2, this.tileSize, this.tileSize);
                } else if (this.grid[y] && this.grid[y][x] === 3) {
                    // ★ 적 감시 구역: 주황색 경고 느낌
                    this.gridGraphics.fillStyle(0xff8800, 0.3); 
                    this.gridGraphics.fillRect(tileX - this.tileSize/2, tileY - this.tileSize/2, this.tileSize, this.tileSize);
                } else {
                    // 일반 땅: 연두
                    this.gridGraphics.fillStyle(0x00ff00, 0.1); 
                    this.gridGraphics.fillRect(tileX - this.tileSize/2, tileY - this.tileSize/2, this.tileSize, this.tileSize);
                }
            }
        }
        
        this.gridGraphics.setDepth(5);
        this.coordTextGroup.setDepth(50);
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
        if (!this.isPlaying) return;
        
        const dt = (delta / 1000) * this.timeSpeed;
        if (this.artifactManager) this.artifactManager.update(dt);
        this.battleTime += dt;
        this.uiManager.updateTimeUI();
        this.easystar.calculate();
        
        this.checkSpawns();
        // ★ [추가] 실시간 예측 UI 갱신
        this.updatePredictionUI();

        // ★ 10라운드 제한
        const MAX_ROUNDS = 10; 
        
        // 1. 적 기지 파괴 (즉시 10km 전진)
        const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
        if (enemyBase && enemyBase.currentHp <= 0) {
            this.checkGameEnd('ENEMY_DESTROYED');
            return;
        }

        // 2. 아군 기지 파괴 (즉시 패배)
        const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (myBase && myBase.currentHp <= 0) {
            this.checkGameEnd('ALLY_DESTROYED');
            return;
        }

        // 3. 시간/라운드 종료
        const ROUND_TIME_LIMIT = 10.0; // 10

        if (this.battleTime >= ROUND_TIME_LIMIT) { 
            if (this.currentRound >= MAX_ROUNDS) {
                // 10라운드 끝 -> 판정승(비율 계산)
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

        // 유닛 업데이트
        this.activeUnits.forEach(unit => {
            if (unit.active) {
                if (unit.update) unit.update(dt); 
                if (unit.isBase) this.updateHpBar(unit);
            }
        });
        this.activeUnits = this.activeUnits.filter(u => u.active);

        // 투사체 업데이트
        this.activeProjectiles.forEach(proj => {
            if (proj.active && proj.update) proj.update(dt);
        });
        this.activeProjectiles = this.activeProjectiles.filter(p => p.active);
        
        this.drawCommanderHUD();
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
handleMapClick(pointer) {
        if (this.isPlaying) return;

        // [1] 클릭한 좌표를 그리드(타일) 좌표로 변환
        const tileX = Math.floor(pointer.x / this.tileSize);
        const tileY = Math.floor(pointer.y / this.tileSize);

        // [2] 에디터 모드 처리
        if (this.isEditorMode) {
            if (this.grid[tileY] && this.grid[tileY][tileX] !== undefined) {
                // 0 -> 1 -> 2 -> 3 -> 0 순환 (3번 타일도 에디터로 찍을 수 있게 수정)
                let current = this.grid[tileY][tileX];
                let nextVal = (current + 1) % 4; 
                
                this.grid[tileY][tileX] = nextVal;
                this.drawEditorGrid(); 
            }
            return; 
        }

        if (this.cardManager.selectedCardIdx === -1) return;

        if (this.cardManager.hand.length > MAX_HAND) {
            this.showPopup("🚫 패가 너무 무겁습니다!", "카드가 7장 이하여야 사용이 가능합니다!", null, false);
            return;
        }
const cardStr = this.cardManager.hand[this.cardManager.selectedCardIdx];
        const [type, name] = cardStr.split('-');
        
        const stat = this.getAdjustedStats(type, name);
        const traits = stat.traits || [];
        const hasInfiltrate = traits.includes('침투'); 

        const tileVal = (this.grid[tileY] && this.grid[tileY][tileX] !== undefined) 
                        ? this.grid[tileY][tileX] 
                        : 4; 

        if (tileVal === 4) {
             this.showFloatingText(pointer.x, pointer.y, "전장을 벗어났습니다!", '#ff0000');
             return; 
        }

        if (type === 'Unit') {
            if (tileVal === 1) {
                this.showFloatingText(pointer.x, pointer.y, "배치 불가 지형!", '#ff0000');
                return; 
            }
            if (tileVal === 3) {
                this.showFloatingText(pointer.x, pointer.y, "적 감시 구역! (배치 불가)", '#ff0000');
                return; 
            }
            if (tileVal !== 2 && !hasInfiltrate) {
                this.showFloatingText(pointer.x, pointer.y, "아군 지역이 아닙니다.", '#ff0000');
                return;
            }
        }

        if (this.playerCost < stat.cost) {
            this.showFloatingText(pointer.x, pointer.y, "코스트 부족!", '#ff0000');
            return;
        }

        const targetIdx = this.cardManager.selectedCardIdx;

        // ★ 매니저 상태 업데이트
        this.cardManager.selectedCardIdx = -1; 
        this.drawDeploymentZones(false);
        
        this.playerCost -= stat.cost;
        this.updateCostUI();
        
        // ★ 매니저에게 애니메이션 및 데이터 처리 위임
        this.cardManager.animateCardUse(targetIdx);

        const slider = document.getElementById('timeline-slider');
        let currentTime = 0;
        if (slider) currentTime = (slider.value / 100).toFixed(1);
        
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
            if (this.cardManager.selectedCardIdx !== -1) return; 
            this.cancelDeployment(plan);
            if (event) event.stopPropagation();
        });
        
        this.updateGhostSimulation();
    }

    drawDeploymentZones(shouldDraw) {
        // 1. 그래픽 초기화 (기존에 그려진 것 지우기)
        this.fieldGraphics.clear();
        this.fieldGraphics.setVisible(false);

    // ★ 매니저의 선택 상태 확인
        if (this.isEditorMode || this.isPlaying || !shouldDraw || this.cardManager.selectedCardIdx === -1) {
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

    resetAllPlans() {
        if (this.isPlaying || this.deployedObjects.length === 0) return;
        
        this.showPopup(
            "배치 초기화",
            "이번 라운드의 모든 배치를\n취소하시겠습니까?",
            () => {
                for (let i = this.deployedObjects.length - 1; i >= 0; i--) {
                    this.cancelDeployment(this.deployedObjects[i]);
                }
                this.predictionGraphics.clear();
            },
            true
        );
    }

// BattleScene.js 내부 checkSpawns 함수 교체

    checkSpawns() {
        // 1. 아군(플레이어) 배치 처리
        this.deployedObjects.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                if (plan.type === 'Unit') {
                    const stats = this.getAdjustedStats('Unit', plan.name); 
                    const spawnCount = stats.count || 1;
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (i === 0) ? 0 : (Math.random() * 40 - 20);
                        const offsetY = (i === 0) ? 0 : (Math.random() * 40 - 20);
                        this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ALLY', plan.name);
                    }
                } else {
                    // 플레이어 스킬 -> 적군(ENEMY) 타격
                    this.applySkillEffect(plan, 'ENEMY');
                }
                if (plan.visualMarker) plan.visualMarker.destroy();
                if (plan.visualText) plan.visualText.destroy();
                plan.spawned = true;
            }
        });

        // 2. 적군 웨이브 처리 (★ 수정된 부분)
        this.enemyWave.forEach(plan => {
            if (!plan.spawned && this.battleTime >= plan.time) {
                
                // ★ [핵심] 유닛인지 스킬인지 구분!
                if (plan.type === 'Unit') {
                    const stats = getEnemyStats(plan.name);
                    
                    // 안전장치: 데이터가 없으면 기본값 처리
                    if (!stats) {
                        console.error(`[Spawns] 유닛 데이터 없음: ${plan.name}`);
                        plan.spawned = true;
                        return;
                    }

                    const spawnCount = stats.count || 1;
                    for (let i = 0; i < spawnCount; i++) {
                        const offsetX = (i === 0) ? 0 : (Math.random() * 40 - 20);
                        const offsetY = (i === 0) ? 0 : (Math.random() * 40 - 20);
                        this.spawnUnit(plan.x + offsetX, plan.y + offsetY, 'ENEMY', plan.name);
                    }
                } else {
                    // ★ [추가] 적군 스킬 -> 아군(ALLY) 타격
                    this.applySkillEffect(plan, 'ALLY');
                }
                
                plan.spawned = true;
            }
        });
    }

    spawnUnit(x, y, team, name) {
        const unit = new Unit(this, x, y, name, team);
        this.activeUnits.push(unit);
        this.addLog(`${name} 소환됨`);
        return unit;
    }
// BattleScene.js 내부 applySkillEffect 함수 교체
// BattleScene.js 클래스 내부에 추가

addLog(msg, colorClass = '') {
        this.uiManager.addLog(msg, colorClass);
    }
   // [수정] 일반화된 스킬 효과 적용 함수 (변수명 불일치 해결)
applySkillEffect(plan, hostileTeam) {
        this.combatManager.applySkillEffect(plan, hostileTeam);
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

    updateHpBar(unit) {
        if (!unit.active) return;
        if (unit.isBase) unit.hpText.setText(unit.currentHp);
        else { unit.hpBar.x = unit.x; unit.hpBar.y = unit.y - 25; }
        const ratio = Math.max(0, unit.currentHp / unit.stats.hp);
        unit.hpBar.width = (unit.isBase ? 60 : 30) * ratio;
        unit.hpBar.fillColor = (ratio > 0.3) ? 0x00ff00 : 0xff0000;
    }

killUnit(unit) {
        this.combatManager.killUnit(unit);
    }

  // BattleScene.js

    // [1] 기지 생성 (지휘관별 체력 적용)
createBase(team) {
        const centerY = this.scale.height / 2; 
        const x = (team === 'ALLY') ? 100 : (this.scale.width - 100);
        const y = centerY;
        let base;
        
        let maxHp = 1000;

        if (team === 'ALLY') {
            const cmdKey = (typeof selectedCommander !== 'undefined') ? selectedCommander : 'knight';
            const cmdStat = COMMANDERS[cmdKey] || COMMANDERS['knight'];
            maxHp = cmdStat.hp; // 지휘관 고유 체력

            const baseKey = `base_${cmdKey}`; 
            if (this.textures.exists(baseKey)) {
                base = this.add.sprite(x, y, baseKey);
                base.setDisplaySize(80, 100); 
            } else {
                base = this.add.rectangle(x, y, 50, 90, 0x3366ff);
            }
            
            // ★ 체력 불러오기 (스테이지 1-1만 풀피, 나머지는 누적)
            if (GAME_DATA.stage === 1 && GAME_DATA.campaign.day === 1) {
                base.currentHp = maxHp;
                GAME_DATA.maxHp = maxHp; 
            } else {
                base.currentHp = GAME_DATA.currentHp;
                if (!GAME_DATA.maxHp) GAME_DATA.maxHp = maxHp;
            }
            
        } else {
            // 적군: 스테이지 비례 체력 증가
            maxHp = 1000 + (GAME_DATA.stage * 200);
            base = this.add.rectangle(x, y, 50, 90, 0xff3333);
            base.currentHp = maxHp;
        }

        base.team = team; 
        base.stats = { hp: maxHp }; // Max HP 저장
        base.active = true; 
        base.isBase = true;
        base.name = '기지';
        base.isSpawned = true;

        base.hpBar = this.add.rectangle(x, y - 65, 60, 8, 0x00ff00);
        base.hpText = this.add.text(x - 20, y - 80, base.currentHp, { fontSize: '12px', color: '#fff' });
        
        this.updateHpBar(base);
        this.activeUnits.push(base);
    }

    // [2] 게임 종료 및 결과 정산
    checkGameEnd(triggerType) {
        this.isPlaying = false;
        
        const myBase = this.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        const enemyBase = this.activeUnits.find(u => u.isBase && u.team === 'ENEMY');
        
        // 내 체력 저장 (다음 판으로)
        if (myBase) GAME_DATA.currentHp = myBase.currentHp;
        
        if (!myBase || myBase.currentHp <= 0) {
            this.handleGameOver("지휘관이 쓰러졌습니다...");
            return;
        }

        // 데미지 계산
        const myMaxHp = GAME_DATA.maxHp || 1000;
        const enemyMaxHp = enemyBase ? enemyBase.stats.hp : 1000;
        
        const myDamageTaken = myMaxHp - (myBase ? myBase.currentHp : 0);
        const enemyDamageTaken = enemyMaxHp - (enemyBase ? enemyBase.currentHp : 0);
        const isEnemyDestroyed = (enemyBase && enemyBase.currentHp <= 0);

        // ★ DataManager에게 결과 보고 (거리 계산)
        const moveDist = GAME_DATA.advanceCampaign(enemyDamageTaken, enemyMaxHp, myDamageTaken, myMaxHp, isEnemyDestroyed);

        if (GAME_DATA.isGameOver()) {
            // 데드라인에 잡힘
            this.handleGameOver(`데드라인에 따라잡혔습니다!\n(현재위치: ${GAME_DATA.campaign.currentDistance}km / 데드라인: ${GAME_DATA.campaign.deadline}km)`);
        } else {
            // 생존 (전진 or 후퇴)
            const isAdvance = (moveDist >= 0);
            const msgTitle = isAdvance ? "전진 성공!" : "전선 후퇴...";
            const msgColor = isAdvance ? "log-green" : "log-red";
            
            // 골드 보상: 전진 시 1km당 10G
            let rewardGold = isAdvance ? (moveDist * 10 + 20) : 10; 
            
            // [수리] 승리(전진) 시 잃은 체력의 20% 복구
            let repairMsg = "";
            if (isAdvance) {
                const lostHp = myMaxHp - GAME_DATA.currentHp;
                if (lostHp > 0) {
                    const repairAmount = Math.floor(lostHp * 0.2); 
                    GAME_DATA.currentHp = Math.min(GAME_DATA.currentHp + repairAmount, myMaxHp);
                    repairMsg = `\n🔧 수리: +${repairAmount} HP`;
                }
            }

            GAME_DATA.addGold(rewardGold);
            this.addLog(`${msgTitle} (${moveDist}km)${repairMsg.replace('\n', ', ')}`, msgColor);
            
            this.showPopup(
                msgTitle, 
                `이동 거리: ${moveDist > 0 ? '+' : ''}${moveDist}km\n` +
                `현재 위치: ${GAME_DATA.campaign.currentDistance}km\n` +
                `(데드라인: ${GAME_DATA.campaign.deadline}km)\n\n` +
                `💰 골드: +${rewardGold}G` + 
                `${repairMsg}`, 
                () => {
                    GAME_DATA.stage++; 
                    this.scene.start('MapScene'); 
                }
            );
        }
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
        // 현재 살아있는 유닛들만 가지고 10초간 시뮬레이션을 돌림
        // 적군의 예정된 행동은 아직 없으므로 allyPlans, enemyPlans는 빈 배열
        const simulationResults = this.simulator.run(
            10.0, // 10초 예측
            [],   // 추가 배치 없음
            [],   // 적군 추가 없음
            this.activeUnits, // 현재 필드 유닛만
            { 
                width: this.scale.width, 
                height: this.scale.height,
                grid: this.grid,
                tileSize: this.tileSize,
                easystar: this.easystar
            }
        );
        
        return simulationResults; // 시간대별 유닛들의 위치 정보가 담겨 있음
    }

    // ★ [Strategy] 유닛 배치 위치 결정
// BattleScene.js 내부 함수 교체

    updateGhostSimulation() {
        this.ghostGroup.clear(true, true);
        this.predictionGraphics.clear(); 
        
        if (this.isPlaying) return;

        const slider = document.getElementById('timeline-slider');
        if (!slider) return;
        const currentTime = parseFloat(slider.value) / 100;

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
                easystar: this.easystar   
            }
        );

        results.forEach(vUnit => {
            // ★ [수정] 기지('기지')도 이제 시각화 대상에 포함시킵니다!
            // (vUnit.name === '기지' 제외 조건을 삭제함)
            if (!vUnit.isSpawned) return; 
            
            if (vUnit.active) {
                const color = (vUnit.team === 'ALLY') ? 0x00ff00 : 0xff0000;
                this.createGhost(vUnit.x, vUnit.y, vUnit.name, color, 0.6, vUnit.currentHp, vUnit.stats.hp);
            } else {
                // 사망 시 (기지 파괴 포함)
                const skull = this.add.text(vUnit.x, vUnit.y, '💀', { 
                    fontSize: '24px',
                    stroke: '#000',
                    strokeThickness: 3
                }).setOrigin(0.5);
                this.ghostGroup.add(skull);
            }
        });

        // 적 스킬 예고
        this.enemyWave.forEach(plan => {
            if (plan.type === 'Skill' && Math.abs(plan.time - currentTime) < 0.5) {
                const stats = SKILL_STATS[plan.name];
                if (stats) {
                    this.predictionGraphics.lineStyle(2, 0xff0000, 1.0); 
                    this.predictionGraphics.fillStyle(0xff0000, 0.2);    
                    this.predictionGraphics.fillCircle(plan.x, plan.y, stats.radius);
                    this.predictionGraphics.strokeCircle(plan.x, plan.y, stats.radius);
                    
                    const text = this.add.text(plan.x, plan.y - 40, `⚠️${plan.name}`, { 
                        fontSize:'12px', color:'#ff0000', fontStyle:'bold', stroke: '#fff', strokeThickness: 2
                    }).setOrigin(0.5);
                    this.ghostGroup.add(text); 
                }
            }
        });
    }
    
    // [보조 함수] drawPredictions를 위한 빈 함수 (호환성 유지)
    drawPredictions() {
        this.updateGhostSimulation();
    }

  createGhost(x, y, name, color, alpha, currentHp, maxHp) {
        let imgKey = '';
        if (UNIT_STATS[name] && UNIT_STATS[name].image) {
             imgKey = UNIT_STATS[name].image; 
        } else {
             imgKey = 'img_' + name; 
        }

        let ghost;
        if (this.textures.exists(imgKey)) {
            ghost = this.add.sprite(x, y, imgKey);
            ghost.setDisplaySize(40, 40); 
            ghost.setTint(0x888888); 
        } else {
            ghost = this.add.circle(x, y, 15, color);
        }
        
        // ★ [수정] 기지의 경우 유령 이미지는 숨기고(Alpha=0), 체력바만 보여줍니다.
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
            
            // 가운데 정렬 보정을 위해 컨테이너를 쓰거나, 여기선 간단히 유지
            this.ghostGroup.add(hpBar);
        }

        return ghost;
    }


updateCostUI() {
        this.uiManager.updateCostUI();
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
}