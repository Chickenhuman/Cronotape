class MapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MapScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#222222');
        this.add.text(400, 50, 'World Map', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
        
        // 지도 경로 그리기
        const graphics = this.add.graphics();
        graphics.lineStyle(4, 0x666666);
        graphics.lineBetween(400, 350, 400, 250);
        graphics.lineBetween(400, 250, 400, 150);

        // 스테이지 노드 생성
        this.createNode(400, 350, 1, 'Start');
        this.createNode(400, 250, 2, 'Battle');
        this.createNode(400, 150, 3, 'Boss');
        
        // HTML UI 숨기기 (전투 화면에서만 보이게)
        const uiPanel = document.getElementById('ui-panel');
        if (uiPanel) uiPanel.style.display = 'none';
    }

    createNode(x, y, stageNum, label) {
        let color = 0x666666;
        let isInteractive = false;

        if (stageNum < currentStage) color = 0x00ff00; // 클리어
        else if (stageNum === currentStage) { color = 0xffcc00; isInteractive = true; } // 현재

        const circle = this.add.circle(x, y, 30, color);
        this.add.text(x, y, stageNum, { fontSize: '20px', color: '#000', fontStyle:'bold' }).setOrigin(0.5);
        this.add.text(x + 40, y, label, { fontSize: '16px', color: '#fff' }).setOrigin(0, 0.5);

        if (isInteractive) {
            circle.setInteractive({ cursor: 'pointer' });
            this.tweens.add({ targets: circle, scale: 1.2, duration: 600, yoyo: true, repeat: -1 });
            circle.on('pointerdown', () => this.scene.start('BattleScene')); // 전투 시작
        }
    }
}