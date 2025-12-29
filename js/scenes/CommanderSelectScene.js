class CommanderSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CommanderSelectScene' });
    }

    preload() {
        // [1] 배경
        this.load.image('bg_select', 'assets/title_bg.png');
        
        // [2] 지휘관 초상화 로드 (폴더: assets/commanders/)
        // ★ 중요: data.js의 image: 'cmd_knight'와 키값이 일치해야 함
        this.load.image('cmd_knight', 'assets/commanders/cmd_knight.png');
        
        // (나중에 파일 만들면 주석 해제)
         this.load.image('cmd_mage', 'assets/commanders/cmd_mage.png'); 
        // this.load.image('cmd_artillery', 'assets/commanders/artillery.png');
        
        // [3] 에러 방지용 기본 이미지
        this.load.image('noimg', 'assets/noimg.png'); 
    }

    create() {
        // 배경
        const bg = this.add.image(this.scale.width/2, this.scale.height/2, 'bg_select');
        bg.setDisplaySize(this.scale.width, this.scale.height);
        this.add.rectangle(this.scale.width/2, this.scale.height/2, this.scale.width, this.scale.height, 0x000000, 0.7);

        // 제목
        this.add.text(this.scale.width/2, 80, 'Choose Your Commander', {
            fontSize: '48px', fontFamily: 'serif', color: '#ffcc00', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 지휘관 목록 생성
        const keys = Object.keys(COMMANDERS);
        const startX = this.scale.width / 2 - ((keys.length - 1) * 240) / 2; 
        const centerY = this.scale.height / 2;

        keys.forEach((key, index) => {
            const data = COMMANDERS[key];
            const x = startX + (index * 240); 
            
            this.createCommanderCard(x, centerY, key, data);
        });
    }

 // js/scenes/CommanderSelectScene.js 내부 createCommanderCard 함수 수정

    createCommanderCard(x, y, key, data) {
        const container = this.add.container(x, y);

        // 카드 배경
        const cardBg = this.add.rectangle(0, 0, 200, 320, 0x333333);
        cardBg.setStrokeStyle(4, data.color);

        // 이름
        const nameText = this.add.text(0, -130, data.name, {
            fontSize: '24px', fontStyle: 'bold', color: '#ffffff'
        }).setOrigin(0.5);

        // 초상화
        let portrait;
        if (data.image && this.textures.exists(data.image)) {
            portrait = this.add.image(0, -40, data.image);
        } else {
            portrait = this.add.image(0, -40, 'noimg');
        }
        portrait.setDisplaySize(120, 120);
        
        // 초상화 테두리
        const portraitBorder = this.add.rectangle(0, -40, 124, 124);
        portraitBorder.setStrokeStyle(2, data.color);

        // ★ [추가] 체력 표시 (초상화 바로 아래)
        const hpText = this.add.text(0, 35, `❤️ HP: ${data.hp}`, {
            fontSize: '16px', color: '#ff8888', fontStyle: 'bold'
        }).setOrigin(0.5);

        // 설명 (위치 살짝 조정 y: 50 -> 80)
        const descText = this.add.text(0, 80, data.desc, {
            fontSize: '14px', color: '#cccccc', align: 'center', wordWrap: { width: 180 }
        }).setOrigin(0.5);

        // 선택 버튼
        const btn = this.add.rectangle(0, 130, 160, 40, 0x555555);
        const btnText = this.add.text(0, 130, 'SELECT', { fontSize: '18px', color: '#fff' }).setOrigin(0.5);

        // 컨테이너에 hpText 추가하는 것 잊지 마세요!
        container.add([cardBg, nameText, portrait, portraitBorder, hpText, descText, btn, btnText]);

        // 버튼 클릭 이벤트
        btn.setInteractive({ cursor: 'pointer' })
            .on('pointerover', () => btn.setFillStyle(0x777777))
            .on('pointerout', () => btn.setFillStyle(0x555555))
            .on('pointerdown', () => {
                selectedCommander = key; 
                this.scene.start('BattleScene');
            });
    }
}