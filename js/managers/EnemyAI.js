// js/managers/EnemyAI.js

class EnemyAI {
    constructor(scene) {
        this.scene = scene; // BattleScene에 접근하기 위한 참조
    }

    // ============================================================
    // ★ [AI System] 적군 웨이브 생성 (메인 함수)
    // ============================================================
    generateWave(stage) {
        // 기존 BattleScene의 enemyWave 배열 초기화
        this.scene.enemyWave = [];

        const stageNum = parseInt(stage);
        let cmdData = ENEMY_COMMANDERS[stageNum];

        if (!cmdData) {
            console.warn(`[AI] Stage ${stageNum} 데이터 없음. 기본값 사용.`);
            cmdData = DEFAULT_ENEMY_COMMANDER;
        }

        const enemyDeck = cmdData.deck;
        // 라운드 난이도 반영
        let aiCost = cmdData.baseCost + (stageNum * 2) + (this.scene.currentRound - 1) * 2;

        this.scene.addLog(`[AI] ${cmdData.name} 행동 개시 (Cost: ${aiCost})`, "log-red");

        // 1. [Future Sight] 분석 (BattleScene의 시뮬레이터 결과 사용)
        const futureData = this.scene.runPreSimulation();
        const analysis = this.analyzeSituation(futureData); 

        // 2. [Decision] 행동 결정 루프
        let attempts = 0;
        let unitCount = 0;
        const MAX_UNITS = 20;

        while (aiCost > 0 && attempts < 100 && unitCount < MAX_UNITS) {
            attempts++;

            // (A) 스킬 사용 (화염구 등)
            if (cmdData.aiType === 'TACTICAL_AOE' && enemyDeck.includes('화염구')) {
                const skillCost = SKILL_STATS['화염구'].cost;
                
                if (aiCost >= skillCost) {
                    let target = analysis.bestCluster; 
                    if (!target && analysis.enemyBase) {
                        target = { time: 2.0, x: analysis.enemyBase.x, y: analysis.enemyBase.y };
                    }

                    if (target) {
                        const tX = Math.floor(target.x / this.scene.tileSize);
                        const tY = Math.floor(target.y / this.scene.tileSize);
                        
                        // 지형 체크 (scene.grid 참조)
                        const grid = this.scene.grid;
                        const tVal = (grid[tY] && grid[tY][tX] !== undefined) ? grid[tY][tX] : 4;
                        
                        if (tVal !== 4) { 
                            this.scene.enemyWave.push({
                                time: target.time,
                                type: 'Skill', name: '화염구',
                                x: target.x, y: target.y,
                                spawned: false
                            });
                            aiCost -= skillCost;
                            this.scene.addLog(`[AI] 화염구 발사!`, "log-purple");
                            if (Math.random() < 0.5) analysis.bestCluster = null; 
                            continue;
                        }
                    }
                }
            }

            // (B) 유닛 배치
            const cardName = enemyDeck[Math.floor(Math.random() * enemyDeck.length)];
            if (SKILL_STATS[cardName]) continue; 

            const unitStats = (typeof getEnemyStats === 'function') ? getEnemyStats(cardName) : UNIT_STATS[cardName];
            if (!unitStats) continue;

            if (aiCost >= unitStats.cost) {
                const spawnPlan = this.decideSmartPosition(cmdData.aiType, cardName, analysis);
                
                if (spawnPlan) {
                    this.scene.enemyWave.push(spawnPlan);
                    aiCost -= Math.max(1, unitStats.cost);
                    unitCount++;
                }
            }
        }

        this.scene.enemyWave.sort((a, b) => a.time - b.time);
        console.log(`[AI] 배치 완료: ${unitCount}기 예약됨.`);
    }

    // ----------------------------------------------------------------
    // ★ [AI Brain] 전장 상황 분석기
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
                // ★ [안전장치] 유효하지 않거나 죽은 유닛 무시
                if (!u || !u.active) return;

                if (u.team === 'ALLY') {
                    // ★ [기지 처리] 기지는 위치만 저장하고 병력 카운트에서는 제외
                    if (u.name === '기지') {
                        enemyBasePos = { x: u.x, y: u.y };
                        return; 
                    }

                    // 좌표 안전 검사
                    if (typeof u.y !== 'number' || isNaN(u.y)) return;

                    const laneIdx = Math.floor(u.y / laneH);
                    const safeIdx = Phaser.Math.Clamp(laneIdx, 0, 2);
                    
                    // 해당 라인 카운트 증가
                    if (lanes[safeIdx]) {
                        lanes[safeIdx].count++;
                    }

                    // 밀집도(Cluster) 분석 (화염구 각)
                    if (Math.random() < 0.15) { 
                        let count = 0;
                        futureData.forEach(other => {
                            if (other.active && other.team === 'ALLY' && other.name !== '기지' &&
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

        clusters.sort((a, b) => b.count - a.count);
        const bestCluster = clusters.length > 0 ? clusters[0] : null;
        const sortedLanes = Object.keys(lanes).map(k => ({ id: k, ...lanes[k] })).sort((a, b) => b.count - a.count);

        return {
            lanes: lanes,
            busyLane: parseInt(sortedLanes[0].id),
            emptyLane: parseInt(sortedLanes[sortedLanes.length - 1].id),
            bestCluster: bestCluster,
            enemyBase: enemyBasePos,
            laneHeight: laneH
        };
    }

    // ----------------------------------------------------------------
    // ★ [AI Strategy] 유닛 배치 전략
    // ----------------------------------------------------------------
    decideSmartPosition(aiType, unitName, analysis) {
        const time = parseFloat(Phaser.Math.FloatBetween(1.0, 6.0).toFixed(1));
        const stats = UNIT_STATS[unitName];
        if (!stats) return null;

        const isInfiltrator = (stats.traits && stats.traits.includes('침투'));
        const spawnX = Phaser.Math.Between(this.scene.scale.width - 150, this.scene.scale.width - 50);
        let spawnY = -1;

        const lh = analysis.laneHeight || 200; 
        let targetLaneIndex = 1; 

        if (aiType === 'TRICKY') {
            targetLaneIndex = analysis.emptyLane;
        } else if (aiType === 'DEFENSIVE') {
            targetLaneIndex = analysis.busyLane;
        } else {
            const isTank = (stats.hp >= 100 || unitName === '방벽');
            if (isTank) targetLaneIndex = analysis.busyLane;
            else if (isInfiltrator) targetLaneIndex = analysis.emptyLane;
            else targetLaneIndex = Phaser.Math.Between(0, 2);
        }

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

            if (tileVal === 1 || tileVal === 4) {
                isValid = false;
            } else {
                if (isInfiltrator) {
                    if (tileVal === 0 || tileVal === 3) isValid = true;
                } else {
                    if (tileVal === 3) isValid = true;
                }
            }

            if (tileVal === 2) isValid = false;

            if (isValid) { 
                spawnY = tryY;
                break;
            }
        }

        if (spawnY !== -1) {
            return { time, type: 'Unit', name: unitName, x: spawnX, y: spawnY, spawned: false };
        }
        return null; 
    }
}