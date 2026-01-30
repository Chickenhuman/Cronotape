// js/scenes/LoadingScene.js

class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
    }

    preload() {
        // 배경색 설정 (검정)
        this.cameras.main.setBackgroundColor('#000000');

        // 로딩 텍스트 표시
        this.loadingText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Loading Assets...',
            { font: '30px Arial', fill: '#ffffff' }
        ).setOrigin(0.5);
    }

    create() {
        // SVGManager 인스턴스 생성
        this.svgManager = new SVGManager(this);

        // 모든 텍스처 미리 굽기 시작
        // 완료되면 콜백 함수가 실행되어 다음 씬으로 이동
        this.svgManager.prebakeAllTextures(() => {
            this.loadingText.setText('Complete!');
            
            // 잠시 후 타이틀 화면으로 이동 (바로 이동해도 됨)
            this.time.delayedCall(500, () => {
                this.scene.start('TitleScene'); 
                // 만약 바로 전투 테스트 중이라면 'BattleScene'으로 변경 가능
            });
        });
    }
}