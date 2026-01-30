// js/managers/GameLogic.js

class GameLogic {
    static getDistance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static findTarget(me, allUnits) {
        let nearest = null;
        let minDist = 9999;

        for (const u of allUnits) {
            if (!u.active || !u.isSpawned) continue;
            if (u.currentHp <= 0) continue;
            if (u.team === me.team) continue;
            if (u.isStealthed) continue; 

            const dist = this.getDistance(me, u);
            if (dist < minDist) {
                minDist = dist;
                nearest = u;
            }
        }
        return nearest;
    }
    // ★ [신규] 다친 아군 찾기 (힐러용)
    static findInjuredAlly(me, allUnits) {
        let nearest = null;
        let minDist = 9999;

        for (const u of allUnits) {
            if (!u.active || !u.isSpawned) continue;
            if (u.currentHp <= 0) continue;
            if (u.team !== me.team) continue; // ★ 같은 팀(아군)만 찾음
            if (u === me) continue; // 자기 자신 제외 (선택사항)

            // ★ 풀피인 아군은 힐 대상 아님
            if (u.currentHp >= u.stats.hp) continue;
            if (u.isBase) continue;
            const dist = this.getDistance(me, u);
            if (dist < minDist) {
                minDist = dist;
                nearest = u;
            }
        }
        return nearest;
    }
 // ★ [핵심] isSimulation 파라미터가 반드시 있어야 합니다!
    static runUnitLogic(me, allUnits, dt, grid, tileSize, easystar, isSimulation = false) {
        if (!me.active || me.currentHp <= 0) return;
        
        if (me.attackCooldown > 0) me.attackCooldown -= dt;
        if (me.pathTimer > 0) me.pathTimer -= dt;
        let target = null;
        
        if (me.stats.role === 'HEALER') {
            // 1순위: 다친 아군
            target = this.findInjuredAlly(me, allUnits);
            
            // 2순위: 아군이 다 건강하면 적군 공격 (선택사항)
            if (!target) {
                target = this.findTarget(me, allUnits);
            }
        } else {
            // 일반 유닛: 적군 찾기
            target = this.findTarget(me, allUnits);
        }
        // 타겟이 없으면(적 전멸) 로직 종료
        if (!target) return;

        const dist = this.getDistance(me, target);
        
        // 1. 사거리 안 -> 공격 시도
        if (dist <= me.stats.range) {
            me.path = []; 
            
            // (A) 실제 게임: tryAttack 호출
            if (!isSimulation && typeof me.tryAttack === 'function') {
                me.tryAttack(target); 
            } 
            // (B) 시뮬레이션: 공격 판정 데이터만 남김
            else {
                if (me.attackCooldown <= 0) {
                    const castTime = me.stats.castTime || 0;
                    if (castTime > 0) {
                        me.isCasting = true;
                        me.castTimer = castTime;
                        me.currentTarget = target; 
                    } else {
                        // ★ [중요] 즉시 공격 발생 시, 시뮬레이터에게 "나 얘 때렸어"라고 알림
                        me.attackCooldown = me.stats.attackSpeed;
                        if (isSimulation) me._simAttackTarget = target; 
                    }
                }
            }

            if (!isSimulation && me.setLookingAt) me.setLookingAt(target.x, target.y);
            return; 
        }

        // 2. 이동 로직 (길찾기)
        if (me.pathTimer <= 0) {
            this.calculatePath(me, target, grid, tileSize, easystar);
            me.pathTimer = 0.5; 
        }

        if (me.path && me.path.length > 0) {
            const nextNode = me.path[0];
            const moveTargetX = nextNode.x * tileSize + tileSize / 2;
            const moveTargetY = nextNode.y * tileSize + tileSize / 2;

            const distToNode = Math.sqrt((me.x - moveTargetX)**2 + (me.y - moveTargetY)**2);
            if (distToNode < 10) { 
                me.path.shift(); 
                return; 
            }

            const angle = Math.atan2(moveTargetY - me.y, moveTargetX - me.x);
            const speed = me.stats.speed;
            
            me.x += Math.cos(angle) * speed * dt;
            me.y += Math.sin(angle) * speed * dt;

            if (!isSimulation && me.setLookingAt) me.setLookingAt(moveTargetX, moveTargetY);
        }

        // 3. 밀어내기 (시뮬레이션에서도 똑같이 적용)
        this.applySeparation(me, allUnits, dt, 0.8, grid, tileSize);
    }

    static calculatePath(me, target, grid, tileSize, easystar) {
        if (!easystar || !grid) return;

        let startX = Math.floor(me.x / tileSize);
        let startY = Math.floor(me.y / tileSize);
        const endX = Math.floor(target.x / tileSize);
        const endY = Math.floor(target.y / tileSize);

        if (!this.isValidCoord(startX, startY, grid) || !this.isValidCoord(endX, endY, grid)) return;

        if (grid[startY][startX] === 1) {
            const neighbors = [
                {x: startX+1, y: startY}, {x: startX-1, y: startY},
                {x: startX, y: startY+1}, {x: startX, y: startY-1}
            ];
            for (let n of neighbors) {
                if (this.isValidCoord(n.x, n.y, grid) && grid[n.y][n.x] !== 1) {
                    startX = n.x;
                    startY = n.y;
                    break;
                }
            }
        }

        easystar.findPath(startX, startY, endX, endY, (path) => {
            if (path && path.length > 0) {
                if (path[0].x === startX && path[0].y === startY) path.shift();
                me.path = path;
            } else {
                me.path = []; 
            }
        });
        easystar.calculate();
    }

    static applySeparation(me, allUnits, dt, forceScale, grid, tileSize) {
        if (forceScale <= 0) return;

        const personalSpace = 30;
        const basePushForce = 200;

        for (const other of allUnits) {
            if (other === me || !other.active || !other.isSpawned) continue;
            if (other.currentHp <= 0) continue;
            if (other.team !== me.team) continue;

            const dist = this.getDistance(me, other);
            if (dist > 0 && dist < personalSpace) {
                const overlapRatio = (personalSpace - dist) / personalSpace;
                const pushStrength = basePushForce * overlapRatio * forceScale;
                const angle = Math.atan2(me.y - other.y, me.x - other.x);
                
                const pushX = Math.cos(angle) * pushStrength * dt;
                const pushY = Math.sin(angle) * pushStrength * dt;
                const nextX = me.x + pushX;
                const nextY = me.y + pushY;

                if (this.isWalkable(nextX, nextY, grid, tileSize)) {
                    me.x = nextX;
                    me.y = nextY;
                }
            }
        }
    }

    static isValidCoord(tx, ty, grid) {
        return (ty >= 0 && ty < grid.length && tx >= 0 && tx < grid[0].length);
    }

    static isWalkable(x, y, grid, tileSize) {
        const tx = Math.floor(x / tileSize);
        const ty = Math.floor(y / tileSize);
        if (!this.isValidCoord(tx, ty, grid)) return false;
        return grid[ty][tx] !== 1; 
    }
    // ============================================================
    // ★ [신규 추가] 유닛 소환 위치 분산 (오프셋) 계산
    // ============================================================
    static getSpawnOffsets(count, spread = 30) {
        const offsets = [];
        for (let i = 0; i < count; i++) {
            if (i === 0) {
                // 첫 번째 유닛은 정확한 위치에
                offsets.push({ x: 0, y: 0 });
            } else {
                // 나머지는 랜덤하게 흩뿌리기
                offsets.push({
                    x: (Math.random() - 0.5) * spread,
                    y: (Math.random() - 0.5) * spread
                });
            }
        }
        return offsets;
    }
}