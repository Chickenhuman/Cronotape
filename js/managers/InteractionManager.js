// js/managers/InteractionManager.js

class InteractionManager {
    constructor(scene) {
        this.scene = scene;
    }

   // ============================================================\
    // 🖱️ 메인 입력 핸들러 (클릭 처리)
    // ============================================================\
    handleMapClick(pointer) {
        if (this.scene.isPlaying) return;

        // [1] 클릭한 좌표를 그리드(타일) 좌표로 변환
        const tileX = Math.floor(pointer.x / this.scene.tileSize);
        const tileY = Math.floor(pointer.y / this.scene.tileSize);

        // [2] 에디터 모드 처리
        if (this.scene.isEditorMode) {
            if (this.scene.grid[tileY] && this.scene.grid[tileY][tileX] !== undefined) {
                let current = this.scene.grid[tileY][tileX];
                let nextVal = (current + 1) % 4; 
                this.scene.grid[tileY][tileX] = nextVal;
                this.scene.drawEditorGrid(); 
            }
            return; 
        }

        // [3] 카드 선택 여부 확인
        if (this.scene.cardManager.selectedCardIdx === -1) return;

        // 선택된 카드 정보 가져오기
        const cardStr = this.scene.cardManager.hand[this.scene.cardManager.selectedCardIdx];
        const [type, name] = cardStr.split('-'); 

        if (type !== 'Unit') return; // 유닛만 배치 가능

        const stat = UNIT_STATS[name];

        // [4] 배치 가능 구역 체크 (아군 영토만 가능)
        if (tileX < 0 || tileX >= this.scene.mapWidth || tileY < 0 || tileY >= this.scene.mapHeight) return;
        const tileVal = this.scene.grid[tileY][tileX];
        const hasInfiltrate = stat.traits && stat.traits.includes("Infiltrate"); // 잠입 특성 확인

        if (tileVal === 1) {
            this.scene.showFloatingText(pointer.x, pointer.y, "배치 불가 지형!", '#ff0000');
            return; 
        }
        if (tileVal === 3) {
            this.scene.showFloatingText(pointer.x, pointer.y, "적 감시 구역! (배치 불가)", '#ff0000');
            return; 
        }
        if (tileVal !== 2 && !hasInfiltrate) {
            this.scene.showFloatingText(pointer.x, pointer.y, "아군 지역이 아닙니다.", '#ff0000');
            return;
        }

        // [5] 코스트 체크 (실시간 할인 적용)
        // ★ getRealTimeCost가 있으면 쓰고, 없으면 기본 stat.cost 사용 (안전장치)
const realCost = this.scene.getRealTimeCost ? this.scene.getRealTimeCost(name) : stat.cost;

        if (this.scene.playerCost < realCost) {
            this.scene.showFloatingText(pointer.x, pointer.y, "코스트 부족!", '#ff0000');
            return;
        }

// ★ [핵심 수정 2] targetIdx 중복 선언 오류 해결 (const 제거하거나 여기서 최초 선언)
        const targetIdx = this.scene.cardManager.selectedCardIdx;
        this.scene.cardManager.selectedCardIdx = -1; 
        
        this.drawDeploymentZones(false);
        
// ★ [핵심 수정 3] 실제 할인된 가격만큼 차감
        this.scene.playerCost -= realCost;
        this.scene.updateCostUI();
        
        this.scene.cardManager.animateCardUse(targetIdx);

        // 시간 확인 (슬라이더)
        const slider = document.getElementById('timeline-slider');
        let currentTime = 0;
        if (slider) currentTime = (slider.value / 100).toFixed(1);
        
        // 마커 생성 (시각적 표시)
        const marker = this.scene.add.circle(pointer.x, pointer.y, 15, stat.color);
        marker.setAlpha(0.5);
        
        // 유닛 오프셋 계산 (물량 유닛 처리)
        const offsets = [];
        const count = stat.count || 1;
        for(let i=0; i<count; i++) {
            if (i === 0) {
                offsets.push({x: 0, y: 0});
            } else {
                offsets.push({
                    x: (Math.random() - 0.5) * 30,
                    y: (Math.random() - 0.5) * 30
                });
            }
        }

        // 계획(Plan) 객체 생성 및 저장
        const plan = {
            type: type, name: name, x: pointer.x, y: pointer.y,
            time: parseFloat(currentTime), spawned: false,
            visualMarker: marker,
            offsets: offsets,
            paidCost: realCost // ★ 지불한 가격 저장 (환불용)
        };
        
        this.scene.deployedObjects.push(plan);
        
        // 고스트 시뮬레이션 업데이트
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