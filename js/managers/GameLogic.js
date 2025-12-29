// js/managers/GameLogic.js

class GameLogic {
    // 거리 계산
    static getDistance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 타겟 찾기
    static findTarget(me, allUnits) {
        let nearest = null;
        let minDist = 9999;

        for (const u of allUnits) {
            if (!u.active || !u.isSpawned) continue;
            if (u.currentHp <= 0) continue;
            if (u.team === me.team) continue;
            if (u.isStealthed) continue; // 은신 체크

            const dist = this.getDistance(me, u);
            if (dist < minDist) {
                minDist = dist;
                nearest = u;
            }
        }
        return nearest;
    }

    // ★ [수정됨] 이동 및 공격 로직
    static runUnitLogic(me, allUnits, dt, grid, tileSize, easystar) {
        if (!me.active || me.currentHp <= 0) return;
        
        if (me.attackCooldown > 0) me.attackCooldown -= dt;
        if (me.pathTimer > 0) me.pathTimer -= dt;

        const target = this.findTarget(me, allUnits);
        if (!target) return;

        const dist = this.getDistance(me, target);
        
        // 1. 공격 사거리 안이면 -> 공격 시도
        if (dist <= me.stats.range) {
            me.path = []; 
            
            // ★ [핵심 변경] 바로 공격(onAttack)하지 않고 캐스팅 시도(tryAttack)를 요청
            if (me.tryAttack) {
                me.tryAttack(target); 
            } else {
                // (안전장치) Unit.js가 아직 업데이트 안 됐을 경우를 대비
                if (me.attackCooldown <= 0) {
                    me.attackCooldown = me.stats.attackSpeed;
                    if (me.onAttack) me.onAttack(target);
                }
            }

            if (me.setLookingAt) me.setLookingAt(target.x, target.y);
            return; 
        }

        // 2. 이동 로직
        if (me.pathTimer <= 0) {
            this.calculatePath(me, target, grid, tileSize, easystar);
            me.pathTimer = 0.5; 
        }

        if (me.path && me.path.length > 0) {
            const nextNode = me.path[0];
            const moveTargetX = nextNode.x * tileSize + tileSize / 2;
            const moveTargetY = nextNode.y * tileSize + tileSize / 2;

            // 노드 스키핑 (20px 근처면 도착 인정)
            const distToNode = Math.sqrt((me.x - moveTargetX)**2 + (me.y - moveTargetY)**2);
            if (distToNode < 20) {
                me.path.shift(); 
                return; 
            }

            const angle = Math.atan2(moveTargetY - me.y, moveTargetX - me.x);
            const speed = me.stats.speed;
            
            // 이동 실행
            me.x += Math.cos(angle) * speed * dt;
            me.y += Math.sin(angle) * speed * dt;

            if (me.setLookingAt) me.setLookingAt(moveTargetX, moveTargetY);
        }

        // 3. 밀어내기 (겹침 방지)
        this.applySeparation(me, allUnits, dt, 0.8, grid, tileSize);
    }

    // 경로 계산 함수
    static calculatePath(me, target, grid, tileSize, easystar) {
        if (!easystar || !grid) return;

        let startX = Math.floor(me.x / tileSize);
        let startY = Math.floor(me.y / tileSize);
        const endX = Math.floor(target.x / tileSize);
        const endY = Math.floor(target.y / tileSize);

        if (!this.isValidCoord(startX, startY, grid) || !this.isValidCoord(endX, endY, grid)) return;

        // 구조 요청 로직 (벽에 끼었을 때 탈출)
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
                if (path[0].x === startX && path[0].y === startY) {
                    path.shift();
                }
                me.path = path;
            } else {
                me.path = []; 
            }
        });
        easystar.calculate();
    }

    // 밀어내기 (Separation)
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
}