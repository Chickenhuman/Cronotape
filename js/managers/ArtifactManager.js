// js/managers/ArtifactManager.js

// ★ 유물 데이터 정의 (수치 데이터화 완료)
const ARTIFACT_DATA = {
    // === [전설: Gold] ===
    'gunpowder': {
        name: '불안정한 화약통',
        desc: '아군 [보병] 사망 시\n주변 모든 유닛에게 30 피해',
        rarity: 'LEGENDARY',
        image: 'art_gunpowder',
        val: 30,       // 폭발 데미지
        radius: 50     // 폭발 반경
    },
    'turret': {
        name: '자동 방어 포탑',
        desc: '기지에 포탑 설치.\n5초마다 적에게 포격 (15 피해)',
        rarity: 'LEGENDARY',
        image: 'art_turret',
        val: 15,       // 포격 데미지
        cooldown: 5.0, // 발사 간격
        range: 600     // 사거리 (신규 추가)
    },

    // === [에픽: Purple] ===
    'vampire': {
        name: '흡혈의 송곳니',
        desc: '물리 공격 시\n피해량의 20% 체력 회복',
        rarity: 'EPIC',
        image: 'art_vampire',
        val: 0.2       // 흡혈율 (20%)
    },
    'thorn': {
        name: '가시 갑옷',
        desc: '근접 피격 시\n공격자에게 5 고정 피해',
        rarity: 'EPIC',
        image: 'art_thorn',
        val: 5         // 반사 데미지
    },

    // === [희귀: Green] ===
    'valve': {
        name: '황금 밸브',
        desc: '라운드 시작 시\n코스트 +2 획득',
        rarity: 'RARE',
        image: 'art_valve',
        val: 2         // 획득 코스트
    },
    'recycler': {
        name: '고철 회수기',
        desc: '아군 [구조물] 파괴 시\n코스트 1 회복',
        rarity: 'RARE',
        image: 'art_recycler',
        val: 1         // 회복 코스트
    }
};

const RARITY_COLORS = {
    'RARE': '#00ff00',      // 녹색
    'EPIC': '#d000ff',      // 보라색
    'LEGENDARY': '#ffd700'  // 금색
};

class ArtifactManager {
    constructor(scene) {
        this.scene = scene;
        this.turretCooldown = 0;
        this.uiContainer = null;
    }

    init() {
        this.createUI();
        this.updateUI(); 
        this.setupEditor();
    }
    
    get inventory() {
        return GAME_DATA.artifacts;
    }

    addArtifact(key) {
        if (this.hasArtifact(key)) {
            const refundGold = 100;
            GAME_DATA.addGold(refundGold);
            this.scene.addLog(`중복 유물 반환: ${ARTIFACT_DATA[key].name} -> ${refundGold}G`, "log-gold");
            if (this.scene.showFloatingText) {
                this.scene.showFloatingText(
                    this.scene.scale.width/2, 
                    this.scene.scale.height/2, 
                    `이미 보유 중!\n골드 +${refundGold}`, 
                    '#ffd700'
                );
            }
            if (this.scene.updateUI) this.scene.updateUI();
            return { success: false, reason: 'DUPLICATE', refund: refundGold }; 
        }

        GAME_DATA.addArtifact(key);
        this.scene.addLog(`유물 획득: ${ARTIFACT_DATA[key].name}`, "log-green");
        this.updateUI();
        return { success: true, item: ARTIFACT_DATA[key].name };
    }

    getRandomArtifactKey() {
        const allKeys = Object.keys(ARTIFACT_DATA);
        const owned = this.inventory;
        const available = allKeys.filter(key => !owned.includes(key));
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    }

    removeArtifact(key) {
        const idx = this.inventory.indexOf(key);
        if (idx > -1) {
            this.inventory.splice(idx, 1);
            this.scene.addLog(`유물 제거: ${ARTIFACT_DATA[key].name}`);
            this.updateUI();
        }
    }

    hasArtifact(key) {
        return this.inventory.includes(key);
    }

    // ====================================================
    // ★ [핵심] 게임 플레이 훅 (Hook)
    // ====================================================

    update(dt) {
        // [전설] 자동 방어 포탑 로직
        if (this.hasArtifact('turret')) {
            const data = ARTIFACT_DATA['turret'];
            this.turretCooldown -= dt;
            
            // 데이터의 쿨타임 사용
            if (this.turretCooldown <= 0) {
                this.fireTurret(data);
                this.turretCooldown = data.cooldown; 
            }
        }
    }

    onUnitDeath(unit) {
        // [전설] 불안정한 화약통 (시체 폭발)
        if (this.hasArtifact('gunpowder') && unit.team === 'ALLY' && unit.stats.race === '보병') {
            // 데이터 전달
            this.triggerExplosion(unit, ARTIFACT_DATA['gunpowder']);
        }

        // [희귀] 고철 회수기
        if (this.hasArtifact('recycler') && unit.team === 'ALLY' && unit.stats.race === '구조물') {
            const data = ARTIFACT_DATA['recycler'];
            this.scene.playerCost += data.val;
            this.scene.updateCostUI();
            this.scene.showFloatingText(unit.x, unit.y, `+${data.val} Cost`, '#ffff00');
        }
    }

    onRoundStart() {
        // [희귀] 황금 밸브
        if (this.hasArtifact('valve')) {
            const data = ARTIFACT_DATA['valve'];
            this.scene.playerCost += data.val;
            this.scene.updateCostUI();
            this.scene.addLog(`${data.name}: 코스트 +${data.val}`);
        }
    }

    onDealDamage(attacker, target, damageAmount) {
        // [에픽] 흡혈의 송곳니
        if (this.hasArtifact('vampire') && attacker.team === 'ALLY') {
            const data = ARTIFACT_DATA['vampire'];
            const heal = Math.floor(damageAmount * data.val);
            if (heal > 0) {
                attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
            }
        }
        
        // ★ [추가] 가시 갑옷 (피격 시 반사 데미지)
        // 주의: 이 함수는 onDealDamage이므로 attacker가 때린 상황임.
        // target이 '가시 갑옷'을 가지고 있다면 attacker에게 데미지를 줘야 함.
        if (this.hasArtifact('thorn') && target.team === 'ALLY') {
            const data = ARTIFACT_DATA['thorn'];
            // 근접 공격인지 확인 (거리가 60 이하일 때 등으로 판단하거나 attackType 확인)
            const dist = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
            if (dist <= 60) {
                 this.scene.applyDamage({scene: this.scene}, attacker, data.val);
                 // 시각 효과 (선택)
                 // this.scene.showFloatingText(attacker.x, attacker.y, `-${data.val}`, '#ffffff');
            }
        }
    }

    // ====================================================
    // ★ 개별 유물 구현부 (데이터 주도형으로 변경됨)
    // ====================================================

    triggerExplosion(unit, data) {
        const radius = data.radius || 50;
        const damage = data.val || 30;

        // 시각 효과
        this.scene.createExplosion(unit.x, unit.y, radius, 0xffaa00);
        
        // 범위 데미지
        this.scene.activeUnits.forEach(target => {
            if (!target.active) return;
            if (target === unit) return; 

            const dist = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
            if (dist <= radius) {
                this.scene.applyDamage({scene: this.scene}, target, damage);
            }
        });
        this.scene.addLog(`${data.name} 폭발!`, "log-red");
    }

    fireTurret(data) {
        const base = this.scene.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (!base) return;

        // 가장 가까운 적 찾기
        const target = this.scene.findNearestEnemy(); 
        if (target) {
            // 사거리 체크 (데이터 활용)
            const dist = Phaser.Math.Distance.Between(base.x, base.y, target.x, target.y);
            const range = data.range || 9999;
            
            if (dist <= range) {
                // 투사체 발사
                const dummyOwner = {
                    x: base.x, y: base.y,
                    stats: { damage: data.val, projectileSpeed: 400, color: 0x00ffff }
                };
                if (typeof Projectile !== 'undefined') {
                    const proj = new Projectile(this.scene, dummyOwner, target);
                    this.scene.activeProjectiles.push(proj);
                }
            }
        }
    }

    getNewArtifactKey(targetRarity = null) {
        const allKeys = Object.keys(ARTIFACT_DATA);
        const owned = GAME_DATA.artifacts || [];
        let candidates = allKeys.filter(key => !owned.includes(key));

        if (targetRarity) {
            candidates = candidates.filter(key => ARTIFACT_DATA[key].rarity === targetRarity);
        }

        if (candidates.length === 0) return null;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick;
    }

    // ====================================================
    // ★ UI 및 에디터
    // ====================================================

    createUI() {
        let artContainer = document.getElementById('artifact-container');
        if (!artContainer) {
            artContainer = document.createElement('div');
            artContainer.id = 'artifact-container';
            artContainer.className = 'artifact-container';
            document.body.appendChild(artContainer);
        }
        this.uiDOM = artContainer;
    }

    updateUI() {
        if (!this.uiDOM) return;
        this.uiDOM.innerHTML = ''; 

        this.inventory.forEach(key => {
            const data = ARTIFACT_DATA[key];
            const div = document.createElement('div');
            div.className = 'artifact-icon';
            div.style.borderColor = RARITY_COLORS[data.rarity];
            
            div.innerText = data.name[0]; 
            
            const tooltip = document.createElement('div');
            tooltip.className = 'artifact-tooltip';
            
            const rarityName = (data.rarity === 'LEGENDARY') ? '전설' : (data.rarity === 'EPIC' ? '에픽' : '희귀');
            const rarityColor = RARITY_COLORS[data.rarity];

            tooltip.innerHTML = `
                <div class="art-tooltip-header" style="color:${rarityColor}">
                    ${data.name} <span style="font-size:11px; color:#aaa;">[${rarityName}]</span>
                </div>
                <div class="art-tooltip-desc">${data.desc.replace(/\n/g, '<br>')}</div>
            `;

            div.appendChild(tooltip);
            this.uiDOM.appendChild(div);
        });
    }

    setupEditor() {
        const editorPanel = document.getElementById('artifact-editor');
        if (!editorPanel) return;

        editorPanel.innerHTML = '<h3>유물 에디터</h3>';
        
        Object.keys(ARTIFACT_DATA).forEach(key => {
            const data = ARTIFACT_DATA[key];
            const btn = document.createElement('button');
            btn.innerText = data.name;
            btn.style.borderLeft = `5px solid ${RARITY_COLORS[data.rarity]}`;
            btn.className = 'editor-btn';
            
            btn.onclick = () => {
                if (this.hasArtifact(key)) {
                    this.removeArtifact(key);
                    btn.classList.remove('active');
                } else {
                    this.addArtifact(key);
                    btn.classList.add('active');
                }
            };
            editorPanel.appendChild(btn);
        });
    }
}