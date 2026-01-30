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
    
    // 물리 엔진(Arcade Physics) 설정
    physics: {
        default: 'arcade',
        arcade: {
            debug: false, // 디버깅용 선을 보고 싶으면 true
            gravity: { y: 0 } // 탑뷰 게임이므로 중력 0
        }
    },

    // ★ [핵심 변경] LoadingScene을 배열의 '가장 앞(0번 인덱스)'에 넣어야 합니다.
    // 순서: 로딩 -> 타이틀 -> 지휘관 선택 -> 맵 -> 전투 -> 상점
    scene: [ LoadingScene, TitleScene, CommanderSelectScene, MapScene, BattleScene, ShopScene ]
};

const game = new Phaser.Game(config);