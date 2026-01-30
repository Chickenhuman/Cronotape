// js/managers/SVGManager.js

class SVGManager {
    constructor(scene) {
        this.scene = scene;
        // 중복 로딩 방지용 (이미 로딩 중인 키 저장)
        this.pendingKeys = new Set();
    }

    /**
     * 모든 텍스처를 미리 생성하고, 완료되면 onComplete 콜백을 실행합니다.
     */
    prebakeAllTextures(onComplete) {
        console.log("🚀 [SVGManager V3.0] 텍스처 프리베이킹 시스템 가동..."); 

        let tasks = [];

        try {
            // 1. 유닛 텍스처 목록 수집
            if (typeof UNIT_STATS !== 'undefined') {
                for (const [name, stats] of Object.entries(UNIT_STATS)) {
                    if (!stats) continue; // 데이터가 비었으면 패스
                    const defaultParts = { body: 'body_knight', weapon: 'weapon_sword', acc: 'acc_shield' };
                    const partConfig = { ...defaultParts, ...(stats.parts || {}) };
                    
                    tasks.push({ type: 'unit', name, team: 'ALLY', config: partConfig });
                    tasks.push({ type: 'unit', name, team: 'ENEMY', config: partConfig });
                }
            } else {
                console.warn("⚠️ [SVGManager] UNIT_STATS 데이터가 없습니다.");
            }

            // 2. 기지(Base) 및 기타 SVG 목록 수집
            if (typeof SVG_DATA !== 'undefined') {
                for (const key in SVG_DATA) {
                    if (key.startsWith('base_')) {
                        // 기지는 팀별 색상이 중요하므로 ALLY/ENEMY 키로 각각 생성 요청
                        // (getSVGString 내부에서 'ALLY'를 받으면 파란색 코드로 변환됨)
                        tasks.push({ type: 'raw', key: key, param: null });
                        tasks.push({ type: 'raw', key: `${key}_ALLY`, param: 'ALLY' });
                        tasks.push({ type: 'raw', key: `${key}_ENEMY`, param: 'ENEMY' });
                    }
                }
            } else {
                console.error("❌ [SVGManager] SVG_DATA를 찾을 수 없습니다! (js/data/SVGData.js 로드 확인 필요)");
            }

        } catch (err) {
            console.error("🔥 [SVGManager] 목록 수집 중 치명적 에러:", err);
            if (onComplete) onComplete(); // 에러 나도 게임은 시작시킴
            return;
        }

        // 3. 실행 및 감시
        let totalTasks = tasks.length;
        let loadedCount = 0;

        console.log(`📋 [SVGManager] 생성 목표: 총 ${totalTasks}개 텍스처`);

        // [안전장치 1] 할 일이 없으면 즉시 통과
        if (totalTasks === 0) {
            console.warn("⚠️ [SVGManager] 생성할 텍스처가 0개입니다. 즉시 완료 처리합니다.");
            if (onComplete) onComplete();
            return;
        }

        // [안전장치 2] 전체 타임아웃 (3초 뒤 강제 시작)
        const globalWatchdog = setTimeout(() => {
            console.warn(`🚨 [SVGManager] 전체 로딩 시간 초과! 강제 진입합니다. (진행률: ${loadedCount}/${totalTasks})`);
            if (onComplete) onComplete();
        }, 3000);

        // 진행 체크 함수
        const checkDone = () => {
            loadedCount++;
            if (loadedCount >= totalTasks) {
                console.log("✅ [SVGManager] 모든 텍스처 생성 완료!");
                clearTimeout(globalWatchdog);
                if (onComplete) onComplete();
            }
        };

        // 4. 생성 시작
        tasks.forEach(task => {
            if (task.type === 'unit') {
                this.generateUnitTextures(task.name, task.team, task.config, checkDone);
            } else {
                // 기지 생성 시 param(팀 정보)을 넘겨서 색상을 결정하게 함
                const svgStr = this.getSVGString(task.key.replace('_ALLY', '').replace('_ENEMY', ''), task.param);
                this.createTexture(task.key, svgStr, checkDone);
            }
        });
    }

    generateUnitTextures(name, team, partConfig, onUnitFinished) {
        let partsToLoad = 0;
        if (partConfig.body) partsToLoad++;
        if (partConfig.weapon) partsToLoad++;
        if (partConfig.acc) partsToLoad++;

        if (partsToLoad === 0) {
            if (onUnitFinished) onUnitFinished();
            return;
        }

        let partsLoaded = 0;
        const onPartDone = () => {
            partsLoaded++;
            if (partsLoaded >= partsToLoad) {
                if (onUnitFinished) onUnitFinished();
            }
        };

        if (partConfig.body) {
            this.createTexture(`${partConfig.body}_${team}`, this.getSVGString(partConfig.body, team), onPartDone);
        }
        if (partConfig.weapon) {
            this.createTexture(partConfig.weapon, this.getSVGString(partConfig.weapon), onPartDone);
        }
        if (partConfig.acc) {
            this.createTexture(`${partConfig.acc}_${team}`, this.getSVGString(partConfig.acc, team), onPartDone);
        }
    }

    createTexture(key, svgString, callback) {
        // 1. 이미 존재하거나 로딩 중이면 즉시 완료 처리
        if (this.scene.textures.exists(key) || this.pendingKeys.has(key)) {
            if (callback) callback();
            return;
        }

        if (!svgString) {
            // SVG 데이터가 없으면 경고만 하고 넘어감
            // console.warn(`⚠️ [SVGManager] 빈 데이터: ${key}`);
            if (callback) callback();
            return;
        }

        this.pendingKeys.add(key);

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();

        // [안전장치 3] 개별 이미지 0.5초 타임아웃
        const imgWatchdog = setTimeout(() => {
            console.error(`⌛ [SVGManager] 이미지 로딩 타임아웃: ${key}`);
            this.pendingKeys.delete(key);
            URL.revokeObjectURL(url);
            if (callback) callback();
        }, 500);

        img.onload = () => {
            clearTimeout(imgWatchdog);
            this.scene.textures.addImage(key, img);
            this.pendingKeys.delete(key);
            URL.revokeObjectURL(url);
            if (callback) callback();
        };

        img.onerror = () => {
            clearTimeout(imgWatchdog);
            console.error(`❌ [SVGManager] 이미지 변환 실패: ${key}`);
            this.pendingKeys.delete(key);
            if (callback) callback();
        };

        img.src = url;
    }

    /**
     * SVG 문자열 가져오기 + 색상 변환 (Legacy 지원 포함)
     */
    getSVGString(key, overrideColorOrTeam = null) {
        if (typeof SVG_DATA === 'undefined' || !SVG_DATA[key]) {
            return null;
        }

        // 1. 팀 이름을 색상 코드로 변환
        let finalColor = '#ffffff'; 
        
        if (overrideColorOrTeam === 'ALLY') finalColor = '#3498db';      
        else if (overrideColorOrTeam === 'ENEMY') finalColor = '#e74c3c'; 
        else if (overrideColorOrTeam) finalColor = overrideColorOrTeam;   

        const data = SVG_DATA[key];

        // 2. Case A: 함수형
        if (typeof data === 'function') {
            return data(finalColor);
        }

        // 3. Case B: 객체형 (render 함수)
        if (data.render && typeof data.render === 'function') {
            return data.render(finalColor);
        }

        // 4. Case C: 배열형 (Legacy - paths)
        if (data.paths) {
            let pathsStr = '';
            data.paths.forEach((p, index) => {
                const fillColor = (index === 0 && finalColor) ? finalColor : p.color;
                
                if (p.path === 'circle') {
                    pathsStr += `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fillColor}" />`;
                } else {
                    let attrs = `d="${p.path}"`;
                    if (p.stroke) {
                        attrs += ` stroke="${fillColor}" stroke-width="${p.width || 1}" fill="none"`;
                    } else {
                        attrs += ` fill="${fillColor}" stroke="none"`;
                    }
                    pathsStr += `<path ${attrs} />`;
                }
            });
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${data.viewBox}" width="100" height="100">${pathsStr}</svg>`;
        }

        return null;
    }
}