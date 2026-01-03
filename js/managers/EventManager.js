// js/managers/EventManager.js

class EventManager {
    static playRandomEvent(scene) {
        // 1. 조건(req)이 맞는 이벤트만 필터링
        // window.GAME_EVENTS가 로드되었는지 확인
        if (!window.GAME_EVENTS) {
            console.error("이벤트 데이터(EventData.js)가 로드되지 않았습니다.");
            GAME_DATA.completeCurrentNode();
            return;
        }

        const validEvents = window.GAME_EVENTS.filter(evt => {
            if (!evt.req) return true; 
            return evt.req(GAME_DATA);
        });

        if (validEvents.length === 0) {
            alert("조용한 길입니다. (조건을 만족하는 이벤트 없음)");
            GAME_DATA.completeCurrentNode();
            return;
        }

        // 2. 랜덤 선택
        const event = validEvents[Math.floor(Math.random() * validEvents.length)];
        
        // 3. UI 표시
        this.showEventPopup(scene, event);
    }

    static showEventPopup(scene, event) {
        let popup = document.getElementById('event-popup');
        // 팝업 DOM이 없으면 생성 (안전장치)
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'event-popup';
            popup.className = 'ui-overlay'; 
            popup.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); z-index: 5000;
                display: flex; justify-content: center; align-items: center;
            `;
            document.body.appendChild(popup);
        }

        // 선택지 버튼 생성
        let choicesHtml = '';
        event.choices.forEach((choice, index) => {
            // 선택 가능 여부 확인
            const isAvailable = choice.req ? choice.req(GAME_DATA) : true;
            
            const btnStyle = isAvailable 
                ? 'background:#333; color:#fff; border:1px solid #aaa; cursor:pointer;' 
                : 'background:#222; color:#555; border:1px solid #333; cursor:not-allowed;';
            
            // 클릭 이벤트: 가능할 때만 함수 호출
            const clickAction = isAvailable ? `EventManager.selectChoice(${index})` : '';
            
            choicesHtml += `
                <div onclick="${clickAction}" style="
                    padding: 15px; margin: 10px 0; text-align: left; font-size: 16px;
                    transition: 0.2s; ${btnStyle}
                " onmouseover="if('${isAvailable}'=='true') this.style.background='#444'" 
                  onmouseout="if('${isAvailable}'=='true') this.style.background='#333'">
                    ${choice.text}
                </div>
            `;
        });

        // 팝업 내용 구성
        popup.innerHTML = `
            <div class="popup-box" style="width: 500px; max-width: 90%; background: #111; padding: 30px; border: 2px solid #555;">
                <h2 style="color: #ffcc00; margin-top: 0; border-bottom: 1px solid #555; padding-bottom: 10px;">${event.title}</h2>
                <div style="min-height: 100px; color: #ddd; margin: 20px 0; font-size: 18px; line-height: 1.6;">
                    ${event.desc.replace(/\n/g, '<br>')}
                </div>
                <div id="event-choices">
                    ${choicesHtml}
                </div>
            </div>
        `;
        
        // 현재 실행 중인 정보를 저장 (static 변수 활용)
        this.currentEvent = event;
        this.currentScene = scene;
        popup.style.display = 'flex';
    }

    static selectChoice(index) {
        const choice = this.currentEvent.choices[index];
        
        // 효과 실행 (결과 텍스트 반환)
        const resultMsg = choice.effect(this.currentScene, GAME_DATA);
        
        // 결과 화면으로 전환
        const popup = document.getElementById('event-popup');
        popup.innerHTML = `
            <div class="popup-box" style="width: 400px; text-align: center; background: #111; border: 2px solid #555; padding: 30px;">
                <h3 style="color: #00ff00; margin-bottom: 20px;">결과</h3>
                <p style="color: #fff; font-size: 18px; margin-bottom: 30px; line-height: 1.5;">${resultMsg.replace(/\n/g, '<br>')}</p>
                <button onclick="EventManager.closeEvent()" style="padding: 10px 30px; font-size: 16px; background: #2980b9; color: white; border: none; cursor: pointer;">확인</button>
            </div>
        `;
        
        // 노드 클리어 처리 및 데이터 저장
        GAME_DATA.completeCurrentNode();
        
        // UI 갱신 (체력바 등 변화 반영)
        if (this.currentScene && this.currentScene.updateUI) {
            this.currentScene.updateUI();
        }
    }

    static closeEvent() {
        const popup = document.getElementById('event-popup');
        if (popup) {
            popup.style.display = 'none';
            popup.innerHTML = ''; // 내용 비우기
        }
    }
}

// 전역 할당
window.EventManager = EventManager;