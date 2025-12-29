// js/managers/GhostSimulator.js

class GhostSimulator {
    constructor() {
        this.stepTime = 0.1;
    }

    run(targetTime, allyPlans, enemyPlans, currentUnits, mapContext) {
        let ghosts = currentUnits.map(u => this.cloneUnit(u));

        const allPlans = [...allyPlans, ...enemyPlans]
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
            isStealthed: realUnit.isStealthed,
            stunTimer: realUnit.stunTimer || 0,
            attackCooldown: realUnit.attackCooldown || 0,
            // ★ [안전장치] 이름이 '기지'이거나 isBase가 true면 기지로 인식
            isBase: (realUnit.isBase || realUnit.name === '기지') 
        };
    }

    processPlans(simTime, plans, ghosts, mapContext) {
        plans.forEach(plan => {
            if (!plan.executed && plan.time <= simTime) {
                plan.executed = true; 

                if (plan.type === 'Unit') {
                    const stats = (plan.type === 'Unit' && plan.name) ? 
                                  (UNIT_STATS[plan.name] || getEnemyStats(plan.name)) : null;
                    
                    if (stats) {
                        let team = plan.team;
                        if (!team) {
                            team = (plan.x > mapContext.width / 2) ? 'ENEMY' : 'ALLY';
                        }

                        const count = stats.count || 1;
                        for(let i=0; i<count; i++) {
                            ghosts.push({
                                name: plan.name,
                                x: plan.x + (i===0?0:Math.random()*20-10),
                                y: plan.y + (i===0?0:Math.random()*20-10),
                                team: team,
                                stats: JSON.parse(JSON.stringify(stats)),
                                currentHp: stats.hp,
                                active: true,
                                isSpawned: true,
                                isStealthed: (stats.traits && stats.traits.includes('은신')),
                                stunTimer: 0,
                                attackCooldown: 0,
                                isBase: false
                            });
                        }
                    }
                } else {
                    this.applySkillSimulation(plan, ghosts);
                }
            }
        });
    }

    applySkillSimulation(plan, ghosts) {
        const stats = SKILL_STATS[plan.name];
        if (!stats) return;

        const casterTeam = plan.team || 'ALLY';
        let targetTeam = (stats.skillType === 'DEFENSE') ? casterTeam : (casterTeam === 'ALLY' ? 'ENEMY' : 'ALLY');
        
        ghosts.forEach(ghost => {
            if (!ghost.active) return;
            if (targetTeam !== 'BOTH' && ghost.team !== targetTeam) return;

            const dist = Phaser.Math.Distance.Between(plan.x, plan.y, ghost.x, ghost.y);
            
            // 기지는 히트박스를 더 크게 잡음
            const hitBox = (ghost.isBase) ? stats.radius + 60 : stats.radius + 5;

            if (dist <= hitBox) { 
                if (stats.damage > 0) {
                    ghost.currentHp -= stats.damage;
                    this.checkDeath(ghost);
                }
                if (stats.stun > 0 && ghost.active) {
                    ghost.stunTimer += stats.stun;
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
            if (ghost.isBase) return; // 기지는 이동/공격 안 함

            if (ghost.stunTimer > 0) {
                ghost.stunTimer -= dt;
                return; 
            }

            if (ghost.attackCooldown > 0) {
                ghost.attackCooldown -= dt;
            }

            let nearestEnemy = null;
            let minDist = 9999;
            let targetIsBase = false;

            ghosts.forEach(target => {
                if (target.active && target.team !== ghost.team && !target.isStealthed) {
                    let d = 0;
                    let radius = 0;

                    // ★ [핵심] 기지 인식 로직 강화
                    if (target.isBase || target.name === '기지') {
                        // 기지는 Y축 무시, X축 거리(Wall Distance)만 계산
                        d = Math.abs(ghost.x - target.x);
                        radius = 80; // ★ 멈추는 거리 대폭 증가 (기지 앞 80px에서 정지)
                        
                        // Y축이 너무 멀면(라인이 다르면) 기지 무시하는 로직이 필요하다면 추가 가능
                        // 하지만 보통 기지는 전 라인을 커버하므로 무조건 인식
                    } else {
                        d = Phaser.Math.Distance.Between(ghost.x, ghost.y, target.x, target.y);
                        radius = 0;
                    }

                    // 닿아야 하는 실질 거리
                    const effectiveDist = Math.max(0, d - radius);

                    if (effectiveDist < minDist) {
                        minDist = effectiveDist;
                        nearestEnemy = target;
                        targetIsBase = (target.isBase || target.name === '기지');
                    }
                }
            });

            if (nearestEnemy) {
                // 사거리 체크
                if (minDist <= ghost.stats.range) {
                    // [전투]
                    if (ghost.attackCooldown <= 0) {
                        nearestEnemy.currentHp -= ghost.stats.damage;
                        ghost.attackCooldown = ghost.stats.attackSpeed; 
                        this.checkDeath(nearestEnemy);
                    }
                } else {
                    // [이동]
                    if (targetIsBase) {
                        // ★ [수정] 기지가 타겟이면 Y축 이동 없이 X축으로만 직진 (슬라이딩 방지)
                        this.moveTowards(ghost, nearestEnemy.x, ghost.y, dt);
                    } else {
                        // 일반 유닛이면 타겟 좌표로 이동
                        this.moveTowards(ghost, nearestEnemy.x, nearestEnemy.y, dt);
                    }
                }
            } else {
                // 적이 없으면 전진
                const targetX = (ghost.team === 'ALLY') ? mapContext.width : 0;
                const targetY = mapContext.height / 2; 
                this.moveTowards(ghost, targetX, targetY, dt);
            }
        });
    }

    moveTowards(ghost, targetX, targetY, dt) {
        const angle = Phaser.Math.Angle.Between(ghost.x, ghost.y, targetX, targetY);
        const speed = ghost.stats.speed; 
        ghost.x += Math.cos(angle) * speed * dt;
        ghost.y += Math.sin(angle) * speed * dt;
    }

    checkDeath(unit) {
        if (unit.currentHp <= 0) {
            unit.active = false;
            unit.currentHp = 0;
        }
    }
}