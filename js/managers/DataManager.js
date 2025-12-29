// js/managers/DataManager.js

class DataManager {
    constructor() {
        // [1] 전역 데이터 정의
        this.gold = 0;
        this.maxHp = 1000;          
        this.currentHp = 1000;      
        this.stage = 1;
        
        this.deck = [];
        this.artifacts = [];

        // ★ 캠페인 시스템 변수
        this.campaign = {
            currentDistance: 0,   // 현재 위치 (km)
            deadline: 0,          // ★ 수정: 0km부터 시작 (바로 뒤에서 쫓아옴)
            goalDistance: 100,    // 목표 (100km)
            stageMaxDist: 10,     // 최대 전진 거리 (10km)
            chaseSpeed: 5,        // 추격 속도 (5km)
            day: 1                
        };

        console.log("💾 DataManager 로드됨");
    }

    startNewGame() {
        this.gold = 100;
        this.currentHp = this.maxHp;
        this.stage = 1;
        this.artifacts = [];
        
        if (typeof STARTER_DECK !== 'undefined') {
            this.deck = [...STARTER_DECK];
        } else {
            this.deck = ['Unit-검사', 'Unit-검사', 'Unit-궁수', 'Skill-화염구', 'Unit-방벽'];
        }
        
        // 캠페인 초기화
        this.campaign = {
            currentDistance: 0,
            deadline: 0,          // 0km 시작
            goalDistance: 100,
            stageMaxDist: 10,
            chaseSpeed: 5,        // 5km
            day: 1
        };
        
        console.log("✨ 새 게임 데이터 초기화 완료");
    }
// 전진/후퇴 계산기
    advanceCampaign(enemyDamage, enemyMaxHp, myDamage, myMaxHp, isEnemyDestroyed) {
        let moveDist = 0;
        
        // ★ [데드라인 이동] 전투 결과 계산 전에 먼저 쫓아오게 하거나, 후에 쫓아오게 할 수 있음.
        // 여기서는 "전투가 끝났으니 시간이 흘러 데드라인이 다가옴" 처리
        this.campaign.deadline += this.campaign.chaseSpeed; 

        if (isEnemyDestroyed) {
            // [A] 적 기지 파괴: 무조건 최대 거리(10km) 전진
            moveDist = this.campaign.stageMaxDist;
        } else {
            // [B] 판정승 (비율 계산)
            const enemyLossRatio = enemyDamage / enemyMaxHp;
            const myLossRatio = myDamage / myMaxHp;
            
            // 적 손실이 더 크면 전진, 내가 더 크면 후퇴
            const diff = enemyLossRatio - myLossRatio;
            
            moveDist = Math.floor(diff * this.campaign.stageMaxDist);

            if (moveDist > this.campaign.stageMaxDist) moveDist = this.campaign.stageMaxDist;
            if (moveDist < -10) moveDist = -10;
        }

        // 거리 갱신
        this.campaign.currentDistance += moveDist;
        this.campaign.day++;

        console.log(`[결과] 이동: ${moveDist}km / 현재: ${this.campaign.currentDistance}km / 데드라인: ${this.campaign.deadline}km (추격됨)`);
        
        return moveDist;
    }

    isGameOver() {
        return (this.campaign.currentDistance <= this.campaign.deadline) || (this.currentHp <= 0);
    }

    isGameOver() {
        // 데드라인에 잡혔거나, 기지 체력이 0이면 끝
        return (this.campaign.currentDistance <= this.campaign.deadline) || (this.currentHp <= 0);
    }

    addGold(amount) {
        this.gold += amount;
        if (this.gold < 0) this.gold = 0;
    }

    addCard(cardName) { this.deck.push(cardName); }
    removeCard(index) { if (index >= 0 && index < this.deck.length) this.deck.splice(index, 1); }
    addArtifact(key) { if (!this.artifacts.includes(key)) this.artifacts.push(key); }
}

const GAME_DATA = new DataManager();