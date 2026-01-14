// js/managers/ArtifactManager.js

// ★ 유물 데이터 정의
const ARTIFACT_DATA = {
    // === [전설: Gold] ===
    'gunpowder': {
        name: '불안정한 화약통',
        desc: '아군 [보병] 사망 시\n주변 모든 유닛에게 30 피해',
        rarity: 'LEGENDARY',
        image: 'art_gunpowder'
    },
    'turret': {
        name: '자동 방어 포탑',
        desc: '기지에 포탑 설치.\n5초마다 적에게 포격 (15 피해)',
        rarity: 'LEGENDARY',
        image: 'art_turret'
    },

    // === [에픽: Purple] ===
    'vampire': {
        name: '흡혈의 송곳니',
        desc: '물리 공격 시\n피해량의 20% 체력 회복',
        rarity: 'EPIC',
        image: 'art_vampire'
    },
    'thorn': {
        name: '가시 갑옷',
        desc: '근접 피격 시\n공격자에게 5 고정 피해',
        rarity: 'EPIC',
        image: 'art_thorn'
    },

    // === [희귀: Green] ===
    'valve': {
        name: '황금 밸브',
        desc: '라운드 시작 시\n코스트 +2 획득',
        rarity: 'RARE',
        image: 'art_valve'
    },
    'recycler': {
        name: '고철 회수기',
        desc: '아군 [구조물] 파괴 시\n코스트 1 회복',
        rarity: 'RARE',
        image: 'art_recycler'
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
        
        // ★ [수정] 로컬 배열이 아니라 전역 데이터 참조
        // this.inventory = []; (삭제)
        // this.inventory는 이제 GAME_DATA.artifacts를 바라보게 하거나,
        // 매번 동기화해야 합니다. 여기서는 편의상 getter나 init에서 동기화합니다.
        
        this.turretCooldown = 0;
        this.uiContainer = null;
    }

    init() {
        this.createUI();
        this.updateUI(); // UI 갱신
        this.setupEditor();
    }
    
    // [추가] 인벤토리 접근을 위한 Getter
    get inventory() {
        return GAME_DATA.artifacts;
    }

// js/managers/ArtifactManager.js 내부

    addArtifact(key) {
        // [1] 중복 체크
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

            // ★ [수정] 중복이었음을 알려주는 반환값
            return { success: false, reason: 'DUPLICATE', refund: refundGold }; 
        }

        // [2] 정상 획득
        GAME_DATA.addArtifact(key);
        this.scene.addLog(`유물 획득: ${ARTIFACT_DATA[key].name}`, "log-green");
        
        // 사운드 등...
        this.updateUI();

        // ★ [수정] 성공했음을 알려주는 반환값
        return { success: true, item: ARTIFACT_DATA[key].name };
    }

    // 미보유 유물 중에서 랜덤으로 1개 키(key) 반환
    getRandomArtifactKey() {
        // 전체 유물 목록
        const allKeys = Object.keys(ARTIFACT_DATA);
        
        // 현재 내가 가진 유물 목록 (Getter 활용)
        const owned = this.inventory;

        // [필터링] 전체 - 보유 = 획득 가능 목록
        const available = allKeys.filter(key => !owned.includes(key));

        // 획득 가능한 게 없으면 (모든 유물 수집 완료) null 반환
        if (available.length === 0) return null;

        // 랜덤 선택
        return available[Math.floor(Math.random() * available.length)];
    }

    // 유물 제거 (에디터용)
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
    // ★ [핵심] 게임 플레이 훅 (Hook) - BattleScene에서 호출됨
    // ====================================================

    update(dt) {
        // [전설] 자동 방어 포탑 로직
        if (this.hasArtifact('turret')) {
            this.turretCooldown -= dt;
            if (this.turretCooldown <= 0) {
                this.fireTurret();
                this.turretCooldown = 5.0; // 5초 쿨타임
            }
        }
    }

    onUnitDeath(unit) {
        // [전설] 불안정한 화약통 (시체 폭발)
        if (this.hasArtifact('gunpowder') && unit.team === 'ALLY' && unit.stats.race === '보병') {
            this.triggerExplosion(unit);
        }

        // [희귀] 고철 회수기
        if (this.hasArtifact('recycler') && unit.team === 'ALLY' && unit.stats.race === '구조물') {
            this.scene.playerCost += 1;
            this.scene.updateCostUI();
            this.scene.showFloatingText(unit.x, unit.y, "+1 Cost", '#ffff00');
        }
    }

    onRoundStart() {
        // [희귀] 황금 밸브
        if (this.hasArtifact('valve')) {
            this.scene.playerCost += 2;
            this.scene.updateCostUI();
            this.scene.addLog("황금 밸브: 코스트 +2");
        }
    }

    onDealDamage(attacker, target, damageAmount) {
        // [에픽] 흡혈의 송곳니
        if (this.hasArtifact('vampire') && attacker.team === 'ALLY') {
            const heal = Math.floor(damageAmount * 0.2);
            if (heal > 0) {
                attacker.currentHp = Math.min(attacker.currentHp + heal, attacker.stats.hp);
                // (선택) 힐 텍스트 띄우기
            }
        }
    }

    // ====================================================
    // ★ 개별 유물 구현부
    // ====================================================

triggerExplosion(unit) {
        // 시각 효과
        this.scene.createExplosion(unit.x, unit.y, 50, 0xffaa00);
        
        // 범위 데미지
        this.scene.activeUnits.forEach(target => {
            if (!target.active) return;

            // ★ [추가] 자기 자신은 폭발 데미지 면제 (이게 없으면 무한루프)
            if (target === unit) return; 

            const dist = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
            if (dist <= 50) {
                this.scene.applyDamage({scene: this.scene}, target, 30);
            }
        });
        this.scene.addLog("화약통 폭발!", "log-red");
    }
    fireTurret() {
        const base = this.scene.activeUnits.find(u => u.isBase && u.team === 'ALLY');
        if (!base) return;

        // 가장 가까운 적 찾기
        const target = this.scene.findNearestEnemy(); // BattleScene의 함수 활용
        if (target) {
            // 투사체 발사 (데미지 15)
            const dummyOwner = {
                x: base.x, y: base.y,
                stats: { damage: 15, projectileSpeed: 400, color: 0x00ffff }
            };
            if (typeof Projectile !== 'undefined') {
                const proj = new Projectile(this.scene, dummyOwner, target);
                this.scene.activeProjectiles.push(proj);
            }
        }
    }
    // js/managers/ArtifactManager.js 클래스 내부

    /**
     * 보유하지 않은 유물 중 하나를 무작위로 반환합니다.
     * @param {string|null} targetRarity - 특정 등급만 뽑고 싶을 때 (예: 'LEGENDARY'). 없으면 전체.
     * @returns {string|null} 유물 키(key) 또는 null (뽑을 게 없을 때)
     */
    getNewArtifactKey(targetRarity = null) {
        // 1. 전체 유물 목록
        const allKeys = Object.keys(ARTIFACT_DATA);
        
        // 2. 이미 가진 유물 목록
        // (ArtifactManager의 getter나 GAME_DATA 직접 참조)
        const owned = GAME_DATA.artifacts || [];

        // 3. ★ [핵심] 필터링: (전체 - 보유) = 획득 가능 목록
        let candidates = allKeys.filter(key => !owned.includes(key));

        // 4. 등급 필터링 (필요 시)
        if (targetRarity) {
            candidates = candidates.filter(key => ARTIFACT_DATA[key].rarity === targetRarity);
        }

        // 5. 뽑을 유물이 하나도 없으면 (올클리어) null 반환
        if (candidates.length === 0) return null;

        // 6. 랜덤 선택
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        return pick;
    }
    // ====================================================
    // ★ UI 및 에디터
    // ====================================================

createUI() {
        // HTML에 미리 만들어둔 id="artifact-container"를 찾습니다.
        let artContainer = document.getElementById('artifact-container');
        
        // 만약 HTML에 실수로 안 넣었을 때만 비상용으로 생성 (body에 붙임)
        if (!artContainer) {
            artContainer = document.createElement('div');
            artContainer.id = 'artifact-container';
            artContainer.className = 'artifact-container';
            document.body.appendChild(artContainer);
        }
        
        this.uiDOM = artContainer;
    }

// js/managers/ArtifactManager.js 내부의 updateUI 함수 교체

    updateUI() {
        if (!this.uiDOM) return;
        this.uiDOM.innerHTML = ''; // 초기화

        this.inventory.forEach(key => {
            const data = ARTIFACT_DATA[key];
            const div = document.createElement('div');
            div.className = 'artifact-icon';
            div.style.borderColor = RARITY_COLORS[data.rarity];
            
            // 1. 아이콘 글자 (이미지 없을 때 대비)
            div.innerText = data.name[0]; 
            
            // ★ [수정] 기존 title 속성 제거 (브라우저 기본 툴팁 끄기)
            // div.title = ... (삭제)

            // 2. ★ [추가] 커스텀 툴팁 HTML 생성
            const tooltip = document.createElement('div');
            tooltip.className = 'artifact-tooltip';
            
            // 등급 텍스트 변환 (영어 -> 한글)
            const rarityName = (data.rarity === 'LEGENDARY') ? '전설' : (data.rarity === 'EPIC' ? '에픽' : '희귀');
            const rarityColor = RARITY_COLORS[data.rarity];

            tooltip.innerHTML = `
                <div class="art-tooltip-header" style="color:${rarityColor}">
                    ${data.name} <span style="font-size:11px; color:#aaa;">[${rarityName}]</span>
                </div>
                <div class="art-tooltip-desc">${data.desc.replace(/\n/g, '<br>')}</div>
            `;

            // 3. 아이콘 안에 툴팁 넣기
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