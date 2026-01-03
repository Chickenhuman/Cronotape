// js/managers/InteractionManager.js

class InteractionManager {
    constructor(scene) {
        this.scene = scene;
    }

    // ============================================================
    // 🖱️ 메인 입력 핸들러 (클릭 처리)
    // ============================================================
    handleMapClick(pointer) {
        if (this.scene.isPlaying) return;

        // [1] 클릭한 좌표를 그리드(타일) 좌표로 변환
        const tileX = Math.floor(pointer.x / this.scene.tileSize);
        const tileY = Math.floor(pointer.y / this.scene.tileSize);

        // [2] 에디터 모드 처리
        if (this.scene.isEditorMode) {
            if (this.scene.grid[tileY] && this.scene.grid[tileY][tileX] !== undefined) {
                // 0 -> 1 -> 2 -> 3 -> 0 순환
                let current = this.scene.grid[tileY][tileX];
                let nextVal = (current + 1) % 4; 
                
                this.scene.grid[tileY][tileX] = nextVal;
                this.scene.drawEditorGrid(); 
            }
            return; 
        }

        // [3] 카드 선택 여부 확인
        if (this.scene.cardManager.selectedCardIdx === -1) return;

        if (this.scene.cardManager.hand.length > MAX_HAND) {
            this.scene.showPopup("🚫 패가 너무 무겁습니다!", "...", null, false);
            return;
        }

        // 선택된 카드 정보 가져오기
        const cardStr = this.scene.cardManager.hand[this.scene.cardManager.selectedCardIdx];
        const [type, name] = cardStr.split('-');
        
        const stat = this.scene.getAdjustedStats(type, name);
        const traits = stat.traits || [];
        const hasInfiltrate = traits.includes('침투'); 

        // [4] 타일 유효성 검사 (규칙 체크)
        const tileVal = (this.scene.grid[tileY] && this.scene.grid[tileY][tileX] !== undefined) 
                        ? this.scene.grid[tileY][tileX] 
                        : 4; 

        if (tileVal === 4) {
             this.scene.showFloatingText(pointer.x, pointer.y, "전장을 벗어났습니다!", '#ff0000');
             return; 
        }

        if (type === 'Unit') {
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
        }

        // [5] 코스트 체크
        if (this.scene.playerCost < stat.cost) {
            this.scene.showFloatingText(pointer.x, pointer.y, "코스트 부족!", '#ff0000');
            return;
        }

        // [6] 배치 확정 프로세스
        const targetIdx = this.scene.cardManager.selectedCardIdx;

        // 매니저 상태 업데이트
        this.scene.cardManager.selectedCardIdx = -1; 
        this.drawDeploymentZones(false);
        
        this.scene.playerCost -= stat.cost;
        this.scene.updateCostUI();
        
        // 카드 사용 애니메이션 (CardManager 위임)
        this.scene.cardManager.animateCardUse(targetIdx);

        // 시간 확인
        const slider = document.getElementById('timeline-slider');
        let currentTime = 0;
        if (slider) currentTime = (slider.value / 100).toFixed(1);
        
// 마커 생성 (시각적 표시)
        const marker = this.scene.add.circle(pointer.x, pointer.y, 15, stat.color);
        marker.setAlpha(0.5);
        const text = this.scene.add.text(pointer.x-15, pointer.y-35, `${currentTime}s`, {fontSize:'10px', backgroundColor:'#000'});

        // ★ [수정] 미리 오프셋(위치 오차)을 계산하여 배열에 저장합니다.
        const offsets = [];
        const count = stat.count || 1;
        for(let i=0; i<count; i++) {
            if (i === 0) {
                offsets.push({x: 0, y: 0}); // 첫 번째 유닛은 정위치
            } else {
                // -20 ~ +20 범위의 랜덤 값을 미리 확정
                offsets.push({
                    x: Math.random() * 40 - 20,
                    y: Math.random() * 40 - 20
                });
            }
        }

        // 계획(Plan) 객체 생성 및 저장
        const plan = {
            type: type, name: name, x: pointer.x, y: pointer.y,
            time: parseFloat(currentTime), spawned: false,
            visualMarker: marker, visualText: text,
            offsets: offsets // ★ 저장된 오프셋을 plan에 포함
        };
        this.scene.deployedObjects.push(plan);

        // 마커 클릭 시 취소 기능 연결
        marker.setInteractive({ cursor: 'pointer' });
        marker.on('pointerdown', (ptr, localX, localY, event) => {
            if (this.scene.isPlaying || plan.spawned) return;
            // 카드를 선택 중일 때는 취소 동작을 막음 (오작동 방지)
            if (this.scene.cardManager.selectedCardIdx !== -1) return; 
            
            this.cancelDeployment(plan);
            if (event) event.stopPropagation();
        });
        
        // 고스트 시뮬레이션 갱신
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
        const [type, name] = cardStr.split('-');
        
        const stat = this.scene.getAdjustedStats(type, name);
        
        // 코스트 환불
        this.scene.playerCost += stat.cost;
        this.scene.updateCostUI();
        
        // 카드를 핸드로 복귀 (CardManager 이용)
        this.scene.cardManager.hand.push(cardStr);
        this.scene.cardManager.renderHand();

        // 시각적 요소 제거
        if (plan.visualMarker) plan.visualMarker.destroy();
        if (plan.visualText) plan.visualText.destroy();
        
        // 배열에서 제거
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