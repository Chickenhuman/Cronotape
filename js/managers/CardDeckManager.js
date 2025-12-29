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
    renderHand(newlyAddedCount = 0) {
        const handArea = document.getElementById('hand-area');
        const deckPile = document.getElementById('deck-pile');
        if (!handArea) return;

        handArea.innerHTML = ''; 
        
        const fileMapper = {
            '검사': 'swordman', '궁수': 'archer', '힐러': 'healer',
            '방벽': 'wall', '암살자': 'assassin', '적군': 'enemy',
            '화염구': 'fireball', '돌멩이': 'stone', '방어막': 'shield', '얼음': 'ice'
        };

        const totalCards = this.hand.length;
        const centerIndex = (totalCards - 1) / 2;
        const newCardStartIndex = totalCards - newlyAddedCount;

        this.hand.forEach((cardStr, index) => {
            const [type, name] = cardStr.split('-');
            const baseStat = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
            
            // ★ BattleScene의 메서드 사용
            const finalStat = this.scene.getAdjustedStats(type, name);
            
            const fileName = fileMapper[name] || name; 
            const imgPath = `assets/chars/${fileName}.png`; 
            const imgTag = `<img src="${imgPath}" class="card-bg-img" onerror="this.src='assets/noimg.png';">`;
            const frameClass = (type === 'Unit') ? 'frame-unit' : 'frame-skill';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';
            if (type === 'Unit') cardDiv.classList.add('card-unit');
            else cardDiv.classList.add('card-skill');
            
            const isSelected = (index === this.selectedCardIdx);
            if (isSelected) cardDiv.classList.add('selected');
            const isOverweight = this.hand.length > MAX_HAND;
            if (isSelected && isOverweight) {
                cardDiv.classList.add('shake-warning');
            }

            // 색상 함수
            const getColorStyle = (current, base, isCost = false) => {
                if (current === base) return ''; 
                const isGood = isCost ? (current < base) : (current > base);
                return isGood ? 'color:#00ff00;' : 'color:#ff5555;';
            };

            let statsHtml = '';
            if (type === 'Unit') {
                const dmgStyle = getColorStyle(finalStat.damage, baseStat.damage);
                const hpStyle = getColorStyle(finalStat.hp, baseStat.hp);
                statsHtml = `<div class="stat-badge stat-atk" style="${dmgStyle}">${Math.abs(finalStat.damage)}</div>
                             <div class="stat-badge stat-hp" style="${hpStyle}">${finalStat.hp}</div>`;
            }
            let countHtml = (type === 'Unit' && finalStat.count && finalStat.count > 1) 
                ? `<div class="card-count">x${finalStat.count}</div>` : '';
            
            let traitsHtml = '';
            if (type === 'Unit' && finalStat.race) traitsHtml += `<span class="trait-tag tag-race">${finalStat.race}</span>`;
            if (finalStat.traits) finalStat.traits.forEach(t => traitsHtml += `<span class="trait-tag tag-trait">${t}</span>`);

            const costStyle = getColorStyle(finalStat.cost, baseStat.cost, true);
            
            let tooltipContent = '';
            const toolCostStyle = costStyle ? `style="${costStyle}"` : '';
            if (type === 'Unit') {
                tooltipContent = `
                    <div class="tooltip-row"><span>코스트</span> <span class="tooltip-val" ${toolCostStyle}>${finalStat.cost}</span></div>
                    <div class="tooltip-row"><span>공격력</span> <span class="tooltip-val">${finalStat.damage}</span></div>
                    <div class="tooltip-row"><span>체력</span> <span class="tooltip-val">${finalStat.hp}</span></div>
                `;
            } else {
                tooltipContent = `<div class="tooltip-row"><span>코스트</span> <span class="tooltip-val" ${toolCostStyle}>${finalStat.cost}</span></div>`;
            }
            
            const tooltipStyle = isSelected ? 'visibility:visible; opacity:1;' : '';

            cardDiv.innerHTML = `
                ${imgTag}
                <div class="card-frame ${frameClass}"></div>
                <div class="card-cost" style="${costStyle}">${finalStat.cost}</div>
                ${countHtml}
                <div class="card-name">${name}</div>
                <div class="card-traits">${traitsHtml}</div>
                <div class="card-type">${type}</div>
                ${statsHtml}
                <div class="card-tooltip" style="${tooltipStyle}">
                    <div class="tooltip-header">${name} <span style="font-size:10px; color:#aaa;">(${type})</span></div>
                    ${tooltipContent}
                </div>
            `;

            handArea.appendChild(cardDiv);

            // 위치 계산 및 애니메이션
            const rotateAngle = (index - centerIndex) * 5;
            const translateY = Math.abs(index - centerIndex) * 5;
            const finalTransform = `rotate(${rotateAngle}deg) translateY(${translateY}px)`;

            if (deckPile && index >= newCardStartIndex) {
                cardDiv.classList.add('no-transition');
                const deckRect = deckPile.getBoundingClientRect(); 
                const cardRect = cardDiv.getBoundingClientRect();
                const deltaX = (deckRect.left + deckRect.width / 2) - (cardRect.left + cardRect.width / 2);
                const deltaY = (deckRect.top + deckRect.height / 2) - (cardRect.top + cardRect.height / 2);

                cardDiv.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2) rotate(-180deg)`;
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

            // 이벤트 리스너
            cardDiv.onmouseenter = () => { cardDiv.style.transform = ''; cardDiv.style.zIndex = '100'; };
            cardDiv.onmouseleave = () => { 
                cardDiv.style.zIndex = '';
                if (index !== this.selectedCardIdx) cardDiv.style.transform = finalTransform; 
            };

            cardDiv.onclick = (e) => { 
                e.stopPropagation();
                
                const isOverweight = this.hand.length > MAX_HAND;

                if (this.selectedCardIdx === index) {
                    this.selectedCardIdx = -1;
                    // ★ BattleScene의 시각화 함수 호출
                    if (this.scene.drawDeploymentZones) this.scene.drawDeploymentZones(false); 
                } else {
                    this.selectedCardIdx = index; 
                    if (this.scene.drawDeploymentZones) this.scene.drawDeploymentZones(true); 
                }
                
                if (isOverweight) cardDiv.classList.add('shake-warning');
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

    createCardElement(cardStr) {
        // (뷰어용 카드 생성 로직 - BattleScene에서 복사해옴)
        const [type, name] = cardStr.split('-');
        const finalStat = this.scene.getAdjustedStats(type, name);
        
        const fileMapper = {
            '검사': 'swordman', '궁수': 'archer', '힐러': 'healer',
            '방벽': 'wall', '암살자': 'assassin', '적군': 'enemy',
            '화염구': 'fireball', '돌멩이': 'stone', '방어막': 'shield', '얼음': 'ice'
        };
        const fileName = fileMapper[name] || name; 
        const imgPath = `assets/chars/${fileName}.png`; 
        
        const div = document.createElement('div');
        div.className = 'card card-in-viewer'; 
        const frameClass = (type === 'Unit') ? 'frame-unit' : 'frame-skill';

        let statsHtml = '';
        if (type === 'Unit') {
            statsHtml = `<div class="stat-badge stat-atk">${finalStat.damage}</div>
                         <div class="stat-badge stat-hp">${finalStat.hp}</div>`;
        }
        let traitsHtml = '';
        if (type === 'Unit' && finalStat.race) traitsHtml += `<span class="trait-tag tag-race">${finalStat.race}</span>`;
        if (finalStat.traits) finalStat.traits.forEach(t => traitsHtml += `<span class="trait-tag tag-trait">${t}</span>`);

        div.innerHTML = `
            <img src="${imgPath}" class="card-bg-img" onerror="this.src='assets/noimg.png';">
            <div class="card-frame ${frameClass}"></div>
            <div class="card-cost">${finalStat.cost}</div>
            <div class="card-name">${name}</div>
            <div class="card-traits">${traitsHtml}</div>
            <div class="card-type">${type}</div>
            ${statsHtml}
        `;
        return div;
    }
}