export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).send("No URL provided");

    try {
        const response = await fetch(decodeURIComponent(url));
        const contentType = response.headers.get("content-type");
        const buffer = await response.arrayBuffer();

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Content-Type", contentType);
        res.send(Buffer.from(buffer));
    } catch (error) {
        res.status(500).send("Proxy error: " + error.message);
    }
}
