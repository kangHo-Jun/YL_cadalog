export default async function handler(req, res) {
    const { page = 1, category, search_filter } = req.query;

    // 카테고리가 있으면 category_idx 추가, 없으면 전체 검색
    let url = `https://www.ylfilm.co.kr/list/api/?page=${page}`;
    if (category) {
        url += `&category_idx=${category}`;
    }
    if (search_filter) {
        url += `&search_filter=${search_filter}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
}
