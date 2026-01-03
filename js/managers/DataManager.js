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
        // ★ [추가] 클리어한 노드 목록 저장
        clearedNodes: []
    }
};

class DataManager {
    constructor() {
        this.loadData();
    }

    loadData() {
        const saved = localStorage.getItem('crono_save_v5'); // 버전 v5로 변경 (데이터 구조 변경 반영)
        if (saved) {
            Object.assign(this, JSON.parse(saved));
        } else {
            Object.assign(this, JSON.parse(JSON.stringify(DEFAULT_GAME_DATA)));
            
            // 덱 초기화 (하드코딩 제거)
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
        Object.assign(this, JSON.parse(JSON.stringify(DEFAULT_GAME_DATA)));
        
        if (typeof STARTER_DECK !== 'undefined') {
            this.deck = [...STARTER_DECK];
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
            clearedNodes: [] // ★ 초기화
        };
        
        this.saveData();
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
        if (!curr.connections.includes(targetId)) return false;

        const dist = Phaser.Math.Distance.Between(curr.x, curr.y, target.x, target.y);
        
        // (데드라인 압박 공식: 기본 유지)
        const difficulty = 1.0 + (this.stage * 0.1); 
        const advance = dist * difficulty * 0.8; 
        
        this.campaign.deadlineX += advance;
        this.campaign.currentNodeId = targetId;

        this.saveData();
        return true;
    }

    // ★ [추가] 현재 노드 클리어 처리 함수
    completeCurrentNode() {
        const currId = this.campaign.currentNodeId;
        
        // 이미 클리어된 노드가 아니라면 목록에 추가
        if (!this.campaign.clearedNodes.includes(currId)) {
            this.campaign.clearedNodes.push(currId);
            
            // 해당 노드 객체를 찾아서 타입 변경 (다음에 방문 시 전투 안 걸리게)
            const node = this.getNode(currId);
            if (node) {
                // 원래 타입이 무엇이었든 EMPTY(빈 땅) 혹은 VISITED로 변경
                // 단, SHOP이나 BOSS 등은 유지하고 싶다면 조건문 추가 가능. 
                // 여기서는 전투 노드만 없애는 것으로 가정
                if (node.type === 'BATTLE' || node.type === 'ELITE') {
                    node.type = 'EMPTY'; 
                }
            }
            
            this.saveData();
            console.log(`[DataManager] 노드 ${currId} 클리어 완료.`);
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

const GAME_DATA = new DataManager();