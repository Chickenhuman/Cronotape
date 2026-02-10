// js/managers/EnemyAI.js

class EnemyAI {
    constructor(scene) {
        this.scene = scene; // BattleScene 참조
    }

    // ============================================================
    // ★ [AI System] 적군 웨이브 생성 (메인 함수)
    // ============================================================
    generateWave(stage) {
        const stageNum = parseInt(stage) || 1;
        this.scene.enemyWave = []; // 웨이브 초기화

        // 현재 스테이지 적 데이터 가져오기
        let cmdData = this.scene.currentEnemyData;
        if (!cmdData) {
            console.warn("[AI] 현재 적군 데이터가 없습니다.");
            return;
        }

        const enemyDeck = cmdData.deck;
        // 라운드가 지날수록 사용할 수 있는 코스트 증가
        let aiCost = cmdData.baseCost + (stageNum * 2);

        this.scene.addLog(`[AI] ${cmdData.name} 행동 개시 (Cost: ${aiCost})`, "log-red");

        // 1. [Future Sight] 미래 예측 시뮬레이션 가동
        const futureData = this.scene.runPreSimulation();
        const analysis = this.analyzeSituation(futureData); 

        // 2. [Decision] 행동 결정 루프
        let attempts = 0;
        let unitCount = 0;
        const MAX_UNITS = 20;   // 유닛 최대 소환 제한
        const MAX_ATTEMPTS = 100; // 무한 루프 방지용

        // ★ 스킬 쿨타임 관리 (유닛들이 겹쳐서 나오지 않게 시간차를 둠)
        let currentTimeCursor = 1.5; 

        while (aiCost > 0 && attempts < MAX_ATTEMPTS && unitCount < MAX_UNITS) {
            attempts++;
            
            // 덱에서 무작위 카드 한 장 뽑기
            const cardName = enemyDeck[Math.floor(Math.random() * enemyDeck.length)];
            
            // ----------------------------------------------------
            // (A) 스킬 카드인 경우
            // ----------------------------------------------------
            if (SKILL_STATS[cardName]) {
                const skill = SKILL_STATS[cardName];
                
                // 코스트 부족하면 패스
                if (aiCost < skill.cost) continue;

                // 타겟 선정 로직
                let target = null;

                // 공격형 스킬 (화염구, 돌멩이, 얼음 등)
                if (skill.damage > 0 || skill.effect === 'stun' || skill.effect === 'freeze') {
                    // 1순위: 뭉친 곳 (Cluster)
                    if (analysis.bestCluster) {
                        target = analysis.bestCluster; 
                    } 
                    // 2순위: 기지 (Base)
                    else if (analysis.enemyBase) {
                        // 기지는 항상 있으므로 너무 난사하지 않게 확률 조정 (50%)
                        if (Math.random() < 0.5) {
                            target = { x: analysis.enemyBase.x, y: analysis.enemyBase.y };
                        }
                    }
                }
                // (추후 확장) 버프/방어형 스킬 로직 추가 가능

                // 타겟이 정해졌으면 스킬 예약
                if (target) {
                    const castTime = currentTimeCursor + Phaser.Math.FloatBetween(0.2, 1.0);
                    
                    this.scene.enemyWave.push({
                        time: castTime,
                        type: 'Skill', name: cardName,
                        x: target.x, y: target.y,
                        spawned: false
                    });

                    aiCost -= skill.cost;
                    currentTimeCursor = castTime + 1.5; // 스킬 후 딜레이
                    this.scene.addLog(`[AI] ${cardName} 시전 준비!`, "log-purple");
                    
                    // 광역기를 한 번 쓰면 해당 위치 정보 삭제 (중복 타격 방지)
                    if (skill.radius && skill.radius > 50) analysis.bestCluster = null; 
                }
                continue; // 다음 카드로 넘어감
            }

            // ----------------------------------------------------
            // (B) 유닛 카드인 경우
            // ----------------------------------------------------
            const unitStats = (typeof getEnemyStats === 'function') ? getEnemyStats(cardName) : UNIT_STATS[cardName];
            
            // 데이터가 없거나 코스트 부족하면 패스
            if (!unitStats || aiCost < unitStats.cost) continue;

            // 유닛 배치 위치 계산
            const spawnPlan = this.decideSmartPosition(cmdData.aiType, cardName, analysis);
            
            if (spawnPlan) {
                // 소환 시간 설정 (이전 행동보다 뒤에)
                spawnPlan.time = Math.max(spawnPlan.time, currentTimeCursor);
                
                this.scene.enemyWave.push(spawnPlan);
                
                aiCost -= Math.max(1, unitStats.cost);
                unitCount++;
                
                // 유닛 간 약간의 간격
                currentTimeCursor = spawnPlan.time + 0.3; 
            }
        }

        // 시간순 정렬 (먼저 예약된 것부터 실행되도록)
        this.scene.enemyWave.sort((a, b) => a.time - b.time);
        console.log(`[AI] 배치 완료: 유닛 ${unitCount}기, 스킬 포함 총 ${this.scene.enemyWave.length}건 예약.`);
    }

    // ----------------------------------------------------------------
    // ★ [AI Brain] 전장 상황 분석기 (수정됨)
    // ----------------------------------------------------------------
    analyzeSituation(futureData) {
        const laneH = this.scene.scale.height / 3;
        const lanes = {
            0: { count: 0, name: 'TOP' },
            1: { count: 0, name: 'MID' },
            2: { count: 0, name: 'BOT' }
        };

        let clusters = []; 
        let enemyBasePos = null; 

        if (futureData && Array.isArray(futureData)) {
            futureData.forEach(u => {
                // 유효하지 않거나 죽은 유닛 무시
                if (!u || !u.active) return;

                if (u.team === 'ALLY') {
                    // ★ [수정됨] 기지 인식 로직 개선
                    // 이름이 '기지'이거나, 'Base_'로 시작하거나, isBase 플래그가 있으면 기지로 인정
                    if (u.name === '기지' || (u.name && u.name.startsWith('Base')) || u.isBase) {
                        enemyBasePos = { x: u.x, y: u.y };
                        return; 
                    }

                    // 좌표 안전 검사
                    if (typeof u.y !== 'number' || isNaN(u.y)) return;

                    // 라인별 유닛 수 카운트
                    const laneIdx = Math.floor(u.y / laneH);
                    const safeIdx = Phaser.Math.Clamp(laneIdx, 0, 2);
                    if (lanes[safeIdx]) lanes[safeIdx].count++;

                    // 밀집도(Cluster) 분석 (화염구 각)
                    // 랜덤 샘플링으로 성능 최적화 (15% 확률로만 검사)
                    if (Math.random() < 0.15) { 
                        let count = 0;
                        futureData.forEach(other => {
                            if (other.active && other.team === 'ALLY' && !other.isBase &&
                                Phaser.Math.Distance.Between(u.x, u.y, other.x, other.y) < 120) {
                                count++;
                            }
                        });
                        // 3기 이상 뭉쳐있으면 타겟 후보
                        if (count >= 3) {
                            clusters.push({ time: u.spawnTime || 2.0, x: u.x, y: u.y, count: count });
                        }
                    }
                }
            });
        }

        // 가장 많이 뭉친 곳 찾기
        clusters.sort((a, b) => b.count - a.count);
        const bestCluster = clusters.length > 0 ? clusters[0] : null;
        
        // 라인 상황 정렬
        const sortedLanes = Object.keys(lanes).map(k => ({ id: k, ...lanes[k] })).sort((a, b) => b.count - a.count);

        return {
            lanes: lanes,
            busyLane: parseInt(sortedLanes[0].id),
            emptyLane: parseInt(sortedLanes[sortedLanes.length - 1].id),
            bestCluster: bestCluster,
            enemyBase: enemyBasePos, // 이제 정상적으로 좌표가 들어옵니다!
            laneHeight: laneH
        };
    }

    // ----------------------------------------------------------------
    // ★ [AI Strategy] 유닛 배치 전략 (기존 GameLogic 연동 유지)
    // ----------------------------------------------------------------
    decideSmartPosition(aiType, unitName, analysis) {
        const time = parseFloat(Phaser.Math.FloatBetween(1.0, 6.0).toFixed(1));
        const stats = UNIT_STATS[unitName];
        if (!stats) return null;

        const isInfiltrator = (stats.traits && stats.traits.includes('침투'));
        
        // X 좌표 결정
        const mapRightEdge = (this.scene.mapWidth * this.scene.tileSize);
        const safeSpawnX = Math.min(this.scene.scale.width, mapRightEdge) - 80;
        const spawnX = Phaser.Math.Between(safeSpawnX - 50, safeSpawnX);        
        
        // Y 좌표 결정 (레인 분석 기반)
        let spawnY = -1;
        const lh = analysis.laneHeight || 200; 
        let targetLaneIndex = 1; 

        if (aiType === 'TRICKY') targetLaneIndex = analysis.emptyLane;
        else if (aiType === 'DEFENSIVE') targetLaneIndex = analysis.busyLane;
        else {
            const isTank = (stats.hp >= 100 || unitName === '방벽');
            if (isTank) targetLaneIndex = analysis.busyLane;
            else if (isInfiltrator) targetLaneIndex = analysis.emptyLane;
            else targetLaneIndex = Phaser.Math.Between(0, 2);
        }

        // 유효한 Y 좌표 탐색 (지형지물 회피)
        for (let i = 0; i < 15; i++) { 
            const currentLane = (i < 10) ? targetLaneIndex : Phaser.Math.Between(0, 2);
            const minY = currentLane * lh + 30;
            const maxY = (currentLane + 1) * lh - 30;
            const tryY = Phaser.Math.Between(minY, maxY);

            if (tryY < 50 || tryY > this.scene.scale.height - 50) continue;

            const tileX = Math.floor(spawnX / this.scene.tileSize);
            const tileY = Math.floor(tryY / this.scene.tileSize);
            const grid = this.scene.grid;
            const tileVal = (grid[tileY] && grid[tileY][tileX] !== undefined) ? grid[tileY][tileX] : 4;

            let isValid = false;
            if (tileVal !== 1 && tileVal !== 4) {
                if (isInfiltrator) {
                    if (tileVal === 0 || tileVal === 3) isValid = true;
                } else {
                    if (tileVal === 3) isValid = true; // 적 진영(3)에만 배치 가능
                }
            }
            if (tileVal === 2) isValid = false; // 아군 진영 불가

            if (isValid) { 
                spawnY = tryY;
                break;
            }
        }

        if (spawnY !== -1) {
            // GameLogic의 공용 함수 사용하여 위치 분산
            const offsets = (typeof GameLogic !== 'undefined') ? GameLogic.getSpawnOffsets(stats.count || 1, 40) : [];

            return { 
                time, type: 'Unit', name: unitName, x: spawnX, y: spawnY, spawned: false,
                offsets: offsets 
            };
        }
        return null;
    }
}