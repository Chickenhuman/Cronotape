// js/managers/SVGManager.js

class SVGManager {
    constructor() {
        // [1] SVG 데이터 정의 (White-Base 설계로 틴트 적용 용이)
        this.svgData = {
            // --- 몸통 (Body) ---
            'body_infantry': `
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                    <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000" opacity="0.3"/>
                    <path d="M22 25 Q32 55 42 25" fill="#ccc" stroke="#000" stroke-width="2"/>
                    <rect x="22" y="22" width="20" height="26" rx="4" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                    <rect x="22" y="38" width="20" height="4" fill="#333"/>
                    <circle cx="32" cy="18" r="10" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                    <path d="M24 18 L40 18" stroke="#000" stroke-width="2"/>
                </svg>`,
            
            'body_robe': `
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
                    <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000" opacity="0.3"/>
                    <path d="M18 22 L46 22 L52 58 L12 58 Z" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                    <circle cx="32" cy="16" r="11" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                    <path d="M32 22 L32 58" stroke="#000" stroke-width="1" stroke-dasharray="4"/>
                </svg>`,

            // --- 무기 (Weapon) ---
            'weapon_sword': `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="64" viewBox="0 0 32 64">
                    <g transform="translate(16, 45)">
                        <path d="M-3 -35 L3 -35 L5 0 L-5 0 Z" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                        <rect x="-8" y="0" width="16" height="4" fill="#D4AF37" stroke="#000" stroke-width="1.5"/>
                        <rect x="-2" y="4" width="4" height="10" fill="#654321"/>
                    </g>
                </svg>`,

            'weapon_staff': `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="64" viewBox="0 0 32 64">
                    <g transform="translate(16, 45)">
                        <rect x="-2" y="-40" width="4" height="50" fill="#8B4513" stroke="#000" stroke-width="1"/>
                        <circle cx="0" cy="-45" r="8" fill="#FFFFFF" stroke="#000" stroke-width="2"/>
                    </g>
                </svg>`,

            'weapon_bow': `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="64" viewBox="0 0 32 64">
                    <g transform="translate(10, 32)">
                        <path d="M0 -25 Q 30 0 0 25" fill="none" stroke="#8B4513" stroke-width="4"/>
                        <line x1="0" y1="-25" x2="0" y2="25" stroke="#eee" stroke-width="1"/>
                    </g>
                </svg>`,

            'weapon_dagger': `
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                    <g transform="translate(16, 20)">
                        <path d="M-2 -15 L2 -15 L3 0 L-3 0 Z" fill="#FFFFFF" stroke="#000" stroke-width="1.5"/>
                        <rect x="-1" y="0" width="2" height="6" fill="#333"/>
                    </g>
                </svg>`,

            // --- 방패 (Shield) ---
            'shield_round': `
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 48 64">
                    <path d="M4 8 L4 25 Q4 55 24 60 Q44 55 44 25 L44 8 Q24 2 4 8 Z" fill="#FFFFFF" stroke="#000" stroke-width="3"/>
                    <path d="M24 15 L24 50 M12 28 L36 28" stroke="#000" stroke-width="1" opacity="0.2"/>
                </svg>`
        };
    }

    // [2] 텍스처 초기화 (Blob 방식 사용)
    initTextures(scene) {
        console.log("🎨 SVG 텍스처 생성 중...");
        
        for (const [key, svgString] of Object.entries(this.svgData)) {
            if (scene.textures.exists(key)) continue;

            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            scene.load.svg(key, url);
        }
        
        if (!scene.load.isLoading()) {
            scene.load.start();
        }
    }

    // [3] 유닛별 파츠 매핑
    getParts(unitName) {
        switch(unitName) {
            case '검사': return { body: 'body_infantry', weapon: 'weapon_sword', shield: 'shield_round' };
            case '궁수': return { body: 'body_infantry', weapon: 'weapon_bow', shield: null };
            case '마법사': return { body: 'body_robe', weapon: 'weapon_staff', shield: null };
            case '힐러': return { body: 'body_robe', weapon: 'weapon_staff', shield: null };
            case '암살자': return { body: 'body_infantry', weapon: 'weapon_dagger', shield: null };
            case '적군': return { body: 'body_infantry', weapon: 'weapon_sword', shield: 'shield_round' };
            default: return { body: 'body_infantry', weapon: null, shield: null };
        }
    }

    // [4] 무기별 애니메이션 타입 매핑 (Unit.js에서 사용)
    getWeaponAnimType(weaponKey) {
        if (!weaponKey) return 'BODY';

        if (weaponKey.includes('sword') || weaponKey.includes('axe') || weaponKey.includes('mace')) return 'SWING';
        if (weaponKey.includes('dagger') || weaponKey.includes('spear')) return 'STAB';
        if (weaponKey.includes('bow') || weaponKey.includes('crossbow')) return 'SHOOT';
        if (weaponKey.includes('staff') || weaponKey.includes('wand')) return 'CAST';
        
        return 'SWING'; // 기본값
    }
}

// 전역 인스턴스
const SVG_MANAGER = new SVGManager();