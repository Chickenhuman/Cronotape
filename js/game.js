// js/game.js
const CONFIG = {
    width: 1280,
    height: 720,
    cardWidth: 100,
    cardHeight: 140
};

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT, 
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: CONFIG.width,
        height: CONFIG.height
    },
    backgroundColor: '#000000',
    
    // ★ [수정] 물리 엔진(Arcade Physics) 설정 추가
    physics: {
        default: 'arcade',
        arcade: {
            debug: false, // 디버깅용 선을 보고 싶으면 true
            gravity: { y: 0 } // 탑뷰 게임이므로 중력 0
        }
    },

    // 씬 목록
    scene: [ TitleScene, CommanderSelectScene, MapScene, BattleScene, ShopScene ]
};

const game = new Phaser.Game(config);