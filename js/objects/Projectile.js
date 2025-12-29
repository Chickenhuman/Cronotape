// js/objects/Projectile.js

class Projectile extends Phaser.GameObjects.Container { // Arc 대신 Container 사용 추천 (확장성 위해)
    constructor(scene, owner, target) {
        super(scene, owner.x, owner.y);
        
        this.scene = scene;
        this.owner = owner;
        this.target = target;
        this.speed = owner.stats.projectileSpeed || 300; 
        this.damage = owner.stats.damage;
        this.color = owner.stats.color || 0xffffff;

        // 타겟의 마지막 위치 기억
        this.lastX = target.x;
        this.lastY = target.y;

        // [시각화] 단순 원 대신 가늘고 긴 투사체 모양 만들기
        this.createVisuals();

        scene.add.existing(this);
    }

    createVisuals() {
        // 투사체 본체 (가늘고 긴 막대)
        const body = this.scene.add.rectangle(0, 0, 15, 3, this.color);
        // 투사체 머리 (삼각형 느낌)
        const head = this.scene.add.triangle(8, 0, 0, -4, 0, 4, 8, 0, this.color);
        
        this.add([body, head]);
    }

    update(dt) {
        if (!this.active) return;

        // 1. 타겟 추적 (살아있으면 위치 갱신)
        if (this.target.active && this.target.currentHp > 0) {
            this.lastX = this.target.x;
            this.lastY = this.target.y;
        } 

        // 2. 이동 (각도 계산 포함)
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.lastX, this.lastY);
        this.rotation = angle; // 투사체 회전

        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        // 3. 도착 체크
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.lastX, this.lastY);
        
        if (dist < 20) { // 도착으로 간주
            if (this.target.active && this.target.currentHp > 0) {
                // [명중] 데미지 입힘
                this.scene.applyDamage(this.owner, this.target, this.damage);
                this.destroy(); // 즉시 삭제
            } 
            else {
                // [빗나감] 타겟이 이미 죽었음 -> 땅에 꽂히는 효과
                this.createStuckEffect(); 
                this.destroy(); // 투사체 자체는 삭제 (잔상은 남김)
            }
        }
    }

    // ★ [신규 기능] 땅에 꽂히는 잔상 효과
    createStuckEffect() {
        // 현재 위치와 각도에 '잔상' 스프라이트 생성
        const stuckArrow = this.scene.add.container(this.x, this.y);
        
        // 투사체와 동일한 모양 생성 (색상은 약간 어둡게)
        const body = this.scene.add.rectangle(0, 0, 15, 3, this.color);
        body.setAlpha(0.7); // 반투명
        const head = this.scene.add.triangle(8, 0, 0, -4, 0, 4, 8, 0, this.color);
        head.setAlpha(0.7);

        stuckArrow.add([body, head]);
        stuckArrow.rotation = this.rotation; // 꽂힌 각도 유지
        
        // 살짝 더 깊이 박히는 느낌 (이동 방향으로 5px 더 전진)
        stuckArrow.x += Math.cos(this.rotation) * 5;
        stuckArrow.y += Math.sin(this.rotation) * 5;

        // 2초 동안 서서히 사라짐
        this.scene.tweens.add({
            targets: stuckArrow,
            alpha: 0,
            duration: 2000, 
            ease: 'Power1',
            onComplete: () => {
                stuckArrow.destroy();
            }
        });
    }
}