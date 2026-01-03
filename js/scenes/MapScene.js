// js/scenes/MapScene.js

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    create() {
        // 초기화
        this.selectedNode = null; // ★ 현재 선택한 목적지 (이동 전)

        // 배경 설정
        const mapW = GAME_DATA.campaign.mapWidth;
        const mapH = GAME_DATA.campaign.mapHeight;
        
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.physics.world.setBounds(0, 0, mapW, mapH);

        this.add.tileSprite(mapW/2, mapH/2, mapW, mapH, 'bg_path').setScrollFactor(0.5);

        // 그래픽 객체
        this.lineGraphics = this.add.graphics();
        this.deadlineGraphics = this.add.graphics();
        this.deadlineLine = this.add.rectangle(GAME_DATA.campaign.deadlineX, mapH/2, 10, mapH, 0xff0000).setOrigin(1, 0.5);
        this.deadlineOverlay = this.add.rectangle(GAME_DATA.campaign.deadlineX - mapW/2, mapH/2, mapW, mapH, 0xff0000, 0.3).setOrigin(1, 0.5);

        // 맵 그리기
        this.drawMap();

        // UI: 정보 텍스트
        this.infoText = this.add.text(10, 10, '', { 
            fontSize: '18px', fill: '#fff', backgroundColor: '#000000aa', padding: {x:10, y:10} 
        }).setScrollFactor(0);

        // 카메라 포커스
        const playerNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        if (playerNode) {
            this.cameras.main.centerOn(playerNode.x, playerNode.y);
        }

        // 입력 (드래그, 줌)
        this.input.on('pointermove', (p) => {
            if (!p.isDown) return;
            this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        });
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = this.cameras.main.zoom - deltaY * 0.001;
            this.cameras.main.zoom = Phaser.Math.Clamp(newZoom, 0.5, 2.0);
        });

        // 액션 버튼 생성
        this.actionBtnContainer = this.add.container(this.scale.width / 2, this.scale.height * 0.85).setScrollFactor(0);
        this.createActionButtonUI(); 
        
        this.updateUI(); 
    }

    createActionButtonUI() {
        const bg = this.add.rectangle(0, 0, 350, 60, 0x000000).setInteractive({ cursor: 'pointer' });
        bg.setStrokeStyle(4, 0xffffff);
        bg.name = 'btn_bg'; 

        const text = this.add.text(0, 0, "...", { fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        text.name = 'btn_text';

        this.actionBtnContainer.add([bg, text]);

        bg.on('pointerdown', () => {
            this.tweens.add({
                targets: this.actionBtnContainer, scale: 0.95, duration: 50, yoyo: true,
                onComplete: () => this.handleActionClick()
            });
        });
    }

    // ★ [핵심] 버튼 상태 관리 (이동 대기 vs 입장 대기)
    updateActionButton() {
        const bg = this.actionBtnContainer.getByName('btn_bg');
        const text = this.actionBtnContainer.getByName('btn_text');
        this.actionBtnContainer.visible = true;

        // 1. 목적지를 선택한 상태라면? -> [이동하기] 버튼 표시
        if (this.selectedNode) {
            const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
            const dist = Math.floor(Phaser.Math.Distance.Between(currNode.x, currNode.y, this.selectedNode.x, this.selectedNode.y));
            
            text.setText(`🏃 이동하기 (${dist}km)`);
            bg.fillColor = 0x008800; // 이동은 초록색
            return;
        }

        // 2. 선택 안 함 (현재 위치) -> [입장하기] 버튼 표시
        const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        let label = "대기 중...";
        let color = 0x444444;

        if (currNode.type === 'BATTLE') {
            label = "⚔️ 전투 시작";
            color = 0xcc0000;
        } else if (currNode.type === 'ELITE') {
            label = "👿 엘리트 전투";
            color = 0xaa00cc;
        } else if (currNode.type === 'BOSS') {
            label = "☠️ 보스전 입장";
            color = 0x550000;
        } else if (currNode.type === 'SHOP') {
            label = "💰 상점 입장";
            color = 0xffaa00;
        } else if (currNode.type === 'EVENT') {
            label = "❓ 이벤트 확인";
            color = 0x0088ff;
        } else if (currNode.type === 'EMPTY' || currNode.type === 'START') {
            label = "⛺ 정비 중";
            color = 0x444444;
        }

        text.setText(label);
        bg.fillColor = color;
    }

    // ★ [핵심] 버튼 클릭 핸들러
    handleActionClick() {
        // [CASE 1] 이동 모드
        if (this.selectedNode) {
            const target = this.selectedNode;
            this.selectedNode = null; // 선택 해제
            
            // 실제 이동 실행
            GAME_DATA.moveToNode(target.id);

            // 이동 애니메이션 (데드라인 전진)
            this.tweens.add({
                targets: [this.deadlineLine, this.deadlineOverlay],
                x: GAME_DATA.campaign.deadlineX,
                duration: 1000,
                ease: 'Power2',
                onUpdate: () => { this.deadlineOverlay.x = this.deadlineLine.x; },
                onComplete: () => {
                    this.checkEvents(target);
                }
            });
            
            // 카메라 이동
            this.cameras.main.pan(target.x, target.y, 800, 'Power2');
            this.drawMap(); // 플레이어 위치 갱신
            this.updateUI(); // 버튼을 다시 '입장' 모드로 변경
            return;
        }

        // [CASE 2] 입장 모드 (현재 위치)
        const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        
        if (currNode.type === 'BATTLE' || currNode.type === 'ELITE' || currNode.type === 'BOSS') {
            this.scene.start('BattleScene', { isElite: currNode.type === 'ELITE', isBoss: currNode.type === 'BOSS' });
        } else if (currNode.type === 'SHOP') {
            this.scene.start('ShopScene');
        } else if (currNode.type === 'EVENT') {
            alert("이벤트 발생! (체력 +50)");
            GAME_DATA.currentHp = Math.min(GAME_DATA.currentHp + 50, GAME_DATA.maxHp);
            GAME_DATA.completeCurrentNode(); 
            this.updateUI();
        }
    }

    // 노드 클릭 시: 이동하지 않고 '선택'만 함
    handleNodeClick(targetNode) {
        const currId = GAME_DATA.campaign.currentNodeId;

        // 자기 자신을 클릭하면 선택 취소
        if (targetNode.id === currId) {
            this.selectedNode = null;
            this.deadlineGraphics.clear(); // 미리보기 지움
            this.updateUI();
            return;
        }

        // 목적지 선택 설정
        this.selectedNode = targetNode;

        // 미리보기 그리기 (영구 표시)
        this.drawPreview(targetNode);

        // 버튼 업데이트 (이동하기로 변경)
        this.updateActionButton();
    }

    drawMap() {
        const nodes = GAME_DATA.campaign.nodes;
        const edges = GAME_DATA.campaign.edges;
        const currId = GAME_DATA.campaign.currentNodeId;

        this.lineGraphics.clear();
        this.lineGraphics.lineStyle(2, 0x888888, 0.5);
        edges.forEach(edge => {
            const n1 = nodes.find(n => n.id === edge.from);
            const n2 = nodes.find(n => n.id === edge.to);
            if (n1 && n2) this.lineGraphics.lineBetween(n1.x, n1.y, n2.x, n2.y);
        });

        nodes.forEach(node => {
            let color = 0xffffff;
            let radius = 15;
            let label = node.type;

            if (node.type === 'START') { color = 0x00ff00; radius = 20; }
            else if (node.type === 'BOSS') { color = 0xff0000; radius = 25; }
            else if (node.type === 'SHOP') { color = 0xffff00; label = '💰'; }
            else if (node.type === 'ELITE') { color = 0xff8800; label = '👿'; }
            else if (node.type === 'EVENT') { color = 0x0088ff; label = '❓'; }
            else { label = '⚔️'; }

            if (node.id === currId) {
                this.add.circle(node.x, node.y, radius + 5, 0xffffff).setStrokeStyle(2, 0x00ff00);
            }

            // 선택된 노드 강조
            if (this.selectedNode && this.selectedNode.id === node.id) {
                this.add.circle(node.x, node.y, radius + 8, 0x00ff00).setStrokeStyle(2, 0xffff00);
            }

            const circle = this.add.circle(node.x, node.y, radius, color);
            const text = this.add.text(node.x, node.y, label, { fontSize: '12px', color: '#000' }).setOrigin(0.5);
            circle.setInteractive({ cursor: 'pointer' });
            
            // 클릭 이벤트만 남김 (호버 제거)
            circle.on('pointerdown', () => this.handleNodeClick(node));
        });
    }

    drawPreview(targetNode) {
        const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        const dist = Phaser.Math.Distance.Between(currNode.x, currNode.y, targetNode.x, targetNode.y);
        const difficulty = 1.0 + (GAME_DATA.stage * 0.1);
        const advance = dist * difficulty * 0.8; 
        
        const futureX = GAME_DATA.campaign.deadlineX + advance;
        
        this.deadlineGraphics.clear();
        // 미래 데드라인 예측선
        this.deadlineGraphics.lineStyle(2, 0xff0000, 0.8);
        this.deadlineGraphics.fillStyle(0xff0000, 0.1);
        this.deadlineGraphics.fillRect(futureX - 5, 0, 10, GAME_DATA.campaign.mapHeight);
        
        // 이동 경로 점선 표시 (선택 시각화)
        this.deadlineGraphics.lineStyle(4, 0x00ff00, 0.5);
        this.deadlineGraphics.lineBetween(currNode.x, currNode.y, targetNode.x, targetNode.y);

        this.infoText.setText(`거리: ${Math.floor(dist)}km\n위험도: +${Math.floor(advance)} (예상)`);
    }

    checkEvents(node) {
        if (GAME_DATA.checkGameOver()) {
            alert("데드라인에 따라잡혔습니다! GAME OVER");
            GAME_DATA.startNewGame();
            this.scene.start('TitleScene');
            return;
        }
        this.updateUI();
    }

    updateUI() {
        const playerX = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId).x;
        const deadX = GAME_DATA.campaign.deadlineX;
        const gap = Math.floor(playerX - deadX);

        // 선택 상태가 아니면 기본 정보 표시
        if (!this.selectedNode) {
            this.infoText.setText(`HP: ${GAME_DATA.currentHp}/${GAME_DATA.maxHp}\nGold: ${GAME_DATA.gold}\n데드라인 격차: ${gap}km`);
        }
        
        this.deadlineLine.x = deadX;
        this.deadlineOverlay.x = deadX;
        this.updateActionButton();
    }

    update(time, delta) {
        // 데드라인 효과는 미리보기를 그리고 있을 땐(선택 중) 잠시 멈추거나, 
        // 겹쳐서 그리지 않도록 조정. 여기서는 간단히 유지하되 선택 중엔 drawPreview가 덮어씌울 수 있음.
        if (this.selectedNode) return; // 선택 중엔 미리보기 그래픽 유지

        this.deadlineGraphics.clear();
        const deadX = GAME_DATA.campaign.deadlineX;
        const mapH = GAME_DATA.campaign.mapHeight;

        this.deadlineGraphics.fillStyle(0xff0000, 0.2);
        this.deadlineGraphics.fillRect(deadX - 1000, 0, 1000, mapH);
        this.deadlineGraphics.fillStyle(0xff0000, 0.4);
        this.deadlineGraphics.fillRect(deadX - 50, 0, 50, mapH);

        this.deadlineGraphics.lineStyle(3, 0xffcccc, 1.0);
        this.deadlineGraphics.beginPath();
        this.deadlineGraphics.moveTo(deadX, 0);
        for (let y = 0; y <= mapH; y += 20) {
            const noise = Math.sin(y * 0.1 + time * 0.01) * 5 + (Math.random() * 10 - 5);
            this.deadlineGraphics.lineTo(deadX + noise, y);
        }
        this.deadlineGraphics.strokePath();
    }
}