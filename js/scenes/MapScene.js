// js/scenes/MapScene.js

class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    preload() {
        this.load.image('bg_base', 'assets/maps/bg_base.png');
        this.load.image('icon_player', 'assets/icon/swordman.png'); 
        this.load.image('icon_shop', 'assets/icon/shop.png');
        this.load.image('icon_boss', 'assets/icon/boss.png');
    }

    create() {
        // UI 정리
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        if (topBar) topBar.style.display = 'none';
        if (bottomBar) bottomBar.style.display = 'none';
        const shopUI = document.getElementById('shop-ui');
        if (shopUI) shopUI.style.display = 'none';

        // 1. 배경
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg_base');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7).setOrigin(0);

        // 2. 타이틀 & 거리 정보
        this.add.text(this.scale.width / 2, 60, "OPERATION: FRONTLINE", {
            fontSize: '40px', fontFamily: 'serif', color: '#ffcc00', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // ★ 현재 상태 텍스트
        const dist = GAME_DATA.campaign.currentDistance;
        const dead = GAME_DATA.campaign.deadline;
        const gap = dist - dead;

        this.add.text(this.scale.width / 2, 110, 
            `현재 위치: ${dist}km  /  목표: ${GAME_DATA.campaign.goalDistance}km`, 
            { fontSize: '24px', color: '#fff' }
        ).setOrigin(0.5);

        // 데드라인 경고 문구
        const dangerColor = (gap <= 10) ? '#ff0000' : '#aaaaaa';
        this.add.text(this.scale.width / 2, 145, 
            `⚠️ 데드라인(추격자): ${dead}km (격차: ${gap}km)`, 
            { fontSize: '18px', color: dangerColor, fontStyle: (gap<=10 ? 'bold' : 'normal') }
        ).setOrigin(0.5);

        // 3. 맵 그리기 (거리 기반)
        this.drawDistanceMap();

        // 4. 액션 버튼
        this.createActionButton();
    }

    // ★ [핵심] 거리 기반 맵 그리기
    drawDistanceMap() {
        const goalDist = GAME_DATA.campaign.goalDistance || 100;
        const currentDist = GAME_DATA.campaign.currentDistance;
        const deadline = GAME_DATA.campaign.deadline;

        const barWidth = 800;
        const barHeight = 30;
        const startX = (this.scale.width - barWidth) / 2;
        const centerY = this.scale.height / 2;

        const graphics = this.add.graphics();

        // (1) 전체 트랙 (빈 도로)
        graphics.fillStyle(0x333333, 1);
        graphics.fillRoundedRect(startX, centerY - barHeight/2, barWidth, barHeight, 15);

        // (2) 데드라인 영역 (붉은색 - 추격자)
        // 데드라인은 음수일 수 있으므로 0부터 시작하도록 보정하되, 시각적으로 표현
        let deadRatio = Math.max(0, deadline) / goalDist;
        if (deadRatio > 1) deadRatio = 1;
        
        if (deadRatio > 0) {
            graphics.fillStyle(0x880000, 0.8); // 붉은색
            graphics.fillRoundedRect(startX, centerY - barHeight/2, barWidth * deadRatio, barHeight, { tl:15, bl:15, tr:0, br:0 });
        }

        // (3) 플레이어 진행 영역 (녹색/파란색)
        let playerRatio = Math.max(0, currentDist) / goalDist;
        if (playerRatio > 1) playerRatio = 1;

        // 데드라인보다 앞선 부분만 초록색으로 칠하기 위해
        if (playerRatio > deadRatio) {
            graphics.fillStyle(0x00ff00, 0.6);
            graphics.fillRect(startX + (barWidth * deadRatio), centerY - barHeight/2, barWidth * (playerRatio - deadRatio), barHeight);
        }

        // (4) 마커 표시
        // 1. 데드라인 마커 (해골)
        const deadX = startX + (barWidth * deadRatio);
        this.add.text(deadX, centerY + 30, "💀", { fontSize: '24px' }).setOrigin(0.5);
        this.add.line(0, 0, deadX, centerY - 20, deadX, centerY + 20, 0xff0000).setLineWidth(2);

        // 2. 플레이어 마커 (아이콘)
        const playerX = startX + (barWidth * playerRatio);
        let playerIcon = 'icon_player';
        if (!this.textures.exists(playerIcon)) playerIcon = null;

        if (playerIcon) {
            this.add.image(playerX, centerY - 40, playerIcon).setDisplaySize(50, 50);
        } else {
            this.add.circle(playerX, centerY - 40, 20, 0x00ff00);
        }
        this.add.text(playerX, centerY - 75, "YOU", { fontSize:'16px', color:'#00ff00', fontStyle:'bold'}).setOrigin(0.5);
        
        // 3. 목표 지점 (깃발)
        const goalX = startX + barWidth;
        this.add.text(goalX, centerY - 40, "🏁", { fontSize: '30px' }).setOrigin(0.5);
        this.add.text(goalX, centerY + 30, "GOAL", { fontSize:'14px', color:'#fff'}).setOrigin(0.5);
    }

    createActionButton() {
        // 버튼 텍스트 설정
        let btnText = "⚔️ 작전 시작 (BATTLE)";
        let btnColor = 0xcc0000;
        let action = "BATTLE";

        // 데드라인에 잡혔는지 확인
        if (GAME_DATA.isGameOver()) {
            btnText = "💀 GAME OVER";
            btnColor = 0x333333;
            action = "GAMEOVER";
        }

        const btn = this.add.container(this.scale.width / 2, this.scale.height * 0.8);
        const bg = this.add.rectangle(0, 0, 300, 60, btnColor).setInteractive({ cursor: 'pointer' });
        bg.setStrokeStyle(3, 0xffffff);
        const text = this.add.text(0, 0, btnText, { fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5);
        
        btn.add([bg, text]);

        bg.on('pointerover', () => bg.setScale(1.05));
        bg.on('pointerout', () => bg.setScale(1.0));
        
        bg.on('pointerdown', () => {
            if (action === "GAMEOVER") {
                this.scene.start('TitleScene'); // 타이틀로 복귀
            } else {
                this.scene.start('BattleScene');
            }
        });
    }
}