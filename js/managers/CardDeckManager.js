// js/managers/CardDeckManager.js

class CardDeckManager {
    constructor(scene) {
        this.scene = scene;

        // 덱 데이터 (기존 BattleScene의 변수들을 여기로 이동)
        this.deck = [];
        this.hand = [];
        this.discard = [];
        this.sealed = [];
        
        // 선택된 카드 인덱스 (핸드 관리의 일부이므로 여기서 관리)
        this.selectedCardIdx = -1;
    }

    // ============================================================
    // 🎴 덱 초기화 및 관리
    // ============================================================
    initDeck() {
        // 전역 데이터 복사
        this.deck = [...GAME_DATA.deck];
        this.shuffleDeck(this.deck);
        this.hand = [];
        this.discard = [];
        this.selectedCardIdx = -1;
        
        console.log(`🎴 전투 시작! 덱 장수: ${this.deck.length}`);
    }

    shuffleDeck(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    drawCard(count) {
        let actualAdded = 0;
        for(let i=0; i<count; i++) {
            if (this.deck.length === 0) {
                if (this.discard.length === 0) break;
                this.deck = [...this.discard];
                this.discard = [];
                this.shuffleDeck(this.deck);
                this.scene.addLog("덱 리필됨", "log-blue");
            }
            if (this.deck.length > 0) {
                this.hand.push(this.deck.pop());
                actualAdded++;
            }
        }
        this.updateDeckUI();
        this.renderHand(actualAdded); 
    }

    // ============================================================
    // 🎨 UI 렌더링 (DOM 조작)
    // ============================================================
   // js/managers/CardDeckManager.js 내부

    // ============================================================
    // 🎨 UI 렌더링 (핸드)
    // ============================================================
    renderHand(newlyAddedCount = 0) {
        const handArea = document.getElementById('hand-area');
        const deckPile = document.getElementById('deck-pile');
        if (!handArea) return;

        handArea.innerHTML = ''; 
        
        const totalCards = this.hand.length;
        const centerIndex = (totalCards - 1) / 2;
        const newCardStartIndex = totalCards - newlyAddedCount;

        this.hand.forEach((cardStr, index) => {
            // ★ [핵심 수정] 직접 HTML을 만들지 않고 '만능 생성기'를 호출합니다.
            // 이렇게 하면 createCardElement에 추가한 보너스 타임 기능이 여기도 자동 적용됩니다.
            const cardDiv = this.createCardElement(cardStr);
            
            // 핸드 전용 추가 스타일 (뷰어용 스타일 제거 및 핸드용 클래스 확인)
            cardDiv.classList.remove('card-in-viewer');
            cardDiv.classList.add('card'); 

            const [type, name] = cardStr.split('-');
            if (type === 'Unit') cardDiv.classList.add('card-unit');
            else cardDiv.classList.add('card-skill');
            
            // 선택 상태 표시
            const isSelected = (index === this.selectedCardIdx);
            if (isSelected) cardDiv.classList.add('selected');
            
            const isOverweight = this.hand.length > MAX_HAND;
            if (isSelected && isOverweight) cardDiv.classList.add('shake-warning');

            // 툴팁 보이게 설정 (선택 시 강제 표시 등)
            const tooltip = cardDiv.querySelector('.card-tooltip');
            if (tooltip && isSelected) {
                tooltip.style.visibility = 'visible';
                tooltip.style.opacity = '1';
            }

            handArea.appendChild(cardDiv);

            // --------------------------------------------------------
            // 아래는 기존의 애니메이션 및 이벤트 로직 (그대로 유지)
            // --------------------------------------------------------

            // 위치 계산 및 애니메이션 (부채꼴)
            const rotateAngle = (index - centerIndex) * 5;
            const translateY = Math.abs(index - centerIndex) * 5;
            const finalTransform = `rotate(${rotateAngle}deg) translateY(${translateY}px)`;

            // 드로우 애니메이션
            if (deckPile && index >= newCardStartIndex) {
                cardDiv.classList.add('no-transition');
                const deckRect = deckPile.getBoundingClientRect(); 
                const cardRect = cardDiv.getBoundingClientRect();
                // 덱이 없을 경우(초기화 등) 대비
                if (deckRect.width > 0 && cardRect.width > 0) {
                    const deltaX = (deckRect.left + deckRect.width / 2) - (cardRect.left + cardRect.width / 2);
                    const deltaY = (deckRect.top + deckRect.height / 2) - (cardRect.top + cardRect.height / 2);
                    cardDiv.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2) rotate(-180deg)`;
                }
                cardDiv.style.opacity = '0';
                void cardDiv.offsetWidth; 

                setTimeout(() => {
                    cardDiv.classList.remove('no-transition');
                    cardDiv.style.transform = isSelected ? '' : finalTransform;
                    cardDiv.style.opacity = '1';
                }, 50 + (index - newCardStartIndex) * 150);
            } else {
                if (!isSelected) cardDiv.style.transform = finalTransform;
            }

            // 이벤트 리스너 재정의
            cardDiv.onmouseenter = () => { cardDiv.style.transform = ''; cardDiv.style.zIndex = '100'; };
            cardDiv.onmouseleave = () => { 
                cardDiv.style.zIndex = '';
                if (index !== this.selectedCardIdx) cardDiv.style.transform = finalTransform; 
            };

            cardDiv.onclick = (e) => { 
                e.stopPropagation();
                if (this.selectedCardIdx === index) {
                    this.selectedCardIdx = -1;
                    if (this.scene.drawDeploymentZones) this.scene.drawDeploymentZones(false); 
                } else {
                    this.selectedCardIdx = index; 
                    if (this.scene.drawDeploymentZones) this.scene.drawDeploymentZones(true); 
                }
                this.renderHand(); 
            };
            
            cardDiv.oncontextmenu = (e) => {
                e.preventDefault();
                this.scene.showPopup("카드 버리기", `[${name}] 카드를\n버리시겠습니까?`, () => this.discardCardFromHand(index), true);
            };
        });
    }

    updateDeckUI() {
        const deckCount = document.getElementById('deck-count');
        const discardCount = document.getElementById('discard-count');
        const sealCount = document.getElementById('seal-count');

        if (deckCount) deckCount.innerText = this.deck.length;
        if (discardCount) discardCount.innerText = this.discard.length;
        if (sealCount) sealCount.innerText = this.sealed.length;
    }

    // [보상용] 랜덤 카드 3장 생성 (중복 방지, 등급 확률 적용)
    generateRewards() {
        const rewards = [];
        const maxRewards = 3;
        
        // 등장 가능한 모든 카드 리스트 (기지, 적군 제외)
        const allUnits = Object.keys(UNIT_STATS).filter(k => k !== '기지' && k !== '적군');
        const allSkills = Object.keys(SKILL_STATS);
        
        // 통합 리스트 (타입 정보 포함)
        let pool = [
            ...allUnits.map(name => ({ type: 'Unit', name, rarity: UNIT_STATS[name].rarity })),
            ...allSkills.map(name => ({ type: 'Skill', name, rarity: SKILL_STATS[name].rarity }))
        ];

        // ★ 등급별 확률 가중치 (백분율)
        // 일반: 60%, 희귀: 30%, 전설: 10%
        const weights = {
            'COMMON': 60,
            'RARE': 30,
            'LEGENDARY': 10
        };

        while(rewards.length < maxRewards) {
            // 1. 이번에 뽑을 등급 결정
            const rand = Math.random() * 100;
            let targetRarity = 'COMMON';
            
            if (rand > 90) targetRarity = 'LEGENDARY'; // 상위 10%
            else if (rand > 60) targetRarity = 'RARE'; // 상위 40% (60~90)
            
            // 2. 해당 등급의 카드만 필터링
            const candidates = pool.filter(c => c.rarity === targetRarity);
            
            // (만약 해당 등급 카드가 하나도 없으면 일반 등급에서 뽑음 - 안전장치)
            const finalPool = (candidates.length > 0) ? candidates : pool.filter(c => c.rarity === 'COMMON');

            // 3. 무작위 1장 선택
            const pick = finalPool[Math.floor(Math.random() * finalPool.length)];
            
            // 4. 중복 체크 (이미 뽑은 보상에 없으면 추가)
            // (이미 덱에 있는 카드는 또 나와도 됨 - 강화 재료나 복사 느낌)
            const exists = rewards.some(r => r.name === pick.name && r.type === pick.type);
            if (!exists) {
                rewards.push(`${pick.type}-${pick.name}`);
            }
        }
        
        return rewards;
    }

    // ============================================================
    // ✨ 카드 효과 및 액션
    // ============================================================
    discardCardFromHand(index, isUsed = false) {
        const handArea = document.getElementById('hand-area');
        if (!handArea || !handArea.children[index]) return;

        const originalCard = handArea.children[index];
        const rect = originalCard.getBoundingClientRect(); // 화면상 절대 위치
        
        // clone 생성 로직...
        const clone = originalCard.cloneNode(true);
        document.body.appendChild(clone);
        
        // 원본의 transform 유지 (중요)
        const computedStyle = window.getComputedStyle(originalCard);
        clone.style.transform = computedStyle.transform; 
        
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`; 
        clone.style.height = `${rect.height}px`;
        clone.style.margin = '0';
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.transition = 'none'; 
        
        originalCard.style.opacity = '0';
        void clone.offsetWidth;

        if (isUsed) {
            // 사용 시 연출
            clone.style.transition = 'all 0.5s ease-out';
            clone.style.transform = `${clone.style.transform} translateY(-150px) scale(1.05)`;
            clone.style.opacity = '0';
        } else {
            // 버리기 시 연출
            clone.style.transition = 'all 0.5s cubic-bezier(0.55, 0.055, 0.675, 0.19)';
            const discardPile = document.getElementById('discard-pile');
            if (discardPile) {
                const destRect = discardPile.getBoundingClientRect();
                const destX = destRect.left + (destRect.width / 2) - 70;
                const destY = destRect.top + (destRect.height / 2) - 100;
                clone.style.left = `${destX}px`;
                clone.style.top = `${destY}px`;
                clone.style.transform = 'scale(0.1) rotate(720deg)'; 
                clone.style.opacity = '0.5';
            } else {
                clone.style.opacity = '0';
            }
        }

        setTimeout(() => {
            if (clone && clone.parentNode) clone.parentNode.removeChild(clone);

            if (index >= this.hand.length) return;

            const card = this.hand.splice(index, 1)[0];
            this.discard.push(card);

            if (this.selectedCardIdx === index) {
                this.selectedCardIdx = -1;
                if (this.scene.drawDeploymentZones) this.scene.drawDeploymentZones(false);
            } else if (this.selectedCardIdx > index) {
                this.selectedCardIdx--;
            }

            this.renderHand();
            this.updateDeckUI();
        }, 500);
    }

    animateCardUse(index) {
        this.discardCardFromHand(index, true); // 내부 로직이 거의 같으므로 재활용
    }

    sealCard(index) {
        // ... (봉인 로직, 코드가 길어서 핵심만 유지) ...
        const handArea = document.getElementById('hand-area');
        if (!handArea || !handArea.children[index]) return;

        const originalCard = handArea.children[index];
        const rect = originalCard.getBoundingClientRect();

        const clone = originalCard.cloneNode(true);
        document.body.appendChild(clone);
        // ... 스타일 설정 ...
        clone.style.position = 'fixed';
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.zIndex = '9999';
        clone.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
        
        originalCard.style.opacity = '0';

        const sealPile = document.getElementById('seal-pile');
        if (sealPile) {
            const destRect = sealPile.getBoundingClientRect();
            clone.style.left = `${destRect.left}px`;
            clone.style.top = `${destRect.top}px`;
            clone.style.transform = 'scale(0) rotate(-180deg) skew(30deg)';
            clone.style.opacity = '0';
            clone.style.filter = 'brightness(0.5) sepia(1) hue-rotate(-50deg) saturate(10) blur(5px)';
        }

        setTimeout(() => {
            if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
            if (index >= this.hand.length) return;
            const card = this.hand.splice(index, 1)[0];
            this.sealed.push(card);
            this.scene.addLog("카드 봉인됨!", "log-purple");

            if (this.selectedCardIdx === index) this.selectedCardIdx = -1;
            else if (this.selectedCardIdx > index) this.selectedCardIdx--;

            this.renderHand();
            this.updateDeckUI();
        }, 800);
    }

    // ============================================================
    // 👁️ 카드 뷰어
    // ============================================================
    openCardViewer(title, cardList) {
        const modal = document.getElementById('card-viewer-modal');
        const titleEl = document.getElementById('viewer-title');
        const contentEl = document.getElementById('viewer-content');
        const closeBtn = document.getElementById('btn-viewer-close');
        
        if (!modal) return;

        titleEl.innerText = title;
        contentEl.innerHTML = ''; 

        if (!cardList || cardList.length === 0) {
            contentEl.innerHTML = '<div style="color:#888; margin-top:50px; font-size:18px;">비어있습니다.</div>';
        } else {
            cardList.forEach(cardStr => {
                const cardNode = this.createCardElement(cardStr); 
                contentEl.appendChild(cardNode);
            });
        }

        const closeViewer = () => {
            modal.style.display = 'none';
            window.removeEventListener('keydown', keyHandler);
            modal.onclick = null;
        };

        const keyHandler = (e) => {
            if (modal.style.display === 'none') return;
            if (e.code === 'Escape' || e.code === 'Space') {
                e.preventDefault(); 
                closeViewer();
            }
        };

        window.addEventListener('keydown', keyHandler);
        modal.onclick = (e) => { if (e.target === modal) closeViewer(); };
        if (closeBtn) closeBtn.onclick = () => closeViewer();
        modal.style.display = 'flex';
    }
// js/managers/CardDeckManager.js 내부
// ★ [수정] 카드 생성 함수 (보너스 타임 표시 기능 추가됨)
 // [최종 수정] DOM 요소 생성 및 데이터 바인딩 함수 (기존 기능 100% 유지 + dataset 추가)
    createCardElement(cardStr) {
        const [type, name] = cardStr.split('-');
        
        // [1] 스탯 가져오기 (안전장치 포함)
        let finalStat;
        if (this.scene && typeof this.scene.getAdjustedStats === 'function') {
            finalStat = this.scene.getAdjustedStats(type, name);
        } else {
            const base = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
            finalStat = base ? JSON.parse(JSON.stringify(base)) : { cost: 0, image: '', rarity: 'COMMON' };
        }
        
        // [2] 파일명 및 경로 자동 매칭
// ★ [수정] 하드코딩(fileMapper) 삭제 및 데이터 기반 자동 매칭
        let fileName = 'noimg'; // 기본값 (이미지 없을 때)

        if (finalStat.image) {
            // 예: 'img_swordman' -> 'swordman'
            // 예: 'img_fireball' -> 'fireball'
            fileName = finalStat.image.replace('img_', '');
        } else {
            // 데이터에 image 필드가 없는 경우, 영어 이름 변환 로직이 필요하거나
            // 임시로 이름을 그대로 파일명으로 쓸 수도 있습니다.
            // 하지만 가장 좋은 건 data.js의 UNIT_STATS에 'image' 속성을 빠짐없이 넣는 것입니다.
            console.warn(`[CardDeckManager] ${name}의 이미지 정보가 없습니다.`);
        }
        
        const imgPath = `assets/chars/${fileName}.png`; 
        const frameClass = (type === 'Unit') ? 'frame-unit' : 'frame-skill';
        const rarity = finalStat.rarity || 'COMMON';

        // --------------------------------------------------------
        // [3] 툴팁 내용 생성 (기존 로직 유지)
        // --------------------------------------------------------
        const statLabels = {
            cost: '비용', damage: '공격력', hp: '체력',
            range: '사거리', duration: '지속', value: '수치'
        };

        let tooltipRows = '';
        Object.keys(statLabels).forEach(key => {
            if (finalStat[key] !== undefined) {
                tooltipRows += `
                    <div class="tooltip-row">
                        <span>${statLabels[key]}</span> 
                        <span class="tooltip-val">${finalStat[key]}</span>
                    </div>`;
            }
        });

        if (finalStat.desc) {
            tooltipRows += `<div class="tooltip-desc">${finalStat.desc}</div>`;
        }
        
        // 보너스 효과 텍스트 생성 (getBonusText 메서드가 있다고 가정)
        const bonusText = (this.getBonusText && finalStat.bonusEffect) ? this.getBonusText(finalStat.bonusEffect) : '';

        // --------------------------------------------------------
        // [4] 배지 및 태그 생성
        // --------------------------------------------------------
        let statsHtml = '';
        if (type === 'Unit') {
            statsHtml = `<div class="stat-badge stat-atk">${finalStat.damage}</div>
                         <div class="stat-badge stat-hp">${finalStat.hp}</div>`;
        }
        
        let traitsHtml = '';
        if (finalStat.race) traitsHtml += `<span class="trait-tag tag-race">${finalStat.race}</span>`;
        if (finalStat.traits) finalStat.traits.forEach(t => traitsHtml += `<span class="trait-tag tag-trait">${t}</span>`);

        // 보너스 타임 표시 배지
        let timeBonusHtml = '';
        if (finalStat.bonusTime) {
            const [start, end] = finalStat.bonusTime;
            timeBonusHtml = `
                <div class="time-bonus-badge" style="
                    position: absolute; top: -8px; right: -8px;
                    background: #111; border: 1px solid #00ffcc; color: #00ffcc;
                    border-radius: 8px; padding: 2px 5px; font-size: 10px; font-weight: bold;
                    z-index: 20; box-shadow: 0 0 5px #00ffcc; letter-spacing: -0.5px;
                ">
                    ⏱${start}~${end}s
                </div>
            `;
        }

        // --------------------------------------------------------
        // [5] DOM 요소 생성 및 조립
        // --------------------------------------------------------
        const div = document.createElement('div');
        div.className = 'card card-in-viewer'; 

        // ★ [필수 수정] 이것이 없어서 에러가 났었습니다!
        div.dataset.unitName = name; 
        div.dataset.cardType = type;

        div.innerHTML = `
            ${timeBonusHtml} 
            <img src="${imgPath}" class="card-bg-img" onerror="this.src='assets/noimg.png';">
            <div class="card-frame ${frameClass}"></div>
            <div class="card-cost">${finalStat.cost}</div>
            <div class="card-name">${name}</div>
            <div class="card-traits">${traitsHtml}</div>
            <div class="card-type">${type}</div>
            ${statsHtml}
            
            <div class="card-tooltip">
                <div class="tooltip-header">${name} <span style="font-size:10px; color:#aaa;">(${rarity})</span></div>
                ${tooltipRows}
                ${bonusText ? `
                    <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #444;">
                        <span style="color:#00ffcc; font-weight:bold;">✨ 타이밍 보너스 (${finalStat.bonusTime[0]}~${finalStat.bonusTime[1]}s)</span><br>
                        <span style="color:#ddd; font-size: 11px;">👉 ${bonusText}</span>
                    </div>` 
                : ''}
            </div>
        `;
        
        return div;
    }

// js/managers/CardDeckManager.js 내부

    // ★ [추가] 데이터를 읽어 텍스트로 변환하는 번역기
    getBonusText(effect) {
        if (!effect) return "";

        // 1. 스탯 이름 한글화 매핑
        const statNames = {
            cost: "비용",
            damage: "공격력",
            hp: "체력",
            range: "사거리",
            value: "수치",
            duration: "지속시간",
            stun: "기절"
        };

        const name = statNames[effect.stat] || effect.stat;
        const unit = effect.unit || "";
        const val = effect.val;
        
        // 2. 부호 처리 (+, -)
        const sign = val > 0 ? "+" : ""; // 음수는 자동으로 -가 붙음

        // 3. 특수 케이스 (힐러 등)
        if (effect.stat === 'damage' && val < 0 && !unit) {
             return `치유량 +${Math.abs(val)}`;
        }

        return `${name} ${sign}${val}${unit}`;
    }
 // [수정 완료] 유닛/스킬 구분하여 코스트 업데이트 (에러 방지)
    updateHandCosts() {
        const handArea = document.getElementById('hand-area');
        if (!handArea) return;

        // DOM 요소 자식들을 순회
        Array.from(handArea.children).forEach(cardDiv => {
            const unitName = cardDiv.dataset.unitName; 
            const cardType = cardDiv.dataset.cardType; // ★ 카드 타입(Unit/Skill) 확인
            
            if (!unitName || !cardType) return;

            // 1. 기본 코스트 가져오기 (타입에 따라 다르게 조회)
            let baseCost = 0;
            if (cardType === 'Unit') {
                // 유닛이면 UNIT_STATS 확인
                if (UNIT_STATS[unitName]) baseCost = UNIT_STATS[unitName].cost;
            } else {
                // 스킬이면 SKILL_STATS 확인
                if (SKILL_STATS && SKILL_STATS[unitName]) baseCost = SKILL_STATS[unitName].cost;
            }

            // 2. 실시간 코스트 계산
            let currentCost = baseCost;
            
            // ★ 유닛일 경우에만 시간 할인 계산 (스킬은 보통 고정 비용)
            if (cardType === 'Unit' && this.scene && typeof this.scene.getRealTimeCost === 'function') {
                const realTimeCost = this.scene.getRealTimeCost(unitName);
                // getRealTimeCost가 0을 반환하면(데이터 없음 등) 덮어쓰지 않음
                if (realTimeCost !== undefined) currentCost = realTimeCost;
            }

            // 3. UI 업데이트
            const costEl = cardDiv.querySelector('.card-cost');
            if (costEl) {
                costEl.innerText = currentCost;

                // 색상 변경 로직
                if (currentCost < baseCost) {
                    costEl.style.color = '#00ff00'; // 할인: 초록색
                    costEl.style.transform = 'scale(1.2)';
                    costEl.style.fontWeight = 'bold';
                } else if (currentCost > baseCost) {
                    costEl.style.color = '#ff0000'; // 비쌈: 빨간색
                } else {
                    costEl.style.color = ''; // 기본: 원래대로
                    costEl.style.transform = '';
                    costEl.style.fontWeight = '';
                }
            }
        });
    }
}