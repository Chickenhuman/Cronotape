// js/managers/EnemyAI.js

class EnemyAI {
    constructor(scene) {
        this.scene = scene;
        
        // ★ AI 전용 덱 시스템 (메모리 상에만 존재하며 화면엔 보이지 않음)
        this.virtualDeck = [];
        this.virtualHand = [];
        this.virtualDiscard = [];
        this.isInitialized = false;
    }

    // ============================================================
    // ★ [AI System] 적군 웨이브 생성 (플레이어 규칙 완벽 적용)
    // ============================================================
    generateWave(stage) {
        const stageNum = parseInt(stage) || 1;
        this.scene.enemyWave = [];

        // 1. 적 데이터 로드
        let cmdData = this.scene.currentEnemyData;
        if (!cmdData) return;

        // 2. 덱 초기화 및 드로우 (라운드 규칙 적용)
        if (!this.isInitialized) {
            // 첫 라운드: 덱 생성 후 5장 드로우
            this.initDeck(cmdData.deck);
            this.drawCards(5); 
            this.isInitialized = true;
            this.scene.addLog(`[AI] ${cmdData.name} 대전 시작! (Hand: ${this.virtualHand.length})`, "log-red");
        } else {
            // 이후 라운드: 3장씩 추가 드로우 (플레이어와 동일)
            this.drawCards(3);
            
            // 만약 패가 너무 말려서(0장) 아무것도 못하면 최소한의 저항을 위해 1장 더
            if (this.virtualHand.length === 0) this.drawCards(1);
        }

        // 3. 이번 라운드 가용 예산 설정
        let aiCost = cmdData.baseCost + (stageNum * 2);
        
        // 4. 전장 상황 분석 (미래 예측)
        const futureData = this.scene.runPreSimulation();
        const situation = this.analyzeSituation(futureData); 
        
        // 현재 손패의 역할군 분석 (탱커/딜러/스킬 분류)
        const deckAnalysis = this.analyzeHandRole(); 

        // 5. [Phase 1] 스킬 사용 전략 수립
        // (위급하거나 좋은 기회면 코스트를 먼저 할당)
        aiCost = this.planSkills(aiCost, deckAnalysis.skills, situation);

        // 6. [Phase 2] 유닛 조합 구성
        // (남은 코스트와 패로 최적의 조합 찾기)
        const wavePlan = this.planUnitComposition(aiCost, deckAnalysis, situation);

        // 7. [Phase 3] 실제 웨이브 예약 및 카드 소모 처리
        let currentTimeCursor = 1.5; // 유닛 소환 시작 시간 (약간의 텀)

        wavePlan.forEach(plan => {
            // 시간차 배치 (유닛 겹침 방지)
            plan.time = Math.max(plan.time || 0, currentTimeCursor);
            
            this.scene.enemyWave.push(plan);
            
            // ★ 중요: 사용한 카드는 가상 핸드에서 제거 (즉시 리필되지 않음)
            this.discardCard(plan.name);

            // 다음 유닛은 0.5초 뒤에 소환
            currentTimeCursor = plan.time + 0.5; 
        });
        
        // 예약된 순서대로 정렬 (먼저 소환될 유닛부터)
        this.scene.enemyWave.sort((a, b) => a.time - b.time);
        
        console.log(`[AI] 배치 완료: ${wavePlan.length}장 사용. (남은 패: ${this.virtualHand.length}장, 남은 코스트: ${aiCost})`);
    }

    // ============================================================
    // 🃏 [Deck System] 카드 관리 (드로우, 셔플, 버리기)
    // ============================================================
    initDeck(originalDeck) {
        this.virtualDeck = [...originalDeck];
        this.shuffleDeck();
        this.virtualHand = [];
        this.virtualDiscard = [];
    }

    shuffleDeck() {
        this.virtualDeck.sort(() => Math.random() - 0.5);
    }

    drawCards(count) {
        for (let i = 0; i < count; i++) {
            // 덱이 비었으면 무덤을 섞어서 리필
            if (this.virtualDeck.length === 0) {
                if (this.virtualDiscard.length > 0) {
                    this.virtualDeck = [...this.virtualDiscard];
                    this.virtualDiscard = [];
                    this.shuffleDeck();
                    // console.log("[AI] 덱 리필 및 셔플!");
                } else {
                    // 덱도 무덤도 없으면 드로우 불가
                    break;
                }
            }
            this.virtualHand.push(this.virtualDeck.pop());
        }
    }

    // 카드를 사용하면 핸드에서 제거하고 무덤으로 보냄
    discardCard(cardName) {
        const idx = this.virtualHand.indexOf(cardName);
        if (idx > -1) {
            this.virtualHand.splice(idx, 1);
            this.virtualDiscard.push(cardName);
        }
    }

    // ============================================================
    // 🔍 [Analyzer] 현재 '손패' 분석
    // ============================================================
    analyzeHandRole() {
        const roles = {
            tanks: [],   // 탱커 역할군
            dps: [],     // 딜러 역할군
            skills: []   // 스킬 카드
        };

        this.virtualHand.forEach(cardName => {
            if (SKILL_STATS[cardName]) {
                roles.skills.push(cardName);
            } else {
                const stats = (typeof getEnemyStats === 'function') ? getEnemyStats(cardName) : UNIT_STATS[cardName];
                if (!stats) return;

                // 역할 분류: 체력 120 이상이거나 방어 특성이면 탱커
                if (stats.hp >= 120 || (stats.traits && stats.traits.includes("Defense"))) {
                    roles.tanks.push({ name: cardName, cost: stats.cost, stats: stats });
                } else {
                    roles.dps.push({ name: cardName, cost: stats.cost, stats: stats });
                }
            }
        });

        // 가성비 순(비싼 순) 정렬 -> 강력한 유닛을 먼저 고려하기 위함
        roles.tanks.sort((a, b) => b.cost - a.cost);
        roles.dps.sort((a, b) => b.cost - a.cost);

        return roles;
    }

    // ============================================================
    // ⚔️ [Planner] 스킬 전략 수립
    // ============================================================
    planSkills(currentCost, skills, situation) {
        if (skills.length === 0) return currentCost;

        // [전략] 공격 스킬 각 보기 (아군이 뭉친 곳)
        if (situation.bestCluster && situation.bestCluster.count >= 3) {
            // 현재 코스트로 쓸 수 있는 공격 스킬 찾기
            const nuke = skills.find(s => {
                const stat = SKILL_STATS[s];
                return stat && stat.cost <= currentCost && stat.damage > 0;
            });

            if (nuke) {
                const stat = SKILL_STATS[nuke];
                this.scene.enemyWave.push({
                    time: situation.bestCluster.time - 0.5, // 적들이 모이기 직전에
                    type: 'Skill', name: nuke,
                    x: situation.bestCluster.x, y: situation.bestCluster.y,
                    spawned: false
                });
                
                // 여기서 바로 소모 처리 (유닛 예산에서 제외하기 위해 discardCard 호출)
                this.discardCard(nuke); 
                return currentCost - stat.cost;
            }
        }
        
        // (추후 확장 가능: 기지가 위험할 때 방벽 스킬 사용 등)
        
        return currentCost;
    }

    // ============================================================
    // 🛡️ [Planner] 유닛 조합 (탱커 + 딜러) 구성
    // ============================================================
    planUnitComposition(budget, roles, situation) {
        const plan = [];
        let remainingBudget = budget;

        // [전략 1] 든든한 국밥 탱커 확보
        // 패에 탱커가 있고 예산이 되면, 가장 좋은 탱커 1기를 최우선 배치
        if (roles.tanks.length > 0) {
            const bestTank = roles.tanks[0];
            if (remainingBudget >= bestTank.cost) {
                const pos = this.decideSmartPosition('DEFENSIVE', bestTank.name, situation);
                if (pos) {
                    plan.push(pos);
                    remainingBudget -= bestTank.cost;
                    roles.tanks.shift(); // 사용했으므로 목록에서 제거
                }
            }
        }

        // [전략 2] 남은 돈으로 딜러진 화력 집중
        // 패에 있는 딜러들을 예산이 허락하는 한 배치
        for (let i = 0; i < roles.dps.length; i++) {
            const dps = roles.dps[i];
            if (remainingBudget >= dps.cost) {
                const pos = this.decideSmartPosition('AGGRESSIVE', dps.name, situation);
                if (pos) {
                    plan.push(pos);
                    remainingBudget -= dps.cost;
                }
            }
        }
        
        // [전략 3] 그래도 돈이 남고 탱커 패가 남으면 추가 배치 (고기방패)
        if (remainingBudget > 0 && roles.tanks.length > 0) {
             for (let i = 0; i < roles.tanks.length; i++) {
                const tank = roles.tanks[i];
                if (remainingBudget >= tank.cost) {
                    const pos = this.decideSmartPosition('DEFENSIVE', tank.name, situation);
                    if (pos) {
                        plan.push(pos);
                        remainingBudget -= tank.cost;
                    }
                }
            }
        }

        return plan;
    }

    // ============================================================
    // ★ [AI Brain] 전장 상황 분석기 (기존 로직 개선)
    // ============================================================
    analyzeSituation(futureData) {
        const laneH = this.scene.scale.height / 3;
        const lanes = { 0: { count: 0 }, 1: { count: 0 }, 2: { count: 0 } };
        let clusters = []; 
        let enemyBasePos = null; 

        if (futureData && Array.isArray(futureData)) {
            futureData.forEach(u => {
                if (!u || !u.active) return;
                
                // 아군(플레이어) 정보 분석
                if (u.team === 'ALLY') {
                    // 기지 위치 파악 (이름 패턴 매칭 강화)
                    if (u.name === '기지' || (u.name && u.name.startsWith('Base')) || u.isBase) {
                        enemyBasePos = { x: u.x, y: u.y };
                        return; 
                    }
                    if (typeof u.y !== 'number') return;

                    // 라인별 병력 카운트
                    const laneIdx = Math.floor(u.y / laneH);
                    const safeIdx = Phaser.Math.Clamp(laneIdx, 0, 2);
                    lanes[safeIdx].count++;

                    // 뭉침 분석 (화염구 타겟팅용) - 30% 확률 샘플링
                    if (Math.random() < 0.3) { 
                        let count = 0;
                        futureData.forEach(other => {
                            if (other.active && other.team === 'ALLY' && !other.isBase &&
                                Phaser.Math.Distance.Between(u.x, u.y, other.x, other.y) < 120) {
                                count++;
                            }
                        });
                        if (count >= 3) clusters.push({ time: u.spawnTime || 2.0, x: u.x, y: u.y, count: count });
                    }
                }
            });
        }

        // 가장 많이 뭉친 클러스터 선정
        clusters.sort((a, b) => b.count - a.count);
        const bestCluster = clusters[0] || null;

        // 가장 붐비는 라인과 빈 라인 찾기
        const sortedLanes = Object.keys(lanes).sort((a, b) => lanes[b].count - lanes[a].count);
        const busyLane = parseInt(sortedLanes[0]);
        const emptyLane = parseInt(sortedLanes[sortedLanes.length - 1]);

        return { lanes, busyLane, emptyLane, bestCluster, enemyBase: enemyBasePos, laneHeight: laneH };
    }

    // ============================================================
    // 🗺️ [Positioning] 스마트 배치 위치 결정
    // ============================================================
    decideSmartPosition(role, unitName, situation) {
        const stats = UNIT_STATS[unitName];
        if (!stats) return null;

        const time = Phaser.Math.FloatBetween(0.5, 3.0); 
        const mapRightEdge = (this.scene.mapWidth * this.scene.tileSize);
        const safeSpawnX = Math.min(this.scene.scale.width, mapRightEdge) - 80;
        
        // 약간의 X좌표 랜덤성 (일열종대 방지)
        const spawnX = Phaser.Math.Between(safeSpawnX - 40, safeSpawnX + 20);

        let targetLane = 1; 

        // 역할에 따른 라인 선택
        if (role === 'DEFENSIVE') {
            targetLane = situation.busyLane; // 방어는 적이 많은 곳으로
        } else if (role === 'AGGRESSIVE') {
            if (stats.traits && stats.traits.includes("침투")) {
                targetLane = situation.emptyLane; // 암살자는 빈 곳으로
            } else {
                targetLane = situation.busyLane; // 딜러는 아군 지원
            }
        }

        const lh = situation.laneHeight;
        let spawnY = -1;

        // 유효한 Y좌표 탐색 (최대 10회 시도)
        for (let i = 0; i < 10; i++) {
            const minY = targetLane * lh + 40;
            const maxY = (targetLane + 1) * lh - 40;
            const tryY = Phaser.Math.Between(minY, maxY);
            
            const tX = Math.floor(spawnX / this.scene.tileSize);
            const tY = Math.floor(tryY / this.scene.tileSize);
            const grid = this.scene.grid;
            const val = (grid[tY] && grid[tY][tX] !== undefined) ? grid[tY][tX] : 4;

            // 적군 영토(3)이거나, 침투 유닛이면 적당한 곳에 배치
            if (val === 3 || (stats.traits && stats.traits.includes("침투") && val !== 1 && val !== 2)) {
                spawnY = tryY;
                break;
            }
        }

        if (spawnY !== -1) {
            // 물량 유닛 분산 배치 (GameLogic 활용)
            const offsets = (typeof GameLogic !== 'undefined') ? GameLogic.getSpawnOffsets(stats.count || 1, 35) : [];
            return { 
                time, type: 'Unit', name: unitName, x: spawnX, y: spawnY, spawned: false,
                offsets: offsets 
            };
        }
        return null;
    }
}