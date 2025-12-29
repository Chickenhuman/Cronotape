// js/managers/CombatManager.js

class CombatManager {
    constructor(scene) {
        this.scene = scene;
    }

    applyDamage(attacker, target, damage) {
        if (!target.active || target.currentHp <= 0) return;
        target.currentHp -= damage;

        if (damage > 0) {
            const isCrit = (damage > 30);
            const color = (attacker.team === 'ALLY') ? '#ffffff' : '#ff8888'; 
            this.showFloatingText(target.x, target.y - 30, `-${damage}`, color, isCrit ? '24px' : '16px', isCrit ? 'bold' : 'normal');
            if (isCrit) this.scene.cameras.main.shake(100, 0.01); 
        } else if (damage < 0) {
            this.showFloatingText(target.x, target.y - 30, `+${Math.abs(damage)}`, '#00ff00', '16px', 'bold');
        }

        if (target.playHitAnim && damage > 0) target.playHitAnim(damage); 

        if (target.currentHp <= 0) {
            if (attacker && typeof attacker.killCount === 'number') attacker.killCount++;
            this.killUnit(target);
        }
    }

    killUnit(unit) {
        if (!unit.active) return;
        unit.active = false;
        if (this.scene.artifactManager) this.scene.artifactManager.onUnitDeath(unit);
        if (unit.hpBar) unit.hpBar.destroy();
        if (unit.hpText) unit.hpText.destroy();
        if (unit.outline) unit.outline.destroy();
        
        this.showFloatingText(unit.x, unit.y, "💀", "#aaaaaa", '24px');
        this.scene.tweens.add({ targets: unit, alpha: 0, scaleX: 0, scaleY: 0, duration: 500, onComplete: () => unit.destroy() });
        this.scene.addLog(`${unit.name || "유닛"} 사망!`, "log-red");
    }

    applySkillEffect(plan, hostileTeam) {
        const stats = SKILL_STATS[plan.name];
        if (!stats) return;

        this.playSkillAnim(plan); 

        setTimeout(() => {
            if (!this.scene || !this.scene.activeUnits) return;

            // 피아식별 로직
            const targets = this.scene.activeUnits.filter(u => {
                if(!u.active) return false;
                const dist = Phaser.Math.Distance.Between(plan.x, plan.y, u.x, u.y);
                if (dist > stats.radius) return false;
                return stats.friendlyFire ? true : u.team === hostileTeam;
            });

            targets.forEach(u => {
                if (stats.damage > 0) this.applyDamage({ team: 'NEUTRAL' }, u, stats.damage);
                if (stats.shield > 0) this.applyDamage({ team: 'NEUTRAL' }, u, -stats.shield);
                
                // ★ [핵심] CC기 통합 적용 로직
                // 1. 기존 stun 속성 호환 처리
                if (stats.stun > 0) {
                    u.applyCC('STUN', stats.stun);
                    this.showFloatingText(u.x, u.y - 40, CC_RULES['STUN'].msg, '#ffff00');
                }

                // 2. 확장된 CC 객체 처리 (예: stats.cc = { 'KNOCKBACK': 0.5 })
                if (stats.cc) {
                    for (const [type, duration] of Object.entries(stats.cc)) {
                        u.applyCC(type, duration);
                        
                        // 텍스트 표시
                        const rule = CC_RULES[type];
                        if (rule && rule.msg) {
                            this.showFloatingText(u.x, u.y - 40, rule.msg, '#ffaa00');
                        }

                        // ★ [신규] 넉백 물리 효과 (폭발 중심에서 밀어냄)
                        if (type === 'KNOCKBACK') {
                            this.applyKnockbackForce(u, plan.x, plan.y);
                        }
                    }
                }

                if (u.isStealthed) { 
                    u.isStealthed = false; 
                    u.setAlpha(1.0); 
                    this.showFloatingText(u.x, u.y - 40, "👁️ 발각!", '#ff0000'); 
                }
            });
        }, 400); 
    }

    // ★ [신규] 넉백 물리 효과 함수
    applyKnockbackForce(unit, sourceX, sourceY) {
        const angle = Phaser.Math.Angle.Between(sourceX, sourceY, unit.x, unit.y);
        const distance = 50; // 밀려나는 거리 (픽셀)
        
        const targetX = unit.x + Math.cos(angle) * distance;
        const targetY = unit.y + Math.sin(angle) * distance;

        this.scene.tweens.add({
            targets: unit,
            x: targetX,
            y: targetY,
            duration: 200, // 0.2초 동안 밀려남
            ease: 'Power2'
        });
    }

    fireCommanderSkill(target, cmd) {
        this.scene.addLog(`${cmd.name} 포격 개시!`, "log-blue");
        this.createExplosion(target.x, target.y, 50, cmd.color || 0xff5555);
        this.applyDamage({ team: 'ALLY' }, target, cmd.damage);
    }

    playSkillAnim(plan) {
        const stats = SKILL_STATS[plan.name];
        if (!stats) return;
        if (stats.hasProjectile) {
            const p = this.scene.add.circle(plan.x, plan.y - 300, 10, stats.color);
            this.scene.tweens.add({ targets: p, y: plan.y, duration: 400, ease: 'Quad.easeIn', onComplete: () => { p.destroy(); this.createExplosion(plan.x, plan.y, stats.radius, stats.color); } });
        } else { this.createExplosion(plan.x, plan.y, stats.radius, stats.color); }
    }

    createExplosion(x, y, radius, color) {
        const c = this.scene.add.circle(x, y, 10, color, 0.6).setDepth(150);
        this.scene.tweens.add({ targets: c, scale: radius / 10, alpha: 0, duration: 500, onComplete: () => c.destroy() });
    }

    showFloatingText(x, y, msg, color, fontSize='16px', fontStyle='bold') {
        const t = this.scene.add.text(x, y-20, msg, { fontSize, fontStyle, color, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setDepth(200);
        this.scene.tweens.add({ targets: t, y: y - 60, alpha: 0, scale: 1.5, duration: 800, ease: 'Back.easeOut', onComplete: () => t.destroy() });
    }
}