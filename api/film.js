/**
 * 영림필름 API 중계 프록시 (Vercel Serverless Function)
 */
export default async function handler(req, res) {
    const { page = 1, category = 'Category_1' } = req.query;

    // 타겟 API URL 구성
    const targetUrl = `https://www.ylfilm.co.kr/list/api/?page=${page}&category_idx=${category}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.ylfilm.co.kr/',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch from Younglim API' });
        }

        const data = await response.json();

        // CORS 헤더 설정 (카페24 등 외부 도메인에서 호출 가능하도록)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Content-Type', 'application/json');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
