// js/managers/DataManager.js

const DEFAULT_GAME_DATA = {
    gold: 100,
    currentHp: 1000,
    maxHp: 1000,
    deck: [], // 초기화 시 STARTER_DECK으로 채움
    artifacts: [],
    stage: 1,
    
    // 캠페인 데이터 (맵 시스템용)
    campaign: {
        nodes: [],          
        edges: [],          
        currentNodeId: 0,   
        deadlineX: -500,    
        bossNodeId: -1,
        mapWidth: 2000,     
        mapHeight: 600,
        clearedNodes: [],
        // ★ [추가] BattleScene에서 참조하는 변수 초기화
        currentDistance: 0 
    }
};

class DataManager {
    constructor() {
        this.loadData();
    }

    loadData() {
        const saved = localStorage.getItem('crono_save_v5');
        
        // 1. 항상 최신 기본 데이터를 먼저 로드 (깊은 복사)
        const baseData = JSON.parse(JSON.stringify(DEFAULT_GAME_DATA));

        if (saved) {
            try {
                const parsedSave = JSON.parse(saved);

                // 2. 저장된 데이터를 기본 데이터 위에 '안전하게 병합(Merge)'
                Object.assign(baseData, parsedSave);
                
                // 캠페인 데이터 별도 병합
                if (parsedSave.campaign) {
                    baseData.campaign = { 
                        ...JSON.parse(JSON.stringify(DEFAULT_GAME_DATA.campaign)), 
                        ...parsedSave.campaign 
                    };
                }

                // 최종 데이터를 this에 적용
                Object.assign(this, baseData);
                console.log("[DataManager] 저장된 데이터 로드 완료");

            } catch (e) {
                console.error("[DataManager] 세이브 파일 오류. 초기화합니다.", e);
                this.startNewGame();
            }
        } else {
            // 저장된 게 없으면 기본값 사용
            Object.assign(this, baseData);
            
            if (typeof STARTER_DECK !== 'undefined') {
                this.deck = [...STARTER_DECK];
            } else {
                this.deck = ['Unit-검사', 'Unit-궁수', 'Skill-화염구'];
            }
            this.generateNewMap(1); 
        }
    }

    saveData() {
        localStorage.setItem('crono_save_v5', JSON.stringify(this));
    }

    startNewGame() {
        localStorage.removeItem('crono_save_v5');
        
        // 기본 데이터로 리셋
        const baseData = JSON.parse(JSON.stringify(DEFAULT_GAME_DATA));
        Object.assign(this, baseData);
        
        if (typeof STARTER_DECK !== 'undefined') {
            this.deck = [...STARTER_DECK];
        } else {
            this.deck = ['Unit-검사', 'Unit-궁수', 'Skill-화염구'];
        }

        this.generateNewMap(1);
        this.saveData();
    }

    // ============================================================
    // 🛠️ 유틸리티 함수
    // ============================================================
    
    addArtifact(key) {
        if (!this.artifacts.includes(key)) {
            this.artifacts.push(key);
            this.saveData();
            console.log(`[DataManager] 유물 획득: ${key}`);
        }
    }

    addCard(cardName) {
        this.deck.push(cardName);
        this.saveData();
    }

    removeCard(index) {
        if (index >= 0 && index < this.deck.length) {
            this.deck.splice(index, 1);
            this.saveData();
        }
    }

    addGold(amount) {
        this.gold += amount;
        if (this.gold < 0) this.gold = 0;
        this.saveData();
    }

    // ============================================================
    // 🗺️ 맵 관리 및 이동
    // ============================================================
    generateNewMap(stage) {
        const nodes = [];
        const edges = [];
        const width = 1500 + (stage * 500); 
        const height = 500;
        const padding = 100;

        const startNode = { id: 0, x: 100, y: height / 2, type: 'START', connections: [] };
        nodes.push(startNode);

        const bossNode = { id: 1, x: width - 100, y: height / 2, type: 'BOSS', connections: [] };
        nodes.push(bossNode);

        const nodeCount = 15 + (stage * 3);
        
        for (let i = 0; i < nodeCount; i++) {
            let safe = false;
            let tx, ty;
            let attempts = 0;

            while (!safe && attempts < 100) {
                attempts++;
                tx = Phaser.Math.Between(250, width - 250);
                ty = Phaser.Math.Between(padding, height - padding);

                safe = true;
                for (let n of nodes) {
                    if (Phaser.Math.Distance.Between(n.x, n.y, tx, ty) < 120) {
                        safe = false;
                        break;
                    }
                }
            }

            if (safe) {
                const rand = Math.random();
                let type = 'BATTLE';
                if (rand < 0.15) type = 'ELITE';
                else if (rand < 0.3) type = 'EVENT';
                else if (rand < 0.45) type = 'SHOP';

                nodes.push({ id: nodes.length, x: tx, y: ty, type: type, connections: [] });
            }
        }

        nodes.sort((a, b) => a.x - b.x);
        nodes.forEach((n, idx) => n.id = idx);

        for (let i = 0; i < nodes.length - 1; i++) {
            const curr = nodes[i];
            const candidates = nodes.slice(i + 1)
                .sort((a, b) => Phaser.Math.Distance.Between(curr.x, curr.y, a.x, a.y) - Phaser.Math.Distance.Between(curr.x, curr.y, b.x, b.y))
                .slice(0, 3);
            
            if (candidates.length > 0) {
                const target = candidates[0]; 
                this.connectNodes(curr, target, edges);
            }
        }

        nodes.forEach(node => {
            nodes.forEach(other => {
                if (node === other) return;
                const dist = Phaser.Math.Distance.Between(node.x, node.y, other.x, other.y);
                
                if (dist < 350 && !node.connections.includes(other.id)) {
                    if (Math.random() < 0.3) { 
                        this.connectNodes(node, other, edges);
                    }
                }
            });
        });

        this.campaign = {
            nodes: nodes,
            edges: edges,
            currentNodeId: 0, 
            deadlineX: -300,  
            bossNodeId: nodes[nodes.length - 1].id,
            mapWidth: width,
            mapHeight: height,
            clearedNodes: [],
            currentDistance: 0 // 초기화
        };
        
// ★ [핵심] 맵 생성 직후, 적군 배정 규칙 실행
        this.assignEnemiesToMap(this.campaign.nodes, stage);

        this.saveData();
    }

// ★ [신규] 적군 배정 규칙 엔진 (소프트 코딩의 핵심)
    assignEnemiesToMap(nodes, stage) {
        // 1. 현재 스테이지에서 등장 가능한 적 풀(Pool) 필터링
        const pool = Object.entries(window.ENEMY_DATA_POOL || {});
        
        // 예: 스테이지 1이면 Tier 1 적들만 후보로 선정
        const candidates = {
            'NORMAL': pool.filter(([id, data]) => data.tier === stage && data.role === 'NORMAL'),
            'ELITE': pool.filter(([id, data]) => data.tier === stage && data.role === 'ELITE'),
            'BOSS': pool.filter(([id, data]) => data.tier === stage && data.role === 'BOSS')
        };

        // 2. 각 노드를 순회하며 적 배정
        nodes.forEach(node => {
            // 이미 배정되었거나 적이 없는 노드는 패스
            if (node.enemyId || ['START', 'SHOP', 'EVENT', 'EMPTY'].includes(node.type)) return;

            let targetPool = [];

            // [규칙 1] 노드 타입에 따른 기본 배정
            if (node.type === 'BOSS') {
                targetPool = candidates['BOSS'];
            } else if (node.type === 'ELITE') {
                targetPool = candidates['ELITE'];
            } else {
                targetPool = candidates['NORMAL'];
            }

            // [규칙 2] (예시) 맵의 절반 이상(후반부) 갔을 때는 더 강한 적 등장 확률 증가
            // if (node.x > this.campaign.mapWidth * 0.5 && Math.random() < 0.3) { ... }

            // 3. 풀에서 랜덤 선택하여 ID 저장
            if (targetPool.length > 0) {
                const pick = targetPool[Math.floor(Math.random() * targetPool.length)];
                node.enemyId = pick[0]; // ID 저장 (예: 'goblin_rookie')
            } else {
                // 후보가 없으면 기본값 (안전장치)
                node.enemyId = 'goblin_rookie'; 
            }
        });
    }

    connectNodes(n1, n2, edges) {
        if (n1.connections.includes(n2.id)) return;
        n1.connections.push(n2.id);
        n2.connections.push(n1.id);
        edges.push({ from: n1.id, to: n2.id });
    }

    moveToNode(targetId) {
        const curr = this.getNode(this.campaign.currentNodeId);
        const target = this.getNode(targetId);

        if (!curr || !target) return false;
        // if (!curr.connections.includes(targetId)) return false;

        const dist = Phaser.Math.Distance.Between(curr.x, curr.y, target.x, target.y);
        
        // 데드라인 전진
        const difficulty = 1.0 + (this.stage * 0.1); 
        const advance = dist * difficulty * 0.8; 
        
        this.campaign.deadlineX += advance;
        this.campaign.currentNodeId = targetId;
        
        // ★ [추가] 현재 플레이어의 거리 업데이트 (BattleScene UI용)
        this.campaign.currentDistance = Math.floor(target.x);

        this.saveData();
        return true;
    }

completeCurrentNode() {
        const currId = this.campaign.currentNodeId;
        
        // 이미 클리어한 노드가 아닐 경우에만 처리
        if (!this.campaign.clearedNodes.includes(currId)) {
            this.campaign.clearedNodes.push(currId);
            
            const node = this.getNode(currId);
            
            // [수정] EVENT, SHOP 등도 방문 후에는 재진입 불가(EMPTY) 처리
            // (상점은 전략에 따라 유지할 수도 있지만, 보통 로그라이크는 닫힙니다)
            if (node) {
                const clearableTypes = ['BATTLE', 'ELITE', 'EVENT', 'SHOP']; // SHOP 포함 여부는 선택
                
                if (clearableTypes.includes(node.type)) {
                    node.type = 'EMPTY'; 
                }
            }
            this.saveData();
        }
    }

    checkGameOver() {
        const playerNode = this.getNode(this.campaign.currentNodeId);
        return (playerNode.x <= this.campaign.deadlineX);
    }

    getNode(id) {
        return this.campaign.nodes.find(n => n.id === id);
    }
}

// ★ [핵심] window 객체에 할당하여 전역 접근 보장
window.GAME_DATA = new DataManager();