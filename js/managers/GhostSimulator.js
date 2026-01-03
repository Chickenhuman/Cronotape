// js/managers/GhostSimulator.js

class GhostSimulator {
    constructor() {
        this.stepTime = 0.1;
        this.mapGrid = null; 
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

        let simTime = 0; 
        
        while (simTime < targetTime) {
            simTime += this.stepTime;
            this.processPlans(simTime, allPlans, ghosts, mapContext);
            this.updateGhosts(ghosts, this.stepTime, mapContext);
        }

        return ghosts;
    }

    cloneUnit(realUnit) {
        return {
            name: realUnit.name,
            x: realUnit.x,
            y: realUnit.y,
            team: realUnit.team,
            stats: JSON.parse(JSON.stringify(realUnit.stats)), 
            currentHp: realUnit.currentHp,
            active: true,
            isSpawned: true, 
            isStealthed: realUnit.isStealthed || false,
            isBase: realUnit.isBase || false,
            stunTimer: realUnit.stunTimer || 0,
            attackCooldown: realUnit.attackCooldown || 0,
            // ★ [4단계 추가] 캐스팅 관련 상태값
            isCasting: false,
            castTimer: 0
        };
    }

processPlans(simTime, plans, ghosts, mapContext) {
        plans.forEach(plan => {
            if (!plan.executed && plan.time <= simTime) {
                plan.executed = true;

                if (plan.type === 'Unit') {
                    let stats = null;
                    // ★ [수정] UNIT_DATA -> UNIT_STATS 로 변경 (여기가 문제였습니다!)
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
                                stats: JSON.parse(JSON.stringify(stats)),
                                currentHp: stats.hp,
                                active: true,
                                isSpawned: true,
                                attackCooldown: 0,
                                stunTimer: 0,
                                isCasting: false,
                                castTimer: 0
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
                    
                    // ★ [4단계 추가] 스킬에 맞아서 스턴 걸리면 캐스팅 취소!
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

    updateGhosts(ghosts, dt, mapContext) {
        ghosts.forEach(ghost => {
            if (!ghost.active) return;
            
            // 1. 상태이상(CC) 체크
            if (ghost.stunTimer > 0) {
                ghost.stunTimer -= dt;
                
                // ★ [4단계 핵심] 스턴 상태에서는 캐스팅 불가 (취소됨)
                if (ghost.isCasting) {
                    ghost.isCasting = false;
                    ghost.castTimer = 0;
                }
                return; // 행동 불가
            }
            
            // 쿨타임 감소
            if (ghost.attackCooldown > 0) ghost.attackCooldown -= dt;

            // 2. 캐스팅(공격 선딜레이) 처리
            if (ghost.isCasting) {
                ghost.castTimer -= dt;
                
                // 캐스팅 완료 시 공격 실행
                if (ghost.castTimer <= 0) {
                    this.executeAttack(ghost, ghosts);
                    ghost.isCasting = false;
                    // 공격 후 쿨타임 적용
                    ghost.attackCooldown = ghost.stats.attackSpeed || 1.0;
                }
                return; // 캐스팅 중에는 이동 불가
            }

            // 3. 적 탐색 및 이동/공격 시작
            let nearestEnemy = null;
            let minDst = Infinity;

            ghosts.forEach(other => {
                if (other.active && other.team !== ghost.team && !other.isStealthed) {
                    const d = Phaser.Math.Distance.Between(ghost.x, ghost.y, other.x, other.y);
                    if (d < minDst) {
                        minDst = d;
                        nearestEnemy = other;
                    }
                }
            });

            if (nearestEnemy) {
                if (minDst <= ghost.stats.range) {
                    // 사거리 내에 적이 있고, 쿨타임이 찼다면
                    if (ghost.attackCooldown <= 0) {
                        // ★ [4단계 핵심] 즉시 공격이 아니라 캐스팅 시작
                        const castTime = ghost.stats.castTime || 0;
                        
                        if (castTime > 0) {
                            ghost.isCasting = true;
                            ghost.castTimer = castTime;
                        } else {
                            // 선딜레이가 0인 유닛(전사 등)은 즉시 공격
                            this.executeAttack(ghost, ghosts, nearestEnemy);
                            ghost.attackCooldown = ghost.stats.attackSpeed || 1.0;
                        }
                    }
                } else {
                    // 적을 향해 이동
                    this.moveTowards(ghost, nearestEnemy.x, nearestEnemy.y, dt);
                }
            } else {
                // 적이 없으면 적 기지 방향으로 전진
                const targetX = (ghost.team === 'ALLY') ? mapContext.width : 0;
                const targetY = mapContext.height / 2; 
                this.moveTowards(ghost, targetX, targetY, dt);
            }
        });
    }

    // ★ [4단계 추가] 실제 데미지를 입히는 함수 분리
    executeAttack(attacker, allGhosts, target = null) {
        // 타겟이 명시되지 않았다면(캐스팅 후) 다시 가장 가까운 적 찾기
        if (!target) {
            let minDst = Infinity;
            allGhosts.forEach(other => {
                if (other.active && other.team !== attacker.team && !other.isStealthed) {
                    const d = Phaser.Math.Distance.Between(attacker.x, attacker.y, other.x, other.y);
                    if (d < minDst) {
                        minDst = d;
                        target = other;
                    }
                }
            });
        }

        // 여전히 타겟이 유효하고 사거리 내에 있는지 확인 (캐스팅 중 적이 죽거나 도망갔을 수 있음)
        if (target && target.active) {
            const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
            // 약간의 관용 거리(+20)를 주어 캐스팅 중 살짝 멀어져도 맞게 처리
            if (dist <= attacker.stats.range + 20) {
                let damage = attacker.stats.damage || 10;
                target.currentHp -= damage;

                // [3단계] 흡혈 유물 효과
                if (attacker.team === 'ALLY' && this.hasArtifact('vampire')) {
                    const heal = damage * 0.2; 
                    attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
                }

                this.checkDeath(target, allGhosts);
            }
        }
    }

    checkDeath(unit, allGhosts) {
        if (unit.currentHp <= 0) {
            unit.active = false;
            unit.currentHp = 0;

            // [3단계] 화약통 유물 효과
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