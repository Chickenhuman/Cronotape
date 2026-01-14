// js/scenes/MapScene.js

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    create() {
        // [1] 전투 UI 숨기기
        const uiIds = ['timeline-slider', 'hand-container', 'ui-top-bar', 'ui-bottom-bar'];
        uiIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // [초기화] 상태 변수
        this.selectedNode = null; 
        this.isProcessing = false; // [수정] 이동/액션 중 중복 입력 방지 플래그
        
        // [최적화] 노드 객체 관리를 위한 맵 (ID -> Phaser Object)
        // 매번 destroy/create 하지 않고 속성만 변경하기 위함
        this.nodeMap = {}; 

        // [2] 맵 설정
        const mapW = GAME_DATA.campaign.mapWidth;
        const mapH = GAME_DATA.campaign.mapHeight;
        
        this.cameras.main.setBounds(0, 0, mapW, mapH);
        this.physics.world.setBounds(0, 0, mapW, mapH);
        this.cameras.main.setBackgroundColor('#1a1a1a'); 
        this.artifactManager = new ArtifactManager(this);
    this.artifactManager.init(); // 기존 유물 불러와서 그리기
this.artifactManager.updateUI(); // ★ 여기를 수정했습니다!

        // 배경 패턴
        // (주의: PreloadScene에서 'bg_path'가 로드되어 있어야 함. 없으면 에러 방지용으로 try-catch 혹은 키 확인 필요)
        if (this.textures.exists('bg_path')) {
            const bg = this.add.tileSprite(mapW/2, mapH/2, mapW, mapH, 'bg_path');
            bg.setScrollFactor(0.5);
            bg.setAlpha(0.1);
        }

        // 줌 설정
        const zoomRatio = this.scale.width / mapW;
        this.cameras.main.setZoom(Math.max(zoomRatio * 0.9, 0.5));
        this.cameras.main.centerOn(mapW / 2, mapH / 2);

        // [3] 그래픽 객체 분리 [수정]
        // 배경 효과용 (붉은 안개) - 항상 아래에 깔림
        this.bgEffectGraphics = this.add.graphics().setDepth(0);
        // 연결선용
        this.lineGraphics = this.add.graphics().setDepth(1);
        // 미리보기/데드라인 표시용 - 노드보다 위에 그려질 수도 있음
        this.previewGraphics = this.add.graphics().setDepth(2);
        
        // 데드라인 선 (고정 객체)
        this.deadlineLine = this.add.rectangle(GAME_DATA.campaign.deadlineX, mapH/2, 4, mapH, 0xff0000).setOrigin(1, 0.5).setDepth(3);
        this.deadlineOverlay = this.add.rectangle(GAME_DATA.campaign.deadlineX - mapW/2, mapH/2, mapW, mapH, 0xff0000, 0.1).setOrigin(1, 0.5).setDepth(3);

        // 노드 컨테이너 (노드들은 이 깊이에서 그려짐)
        this.nodeContainer = this.add.container(0, 0).setDepth(10);

        // UI 텍스트
        this.infoText = this.add.text(20, 20, '', { 
            fontSize: '20px', fill: '#eeeeee', backgroundColor: '#000000cc', padding: {x:15, y:10} 
        }).setScrollFactor(0).setDepth(100);

        // 맵 그리기 (초기 1회 + 업데이트)
        this.drawMap();

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

        // 액션 버튼
        this.actionBtnContainer = this.add.container(this.scale.width / 2, this.scale.height * 0.85).setScrollFactor(0).setDepth(100);
        this.createActionButtonUI(); 
        this.createPlayerMarker();
        this.updateUI(); 
    }

// js/scenes/MapScene.js 내부

createActionButtonUI() {
    const bg = this.add.rectangle(0, 0, 320, 60, 0x222222); // setInteractive 제거
    bg.setStrokeStyle(2, 0x888888);
    bg.name = 'btn_bg'; 

    const text = this.add.text(0, 0, "버튼 초기화", { 
        fontSize: '20px', fontStyle: 'bold', color: '#fff' 
    }).setOrigin(0.5);
    text.name = 'btn_text';

    this.actionBtnContainer.add([bg, text]);

    // [수정] 컨테이너 전체에 클릭 영역 설정 (가장 확실한 방법)
    // 사각형 영역: x, y, width, height (중심 기준이므로 좌표 보정)
    const hitArea = new Phaser.Geom.Rectangle(-160, -30, 320, 60);
    this.actionBtnContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // 클릭 이벤트
    this.actionBtnContainer.on('pointerdown', () => {
        // [수정] 애니메이션과 로직 분리
        if (this.isProcessing) return;

        this.tweens.add({
            targets: this.actionBtnContainer, 
            scale: 0.95, 
            duration: 50, 
            yoyo: true,
            onComplete: () => this.handleActionClick()
        });
    });
}

// [추가] 플레이어 마커 생성 함수
    createPlayerMarker() {
        // 1. 마커 컨테이너 생성 (노드보다 위에 보이도록 depth 설정)
        this.playerMarker = this.add.container(0, 0).setDepth(20);

        // 2. 위치 표시용 핀 그래픽
        const pin = this.add.graphics();
        pin.fillStyle(0x00ff00, 1); // 형광 초록색
        pin.fillTriangle(-8, -15, 8, -15, 0, 0); // 역삼각형 (화살표)
        pin.fillCircle(0, -20, 8); // 핀 머리
        
        // "ME" 텍스트
        const text = this.add.text(0, -20, "ME", {
            fontSize: '10px', fontStyle: 'bold', color: '#000'
        }).setOrigin(0.5);

        // 3. 바닥에서 퍼져나가는 원 (펄스 효과)
        const pulse = this.add.circle(0, 0, 10);
        pulse.setStrokeStyle(2, 0x00ff00);
        
        this.playerMarker.add([pulse, pin, text]);

        // [애니메이션 1] 핀이 둥둥 떠다니는 효과
        this.tweens.add({
            targets: [pin, text],
            y: '-=10', // 위로 10픽셀 이동
            duration: 800,
            yoyo: true, // 다시 내려옴
            repeat: -1, // 무한 반복
            ease: 'Sine.easeInOut'
        });

        // [애니메이션 2] 바닥 원이 커지면서 사라지는 효과 (신호 발신 느낌)
        this.tweens.add({
            targets: pulse,
            scale: 3.0,
            alpha: 0,
            duration: 1500,
            repeat: -1
        });

        // 초기 위치 설정
        const currId = GAME_DATA.campaign.currentNodeId;
        const currNode = GAME_DATA.getNode(currId);
        if (currNode) {
            this.playerMarker.setPosition(currNode.x, currNode.y);
        }
    }
    updateActionButton() {
        const currId = GAME_DATA.campaign.currentNodeId;
        const currNode = GAME_DATA.getNode(currId);
        
        const bg = this.actionBtnContainer.getByName('btn_bg');
        const text = this.actionBtnContainer.getByName('btn_text');

        if (this.selectedNode) {
            // [상태 1] 이동 대기
            const dist = Math.floor(Phaser.Math.Distance.Between(currNode.x, currNode.y, this.selectedNode.x, this.selectedNode.y));
            text.setText(`🚀 이동 (${dist}km)`);
            bg.fillColor = 0x2e7d32; 
            bg.setStrokeStyle(2, 0x4caf50);
        } else {
            // [상태 2] 현재 노드에 머무름
            // [수정] UX 개선: 정비 중(Empty)인데 선택 안 했으면 이동 유도 문구 표시
            const isResting = (currNode.type === 'EMPTY' || currNode.type === 'START');
            
            if (isResting) {
                text.setText("🗺️ 지도에서 목표 선택");
                bg.fillColor = 0x444444; // 비활성 느낌
                bg.setStrokeStyle(2, 0x888888);
            } else {
                // 재진입 가능한 특수 노드들
                let label = "대기 중...";
                let color = 0x333333;
                let stroke = 0x666666;

                if (currNode.type === 'BATTLE') { label = "⚔️ 전투 재진입"; color = 0x7f0000; stroke = 0xff5555; }
                else if (currNode.type === 'ELITE') { label = "👿 엘리트 전투"; color = 0x4a148c; stroke = 0xaa00ff; }
                else if (currNode.type === 'BOSS') { label = "☠️ 보스전 입장"; color = 0x3e2723; stroke = 0xff5722; }
                else if (currNode.type === 'SHOP') { label = "💰 상점 입장"; color = 0xff6f00; stroke = 0xffb300; }
                else if (currNode.type === 'EVENT') { label = "❓ 이벤트 확인"; color = 0x01579b; stroke = 0x03a9f4; }

                text.setText(label);
                bg.fillColor = color;
                bg.setStrokeStyle(2, stroke);
            }
        }
    }
handleActionClick() {
    // [안전장치] 처리 중이면 무시
    if (this.isProcessing) return;

    // [CASE 1] 이동 시도 (선택된 노드가 있을 때)
    if (this.selectedNode) {
        const target = this.selectedNode;
        // 주의: 여기서 selectedNode를 바로 null로 만들지 않고, 이동 완료 후 처리합니다.
        
        // 이동 로직 시작 -> 입력 잠금
        this.isProcessing = true; 

        // 데이터상 이동 처리 (즉시 반영됨)
        const success = GAME_DATA.moveToNode(target.id);

        if (success) {
            console.log(`✅ 이동 시작: Node ${target.id}로 이동 중...`);
            
            // 1. 데드라인 UI 업데이트 애니메이션
            this.tweens.add({
                targets: [this.deadlineLine, this.deadlineOverlay],
                x: GAME_DATA.campaign.deadlineX,
                duration: 800,
                ease: 'Cubic.Out',
                onUpdate: () => { this.deadlineOverlay.x = this.deadlineLine.x; }
            });
            if (this.playerMarker) {
        this.tweens.add({
            targets: this.playerMarker,
            x: target.x,
            y: target.y,
            duration: 800,
            ease: 'Power2'
        });
    }
            
            // 2. 카메라 이동 연출 (800ms)
            this.cameras.main.pan(target.x, target.y, 800, 'Power2');
            
            // 3. ★ [핵심 변경] 이동 완료 후 '자동 진입' 하지 않음
            this.time.delayedCall(800, () => {
                this.isProcessing = false; // 입력 잠금 해제
                
                // 도착했으므로 선택 상태 해제 -> 버튼이 '현재 위치 행동' 모드로 바뀜
                this.selectedNode = null; 
                
                // 미리보기 선 지우기
                this.previewGraphics.clear();

                // UI 갱신 (이제 버튼이 "⚔️ 전투 입장" 등으로 바뀜)
                this.updateUI(); 
                this.drawMap(); // 내 위치 테두리 갱신
                
                console.log("📍 도착 완료. 입장 대기 중.");
            });
        } else {
            // 실패 처리
            this.isProcessing = false;
            console.warn("❌ 이동 실패");
            this.infoText.setText("🚫 연결되지 않은 지역입니다!");
            this.infoText.setColor('#ff5555');
            this.shakeUI(this.actionBtnContainer);
        }
        return;
    }

    // [CASE 2] 현재 위치 상호작용 (선택된 노드가 없을 때 = 도착 후 버튼 클릭 시)
    const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
    
    if (!currNode) {
        this.scene.restart();
        return;
    }

    const nonEnterableTypes = ['START', 'EMPTY']; 
    
    if (!nonEnterableTypes.includes(currNode.type)) {
        // ★ 여기서 실제로 씬 전환이 일어남
        console.log("🚪 노드 입장 시도");
        this.enterNode(currNode);
    } else {
        // 이동 유도 (정비 중)
        console.log("⚠️ 이동 필요");
        this.infoText.setText("⚠️ 지도의 동그라미를 눌러 이동할 곳을 선택하세요!");
        this.infoText.setColor('#ff5555');
        this.shakeUI(this.actionBtnContainer);
    }
}


    enterNode(node) {
        console.log(`[MapScene] 노드 진입: ${node.type}`);

        if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
            this.scene.start('BattleScene', { isElite: node.type === 'ELITE', isBoss: node.type === 'BOSS' });
        } 
        else if (node.type === 'SHOP') {
            this.scene.start('ShopScene');
        } 
        else if (node.type === 'EVENT') {
            if (typeof EventManager !== 'undefined') {
                EventManager.playRandomEvent(this);
            } else {
                console.error("이벤트 시스템 누락"); // alert 제거
            }
        } 
    }

    handleNodeClick(targetNode) {
        if (this.isProcessing) return; // 이동 중 클릭 방지

        const currId = GAME_DATA.campaign.currentNodeId;
        
        // 같은 노드 클릭 시 선택 해제
        if (targetNode.id === currId) {
            this.selectedNode = null;
            this.previewGraphics.clear(); // 미리보기 지우기
            this.updateUI();
            this.drawMap(); // 강조 효과 끄기 위해 호출
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

        // 1. 연결선 (Lines) - 매번 새로 그림 (단순 그래픽)
        this.lineGraphics.clear();
        this.lineGraphics.lineStyle(1, 0x444444, 0.5); 
        edges.forEach(edge => {
            const n1 = nodes.find(n => n.id === edge.from);
            const n2 = nodes.find(n => n.id === edge.to);
            if (n1 && n2) this.lineGraphics.lineBetween(n1.x, n1.y, n2.x, n2.y);
        });

        // 2. 노드 (Circles) - [최적화] 객체 재사용
        nodes.forEach(node => {
            let circle = this.nodeMap[node.id];
            
            // 노드 타입별 스타일 설정
            let color = 0x888888;
            let radius = 10;
            let labelText = ''; 

            if (node.type === 'START') { color = 0x66bb6a; radius = 14; }
            else if (node.type === 'BOSS') { color = 0xe53935; radius = 18; labelText = '☠️'; }
            else if (node.type === 'SHOP') { color = 0xffca28; labelText = '💰'; radius = 12; }
            else if (node.type === 'ELITE') { color = 0x8e24aa; labelText = '👿'; radius = 12; }
            else if (node.type === 'EVENT') { color = 0x1e88e5; labelText = '❓'; radius = 12; }
            else if (node.type === 'BATTLE') { color = 0xeeeeee; radius = 8; }
            else if (node.type === 'EMPTY') { color = 0x333333; radius = 6; }

            // 객체가 없으면 최초 생성
            if (!circle) {
                circle = this.add.circle(node.x, node.y, radius, color);
                circle.setInteractive({ cursor: 'pointer' });
                circle.on('pointerdown', () => this.handleNodeClick(node));
                
                // 아이콘 텍스트도 있으면 생성
                if (labelText) {
                    const txt = this.add.text(node.x, node.y, labelText, { fontSize: '14px' }).setOrigin(0.5);
                    this.nodeContainer.add(txt); // 텍스트는 컨테이너에 넣어서 관리 권장
                }
                
                this.nodeContainer.add(circle); // 컨테이너에 추가
                this.nodeMap[node.id] = circle; // 맵에 저장
            }

            // 스타일 업데이트 (생성되어 있는 객체 재활용)
            circle.setRadius(radius);
            circle.setFillStyle(color);

            // 테두리 로직
            if (node.id === currId) {
                // 현재 위치: 하얀 테두리
                circle.setStrokeStyle(2, 0xffffff);
            } else if (this.selectedNode && this.selectedNode.id === node.id) {
                // 선택된 노드: 금색 테두리 + 약간 큼
                circle.setRadius(radius + 2);
                circle.setStrokeStyle(2, 0xffd700);
            } else {
                // 기본: 테두리 없음
                circle.setStrokeStyle(0);
            }
        });
    }

    drawPreview(targetNode) {
        const currNode = GAME_DATA.getNode(GAME_DATA.campaign.currentNodeId);
        const dist = Phaser.Math.Distance.Between(currNode.x, currNode.y, targetNode.x, targetNode.y);
        const difficulty = 1.0 + (GAME_DATA.stage * 0.1);
        const advance = dist * difficulty * 0.8; 
        
        const futureX = GAME_DATA.campaign.deadlineX + advance;
        
        // [수정] previewGraphics 만 별도로 제어하여 배경 노이즈와 충돌 방지
        this.previewGraphics.clear();
        
        // 예상 데드라인
        this.previewGraphics.fillStyle(0xff5555, 0.4);
        this.previewGraphics.fillRect(futureX - 2, 0, 4, GAME_DATA.campaign.mapHeight);

        // 경로 선
        this.previewGraphics.lineStyle(2, 0xffd700, 0.8);
        this.previewGraphics.lineBetween(currNode.x, currNode.y, targetNode.x, targetNode.y);

        this.infoText.setText(`거리: ${Math.floor(dist)}km\n위험도: +${Math.floor(advance)} (예상)`);
    }

    checkEvents(node) {
        if (GAME_DATA.checkGameOver()) {
            // alert 대신 커스텀 UI 권장하지만 일단 유지
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
            this.infoText.setColor('#eeeeee'); // 색상 원복
        }
        if (this.artifactManager) {
this.artifactManager.updateUI(); // ★ 여기도 수정했습니다!
    }
        
        // 트윈 중이 아닐 때만 강제 위치 조정 (트윈 충돌 방지)
        if (!this.tweens.isTweening(this.deadlineLine)) {
            this.deadlineLine.x = deadX;
            this.deadlineOverlay.x = deadX;
        }
        
        this.updateActionButton();
    }



    shakeUI(target) {
        if (!target) return;
        this.tweens.add({
            targets: target,
            x: target.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 5,
            ease: 'Sine.easeInOut'
        });
    }

// js/scenes/MapScene.js 클래스 내부

    // ★ [추가] 로그 출력 함수 (BattleScene과 호환성 유지)
    addLog(message, color) {
        console.log(`[GAME LOG] ${message}`);
        
        // 맵에서는 별도의 로그창 대신, 화면 중앙 상단에 토스트 메시지로 띄웁니다.
        const toast = this.add.text(this.scale.width / 2, 150, message, {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#000000cc',
            padding: { x: 20, y: 10 },
            fontFamily: 'Rajdhani'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3000); // 최상단 표시

        // 2초 뒤에 서서히 사라짐
        this.tweens.add({
            targets: toast,
            y: 120,      // 살짝 위로 올라감
            alpha: 0,    // 투명해짐
            duration: 2000,
            ease: 'Power2',
            onComplete: () => toast.destroy()
        });
    }

    // ★ [추가] 플로팅 텍스트 (골드 획득, 유물 중복 시 사용)
    showFloatingText(x, y, message, color = '#ffffff') {
        const text = this.add.text(x, y, message, {
            fontSize: '18px',
            fontStyle: 'bold',
            color: color,
            stroke: '#000000',
            strokeThickness: 4,
            fontFamily: 'Rajdhani',
            align: 'center'
        }).setOrigin(0.5).setDepth(3000);

        this.tweens.add({
            targets: text,
            y: y - 60,   // 위로 둥둥 떠오름
            alpha: 0,
            duration: 1500,
            ease: 'Back.out',
            onComplete: () => text.destroy()
        });
    }

    update(time, delta) {
        // [수정] selectedNode 여부와 상관없이 배경 효과는 계속 재생 (bgEffectGraphics 사용)
        
        this.bgEffectGraphics.clear();
        const deadX = GAME_DATA.campaign.deadlineX;
        const mapH = GAME_DATA.campaign.mapHeight;

        // 배경 붉은 안개
        this.bgEffectGraphics.fillStyle(0xff0000, 0.05);
        this.bgEffectGraphics.fillRect(deadX - 1500, 0, 1500, mapH);
        
        this.bgEffectGraphics.fillStyle(0xff0000, 0.15);
        this.bgEffectGraphics.fillRect(deadX - 50, 0, 50, mapH);

        // 노이즈 선 애니메이션
        this.bgEffectGraphics.lineStyle(1, 0xffaaaa, 0.3);
        this.bgEffectGraphics.beginPath();
        this.bgEffectGraphics.moveTo(deadX, 0);
        for (let y = 0; y <= mapH; y += 40) {
            const noise = Math.sin(y * 0.05 + time * 0.005) * 10;
            this.bgEffectGraphics.lineTo(deadX + noise, y);
        }
        this.bgEffectGraphics.strokePath();
    }
}
