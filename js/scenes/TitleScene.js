class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');

        this.add.text(400, 200, 'CHRONO TAPE', { 
            fontSize: '64px', fontFamily: 'Impact', color: '#00ffcc', stroke: '#ffffff', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(400, 280, '- Time Strategy Roguelike -', { 
            fontSize: '24px', color: '#aaaaaa' 
        }).setOrigin(0.5);

        const startBtn = this.add.text(400, 400, '[ GAME START ]', { 
            fontSize: '32px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

        startBtn.on('pointerover', () => startBtn.setStyle({ fill: '#ffcc00' }));
        startBtn.on('pointerout', () => startBtn.setStyle({ fill: '#ffffff' }));
        startBtn.on('pointerdown', () => this.scene.start('MapScene')); // 맵으로 이동
    }
}