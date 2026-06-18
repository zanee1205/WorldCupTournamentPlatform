// Map tên quốc gia (theo cách bạn đang dùng trong app) -> mã ISO 3166-1 alpha-2
// Dùng để build URL cờ qua flagcdn.com, ví dụ: https://flagcdn.com/{code}.svg
// Danh sách 48 đội tham dự World Cup 2026.

export const COUNTRY_FLAG_CODE: Record<string, string> = {
    // ─── Chủ nhà ───
    'Mỹ (chủ nhà)': 'us',
    'Mỹ': 'us',
    'Mexico (chủ nhà)': 'mx',
    'Mexico': 'mx',
    'Canada (chủ nhà)': 'ca',
    'Canada': 'ca',

    // ─── CONCACAF ───
    'Panama': 'pa',
    'Curacao': 'cw',
    'Haiti': 'ht',

    // ─── AFC (châu Á) ───
    'Nhật Bản': 'jp',
    'Iran': 'ir',
    'Uzbekistan': 'uz',
    'Australia': 'au',
    'Hàn Quốc': 'kr',
    'Jordan': 'jo',
    'Saudi Arabia': 'sa',
    'Qatar': 'qa',
    'Iraq': 'iq',

    // ─── CAF (châu Phi) ───
    'Morocco': 'ma',
    'Tunisia': 'tn',
    'Ai Cập': 'eg',
    'Algeria': 'dz',
    'Ghana': 'gh',
    'Cape Verde': 'cv',
    'Nam Phi': 'za',
    'Senegal': 'sn',
    'Bờ Biển Ngà': 'ci',
    'CHDC Congo': 'cd',

    // ─── CONMEBOL (Nam Mỹ) ───
    'Argentina': 'ar',
    'Ecuador': 'ec',
    'Brazil': 'br',
    'Colombia': 'co',
    'Uruguay': 'uy',
    'Paraguay': 'py',

    // ─── OFC ───
    'New Zealand': 'nz',

    // ─── UEFA (châu Âu) ───
    'Anh': 'gb-eng', // England - flagcdn hỗ trợ mã riêng cho các vùng của Vương quốc Anh
    'Pháp': 'fr',
    'Croatia': 'hr',
    'Bồ Đào Nha': 'pt',
    'Na Uy': 'no',
    'Đức': 'de',
    'Hà Lan': 'nl',
    'Thụy Sĩ': 'ch',
    'Scotland': 'gb-sct',
    'Tây Ban Nha': 'es',
    'Áo': 'at',
    'Bỉ': 'be',
    'Bosnia and Herzegovina': 'ba',
    'Thụy Điển': 'se',
    'Thổ Nhĩ Kỳ': 'tr',
    'Séc': 'cz',
};

/**
 * Trả về URL ảnh cờ theo tên quốc gia.
 * format = 'svg' (mặc định, vector, scale đẹp) hoặc 24 | 40 | 80 (PNG theo chiều rộng px).
 * Trả về null nếu tên quốc gia chưa có trong bảng map.
 */
export function getFlagUrl(
    countryName: string,
    format: 'svg' | 24 | 40 | 80 = 'svg',
): string | null {
    const code = COUNTRY_FLAG_CODE[countryName];
    if (!code) return null;

    return format === 'svg'
        ? `https://flagcdn.com/${code}.svg`
        : `https://flagcdn.com/w${format}/${code}.png`;
}