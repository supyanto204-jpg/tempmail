// Vercel Serverless Function
const axios = require('axios');

module.exports = async (req, res) => {
    try {
        const { recipient } = req.query;

        if (!recipient) {
            return res.status(400).json({ error: 'recipient required' });
        }

        const url = `https://akunlama.com/api/list?recipient=${encodeURIComponent(recipient)}`;
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.status(200).json(response.data);
    } catch (err) {
        res.status(err.response?.status || 500).json({
            error: err.message,
            detail: err.response?.data || null
        });
    }
};
