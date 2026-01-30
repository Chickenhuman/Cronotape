// js/objects/Unit.js

class Unit extends Phaser.GameObjects.Container {
   constructor(scene, x, y, name, team, stats) {
        super(scene, x, y);
        this.scene = scene;
        this.name = name;
        this.team = team;
        this.stats = stats;
        
        // 물리 엔진 추가
        scene.physics.add.existing(this);
        this.body.setCircle(15); 
        this.body.setOffset(-15, -15); 

        // ------------------------------------------------------------
        // 🧬 [파츠 조립 시스템] (자동화 적용 완료)
        // ------------------------------------------------------------
        this.parts = {};
        
        // 기본 파츠 설정 (데이터에 없으면 기사 셋으로)
        const defaultParts = { 
            body: 'body_knight', 
            weapon: 'weapon_sword', 
            acc: 'acc_shield' 
        };
        // 실제 데이터와 병합 (예: { body:..., weapon:..., wings:... })
        const partConfig = { ...defaultParts, ...(stats.parts || {}) };

        // ★ [핵심 수정] 반복문으로 모든 파츠 자동 조립
        Object.keys(partConfig).forEach(partName => {
            const textureKey = partConfig[partName];
            if (!textureKey) return;

            // 1. 텍스처 키 결정 (무기는 팀 색상 X, 나머지는 팀 색상 O 규칙 적용)
            const isNeutral = (partName === 'weapon'); 
            const finalKey = isNeutral ? textureKey : `${textureKey}_${team}`;

            // 2. 스프라이트 생성
            const sprite = scene.add.sprite(0, 0, finalKey);
            
            // 3. 기본 크기 및 위치 조정
            sprite.setDisplaySize(40, 40);
            sprite.setOrigin(0.5, 0.9);
            sprite.y = 15;

            // 4. SVG_DATA의 오프셋/Depth 정보 적용 (데이터 주도형)
            const svgData = (typeof SVG_DATA !== 'undefined') ? SVG_DATA[textureKey] : null;
            if (svgData) {
                if (svgData.offset) sprite.setPosition(svgData.offset.x, svgData.offset.y);
                if (svgData.depth) sprite.setDepth(svgData.depth);
            }

            // [특수 예외] 무기(weapon)는 위치/크기 보정
            if (partName === 'weapon') {
                sprite.setDisplaySize(35, 35);
                const wOffset = (svgData && svgData.offset) ? svgData.offset : { x: 18, y: 10 };
                sprite.setPosition(wOffset.x, wOffset.y);
            }
            
            // [특수 예외] 기지(Base)는 크기가 큼
            if (stats.isStructure && name.includes('Base') && partName === 'body') {
                 sprite.setDisplaySize(100, 120);
                 sprite.setOrigin(0.5, 1.0); 
                 sprite.y = 0;
            }

            // 컨테이너에 추가 및 참조 저장
            this.add(sprite);
            this.parts[partName] = sprite;
        });

        // ★ [중요] 기존 애니메이션 코드와의 호환성을 위해 참조 연결
        // (날개나 망토는 애니메이션 안 해도 되지만, 몸통/무기는 움직여야 하므로)
        this.bodySprite = this.parts.body;
        this.weaponSprite = this.parts.weapon;
        
        // 기본 포즈 저장 (애니메이션 복귀용)
        this.defaultPose = {};
        Object.keys(this.parts).forEach(key => {
            const p = this.parts[key];
            this.defaultPose[key] = { x: p.x, y: p.y, angle: p.angle, scaleX: p.scaleX, scaleY: p.scaleY };
        });

        // 구조물 고정
        if (stats.isStructure) {
            this.body.setImmovable(true); 
            this.body.moves = false;      
        }

        // ------------------------------------------------------------
        // ⚔️ 전투 변수 초기화 (기존 코드 유지)
        // ------------------------------------------------------------
        this.currentHp = stats.hp;
        this.active = true;
        this.isBase = false;
        this.killCount = 0;
        this.statusEffects = {}; 
        this.attackCooldown = 0;
        this.isCasting = false;
        this.castTimer = 0;
        this.maxCastTime = stats.castTime || 0; // 캐스팅 시간
        this.isStealthed = (stats.traits && stats.traits.includes("은신"));
        this.pathTimer = 0; 
        this.isSpawned = true;
        this.hp = stats.hp;
        this.speed = stats.speed;
        this.damage = stats.damage;
        this.range = stats.range;
        this.attackSpeed = stats.attackSpeed;
        this.race = stats.race;
        
        // 체력바 초기화
        this.isHovered = false; 
        this.initHpBar();       

        scene.add.existing(this); 
        this.setInteractive(new Phaser.Geom.Circle(0, 0, 25), Phaser.Geom.Circle.Contains);

        // 툴팁 이벤트
        this.on('pointerover', () => {
            if (this.active && this.scene.uiManager) {
                this.scene.uiManager.showUnitTooltip(this);
            }
        });
        this.on('pointerout', () => {
            if (this.scene.uiManager) {
                this.scene.uiManager.hideUnitTooltip();
            }
        });

        this.sort('depth');
        this.startIdleAnim();
    }
    startIdleAnim() {
        if (!this.active || !this.scene) return;
        
        // 랜덤 딜레이로 유닛마다 숨쉬는 타이밍 다르게
        const randomDelay = Math.random() * 1000;

        this.scene.time.delayedCall(randomDelay, () => {
            if (!this.active) return;
            
            // 모든 파츠에 대해 트윈 적용
            Object.keys(this.parts).forEach(key => {
                const sprite = this.parts[key];
                if (!sprite) return;
                
                // 1. 무기: 둥실둥실 (각도 조절)
                if (key === 'weapon') {
                    this.scene.tweens.add({
                        targets: sprite,
                        angle: { from: 10, to: 20 },
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } 
                // 2. 몸통 & 장신구: 숨쉬기 (스케일 조절)
                else {
                    // ★ 장신구(acc)도 여기서 같이 처리됨
                    const currentScaleY = (this.defaultPose[key] && this.defaultPose[key].scaleY) || 1;
                    
                    this.scene.tweens.add({
                        targets: sprite,
                        scaleY: currentScaleY * 0.95, // 5% 수축
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            });
        }); 
    }

update(dt) {
        if (typeof GameLogic !== 'undefined' && GameLogic.runUnitLogic) {
            GameLogic.runUnitLogic(this, this.scene.activeUnits, dt, this.scene.grid, this.scene.tileSize, this.scene.easystar);
        }

        // 체력바 업데이트 호출
        this.updateHpBar();
    }
    initHpBar() {
        // 기지 여부 판단
        this.isBase = (this.name.toLowerCase().includes('base') || this.stats.isStructure) && this.stats.hp > 100;

        // [아이디어 2] 체력 비례 크기: 기본 30, 체력 1000당 +10, 최대 60 (기지는 80 고정)
        const bonusWidth = Math.min((this.stats.hp / 1000) * 10, 30);
        this.hpBarWidth = this.isBase ? 80 : (30 + bonusWidth);
        this.hpBarHeight = this.isBase ? 10 : 5; // 두께
        this.hpBarY = this.isBase ? -100 : -35; // 위치

        // 체력바 컨테이너 (바 + 배경 + 눈금을 묶음)
        this.hpBarContainer = this.scene.add.container(0, this.hpBarY);
        this.add(this.hpBarContainer);

        // 1. 배경 (검정 테두리 역할)
        this.hpBarBg = this.scene.add.rectangle(0, 0, this.hpBarWidth + 2, this.hpBarHeight + 2, 0x000000);
        this.hpBarContainer.add(this.hpBarBg);

        // 2. 실제 체력바 (Graphics로 그려서 유동적으로 처리)
        this.hpBarGraphics = this.scene.add.graphics();
        this.hpBarContainer.add(this.hpBarGraphics);

        // 3. 눈금 오버레이 (한 번만 그려두면 됨)
        this.hpGridGraphics = this.scene.add.graphics();
        this.hpBarContainer.add(this.hpGridGraphics);
        
        // [아이디어 3] 눈금 그리기 (250 단위)
        this.drawHpGrid();

        // 초기에는 숨김 (100% 상태이므로)
        this.hpBarContainer.setVisible(false);
    }

    drawHpGrid() {
        this.hpGridGraphics.clear();
        this.hpGridGraphics.lineStyle(1, 0x000000, 0.8); // 1px 검은 선, 투명도 0.8

        const unitHealth = 50; // 눈금 단위
        const totalSegments = Math.floor(this.stats.hp / unitHealth);
        
        // 왼쪽 끝(-width/2) 부터 오른쪽 끝(+width/2) 까지
        const startX = -this.hpBarWidth / 2;
        
        for (let i = 1; i < totalSegments; i++) {
            const ratio = (i * unitHealth) / this.stats.hp;
            if (ratio >= 1) break;
            
            const xPos = startX + (this.hpBarWidth * ratio);
            // 세로선 긋기
            this.hpGridGraphics.beginPath();
            this.hpGridGraphics.moveTo(xPos, -this.hpBarHeight / 2);
            this.hpGridGraphics.lineTo(xPos, this.hpBarHeight / 2);
            this.hpGridGraphics.strokePath();
        }
    }

    updateHpBar() {
        if (!this.hpBarContainer) return;

        const maxHp = this.stats.hp;
        const currentHp = Phaser.Math.Clamp(this.currentHp, 0, maxHp);
        const ratio = currentHp / maxHp;

        // [아이디어 1] 표시 조건: 체력이 깎였거나(ratio < 1) 마우스가 위에 있을 때
        const shouldShow = (ratio < 1.0) || (ratio > 1.0) || this.isHovered;
        this.hpBarContainer.setVisible(shouldShow);

        if (!shouldShow) return;

        // 체력바 다시 그리기
        this.hpBarGraphics.clear();
        
        // 색상 결정 (30% 미만 위험)
        const color = (ratio > 0.3) ? 0x00ff00 : 0xff0000;
        this.hpBarGraphics.fillStyle(color, 1);

        // 중앙 정렬을 위해 x좌표 조정
        const currentWidth = this.hpBarWidth * ratio;
        // 왼쪽 정렬처럼 보이지만 중심 기준이므로, 전체 바의 왼쪽 끝에서 시작해서 currentWidth만큼 그림
        const startX = -this.hpBarWidth / 2;
        
        this.hpBarGraphics.fillRect(startX, -this.hpBarHeight / 2, currentWidth, this.hpBarHeight);
    }

    checkCC() {
        let result = { canMove: true, canAttack: true, cancelCast: false };
        if (typeof CC_RULES === 'undefined') return result;
        for (const type in this.statusEffects) {
            const rule = CC_RULES[type];
            if (!rule) continue;
            if (!rule.canMove) result.canMove = false;
            if (!rule.canAttack) result.canAttack = false;
            if (rule.cancelCast) result.cancelCast = true;
        }
        return result;
    }

    applyCC(type, duration) {
        if (!this.statusEffects) this.statusEffects = {};
        const current = this.statusEffects[type] || 0;
        this.statusEffects[type] = Math.max(current, duration);
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
        this.each(c => { 
            // 체력바 배경과 체력바는 틴트 효과에서 제외
            if(c.setTint && c !== this.hpBar && c !== this.hpBarBg) c.setTint(0xffffff); 
        });
        this.scene.time.delayedCall(100, () => {
            if (!this.active) return;
            this.each(c => {
                if(c.setTint && c !== this.hpBar && c !== this.hpBarBg) {
                    c.clearTint();
                    if(c === this.bodySprite) {
                        this.resetTint();
                    }
                }
            });
        });
        const bx = (this.team === 'ENEMY') ? -1 : 1;
        this.scene.tweens.add({ targets: this, scaleY: 0.8, scaleX: bx * 1.2, duration: 50, yoyo: true, ease: 'Sine.easeInOut' });
    }

    onAttack(target) {
        if (this.isStealthed) { this.isStealthed = false; this.setAlpha(1.0); }
        this.setLookingAt(target.x, target.y);
        const bx = (this.scaleX < 0) ? -1 : 1; 
        this.scene.tweens.add({ targets: this, scaleX: bx * 1.1, scaleY: 0.9, duration: 100, yoyo: true, ease: 'Back.easeOut' });
        
        switch (this.stats.weaponAnimType || 'SWING') {
            case 'SWING': this.playSwingAnim(); break;
            case 'HEAVY_SWING': this.playHeavySwingAnim(); break; 
            case 'STAB':  this.playStabAnim(); break;
            case 'SHOOT': this.playShootAnim(); break;
            case 'CAST':  this.playCastAnim(); break;
            default:      this.playSwingAnim(); break;
        }
        this.dealDamage(target);
    }
// [수정] 스윙 공격: 장신구도 역동적으로 움직임
    playSwingAnim() {
        if (!this.active || !this.scene) return;
        if (!this.parts.weapon) return;

        // 1. 기존 트윈 제거 및 초기화
        this.scene.tweens.killTweensOf(this.parts.weapon);
        if (this.parts.body) this.scene.tweens.killTweensOf(this.parts.body);
        if (this.parts.acc) this.scene.tweens.killTweensOf(this.parts.acc); // ★ 장신구 트윈 초기화

        // 초기 위치 복구
        this.resetPartToDefault('weapon');
        this.resetPartToDefault('body');
        this.resetPartToDefault('acc'); // ★

        // ====================================================
        // ⚔️ 무기 애니메이션 (기존과 동일)
        // ====================================================
        this.scene.tweens.add({
            targets: this.parts.weapon,
            angle: -45, 
            duration: 150,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.createWeaponTrail();
                this.scene.tweens.add({
                    targets: this.parts.weapon,
                    angle: 110, 
                    duration: 50,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: this.parts.weapon,
                            angle: this.defaultPose.weapon.angle,
                            duration: 300,
                            ease: 'Quad.easeOut',
                            onComplete: () => this.startIdleAnim()
                        });
                    }
                });
            }
        });

        // ====================================================
        // 🛡️ 몸통 & 장신구 애니메이션 (싱크로율 맞춤)
        // ====================================================
        
        // (1) 예비 동작 (뒤로 젖히기)
        if (this.parts.body) {
            this.scene.tweens.add({
                targets: this.parts.body,
                x: '-=5', angle: -10, duration: 150
            });
        }
        // ★ 장신구도 같이 뒤로 (약간 더 과장되게)
        if (this.parts.acc) {
            this.scene.tweens.add({
                targets: this.parts.acc,
                x: '-=8', // 몸보다 더 뒤로 감 (관성)
                angle: -15, 
                duration: 150 
            });
        }

        // (2) 타격 동작 (앞으로 내지르기)
        this.scene.time.delayedCall(150, () => {
            if (this.parts.body) {
                this.scene.tweens.add({
                    targets: this.parts.body,
                    x: '+=15', angle: 20, duration: 50,
                    ease: 'Back.easeOut', yoyo: true, hold: 100,
                    onComplete: () => this.resetPartToDefault('body')
                });
            }
            
            // ★ 장신구 타격 모션
            if (this.parts.acc) {
                this.scene.tweens.add({
                    targets: this.parts.acc,
                    x: '+=20', // 몸보다 더 앞으로 튀어나감
                    angle: 25, 
                    duration: 50,
                    ease: 'Back.easeOut', yoyo: true, hold: 100,
                    onComplete: () => this.resetPartToDefault('acc')
                });
            }
        });
    }
    // [헬퍼 함수] 파츠 위치 초기화
    resetPartToDefault(key) {
        if (this.parts[key] && this.defaultPose[key]) {
            const def = this.defaultPose[key];
            this.parts[key].setPosition(def.x, def.y);
            this.parts[key].setAngle(def.angle);
            this.parts[key].setScale(def.scaleX, def.scaleY);
        }
    }
// 2. 찌르기 (Stab) - 앞으로 쑥 내밀기
    playStabAnim() {
        if (!this.active || !this.scene) return;
        
        this.scene.tweens.killTweensOf(this.parts.weapon);
        if (this.parts.body) this.scene.tweens.killTweensOf(this.parts.body);
        if (this.parts.acc) this.scene.tweens.killTweensOf(this.parts.acc); // ★

        this.resetPartToDefault('weapon');
        this.resetPartToDefault('body');
        this.resetPartToDefault('acc'); // ★

        const defW = this.defaultPose.weapon; 

        // [무기] 뒤로 뺐다가 앞으로 찌르기
        if (this.parts.weapon) {
            this.scene.tweens.add({
                targets: this.parts.weapon,
                x: defW.x - 10, 
                duration: 100,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.parts.weapon.angle = 90; 
                    this.scene.tweens.add({
                        targets: this.parts.weapon,
                        x: defW.x + 40, 
                        duration: 60,   
                        ease: 'Expo.easeOut',
                        yoyo: true,
                        hold: 50,
                        onComplete: () => {
                            this.resetPartToDefault('weapon');
                            if (!this.parts.body) this.startIdleAnim();
                        }
                    });
                }
            });
        }

        // [몸통] 같이 앞으로 쏠림 (+15px)
        if (this.parts.body) {
            this.scene.tweens.add({
                targets: this.parts.body,
                x: this.defaultPose.body.x + 15,
                duration: 60,
                delay: 100, 
                yoyo: true,
                ease: 'Expo.easeOut',
                onComplete: () => {
                    this.resetPartToDefault('body');
                    this.startIdleAnim();
                }
            });
        }

        // ★ [장신구] 관성으로 더 앞으로 튀어나감 (+20px)
        if (this.parts.acc) {
            this.scene.tweens.add({
                targets: this.parts.acc,
                x: this.defaultPose.acc.x + 20, // 몸보다 더 멀리 (망토가 펄럭이는 느낌)
                duration: 60,
                delay: 100, 
                yoyo: true,
                ease: 'Expo.easeOut',
                onComplete: () => { this.resetPartToDefault('acc'); }
            });
        }
    }
// 3. 사격 (Shoot) - 반동으로 뒤로 밀림
    playShootAnim() { 
        if (!this.active || !this.scene) return;
        
        // 킬 & 리셋 생략 (코드 길이상 위와 동일하게 처리해주세요)
        if (this.parts.weapon) this.scene.tweens.killTweensOf(this.parts.weapon);
        if (this.parts.body) this.scene.tweens.killTweensOf(this.parts.body);
        if (this.parts.acc) this.scene.tweens.killTweensOf(this.parts.acc);
        
        this.resetPartToDefault('weapon');
        this.resetPartToDefault('body');
        this.resetPartToDefault('acc');

        const duration = 150;

        // [무기] 반동
        if (this.parts.weapon) {
            this.scene.tweens.add({ 
                targets: this.parts.weapon, 
                x: { from: 15, to: 10 }, 
                angle: { from: 0, to: -25 }, 
                duration: duration, 
                yoyo: true,
                onComplete: () => { this.resetPartToDefault('weapon'); }
            }); 
        }

        // [몸통] 뒤로 밀림 (x: -5)
        if (this.parts.body) {
            this.scene.tweens.add({
                targets: this.parts.body,
                x: { from: 0, to: -5 }, 
                angle: { from: 0, to: -5 }, 
                duration: duration,
                yoyo: true,
                onComplete: () => {
                    this.resetPartToDefault('body');
                    this.startIdleAnim();
                }
            });
        }

        // ★ [장신구] 더 크게 밀림 (x: -8)
        if (this.parts.acc) {
            this.scene.tweens.add({
                targets: this.parts.acc,
                x: { from: 0, to: -8 }, // 더 큰 반동
                angle: { from: 0, to: -8 }, 
                duration: duration,
                yoyo: true,
                onComplete: () => { this.resetPartToDefault('acc'); }
            });
        }
    }
    // 4. 마법 시전 (Cast) - 공중 부양
playCastAnim() { 
        if (!this.active || !this.scene) return;

        // [초기화] 기존 애니메이션 중단 및 리셋
        if (this.parts.weapon) this.scene.tweens.killTweensOf(this.parts.weapon);
        if (this.parts.body) this.scene.tweens.killTweensOf(this.parts.body);
        if (this.parts.acc) this.scene.tweens.killTweensOf(this.parts.acc);

        this.resetPartToDefault('weapon');
        this.resetPartToDefault('body');
        this.resetPartToDefault('acc');

        const duration = 300;
        
        // ★ [핵심] 이 변수들이 선언되어 있어야 에러가 안 납니다!
        const bodyScaleX = (this.defaultPose.body && this.defaultPose.body.scaleX) || 1;
        const bodyScaleY = (this.defaultPose.body && this.defaultPose.body.scaleY) || 1;
        
        // 장신구 스케일 가져오기 (없으면 1)
        let accScaleX = 1;
        if (this.parts.acc && this.defaultPose.acc) {
            accScaleX = this.defaultPose.acc.scaleX || 1;
        }

        // [무기] 위로 둥둥
        if (this.parts.weapon) {
            this.scene.tweens.add({ 
                targets: this.parts.weapon, 
                y: { from: this.defaultPose.weapon.y, to: this.defaultPose.weapon.y - 20 }, 
                angle: { from: 0, to: -45 }, 
                duration: duration, 
                yoyo: true,
                ease: 'Sine.easeInOut',
                onComplete: () => { this.resetPartToDefault('weapon'); }
            }); 
        }

        // [몸통] 위로 둥둥 (약간 웅크림)
        if (this.parts.body) {
            this.scene.tweens.add({
                targets: this.parts.body,
                y: { from: this.defaultPose.body.y, to: this.defaultPose.body.y - 10 }, 
                scaleX: { from: bodyScaleX, to: bodyScaleX * 0.95 }, 
                duration: duration, 
                yoyo: true,
                onComplete: () => {
                    this.resetPartToDefault('body');
                    this.startIdleAnim();
                }
            });
        }

        // [장신구] 부드럽게 퍼짐 (accScaleX 변수 사용)
        if (this.parts.acc) {
            this.scene.tweens.add({
                targets: this.parts.acc,
                y: { from: this.defaultPose.acc.y, to: this.defaultPose.acc.y - 15 },
                
                // 에러 원인이었던 부분: 이제 위에서 선언했으므로 정상 작동합니다.
                scaleX: { from: accScaleX, to: accScaleX * 1.1 }, 
                
                duration: duration, 
                yoyo: true,
                onComplete: () => { this.resetPartToDefault('acc'); }
            });
        }
    }

playHeavySwingAnim() {
        if (!this.active || !this.scene) return; 
        
        // 초기화
        this.scene.tweens.killTweensOf(this.parts.weapon);
        if (this.parts.body) this.scene.tweens.killTweensOf(this.parts.body);
        if (this.parts.acc) this.scene.tweens.killTweensOf(this.parts.acc); // ★

        this.resetPartToDefault('weapon');
        this.resetPartToDefault('body');
        this.resetPartToDefault('acc'); // ★

        const duration = 250;

        // [무기] 크게 휘두르기
        if(this.parts.weapon) {
            this.scene.tweens.add({ 
                targets: this.parts.weapon, 
                angle: { from: -100, to: 160 }, 
                duration: duration, 
                yoyo: true, 
                ease: 'Cubic.easeIn',
                onStart: () => { this.createWeaponTrail(); },
                onComplete: () => { this.resetPartToDefault('weapon'); }
            }); 
        }

        // [몸통] 힘껏 비틀기 (-20도 -> 30도)
        if(this.parts.body) {
            this.scene.tweens.add({
                targets: this.parts.body,
                angle: { from: -20, to: 30 },
                duration: duration,
                yoyo: true,
                onComplete: () => {
                    this.resetPartToDefault('body');
                    this.startIdleAnim();
                }
            });
        }

        // ★ [장신구] 더 과장되게 비틀기 (-30도 -> 45도)
        if(this.parts.acc) {
            this.scene.tweens.add({
                targets: this.parts.acc,
                angle: { from: -30, to: 45 }, // 몸통보다 더 많이 꺾임 (역동성)
                duration: duration,
                yoyo: true,
                onComplete: () => { this.resetPartToDefault('acc'); }
            });
        }
    }
    createWeaponTrail() { return; }

    dealDamage(target) {
        if ((this.stats.attackType || 'SINGLE') === 'SHOOT' && typeof Projectile !== 'undefined') {
            this.scene.activeProjectiles.push(new Projectile(this.scene, this, target));
        } 
        else {
            if (target.team === this.team) {
                const healAmount = this.stats.damage; 
                target.currentHp = Math.min(target.currentHp + healAmount, target.stats.hp);
                if (this.scene.combatManager) {
                    this.scene.combatManager.showFloatingText(target.x, target.y - 40, `+${healAmount}`, '#00ff00');
                }
            } else {
                if (this.scene.combatManager && this.scene.combatManager.performAttack) {
                    this.scene.combatManager.performAttack(this, target);
                } 
                else if (this.scene.applyDamage) {
                    this.scene.applyDamage(this, target, this.stats.damage);
                }
                if (this.scene.artifactManager) {
                    this.scene.artifactManager.onDealDamage(this, target, this.stats.damage);
                }
            }
        }
    }

    setLookingAt(tx, ty) {
        if (tx < this.x) { 
            this.setScale(-1, 1); 
        } else { 
            this.setScale(1, 1); 
        }
    }
}