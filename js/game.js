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
    // ★ CommanderSelectScene이 추가된 최신 목록// game.js 의 scene 배열에 추가
scene: [ TitleScene, CommanderSelectScene, MapScene, BattleScene, ShopScene ]
};

const game = new Phaser.Game(config);