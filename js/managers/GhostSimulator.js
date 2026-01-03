// js/managers/GhostSimulator.js

class GhostSimulator {
    constructor() {
        this.stepTime = 0.1;
        this.mapGrid = null; 
    }
    
    // 객체 깊은 복사 (traits 배열 포함)
    fastCloneStats(stats) {
        const newStats = Object.assign({}, stats);
        if (Array.isArray(stats.traits)) {
            newStats.traits = [...stats.traits];
        }
        return newStats;
    }

    run(targetTime, allyPlans, enemyPlans, currentUnits, mapContext) {
        // 1. 맵 데이터 가져오기
        if (!this.mapGrid) {
            const scene = window.game?.scene?.getScene('BattleScene') || window.game?.scene?.getScene('MapScene');
            if (scene && scene.mapData) {
                this.mapGrid = scene.mapData;
            }
        }

        // 2. 유물 데이터 가져오기
        this.artifacts = [];
        if (typeof GAME_DATA !== 'undefined' && GAME_DATA.artifacts) {
            this.artifacts = GAME_DATA.artifacts;
        }

        let ghosts = currentUnits.map(u => this.cloneUnit(u));

        const taggedAlly = allyPlans.map(p => ({...p, team: 'ALLY'}));
        const taggedEnemy = enemyPlans.map(p => ({...p, team: 'ENEMY'}));

        const allPlans = [...taggedAlly, ...taggedEnemy]
            .map(p => ({ ...p, executed: false })) 
            .sort((a, b) => a.time - b.time);

        // 지연된 액션(투사체 등) 목록
        let delayedActions = []; 

        let simTime = 0; 
        
        // 경로 기록 타이머
        let logTimer = 0;
        const LOG_INTERVAL = 0.2; 

        // ★ [핵심 수정] while 루프 시작
        while (simTime < targetTime) {
            simTime += this.stepTime;
            
            // 1. 계획 실행
            this.processPlans(simTime, allPlans, ghosts, mapContext);
            
            // 2. 지연된 액션 처리
            this.processDelayedActions(simTime, delayedActions, ghosts);
            
            // 3. 유닛 업데이트
            this.updateGhosts(ghosts, this.stepTime, mapContext, simTime, delayedActions);

            if (mapContext.easystar) {
                mapContext.easystar.calculate();
            }

            // 4. 경로 기록
            logTimer += this.stepTime;
            if (logTimer >= LOG_INTERVAL) {
                logTimer = 0;
                ghosts.forEach(g => {
                    if (g.active && g.isSpawned && !g.isBase) {
                        g.pathLogs.push({ x: g.x, y: g.y });
                    }
                });
            }

            // 5. 기지 파괴 체크 (★ 반드시 while 루프 안에 있어야 함!)
            const allyBase = ghosts.find(g => g.isBase && g.team === 'ALLY');
            const enemyBase = ghosts.find(g => g.isBase && g.team === 'ENEMY');

            if ((allyBase && !allyBase.active) || (enemyBase && !enemyBase.active)) {
                break; // 기지가 파괴되면 시뮬레이션 종료
            }
        } // ★ while 루프 종료

        return ghosts;
    }

    cloneUnit(realUnit) {
        return {
            name: realUnit.name,
            x: realUnit.x,
            y: realUnit.y,
            team: realUnit.team,
            stats: this.fastCloneStats(realUnit.stats),
            currentHp: realUnit.currentHp,
            active: true,
            isSpawned: true, 
            isStealthed: realUnit.isStealthed || false,
            isBase: realUnit.isBase || false,
            stunTimer: realUnit.stunTimer || 0,
            attackCooldown: realUnit.attackCooldown || 0,
            isCasting: false,
            castTimer: 0,
            pathTimer: 0, 
            pathLogs: [],
            path: []
        };
    }

    processPlans(simTime, plans, ghosts, mapContext) {
        plans.forEach(plan => {
            if (!plan.executed && plan.time <= simTime) {
                plan.executed = true;

                if (plan.type === 'Unit') {
                    let stats = null;
                    if (typeof UNIT_STATS !== 'undefined') stats = UNIT_STATS[plan.name];
                    if (!stats && plan.stats) stats = plan.stats; 
                    
                    if (stats) {
                        const count = stats.count || 1;
                        for(let i=0; i<count; i++) {
                            const offsetX = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].x : 0;
                            const offsetY = (plan.offsets && plan.offsets[i]) ? plan.offsets[i].y : 0;

                            ghosts.push({
                                name: plan.name,
                                x: plan.x + offsetX,
                                y: plan.y + offsetY,
                                team: plan.team, 
                                stats: this.fastCloneStats(stats),
                                currentHp: stats.hp,
                                active: true,
                                isSpawned: true,
                                attackCooldown: 0,
                                stunTimer: 0,
                                isCasting: false,
                                castTimer: 0,
                                pathTimer: 0,
                                pathLogs: [],
                                path: [] 
                            });
                        }
                    }
                } 
                else if (plan.type === 'Skill') {
                    this.applySkillSimulation(plan, ghosts);
                }
            }
        });
    }
    
    applySkillSimulation(plan, ghosts) {
        const stats = (typeof SKILL_STATS !== 'undefined') ? SKILL_STATS[plan.name] : null;
        if (!stats) return;

        const casterTeam = plan.team || 'ALLY';
        let targetTeam = (stats.skillType === 'DEFENSE') ? casterTeam : (casterTeam === 'ALLY' ? 'ENEMY' : 'ALLY');
        
        ghosts.forEach(ghost => {
            if (!ghost.active) return;
            if (targetTeam !== 'BOTH' && ghost.team !== targetTeam) return;

            const dist = Phaser.Math.Distance.Between(plan.x, plan.y, ghost.x, ghost.y);
            const hitBox = (ghost.isBase) ? (stats.radius + 60) : (stats.radius + 10);

            if (dist <= hitBox) { 
                if (stats.damage > 0) {
                    ghost.currentHp -= stats.damage;
                    this.checkDeath(ghost, ghosts); 
                }
                if (stats.stun > 0 && ghost.active) {
                    ghost.stunTimer += stats.stun;
                    if (ghost.isCasting) {
                        ghost.isCasting = false;
                        ghost.castTimer = 0;
                    }
                }
                if (stats.shield > 0 && ghost.active) {
                    ghost.currentHp += stats.shield;
                    if (ghost.currentHp > ghost.stats.hp) ghost.currentHp = ghost.stats.hp;
                }
            }
        });
    }

    updateGhosts(ghosts, dt, mapContext, simTime, delayedActions) {
        ghosts.forEach(ghost => {
            if (!ghost.active) return;
            
            // 1. 상태이상(CC) 체크
            if (ghost.stunTimer > 0) {
                ghost.stunTimer -= dt;
                if (ghost.isCasting) { ghost.isCasting = false; ghost.castTimer = 0; }
                return; 
            }
            
            if (ghost.attackCooldown > 0) ghost.attackCooldown -= dt;
            if (ghost.pathTimer > 0) ghost.pathTimer -= dt; 

            // 2. 캐스팅 처리
            if (ghost.isCasting) {
                ghost.castTimer -= dt;
                if (ghost.castTimer <= 0) {
                    this.executeAttack(ghost, ghosts, ghost.currentTarget, simTime, delayedActions); 
                    ghost.isCasting = false;
                    ghost.attackCooldown = ghost.stats.attackSpeed || 1.0;
                }
                return; 
            }

            // 3. 타겟 탐색
            let target = null;
            let minDist = Infinity;
            
            ghosts.forEach(other => {
                if (other.active && other.team !== ghost.team && !other.isStealthed) {
                    const d = Phaser.Math.Distance.Between(ghost.x, ghost.y, other.x, other.y);
                    if (d < minDist) { minDist = d; target = other; }
                }
            });

            // 4. 행동 결정 (공격 vs 이동)
            let moveTarget = null; 

            if (target && minDist <= (ghost.stats.range || 50)) {
                // [상황 A] 적이 사거리 안에 있음 -> 공격
                if (ghost.attackCooldown <= 0) {
                    const castTime = ghost.stats.castTime || 0;
                    if (castTime > 0) {
                        ghost.isCasting = true;
                        ghost.castTimer = castTime;
                        ghost.currentTarget = target;
                    } else {
                        this.executeAttack(ghost, ghosts, target, simTime, delayedActions);
                        ghost.attackCooldown = ghost.stats.attackSpeed || 1.0;
                    }
                }
                return; 

            } else if (target) {
                // [상황 B] 적이 있지만 멀리 있음 -> 적을 향해 이동
                moveTarget = { x: target.x, y: target.y };
                
            } else {
                // [상황 C] 적이 없음 -> 적 진영 끝(기지 방향)으로 이동
                const targetX = (ghost.team === 'ALLY') ? (mapContext.width - 32) : 32;
                moveTarget = { x: targetX, y: ghost.y }; 
            }

            // 5. 실제 이동 처리 (길찾기 적용)
            if (moveTarget) {
                if (ghost.pathTimer <= 0) {
                    GameLogic.calculatePath(ghost, moveTarget, mapContext.grid, mapContext.tileSize, mapContext.easystar);
                    ghost.pathTimer = 0.5;
                }

                if (ghost.path && ghost.path.length > 0) {
                    const tileSize = mapContext.tileSize;
                    const nextNode = ghost.path[0];
                    const worldX = nextNode.x * tileSize + tileSize / 2;
                    const worldY = nextNode.y * tileSize + tileSize / 2;

                    const distToNode = Math.sqrt((ghost.x - worldX)**2 + (ghost.y - worldY)**2);
                    
                    if (distToNode < 5) {
                        ghost.path.shift();
                    } else {
                        const angle = Math.atan2(worldY - ghost.y, worldX - ghost.x);
                        ghost.x += Math.cos(angle) * ghost.stats.speed * dt;
                        ghost.y += Math.sin(angle) * ghost.stats.speed * dt;
                    }
                } else {
                    this.moveTowards(ghost, moveTarget.x, moveTarget.y, dt);
                }
            }
        });
    }

    processDelayedActions(simTime, delayedActions, allGhosts) {
        for (let i = delayedActions.length - 1; i >= 0; i--) {
            const action = delayedActions[i];
            if (simTime >= action.hitTime) {
                if (action.target && action.target.active) {
                    this.applyDamage(action.attacker, action.target, action.damage, allGhosts);
                }
                delayedActions.splice(i, 1);
            }
        }
    }

    executeAttack(attacker, allGhosts, target = null, simTime = 0, delayedActions = []) {
        if (!target || !target.active) {
            let minDst = Infinity;
            allGhosts.forEach(other => {
                if (other.active && other.team !== attacker.team && !other.isStealthed) {
                    const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, other.x, other.y);
                    if (d < minDst) { minDst = d; target = other; }
                }
            });
        }

        if (target && target.active) {
            const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
            
            if (dist <= attacker.stats.range + 20) {
                const damage = attacker.stats.damage || 10;
                const projSpeed = attacker.stats.projectileSpeed || 0;

                if (projSpeed > 0) {
                    const travelTime = dist / projSpeed; 
                    delayedActions.push({
                        hitTime: simTime + travelTime,
                        attacker: attacker,
                        target: target,
                        damage: damage
                    });
                } else {
                    this.applyDamage(attacker, target, damage, allGhosts);
                }
            }
        }
    }

    applyDamage(attacker, target, damage, allGhosts) {
        target.currentHp -= damage;

        if (attacker.team === 'ALLY' && this.hasArtifact('vampire')) {
            const heal = damage * 0.2; 
            attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
        }

        this.checkDeath(target, allGhosts);
    }

    checkDeath(unit, allGhosts) {
        if (unit.currentHp <= 0) {
            unit.active = false;
            unit.currentHp = 0;

            if (unit.team === 'ALLY') {
                if (this.hasArtifact('gunpowder')) {
                    this.triggerExplosion(unit.x, unit.y, 100, 50, 'ENEMY', allGhosts);
                }
            }
        }
    }

    hasArtifact(id) {
        return this.artifacts && this.artifacts.includes(id);
    }

    triggerExplosion(x, y, radius, damage, targetTeam, allGhosts) {
        allGhosts.forEach(g => {
            if (g.active && g.team === targetTeam) {
                const dist = Phaser.Math.Distance.Between(x, y, g.x, g.y);
                if (dist <= radius) {
                    g.currentHp -= damage;
                    if (g.currentHp <= 0) {
                        g.active = false;
                        g.currentHp = 0;
                    }
                }
            }
        });
    }

    moveTowards(ghost, targetX, targetY, dt) {
        const dx = targetX - ghost.x;
        const dy = targetY - ghost.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist <= ghost.stats.range - 5) return; 

        const speed = ghost.stats.speed;
        const moveDist = speed * dt;
        
        const angle = Math.atan2(dy, dx);
        let vx = Math.cos(angle) * moveDist;
        let vy = Math.sin(angle) * moveDist;

        if (this.mapGrid) {
            const tileSize = 32; 
            
            const nextX = ghost.x + vx;
            const nextY = ghost.y + vy;
            
            const gridX = Math.floor(nextX / tileSize);
            const gridY = Math.floor(nextY / tileSize);

            if (gridY >= 0 && gridY < this.mapGrid.length && gridX >= 0 && gridX < this.mapGrid[0].length) {
                if (this.mapGrid[gridY][gridX] === 1) {
                    const gridX_only = Math.floor((ghost.x + vx) / tileSize);
                    const gridY_curr = Math.floor(ghost.y / tileSize);
                    
                    if (this.mapGrid[gridY_curr][gridX_only] !== 1) {
                        vy = 0; 
                    } else {
                        const gridX_curr = Math.floor(ghost.x / tileSize);
                        const gridY_only = Math.floor((ghost.y + vy) / tileSize);
                        
                        if (this.mapGrid[gridY_only][gridX_curr] !== 1) {
                            vx = 0; 
                        } else {
                            vx = 0;
                            vy = 0;
                        }
                    }
                }
            }
        }

        ghost.x += vx;
        ghost.y += vy;
    }
}