// ==============================================================================
// api/download.js — TikTok Downloader (HD, Video/Photo auto-detect)
// ==============================================================================
const axios = require('axios');

const httpClient = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL required' });
        if (!/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url)) {
            return res.status(400).json({ error: 'Cuma link TikTok yang didukung' });
        }

        const result = await downloadTikTok(url);
        res.json(result);

    } catch (err) {
        console.error('[DL ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
};

async function downloadTikTok(url) {
    // Coba 2 API biar lebih stabil
    let data = null;
    let lastErr = null;

    // API 1: tikwm.com
    try {
        const r = await httpClient.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`);
        if (r.data && r.data.code === 0 && r.data.data) {
            data = r.data.data;
        }
    } catch (e) {
        console.log('tikwm gagal:', e.message);
        lastErr = e;
    }

    // API 2: tiklydown (fallback)
    if (!data) {
        try {
            const r = await httpClient.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
            if (r.data && r.data.video) {
                // Normalisasi ke format tikwm
                data = {
                    title: r.data.title || 'TikTok Video',
                    author: r.data.author ? { nickname: r.data.author.name } : null,
                    cover: r.data.video?.cover || '',
                    duration: 0,
                    play: r.data.video?.noWatermark || r.data.video?.url || '',
                    hdplay: r.data.video?.noWatermark || r.data.video?.url || '',
                    music: r.data.music?.play_url || '',
                    images: r.data.images || []
                };
            }
        } catch (e) {
            console.log('tiklydown gagal:', e.message);
            lastErr = e;
        }
    }

    if (!data) throw new Error(lastErr ? lastErr.message : 'Semua API gagal');

    // Deteksi: foto slideshow atau video
    const hasImages = data.images && Array.isArray(data.images) && data.images.length > 0;
    const isPhotoPost = hasImages;

    const links = [];

    if (isPhotoPost) {
        // Cuma foto — gak ada video/audio
        data.images.forEach(function(img, i) {
            links.push({
                label: `Foto ${i + 1} dari ${data.images.length}`,
                url: img,
                type: 'IMG'
            });
        });
    } else {
        // Video — cuma HD (skip SD)
        const hdUrl = data.hdplay || data.play;
        if (hdUrl) {
            links.push({
                label: 'Video HD (No Watermark)',
                url: hdUrl,
                type: 'MP4'
            });
        }

        // Audio opsional
        if (data.music) {
            links.push({
                label: 'Audio Only',
                url: data.music,
                type: 'MP3'
            });
        }
    }

    return {
        title: data.title || 'TikTok Media',
        author: data.author?.nickname ? '@' + data.author.nickname : '',
        thumbnail: data.cover || '',
        duration: data.duration ? data.duration + 's' : '',
        isPhotoPost: isPhotoPost,
        totalPhotos: isPhotoPost ? data.images.length : 0,
        links: links
    };
}
