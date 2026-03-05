export default async function handler(req, res) {
    const { page = 1, category = 'Category_1' } = req.query;
    const url = `https://www.ylfilm.co.kr/list/api/?page=${page}&category_idx=${category}`;
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
}
