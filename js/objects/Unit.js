// js/objects/Unit.js

class Unit extends Phaser.GameObjects.Container {
    // [수정] 6번째 매개변수로 customStats 추가 (기본값 null)
    constructor(scene, x, y, name, team, customStats = null) {
        super(scene, x, y);
        
        this.scene = scene;
        this.name = name;
        this.team = team;

        // 이제 customStats가 매개변수로 전달되므로 에러가 발생하지 않고,
        // 보너스 타임 효과가 적용된 스탯을 정상적으로 사용할 수 있습니다.
        if (customStats) {
            // 이미 계산된 스탯이므로 복사해서 사용 (참조 끊기)
            this.stats = JSON.parse(JSON.stringify(customStats));
        } else {
            // 기존 로직: customStats가 없으면 기본 데이터 로드
            const baseStats = (team === 'ENEMY') ? getEnemyStats(name) : UNIT_STATS[name];
            this.stats = JSON.parse(JSON.stringify(baseStats));
        }

        this.currentHp = this.stats.hp;
        this.active = true;
        this.isBase = (name === '기지');
        this.isSpawned = true;
        this.isStealthed = (this.stats.traits && this.stats.traits.includes('은신'));
        
        this.path = [];
        this.pathTimer = 0;
        this.attackCooldown = 0;
        
        // ★ [변경] 상태이상 통합 관리 (기존 stunTimer 제거)
        this.statusEffects = {}; // 예: { 'STUN': 0.5, 'SLOW': 2.0 }
        
        // 선딜레이 변수
        this.isCasting = false;
        this.castTimer = 0;
        this.maxCastTime = this.stats.castTime || 0; 
        this.currentTarget = null;
        this.killCount = 0;

        // 그래픽 조립
        this.outline = scene.add.rectangle(0, 0, 50, 60, (team === 'ALLY' ? 0x00ff00 : 0xff0000), 0);
        this.outline.setStrokeStyle(3, (team === 'ALLY' ? 0x00ff00 : 0xff0000), 1).setAlpha(0);
        this.add(this.outline);

        const shadow = scene.add.ellipse(0, 20, 30, 10, 0x000000, 0.3);
        this.add(shadow);

        const parts = SVG_MANAGER.getParts(name);

        if (parts.body) {
            this.bodySprite = scene.add.sprite(0, 0, parts.body).setDisplaySize(40, 40);
            if (team === 'ENEMY') this.bodySprite.setTint(0xff8888);
            else if (this.stats.color) this.bodySprite.setTint(this.stats.color);
            this.add(this.bodySprite);
        }

        if (parts.weapon) {
            this.weaponSprite = scene.add.sprite(15, 5, parts.weapon).setDisplaySize(30, 30).setOrigin(0.5, 0.9);
            this.add(this.weaponSprite);
            this.weaponAnimType = SVG_MANAGER.getWeaponAnimType(parts.weapon);
        } else {
            this.weaponAnimType = 'BODY'; 
        }

        if (parts.shield) {
            this.shieldSprite = scene.add.sprite(-10, 5, parts.shield).setDisplaySize(25, 25);
            this.add(this.shieldSprite);
        }

        if (team === 'ENEMY') this.setScale(-1, 1); 
        if (this.isStealthed) this.setAlpha(0.5);

        if (!this.isBase) {
            this.hpBar = scene.add.rectangle(0, -25, 30, 5, 0x00ff00);
            this.add(this.hpBar);
        }

        this.setInteractive(new Phaser.Geom.Rectangle(-25, -30, 50, 60), Phaser.Geom.Rectangle.Contains);
        this.on('pointerover', () => { if(this.active){ this.outline.setAlpha(1); this.scene.uiManager.showUnitTooltip(this); }});
        this.on('pointerout', () => { this.outline.setAlpha(0); this.scene.uiManager.hideUnitTooltip(); });

        scene.add.existing(this);
    }

    update(dt) {
        if (!this.active || this.currentHp <= 0) return;

        // [1] 상태이상 타이머 감소 및 만료 처리
        for (const [type, duration] of Object.entries(this.statusEffects)) {
            if (duration > 0) {
                this.statusEffects[type] -= dt;
                // 시간이 다 되면 제거
                if (this.statusEffects[type] <= 0) delete this.statusEffects[type];
            }
        }

        // [2] 현재 걸린 CC기 확인 (행동 제약 조회)
        const rules = this.checkCC();

        // [3] 캐스팅 취소 조건 확인
        if (rules.cancelCast && this.isCasting) {
            this.cancelCasting();
        }

        // [4] 행동 불가 판정 (이동도 공격도 못하면 리턴)
        // 만약 이동만 불가(ROOT)하고 공격은 가능하다면 아래 로직을 더 세분화해야 하지만,
        // 현재 GameLogic 구조상 일단 둘 다 막히는 경우만 처리합니다.
        if (!rules.canMove && !rules.canAttack) return;


        // 캐스팅 진행
        if (this.isCasting) {
            this.castTimer -= dt;
            if (this.castTimer <= 0) this.fireAttack(); 
            return; 
        }

        // 이동 및 공격 로직 실행
        // (주의: ROOT 상태일 때도 runUnitLogic이 호출되면 이동할 수 있음. 
        // 완벽한 ROOT 구현을 위해서는 GameLogic에 rules를 전달해야 함)
        GameLogic.runUnitLogic(this, this.scene.activeUnits, dt, this.scene.grid, this.scene.tileSize, this.scene.easystar);

        if (!this.isBase && this.hpBar) {
            const ratio = Phaser.Math.Clamp(this.currentHp / this.stats.hp, 0, 1);
            this.hpBar.width = 30 * ratio;
            this.hpBar.fillColor = (ratio > 0.3) ? 0x00ff00 : 0xff0000;
        }
        
        if (this.bodySprite && !this.scene.tweens.isTweening(this.bodySprite)) {
            this.bodySprite.y = Math.sin(this.scene.time.now / 200) * 1; 
        }
    }

    // ★ [신규] 현재 상태이상에 따른 제약 사항 반환
    checkCC() {
        let result = { canMove: true, canAttack: true, cancelCast: false };
        
        // 걸려있는 모든 상태이상을 순회하며 가장 강력한 제약을 적용
        for (const type in this.statusEffects) {
            const rule = CC_RULES[type];
            if (!rule) continue;

            if (!rule.canMove) result.canMove = false;
            if (!rule.canAttack) result.canAttack = false;
            if (rule.cancelCast) result.cancelCast = true;
        }
        return result;
    }

    // ★ [신규] 상태이상 적용 함수 (외부 호출용)
    applyCC(type, duration) {
        // 이미 걸려있으면 더 긴 시간으로 갱신
        const current = this.statusEffects[type] || 0;
        this.statusEffects[type] = Math.max(current, duration);
        
        // 넉백 같은 물리적 효과는 CombatManager에서 트윈으로 처리하거나 여기서 처리
    }

    tryAttack(target) {
        if (this.attackCooldown > 0 || this.isCasting) return;
        this.currentTarget = target; 
        if (this.maxCastTime > 0) {
            this.isCasting = true;
            this.castTimer = this.maxCastTime;
            if (this.bodySprite) this.bodySprite.setTint(0xffff00); 
        } else {
            this.fireAttack();
        }
    }

    fireAttack() {
        this.isCasting = false;
        this.attackCooldown = this.stats.attackSpeed; 
        this.resetTint();
        if (this.currentTarget && this.currentTarget.active) this.onAttack(this.currentTarget); 
    }

    cancelCasting() {
        if (!this.isCasting) return;
        this.isCasting = false;
        this.castTimer = 0;
        this.attackCooldown = 0.5; 
        this.resetTint();
        if (this.scene.combatManager) this.scene.combatManager.showFloatingText(this.x, this.y - 40, "취소됨!", "#ff0000");
    }

    resetTint() {
        if (!this.bodySprite) return;
        if (this.team === 'ENEMY') this.bodySprite.setTint(0xff8888);
        else if (this.stats.color) this.bodySprite.setTint(this.stats.color);
        else this.bodySprite.clearTint();
    }

    playHitAnim(damage) {
        this.each(c => { if(c.setTint && c !== this.hpBar && c !== this.outline) c.setTint(0xffffff); });
        this.scene.time.delayedCall(100, () => {
            if (!this.active) return;
            this.each(c => {
                if(c.setTint && c !== this.hpBar && c !== this.outline) {
                    c.clearTint();
                    if(c === this.bodySprite) {
                        if(this.isCasting) c.setTint(0xffff00); 
                        else if(this.team === 'ENEMY') c.setTint(0xff8888);
                        else if(this.stats.color) c.setTint(this.stats.color);
                    }
                }
            });
        });
        const bx = (this.team === 'ENEMY') ? -1 : 1;
        this.scene.tweens.add({ targets: this, scaleY: 0.8, scaleX: bx * 1.2, duration: 50, yoyo: true, ease: 'Sine.easeInOut' });
    }

    onAttack(target) {
        if (this.isStealthed) { this.isStealthed = false; this.setAlpha(1.0); }
        const bx = (this.team === 'ENEMY') ? -1 : 1;
        this.scene.tweens.add({ targets: this, scaleX: bx * 1.1, scaleY: 0.9, duration: 100, yoyo: true, ease: 'Back.easeOut' });
        switch (this.weaponAnimType) {
            case 'SWING': this.playSwingAnim(); break;
            case 'STAB':  this.playStabAnim(); break;
            case 'SHOOT': this.playShootAnim(); break;
            case 'CAST':  this.playCastAnim(); break;
            case 'BODY':  this.playBodyAnim(); break;
            default:      this.playSwingAnim(); break;
        }
        this.dealDamage(target);
    }

    playSwingAnim() { if(this.weaponSprite) this.scene.tweens.add({ targets: this.weaponSprite, angle: { from: -45, to: 120 }, duration: 120, yoyo: true, ease: 'Back.easeOut' }); }
    playStabAnim() { if(this.weaponSprite) this.scene.tweens.add({ targets: this.weaponSprite, x: '+=20', duration: 50, yoyo: true, ease: 'Power2' }); }
    playShootAnim() { if(this.weaponSprite) this.scene.tweens.add({ targets: this.weaponSprite, x: '-=8', angle: { from: 0, to: -20 }, duration: 100, yoyo: true }); }
    playCastAnim() { if(this.weaponSprite) this.scene.tweens.add({ targets: this.weaponSprite, y: '-=15', angle: { from: 0, to: -30 }, duration: 250, yoyo: true }); }
    playBodyAnim() { if(this.bodySprite) this.scene.tweens.add({ targets: this.bodySprite, x: (this.team === 'ALLY' ? 15 : -15), duration: 80, yoyo: true, ease: 'Bounce.easeOut' }); }

    dealDamage(target) {
        if ((this.stats.attackType || 'SLASH') === 'SHOOT' && typeof Projectile !== 'undefined') {
            this.scene.activeProjectiles.push(new Projectile(this.scene, this, target));
        } else {
            if (this.scene.applyDamage) this.scene.applyDamage(this, target, this.stats.damage);
            if (this.scene.artifactManager) this.scene.artifactManager.onDealDamage(this, target, this.stats.damage);
        }
    }

    setLookingAt(tx, ty) {
        if (tx < this.x) { this.setScale(-1, 1); if (this.hpBar) this.hpBar.setScale(-1, 1); }
        else { this.setScale(1, 1); if (this.hpBar) this.hpBar.setScale(1, 1); }
    }
}