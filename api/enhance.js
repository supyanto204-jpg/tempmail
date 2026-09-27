// api/enhance.js — Proxy enhance ke panel Pterodactyl
const axios = require('axios');

// ⚠️ GANTI URL INI dengan URL panel Pterodactyl lu
const PANEL_URL = process.env.PANEL_URL || 'https://panel-lu.pterodactyl.io';
const PANEL_API_KEY = process.env.PANEL_API_KEY || 'rahasia'; // optional, kalau panel butuh auth

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, type, options } = req.body;
        if (!url || !type) return res.status(400).json({ error: 'url & type required' });

        console.log(`[Enhance Proxy] ${type} → ${url}`);
        console.log(`[Forward to] ${PANEL_URL}/api/enhance`);

        // Forward ke panel Pterodactyl
        const panelResponse = await axios.post(
            `${PANEL_URL}/api/enhance`,
            { url, type, options },
            {
                timeout: 5 * 60 * 1000, // 5 menit, karena enhance bisa lama
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': PANEL_API_KEY
                }
            }
        );

        res.json(panelResponse.data);

    } catch (err) {
        console.error('[Enhance Proxy Error]', err.message);
        res.status(500).json({
            error: err.response?.data?.error || err.message
        });
    }
};
