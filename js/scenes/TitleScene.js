class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        this.load.image('bg_title', 'assets/title_bg.png');
        // 양피지 버튼 이미지 (assets/ui/btn_parchment.png)
        this.load.image('ui_btn_start', 'assets/ui/btn_parchment.png'); 
    }

    create() {
        // -----------------------------------------------------------
        // ★ [1] HTML UI 숨기기 (타이틀 화면이니까)
        // -----------------------------------------------------------
        const topBar = document.getElementById('ui-top-bar');
        const bottomBar = document.getElementById('ui-bottom-bar');
        if (topBar) topBar.style.display = 'none';
        if (bottomBar) bottomBar.style.display = 'none';

        // -----------------------------------------------------------
        // [2] 배경 이미지
        // -----------------------------------------------------------
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'bg_title');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        
        // 배경 어둡게 (0.1 정도만)
        this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0x000000, 0.1);

        // -----------------------------------------------------------
        // ★ [3] 버튼 배치 (사이즈 축소 & 우측 이동)
        // -----------------------------------------------------------
        // 위치: 화면 중앙보다 오른쪽으로 350px 이동
        const btnX = (this.scale.width / 2) + 350; 
        
        // 높이: 화면의 55% 지점부터 시작
        const startY = this.scale.height * 0.55; 
        
        // 간격: 버튼 사이 간격 100px로 축소
        const gap = 100; 

        // 1. GAME START
    this.createButton(btnX, startY, 'GAME START', () => {
    // ★ 게임 시작 시 데이터 초기화 (새 게임)
    if (typeof GAME_DATA !== 'undefined') {
        GAME_DATA.startNewGame(); 
    }
    this.scene.start('CommanderSelectScene');
});

        // 2. SETTING
        this.createButton(btnX, startY + gap, 'SETTING', () => {
            alert("설정 기능은 준비 중입니다!");
        });

        // 3. EXIT
        this.createButton(btnX, startY + gap * 2, 'EXIT', () => {
            if(confirm("게임을 종료하시겠습니까?")) {
                window.close();
                alert("게임 종료 (창을 닫아주세요)");
            }
        });
    }

    // 버튼 생성 도우미 함수
    createButton(x, y, text, callback) {
        const btnContainer = this.add.container(x, y);

        // 1. 배경 이미지
        const btnBg = this.add.image(0, 0, 'ui_btn_start');
        
        // ★ 사이즈 축소: 기존 400x120 -> 300x90
        btnBg.setDisplaySize(300, 90); 

        // 2. 텍스트
        const btnText = this.add.text(0, 0, text, { 
            fontSize: '24px', // 글자 크기도 약간 줄임 (32->24)
            fontFamily: 'serif', 
            color: '#3e2723', 
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 3. 컨테이너 담기
        btnContainer.add([btnBg, btnText]);

        // 4. 인터랙션 영역도 이미지 크기에 맞춤
        btnContainer.setSize(300, 90);
        btnContainer.setInteractive({ cursor: 'pointer' });

        // 호버 효과
        btnContainer.on('pointerover', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.05, duration: 100 });
            btnText.setColor('#8d6e63'); 
        });

        btnContainer.on('pointerout', () => {
            this.tweens.add({ targets: btnContainer, scale: 1.0, duration: 100 });
            btnText.setColor('#3e2723');
        });

        // 클릭 효과
        btnContainer.on('pointerdown', () => {
            this.tweens.add({ 
                targets: btnContainer, scale: 0.95, duration: 50, yoyo: true,
                onComplete: callback
            });
        });
    }
}