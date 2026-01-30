// js/scenes/TitleScene.js

class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        this.load.image('bg_title', 'assets/title_bg.png');
        this.load.image('ui_btn_start', 'assets/ui/btn_parchment.png'); 
    }

    create() {
        // [1] HTML UI 숨기기
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        const line = document.getElementById('outfield-line');
// ★ [추가] 유물 UI도 확실하게 숨김
        const artifactContainer = document.getElementById('artifact-container');
        if (topBar) topBar.style.display = 'none';
        if (bottomBar) bottomBar.style.display = 'none';
        if (line) line.style.display = 'none'; 

        // [2] 배경
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg_title');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0x000000, 0.3);

        // [3] 버튼
        const btnX = (this.scale.width / 2) + 350; 
        const startY = this.scale.height * 0.55; 
        const gap = 100; 

        this.createButton(btnX, startY, 'GAME START', () => {
            if (typeof GAME_DATA !== 'undefined') GAME_DATA.startNewGame(); 
            this.scene.start('CommanderSelectScene');
        });

        this.createButton(btnX, startY + gap, 'SETTING', () => {
            alert("설정 기능은 준비 중입니다!");
        });

        this.createButton(btnX, startY + gap * 2, 'EXIT', () => {
            if(confirm("게임을 종료하시겠습니까?")) {
                window.close();
                alert("게임 종료 (창을 닫아주세요)");
            }
        });
    }

    createButton(x, y, text, callback) {
        const btnContainer = this.add.container(x, y);
        const btnBg = this.add.image(0, 0, 'ui_btn_start');
        btnBg.setDisplaySize(300, 90); 

        const btnText = this.add.text(0, 0, text, { 
            fontSize: '24px', fontFamily: 'serif', color: '#3e2723', fontStyle: 'bold'
        }).setOrigin(0.5);

        btnContainer.add([btnBg, btnText]);
        btnContainer.setSize(300, 90);
        btnContainer.setInteractive({ cursor: 'pointer' });

        btnContainer.on('pointerover', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.05, duration: 100 });
            btnText.setColor('#8d6e63'); 
        });
        btnContainer.on('pointerout', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.0, duration: 100 });
            btnText.setColor('#3e2723');
        });
        btnContainer.on('pointerdown', () => {
            this.tweens.add({ 
                targets: btnContainer, scale: 0.95, duration: 50, yoyo: true,
                onComplete: callback
            });
        });
    }
}