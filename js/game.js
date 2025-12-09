// js/game.js (최종 관리자 파일)

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 800,
    height: 450,
    backgroundColor: '#1a1a1a',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // ★ 여기서 씬들을 순서대로 불러옵니다.
    // TitleScene이 맨 앞에 있으니 게임 켜면 타이틀부터 나옵니다.
    scene: [ TitleScene, MapScene, BattleScene ]
};

const game = new Phaser.Game(config);