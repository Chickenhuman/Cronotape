// js/data/SVGData.js

const SVG_DATA = {
    // ---------------------------------------------------------------------
    // 🛡️ 몸통 (Bodies) - (기존 유지: 색상 파라미터 적용)
    // ---------------------------------------------------------------------
    // 1. 기사 (중갑)
    body_knight: (color) => `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 20 Q30 60 50 20 L45 50 Q30 55 15 50 Z" fill="${color}" stroke="#000" stroke-width="1"/>
            <rect x="18" y="25" width="24" height="25" rx="3" fill="#aaa" stroke="#333" stroke-width="2"/>
            <rect x="22" y="28" width="16" height="18" rx="2" fill="#ddd"/>
            <circle cx="30" cy="18" r="10" fill="#bbb" stroke="#333" stroke-width="2"/>
            <line x1="25" y1="18" x2="35" y2="18" stroke="#333" stroke-width="2"/> 
            <line x1="30" y1="18" x2="30" y2="28" stroke="#333" stroke-width="2"/> 
        </svg>`,
        
    // 2. 궁수 (가죽)
    body_archer: (color) => `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 25 L45 25 L40 50 L20 50 Z" fill="#8d6e63" stroke="#4e342e" stroke-width="2"/>
            <rect x="20" y="45" width="20" height="5" fill="${color}"/>
            <path d="M20 25 Q30 5 40 25 L40 25 L20 25 Z" fill="#5d4037" stroke="#3e2723" stroke-width="2"/>
            <circle cx="30" cy="20" r="6" fill="#ffccbc"/> 
        </svg>`,

    // 3. 로브 (마법사/힐러)
    body_robe: (color) => `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 20 Q30 10 45 20 L50 55 L10 55 Z" fill="#eee" stroke="#ccc" stroke-width="2"/>
            <path d="M20 20 L25 55 M40 20 L35 55" stroke="${color}" stroke-width="4"/>
            <circle cx="30" cy="18" r="9" fill="#ffccbc" stroke="#333" stroke-width="1"/>
            <path d="M20 12 L30 2 L40 12" fill="${color}" stroke="#333"/> 
        </svg>`,

    // 4. 암살자 (닌자)
    body_ninja: (color) => `
        <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="25" width="20" height="25" fill="#333" stroke="#000"/>
            <circle cx="30" cy="18" r="9" fill="#222" stroke="#000"/>
            <rect x="25" y="16" width="10" height="4" fill="#fff"/>
            <path d="M25 25 L35 25 L35 35 L30 40 L25 35 Z" fill="${color}"/>
        </svg>`,

    // ---------------------------------------------------------------------
    // ⚔️ 무기 (Weapons) - ★ [변환 완료] Path 데이터를 완전한 SVG 코드로 변환
    // ---------------------------------------------------------------------
    // * 모든 무기는 100x100 viewBox를 가지며, 60x60 크기로 렌더링되도록 설정됨
// 1. 기본 검
    weapon_sword: {
        offset: { x: 10, y: 9 }, // 기존 하드코딩 값 이관
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 45 20 L 55 20 L 55 80 L 45 80 Z" fill="#CCCCCC"/> 
                <path d="M 45 20 L 50 10 L 55 20 Z" fill="#CCCCCC"/>
                <path d="M 30 75 L 70 75 L 70 85 L 30 85 Z" fill="#444444"/>
                <path d="M 47 85 L 53 85 L 53 95 L 47 95 Z" fill="#8B4513"/>
            </svg>`
    },

    // 2. 대검
    weapon_greatsword: {
        offset: { x: 10, y: 6 }, 
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 40 15 L 60 15 L 58 80 L 42 80 Z" fill="#DDDDDD"/>
                <path d="M 40 15 L 50 5 L 60 15 Z" fill="#DDDDDD"/>
                <path d="M 49 20 L 51 20 L 51 70 L 49 70 Z" fill="#999999"/>
                <path d="M 25 75 L 75 75 L 75 85 L 25 85 Z" fill="#333333"/>
                <path d="M 45 85 L 55 85 L 55 100 L 45 100 Z" fill="#5D4037"/>
            </svg>`
    },

    // 3. 활
    weapon_bow: {
        offset: { x: 18, y: 10 },
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 20 20 Q 80 50 20 80" fill="none" stroke="#8B4513" stroke-width="4"/>
                <path d="M 20 20 L 20 80" fill="none" stroke="#EEEEEE" stroke-width="1"/>
            </svg>`
    },

    // 4. 단검
    weapon_dagger: {
        offset: { x: 18, y: 10 },
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 45 40 L 55 40 L 52 80 L 48 80 Z" fill="#AAAAAA"/>
                <path d="M 45 40 L 50 30 L 55 40 Z" fill="#AAAAAA"/>
                <path d="M 40 80 L 60 80 L 60 85 L 40 85 Z" fill="#222222"/>
                <path d="M 46 85 L 54 85 L 54 95 L 46 95 Z" fill="#553311"/>
            </svg>`
    },

    // 5. 지팡이
    weapon_staff: {
        offset: { x: 18, y: 10 },
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 48 10 L 52 10 L 51 95 L 49 95 Z" fill="#8B4513"/>
                <path d="M 40 10 L 60 10 L 50 25 Z" fill="#FFD700"/>
                <circle cx="50" cy="10" r="8" fill="#00FFFF"/> 
            </svg>`
    },

    // ---------------------------------------------------------------------
    // 👜 액세서리 (Accessories) - ★ [변환 완료]
    // ---------------------------------------------------------------------
// 1. 방패 (앞쪽에 배치)
    acc_shield: {
        offset: { x: -11, y: 5 },
        depth: 1,
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="30" fill="#555555"/>
                <circle cx="50" cy="50" r="25" fill="#777777"/>
                <path d="M 45 35 L 55 35 L 55 65 L 45 65 Z" fill="#EEEEEE"/>
                <path d="M 35 45 L 65 45 L 65 55 L 35 55 Z" fill="#EEEEEE"/>
            </svg>`
    },

acc_book: {
        offset: { x: -12, y: 0},
        depth: 1,
        render: () => `
            <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <path d="M 30 30 L 70 30 L 70 70 L 30 70 Z" fill="#800000"/>
                <path d="M 35 35 L 65 35 L 65 65 L 35 65 Z" fill="#FFFFFF"/>
                <path d="M 45 45 L 55 45 L 55 55 L 45 55 Z" fill="#FFD700"/>
            </svg>`
    },

    // ---------------------------------------------------------------------
    // 🏰 기지 & 지휘관 (Base) - ★ [이제 정상적으로 포함됩니다]
    // ---------------------------------------------------------------------
    // 1. 아군 기지 (Knight Commander)
    base_knight: {
        render: () => `
            <svg width="120" height="120" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#3498db;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#2980b9;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <path d="M256 40 L60 100 L60 280 C60 400 256 490 256 490 C256 490 452 400 452 280 L452 100 L256 40 Z" fill="url(#grad1)" stroke="#ecf0f1" stroke-width="10"/>
                
                <path d="M180 160 C180 100 220 80 256 80 C292 80 332 100 332 160 V 220 H 180 V 160 Z" fill="#bdc3c7"/>
                <rect x="170" y="220" width="172" height="120" rx="10" ry="10" fill="#95a5a6"/>
                <rect x="200" y="240" width="112" height="10" fill="#2c3e50"/>
                <path d="M251 240 V 300" stroke="#2c3e50" stroke-width="5"/>
                
                <path d="M256 80 C256 80 220 20 180 30 C160 35 150 60 160 80" fill="none" stroke="#f1c40f" stroke-width="8" stroke-linecap="round"/>
                <path d="M256 80 C256 80 292 20 332 30 C352 35 362 60 352 80" fill="none" stroke="#f1c40f" stroke-width="8" stroke-linecap="round"/>
            </svg>`
    },

    // 2. 적군 기지 (Enemy Warlord)
    base_enemy: {
        render: () => `
            <svg width="120" height="120" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gradEnemy" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:#4a0e0e;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <path d="M256 20 L460 80 L420 350 L256 480 L92 350 L52 80 L256 20 Z" fill="url(#gradEnemy)" stroke="#c0392b" stroke-width="8"/>
                
                <path d="M156 180 L180 100 L256 140 L332 100 L356 180" fill="none" stroke="#7f8c8d" stroke-width="15" stroke-linejoin="round"/>
                <path d="M166 180 Q256 350 346 180" fill="#34495e"/>
                
                <path d="M166 180 C100 150 80 60 100 40" fill="none" stroke="#ecf0f1" stroke-width="12" stroke-linecap="round"/>
                <path d="M346 180 C412 150 432 60 412 40" fill="none" stroke="#ecf0f1" stroke-width="12" stroke-linecap="round"/>
                
                <circle cx="210" cy="210" r="15" fill="#e74c3c" />
                <circle cx="302" cy="210" r="15" fill="#e74c3c" />
            </svg>`
    },
    // 3. [안전장치] 포병대장 (기본값)
    base_artillery: {
        render: () => `
            <svg width="120" height="120" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gradArt" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#e74c3c;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#c0392b;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <path d="M256 40 L60 100 L60 280 C60 400 256 490 256 490 C256 490 452 400 452 280 L452 100 L256 40 Z" fill="url(#gradArt)" stroke="#ecf0f1" stroke-width="10"/>
                <path d="M180 160 C180 100 220 80 256 80 C292 80 332 100 332 160 V 220 H 180 V 160 Z" fill="#bdc3c7"/>
                <rect x="170" y="220" width="172" height="120" rx="10" ry="10" fill="#7f8c8d"/>
            </svg>`
    }
}; // ★★★ 진짜 닫는 위치는 여기입니다!

if (typeof window !== 'undefined') {
    window.SVG_DATA = SVG_DATA;
}