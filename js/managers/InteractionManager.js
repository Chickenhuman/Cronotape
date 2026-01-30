// js/managers/InteractionManager.js

class InteractionManager {
    constructor(scene) {
        this.scene = scene;
    }

// ============================================================
    // 🖱️ 메인 입력 핸들러 (클릭 처리) - [수정됨]
    // ============================================================
    handleMapClick(pointer) {
        if (this.scene.isPlaying) return;

        const tileX = Math.floor(pointer.x / this.scene.tileSize);
        const tileY = Math.floor(pointer.y / this.scene.tileSize);

        // [에디터 모드]
        if (this.scene.isEditorMode) {
            if (this.scene.grid[tileY] && this.scene.grid[tileY][tileX] !== undefined) {
                let current = this.scene.grid[tileY][tileX];
                this.scene.grid[tileY][tileX] = (current + 1) % 4; 
                this.scene.drawEditorGrid(); 
            }
            return; 
        }

        // [카드 사용]
        if (this.scene.cardManager.selectedCardIdx === -1) return;

        const cardStr = this.scene.cardManager.hand[this.scene.cardManager.selectedCardIdx];
        const [type, name] = cardStr.split('-'); 

        if (type !== 'Unit') return; 

        const stat = UNIT_STATS[name];
        
        // 배치 조건 체크
        if (tileX < 0 || tileX >= this.scene.mapWidth || tileY < 0 || tileY >= this.scene.mapHeight) return;
        const tileVal = this.scene.grid[tileY][tileX];
        const hasInfiltrate = stat.traits && stat.traits.includes("Infiltrate");

        if (tileVal === 1) return this.scene.showFloatingText(pointer.x, pointer.y, "배치 불가 지형!", '#ff0000');
        if (tileVal === 3) return this.scene.showFloatingText(pointer.x, pointer.y, "적 감시 구역!", '#ff0000');
        if (tileVal !== 2 && !hasInfiltrate) return this.scene.showFloatingText(pointer.x, pointer.y, "아군 지역 아님", '#ff0000');

        // 코스트 체크
        const realCost = this.scene.getRealTimeCost ? this.scene.getRealTimeCost(name) : stat.cost;
        if (this.scene.playerCost < realCost) return this.scene.showFloatingText(pointer.x, pointer.y, "코스트 부족!", '#ff0000');

        // 결제 및 카드 소모
        const targetIdx = this.scene.cardManager.selectedCardIdx;
        this.scene.cardManager.selectedCardIdx = -1; 
        this.drawDeploymentZones(false);
        this.scene.playerCost -= realCost;
        this.scene.updateCostUI();
        this.scene.cardManager.animateCardUse(targetIdx);

        // 시간 확인
        const slider = document.getElementById('timeline-slider');
        const currentTime = slider ? (slider.value / 100).toFixed(1) : 0;
        
        // 마커 생성
        const marker = this.scene.add.circle(pointer.x, pointer.y, 15, stat.color || 0x00ff00);
        marker.setAlpha(0.5);
        
        // ★ [핵심 수정] GameLogic의 공용 함수 사용 (하드코딩 제거됨)
        const offsets = GameLogic.getSpawnOffsets(stat.count || 1, 30);

        // 계획 저장
        const plan = {
            type: type, name: name, x: pointer.x, y: pointer.y,
            time: parseFloat(currentTime), spawned: false,
            visualMarker: marker,
            offsets: offsets,
            paidCost: realCost 
        };
        
        this.scene.deployedObjects.push(plan);
        this.scene.updateGhostSimulation();
    }

    // ============================================================
    // 🟩 배치 가능 구역 표시 (초록색 타일)
    // ============================================================
    drawDeploymentZones(shouldDraw) {
        this.scene.fieldGraphics.clear();
        this.scene.fieldGraphics.setVisible(false);

        // 에디터 모드, 플레이 중, 드로우 끄기 요청, 카드 미선택 시 중단
        if (this.scene.isEditorMode || this.scene.isPlaying || !shouldDraw || this.scene.cardManager.selectedCardIdx === -1) {
            return;
        }

        const cardStr = this.scene.cardManager.hand[this.scene.cardManager.selectedCardIdx];
        if (!cardStr) return; 

        const [type, name] = cardStr.split('-');
        if (type !== 'Unit') return; // 스킬은 표시 안 함 (어디든 되니까)

        const stats = this.scene.getAdjustedStats(type, name);
        const hasInfiltrate = stats.traits && stats.traits.includes('침투');

        this.scene.fieldGraphics.setVisible(true);
        this.scene.fieldGraphics.fillStyle(0x00ff00, 0.3); 

        for (let y = 0; y < this.scene.mapHeight; y++) {
            for (let x = 0; x < this.scene.mapWidth; x++) {
                const tileVal = (this.scene.grid[y] && this.scene.grid[y][x] !== undefined) ? this.scene.grid[y][x] : 1;
                let isDrawable = false;
                
                // 침투 유닛 vs 일반 유닛 규칙
                if (hasInfiltrate) {
                    if (tileVal !== 1 && tileVal !== 3 && tileVal !== 4) isDrawable = true;
                } else {
                    if (tileVal === 2) isDrawable = true;
                }

                if (isDrawable) {
                    this.scene.fieldGraphics.fillRect(
                        x * this.scene.tileSize, y * this.scene.tileSize, this.scene.tileSize, this.scene.tileSize
                    );
                }
            }
        }
    }

    // ============================================================
    // ↩️ 배치 취소
    // ============================================================
cancelDeployment(plan) {
        if (this.scene.isPlaying) return; 
        
        const cardStr = `${plan.type}-${plan.name}`;
        
        // ★ [핵심 수정] 기록해둔 paidCost가 있으면 그걸 돌려주고, 없으면 기본값
        const refundAmount = (plan.paidCost !== undefined) ? plan.paidCost : UNIT_STATS[plan.name].cost;
        
        this.scene.playerCost += refundAmount;
        this.scene.updateCostUI();
        
        // (나머지 복귀 로직 유지)
        this.scene.cardManager.hand.push(cardStr);
        this.scene.cardManager.renderHand();

        if (plan.visualMarker) plan.visualMarker.destroy();
        if (plan.visualText) plan.visualText.destroy();
        
        const index = this.scene.deployedObjects.indexOf(plan);
        if (index > -1) this.scene.deployedObjects.splice(index, 1);
        
        this.scene.updateGhostSimulation();
    }

    // ============================================================
    // 🔄 전체 배치 초기화 (Reset 버튼용)
    // ============================================================
    resetAllPlans() {
        if (this.scene.isPlaying || this.scene.deployedObjects.length === 0) return;
        
        this.scene.showPopup(
            "배치 초기화",
            "이번 라운드의 모든 배치를\n취소하시겠습니까?",
            () => {
                for (let i = this.scene.deployedObjects.length - 1; i >= 0; i--) {
                    this.cancelDeployment(this.scene.deployedObjects[i]);
                }
                this.scene.predictionGraphics.clear();
            },
            true
        );
    }
}