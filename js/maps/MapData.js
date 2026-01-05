// js/maps/MapData.js

window.MAPS = {}; 

// 맵 문자열을 2차원 배열로 변환하는 함수
function parseMapLayout(layoutString) {
    return layoutString.trim().split('\n').map(row => {
        const cleanRow = row.split('//')[0].trim();
        return cleanRow.split('').map(char => {
            if (char === '1' || char === '#') return 1; // 장애물 (유닛X, 스킬O)
            if (char === '2' || char === '@') return 2; // 아군 지역
            if (char === '3' || char === '!') return 3; // 적군 감시 지역 (유닛X, 스킬O)
            if (char === '4') return 4;                 // ★ [신규] 플레이 불가 구역 (전체X)
            return 0;                                   // 중립 지역
        });
    });
}

// 기본 맵 레이아웃 (상하단 4로 변경)
const DEFAULT_MAP_LAYOUT = `
44444444444444444444444444 // 플레이구역 벗어남
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
22222200000001100000333333 // 강
22222200000000000000333333
22222200000000000000333333 // 다리
22222200000001100000333333
22222200000000000000333333
22222200000001100000333333
22222200000001100000333333
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
44444444444444444444444444
`;

const DefaultMap = {
    id: 'DefaultMap',
    image: 'bg_battle',
    tileSize: 50,
    
    // ★ 수정됨: 화면 크기에 맞춰 칸 수 확장
    mapWidth: 32,  // 1280px 커버 (26 * 50 = 1300)
    mapHeight: 18, // 720px 커버 (15 * 50 = 750)
    
    deployLimit: 266, // 아군 배치 한계선

    getGrid: function() {
        return parseMapLayout(DEFAULT_MAP_LAYOUT);
    }
};

window.MAPS['DefaultMap'] = DefaultMap;

window.getMapData = function(mapId) {
    if (window.MAPS[mapId]) {
        return window.MAPS[mapId];
    }
    console.warn(`[MapLoader] 맵 ID '${mapId}' 없음.`);
    return window.MAPS['DefaultMap'];
};

// 전역 저장소에 등록
window.MAPS['DefaultMap'] = DefaultMap;


// =======================================================
// [예시: Map02 - 좁은 협곡]
// =======================================================
/*
const MAP_02_LAYOUT = `
11111111111111111111
10000000000000000001
10000000000000000001
11111110000001111111
11111110000001111111
11111110000001111111
10000000000000000001
10000000000000000001
11111111111111111111
`;
window.MAPS['Map02'] = {
    id: 'Map02',
    image: 'bg_canyon',
    // ... 설정들 ...
    getGrid: () => parseMapLayout(MAP_02_LAYOUT)
};
*/

// =======================================================
// [맵 로더 함수]
// =======================================================
window.getMapData = function(mapId) {
    if (window.MAPS[mapId]) {
        console.log(`[MapLoader] 맵 로드 성공: ${mapId}`);
        return window.MAPS[mapId];
    }
    console.warn(`[MapLoader] 맵 ID '${mapId}' 없음. DefaultMap으로 대체합니다.`);
    return window.MAPS['DefaultMap'];
};