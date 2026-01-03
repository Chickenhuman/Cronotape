// js/scenes/MapScene.js

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    create() {
        // [1] 전투 UI 확실하게 숨기기 (모든 ID 체크)
        const uiIds = ['timeline-slider', 'hand-container', 'ui-top-bar', 'ui-bottom-bar'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // 초기화
        this.selectedNode = null; 

        // [2] 맵 크기 및 배경 설정
        const mapW = GAME_DATA.campaign.mapWidth;
        const mapH = GAME_DATA.campaign.mapHeight;
        
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.physics.world.setBounds(0, 0, mapW, mapH);

        // ★ [디자인] 어두운 배경으로 변경 (눈 피로 감소)
        this.cameras.main.setBackgroundColor('#1a1a1a'); 
        
        // 배경 패턴을 아주 은은하게 깔기 (투명도 조절)
        const bg = this.add.tileSprite(mapW/2, mapH/2, mapW, mapH, 'bg_path');
        bg.setScrollFactor(0.5);
        bg.setAlpha(0.1); // 아주 연하게

        // ★ [시야] 맵 전체가 보이도록 줌 아웃 (보스 잘림 방지)
        // 화면 너비에 맵을 맞추되, 너무 작아지면 최소 0.5까지만
        const zoomRatio = this.scale.width / mapW;
        this.cameras.main.setZoom(Math.max(zoomRatio * 0.9, 0.5));
        this.cameras.main.centerOn(mapW / 2, mapH / 2);

        // [3] 그래픽 객체
        this.lineGraphics = this.add.graphics();
        this.deadlineGraphics = this.add.graphics();
        
        // 데드라인 선과 오버레이
        this.deadlineLine = this.add.rectangle(GAME_DATA.campaign.deadlineX, mapH/2, 4, mapH, 0xff0000).setOrigin(1, 0.5);
        this.deadlineOverlay = this.add.rectangle(GAME_DATA.campaign.deadlineX - mapW/2, mapH/2, mapW, mapH, 0xff0000, 0.1).setOrigin(1, 0.5);

        // 맵 그리기
        this.drawMap();

        // UI: 정보 텍스트 (상단 고정)
        this.infoText = this.add.text(20, 20, '', { 
            fontSize: '20px', fill: '#eeeeee', backgroundColor: '#000000cc', padding: {x:15, y:10} 
        }).setScrollFactor(0).setDepth(100);

        // 입력 (드래그, 줌)
        this.input.on('pointermove', (p) => {
            if (!p.isDown) return;
            this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
        });
        
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            const newZoom = this.cameras.main.zoom - deltaY * 0.001;
            this.cameras.main.zoom = Phaser.Math.Clamp(newZoom, 0.3, 2.0);
        });

        // 액션 버튼 생성
        this.actionBtnContainer = this.add.container(this.scale.width / 2, this.scale.height * 0.85).setScrollFactor(0).setDepth(100);
        this.createActionButtonUI(); 
        
        this.updateUI(); 
    }

    createActionButtonUI() {
        const bg = this.add.rectangle(0, 0, 320, 60, 0x222222).setInteractive({ cursor: 'pointer' });
        bg.setStrokeStyle(2, 0x888888);
        bg.name = 'btn_bg'; 

        const text = this.add.text(0, 0, "...", { fontSize: '20px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        text.name = 'btn_text';

        this.actionBtnContainer.add([bg, text]);

        bg.on('pointerdown', () => {
            this.tweens.add({
                targets: this.actionBtnContainer, scale: 0.95, duration: 50, yoyo: true,
                onComplete: () => this.handleActionClick()
            });
        });
    }

    updateActionButton() {
        const currId = GAME_DATA.campaign.currentNodeId;
        const currNode = GAME_DATA.getNode(currId);
        
        const bg = this.actionBtnContainer.getByName('btn_bg');
        const text = this.actionBtnContainer.getByName('btn_text');

        if (this.selectedNode) {
            // 이동 대기 상태
            const dist = Math.floor(Phaser.Math.Distance.Between(currNode.x, currNode.y, this.selectedNode.x, this.selectedNode.y));
            text.setText(`🚀 이동 (${dist}km)`);
            bg.fillColor = 0x2e7d32; // 차분한 초록색
            bg.setStrokeStyle(2, 0x4caf50);
        } else {
            // 입장 대기 상태
            let label = "대기 중...";
            let color = 0x333333;
            let stroke = 0x666666;

            if (currNode.type === 'BATTLE') { label = "⚔️ 전투 진입"; color = 0x7f0000; stroke = 0xff5555; } // 어두운 빨강
            else if (currNode.type === 'ELITE') { label = "👿 엘리트 전투"; color = 0x4a148c; stroke = 0xaa00ff; } // 어두운 보라
            else if (currNode.type === 'BOSS') { label = "☠️ 보스전 입장"; color = 0x3e2723; stroke = 0xff5722; } // 어두운 갈색
            else if (currNode.type === 'SHOP') { label = "💰 상점 입장"; color = 0xff6f00; stroke = 0xffb300; } // 어두운 주황
            else if (currNode.type === 'EVENT') { label = "❓ 이벤트 확인"; color = 0x01579b; stroke = 0x03a9f4; } // 어두운 파랑
            else if (currNode.type === 'EMPTY' || currNode.type === 'START') { label = "⛺ 정비 중"; color = 0x212121; }

            text.setText(label);
            bg.fillColor = color;
            bg.setStrokeStyle(2, stroke);
        }
    }

  handleActionClick() {
        // 1. 다른 노드로 이동하는 경우
        if (this.selectedNode) {
            const target = this.selectedNode;
            this.selectedNode = null; 
            GAME_DATA.moveToNode(target.id);

            // 데드라인 애니메이션
            this.tweens.add({
                targets: [this.deadlineLine, this.deadlineOverlay],
                x: GAME_DATA.campaign.deadlineX,
                duration: 800,
                ease: 'Cubic.Out',
                onUpdate: () => { this.deadlineOverlay.x = this.deadlineLine.x; }
            });
            
            // 카메라 이동 및 말 이동 연출
            this.cameras.main.pan(target.x, target.y, 800, 'Power2');
            
            // ★ [핵심] 이동 애니메이션(0.8초)이 끝난 후 '즉시 진입'
            this.time.delayedCall(800, () => {
                this.checkEvents(target); // 게임오버 체크
                this.enterNode(target);   // 노드 진입 (전투/이벤트 실행)
            });

            this.drawMap(); 
            this.updateUI(); 
            return;
        }

        // 2. 현재 노드 재진입 (예외 상황)
        const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        this.enterNode(currNode);
    }
    // ★ [신규] 노드 타입별 진입 처리 함수 분리
    enterNode(node) {
        console.log(`[MapScene] 노드 진입: ${node.type}`);

        if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
            // 전투 씬으로 전환
            this.scene.start('BattleScene', { isElite: node.type === 'ELITE', isBoss: node.type === 'BOSS' });
        } 
        else if (node.type === 'SHOP') {
            // 상점 씬으로 전환
            this.scene.start('ShopScene');
        } 
        else if (node.type === 'EVENT') {
            // ★ [변경] 단순 alert 대신 EventManager 호출
            if (typeof EventManager !== 'undefined') {
                EventManager.playRandomEvent(this);
            } else {
                alert("이벤트 시스템 로딩 실패!");
            }
        } 
        else if (node.type === 'EMPTY' || node.type === 'START') {
            // 빈 노드는 아무 일도 일어나지 않음 (로그만 출력)
            console.log("빈 지역입니다.");
        }
    }

    handleNodeClick(targetNode) {
        const currId = GAME_DATA.campaign.currentNodeId;
        if (targetNode.id === currId) {
            this.selectedNode = null;
            this.deadlineGraphics.clear();
            this.updateUI();
            return;
        }
        this.selectedNode = targetNode;
        this.drawPreview(targetNode);
        this.updateActionButton();
        this.drawMap(); // 선택 강조 갱신
    }

    drawMap() {
        const nodes = GAME_DATA.campaign.nodes;
        const edges = GAME_DATA.campaign.edges;
        const currId = GAME_DATA.campaign.currentNodeId;

        this.lineGraphics.clear();
        // ★ [디자인] 연결선을 얇고 어둡게 (눈 피로 감소)
        this.lineGraphics.lineStyle(1, 0x444444, 0.5); 
        edges.forEach(edge => {
            const n1 = nodes.find(n => n.id === edge.from);
            const n2 = nodes.find(n => n.id === edge.to);
            if (n1 && n2) this.lineGraphics.lineBetween(n1.x, n1.y, n2.x, n2.y);
        });

        nodes.forEach(node => {
            // ★ [디자인] 노드 색상 팔레트 변경 (파스텔/매트 톤)
            let color = 0x888888;
            let radius = 10;
            let label = ''; 

            if (node.type === 'START') { color = 0x66bb6a; radius = 14; } // 매트 그린
            else if (node.type === 'BOSS') { color = 0xe53935; radius = 18; label = '☠️'; } // 매트 레드
            else if (node.type === 'SHOP') { color = 0xffca28; label = '💰'; radius = 12; } // 앰버
            else if (node.type === 'ELITE') { color = 0x8e24aa; label = '👿'; radius = 12; } // 퍼플
            else if (node.type === 'EVENT') { color = 0x1e88e5; label = '❓'; radius = 12; } // 블루
            else if (node.type === 'BATTLE') { color = 0xeeeeee; radius = 8; } // 흰색 (일반)
            else if (node.type === 'EMPTY') { color = 0x333333; radius = 6; } // 아주 어두운 회색 (클리어됨)

            // 현재 위치 (하얀색 테두리)
            if (node.id === currId) {
                this.add.circle(node.x, node.y, radius + 4, 0x000000).setStrokeStyle(2, 0xffffff);
            }

            // 선택된 노드 (금색 테두리)
            if (this.selectedNode && this.selectedNode.id === node.id) {
                this.add.circle(node.x, node.y, radius + 6, 0x000000).setStrokeStyle(2, 0xffd700);
            }

            const circle = this.add.circle(node.x, node.y, radius, color);
            if (label) {
                this.add.text(node.x, node.y, label, { fontSize: '14px' }).setOrigin(0.5);
            }

            circle.setInteractive({ cursor: 'pointer' });
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
        // 예상 데드라인 (점선 느낌 대신 투명 사각형)
        this.deadlineGraphics.fillStyle(0xff5555, 0.2);
        this.deadlineGraphics.fillRect(futureX - 2, 0, 4, GAME_DATA.campaign.mapHeight);

        // 경로 선
        this.deadlineGraphics.lineStyle(2, 0xffd700, 0.5);
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

        if (!this.selectedNode) {
            this.infoText.setText(`HP: ${GAME_DATA.currentHp}\nGold: ${GAME_DATA.gold}\n격차: ${gap}km`);
        }
        
        this.deadlineLine.x = deadX;
        this.deadlineOverlay.x = deadX;
        this.updateActionButton();
    }

    update(time, delta) {
        if (this.selectedNode) return; 

        this.deadlineGraphics.clear();
        const deadX = GAME_DATA.campaign.deadlineX;
        const mapH = GAME_DATA.campaign.mapHeight;

        // 데드라인 연출 (붉은 안개 느낌)
        this.deadlineGraphics.fillStyle(0xff0000, 0.1); // 더 연하게
        this.deadlineGraphics.fillRect(deadX - 1500, 0, 1500, mapH);
        
        this.deadlineGraphics.fillStyle(0xff0000, 0.3);
        this.deadlineGraphics.fillRect(deadX - 50, 0, 50, mapH);

        // 노이즈 선 (가늘게)
        this.deadlineGraphics.lineStyle(1, 0xffaaaa, 0.5);
        this.deadlineGraphics.beginPath();
        this.deadlineGraphics.moveTo(deadX, 0);
        for (let y = 0; y <= mapH; y += 40) {
            const noise = Math.sin(y * 0.05 + time * 0.005) * 10;
            this.deadlineGraphics.lineTo(deadX + noise, y);
        }
        this.deadlineGraphics.strokePath();
    }
}