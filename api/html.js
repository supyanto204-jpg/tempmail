const axios = require('axios');

module.exports = async (req, res) => {
    try {
        const { region, key } = req.query;

        if (!region || !key) {
            return res.status(400).json({ error: 'region & key required' });
        }

        const url = `https://akunlama.com/api/getHtml?region=${encodeURIComponent(region)}&key=${encodeURIComponent(key)}`;
        const response = await axios.get(url, {
            timeout: 15000,
            responseType: 'text',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            error: err.message,
            detail: err.response?.data || null
        });
    }
};
