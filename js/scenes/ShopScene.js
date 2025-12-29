// js/scenes/ShopScene.js

class ShopScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ShopScene' });
        this.popupKeyListener = null; // 팝업용 키 리스너 변수
    }

    create() {
        this.stock = this.generateStock();
        this.renderShopUI();
    }

    generateStock() {
        const stock = [];

        // 1. 랜덤 카드 3장
        const allKeys = Object.keys(UNIT_STATS).filter(k => k !== '기지' && k !== '적군');
        for(let i=0; i<3; i++) {
            const pick = allKeys[Math.floor(Math.random() * allKeys.length)];
            const price = (UNIT_STATS[pick].cost * 15) + Math.floor(Math.random() * 20);
            stock.push({ type: 'card', name: pick, cost: price, sold: false });
        }

        // 2. 랜덤 유물 1개
        const artiKeys = Object.keys(ARTIFACT_DATA).filter(k => !GAME_DATA.artifacts.includes(k));
        if (artiKeys.length > 0) {
            const pick = artiKeys[Math.floor(Math.random() * artiKeys.length)];
            const rarity = ARTIFACT_DATA[pick].rarity;
            const price = (rarity === 'LEGENDARY') ? 150 : (rarity === 'EPIC' ? 100 : 60);
            stock.push({ type: 'artifact', key: pick, cost: price, sold: false });
        }

        // 3. 서비스 (카드 제거)
        stock.push({ 
            type: 'service_remove', name: "카드 제거", 
            cost: 75, desc: "덱에서 불필요한 카드 1장을 제거합니다.", sold: false 
        });

        return stock;
    }

    // ShopScene.js 의 renderShopUI 메서드 전체 수정

renderShopUI() {
        let container = document.getElementById('shop-ui');
        if (!container) {
            container = document.createElement('div');
            container.id = 'shop-ui';
            document.body.appendChild(container);
        }
        
        container.style.display = 'flex';
        container.innerHTML = ''; 

        // [좌측 패널]
        const leftPanel = document.createElement('div');
        leftPanel.className = 'shop-panel-left';
        
        leftPanel.innerHTML = `
            <div class="shop-title">MERCENARY ARCHIVE</div>
            <div class="shop-gold-display">
                보유 골드: <span class="gold-val">${GAME_DATA.gold} G</span>
            </div>
            <div id="shop-item-list"></div>
        `;
        container.appendChild(leftPanel);

        const itemListContainer = leftPanel.querySelector('#shop-item-list');
        this.stock.forEach(item => {
            const itemEl = this.createItemElement(item);
            itemListContainer.appendChild(itemEl);
        });

        // [우측 패널] - 나가기 버튼
        const rightPanel = document.createElement('div');
        rightPanel.innerHTML = `<div class="btn-leave-shop" id="btn-leave">나가기 ></div>`;
        container.appendChild(rightPanel);

        // ★ [수정] 올바른 메서드(this.confirmLeaveShop) 호출로 변경
        document.getElementById('btn-leave').onclick = () => this.confirmLeaveShop(container);
    }

    // ★ [신규] 클래스 메서드로 분리하여 정의 (기존 window.leaveShopConfirm 대체)
    confirmLeaveShop(container) {
        this.showCustomPopup(
            "상점 떠나기", 
            "정말로 상점을 떠나시겠습니까?\n지금 나가면 다시 입장할 수 없습니다.",
            () => {
                // [확인] 버튼 클릭 시 동작
                container.style.display = 'none'; 
                
                // 맵 씬에게 "방문 완료" 알림
                if (typeof GAME_DATA !== 'undefined') {
                    GAME_DATA.isShopVisited = true;
                }
                
                this.scene.start('MapScene'); 
            },
            true // 취소 버튼 활성화
        );
    }
    createItemElement(item) {
        const div = document.createElement('div');
        div.className = `shop-item ${item.sold ? 'sold-out' : ''}`;

        let imgContent = '?';
        let nameText = item.name;
        let descText = '';

        if (item.type === 'card') {
            imgContent = '🎴';
            const stats = UNIT_STATS[item.name];
            descText = `Cost: ${stats.cost} | ATK: ${stats.damage}`;
        } else if (item.type === 'artifact') {
            imgContent = '🏆';
            nameText = ARTIFACT_DATA[item.key].name;
            descText = "유물";
        } else if (item.type === 'service_remove') {
            imgContent = '🔥';
            descText = item.desc;
            div.style.borderColor = '#ff5555';
        }

        div.innerHTML = `
            <div class="shop-item-img">${imgContent}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${nameText}</div>
                <div class="shop-item-desc">${descText}</div>
            </div>
            <div class="shop-item-price-box">
                ${item.sold ? '<span class="sold-text">품절</span>' : `<span class="shop-item-price">${item.cost} G</span>`}
            </div>
        `;

        if (!item.sold) {
            div.onclick = () => this.handlePurchase(item);
        }
        return div;
    }

    handlePurchase(item) {
        if (GAME_DATA.gold < item.cost) {
            this.showCustomPopup("알림", "골드가 부족합니다.");
            return;
        }

        if (item.type === 'card') {
            GAME_DATA.addGold(-item.cost);
            GAME_DATA.addCard(`Unit-${item.name}`);
            item.sold = true;
            this.showCustomPopup("구매 완료", `[${item.name}] 카드가 덱에 추가되었습니다.`);
            this.renderShopUI();
            
        } else if (item.type === 'artifact') {
            GAME_DATA.addGold(-item.cost);
            GAME_DATA.addArtifact(item.key);
            item.sold = true;
            this.showCustomPopup("구매 완료", `[${ARTIFACT_DATA[item.key].name}] 유물을 획득했습니다.`);
            this.renderShopUI();

        } else if (item.type === 'service_remove') {
            if (GAME_DATA.deck.length <= 5) {
                this.showCustomPopup("알림", "최소 5장의 카드는 보유해야 합니다.");
                return;
            }
            this.openDeckForRemoval(item);
        }
    }

    // ============================================================
    // ★ [수정] 카드 제거 뷰어 (클릭 문제 해결)
    // ============================================================

    openDeckForRemoval(serviceItem) {
        const modal = document.getElementById('card-viewer-modal');
        const titleEl = document.getElementById('viewer-title');
        const contentEl = document.getElementById('viewer-content');
        const closeBtn = document.getElementById('btn-viewer-close');
        
        if (!modal) return;

        // ★ [핵심] 모달 전체에 클릭 이벤트가 먹히도록 강제 설정
        modal.style.pointerEvents = "auto"; 

        titleEl.innerText = "제거할 카드를 선택하세요";
        titleEl.style.color = "#ff5555"; 
        contentEl.innerHTML = ''; 

        // --- 뷰어 닫기 및 ESC 로직 ---
        const closeModal = () => {
            modal.style.display = 'none';
            window.removeEventListener('keydown', viewerEscHandler);
        };

        const viewerEscHandler = (e) => {
            // 팝업이 떠있지 않을 때만 뷰어를 닫음 (팝업 닫기가 우선)
            if (e.key === 'Escape' && document.getElementById('game-popup').style.display === 'none') {
                closeModal();
            }
        };
        window.addEventListener('keydown', viewerEscHandler);
        closeBtn.onclick = closeModal;

        // --- 카드 생성 ---
        GAME_DATA.deck.forEach((cardStr, index) => {
            const cardNode = this.createCardDOM(cardStr);
            
            // 스타일 강제 적용
            cardNode.style.pointerEvents = "auto"; // 카드 클릭 확실하게
            cardNode.style.cursor = "pointer";

            // 마우스 오버 효과
            cardNode.onmouseenter = () => {
                cardNode.style.border = "3px solid #ff5555";
                cardNode.style.transform = "scale(1.05)";
                cardNode.style.zIndex = "100";
            };
            cardNode.onmouseleave = () => {
                cardNode.style.border = "none";
                cardNode.style.transform = "scale(0.85)"; // 뷰어 내 기본 크기
                cardNode.style.zIndex = "";
            };

            // ★ 클릭 이벤트 (제거 팝업 호출)
            cardNode.onclick = (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                const cardName = cardStr.split('-')[1];
                
                this.showCustomPopup(
                    "카드 제거 확인",
                    `[${cardName}] 카드를 제거하시겠습니까?\n(비용: ${serviceItem.cost} G)`,
                    () => {
                        this.executeRemoval(index, serviceItem);
                        closeModal(); 
                    },
                    true // 취소 버튼 활성화
                );
            };

            contentEl.appendChild(cardNode);
        });

        modal.style.display = 'flex';
    }

    executeRemoval(index, serviceItem) {
        if (GAME_DATA.gold < serviceItem.cost) {
            this.showCustomPopup("오류", "골드가 부족해졌습니다.");
            return;
        }

        const removedCard = GAME_DATA.deck[index];
        const cardName = removedCard.split('-')[1];

        GAME_DATA.addGold(-serviceItem.cost);
        GAME_DATA.removeCard(index);

        serviceItem.sold = true; 
        
        this.renderShopUI(); 
        this.showCustomPopup("제거 완료", `[${cardName}] 카드를 불태웠습니다!`);
    }

    // HTML 카드 요소 생성
    createCardDOM(cardStr) {
        const [type, name] = cardStr.split('-');
        const stats = (type === 'Unit') ? UNIT_STATS[name] : SKILL_STATS[name];
        
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
            statsHtml = `
                <div class="stat-badge stat-atk" style="font-size:14px">${stats.damage}</div>
                <div class="stat-badge stat-hp" style="font-size:14px">${stats.hp}</div>
            `;
        }
        
        let traitsHtml = '';
        if (stats.race) traitsHtml += `<span class="trait-tag tag-race">${stats.race}</span>`;
        if (stats.traits) stats.traits.forEach(t => traitsHtml += `<span class="trait-tag tag-trait">${t}</span>`);

        div.innerHTML = `
            <img src="${imgPath}" class="card-bg-img" onerror="this.src='assets/noimg.png';">
            <div class="card-frame ${frameClass}"></div>
            <div class="card-cost">${stats.cost}</div>
            <div class="card-name">${name}</div>
            <div class="card-traits">${traitsHtml}</div>
            <div class="card-type">${type}</div>
            ${statsHtml}
        `;

        return div;
    }

    // ============================================================
    // ★ [수정] 팝업 키보드 지원 (스페이스바/엔터/ESC)
    // ============================================================
    showCustomPopup(title, msg, onConfirm, isConfirm = false) {
        const popup = document.getElementById('game-popup');
        const titleEl = document.getElementById('popup-title');
        const msgEl = document.getElementById('popup-message');
        const btnConfirm = document.getElementById('btn-popup-confirm');
        const btnCancel = document.getElementById('btn-popup-cancel');

        if (!popup) return;

        titleEl.innerText = title;
        msgEl.innerText = msg;
        
        btnCancel.style.display = isConfirm ? 'inline-block' : 'none';

        // 팝업 닫기 및 리스너 제거 함수
        const closePopup = () => {
            popup.style.display = 'none';
            if (this.popupKeyListener) {
                window.removeEventListener('keydown', this.popupKeyListener);
                this.popupKeyListener = null;
            }
        };

        // 버튼 클릭 이벤트 재설정
        const newBtnConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
        
        const newBtnCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnConfirm.onclick = () => {
            closePopup();
            if (onConfirm) onConfirm();
        };

        newBtnCancel.onclick = () => {
            closePopup();
        };

        // ★ [핵심] 키보드 이벤트 리스너 추가
        // 기존 리스너가 있다면 제거
        if (this.popupKeyListener) window.removeEventListener('keydown', this.popupKeyListener);

        this.popupKeyListener = (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault(); // 스크롤 등 기본 동작 방지
                closePopup();
                if (onConfirm) onConfirm();
            } else if (e.code === 'Escape') {
                if (isConfirm) {
                    // 취소 가능한 팝업이면 닫기만 함
                    e.preventDefault();
                    closePopup();
                } else {
                    // 확인만 있는 팝업이면 확인 처리 (ESC로도 닫기 편하게)
                    e.preventDefault();
                    closePopup();
                    if (onConfirm) onConfirm();
                }
            }
        };
        window.addEventListener('keydown', this.popupKeyListener);

        popup.style.display = 'flex';
    }
}